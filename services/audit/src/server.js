import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { closeDb, DB_PATH, insertEvent, listEvents } from './db.js';

const PROTO_PATH = join(import.meta.dirname, '..', '..', '..', 'protos', 'audit.proto');
const PORT = process.env.AUDIT_PORT ?? '50052';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
});
const { AuditService } = grpc.loadPackageDefinition(definition).inventory.audit;

function log(call, callback) {
  const event = call.request;

  if (!event.entity || !event.action) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: 'entity and action are required',
    });
  }

  try {
    const ack = insertEvent(event);
    console.log(`[audit] #${ack.id} ${event.entity}:${event.entity_id} ${event.action}`);
    callback(null, ack);
  } catch (err) {
    // The client only learns that it failed, not the database internals.
    console.error(`[audit] insert failed: ${err.message}`);
    callback({ code: grpc.status.INTERNAL, details: 'could not save event' });
  }
}

function list(call, callback) {
  const { entity, limit } = call.request;
  // limit 0 means "not sent" (proto3 default), so use the default limit.
  const safeLimit = Math.min(limit > 0 ? limit : DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const events = listEvents(entity, safeLimit);
    console.log(`[audit] List entity="${entity || '*'}" -> ${events.length} events`);
    callback(null, { events });
  } catch (err) {
    console.error(`[audit] list failed: ${err.message}`);
    callback({ code: grpc.status.INTERNAL, details: 'could not read events' });
  }
}

const server = new grpc.Server();
server.addService(AuditService.service, { Log: log, List: list });

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error(`[audit] could not start: ${err.message}`);
    process.exit(1);
  }
  console.log(`[audit] listening on 0.0.0.0:${port}`);
  console.log(`[audit] database: ${DB_PATH}`);
});

// Ctrl+C: stop accepting calls, let pending ones finish, then close the database.
process.on('SIGINT', () => {
  console.log('[audit] shutting down...');
  server.tryShutdown(() => {
    closeDb();
    process.exit(0);
  });
});
