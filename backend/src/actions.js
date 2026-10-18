// One function per menu option. They only ask for input, call the business
// objects and print the result: no SQL and no gRPC in this file.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkServices, Product, Sale } from '@grpc-inventory/bo';
import { ask } from './terminal.js';

const EXPORTS_DIR = join(import.meta.dirname, '..', 'exports');

// Returns the Product or Sale class, so reports and history work the same
// way for both: that is the common factor paying off.
async function askEntity() {
  const answer = (await ask('Products or sales? [p/s]: ')).toLowerCase();
  if (answer === 'p') return Product;
  if (answer === 's') return Sale;
  console.log('Please answer "p" or "s".');
  return null;
}

export async function listProducts() {
  const products = Product.findAll();
  if (products.length === 0) {
    console.log('No products yet.');
    return;
  }
  for (const p of products) {
    console.log(`  #${p.id}  ${p.name.padEnd(20)} ${p.price.toFixed(2).padStart(9)}  stock ${p.stock}`);
  }
}

export async function createProduct() {
  const name = await ask('Name: ');
  const price = await ask('Price: ');
  const stock = await ask('Initial stock: ');

  const product = await Product.create({ name, price, stock });
  console.log(`Created product #${product.id} (${product.name}).`);
}

export async function restockProduct() {
  const id = await ask('Product ID: ');
  const quantity = await ask('Units to add: ');

  const product = await Product.restock(id, quantity);
  console.log(`${product.name} now has ${product.stock} unit(s).`);
}

export async function registerSale() {
  const productId = await ask('Product ID: ');
  const quantity = await ask('Quantity: ');

  const sale = await Sale.create({ productId, quantity });
  console.log(`Sale #${sale.id}: ${sale.product_name} x${sale.quantity} = ${sale.total.toFixed(2)}`);
}

export async function listSales() {
  const sales = Sale.findAll();
  if (sales.length === 0) {
    console.log('No sales yet.');
    return;
  }
  for (const s of sales) {
    console.log(`  #${s.id}  ${s.product_name.padEnd(20)} x${String(s.quantity).padEnd(4)} ${s.total.toFixed(2).padStart(9)}`);
  }
}

export async function showReport() {
  const Entity = await askEntity();
  if (!Entity) return;

  const report = await Entity.report('text');
  console.log(`\n${report.content}`);
}

export async function exportReport() {
  const Entity = await askEntity();
  if (!Entity) return;

  const report = await Entity.report('csv');

  // Windows does not allow ":" in file names, so the time uses "-".
  const stamp = report.generatedAt.slice(0, 19).replaceAll(':', '-');
  const file = join(EXPORTS_DIR, `${Entity.entity}s-${stamp}.csv`);

  await mkdir(EXPORTS_DIR, { recursive: true });
  await writeFile(file, `${report.content}\n`);
  console.log(`Saved ${report.rowCount} row(s) to ${file}`);
}

export async function showHistory() {
  const Entity = await askEntity();
  if (!Entity) return;

  const events = await Entity.history(10);
  if (events.length === 0) {
    console.log('No activity yet.');
    return;
  }
  for (const e of events) {
    const time = e.timestamp.slice(0, 19).replace('T', ' ');
    console.log(`  ${time}  ${e.entity}:${e.entityId}  ${e.action.padEnd(8)} ${e.detail}`);
  }
}

export async function showServiceStatus() {
  const status = await checkServices();
  const label = (online) => (online ? 'online' : 'OFFLINE');
  console.log(`Services: report ${label(status.report)}, audit ${label(status.audit)}`);
}
