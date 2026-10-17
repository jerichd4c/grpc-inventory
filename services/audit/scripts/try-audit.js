// Temporary manual test for the audit service.
// In phase 4 this is replaced by a proper client wrapper.
import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = join(import.meta.dirname, '..', '..', '..', 'protos', 'audit.proto');
const ADDRESS = process.env.AUDIT_ADDRESS ?? 'localhost:50052';

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
});
const { AuditService } = grpc.loadPackageDefinition(definition).inventory.audit;
const client = new AuditService(ADDRESS, grpc.credentials.createInsecure());

// Generic helper: calls any unary method by name and returns a Promise.
function call(method, request) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 3000;
    client[method](request, { deadline }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

const sampleEvents = [
  { entity: 'product', entity_id: '1', action: 'create', detail: 'Keyboard, stock 10' },
  { entity: 'sale', entity_id: '1', action: 'create', detail: 'product 1 x2' },
  { entity: 'product', entity_id: '1', action: 'update', detail: 'stock 10 -> 8' },
];

try {
  for (const event of sampleEvents) {
    const ack = await call('Log', event);
    console.log(`Logged #${ack.id} at ${ack.timestamp}`);
  }

  const all = await call('List', {});
  console.log(`\nLast ${all.events.length} events (all entities):`);
  for (const e of all.events) {
    console.log(`  #${e.id} ${e.entity}:${e.entity_id} ${e.action} - ${e.detail}`);
  }

  const products = await call('List', { entity: 'product', limit: 2 });
  console.log(`\nLast ${products.events.length} product events:`);
  for (const e of products.events) {
    console.log(`  #${e.id} ${e.action} - ${e.detail}`);
  }

  // This one must fail: entity and action are required.
  await call('Log', { entity_id: '1', detail: 'missing fields' });
} catch (err) {
  console.log(`\nExpected error -> ${grpc.status[err.code]}: ${err.details}`);
} finally {
  console.log(`\nClosing client...`);
  client.close();
}
