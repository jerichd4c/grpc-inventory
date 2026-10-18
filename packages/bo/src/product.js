import { BusinessObject } from './business-object.js';
import { db } from './db.js';
import { BusinessError } from './errors.js';

const insertStmt = db.prepare(`
  INSERT INTO products (name, price, stock, created_at) VALUES (?, ?, ?, ?)
`);
const findAllStmt = db.prepare('SELECT * FROM products ORDER BY id');
const findByIdStmt = db.prepare('SELECT * FROM products WHERE id = ?');
const findByNameStmt = db.prepare('SELECT * FROM products WHERE name = ?');
const addStockStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');

export class Product extends BusinessObject {
  static entity = 'product';
  static reportTitle = 'Products';
  static reportColumns = ['ID', 'Name', 'Price', 'Stock'];

  static async create({ name, price, stock = 0 }) {
    const cleanName = String(name ?? '').trim();
    const cleanPrice = Number(price);
    const cleanStock = Number(stock);

    if (!cleanName) {
      throw new BusinessError('INVALID_INPUT', 'name is required');
    }
    if (!(cleanPrice > 0)) {
      throw new BusinessError('INVALID_INPUT', 'price must be a number greater than 0');
    }
    if (!Number.isInteger(cleanStock) || cleanStock < 0) {
      throw new BusinessError('INVALID_INPUT', 'stock must be a whole number, 0 or more');
    }
    if (findByNameStmt.get(cleanName)) {
      throw new BusinessError('DUPLICATE', `a product named "${cleanName}" already exists`);
    }

    const result = insertStmt.run(cleanName, cleanPrice, cleanStock, new Date().toISOString());
    const product = this.findById(Number(result.lastInsertRowid));

    await this.audit('create', product.id, `${product.name}, price ${product.price}, stock ${product.stock}`);
    return product;
  }

  static async restock(id, quantity) {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BusinessError('INVALID_INPUT', 'quantity must be a whole number greater than 0');
    }

    const before = this.findById(id);
    addStockStmt.run(amount, before.id);
    const product = this.findById(before.id);

    await this.audit('restock', product.id, `stock ${before.stock} -> ${product.stock}`);
    return product;
  }

  static findAll() {
    return findAllStmt.all();
  }

  static findById(id) {
    const product = findByIdStmt.get(Number(id));
    if (!product) {
      throw new BusinessError('NOT_FOUND', `product ${id} does not exist`);
    }
    return product;
  }

  static toRow(product) {
    return [product.id, product.name, product.price.toFixed(2), product.stock];
  }
}
