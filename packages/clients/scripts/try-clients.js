// Manual test of the client library, imported by its package name
// exactly as the business objects will import it in phase 5.
import { AuditClient, ReportClient, ServiceError } from '@grpc-inventory/clients';

const report = new ReportClient();
const audit = new AuditClient();

try {
  // 1. Report: plain arrays with numbers, no protobuf details.
  const products = await report.generate({
    title: 'Products',
    columns: ['ID', 'Name', 'Price', 'Stock'],
    rows: [
      [1, 'Keyboard', 25, 10],
      [2, 'Mouse, wireless', 15.5, 3],
    ],
  });
  console.log(products.content);
  console.log(`\nrowCount=${products.rowCount}`);

  // 2. Audit: log an event, then read the latest ones back.
  const ack = await audit.log({ entity: 'product', entityId: 1, action: 'create', detail: 'Keyboard' });
  console.log(`\nLogged event #${ack.id}`);

  const events = await audit.list({ limit: 3 });
  console.log('Latest events:');
  for (const e of events) {
    console.log(`  #${e.id} ${e.entity}:${e.entityId} ${e.action} - ${e.detail}`);
  }

  // 3. Validation done by the wrapper itself, before any network call.
  try {
    await report.generate({ title: 'x', columns: ['A'], rows: [], format: 'pdf' });
  } catch (err) {
    console.log(`\nWrapper validation -> ${err.message}`);
  }

  // 4. Error from the server, translated into a ServiceError.
  try {
    await audit.log({ entity: '', entityId: 1, action: '' });
  } catch (err) {
    console.log(`Server validation  -> ${err.message}`);
  }

  // 5. Service down: nothing listens on this port.
  const offline = new ReportClient({ address: 'localhost:59999', timeoutMs: 1000 });
  try {
    await offline.generate({ title: 'x', columns: ['A'], rows: [] });
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'UNAVAILABLE') {
      console.log('Service down       -> report service is not reachable');
    } else {
      throw err;
    }
  } finally {
    offline.close();
  }
} catch (err) {
  // Reached when the real services are not running.
  console.error(`Unexpected error -> ${err.message}`);
  process.exitCode = 1;
} finally {
  report.close();
  audit.close();
}
