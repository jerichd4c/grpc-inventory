// Temporary manual test for the report service.
// In phase 4 this is replaced by a proper client wrapper.
import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = join(import.meta.dirname, '..', '..', '..', 'protos', 'report.proto');
const ADDRESS = process.env.REPORT_ADDRESS ?? 'localhost:50051';

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
});
const { ReportService } = grpc.loadPackageDefinition(definition).inventory.report;
const client = new ReportService(ADDRESS, grpc.credentials.createInsecure());

const sample = {
  title: 'Products',
  columns: ['ID', 'Name', 'Price', 'Stock'],
  rows: [
    { values: ['1', 'Keyboard', '25.00', '10'] },
    { values: ['2', 'Mouse, wireless', '15.50', '3'] },
    { values: ['3', 'Monitor 24"', '180.00', '0'] },
  ],
};

// Wraps the callback-style call in a Promise so we can use await.
function generate(request) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 3000;
    client.Generate(request, { deadline }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

try {
  const text = await generate({ ...sample, format: 'FORMAT_TEXT' });
  console.log(text.content);

  const csv = await generate({ ...sample, format: 'FORMAT_CSV' });
  console.log(`\n${csv.content}`);
  console.log(`\nrow_count=${csv.row_count} generated_at=${csv.generated_at}`);

  // This one must fail: the row has 2 values but there are 4 columns.
  await generate({ ...sample, rows: [{ values: ['1', 'Keyboard'] }] });
} catch (err) {
  console.log(`\nExpected error -> ${grpc.status[err.code]}: ${err.details}`);
} finally {
  console.log(`\nClosing client...`);
  client.close();
}
