(function () {
  var root = document.getElementById('app');
  var banner = document.getElementById('banner');
  var syncLabel = document.getElementById('sync-label');
  var selected = null;
  var api = window.FixTrayOffline;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function pendingTag(row) {
    if (!row || !row.pending) return '';
    if (row.state === 'failed') return '<span class="pending">Failed' + (row.message ? ' · ' + esc(row.message) : '') + '</span>';
    if (row.state === 'conflict' || row.state === 'held') return '<span class="pending">Needs review</span>';
    return '<span class="pending">Pending upload</span>';
  }

  function drawMap(canvas, job) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);
    var roads = job.mapPack && Array.isArray(job.mapPack.roads) ? job.mapPack.roads : [];
    var points = [];
    roads.forEach(function (line) { (line || []).forEach(function (point) { points.push(point); }); });
    if (job.latitude && job.longitude) points.push({ lat: job.latitude, lng: job.longitude });
    (job.gps || []).forEach(function (point) {
      if (point.latitude && point.longitude) points.push({ lat: point.latitude, lng: point.longitude });
    });
    if (!points.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Map appears after the job location downloads.', 16, 40);
      return;
    }
    var minLat = points[0].lat;
    var maxLat = points[0].lat;
    var minLng = points[0].lng;
    var maxLng = points[0].lng;
    points.forEach(function (point) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    if (maxLat === minLat) { maxLat += 0.01; minLat -= 0.01; }
    if (maxLng === minLng) { maxLng += 0.01; minLng -= 0.01; }
    function xy(lat, lng) {
      return [
        20 + ((lng - minLng) / (maxLng - minLng)) * (width - 40),
        20 + ((maxLat - lat) / (maxLat - minLat)) * (height - 40),
      ];
    }
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    roads.forEach(function (line) {
      if (!line || line.length < 2) return;
      ctx.beginPath();
      line.forEach(function (point, index) {
        var spot = xy(point.lat, point.lng);
        if (index === 0) ctx.moveTo(spot[0], spot[1]);
        else ctx.lineTo(spot[0], spot[1]);
      });
      ctx.stroke();
    });
    if (job.latitude && job.longitude) {
      var pin = xy(job.latitude, job.longitude);
      ctx.fillStyle = '#e5332a';
      ctx.beginPath();
      ctx.arc(pin[0], pin[1], 8, 0, Math.PI * 2);
      ctx.fill();
    }
    var gps = job.gps || [];
    if (gps.length && gps[gps.length - 1].latitude) {
      var dot = xy(gps[gps.length - 1].latitude, gps[gps.length - 1].longitude);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(dot[0], dot[1], 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('© OpenStreetMap contributors', 12, height - 12);
  }

  function actorRole() {
    try { return localStorage.getItem('userRole') || ''; } catch (e) { return ''; }
  }

  function fieldRole() {
    var current = actorRole();
    return current === 'tech' || current === 'manager' || current === 'shop';
  }

  function syncedWhen(snap) {
    if (!snap || !snap.lastSyncedAt) return 'not yet';
    var time = new Date(snap.lastSyncedAt);
    return Number.isNaN(time.getTime()) ? 'not yet' : time.toLocaleString();
  }

  function prepBadge(job) {
    if (actorRole() !== 'tech' && actorRole() !== 'manager') return '';
    if (!job.prep) return '<div class="muted">Tap Download for offline before you leave.</div>';
    if (job.prep.ready === false || job.downloadFailed) {
      var why = job.prep.missing && job.prep.missing.length ? job.prep.missing.join(', ') : 'the download did not finish';
      return '<div class="pending">Not ready for offline: ' + esc(why) + '</div>';
    }
    if (job.prep.warning) return '<div class="pending">Ready for offline. ' + esc(job.prep.warning) + '</div>';
    return '<div class="oktext">Ready for offline</div>';
  }

  function paintChrome() {
    var snap = api.snapshot();
    syncLabel.textContent = snap.label;
    banner.className = 'banner' + (snap.needsReauth ? ' bad' : snap.offline || snap.pending || snap.failed ? '' : ' ok');
    if (snap.needsReauth) {
      banner.textContent = 'Sign in to finish syncing. Your offline work is still on this device.';
    } else if (snap.offline) {
      banner.textContent = 'Offline — last synced ' + syncedWhen(snap) + '. Saved work stays on this phone and uploads when service returns.';
    } else if (snap.syncing) {
      banner.textContent = 'Syncing…';
    } else if (snap.pending) {
      banner.textContent = snap.pending + ' pending upload.';
    } else if (snap.conflicts) {
      banner.textContent = 'Some items need review. Nothing was discarded.';
    } else {
      banner.textContent = 'All synced';
    }
  }

  var painting = false;
  async function render() {
    if (painting) return;
    painting = true;
    paintChrome();
    var role = '';
    try { role = localStorage.getItem('userRole') || ''; } catch (e) {}
    if (!localStorage.getItem('token')) {
      root.innerHTML = '<div class="card"><h1>Sign in once online</h1><p class="muted">After you sign in with service, your assigned jobs download to this phone.</p><p><a href="/auth/login"><button type="button">Go to login</button></a></p></div>';
      painting = false;
      return;
    }
    if (selected) return renderJob(selected);
    var jobs = await api.jobs();
    var bundle = await api.bundle();
    var snap = api.snapshot();
    var shops = bundle && bundle.shops ? bundle.shops : [];
    var intro = '<p class="muted">Offline — last synced ' + esc(syncedWhen(snap)) + '</p>';
    if (!jobs.length && !shops.length) {
      root.innerHTML = intro + '<div class="card"><h1>Nothing saved on this phone yet</h1><p class="muted">Open FixTray once with service so your data can download. Then you can open it with no signal.</p></div>';
      painting = false;
      return;
    }
    var shopHtml = shops.map(function (shop) {
      return '<div class="card"><strong>' + esc(shop.shopName || 'Shop') + '</strong><div class="muted">' + esc(shop.city || '') + ' ' + esc(shop.state || '') + ' · ' + esc(shop.status || '') + '</div></div>';
    }).join('');
    root.innerHTML = intro + shopHtml + jobs.map(function (job) {
      var who = job.customer ? ((job.customer.firstName || '') + ' ' + (job.customer.lastName || '')).trim() : 'Customer';
      var vehicle = job.vehicle ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ') : (job.vehicleType || '');
      return '<button class="card" data-id="' + esc(job.id) + '" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04)">'
        + '<strong>' + esc(who || 'Job') + '</strong>'
        + '<div class="muted">' + esc(vehicle) + '</div>'
        + '<div class="muted">' + esc(job.pendingStatus || job.status) + (job.pendingCount ? ' · ' + job.pendingCount + ' pending upload' : '') + '</div>'
        + prepBadge(job)
        + '</button>';
    }).join('') + '<div id="sync-log"></div>';
    api.syncLog().then(function (rows) {
      var host = document.getElementById('sync-log');
      if (!host) return;
      var failed = rows.filter(function (row) { return row.status === 'failed' || row.status === 'conflict'; }).slice(0, 8);
      host.innerHTML = '<div class="card"><h2>Sync log</h2>' + (rows.slice(0, 8).map(function (row) {
        return '<div class="muted">' + esc(row.status) + ' · ' + esc(row.kind) + (row.message ? ' · ' + esc(row.message) : '') + '</div>';
      }).join('') || '<div class="muted">No sync activity yet.</div>')
        + failed.map(function (row) {
          return row.idempotencyKey ? '<div class="row"><button type="button" data-retry="' + esc(row.idempotencyKey) + '">Retry</button><span class="pending">' + esc(row.message || row.status) + '</span></div>' : '';
        }).join('') + '</div>';
      host.querySelectorAll('[data-retry]').forEach(function (node) {
        node.addEventListener('click', function () {
          node.disabled = true;
          api.retryFailed(node.getAttribute('data-retry')).then(function () { painting = false; render(); });
        });
      });
    });
    root.querySelectorAll('[data-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        selected = node.getAttribute('data-id');
        painting = false;
        render();
      });
    });
    painting = false;
  }

  async function renderJob(id) {
    var jobs = await api.jobs();
    var job = jobs.filter(function (row) { return row.id === id; })[0];
    if (!job) { selected = null; painting = false; return render(); }
    var bundle = await api.bundle();
    var rate = bundle && bundle.laborRate ? bundle.laborRate : 0;
    var catalog = (bundle && bundle.catalog) || [];
    var who = job.customer ? ((job.customer.firstName || '') + ' ' + (job.customer.lastName || '')).trim() : '';
    var phone = job.customer && job.customer.phone ? job.customer.phone : '';
    var vehicle = job.vehicle ? [job.vehicle.year, job.vehicle.make, job.vehicle.model, job.vehicle.licensePlate].filter(Boolean).join(' ') : (job.vehicleType || '');
    var notes = (job.completion && job.completion.offlineNotes) || [];
    var photos = job.workPhotos || [];
    var messages = job.messages || [];
    var address = job.jobAddress || '';
    var pair = job.latitude && job.longitude ? (job.latitude + ',' + job.longitude) : '';
    var mapLinks = pair
      ? '<div class="row"><a href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(pair) + '">Open in Google Maps</a><a href="https://maps.apple.com/?daddr=' + encodeURIComponent(pair) + '">Open in Apple Maps</a></div><p class="muted">Coordinates saved on this phone. Those apps use their own offline maps.</p>'
      : '<p class="muted">No map pin saved for this job yet.</p>';
    var statusBlock = fieldRole()
      ? '<label>Status</label><select id="status">'
        + ['assigned', 'en-route', 'in-progress', 'waiting-estimate', 'completed'].map(function (status) {
          var current = job.pendingStatus || job.status;
          return '<option value="' + status + '"' + (current === status ? ' selected' : '') + '>' + status + '</option>';
        }).join('')
        + '</select><div class="row" style="margin-top:8px"><button type="button" id="save-status">Update status</button><button type="button" class="ghost" id="start-enroute">Start / En route</button></div>'
      : '';
    var laborBlock = fieldRole()
      ? '<div class="card"><h2>Labor</h2><ul>' + (job.techLabor || []).map(function (line) {
        return '<li>' + esc(line.description || 'Labor') + ' · ' + esc(line.hours || 0) + 'h ' + pendingTag(line) + (line.state === 'failed' ? ' <span class="pending">' + esc(line.message || 'Failed') + '</span>' : '') + '</li>';
      }).join('') + '</ul>'
      + '<label>Description</label><input id="labor-desc" />'
      + '<label>Hours</label><input id="labor-hours" type="number" min="0" step="0.1" value="1" />'
      + '<label>Rate</label><input id="labor-rate" type="number" min="0" step="0.01" value="' + esc(rate) + '" />'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-labor">Add labor</button></div></div>'
      + '<div class="card"><h2>Parts</h2><ul>' + (job.partsUsed || []).map(function (line) {
        return '<li>' + esc(line.name || 'Part') + ' × ' + esc(line.quantity || 1) + ' ' + pendingTag(line) + '</li>';
      }).join('') + '</ul>'
      + '<label>Catalog</label><select id="catalog"><option value="">Custom part</option>'
      + catalog.map(function (item) {
        return '<option value="' + esc(item.id) + '" data-name="' + esc(item.name) + '" data-price="' + esc(item.price || 0) + '" data-sku="' + esc(item.sku || '') + '">' + esc(item.name) + '</option>';
      }).join('')
      + '</select><label>Part</label><input id="part-name" /><label>Qty</label><input id="part-qty" type="number" min="1" value="1" />'
      + '<label>Price</label><input id="part-price" type="number" min="0" step="0.01" value="0" />'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-part">Add part</button></div></div>'
      : '';
    var clockBlock = (actorRole() === 'tech' || actorRole() === 'manager')
      ? '<div class="card"><h2>Clock</h2><div class="row"><button type="button" id="clock-in">Clock in</button><button type="button" class="ghost" id="clock-out">Clock out</button></div></div>'
      : '';
    root.innerHTML = ''
      + '<button type="button" class="ghost" id="back">All jobs</button>'
      + '<div class="card"><h1>' + esc(who || 'Work order') + '</h1>'
      + '<div class="muted">' + esc(vehicle) + (phone ? ' · ' + esc(phone) : '') + '</div>'
      + (address ? '<div class="muted">' + esc(address) + '</div>' : '')
      + prepBadge(job)
      + '<p>' + esc(job.issueDescription || '') + '</p>'
      + (job.syncMessage ? '<p class="pending">' + esc(job.syncMessage) + '</p>' : '')
      + '<div class="row"><button type="button" class="ghost" id="download-offline">Download for offline</button></div>'
      + '<canvas class="map" id="job-map" width="640" height="360"></canvas>'
      + mapLinks
      + ((job.gps && job.gps.length) ? '<p class="muted">' + job.gps.length + ' location points saved on this phone</p>' : '')
      + statusBlock
      + '</div>'
      + laborBlock
      + '<div class="card"><h2>Notes</h2><ul>' + notes.map(function (note) {
        return '<li>' + esc(note.body) + ' ' + pendingTag(note) + '</li>';
      }).join('') + '</ul><label>Note</label><textarea id="note"></textarea>'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-note">Add note</button></div></div>'
      + '<div class="card"><h2>Messages</h2><ul>' + messages.map(function (message) {
        return '<li>' + esc(message.body || 'Photo') + ' ' + pendingTag(message) + '</li>';
      }).join('') + '</ul><label>Message</label><textarea id="message"></textarea>'
      + '<label>Photo</label><input id="message-photo" type="file" accept="image/*" />'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-message">Send message</button></div></div>'
      + '<div class="card"><h2>Photos</h2><div id="photos"></div>'
      + '<label>Take or choose a photo</label><input id="photo" type="file" accept="image/*" capture="environment" />'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-photo">Save photo</button></div></div>'
      + clockBlock
      + '<div class="disabled-note">Payments, Stripe, shop approvals, user management, sending or signing estimates, and pay or fee changes need a connection.</div>';

    function arm(id, fn) {
      var node = document.getElementById(id);
      if (!node) return;
      node.onclick = async function () {
        if (node.disabled) return;
        node.disabled = true;
        try { await fn(); } finally { painting = false; render(); }
      };
    }

    document.getElementById('back').onclick = function () { selected = null; painting = false; render(); };
    painting = false;
    drawMap(document.getElementById('job-map'), job);
    arm('download-offline', function () { return api.downloadJob(job.id); });
    arm('save-status', function () {
      return api.setStatus(job.id, job.status, document.getElementById('status').value);
    });
    arm('start-enroute', function () {
      return api.setStatus(job.id, job.status, 'en-route').then(function () { return api.downloadJob(job.id); });
    });
    arm('add-labor', function () {
      var desc = document.getElementById('labor-desc').value.trim();
      if (!desc) return null;
      return api.addLabor(job.id, desc, document.getElementById('labor-hours').value, document.getElementById('labor-rate').value);
    });
    var catalogNode = document.getElementById('catalog');
    if (catalogNode) catalogNode.onchange = function (event) {
      var option = event.target.selectedOptions[0];
      if (!option || !option.getAttribute('data-name')) return;
      document.getElementById('part-name').value = option.getAttribute('data-name');
      document.getElementById('part-price').value = option.getAttribute('data-price') || '0';
    };
    arm('add-part', function () {
      var name = document.getElementById('part-name').value.trim();
      if (!name) return null;
      var option = document.getElementById('catalog').selectedOptions[0];
      var sku = option ? option.getAttribute('data-sku') || '' : '';
      return api.addPart(job.id, name, document.getElementById('part-qty').value, document.getElementById('part-price').value, sku);
    });
    arm('add-note', function () {
      var body = document.getElementById('note').value.trim();
      if (!body) return null;
      return api.addNote(job.id, body);
    });
    arm('add-message', function () {
      var body = document.getElementById('message').value.trim();
      var input = document.getElementById('message-photo');
      var file = input && input.files ? input.files[0] : null;
      if (!body && !file) return null;
      return api.addMessage(job.id, body, file || null);
    });
    arm('add-photo', function () {
      var input = document.getElementById('photo');
      if (!input.files || !input.files[0]) return null;
      return api.addPhoto(job.id, input.files[0], '');
    });
    arm('clock-in', function () {
      return api.clockIn(job.id, '').then(function (entry) {
        sessionStorage.setItem('fixtray-clock-client', entry.clientId);
      });
    });
    arm('clock-out', function () {
      return api.clockOut(sessionStorage.getItem('fixtray-clock-client') || '', '');
    });
    var photoHost = document.getElementById('photos');
    for (var i = 0; i < photos.length; i += 1) {
      var shot = photos[i];
      var figure = document.createElement('div');
      figure.innerHTML = pendingTag(shot);
      if (shot.url) {
        var img = document.createElement('img');
        img.className = 'shot';
        img.alt = '';
        img.src = shot.url;
        figure.appendChild(img);
      } else if (shot.clientId) {
        api.photoBlob(shot.clientId).then(function (blob) {
          if (!blob) return;
          var local = document.createElement('img');
          local.className = 'shot';
          local.alt = '';
          local.src = URL.createObjectURL(blob);
          figure.appendChild(local);
        });
      }
      photoHost.appendChild(figure);
    }
  }

  document.getElementById('sync-now').onclick = function () { api.syncNow().then(function () { painting = false; render(); }); };
  api.onChange(function () { painting = false; render(); });
  api.startApp();
  render();
})();
