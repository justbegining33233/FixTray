const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'app');

function getFilesRecursively(dir, filter) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath, filter));
        } else if (file.endsWith(filter)) {
            results.push(filePath);
        }
    });
    return results;
}

function describeButton(text) {
    const t = text.toLowerCase();
    if (t.includes('save') || t.includes('update')) return 'Saves current form state to the database. Verify 200 response and UI reflects change.';
    if (t.includes('delete') || t.includes('remove')) return 'Deletes the selected record. Should show a confirmation prompt before executing.';
    if (t.includes('create') || t.includes('add') || t.includes('new')) return 'Creates a new record. Opens a form or modal. Verify required fields and success feedback.';
    if (t.includes('cancel') || t.includes('close')) return 'Dismisses the current modal or action without saving. No data should change.';
    if (t.includes('view') || t.includes('detail')) return 'Opens a detailed view/modal for the selected record. Verify data loads correctly.';
    if (t.includes('contact')) return 'Opens a contact modal or initiates a message thread for the selected entity.';
    if (t.includes('sort') || t.includes('filter')) return 'Sorts or filters the visible list. Verify the list re-orders and empty states display.';
    if (t.includes('export')) return 'Exports data to CSV or PDF. Verify the download triggers with correct file content.';
    if (t.includes('approve') || t.includes('accept')) return 'Approves the pending item. Should update its status and trigger any configured notifications.';
    if (t.includes('reject') || t.includes('deny') || t.includes('decline')) return 'Rejects the pending item. Should update status and log the action with a reason.';
    if (t.includes('logout') || t.includes('sign out')) return 'Clears session cookie and redirects user to the login page.';
    if (t.includes('login') || t.includes('sign in')) return 'Submits login credentials. Redirects on success, shows error message on failure.';
    if (t.includes('back')) return 'Navigates to the previous screen or parent page.';
    if (t.includes('submit')) return 'Submits the current form. Verify client validation fires, API returns correctly, and feedback is shown.';
    if (t.includes('edit')) return 'Puts the selected record into edit mode. All editable fields should become interactive.';
    if (t.includes('send')) return 'Sends a message or notification. Verify the recipient receives it and the thread updates.';
    if (t.includes('confirm')) return 'Confirms a pending action (irreversible). Verify a guard prompt is shown first.';
    if (t.includes('refresh') || t.includes('reload')) return 'Re-fetches data from the API and refreshes the displayed list/cards.';
    if (t.includes('upload')) return 'Opens file picker. Verify file type/size validation and successful upload response.';
    if (t.includes('download')) return 'Triggers a file download. Verify the correct file is served with proper name and MIME type.';
    if (t.includes('pay') || t.includes('checkout')) return 'Initiates payment flow. Verify gateway handles correctly and invoice is created on success.';
    if (t.includes('assign')) return 'Assigns the record to the selected user/technician. Verify persistence and notification.';
    if (t.includes('invite')) return 'Sends an invite email to a new team member or customer. Verify email is dispatched.';
    if (t.includes('disable') || t.includes('deactivate')) return 'Disables/deactivates the account or feature. Verify entity loses access immediately.';
    if (t.includes('enable') || t.includes('activate')) return 'Enables/activates the account or feature. Verify access is restored.';
    if (t.includes('search')) return 'Submits search query. Verify results filter correctly and empty state is handled.';
    if (t.includes('reset')) return 'Resets form/password. Verify data clears or reset email is dispatched.';
    if (t.includes('print')) return 'Opens print dialog. Verify layout is print-friendly without nav/sidebar.';
    if (t.includes('copy')) return 'Copies data to clipboard. Verify clipboard API fires and visual feedback is shown.';
    return 'Interactive button — verify it triggers the expected UI change or API call.';
}

function extractSubItems(filePath) {
    let src;
    try { src = fs.readFileSync(filePath, 'utf8'); } catch(e) { return []; }

    const items = [];
    const seen = new Set();

    function add(type, label, desc) {
        const key = type + '|' + label;
        if (seen.has(key) || !label || label.length < 2) return;
        seen.add(key);
        items.push({ type, label, desc });
    }

    // JSX section comments {/* Section Header */}
    const commentRe = /\{\/\*\s*([A-Z][^*]{2,50})\*\/\}/g;
    let m;
    while ((m = commentRe.exec(src)) !== null) {
        const name = m[1].trim();
        if (name.length > 2 && name.length < 60) {
            add('Section/Card', name, `UI Section: "${name}" — verify it renders with live data and responds to state changes.`);
        }
    }

    // <Link href="...">text</Link>
    const linkRe = /<Link\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Link>/g;
    while ((m = linkRe.exec(src)) !== null) {
        const href = m[1];
        const inner = m[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
        const label = (inner && inner.length > 1 && inner.length < 60) ? inner : href;
        if (label && label.length > 1) add('Link', label, `Navigates to: ${href} — verify the link is active and reaches the correct page.`);
    }

    // <button>text</button>
    const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/g;
    while ((m = btnRe.exec(src)) !== null) {
        const inner = m[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
        if (inner && inner.length > 1 && inner.length < 80) add('Button', inner, describeButton(inner));
    }

    // useState show* modals
    const modalRe = /const\s*\[(\s*show\w+)\s*,/g;
    while ((m = modalRe.exec(src)) !== null) {
        const name = m[1].trim().replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim();
        if (name.length > 1) add('Modal', name + ' Modal', `Modal/dialog for: ${name}. Verify it opens on trigger, shows correct data, and closes cleanly without data leak.`);
    }

    // Forms
    const formMatches = [...src.matchAll(/<form[\s>]/g)];
    formMatches.forEach((fm, i) => {
        add('Form', `Form #${i + 1}`, `Input form — verify all required fields validate client-side, submit fires correct API call, and success/error feedback is displayed.`);
    });

    // onClick handlers (handle*, toggle*, open*, close*)
    const onClickRe = /onClick=\{(handle\w+|toggle\w+|open\w+|close\w+)\}/g;
    while ((m = onClickRe.exec(src)) !== null) {
        const fn = m[1];
        const readable = fn.replace(/^handle|^toggle|^open|^close/, '').replace(/([A-Z])/g, ' $1').trim();
        if (readable.length > 1 && readable.length < 60) {
            add('Action', readable, `onClick action: ${fn} — verify it produces the expected state change, API call, or navigation.`);
        }
    }

    const order = ['Section/Card', 'Link', 'Button', 'Modal', 'Action', 'Form'];
    items.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return items;
}

function getExpected(relPath, type) {
    if (type === 'Endpoint') {
        if (relPath.includes('login') || relPath.includes('auth')) return 'Handle secure authentication, credential validation, session token issuance/management.';
        if (relPath.includes('workorders')) return 'Create, read, update, or delete work order records. Verify role-scoping so users only see their own data.';
        if (relPath.includes('customers')) return 'Perform database operations for customer profiles, vehicles, history, or communications.';
        if (relPath.includes('analytics') || relPath.includes('revenue')) return 'Aggregate and calculate financial, performance, or SLA analytics data. Returns JSON dataset.';
        if (relPath.includes('cron')) return 'Execute background automation, scheduled reminders, or maintenance jobs. Should respond 200 with job status.';
        if (relPath.includes('admin') || relPath.includes('settings')) return 'Handle configuration updates, access controls, or platform-level data mutations with strict role guards.';
        if (relPath.includes('appointments')) return 'Manage appointment creation, updates, cancellations, and availability lookups.';
        if (relPath.includes('inventory')) return 'CRUD operations for parts/inventory. Verify stock levels update correctly.';
        if (relPath.includes('notifications')) return 'Create, retrieve, or dismiss notifications for the relevant user role.';
        return 'Validate input payload, execute database query, and return standardized JSON with correct HTTP status code.';
    } else {
        if (relPath.includes('login')) return 'Display login form with email/password fields. On success, redirect to role dashboard. On fail, show inline error.';
        if (relPath.includes('register')) return 'Display registration form. Validate inputs, post to API, redirect to pending/thank-you page on success.';
        if (relPath.includes('home') || relPath.includes('dashboard')) return 'Display role-specific metric cards, quick-action nav links, and real-time data summaries.';
        if (relPath.includes('workorders')) return 'List/detail work orders for this role. Status changes should update in real-time without full page reload.';
        if (relPath.includes('settings')) return 'Display configuration forms. Saving should call the API, persist changes, and show confirmation toast.';
        if (relPath.includes('profile')) return 'Display user profile details. Editable fields should save on submit with success feedback.';
        if (relPath.includes('inventory') || relPath.includes('parts')) return 'Display parts/inventory list. Stock adjustments should persist. Low-stock items should be highlighted.';
        if (relPath.includes('payment') || relPath.includes('revenue') || relPath.includes('invoice')) return 'Render payment interfaces or financial reports securely. Stripe/gateway integration should complete without errors.';
        if (relPath.includes('messages') || relPath.includes('chat')) return 'Render chat threads and compose area. Incoming messages should appear via socket without refresh.';
        if (relPath.includes('analytics')) return 'Display charts and KPI metrics. All date/filter controls should update charts correctly. Empty state if no data.';
        if (relPath.includes('schedule') || relPath.includes('calendar')) return 'Display appointment calendar. Navigate between days/weeks, create appointments, detect conflicts.';
        if (relPath.includes('team') || relPath.includes('manage')) return 'Display team members list. Invite, role-change, and deactivation actions should all work and persist.';
        if (relPath.includes('customers')) return 'Display customer directory. Clicking a customer opens their profile/history. Search should filter correctly.';
        if (relPath.includes('timeclock') || relPath.includes('timesheet')) return 'Show clock-in/out controls and time logs. Clock actions should timestamp correctly and update totals.';
        if (relPath.includes('dvi')) return 'Display Digital Vehicle Inspection form. Condition items (G/Y/R) should save per item and submit as a full report.';
        if (relPath.includes('estimates')) return 'Show estimates list or detail. Approve/Decline buttons should trigger correct status updates and notifications.';
        if (relPath.includes('notifications')) return 'Display unread and historical notifications. Mark-as-read should update the badge count.';
        return `Page: ${relPath.replace('/page.tsx','')} — verify responsive layout, all data loads from API, interactive elements function, and navigation links work.`;
    }
}

const pages = getFilesRecursively(srcDir, 'page.tsx');
const apis  = getFilesRecursively(srcDir, 'route.ts');

function getRole(parts, isApi) {
    const roles = ['admin','auth','customer','shop','tech','manager','superadmin'];
    if (isApi) {
        const apiRoles = ['admin','auth','customers','shop','tech','manager','superadmin'];
        if (parts[1] && apiRoles.includes(parts[1])) return 'API: ' + parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        return 'API: Global/Misc';
    }
    if (roles.includes(parts[0])) return 'Role: ' + parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return 'Public / Global';
}

const allItems = [
    ...pages.map(fp => {
        const rel = fp.replace(srcDir,'').replace(/\\/g,'/');
        const parts = rel.split('/').filter(Boolean);
        return {
            id: Buffer.from(rel).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,14),
            type: 'Page',
            title: rel.replace('/page.tsx','') || '/ (Home)',
            expected: getExpected(rel,'Page'),
            subItems: extractSubItems(fp),
            role: getRole(parts, false)
        };
    }),
    ...apis.map(fp => {
        const rel = fp.replace(srcDir,'').replace(/\\/g,'/');
        const parts = rel.split('/').filter(Boolean);
        return {
            id: Buffer.from(rel).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,14),
            type: 'Endpoint',
            title: rel.replace('/route.ts',''),
            expected: getExpected(rel,'Endpoint'),
            subItems: [],
            role: getRole(parts, true)
        };
    })
];

const grouped = {};
allItems.forEach(i => { if(!grouped[i.role]) grouped[i.role]=[]; grouped[i.role].push(i); });
const data = Object.keys(grouped).sort().map(r => ({ role: r, items: grouped[r] }));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FixTray Go/No-Go — Full Inspection</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a}
  .go{border-left-color:#10b981!important;background:#ecfdf5}
  .no-go{border-left-color:#ef4444!important;background:#fef2f2}
  @media print{.noprint{display:none}body{background:white}}
</style>
</head>
<body class="p-3 md:p-6 text-gray-800">
<div class="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden mb-10">
  <div class="bg-indigo-700 p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
    <div>
      <h1 class="text-2xl font-bold">FixTray Go/No-Go Full Inspection</h1>
      <p class="opacity-70 text-sm mt-0.5">${pages.length} Pages · ${apis.length} API Endpoints · All buttons, modals, cards, links extracted from source code</p>
    </div>
    <div class="flex flex-wrap gap-2 noprint">
      <button onclick="expandAll()" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-semibold">Expand All</button>
      <button onclick="collapseAll()" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-semibold">Collapse All</button>
      <button onclick="clearData()" class="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-semibold">Clear Progress</button>
      <button onclick="window.print()" class="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-sm font-semibold">Print/PDF</button>
    </div>
  </div>
  <div id="root" class="p-4 space-y-4"></div>
</div>
<script>
const DATA=${JSON.stringify(data)};
const gs=k=>{try{return localStorage.getItem(k)}catch{return null}};
const ss=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
function toggle(id,iconId){
  const el=document.getElementById(id);const ic=document.getElementById(iconId);
  if(!el)return;
  const h=el.classList.toggle('hidden');
  if(ic)ic.style.transform=h?'rotate(-90deg)':'rotate(0deg)';
}
function expandAll(){document.querySelectorAll('[data-c]').forEach(e=>e.classList.remove('hidden'));document.querySelectorAll('[data-ic]').forEach(e=>e.style.transform='rotate(0deg)');}
function collapseAll(){document.querySelectorAll('[data-c]').forEach(e=>e.classList.add('hidden'));document.querySelectorAll('[data-ic]').forEach(e=>e.style.transform='rotate(-90deg)');}
function clearData(){if(confirm('Clear all progress?')){localStorage.clear();render();}}
function setStatus(id,status,e){e&&e.stopPropagation();ss('s-'+id,gs('s-'+id)===status?'':status);render();}
function saveNote(id,val){ss('n-'+id,val);}
function btnCls(saved,t){return saved===t?(t==='go'?'bg-green-500 text-white border-green-600':'bg-red-500 text-white border-red-600'):'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-600';}
function badgeCls(t){const m={'Button':'bg-yellow-100 text-yellow-800','Link':'bg-blue-100 text-blue-700','Modal':'bg-purple-100 text-purple-800','Form':'bg-orange-100 text-orange-800','Section/Card':'bg-teal-100 text-teal-800','Action':'bg-pink-100 text-pink-800'};return m[t]||'bg-gray-100 text-gray-700';}
function progressBar(items){
  const go=items.filter(i=>gs('s-'+i.id)==='go').length;
  const ng=items.filter(i=>gs('s-'+i.id)==='no-go').length;
  const pend=items.length-go-ng;
  const pct=items.length?Math.round(go/items.length*100):0;
  return \`<div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span class="text-green-600 bg-green-100 px-1.5 py-0.5 rounded">\${go} Go</span>
    <span class="text-red-500 bg-red-100 px-1.5 py-0.5 rounded">\${ng} No-Go</span>
    <span class="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">\${pend} Pending</span>
    <div class="w-20 h-1.5 bg-gray-200 rounded overflow-hidden">
      <div class="h-full bg-green-500 rounded" style="width:\${pct}%"></div>
    </div>
  </div>\`;
}
function render(){
  const root=document.getElementById('root');
  let out='';
  DATA.forEach((section,si)=>{
    const rcId='rc'+si,riId='ri'+si;
    out+=\`<div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div class="bg-gray-800 text-white p-4 cursor-pointer hover:bg-gray-700 select-none flex justify-between items-center" onclick="toggle('\${rcId}','\${riId}')">
        <div class="flex flex-col gap-1.5">
          <span class="font-bold">\${section.role} <span class="text-gray-400 text-sm font-normal">(\${section.items.length} items)</span></span>
          \${progressBar(section.items)}
        </div>
        <svg id="\${riId}" data-ic style="transform:rotate(-90deg);transition:.2s" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </div>
      <div id="\${rcId}" data-c class="hidden divide-y divide-gray-100">\`;

    section.items.forEach((item,ii)=>{
      const saved=gs('s-'+item.id);
      const note=gs('n-'+item.id)||'';
      const icId='ic'+si+'_'+ii,iiId='ii'+si+'_'+ii;
      const border=saved==='go'?'border-green-400':saved==='no-go'?'border-red-400':'border-transparent';
      const bg=saved==='go'?'bg-green-50':saved==='no-go'?'bg-red-50':'';
      out+=\`<div class="border-l-4 \${border} \${bg} transition-all">
        <div class="p-4 flex flex-col md:flex-row gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1 \${item.subItems&&item.subItems.length>0?'cursor-pointer':''}" \${item.subItems&&item.subItems.length>0?'onclick="toggle(\''+icId+'\',\''+iiId+'\')"':''}>
              <span class="text-xs px-2 py-0.5 rounded font-bold uppercase \${item.type==='Endpoint'?'bg-blue-100 text-blue-800':'bg-purple-100 text-purple-800'}">\${item.type}</span>
              <span class="font-semibold text-gray-800 text-sm break-all">\${item.title}</span>
              \${item.subItems&&item.subItems.length>0?\`<span class="text-xs text-gray-400">(\${item.subItems.length} checks ▾)</span>
              <svg id="\${iiId}" data-ic style="transform:rotate(-90deg);transition:.2s;flex-shrink:0" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>\`:''}
            </div>
            <p class="text-xs text-gray-500 mb-2"><strong class="text-gray-600">Expected:</strong> \${item.expected}</p>
            <textarea rows="2" class="w-full text-xs border border-gray-200 rounded p-2 text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="Actual result / debug notes..." onchange="saveNote('\${item.id}',this.value)">\${note}</textarea>
          </div>
          <div class="flex md:flex-col gap-2 justify-end shrink-0">
            <button onclick="setStatus('\${item.id}','go',event)" class="border rounded px-3 py-1.5 text-xs font-bold \${btnCls(saved,'go')}">✅ GO</button>
            <button onclick="setStatus('\${item.id}','no-go',event)" class="border rounded px-3 py-1.5 text-xs font-bold \${btnCls(saved,'no-go')}">❌ NO-GO</button>
          </div>
        </div>\`;

      if(item.subItems&&item.subItems.length>0){
        out+=\`<div id="\${icId}" data-c class="hidden bg-gray-50 border-t border-gray-100 divide-y divide-gray-100">\`;
        item.subItems.forEach((sub,subi)=>{
          const subId=item.id+'-s'+subi;
          const subSaved=gs('s-'+subId);
          const subNote=gs('n-'+subId)||'';
          const sBg=subSaved==='go'?'bg-green-50':subSaved==='no-go'?'bg-red-50':'';
          out+=\`<div class="pl-8 pr-4 py-3 flex flex-col md:flex-row gap-3 \${sBg} transition-all">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-0.5">
                <span class="text-xs px-1.5 py-0.5 rounded font-semibold uppercase \${badgeCls(sub.type)}">\${sub.type}</span>
                <span class="text-sm font-medium text-gray-700">\${sub.label}</span>
              </div>
              <p class="text-xs text-gray-500 mb-1">\${sub.desc}</p>
              <textarea rows="1" class="w-full text-xs border border-gray-200 rounded p-1.5 text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="Actual result..." onchange="saveNote('\${subId}',this.value)">\${subNote}</textarea>
            </div>
            <div class="flex md:flex-col gap-1.5 justify-end shrink-0">
              <button onclick="setStatus('\${subId}','go',event)" class="border rounded px-2 py-1 text-xs font-bold \${btnCls(subSaved,'go')}">✅ GO</button>
              <button onclick="setStatus('\${subId}','no-go',event)" class="border rounded px-2 py-1 text-xs font-bold \${btnCls(subSaved,'no-go')}">❌ NO-GO</button>
            </div>
          </div>\`;
        });
        out+=\`</div>\`;
      }
      out+=\`</div>\`; // end item wrapper
    });
    out+=\`</div></div>\`; // end roleContent + section
  });
  root.innerHTML=out;
}
render();
<\/script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'fixtray-qa-ultimate-inspection.html'), html);
console.log(`Done. ${pages.length} pages + ${apis.length} endpoints.`);
