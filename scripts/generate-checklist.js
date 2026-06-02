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

const pages = getFilesRecursively(srcDir, 'page.tsx');
const apis = getFilesRecursively(srcDir, 'route.ts');

const categorize = (filePath, type) => {
    let relPath = filePath.replace(srcDir, '').replace(/\\/g, '/');
    let parts = relPath.split('/').filter(Boolean);
    
    // Top level role
    let role = "Public / Global";
    if (parts[0] === 'api') {
        if (parts[1]) {
            if (['admin', 'auth', 'customers', 'shop', 'tech', 'manager', 'superadmin'].includes(parts[1])) {
                role = "API: " + parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
            } else {
                role = "API: Global/Misc";
            }
        }
    } else {
        if (['admin', 'auth', 'customer', 'shop', 'tech', 'manager', 'superadmin'].includes(parts[0])) {
            role = "Role: " + parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
    }
    
    let pathName = relPath.replace('/page.tsx', '').replace('/route.ts', '');
    if (pathName === '') pathName = '/ (Home)';

    let expectedDesc = `Review functionality for ${type} at ${pathName}.`;

    if (type === 'Endpoint') {
        if (pathName.includes('login') || pathName.includes('auth')) expectedDesc = 'Handle secure user authentication, credential validation, and issue/manage session tokens/cookies.';
        else if (pathName.includes('workorders')) expectedDesc = 'Process work order creation, assignments, status updates, or retrieve work order datasets.';
        else if (pathName.includes('customers')) expectedDesc = 'Perform database operations for customer profiles, history, or communications.';
        else if (pathName.includes('admin') || pathName.includes('settings')) expectedDesc = 'Handle configuration updates, access controls, or platform-level mutations securely.';
        else if (pathName.includes('analytics') || pathName.includes('revenue')) expectedDesc = 'Aggregate and calculate financial, performance, or system analytics data.';
        else if (pathName.includes('cron')) expectedDesc = 'Execute background automated tasks, scheduled reminders, or regular maintenance.';
        else expectedDesc = 'Process API requests, validate input payload, execute database queries, and return standardized JSON status/data.';
    } else {
        if (pathName.includes('login') || pathName.includes('auth')) expectedDesc = 'Display login/registration forms, validate inputs locally, and handle token issuance securely without leaking details.';
        else if (pathName.includes('home') || pathName.includes('dashboard')) expectedDesc = 'Display aggregate metrics, summary metric cards, navigation elements, and quick-action links specific to this role.';
        else if (pathName.includes('workorders')) expectedDesc = 'Present lists, repair tracking grids, assignments, or detailed views for work orders. Should reflect status changes in real-time UI.';
        else if (pathName.includes('settings') || pathName.includes('admin') || pathName.includes('profile')) expectedDesc = 'Provide configuration interfaces, editable profile forms, security settings (2FA), and proper save-state feedback.';
        else if (pathName.includes('inventory') || pathName.includes('parts')) expectedDesc = 'Render lists of parts, allow stock level adjustments, core return logging, and supplier integrations.';
        else if (pathName.includes('payment') || pathName.includes('revenue')) expectedDesc = 'Render payment gateways, invoice histories, accounts receivable aging, or revenue dashboards securely.';
        else if (pathName.includes('messages') || pathName.includes('chat')) expectedDesc = 'Render chat UI, handle incoming push messaging/sockets, and display conversation history.';
        else expectedDesc = `Load UI page components for ${pathName}, ensuring responsive design, valid data fetching, and proper localized strings.`;
    }

    return {
        id: Buffer.from(relPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) + Math.floor(Math.random()*100),
        type: type,
        title: pathName,
        expected: expectedDesc,
        comments: '',
        role: role
    };
};

const allItems = [
    ...pages.map(p => categorize(p, 'Page')),
    ...apis.map(p => categorize(p, 'Endpoint'))
];

// Group by role
const grouped = {};
allItems.forEach(item => {
    if (!grouped[item.role]) grouped[item.role] = [];
    grouped[item.role].push(item);
});

const finalData = Object.keys(grouped).map(role => ({
    role: role,
    items: grouped[role]
}));

// Output the HTML
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FixTray Complete Go/No-Go Checklist</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; }
        .checklist-item { transition: all 0.2s ease-in-out; }
        .go { border-left-color: #10b981 !important; background-color: #ecfdf5; }
        .no-go { border-left-color: #ef4444 !important; background-color: #fef2f2; }
    </style>
</head>
<body class="p-6 text-gray-800">
    <div class="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden mb-10">
        <div class="bg-indigo-600 p-6 text-white flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold">FixTray Complete Go/No-Go Checklist (FULL EXPORT)</h1>
                <p class="opacity-80 mt-1">Generated dynamically from ${pages.length} Pages and ${apis.length} Endpoints.</p>
            </div>
            <div class="flex gap-4">
                <button onclick="clearData()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded font-semibold text-sm transition">Clear Progress</button>
                <button onclick="window.print()" class="bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded font-semibold text-sm transition">Save PDF</button>
            </div>
        </div>

        <div class="p-6 space-y-8" id="checklist-container"></div>
    </div>

<script>
    const checklistData = ${JSON.stringify(finalData, null, 2)};

    function renderChecklist() {
        const container = document.getElementById('checklist-container');
        container.innerHTML = '';

        checklistData.sort((a, b) => a.role.localeCompare(b.role)).forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm';
            
            // Stats
            const progress = section.items.reduce((acc, item) => {
                const s = localStorage.getItem('status-' + item.id);
                if(s === 'go') acc.go++;
                if(s === 'no-go') acc.nogo++;
                return acc;
            }, {go: 0, nogo: 0});
            
            const total = section.items.length;
            const pending = total - progress.go - progress.nogo;

            // Header
            const header = document.createElement('div');
            header.className = 'bg-gray-100 p-4 border-b border-gray-200 font-bold text-lg text-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-200';
            header.innerHTML = \`<div class="flex items-center gap-4">
                <span>\${section.role} <span class="text-sm font-normal text-gray-500 ml-2">(\${total} items)</span></span>
                <div class="text-xs flex gap-2 font-normal">
                    <span class="text-green-600 bg-green-100 px-2 py-1 rounded">\${progress.go} Go</span>
                    <span class="text-red-600 bg-red-100 px-2 py-1 rounded">\${progress.nogo} No-Go</span>
                    <span class="text-gray-500 bg-gray-200 px-2 py-1 rounded">\${pending} Pending</span>
                </div>
            </div>
            <svg class="w-5 h-5 text-gray-500 transform transition-transform duration-200 rotate-180" id="icon-\${section.role.replace(/[^a-zA-Z]/g,'')}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>\`;
            
            // Content
            const content = document.createElement('div');
            content.className = 'divide-y divide-gray-100 hidden'; // Auto-collapse to save space
            content.id = 'content-' + section.role.replace(/[^a-zA-Z]/g,'');

            section.items.forEach(item => {
                const savedState = localStorage.getItem('status-' + item.id);
                const savedText = localStorage.getItem('text-' + item.id) || "";
                
                let itemClass = "p-4 border-l-4 border-transparent checklist-item flex flex-col md:flex-row gap-4 hover:bg-gray-50";
                if (savedState === 'go') itemClass += " go";
                if (savedState === 'no-go') itemClass += " no-go";

                content.innerHTML += \`
                    <div class="\${itemClass}" id="container-\${item.id}">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="\${item.type === 'Endpoint' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'} text-xs px-2 py-1 rounded font-semibold uppercase">\${item.type}</span>
                                <h3 class="text-base font-semibold text-gray-800 break-all">\${item.title}</h3>
                            </div>
                            <p class="text-gray-600 my-2 text-sm"><strong>Expected Behavior:</strong> \${item.expected}</p>
                            <div class="mt-2 text-sm">
                                <textarea id="text-\${item.id}" rows="2" 
                                    class="w-full border-gray-300 border rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                    placeholder="Add debugging notes, errors, or specific behavior results for this path..." 
                                    onchange="saveText('\${item.id}', this.value)">\${savedText}</textarea>
                            </div>
                        </div>
                        <div class="flex flex-row md:flex-col justify-center gap-2 md:w-28 shrink-0">
                            <button class="border rounded p-2 text-center text-sm font-bold \${savedState === 'go' ? 'bg-green-500 text-white border-green-600' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-600'}" onclick="setStatus('\${item.id}', 'go', event)">
                                ✅ GO
                            </button>
                            <button class="border rounded p-2 text-center text-sm font-bold \${savedState === 'no-go' ? 'bg-red-500 text-white border-red-600' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-600'}" onclick="setStatus('\${item.id}', 'no-go', event)">
                                ❌ NO-GO
                            </button>
                        </div>
                    </div>
                \`;
            });

            header.onclick = () => {
                content.classList.toggle('hidden');
                header.querySelector('svg').classList.toggle('rotate-180');
            };

            sectionDiv.appendChild(header);
            sectionDiv.appendChild(content);
            container.appendChild(sectionDiv);
        });
    }

    function setStatus(id, status, event) {
        event.stopPropagation();
        localStorage.setItem('status-' + id, status);
        renderChecklist();
    }

    function saveText(id, value) {
        localStorage.setItem('text-' + id, value);
    }

    function clearData() {
        if(confirm("Clear all checklist data? This cannot be undone.")) {
            localStorage.clear();
            renderChecklist();
        }
    }

    renderChecklist();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'fixtray-qa-ultimate-inspection.html'), htmlTemplate);
console.log("Ultimate QA Checklist generated.");
