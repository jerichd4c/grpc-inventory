// End-to-end tests: real microservices, real gRPC calls, real SQLite.
// They use their own ports and temporary databases, so they never touch the
// real data and can run while the normal services are up.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const TMP = mkdtempSync(join(tmpdir(), 'grpc-inventory-test-'));
const REPORT_PORT = '50061';
const AUDIT_PORT = '50062';

// Must be set before the library loads, hence the dynamic import below.
process.env.REPORT_ADDRESS = `localhost:${REPORT_PORT}`;
process.env.AUDIT_ADDRESS = `localhost:${AUDIT_PORT}`;
process.env.INVENTORY_DB_PATH = join(TMP, 'inventory.db');

const { checkServices, close, Product, Sale, ServiceError } = await import('@grpc-inventory/bo');

const services = {};

function startService(name, env) {
  const server = join(ROOT, 'services', name, 'src', 'server.js');
  services[name] = spawn(process.execPath, [server], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
}

function startReport() {
  startService('report', { REPORT_PORT });
}

function startAudit() {
  startService('audit', { AUDIT_PORT, AUDIT_DB_PATH: join(TMP, 'audit.db') });
}

let keyboard;

before(async () => {
  startReport();
  startAudit();
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await checkServices();
    if (status.report && status.audit) return;
  }
  throw new Error('the services did not start');
});

after(() => {
  for (const child of Object.values(services)) child.kill();
  close();
  // Retries give Windows time to release the database files.
  rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test('creating a product saves it and logs it in the audit service', async () => {
  keyboard = await Product.create({ name: 'Keyboard', price: 25, stock: 10 });
  assert.equal(keyboard.stock, 10);

  const [event] = await Product.history(1);
  assert.equal(event.action, 'create');
  assert.equal(event.entityId, String(keyboard.id));
});

test('a sale lowers the stock and stores the total', async () => {
  const sale = await Sale.create({ productId: keyboard.id, quantity: 3 });
  assert.equal(sale.total, 75);
  assert.equal(Product.findById(keyboard.id).stock, 7);
});

test('a sale larger than the stock fails and changes nothing', async () => {
  await assert.rejects(
    Sale.create({ productId: keyboard.id, quantity: 100 }),
    { name: 'BusinessError', code: 'INSUFFICIENT_STOCK' },
  );
  assert.equal(Product.findById(keyboard.id).stock, 7);
  assert.equal(Sale.findAll().length, 1);
});

test('invalid input is rejected', async () => {
  await assert.rejects(Product.create({ name: '', price: 10 }), { code: 'INVALID_INPUT' });
  await assert.rejects(Product.create({ name: 'Cable', price: 'abc' }), { code: 'INVALID_INPUT' });
  await assert.rejects(Product.create({ name: 'Keyboard', price: 30 }), { code: 'DUPLICATE' });
  await assert.rejects(Sale.create({ productId: 999, quantity: 1 }), { code: 'NOT_FOUND' });
});

test('reports are built by the report service', async () => {
  await Product.create({ name: 'Mouse, wireless', price: 15.5, stock: 3 });

  const text = await Product.report();
  assert.equal(text.rowCount, 2);
  assert.match(text.content, /Keyboard/);

  const csv = await Product.report('csv');
  assert.match(csv.content, /"Mouse, wireless"/);
});

test('with the audit service down, operations still work', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  services.audit.kill();

  const cable = await Product.create({ name: 'Cable', price: 5, stock: 20 });
  assert.equal(cable.stock, 20);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /not audited/);

  assert.deepEqual(await checkServices(), { report: true, audit: false });
});

test('with the report service down, reports fail with UNAVAILABLE', async () => {
  services.report.kill();
  await assert.rejects(
    Product.report(),
    (err) => err instanceof ServiceError && err.code === 'UNAVAILABLE',
  );
});

test('a restarted service is used again within a few seconds', async () => {
  startReport();

  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const report = await Product.report();
      assert.equal(report.rowCount, 3);
      return;
    } catch {
      await sleep(250);
    }
  }
  assert.fail('the report service was not used again within 5 seconds');
});
