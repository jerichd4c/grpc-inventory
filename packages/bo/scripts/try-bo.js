// Manual test of the business objects library.
// It uses an in-memory database, so every run starts empty and the real
// inventory.db is never touched. The env variable must be set BEFORE the
// library loads, which is why it is imported with await import(...).
process.env.INVENTORY_DB_PATH ??= ':memory:';
const { BusinessError, close, Product, Sale } = await import('@grpc-inventory/bo');

// Runs an action that must break a business rule and prints the error.
async function expectBusinessError(label, action) {
  try {
    await action();
    console.log(`  ${label} -> no error (unexpected!)`);
  } catch (err) {
    if (!(err instanceof BusinessError)) throw err;
    console.log(`  ${label} -> ${err.code}: ${err.message}`);
  }
}

try {
  const keyboard = await Product.create({ name: 'Keyboard', price: 25, stock: 10 });
  const mouse = await Product.create({ name: 'Mouse, wireless', price: 15.5, stock: 3 });
  console.log(`Created products #${keyboard.id} and #${mouse.id}`);

  const sale = await Sale.create({ productId: keyboard.id, quantity: 3 });
  console.log(`Sale #${sale.id}: ${sale.product_name} x${sale.quantity} = ${sale.total.toFixed(2)}`);

  const restocked = await Product.restock(mouse.id, 5);
  console.log(`Restocked ${restocked.name}: stock ${restocked.stock}`);

  console.log('\nBusiness rules:');
  await expectBusinessError('invalid price   ', () => Product.create({ name: 'Cable', price: -1 }));
  await expectBusinessError('duplicate name  ', () => Product.create({ name: 'Keyboard', price: 30 }));
  await expectBusinessError('not enough stock', () => Sale.create({ productId: keyboard.id, quantity: 100 }));
  await expectBusinessError('unknown product ', () => Sale.create({ productId: 999, quantity: 1 }));

  // The failed sales did not touch the stock: 10 - 3 = 7.
  console.log(`\nKeyboard stock after the failed sales: ${Product.findById(keyboard.id).stock}`);

  const productReport = await Product.report();
  console.log(`\n${productReport.content}`);

  const salesReport = await Sale.report('csv');
  console.log(`\n${salesReport.content}`);

  console.log('\nLatest product events (from the audit service):');
  for (const event of await Product.history(4)) {
    console.log(`  #${event.id} product:${event.entityId} ${event.action} - ${event.detail}`);
  }
} catch (err) {
  console.error(`Unexpected error -> ${err.message}`);
  process.exitCode = 1;
} finally {
  close();
}
