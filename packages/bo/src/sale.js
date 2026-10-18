import { BusinessObject } from './business-object.js';
import { db, transaction } from './db.js';
import { BusinessError } from './errors.js';
import { Product } from './product.js';

const insertStmt = db.prepare(`
  INSERT INTO sales (product_id, quantity, unit_price, total, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const removeStockStmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

// JOIN brings the product name along with each sale.
const SELECT_SALES = `
  SELECT sales.*, products.name AS product_name
  FROM sales JOIN products ON products.id = sales.product_id
`;
const findAllStmt = db.prepare(`${SELECT_SALES} ORDER BY sales.id`);
const findByIdStmt = db.prepare(`${SELECT_SALES} WHERE sales.id = ?`);

export class Sale extends BusinessObject {
  static entity = 'sale';
  static reportTitle = 'Sales';
  static reportColumns = ['ID', 'Date', 'Product', 'Qty', 'Unit price', 'Total'];

  static async create({ productId, quantity }) {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BusinessError('INVALID_INPUT', 'quantity must be a whole number greater than 0');
    }

    // Checking the stock, lowering it and saving the sale are one unit of work:
    // if any step fails, nothing is saved.
    const sale = transaction(() => {
      const product = Product.findById(productId);
      if (product.stock < amount) {
        throw new BusinessError(
          'INSUFFICIENT_STOCK',
          `only ${product.stock} unit(s) of "${product.name}" left, asked for ${amount}`,
        );
      }

      // The unit price is copied into the sale, so a later price change
      // does not rewrite the history of past sales.
      const total = Math.round(product.price * amount * 100) / 100;
      removeStockStmt.run(amount, product.id);
      const result = insertStmt.run(product.id, amount, product.price, total, new Date().toISOString());
      return this.findById(Number(result.lastInsertRowid));
    });

    await this.audit('create', sale.id, `${sale.product_name} x${sale.quantity} = ${sale.total.toFixed(2)}`);
    await Product.audit('sell', sale.product_id, `stock -${sale.quantity} (sale ${sale.id})`);
    return sale;
  }

  static findAll() {
    return findAllStmt.all();
  }

  static findById(id) {
    const sale = findByIdStmt.get(Number(id));
    if (!sale) {
      throw new BusinessError('NOT_FOUND', `sale ${id} does not exist`);
    }
    return sale;
  }

  static toRow(sale) {
    return [
      sale.id,
      sale.created_at.slice(0, 16).replace('T', ' '),
      sale.product_name,
      sale.quantity,
      sale.unit_price.toFixed(2),
      sale.total.toFixed(2),
    ];
  }
}
