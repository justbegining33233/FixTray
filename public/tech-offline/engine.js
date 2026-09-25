/* Offline workspace shared by every role. Durable IndexedDB outbox. */
(function () {
  var DB_NAME = 'fixtray-tech-offline';
  var DB_VERSION = 2;
  var listeners = [];
  var syncing = false;
  var needsReauth = false;
  var bridgeStarted = false;
  var lastError = '';
  var lowStorage = false;
  var encrypted = false;
  var lastTap = null;
  var gpsTimer = null;
  var lastGps = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'idempotencyKey' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncLog')) db.createObjectStore('syncLog', { keyPath: 'id' });
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

  function isQuota(error) {
    var name = error && (error.name || '');
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }

  async function all(storeName) {
    var db = await openDb();
    var tx = db.transaction(storeName, 'readonly');
    var rows = await reqDone(tx.objectStore(storeName).getAll());
    db.close();
    return rows || [];
  }

  async function put(storeName, value) {
    try {
      var db = await openDb();
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      await txDone(tx);
      db.close();
      lowStorage = false;
    } catch (error) {
      if (isQuota(error)) {
        lowStorage = true;
        lastError = 'This phone is low on storage. Free some space, then sync. Saved work was not deleted.';
        await refreshSnapshot();
      }
      throw error;
    }
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

  function storageGet(name) {
    try { return localStorage.getItem(name) || ''; } catch (e) { return ''; }
  }

  function token() { return storageGet('token'); }
  function role() { return storageGet('userRole'); }
  function userId() { return storageGet('userId'); }
  function mine(row) {
    if (!row || !row.userId || !userId()) return true;
    return row.userId === userId();
  }

  async function secureCall(method, payload) {
    try {
      var cap = window.Capacitor;
      var plugin = cap && cap.Plugins && cap.Plugins.SecureStoragePlugin;
      if (!plugin || !plugin[method]) return null;
      return await plugin[method](payload);
    } catch (e) { return null; }
  }

  async function rememberToken() {
    var value = token();
    if (!value) return;
    var saved = await secureCall('set', { key: 'fixtray_offline_token', value: value });
    encrypted = !!saved;
    if (!saved) return;
    var existing = await secureCall('get', { key: 'fixtray_offline_key' });
    var raw = existing && (existing.value || existing);
    if (!raw || typeof raw !== 'string') {
      var bytes = crypto.getRandomValues(new Uint8Array(32));
      var text = btoa(String.fromCharCode.apply(null, bytes));
      await secureCall('set', { key: 'fixtray_offline_key', value: text });
    }
  }

  async function clearSecureToken() {
    await secureCall('remove', { key: 'fixtray_offline_token' });
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    try {
      window.dispatchEvent(new CustomEvent('fixtray-offline-status', { detail: snapshotSync }));
    } catch (e) {}
  }

  var snapshotSync = { offline: false, pending: 0, conflicts: 0, failed: 0, syncing: false, needsReauth: false, label: 'All synced' };

  async function refreshSnapshot() {
    var outbox = (await all('outbox')).filter(mine);
    var pending = outbox.filter(function (item) { return item.state === 'pending'; }).length;
    var conflicts = outbox.filter(function (item) { return item.state === 'conflict' || item.state === 'held'; }).length;
    var failed = outbox.filter(function (item) { return item.state === 'failed'; }).length;
    var offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    var bundle = null;
    try { bundle = await getMeta('bundle'); } catch (e) { bundle = null; }
    var label = 'All synced';
    if (needsReauth) label = 'Sign in to finish syncing';
    else if (syncing) label = 'Syncing…';
    else if (failed) label = failed + ' failed';
    else if (offline && pending) label = pending + ' pending upload';
    else if (pending) label = pending + ' pending';
    else if (conflicts) label = conflicts + ' need review';
    snapshotSync = {
      offline: offline,
      pending: pending,
      conflicts: conflicts,
      failed: failed,
      syncing: syncing,
      needsReauth: needsReauth,
      label: label,
      lastError: lastError,
      lowStorage: lowStorage,
      encrypted: encrypted,
      lastSyncedAt: bundle && bundle.fetchedAt ? bundle.fetchedAt : '',
      role: role(),
    };
    emit();
    return snapshotSync;
  }

  function authHeaders() {
    return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' };
  }

  async function prefetch() {
    if (!token() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    var response = await fetch('/api/offline/bundle', { headers: { Authorization: 'Bearer ' + token() } });
    if (response.status === 404) {
      response = await fetch('/api/tech/offline-bundle', { headers: { Authorization: 'Bearer ' + token() } });
    }
    if (response.status === 401) { needsReauth = true; await refreshSnapshot(); return; }
    if (!response.ok) return;
    needsReauth = false;
    var data = await response.json();
    var db = await openDb();
    var tx = db.transaction(['jobs', 'meta'], 'readwrite');
    var jobs = tx.objectStore('jobs');
    (data.workOrders || []).forEach(function (job) {
      job.userId = userId();
      jobs.put(job);
    });
    tx.objectStore('meta').put({ key: 'bundle', value: {
      userId: data.userId || userId(),
      role: data.role || role(),
      laborRate: data.laborRate || 0,
      laborRates: data.laborRates || [],
      catalog: data.catalog || [],
      shops: data.shops || [],
      clock: data.clock || null,
      fetchedAt: data.fetchedAt,
      techName: data.techName || '',
    } });
    await txDone(tx);
    db.close();
    await rememberToken();
    await cacheMaps(data.workOrders || []);
    await refreshSnapshot();
  }

  async function cacheMaps(jobs) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    for (var i = 0; i < jobs.length; i += 1) {
      var job = jobs[i];
      if (!job || !job.latitude || !job.longitude) continue;
      if (job.mapPack && Array.isArray(job.mapPack.roads)) continue;
      try {
        var response = await fetch('/api/offline/map-pack?lat=' + encodeURIComponent(job.latitude) + '&lng=' + encodeURIComponent(job.longitude), {
          headers: { Authorization: 'Bearer ' + token() },
        });
        var pack = response.ok ? await response.json() : { roads: [], warning: 'Street map did not finish downloading.' };
        job.mapPack = {
          roads: pack.roads || [],
          attribution: pack.attribution || '© OpenStreetMap contributors',
          warning: pack.warning || '',
          savedAt: new Date().toISOString(),
        };
        if (job.prep && pack.warning) job.prep.warning = pack.warning;
        job.userId = userId();
        await put('jobs', job);
      } catch (e) {
        if (job.prep) job.prep.warning = 'Street map did not finish downloading. The job pin and your location still work.';
        job.downloadFailed = !job.prep || job.prep.ready !== true;
        job.userId = userId();
        try { await put('jobs', job); } catch (err) { /* keep the job already stored */ }
      }
    }
  }

  async function downloadJob(workOrderId) {
    var jobs = await all('jobs');
    var job = jobs.filter(function (row) { return row.id === workOrderId; })[0];
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (job) {
        job.downloadFailed = !(job.prep && job.prep.ready);
        if (job.downloadFailed) job.prep = Object.assign({}, job.prep, { warning: 'Download did not finish. Connect and tap Download for offline.' });
        await put('jobs', job);
      }
      await refreshSnapshot();
      return job;
    }
    await prefetch();
    jobs = await all('jobs');
    job = jobs.filter(function (row) { return row.id === workOrderId; })[0];
    if (job) {
      job.mapPack = null;
      await cacheMaps([job]);
    }
    return job;
  }

  function happenedAt(item) {
    var device = item && item.payload && item.payload.deviceAt;
    var time = device ? Date.parse(device) : NaN;
    return Number.isFinite(time) ? time : item.createdAt || 0;
  }

  async function enqueue(partial) {
    var signature = partial.kind + '|' + (partial.workOrderId || '') + '|' + JSON.stringify(partial.payload || {});
    var now = Date.now();
    if (partial.kind !== 'photo' && partial.kind !== 'gps' && lastTap && lastTap.signature === signature && now - lastTap.at < 800) {
      return lastTap.item;
    }
    var payload = Object.assign({}, partial.payload || {});
    if (!payload.deviceAt) payload.deviceAt = new Date().toISOString();
    var item = {
      idempotencyKey: partial.idempotencyKey || key(),
      clientId: partial.clientId || key(),
      kind: partial.kind,
      workOrderId: partial.workOrderId || null,
      payload: payload,
      createdAt: Date.parse(payload.deviceAt) || now,
      attempts: 0,
      nextAttemptAt: 0,
      state: 'pending',
      message: '',
      url: partial.url || '',
      userId: userId(),
    };
    await put('outbox', item);
    lastTap = { signature: signature, at: now, item: item };
    await logSync(item, 'pending', 'Saved on this device');
    await refreshSnapshot();
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) syncNow();
    else registerBackgroundSync();
    return item;
  }

  async function logSync(item, status, message) {
    try {
      await put('syncLog', {
        id: key(),
        at: new Date().toISOString(),
        kind: item.kind,
        status: status,
        message: message || '',
        idempotencyKey: item.idempotencyKey,
        userId: userId(),
      });
      var rows = (await all('syncLog')).filter(mine).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
      while (rows.length > 50) {
        await del('syncLog', rows[0].id);
        rows.shift();
      }
    } catch (e) { /* the outbox is the source of truth */ }
  }

  async function viewJobs() {
    var jobs = (await all('jobs')).filter(mine);
    var outbox = (await all('outbox')).filter(mine);
    return jobs.map(function (job) { return decorate(job, outbox); }).sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function decorate(job, outbox) {
    var copy = JSON.parse(JSON.stringify(job));
    copy.techLabor = Array.isArray(copy.techLabor) ? copy.techLabor : [];
    copy.partsUsed = Array.isArray(copy.partsUsed) ? copy.partsUsed : [];
    copy.workPhotos = Array.isArray(copy.workPhotos) ? copy.workPhotos : [];
    copy.messages = Array.isArray(copy.messages) ? copy.messages : [];
    copy.gps = [];
    var completion = copy.completion && typeof copy.completion === 'object' ? copy.completion : {};
    completion.offlineNotes = Array.isArray(completion.offlineNotes) ? completion.offlineNotes : [];
    copy.completion = completion;
    copy.pendingCount = 0;
    outbox.filter(function (item) { return item.workOrderId === job.id; }).forEach(function (item) {
      if (item.state === 'pending' || item.state === 'conflict' || item.state === 'held' || item.state === 'failed') copy.pendingCount += 1;
      var clientId = item.clientId;
      var tag = { clientId: clientId, pending: true, state: item.state, message: item.message || '' };
      if (item.kind === 'labor' && !copy.techLabor.some(function (row) { return row.clientId === clientId; })) {
        copy.techLabor.push(Object.assign(tag, item.payload));
      }
      if (item.kind === 'part' && !copy.partsUsed.some(function (row) { return row.clientId === clientId; })) {
        copy.partsUsed.push(Object.assign(tag, item.payload, { name: item.payload.name }));
      }
      if (item.kind === 'note' && !completion.offlineNotes.some(function (row) { return row.clientId === clientId; })) {
        completion.offlineNotes.push(Object.assign(tag, { body: item.payload.body }));
      }
      if ((item.kind === 'photo' || (item.kind === 'message' && item.payload && item.payload.hasPhoto)) && !copy.workPhotos.some(function (row) { return row.clientId === clientId; })) {
        copy.workPhotos.push(Object.assign(tag, { url: item.url || '', caption: item.payload.caption || '' }));
      }
      if (item.kind === 'message' && !copy.messages.some(function (row) { return row.clientId === clientId; })) {
        copy.messages.push(Object.assign(tag, { body: item.payload.body || '', senderName: 'You' }));
      }
      if (item.kind === 'gps') copy.gps.push(Object.assign(tag, item.payload));
      if (item.kind === 'status' && (item.state === 'pending' || item.state === 'failed')) copy.pendingStatus = item.payload.status;
      if (item.message) copy.syncMessage = item.message;
    });
    copy.gps.sort(function (a, b) { return String(a.deviceAt || '').localeCompare(String(b.deviceAt || '')); });
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
      var outbox = (await all('outbox')).filter(mine).filter(function (item) { return item.state !== 'conflict' && item.state !== 'held' && item.state !== 'failed'; });
      outbox.sort(function (a, b) { return happenedAt(a) - happenedAt(b); });
      for (var i = 0; i < outbox.length; i += 1) {
        var item = outbox[i];
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
      if ((item.kind === 'photo' || item.kind === 'message') && !item.url && item.payload && item.payload.hasPhoto) {
        item.url = await uploadPhoto(item);
        await put('outbox', item);
      }
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
        await logSync(item, 'reauth', lastError);
        return true;
      }
      if (!response.ok) {
        return failOrBackoff(item, 'Sync will retry.');
      }
      var data = await response.json();
      var row = (data.results || [])[0] || { status: 'rejected', message: 'Empty sync response.' };
      if (row.status === 'applied' || row.status === 'duplicate') {
        await del('outbox', item.idempotencyKey);
        if (item.kind === 'photo' || (item.payload && item.payload.hasPhoto)) await del('blobs', item.clientId);
        await logSync(item, row.status, row.message || 'Uploaded');
        return false;
      }
      if (row.status === 'conflict') {
        item.state = 'conflict';
        item.message = row.message || 'Needs review';
        await put('outbox', item);
        await logSync(item, 'conflict', item.message);
        return false;
      }
      if (row.message && row.message.indexOf('retried') !== -1) {
        return failOrBackoff(item, row.message);
      }
      item.state = 'failed';
      item.message = row.message || 'Saved on this device.';
      await put('outbox', item);
      await logSync(item, 'failed', item.message);
      return false;
    } catch (error) {
      if (needsReauth) return true;
      return failOrBackoff(item, 'Offline. Will upload when service returns.');
    }
  }

  async function failOrBackoff(item, message) {
    item.attempts = (item.attempts || 0) + 1;
    item.message = message;
    if (item.attempts >= 5) {
      item.state = 'failed';
      await put('outbox', item);
      await logSync(item, 'failed', message);
      lastError = message;
      return false;
    }
    var delay = Math.min(30000 * Math.pow(2, item.attempts - 1), 5 * 60 * 1000);
    item.nextAttemptAt = Date.now() + delay;
    item.state = 'pending';
    await put('outbox', item);
    await logSync(item, 'retry', message);
    lastError = message;
    return true;
  }

  function toOp(item) {
    var op = { idempotencyKey: item.idempotencyKey, kind: item.kind, clientId: item.clientId, workOrderId: item.workOrderId };
    var payload = item.payload || {};
    Object.keys(payload).forEach(function (name) {
      if (name === 'hasPhoto') return;
      op[name] = payload[name];
    });
    if (item.url) op.url = item.url;
    return op;
  }

  async function uploadPhoto(item) {
    var db = await openDb();
    var tx = db.transaction('blobs', 'readonly');
    var row = await reqDone(tx.objectStore('blobs').get(item.clientId));
    db.close();
    var fileBlob = row && (row.upload || row.blob);
    if (!fileBlob) throw new Error('Photo file is missing.');
    var body = new FormData();
    var file = fileBlob instanceof File ? fileBlob : new File([fileBlob], 'job-photo.jpg', { type: fileBlob.type || 'image/jpeg' });
    body.append('file', file);
    body.append('folder', item.kind === 'message' ? 'messages' : 'work-orders');
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

  async function compressPhoto(file) {
    try {
      if (!file || !window.createImageBitmap) return null;
      var bitmap = await createImageBitmap(file);
      var scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.72); });
      return blob;
    } catch (e) { return null; }
  }

  function registerBackgroundSync() {
    if (!navigator.serviceWorker || !('SyncManager' in window)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.sync.register('fixtray-tech-offline');
    }).catch(function () {});
  }

  async function clearSynced() {
    var owner = userId();
    var stores = ['jobs', 'outbox', 'blobs', 'syncLog'];
    for (var s = 0; s < stores.length; s += 1) {
      var rows = await all(stores[s]);
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var rowUser = row.userId || '';
        if (!owner || !rowUser || rowUser === owner) {
          await del(stores[s], row.id || row.idempotencyKey);
        }
      }
    }
    await clearSecureToken();
    encrypted = false;
    needsReauth = false;
    await refreshSnapshot();
  }

  async function logoutCheck() {
    var outbox = (await all('outbox')).filter(mine);
    var pending = outbox.filter(function (item) { return item.state !== 'applied'; }).length;
    if (!pending) return { pending: 0, warn: false, clearCache: true, message: '' };
    var noun = pending === 1 ? 'item has' : 'items have';
    return {
      pending: pending,
      warn: true,
      clearCache: false,
      message: 'You have ' + pending + ' ' + noun + ' not uploaded. They stay on this phone until you sign back in and sync. Signing out will not delete them.',
    };
  }

  function movedMeters(a, b) {
    var radius = 6371000;
    var dLat = (b.latitude - a.latitude) * Math.PI / 180;
    var dLon = (b.longitude - a.longitude) * Math.PI / 180;
    var lat1 = a.latitude * Math.PI / 180;
    var lat2 = b.latitude * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function sampleGps() {
    if (role() !== 'tech' && role() !== 'manager') return;
    if (!navigator.geolocation) return;
    viewJobs().then(function (jobs) {
      var active = jobs.filter(function (job) {
        var status = job.pendingStatus || job.status;
        return status === 'en-route' || status === 'in-progress' || status === 'assigned';
      })[0];
      if (!active) return;
      navigator.geolocation.getCurrentPosition(function (pos) {
        var now = Date.now();
        var next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, at: now };
        if (lastGps && (now - lastGps.at < 60000 || movedMeters(lastGps, next) < 30)) return;
        lastGps = next;
        enqueue({
          kind: 'gps',
          workOrderId: active.id,
          payload: {
            latitude: next.latitude,
            longitude: next.longitude,
            accuracy: pos.coords.accuracy,
            deviceAt: new Date(pos.timestamp || now).toISOString(),
          },
        });
      }, function () {}, { enableHighAccuracy: false, maximumAge: 20000, timeout: 8000 });
    }).catch(function () {});
  }

  function startGps() {
    if (gpsTimer || (role() !== 'tech' && role() !== 'manager')) return;
    gpsTimer = setInterval(sampleGps, 60000);
  }

  async function syncLog() {
    return (await all('syncLog')).filter(mine).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }

  async function retryFailed(idempotencyKey) {
    var rows = await all('outbox');
    var item = rows.filter(function (row) { return row.idempotencyKey === idempotencyKey; })[0];
    if (!item) return snapshotSync;
    item.state = 'pending';
    item.attempts = 0;
    item.nextAttemptAt = 0;
    await put('outbox', item);
    await logSync(item, 'retry', 'Retry requested');
    return syncNow();
  }

  var api = {
    startBridge: function () {
      if (bridgeStarted) return;
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
      window.addEventListener('fixtray-prep-download', function (event) {
        var detail = event.detail || {};
        if (detail.workOrderId) downloadJob(detail.workOrderId);
      });
      prefetch().then(syncNow);
      setInterval(function () {
        if (navigator.onLine) prefetch();
      }, 120000);
      startGps();
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
    outbox: function () { return all('outbox').then(function (rows) { return rows.filter(mine); }); },
    syncLog: syncLog,
    prefetch: prefetch,
    downloadJob: downloadJob,
    syncNow: syncNow,
    retryFailed: retryFailed,
    logoutCheck: logoutCheck,
    clearSynced: clearSynced,
    clearAll: clearSynced,
    photoBlob: async function (clientId) {
      var db = await openDb();
      var tx = db.transaction('blobs', 'readonly');
      var row = await reqDone(tx.objectStore('blobs').get(clientId));
      db.close();
      return row ? (row.blob || row.upload) : null;
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
    addMessage: async function (workOrderId, body, file) {
      var clientId = key();
      if (file) {
        var upload = await compressPhoto(file);
        await put('blobs', { id: clientId, blob: file, upload: upload || file, userId: userId() });
      }
      return enqueue({
        kind: 'message',
        workOrderId: workOrderId,
        clientId: clientId,
        payload: { body: body || '', hasPhoto: !!file, senderName: storageGet('userName') || role() },
      });
    },
    addPhoto: async function (workOrderId, file, caption) {
      var clientId = key();
      var upload = await compressPhoto(file);
      await put('blobs', { id: clientId, blob: file, upload: upload || file, userId: userId() });
      return enqueue({ kind: 'photo', workOrderId: workOrderId, clientId: clientId, payload: { caption: caption || '', hasPhoto: true } });
    },
    addGps: function (workOrderId, latitude, longitude, deviceAt) {
      return enqueue({
        kind: 'gps',
        workOrderId: workOrderId,
        payload: { latitude: Number(latitude), longitude: Number(longitude), deviceAt: deviceAt || new Date().toISOString() },
      });
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
