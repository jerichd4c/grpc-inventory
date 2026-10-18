import { ServiceError } from '@grpc-inventory/clients';
import { auditClient, reportClient } from './remote.js';

// The "common factor" of the class diagram: reporting and auditing are
// written once here, and every business object inherits them.
// A subclass only describes itself: its entity name, its report columns
// and how to turn one of its items into a report row.
export class BusinessObject {
  static entity = 'object';
  static reportTitle = 'Report';
  static reportColumns = [];

  static findAll() {
    throw new Error(`${this.name}.findAll() is not implemented`);
  }

  static toRow(item) {
    throw new Error(`${this.name}.toRow() is not implemented`);
  }

  // Inside a static method, "this" is the class that was called:
  // Product.report() uses Product's columns, Sale.report() uses Sale's.
  static async report(format = 'text') {
    const rows = this.findAll().map((item) => this.toRow(item));
    return reportClient.generate({
      title: this.reportTitle,
      columns: this.reportColumns,
      rows,
      format,
    });
  }

  static async history(limit = 10) {
    return auditClient.list({ entity: this.entity, limit });
  }

  // Best effort: the local change is already saved, so a down audit service
  // must not undo it. The failure is reported as a warning, not thrown.
  static async audit(action, entityId, detail) {
    try {
      await auditClient.log({ entity: this.entity, entityId, action, detail });
    } catch (err) {
      if (!(err instanceof ServiceError)) throw err;
      console.warn(`[bo] warning: ${this.entity}:${entityId} ${action} was not audited (${err.code})`);
    }
  }
}
