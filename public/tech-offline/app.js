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
    if (row.state === 'conflict' || row.state === 'held') return '<span class="pending">Needs review</span>';
    return '<span class="pending">Pending upload</span>';
  }

  function paintChrome() {
    var snap = api.snapshot();
    syncLabel.textContent = snap.label;
    banner.className = 'banner' + (snap.needsReauth ? ' bad' : snap.offline || snap.pending ? '' : ' ok');
    if (snap.needsReauth) {
      banner.textContent = 'Sign in to finish syncing. Your offline work is still on this device.';
    } else if (snap.offline) {
      banner.textContent = 'You are offline. Jobs, status, clock, photos, labor, and parts stay on this phone and upload when service returns.';
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
    if (role && role !== 'tech' && role !== 'manager') {
      root.innerHTML = '<div class="card"><h1>Technicians only</h1><p class="muted">Offline field work is for the signed-in tech.</p></div>';
      painting = false;
      return;
    }
    if (!localStorage.getItem('token')) {
      root.innerHTML = '<div class="card"><h1>Sign in once online</h1><p class="muted">After you sign in with service, your assigned jobs download to this phone.</p><p><a href="/auth/login"><button type="button">Go to login</button></a></p></div>';
      painting = false;
      return;
    }
    if (selected) return renderJob(selected);
    var jobs = await api.jobs();
    if (!jobs.length) {
      root.innerHTML = '<div class="card"><h1>No jobs saved on this phone</h1><p class="muted">Open FixTray once with service so assigned jobs can download. Then you can work them with no signal.</p></div>';
      painting = false;
      return;
    }
    root.innerHTML = jobs.map(function (job) {
      var who = job.customer ? ((job.customer.firstName || '') + ' ' + (job.customer.lastName || '')).trim() : 'Customer';
      var vehicle = job.vehicle ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ') : (job.vehicleType || '');
      return '<button class="card" data-id="' + esc(job.id) + '" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04)">'
        + '<strong>' + esc(who || 'Job') + '</strong>'
        + '<div class="muted">' + esc(vehicle) + '</div>'
        + '<div class="muted">' + esc(job.pendingStatus || job.status) + (job.pendingCount ? ' · ' + job.pendingCount + ' pending upload' : '') + '</div>'
        + '</button>';
    }).join('');
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
    root.innerHTML = ''
      + '<button type="button" class="ghost" id="back">All jobs</button>'
      + '<div class="card"><h1>' + esc(who || 'Work order') + '</h1>'
      + '<div class="muted">' + esc(vehicle) + (phone ? ' · ' + esc(phone) : '') + '</div>'
      + '<p>' + esc(job.issueDescription || '') + '</p>'
      + (job.syncMessage ? '<p class="pending">' + esc(job.syncMessage) + '</p>' : '')
      + '<label>Status</label><select id="status">'
      + ['assigned', 'in-progress', 'waiting-estimate', 'completed'].map(function (status) {
        var current = job.pendingStatus || job.status;
        return '<option value="' + status + '"' + (current === status ? ' selected' : '') + '>' + status + '</option>';
      }).join('')
      + '</select><div class="row" style="margin-top:8px"><button type="button" id="save-status">Update status</button></div></div>'
      + '<div class="card"><h2>Labor</h2><ul>' + (job.techLabor || []).map(function (line) {
        return '<li>' + esc(line.description || 'Labor') + ' · ' + esc(line.hours || 0) + 'h ' + pendingTag(line) + '</li>';
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
      + '<div class="card"><h2>Notes</h2><ul>' + notes.map(function (note) {
        return '<li>' + esc(note.body) + ' ' + pendingTag(note) + '</li>';
      }).join('') + '</ul><label>Note</label><textarea id="note"></textarea>'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-note">Add note</button></div></div>'
      + '<div class="card"><h2>Photos</h2><div id="photos"></div>'
      + '<label>Take or choose a photo</label><input id="photo" type="file" accept="image/*" capture="environment" />'
      + '<div class="row" style="margin-top:8px"><button type="button" id="add-photo">Save photo</button></div></div>'
      + '<div class="card"><h2>Clock</h2><div class="row"><button type="button" id="clock-in">Clock in</button><button type="button" class="ghost" id="clock-out">Clock out</button></div></div>'
      + '<div class="disabled-note">Payments, Stripe, and sending an estimate to the customer need a connection. They stay off while you are offline.</div>';

    document.getElementById('back').onclick = function () { selected = null; painting = false; render(); };
    painting = false;
    document.getElementById('save-status').onclick = async function () {
      await api.setStatus(job.id, job.status, document.getElementById('status').value);
      render();
    };
    document.getElementById('add-labor').onclick = async function () {
      var desc = document.getElementById('labor-desc').value.trim();
      if (!desc) return;
      await api.addLabor(job.id, desc, document.getElementById('labor-hours').value, document.getElementById('labor-rate').value);
      render();
    };
    document.getElementById('catalog').onchange = function (event) {
      var option = event.target.selectedOptions[0];
      if (!option || !option.getAttribute('data-name')) return;
      document.getElementById('part-name').value = option.getAttribute('data-name');
      document.getElementById('part-price').value = option.getAttribute('data-price') || '0';
    };
    document.getElementById('add-part').onclick = async function () {
      var name = document.getElementById('part-name').value.trim();
      if (!name) return;
      var option = document.getElementById('catalog').selectedOptions[0];
      var sku = option ? option.getAttribute('data-sku') || '' : '';
      await api.addPart(job.id, name, document.getElementById('part-qty').value, document.getElementById('part-price').value, sku);
      render();
    };
    document.getElementById('add-note').onclick = async function () {
      var body = document.getElementById('note').value.trim();
      if (!body) return;
      await api.addNote(job.id, body);
      render();
    };
    document.getElementById('add-photo').onclick = async function () {
      var input = document.getElementById('photo');
      if (!input.files || !input.files[0]) return;
      await api.addPhoto(job.id, input.files[0], '');
      render();
    };
    document.getElementById('clock-in').onclick = async function () {
      var entry = await api.clockIn(job.id, '');
      sessionStorage.setItem('fixtray-clock-client', entry.clientId);
      render();
    };
    document.getElementById('clock-out').onclick = async function () {
      await api.clockOut(sessionStorage.getItem('fixtray-clock-client') || '', '');
      render();
    };
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
