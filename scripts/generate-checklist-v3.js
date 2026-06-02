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

// Sanitize any text for safe use inside HTML attributes and innerHTML
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

// Sanitize for use inside single-quoted HTML attributes (onclick values)
function escAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/`/g, '').replace(/"/g, '\\"');
}

function describeButton(text) {
    const t = text.toLowerCase();
    if (t.includes('save') || t.includes('update')) return 'Saves current form state to the database. Verify 200 response and UI reflects change.';
    if (t.includes('delete') || t.includes('remove')) return 'Deletes the selected record. Should show a confirmation prompt before executing.';
    if (t.includes('create') || t.includes('add') || t.includes('new')) return 'Creates a new record. Opens a form or modal. Verify required fields and success feedback.';
    if (t.includes('cancel') || t.includes('close')) return 'Dismisses the current modal or action without saving.';
    if (t.includes('view') || t.includes('detail')) return 'Opens a detailed view/modal for the selected record.';
    if (t.includes('contact')) return 'Opens a contact modal or initiates a message thread.';
    if (t.includes('sort') || t.includes('filter')) return 'Sorts or filters the visible list. Verify results update.';
    if (t.includes('export')) return 'Exports data to CSV or PDF. Verify the download triggers correctly.';
    if (t.includes('approve') || t.includes('accept')) return 'Approves the pending item, updates status, and triggers notifications.';
    if (t.includes('reject') || t.includes('deny') || t.includes('decline')) return 'Rejects the pending item. Should update status and log the action.';
    if (t.includes('logout') || t.includes('sign out')) return 'Clears session cookie and redirects to the login page.';
    if (t.includes('login') || t.includes('sign in')) return 'Submits login credentials. Redirects on success, shows error on failure.';
    if (t.includes('back')) return 'Navigates to the previous screen or parent page.';
    if (t.includes('submit')) return 'Submits the current form. Verify validation fires and API responds correctly.';
    if (t.includes('edit')) return 'Puts the selected record into edit mode. All fields should become editable.';
    if (t.includes('send')) return 'Sends a message or notification. Verify recipient receives it.';
    if (t.includes('confirm')) return 'Confirms an irreversible action. Verify a guard prompt is shown first.';
    if (t.includes('refresh') || t.includes('reload')) return 'Re-fetches data from the API and refreshes the display.';
    if (t.includes('upload')) return 'Opens file picker. Verify type/size validation and successful upload.';
    if (t.includes('download')) return 'Triggers a file download. Verify correct file is served.';
    if (t.includes('pay') || t.includes('checkout')) return 'Initiates payment flow. Verify gateway handles correctly.';
    if (t.includes('assign')) return 'Assigns the record to selected user/tech. Verify persistence.';
    if (t.includes('invite')) return 'Sends an invite email to new team member or customer.';
    if (t.includes('disable') || t.includes('deactivate')) return 'Disables the account or feature. Verify access is revoked immediately.';
    if (t.includes('enable') || t.includes('activate')) return 'Enables the account or feature. Verify access is restored.';
    if (t.includes('search')) return 'Submits search query. Verify results filter correctly.';
    if (t.includes('reset')) return 'Resets form or password. Verify data clears or email is sent.';
    if (t.includes('print')) return 'Opens print dialog. Verify layout is print-friendly.';
    if (t.includes('copy')) return 'Copies data to clipboard. Verify clipboard API fires and feedback is shown.';
    return 'Interactive button — verify it triggers the expected UI change or API call.';
}

function extractSubItems(filePath) {
    let src;
    try { src = fs.readFileSync(filePath, 'utf8'); } catch(e) { return []; }

    const items = [];
    const seen = new Set();

    function add(type, label, desc) {
        // Strip all special chars that could break HTML
        const cleanLabel = String(label).replace(/`/g, '').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
        const cleanDesc = String(desc).replace(/`/g, '').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
        const key = type + '|' + cleanLabel;
        if (seen.has(key) || !cleanLabel || cleanLabel.length < 2 || cleanLabel.length > 100) return;
        seen.add(key);
        items.push({ type, label: cleanLabel, desc: cleanDesc });
    }

    // JSX section comments {/* Section Header */}
    const commentRe = /\{\/\*\s*([A-Z][^*]{2,50})\*\/\}/g;
    let m;
    while ((m = commentRe.exec(src)) !== null) {
        const name = m[1].trim();
        if (name.length > 2 && name.length < 60) {
            add('Section/Card', name, 'UI Section: "' + name + '" - verify it renders with live data and responds to state changes.');
        }
    }

    // <Link href="...">text</Link>
    const linkRe = /<Link\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Link>/g;
    while ((m = linkRe.exec(src)) !== null) {
        const href = m[1];
        const inner = m[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
        const label = (inner && inner.length > 1 && inner.length < 60) ? inner : href;
        if (label && label.length > 1) add('Link', label, 'Navigates to: ' + href + ' - verify the link is active and reaches the correct page.');
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
        if (name.length > 1) add('Modal', name + ' Modal', 'Modal/dialog for: ' + name + '. Verify it opens on trigger, shows correct data, and closes cleanly.');
    }

    // Forms
    const formMatches = [...src.matchAll(/<form[\s>]/g)];
    formMatches.forEach((fm, i) => {
        add('Form', 'Form #' + (i + 1), 'Input form - verify all required fields validate client-side, submit fires correct API call, and shows success/error feedback.');
    });

    // onClick handlers
    const onClickRe = /onClick=\{(handle\w+|toggle\w+|open\w+|close\w+)\}/g;
    while ((m = onClickRe.exec(src)) !== null) {
        const fn = m[1];
        const readable = fn.replace(/^handle|^toggle|^open|^close/, '').replace(/([A-Z])/g, ' $1').trim();
        if (readable.length > 1 && readable.length < 60) {
            add('Action', readable, 'onClick action: ' + fn + ' - verify it produces the expected state change or navigation.');
        }
    }

    const order = ['Section/Card', 'Link', 'Button', 'Modal', 'Action', 'Form'];
    items.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return items;
}

function getExpected(relPath, type) {
    if (type === 'Endpoint') {
        if (relPath.includes('login') || relPath.includes('auth')) return 'Handle secure authentication, credential validation, and session token issuance/management.';
        if (relPath.includes('workorders')) return 'Create, read, update, or delete work order records. Verify role-scoping so users only see their own data.';
        if (relPath.includes('customers')) return 'Perform database operations for customer profiles, vehicles, history, or communications.';
        if (relPath.includes('analytics') || relPath.includes('revenue')) return 'Aggregate and calculate financial, performance, or SLA analytics data. Returns JSON dataset.';
        if (relPath.includes('cron')) return 'Execute background automation, scheduled reminders, or maintenance. Should respond 200 with job status.';
        if (relPath.includes('admin') || relPath.includes('settings')) return 'Handle configuration updates, access controls, or platform-level data mutations with strict role guards.';
        if (relPath.includes('appointments')) return 'Manage appointment creation, updates, cancellations, and availability lookups.';
        if (relPath.includes('inventory')) return 'CRUD operations for parts/inventory. Verify stock levels update correctly.';
        return 'Validate input payload, execute database query, and return standardized JSON with correct HTTP status.';
    } else {
        if (relPath.includes('login')) return 'Display login form. On success redirect to role dashboard. On fail show inline error message.';
        if (relPath.includes('register')) return 'Display registration form. Validate inputs, post to API, redirect to pending/thank-you on success.';
        if (relPath.includes('home') || relPath.includes('dashboard')) return 'Display role-specific metric cards, quick-action nav links, and real-time data summaries.';
        if (relPath.includes('workorders')) return 'List/detail work orders for this role. Status changes should update without full page reload.';
        if (relPath.includes('settings')) return 'Display configuration forms. Saving should call API, persist changes, and show confirmation toast.';
        if (relPath.includes('profile')) return 'Display user profile fields. Editable fields should save on submit with success feedback.';
        if (relPath.includes('inventory') || relPath.includes('parts')) return 'Display parts/inventory list. Stock adjustments persist. Low-stock items highlighted.';
        if (relPath.includes('payment') || relPath.includes('revenue') || relPath.includes('invoice')) return 'Render payment interfaces or financial reports. Gateway integration should complete without errors.';
        if (relPath.includes('messages') || relPath.includes('chat')) return 'Render chat threads and compose area. New messages appear via socket without refresh.';
        if (relPath.includes('analytics')) return 'Display charts and KPI metrics. All date/filter controls update charts. Empty state if no data.';
        if (relPath.includes('schedule') || relPath.includes('calendar')) return 'Display appointment calendar. Navigate dates, create appointments, detect conflicts.';
        if (relPath.includes('team') || relPath.includes('manage')) return 'Display team members. Invite, role-change, and deactivation actions persist.';
        if (relPath.includes('customers')) return 'Display customer directory. Clicking a customer opens their profile. Search filters correctly.';
        if (relPath.includes('timeclock') || relPath.includes('timesheet')) return 'Show clock-in/out controls and time logs. Clock actions timestamp correctly and update totals.';
        if (relPath.includes('dvi')) return 'Display Digital Vehicle Inspection form. Condition items (G/Y/R) save per item and submit as full report.';
        if (relPath.includes('estimates')) return 'Show estimates list or detail. Approve/Decline buttons trigger correct status updates and notifications.';
        if (relPath.includes('notifications')) return 'Display unread and historical notifications. Mark-as-read should update the badge count.';
        return 'Page: ' + relPath.replace('/page.tsx','') + ' - verify responsive layout, data loads from API, interactive elements function, and navigation links work.';
    }
}

function getRole(parts, isApi) {
    const roles = ['admin','auth','customer','shop','tech','manager','superadmin'];
    if (isApi) {
        const apiRoles = ['admin','auth','customers','shop','tech','manager','superadmin'];
        if (parts[1] && apiRoles.includes(parts[1])) {
            const r = parts[1] === 'superadmin' ? 'admin' : parts[1];
            return 'API: ' + r.charAt(0).toUpperCase() + r.slice(1);
        }
        return 'API: Global/Misc';
    }
    if (roles.includes(parts[0])) {
        const r = parts[0] === 'superadmin' ? 'admin' : parts[0];
        return 'Role: ' + r.charAt(0).toUpperCase() + r.slice(1);
    }
    return 'Public / Global';
}

function badgeCls(type) {
    const m = {
        'Button': 'badge-yellow',
        'Link': 'badge-blue',
        'Modal': 'badge-purple',
        'Form': 'badge-orange',
        'Section/Card': 'badge-teal',
        'Action': 'badge-pink',
        'Endpoint': 'badge-blue',
        'Page': 'badge-purple'
    };
    return m[type] || 'badge-gray';
}

const pages = getFilesRecursively(srcDir, 'page.tsx');
const apis  = getFilesRecursively(srcDir, 'route.ts');

const allItems = [
    ...pages.map(fp => {
        const rel = fp.replace(srcDir,'').replace(/\\/g,'/');
        const parts = rel.split('/').filter(Boolean);
        const pathPart = rel.replace('/page.tsx','') || 'home';
        const newId = 'p' + pathPart.replace(/[^a-zA-Z0-9]/g,'-');
        const oldId = 'p' + Buffer.from(rel).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
        return {
            id: newId,
            oldId: oldId,
            type: 'Page',
            title: pathPart === 'home' ? '/ (Home)' : pathPart,
            expected: getExpected(rel,'Page'),
            subItems: extractSubItems(fp),
            role: getRole(parts, false)
        };
    }),
    ...apis.map(fp => {
        const rel = fp.replace(srcDir,'').replace(/\\/g,'/');
        const parts = rel.split('/').filter(Boolean);
        const pathPart = rel.replace('/route.ts','');
        const newId = 'a' + pathPart.replace(/[^a-zA-Z0-9]/g,'-');
        const oldId = 'a' + Buffer.from(rel).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
        return {
            id: newId,
            oldId: oldId,
            type: 'Endpoint',
            title: pathPart,
            expected: getExpected(rel,'Endpoint'),
            subItems: [],
            role: getRole(parts, true)
        };
    })
];

const grouped = {};
allItems.forEach(i => { if(!grouped[i.role]) grouped[i.role]=[]; grouped[i.role].push(i); });
const sections = Object.keys(grouped).sort().map(r => ({ role: r, items: grouped[r] }));

// PRE-RENDER all HTML in Node.js - zero client-side JS templating needed
let bodyHtml = '';

sections.forEach((section, si) => {
    const rcId = 'rc' + si;
    const riId = 'ri' + si;

    // Build items HTML first
    let itemsHtml = '';
    section.items.forEach((item, ii) => {
        const icId = 'ic' + si + '_' + ii;
        const iiId = 'ii' + si + '_' + ii;
        const escapedId = esc(item.id);
        const escapedTitle = esc(item.title);
        const escapedExpected = esc(item.expected);
        // Build a live URL for Page items (strip trailing parenthetical fallback label)
        const pageUrl = item.type === 'Page'
            ? 'https://fixtray.app' + (item.title === '/ (Home)' ? '/' : item.title)
            : null;
        const escapedPageUrl = pageUrl ? esc(pageUrl) : null;

        let subItemsHtml = '';
        if (item.subItems && item.subItems.length > 0) {
            item.subItems.forEach((sub, subi) => {
                const subId = item.id + '_s' + subi;
                subItemsHtml += `
                <div class="sub-item pl-8 pr-4 py-3 flex flex-col md:flex-row gap-3 border-t border-gray-100 transition-all" id="sub-${esc(subId)}">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="text-xs px-1.5 py-0.5 rounded font-semibold uppercase ${badgeCls(sub.type)}">${esc(sub.type)}</span>
                            <span class="text-sm font-medium text-gray-700">${esc(sub.label)}</span>
                        </div>
                        <p class="text-xs text-gray-500 mb-1">${esc(sub.desc)}</p>
                        <textarea rows="1" class="note-field w-full text-xs border border-gray-200 rounded p-1.5 text-gray-700 resize-none" data-id="${esc(subId)}" placeholder="Actual result..."></textarea>
                    </div>
                    <div class="flex md:flex-col gap-1.5 justify-end shrink-0">
                        <button class="status-btn border rounded px-2 py-1 text-xs font-bold" data-id="${esc(subId)}" data-val="go">GO</button>
                        <button class="status-btn border rounded px-2 py-1 text-xs font-bold" data-id="${esc(subId)}" data-val="no-go">NO-GO</button>
                    </div>
                </div>`;
            });
        }

        itemsHtml += `
        <div class="check-item border-l-4 border-transparent transition-all" id="item-${escapedId}">
            <div class="p-4 flex flex-col md:flex-row gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1 ${item.subItems && item.subItems.length > 0 ? 'cursor-pointer' : ''}" ${item.subItems && item.subItems.length > 0 ? `onclick="toggleEl('${icId}','${iiId}')"` : ''}>
                        <span class="text-xs px-2 py-0.5 rounded font-bold uppercase ${badgeCls(item.type)}">${esc(item.type)}</span>
                        <span class="font-semibold text-gray-800 text-sm break-all">${escapedTitle}</span>
                        ${escapedPageUrl ? `<a href="${escapedPageUrl}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 hover:text-blue-700 font-medium underline shrink-0" onclick="event.stopPropagation()">&#8599; Open</a>` : ''}
                        ${item.subItems && item.subItems.length > 0 ? `<span class="text-xs text-gray-400">(${item.subItems.length} checks &#9660;)</span>
                        <svg id="${iiId}" class="rotate-icon rotated flex-shrink-0" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>` : ''}
                    </div>
                    <p class="text-xs text-gray-500 mb-2"><strong class="text-gray-600">Expected:</strong> ${escapedExpected}</p>
                    <textarea rows="2" class="note-field w-full text-xs border border-gray-200 rounded p-2 text-gray-700 resize-none" data-id="${escapedId}" placeholder="Actual result / debug notes..."></textarea>
                </div>
                <div class="flex md:flex-col gap-2 justify-end shrink-0">
                    <button class="status-btn border rounded px-3 py-1.5 text-xs font-bold" data-id="${escapedId}" data-val="go">GO</button>
                    <button class="status-btn border rounded px-3 py-1.5 text-xs font-bold" data-id="${escapedId}" data-val="no-go">NO-GO</button>
                </div>
            </div>
            ${item.subItems && item.subItems.length > 0 ? `<div id="${icId}" class="sub-container hidden bg-gray-50 divide-y divide-gray-100">${subItemsHtml}</div>` : ''}
        </div>`;
    });

    bodyHtml += `
    <div class="section-block border border-gray-200 rounded-xl overflow-hidden shadow-sm" id="section-${si}">
        <div class="section-header bg-gray-800 text-white p-4 cursor-pointer hover:bg-gray-700 select-none flex justify-between items-center" onclick="toggleEl('${rcId}','${riId}')">
            <div>
                <span class="font-bold">${esc(section.role)}</span>
                <span class="text-gray-400 text-sm font-normal ml-2">(${section.items.length} items)</span>
                <div class="flex flex-wrap gap-1.5 mt-1 progress-bar" data-section="${si}"></div>
            </div>
            <svg id="${riId}" class="rotate-icon rotated" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div id="${rcId}" class="hidden divide-y divide-gray-100">${itemsHtml}</div>
    </div>`;
});

// Collect all IDs for the JS state engine
const allIds = [];
allItems.forEach(item => {
    allIds.push(item.id);
    if (item.subItems) {
        item.subItems.forEach((sub, subi) => {
            allIds.push(item.id + '_s' + subi);
        });
    }
});

// Build section->item id mapping for progress bars
const sectionMap = sections.map(s => s.items.map(i => {
    const ids = [i.id];
    if (i.subItems) i.subItems.forEach((sub, subi) => ids.push(i.id + '_s' + subi));
    return ids;
}));

// Build migration map: oldTruncatedId -> newPathId (for localStorage key migration)
const migrateMap = {};
allItems.forEach(item => {
    if (item.oldId !== item.id) {
        migrateMap[item.oldId] = item.id;
    }
});

const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FixTray Go/No-Go Full Inspection</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; }
.rotate-icon { transition: transform 0.2s; }
.rotated { transform: rotate(-90deg); }
.check-item.go { border-left-color: #10b981 !important; background-color: #f0fdf4; }
.check-item.no-go { border-left-color: #ef4444 !important; background-color: #fef2f2; }
.sub-item.go { background-color: #dcfce7; }
.sub-item.no-go { background-color: #fee2e2; }
.status-btn { transition: all 0.15s; }
.status-btn.active-go { background: #10b981; color: white; border-color: #059669; }
.status-btn.active-no-go { background: #ef4444; color: white; border-color: #dc2626; }
.status-btn:not(.active-go):not(.active-no-go) { background: #f3f4f6; color: #6b7280; border-color: #d1d5db; }
.status-btn:not(.active-go):not(.active-no-go):hover { background: #e5e7eb; }
.note-field { focus-outline: none; }
.badge-yellow { background:#fef9c3; color:#854d0e; }
.badge-blue { background:#dbeafe; color:#1e40af; }
.badge-purple { background:#f3e8ff; color:#6b21a8; }
.badge-orange { background:#ffedd5; color:#9a3412; }
.badge-teal { background:#ccfbf1; color:#0f766e; }
.badge-pink { background:#fce7f3; color:#9d174d; }
.badge-gray { background:#f3f4f6; color:#374151; }
@media print { .noprint { display:none; } body { background: white; } }
</style>
</head>
<body class="p-3 md:p-6 text-gray-800">
<div class="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden mb-10">
    <div class="bg-indigo-700 p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
            <h1 class="text-2xl font-bold">FixTray Go/No-Go Full Inspection</h1>
            <p class="opacity-70 text-sm mt-0.5">${pages.length} Pages &middot; ${apis.length} API Endpoints &middot; All buttons, modals, links, cards extracted from source</p>
        </div>
        <div class="flex flex-wrap gap-2 noprint">
            <button onclick="expandAll()" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-semibold">Expand All</button>
            <button onclick="collapseAll()" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-semibold">Collapse All</button>
            <button onclick="clearProgress()" class="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-semibold">Clear Progress</button>
            <button onclick="window.print()" class="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-sm font-semibold">Print/PDF</button>
        </div>
    </div>
    <div id="main" class="p-4 space-y-4">
${bodyHtml}
    </div>
</div>
<script>
(function() {
    var SMAP = ${JSON.stringify(sectionMap)};
    var MIGRATE = ${JSON.stringify(migrateMap)};

    function gs(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
    function ss(k,v) { try { localStorage.setItem(k,v); } catch(e) {} }

    // One-time migration: remap old truncated-base64 IDs to new path-based IDs
    function runMigration() {
        if (gs('_mig_v3b')) return;
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        keys.forEach(function(key) {
            if (!key || (!key.startsWith('s_') && !key.startsWith('n_'))) return;
            var prefix = key.slice(0, 2); // 's_' or 'n_'
            var rawId = key.slice(2);
            // Split off optional sub-item suffix like '_s0', '_s12'
            var baseId = rawId, suffix = '';
            var lastUs = rawId.lastIndexOf('_s');
            if (lastUs > 0 && /^\d+$/.test(rawId.slice(lastUs + 2))) {
                baseId = rawId.slice(0, lastUs);
                suffix = rawId.slice(lastUs);
            }
            if (!MIGRATE[baseId]) return;
            var newKey = prefix + MIGRATE[baseId] + suffix;
            var val = localStorage.getItem(key);
            if (val !== null && !localStorage.getItem(newKey)) {
                localStorage.setItem(newKey, val);
            }
            localStorage.removeItem(key);
        });
        ss('_mig_v3b', '1');
    }

    function toggleEl(contentId, iconId) {
        var el = document.getElementById(contentId);
        var ic = document.getElementById(iconId);
        if (!el) return;
        var isHidden = el.classList.toggle('hidden');
        if (ic) {
            if (isHidden) ic.classList.add('rotated');
            else ic.classList.remove('rotated');
        }
    }
    window.toggleEl = toggleEl;

    function expandAll() {
        document.querySelectorAll('[id^="rc"]').forEach(function(el) { el.classList.remove('hidden'); });
        document.querySelectorAll('.rotate-icon').forEach(function(el) { el.classList.remove('rotated'); });
    }
    function collapseAll() {
        document.querySelectorAll('[id^="rc"]').forEach(function(el) { el.classList.add('hidden'); });
        document.querySelectorAll('[id^="ic"]').forEach(function(el) { el.classList.add('hidden'); });
        document.querySelectorAll('.rotate-icon').forEach(function(el) { el.classList.add('rotated'); });
    }
    window.expandAll = expandAll;
    window.collapseAll = collapseAll;

    function clearProgress() {
        if (!confirm('Clear all progress? This cannot be undone.')) return;
        localStorage.clear();
        applyAllStates();
        updateAllProgress();
    }
    window.clearProgress = clearProgress;

    function applyStatus(id, val) {
        // Apply to check-item or sub-item
        var itemEl = document.getElementById('item-' + id) || document.getElementById('sub-' + id);
        if (itemEl) {
            itemEl.classList.remove('go', 'no-go');
            if (val) itemEl.classList.add(val);
        }
        // Apply to buttons
        var btns = document.querySelectorAll('.status-btn[data-id="' + id + '"]');
        btns.forEach(function(btn) {
            btn.classList.remove('active-go', 'active-no-go');
            if (val === 'go') btn.classList.add('active-go');
            else if (val === 'no-go') btn.classList.add('active-no-go');
        });
    }

    function applyAllStates() {
        document.querySelectorAll('.status-btn').forEach(function(btn) {
            var id = btn.getAttribute('data-id');
            var val = gs('s_' + id) || '';
            applyStatus(id, val);
        });
        document.querySelectorAll('.note-field').forEach(function(ta) {
            var id = ta.getAttribute('data-id');
            ta.value = gs('n_' + id) || '';
        });
    }

    function updateAllProgress() {
        document.querySelectorAll('.progress-bar').forEach(function(bar) {
            var si = bar.getAttribute('data-section');
            if (si === null) return;
            var allIds = [];
            SMAP[si].forEach(function(group) { allIds = allIds.concat(group); });
            var go = 0, nogo = 0;
            allIds.forEach(function(id) {
                var v = gs('s_' + id);
                if (v === 'go') go++;
                else if (v === 'no-go') nogo++;
            });
            var pend = allIds.length - go - nogo;
            var pct = allIds.length ? Math.round(go / allIds.length * 100) : 0;
            bar.innerHTML =
                '<span class="text-xs text-green-300 bg-green-900/40 px-1.5 py-0.5 rounded">' + go + ' Go</span>' +
                '<span class="text-xs text-red-300 bg-red-900/40 px-1.5 py-0.5 rounded ml-1">' + nogo + ' No-Go</span>' +
                '<span class="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded ml-1">' + pend + ' Pending</span>' +
                '<span class="text-xs text-gray-400 ml-2">' + pct + '%</span>';
        });
    }

    // Wire up buttons via event delegation
    document.getElementById('main').addEventListener('click', function(e) {
        var btn = e.target.closest('.status-btn');
        if (!btn) return;
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var val = btn.getAttribute('data-val');
        var cur = gs('s_' + id);
        var next = cur === val ? '' : val;
        ss('s_' + id, next);
        applyStatus(id, next);
        updateAllProgress();
    });

    // Wire up note fields
    document.getElementById('main').addEventListener('change', function(e) {
        if (!e.target.classList.contains('note-field')) return;
        var id = e.target.getAttribute('data-id');
        ss('n_' + id, e.target.value);
    });

    // Init: migrate old IDs first, then restore state
    runMigration();
    applyAllStates();
    updateAllProgress();
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'fixtray-qa-ultimate-inspection.html'), finalHtml);
console.log('Done. ' + pages.length + ' pages + ' + apis.length + ' endpoints. ' + allIds.length + ' total checkable items.');
