import { closeDb } from './db.js';
import { closeClients } from './remote.js';

// Public API of the business objects library.
export { BusinessError } from './errors.js';
export { Product } from './product.js';
export { Sale } from './sale.js';

// Re-exported so the backend can recognize service failures
// without depending on the clients library directly.
export { ServiceError } from '@grpc-inventory/clients';

// Closes the database and the connections to the microservices.
export function close() {
  closeClients();
  closeDb();
}
