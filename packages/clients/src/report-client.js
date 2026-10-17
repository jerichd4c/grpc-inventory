import { callUnary, createGrpcClient } from './grpc-helpers.js';

const FORMATS = {
  text: 'FORMAT_TEXT',
  csv: 'FORMAT_CSV',
};

export class ReportClient {
  constructor({
    address = process.env.REPORT_ADDRESS ?? 'localhost:50051',
    timeoutMs = 3000,
  } = {}) {
    this.client = createGrpcClient('report.proto', 'inventory.report.ReportService', address);
    this.timeoutMs = timeoutMs;
  }

  // rows is a plain array of arrays: [[1, 'Keyboard', 25], [2, 'Mouse', 15.5]]
  // The caller never sees protobuf details like Row { values } or FORMAT_CSV.
  async generate({ title, columns, rows, format = 'text' }) {
    const protoFormat = FORMATS[format];
    if (!protoFormat) {
      throw new Error(`unknown report format "${format}" (use "text" or "csv")`);
    }

    const request = {
      title,
      columns,
      rows: rows.map((row) => ({ values: row.map(String) })),
      format: protoFormat,
    };

    const response = await callUnary(this.client, 'report.Generate', 'Generate', request, this.timeoutMs);
    return {
      content: response.content,
      rowCount: response.row_count,
      generatedAt: response.generated_at,
    };
  }

  close() {
    this.client.close();
  }
}
