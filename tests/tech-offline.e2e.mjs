/**
 * Offline tech workspace: add 2 labor lines and 2 photos with the network off,
 * reconnect, and confirm the real sync function stores each one once.
 *
 * Run: node tests/tech-offline.e2e.mjs
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import ts from 'typescript';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = '/tmp/tech-offline-e2e';
fs.mkdirSync(OUT, { recursive: true });

function transpile(rel) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: rel,
  }).outputText
    .replace("from './techOfflineSync'", "from './techOfflineSync.mjs'")
    .replace("from './offlineSafety'", "from './offlineSafety.mjs'");
  const dest = path.join(OUT, path.basename(rel).replace(/\.ts$/, '.mjs'));
  fs.writeFileSync(dest, js);
  return dest;
}

transpile('src/lib/techOfflineSync.ts');
transpile('src/lib/offlineSafety.ts');
const applyUrl = pathToFileURL(transpile('src/lib/techOfflineApply.ts')).href;
const { applyTechOfflineOp } = await import(applyUrl);

const orders = new Map();
orders.set('wo-1', {
  id: 'wo-1',
  shopId: 'shop-1',
  customerId: 'cust-1',
  assignedTechId: 'tech-1',
  status: 'in-progress',
  issueDescription: 'No-start on the shoulder',
  serviceLocation: 'roadside',
  vehicleType: 'truck',
  location: { address: '100 Main St', city: 'Austin', state: 'TX', zipCode: '78701', latitude: 30.27, longitude: -97.74 },
  latitude: 30.27,
  longitude: -97.74,
  jobAddress: '100 Main St, Austin, TX 78701',
  estimatedCost: 0,
  techLabor: [],
  partsUsed: [],
  workPhotos: [],
  completion: {},
  messages: [],
  prep: { ready: true, missing: [], warning: null },
  updatedAt: new Date().toISOString(),
  customer: { id: 'cust-1', firstName: 'Riley', lastName: 'Nguyen', phone: '555-0100' },
  vehicle: { id: 'v-1', year: 2019, make: 'Ford', model: 'F-150', licensePlate: 'ROAD1', vin: 'VIN123', vehicleType: 'truck' },
});
orders.set('wo-c', {
  id: 'wo-c',
  shopId: 'shop-1',
  customerId: 'cust-1',
  assignedTechId: 'tech-1',
  status: 'in-progress',
  issueDescription: 'Waiting on an update',
  serviceLocation: 'in-shop',
  vehicleType: 'car',
  techLabor: [],
  partsUsed: [],
  workPhotos: [],
  completion: {},
  messages: [],
  prep: { ready: true, missing: [], warning: null },
  updatedAt: new Date().toISOString(),
  customer: { id: 'cust-1', firstName: 'Riley', lastName: 'Nguyen', phone: '555-0100' },
  vehicle: { id: 'v-2', year: 2018, make: 'Honda', model: 'Civic', licensePlate: 'CITY1', vin: 'VIN999', vehicleType: 'car' },
});
const uploads = new Map();
const db = {
  syncReceipt: {
    findUnique: async ({ where }) => db.receipts.get(where.idempotencyKey) || null,
    create: async ({ data }) => { db.receipts.set(data.idempotencyKey, data); return data; },
  },
  receipts: new Map(),
  workOrder: {
    findUnique: async ({ where }) => orders.get(where.id) || null,
    update: async ({ where, data }) => {
      const next = { ...orders.get(where.id), ...data };
      orders.set(where.id, next);
      return next;
    },
  },
  statusHistory: { create: async ({ data }) => data },
  timeEntry: {
    findFirst: async () => null,
    findUnique: async () => null,
    create: async ({ data }) => data,
    update: async ({ data }) => data,
  },
  photo: {
    findUnique: async ({ where }) => db.photos.get(where.clientMutationId) || null,
    create: async ({ data }) => { db.photos.set(data.clientMutationId, data); return data; },
  },
  photos: new Map(),
  messages: [],
  customerMessages: [],
  pings: [],
  message: {
    findUnique: async ({ where }) => db.messages.find((row) => row.clientMutationId === where.clientMutationId) || null,
    create: async ({ data }) => { db.messages.push(data); return data; },
  },
  customerMessage: {
    findUnique: async ({ where }) => db.customerMessages.find((row) => row.clientMutationId === where.clientMutationId) || null,
    create: async ({ data }) => { db.customerMessages.push(data); return data; },
  },
  locationPing: {
    findUnique: async ({ where }) => db.pings.find((row) => row.clientMutationId === where.clientMutationId) || null,
    create: async ({ data }) => { db.pings.push(data); return data; },
  },
  tech: {
    findUnique: async () => ({ id: 'tech-1', shopId: 'shop-1' }),
    update: async ({ data }) => data,
  },
  $transaction: async (fn) => fn(db),
};

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync(path.join(OUT, 'pixel.png'), png);

function send(res, status, body, type = 'application/json') {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function actorFrom(req) {
  const header = req.headers.authorization || '';
  if (header.includes('customer-token')) return { id: 'cust-1', role: 'customer' };
  return { id: 'tech-1', role: 'tech', shopId: 'shop-1' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && (url.pathname === '/api/offline/bundle' || url.pathname === '/api/tech/offline-bundle')) {
    const actor = actorFrom(req);
    const customer = actor.role === 'customer';
    return send(res, 200, {
      role: actor.role,
      userId: actor.id,
      techId: customer ? undefined : 'tech-1',
      shopId: 'shop-1',
      techName: customer ? '' : 'QA Tech',
      laborRate: customer ? 0 : 125,
      laborRates: customer ? [] : [{ id: 'std', name: 'Standard', rate: 125, category: 'labor' }],
      catalog: customer ? [] : [{ id: 'pad', name: 'Brake pad', sku: 'BP-1', price: 48, rate: null, type: 'part' }],
      shops: [],
      clock: null,
      workOrders: [orders.get(customer ? 'wo-c' : 'wo-1')],
      fetchedAt: new Date().toISOString(),
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/offline/map-pack') {
    return send(res, 200, {
      roads: [[{ lat: 30.27, lng: -97.75 }, { lat: 30.27, lng: -97.73 }]],
      attribution: '© OpenStreetMap contributors',
      provider: 'OpenStreetMap data via Overpass',
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/workorders/wo-1') {
    return send(res, 200, { workOrder: orders.get('wo-1'), messages: db.messages, pings: db.pings });
  }
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('latin1');
    const match = raw.match(/name="idempotencyKey"\r\n\r\n([^\r\n]+)/);
    const idem = match ? match[1] : `upload-${uploads.size}`;
    if (!uploads.has(idem)) uploads.set(idem, { url: `https://res.cloudinary.com/demo/image/upload/${encodeURIComponent(idem)}.jpg`, publicId: idem });
    return send(res, 200, uploads.get(idem));
  }
  if (req.method === 'POST' && url.pathname === '/api/tech/offline-sync') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const actor = actorFrom(req);
    const results = [];
    for (const op of body.ops || []) results.push(await applyTechOfflineOp(db, actor, op));
    return send(res, 200, { results });
  }
  const filePath = url.pathname === '/tech-offline/' || url.pathname === '/tech-offline/index.html'
    ? path.join(ROOT, 'public/tech-offline/index.html')
    : path.join(ROOT, 'public', url.pathname);
  if (!filePath.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, { error: 'not found' });
  }
  const type = filePath.endsWith('.js') ? 'text/javascript' : filePath.endsWith('.css') ? 'text/css' : 'text/html';
  return send(res, 200, fs.readFileSync(filePath), type);
});

await new Promise((resolve) => server.listen(8791, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('userRole', 'tech');
  localStorage.setItem('userId', 'tech-1');
  localStorage.setItem('userName', 'QA Tech');
});
const shots = '/opt/cursor/artifacts';
fs.mkdirSync(shots, { recursive: true });

await page.goto('http://127.0.0.1:8791/tech-offline/', { waitUntil: 'domcontentloaded' });
await page.getByText('Riley Nguyen').click();
await page.screenshot({ path: path.join(shots, 'tech-offline-job.png') });

await page.context().setOffline(true);
await page.waitForSelector('#labor-desc');
await page.fill('#labor-desc', 'Roadside diag');
await page.click('#add-labor');
await page.getByText('Roadside diag').waitFor();
await page.fill('#labor-desc', 'Replace starter');
await page.click('#add-labor');
await page.getByText('Replace starter').waitFor();
await page.setInputFiles('#photo', path.join(OUT, 'pixel.png'));
await page.click('#add-photo');
await page.waitForFunction(() => (document.getElementById('sync-label').textContent || '').indexOf('3 pending') === 0);
await page.setInputFiles('#photo', path.join(OUT, 'pixel.png'));
await page.click('#add-photo');
await page.waitForFunction(() => (document.getElementById('sync-label').textContent || '').indexOf('4 pending') === 0);
await page.evaluate(() => {
  const engine = window.FixTrayOffline;
  return Promise.all([
    engine.addGps('wo-1', 30.28, -97.75, '2026-09-25T18:05:00.000Z'),
    engine.addGps('wo-1', 30.27, -97.74, '2026-09-25T18:00:00.000Z'),
  ]);
});
await page.waitForFunction(() => (document.getElementById('sync-label').textContent || '').indexOf('6 pending') === 0);
await page.screenshot({ path: path.join(shots, 'tech-offline-pending.png') });
const pendingText = await page.locator('#sync-label').innerText();

await page.context().setOffline(false);
await page.click('#sync-now');
await page.waitForFunction(() => {
  const label = document.getElementById('sync-label');
  return label && label.textContent === 'All synced';
}, { timeout: 8000 });
await page.screenshot({ path: path.join(shots, 'tech-offline-synced.png') });

const shop = await (await fetch('http://127.0.0.1:8791/api/workorders/wo-1')).json();
const labor = shop.workOrder.techLabor.map((line) => line.description);
const photos = shop.workOrder.workPhotos.length;
const pingOrder = db.pings.map((row) => row.clientMutationId);
const after = await page.locator('#app').innerText();
const shown = after.includes('Roadside diag') && after.includes('Replace starter');
const gpsOk = db.pings.length === 2
  && new Date(db.pings[0].deviceAt).getTime() < new Date(db.pings[1].deviceAt).getTime();

const customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
await customer.addInitScript(() => {
  localStorage.setItem('token', 'customer-token');
  localStorage.setItem('userRole', 'customer');
  localStorage.setItem('userId', 'cust-1');
  localStorage.setItem('userName', 'Riley Nguyen');
});
await customer.goto('http://127.0.0.1:8791/tech-offline/', { waitUntil: 'domcontentloaded' });
await customer.getByText('Riley Nguyen').click();
await customer.context().setOffline(true);
await customer.fill('#message', 'On my way, no signal');
await customer.setInputFiles('#message-photo', path.join(OUT, 'pixel.png'));
await customer.click('#add-message');
await customer.waitForFunction(() => (document.getElementById('sync-label').textContent || '').indexOf('1 pending') === 0);
await customer.screenshot({ path: path.join(shots, 'customer-offline-pending.png') });
await customer.context().setOffline(false);
await customer.click('#sync-now');
await customer.waitForFunction(() => {
  const label = document.getElementById('sync-label');
  return label && label.textContent === 'All synced';
}, { timeout: 8000 });
await customer.screenshot({ path: path.join(shots, 'customer-offline-synced.png') });

const customerOk = db.messages.length === 1 && db.customerMessages.length === 1 && db.messages[0].body === 'On my way, no signal' && uploads.size === 3;
if (labor.length !== 2 || photos !== 2 || uploads.size !== 3 || !shown || !gpsOk || !customerOk) {
  console.error(JSON.stringify({ labor, photos, uploads: uploads.size, pendingText, shown, gpsOk, pingOrder, messages: db.messages.length, customerMessages: db.customerMessages.length }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ pendingText, labor, photos, uploads: uploads.size, pings: db.pings.length, messages: db.messages.length }));
}

await browser.close();
server.close();
