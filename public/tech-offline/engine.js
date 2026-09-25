/* Tech offline workspace. Shared by the static shell and the online app bridge. */
(function () {
  var DB_NAME = 'fixtray-tech-offline';
  var DB_VERSION = 1;
  var listeners = [];
  var syncing = false;
  var needsReauth = false;
  var bridgeStarted = false;
  var lastError = '';

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'idempotencyKey' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('aborted')); };
    });
  }

  function reqDone(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function all(storeName) {
    var db = await openDb();
    var tx = db.transaction(storeName, 'readonly');
    var rows = await reqDone(tx.objectStore(storeName).getAll());
    db.close();
    return rows || [];
  }

  async function put(storeName, value) {
    var db = await openDb();
    var tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    await txDone(tx);
    db.close();
  }

  async function del(storeName, key) {
    var db = await openDb();
    var tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    await txDone(tx);
    db.close();
  }

  async function getMeta(key) {
    var db = await openDb();
    var tx = db.transaction('meta', 'readonly');
    var row = await reqDone(tx.objectStore('meta').get(key));
    db.close();
    return row ? row.value : null;
  }

  function key() {
    var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    return ('offline-' + id).slice(0, 80);
  }

  function token() {
    try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
  }

  function role() {
    try { return localStorage.getItem('userRole') || ''; } catch (e) { return ''; }
  }

  function isTech() {
    return role() === 'tech' || role() === 'manager';
  }

  async function rememberToken() {
    var value = token();
    if (!value) return;
    try {
      var cap = window.Capacitor;
      if (cap && cap.isPluginAvailable && cap.isPluginAvailable('SecureStoragePlugin') && cap.Plugins && cap.Plugins.SecureStoragePlugin) {
        await cap.Plugins.SecureStoragePlugin.set({ key: 'fixtray_offline_token', value: value });
      }
    } catch (e) { /* secure storage is optional */ }
  }

  async function clearSecureToken() {
    try {
      var cap = window.Capacitor;
      if (cap && cap.isPluginAvailable && cap.isPluginAvailable('SecureStoragePlugin') && cap.Plugins && cap.Plugins.SecureStoragePlugin) {
        await cap.Plugins.SecureStoragePlugin.remove({ key: 'fixtray_offline_token' });
      }
    } catch (e) { /* ignore */ }
  }

  function emit() {
    var snap = snapshotSync;
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    try {
      window.dispatchEvent(new CustomEvent('fixtray-offline-status', { detail: snap }));
    } catch (e) {}
  }

  var snapshotSync = { offline: false, pending: 0, conflicts: 0, syncing: false, needsReauth: false, label: 'All synced' };

  async function refreshSnapshot() {
    var outbox = await all('outbox');
    var pending = outbox.filter(function (item) { return item.state === 'pending'; }).length;
    var conflicts = outbox.filter(function (item) { return item.state === 'conflict' || item.state === 'held'; }).length;
    var offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    var label = 'All synced';
    if (needsReauth) label = 'Sign in to finish syncing';
    else if (syncing) label = 'Syncing…';
    else if (offline && pending) label = pending + ' pending upload';
    else if (pending) label = pending + ' pending';
    else if (conflicts) label = conflicts + ' need review';
    snapshotSync = { offline: offline, pending: pending, conflicts: conflicts, syncing: syncing, needsReauth: needsReauth, label: label, lastError: lastError };
    emit();
    return snapshotSync;
  }

  function authHeaders() {
    return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' };
  }

  async function prefetch() {
    if (!isTech() || !token() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    var response = await fetch('/api/tech/offline-bundle', { headers: { Authorization: 'Bearer ' + token() } });
    if (response.status === 401) { needsReauth = true; await refreshSnapshot(); return; }
    if (!response.ok) return;
    needsReauth = false;
    var data = await response.json();
    var db = await openDb();
    var tx = db.transaction(['jobs', 'meta'], 'readwrite');
    var jobs = tx.objectStore('jobs');
    (data.workOrders || []).forEach(function (job) { jobs.put(job); });
    tx.objectStore('meta').put({ key: 'bundle', value: {
      techId: data.techId,
      laborRate: data.laborRate || 0,
      catalog: data.catalog || [],
      clock: data.clock || null,
      fetchedAt: data.fetchedAt,
      techName: data.techName || '',
    } });
    await txDone(tx);
    db.close();
    await rememberToken();
    await refreshSnapshot();
  }

  async function enqueue(partial) {
    var item = {
      idempotencyKey: partial.idempotencyKey || key(),
      clientId: partial.clientId || key(),
      kind: partial.kind,
      workOrderId: partial.workOrderId || null,
      payload: partial.payload || {},
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      state: 'pending',
      message: '',
      url: partial.url || '',
    };
    await put('outbox', item);
    await refreshSnapshot();
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      syncNow();
    } else {
      registerBackgroundSync();
    }
    return item;
  }

  async function viewJobs() {
    var jobs = await all('jobs');
    var outbox = await all('outbox');
    return jobs.map(function (job) { return decorate(job, outbox); }).sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function decorate(job, outbox) {
    var copy = JSON.parse(JSON.stringify(job));
    copy.techLabor = Array.isArray(copy.techLabor) ? copy.techLabor : [];
    copy.partsUsed = Array.isArray(copy.partsUsed) ? copy.partsUsed : [];
    copy.workPhotos = Array.isArray(copy.workPhotos) ? copy.workPhotos : [];
    var completion = copy.completion && typeof copy.completion === 'object' ? copy.completion : {};
    completion.offlineNotes = Array.isArray(completion.offlineNotes) ? completion.offlineNotes : [];
    copy.completion = completion;
    copy.pendingCount = 0;
    outbox.filter(function (item) { return item.workOrderId === job.id; }).forEach(function (item) {
      if (item.state === 'pending' || item.state === 'conflict' || item.state === 'held') copy.pendingCount += 1;
      var clientId = item.clientId;
      if (item.kind === 'labor' && !copy.techLabor.some(function (row) { return row.clientId === clientId; })) {
        copy.techLabor.push(Object.assign({ clientId: clientId, pending: true, state: item.state }, item.payload));
      }
      if (item.kind === 'part' && !copy.partsUsed.some(function (row) { return row.clientId === clientId; })) {
        copy.partsUsed.push(Object.assign({ clientId: clientId, pending: true, state: item.state, name: item.payload.name }, item.payload));
      }
      if (item.kind === 'note' && !completion.offlineNotes.some(function (row) { return row.clientId === clientId; })) {
        completion.offlineNotes.push({ clientId: clientId, body: item.payload.body, pending: true, state: item.state });
      }
      if (item.kind === 'photo' && !copy.workPhotos.some(function (row) { return row.clientId === clientId; })) {
        copy.workPhotos.push({ clientId: clientId, url: item.url || '', pending: true, state: item.state, caption: item.payload.caption || '' });
      }
      if (item.kind === 'status' && item.state === 'pending') copy.pendingStatus = item.payload.status;
      if (item.message) copy.syncMessage = item.message;
    });
    return copy;
  }

  async function syncNow() {
    if (syncing) return snapshotSync;
    if (!token()) { needsReauth = true; return refreshSnapshot(); }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return refreshSnapshot();
    syncing = true;
    lastError = '';
    await refreshSnapshot();
    try {
      var outbox = (await all('outbox')).sort(function (a, b) { return a.createdAt - b.createdAt; });
      for (var i = 0; i < outbox.length; i += 1) {
        var item = outbox[i];
        if (item.state === 'conflict' || item.state === 'held') continue;
        if (item.nextAttemptAt && item.nextAttemptAt > Date.now()) break;
        var stop = await sendOne(item);
        if (stop) break;
      }
    } finally {
      syncing = false;
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) await prefetch();
      else await refreshSnapshot();
    }
    return snapshotSync;
  }

  async function sendOne(item) {
    try {
      if (item.kind === 'photo' && !item.url) {
        item.url = await uploadPhoto(item);
        await put('outbox', item);
      }
      var response = await fetch('/api/tech/offline-sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ops: [toOp(item)] }),
      });
      if (response.status === 401) {
        needsReauth = true;
        lastError = 'Sign in to finish syncing. Nothing was deleted.';
        return true;
      }
      if (!response.ok) {
        bump(item, 'Sync will retry.');
        await put('outbox', item);
        return true;
      }
      var data = await response.json();
      var row = (data.results || [])[0] || { status: 'rejected', message: 'Empty sync response.' };
      if (row.status === 'applied' || row.status === 'duplicate') {
        await del('outbox', item.idempotencyKey);
        if (item.kind === 'photo') await del('blobs', item.clientId);
        return false;
      }
      if (row.status === 'conflict') {
        item.state = 'conflict';
        item.message = row.message || 'Needs review';
        await put('outbox', item);
        return false;
      }
      if (row.message && row.message.indexOf('retried') !== -1) {
        bump(item, row.message);
        await put('outbox', item);
        return true;
      }
      item.state = 'held';
      item.message = row.message || 'Saved on this device.';
      await put('outbox', item);
      return false;
    } catch (error) {
      bump(item, 'Offline. Will upload when service returns.');
      await put('outbox', item);
      lastError = item.message;
      return true;
    }
  }

  function bump(item, message) {
    item.attempts = (item.attempts || 0) + 1;
    var delay = Math.min(30000 * Math.pow(2, item.attempts - 1), 5 * 60 * 1000);
    item.nextAttemptAt = Date.now() + delay;
    item.message = message;
    item.state = 'pending';
  }

  function toOp(item) {
    var op = { idempotencyKey: item.idempotencyKey, kind: item.kind, clientId: item.clientId, workOrderId: item.workOrderId };
    var payload = item.payload || {};
    Object.keys(payload).forEach(function (name) { op[name] = payload[name]; });
    if (item.url) op.url = item.url;
    return op;
  }

  async function uploadPhoto(item) {
    var db = await openDb();
    var tx = db.transaction('blobs', 'readonly');
    var row = await reqDone(tx.objectStore('blobs').get(item.clientId));
    db.close();
    if (!row || !row.blob) throw new Error('Photo file is missing.');
    var body = new FormData();
    var file = row.blob instanceof File ? row.blob : new File([row.blob], 'job-photo.jpg', { type: row.blob.type || 'image/jpeg' });
    body.append('file', file);
    body.append('folder', 'work-orders');
    body.append('idempotencyKey', (item.idempotencyKey + ':upload').slice(0, 80));
    var response = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token() },
      body: body,
    });
    if (response.status === 401) { needsReauth = true; throw new Error('auth'); }
    if (!response.ok) throw new Error('upload failed');
    var data = await response.json();
    if (!data.url) throw new Error('upload failed');
    return data.url;
  }

  function registerBackgroundSync() {
    if (!navigator.serviceWorker || !('SyncManager' in window)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.sync.register('fixtray-tech-offline');
    }).catch(function () {});
  }

  async function clearAll() {
    await clearSecureToken();
    await new Promise(function (resolve) {
      var req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { resolve(); };
      req.onblocked = function () { resolve(); };
    });
    needsReauth = false;
    await refreshSnapshot();
  }

  var api = {
    startBridge: function () {
      if (bridgeStarted || !isTech()) return;
      bridgeStarted = true;
      window.addEventListener('online', function () { prefetch().then(syncNow); });
      window.addEventListener('offline', function () { refreshSnapshot(); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && navigator.onLine) syncNow();
      });
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', function (event) {
          if (event.data && event.data.type === 'FIXTRAY_SYNC') syncNow();
        });
      }
      window.addEventListener('fixtray-logout', function () { clearAll(); });
      prefetch().then(syncNow);
      setInterval(function () {
        if (navigator.onLine) prefetch().then(syncNow);
      }, 120000);
      refreshSnapshot();
    },
    startApp: function () {
      api.startBridge();
      refreshSnapshot();
    },
    onChange: function (fn) { listeners.push(fn); },
    snapshot: function () { return snapshotSync; },
    refresh: refreshSnapshot,
    jobs: viewJobs,
    bundle: function () { return getMeta('bundle'); },
    outbox: function () { return all('outbox'); },
    prefetch: prefetch,
    syncNow: syncNow,
    clearAll: clearAll,
    photoBlob: async function (clientId) {
      var db = await openDb();
      var tx = db.transaction('blobs', 'readonly');
      var row = await reqDone(tx.objectStore('blobs').get(clientId));
      db.close();
      return row ? row.blob : null;
    },
    setStatus: function (workOrderId, baseStatus, status) {
      return enqueue({ kind: 'status', workOrderId: workOrderId, payload: { baseStatus: baseStatus, status: status } });
    },
    addLabor: function (workOrderId, description, hours, rate) {
      return enqueue({
        kind: 'labor',
        workOrderId: workOrderId,
        payload: { description: description, hours: Number(hours) || 0, rate: Number(rate) || 0 },
      });
    },
    addPart: function (workOrderId, name, quantity, unitPrice, partNumber) {
      return enqueue({
        kind: 'part',
        workOrderId: workOrderId,
        payload: { name: name, quantity: Number(quantity) || 1, unitPrice: Number(unitPrice) || 0, partNumber: partNumber || '' },
      });
    },
    addNote: function (workOrderId, body) {
      return enqueue({ kind: 'note', workOrderId: workOrderId, payload: { body: body } });
    },
    addPhoto: async function (workOrderId, file, caption) {
      var clientId = key();
      await put('blobs', { id: clientId, blob: file });
      return enqueue({ kind: 'photo', workOrderId: workOrderId, clientId: clientId, payload: { caption: caption || '' } });
    },
    clockIn: function (workOrderId, notes) {
      return enqueue({
        kind: 'clock-in',
        workOrderId: workOrderId || null,
        payload: { at: new Date().toISOString(), notes: notes || '' },
      });
    },
    clockOut: function (clockInClientId, notes) {
      return enqueue({
        kind: 'clock-out',
        payload: { at: new Date().toISOString(), notes: notes || '', clockInClientId: clockInClientId || '' },
      });
    },
  };

  window.FixTrayOffline = api;
})();
