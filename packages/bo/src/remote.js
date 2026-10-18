import { AuditClient, ReportClient } from '@grpc-inventory/clients';

// One client per microservice, shared by every business object.
// They connect lazily, on the first call.
export const reportClient = new ReportClient();
export const auditClient = new AuditClient();

export function closeClients() {
  reportClient.close();
  auditClient.close();
}
