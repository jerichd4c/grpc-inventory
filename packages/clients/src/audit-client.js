import { callUnary, createGrpcClient, isReachable } from './grpc-helpers.js';

export class AuditClient {
  constructor({
    address = process.env.AUDIT_ADDRESS ?? 'localhost:50052',
    timeoutMs = 3000,
  } = {}) {
    this.client = createGrpcClient('audit.proto', 'inventory.audit.AuditService', address);
    this.timeoutMs = timeoutMs;
  }

  // Returns { id, timestamp } of the stored event.
  async log({ entity, entityId, action, detail = '' }) {
    const request = {
      entity,
      entity_id: String(entityId),
      action,
      detail,
    };
    return callUnary(this.client, 'audit.Log', 'Log', request, this.timeoutMs);
  }

  // Both filters are optional: list() returns the latest events of any entity.
  async list({ entity = '', limit = 0 } = {}) {
    const response = await callUnary(this.client, 'audit.List', 'List', { entity, limit }, this.timeoutMs);
    return response.events.map((event) => ({
      id: event.id,
      entity: event.entity,
      entityId: event.entity_id,
      action: event.action,
      detail: event.detail,
      timestamp: event.timestamp,
    }));
  }

  // True if the service accepts connections right now.
  isAvailable(timeoutMs = 1500) {
    return isReachable(this.client, timeoutMs);
  }

  close() {
    this.client.close();
  }
}
