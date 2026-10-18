// Everything gRPC-specific that both clients share lives here,
// so report-client.js and audit-client.js stay short.
import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTOS_DIR = join(import.meta.dirname, '..', '..', '..', 'protos');

const LOADER_OPTIONS = {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
};

// When a service goes down, gRPC retries the connection waiting longer each
// time (up to 2 minutes by default). Capping the wait at 2 seconds means the
// client notices quickly when the service comes back.
const CHANNEL_OPTIONS = {
  'grpc.initial_reconnect_backoff_ms': 500,
  'grpc.max_reconnect_backoff_ms': 2000,
};

// Creates a gRPC client for one service of one .proto file.
// Example: createGrpcClient('report.proto', 'inventory.report.ReportService', 'localhost:50051')
export function createGrpcClient(protoFile, serviceName, address) {
  const definition = protoLoader.loadSync(join(PROTOS_DIR, protoFile), LOADER_OPTIONS);
  const proto = grpc.loadPackageDefinition(definition);

  // 'inventory.report.ReportService' -> proto.inventory.report.ReportService
  const Service = serviceName.split('.').reduce((obj, key) => obj[key], proto);
  return new Service(address, grpc.credentials.createInsecure(), CHANNEL_OPTIONS);
}

// Error thrown by every client method. It hides the raw gRPC error and keeps
// only what the caller needs: which call failed and the status name.
export class ServiceError extends Error {
  constructor(operation, grpcError) {
    const code = grpc.status[grpcError.code] ?? 'UNKNOWN';
    super(`${operation} failed: ${code} - ${grpcError.details}`);
    this.name = 'ServiceError';
    this.operation = operation; // e.g. 'report.Generate'
    this.code = code; // e.g. 'UNAVAILABLE', 'INVALID_ARGUMENT'
  }
}

// Turns a callback-style unary call into a Promise, with a deadline.
export function callUnary(client, operation, method, request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    client[method](request, { deadline }, (err, response) => {
      if (err) reject(new ServiceError(operation, err));
      else resolve(response);
    });
  });
}

// Resolves true if a connection to the service can be opened before the
// deadline, false otherwise. No RPC is sent: it only checks the connection.
export function isReachable(client, timeoutMs) {
  return new Promise((resolve) => {
    client.waitForReady(Date.now() + timeoutMs, (err) => resolve(!err));
  });
}
