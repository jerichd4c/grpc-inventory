import { AuditClient, ReportClient } from '@grpc-inventory/clients';

// One client per microservice, shared by every business object.
// They connect lazily, on the first call.
export const reportClient = new ReportClient();
export const auditClient = new AuditClient();

// Checks both services at the same time, so it takes as long as the slowest.
export async function checkServices() {
  const [report, audit] = await Promise.all([
    reportClient.isAvailable(),
    auditClient.isAvailable(),
  ]);
  return { report, audit };
}

export function closeClients() {
  reportClient.close();
  auditClient.close();
}
