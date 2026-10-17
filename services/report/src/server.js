import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { formatCsv, formatText } from './formatters.js';

const PROTO_PATH = join(import.meta.dirname, '..', '..', '..', 'protos', 'report.proto');
const PORT = process.env.REPORT_PORT ?? '50051';

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, // keep row_count as row_count (not rowCount)
  longs: Number, // int64 -> JS number
  enums: String, // enums arrive as 'FORMAT_CSV' instead of 2
  defaults: true, // missing fields arrive as '', 0 or [] instead of undefined
});
const { ReportService } = grpc.loadPackageDefinition(definition).inventory.report;

function generate(call, callback) {
  const { title, columns, rows, format } = call.request;

  if (columns.length === 0) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: 'columns must not be empty',
    });
  }

  const values = rows.map((row) => row.values);
  const badRow = values.findIndex((row) => row.length !== columns.length);
  if (badRow !== -1) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: `row ${badRow} has ${values[badRow].length} values, expected ${columns.length}`,
    });
  }

  const generatedAt = new Date().toISOString();
  // FORMAT_UNSPECIFIED and FORMAT_TEXT both produce text.
  const content = format === 'FORMAT_CSV'
    ? formatCsv(columns, values)
    : formatText(title, columns, values, generatedAt);

  console.log(`[report] Generate "${title}" format=${format} rows=${values.length}`);
  callback(null, {
    content,
    row_count: values.length,
    generated_at: generatedAt,
  });
}

const server = new grpc.Server();
server.addService(ReportService.service, { Generate: generate });

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error(`[report] could not start: ${err.message}`);
    process.exit(1);
  }
  console.log(`[report] listening on port ${port}`);
});
