import { BusinessError, close, ServiceError } from '@grpc-inventory/bo';
import * as actions from './actions.js';
import { ask, closeTerminal, InputClosed } from './terminal.js';

const MENU = [
  { key: '1', label: 'List products', run: actions.listProducts },
  { key: '2', label: 'Create product', run: actions.createProduct },
  { key: '3', label: 'Restock product', run: actions.restockProduct },
  { key: '4', label: 'Register sale', run: actions.registerSale },
  { key: '5', label: 'List sales', run: actions.listSales },
  { key: '6', label: 'Show report', run: actions.showReport },
  { key: '7', label: 'Export report (CSV)', run: actions.exportReport },
  { key: '8', label: 'Activity history', run: actions.showHistory },
];

function printMenu() {
  console.log('\n=== Inventory ===');
  for (const item of MENU) {
    console.log(`  ${item.key}) ${item.label}`);
  }
  console.log('  0) Exit');
}

// Expected errors are shown to the user and the menu continues.
// Anything else is a bug, so it is thrown and stops the program.
function printError(err) {
  if (err instanceof BusinessError) {
    console.log(`Error: ${err.message}`);
  } else if (err instanceof ServiceError && ['UNAVAILABLE', 'DEADLINE_EXCEEDED'].includes(err.code)) {
    console.log(`Error: ${err.operation} is not available right now (${err.code}). Is the service running?`);
  } else if (err instanceof ServiceError) {
    console.log(`Error: ${err.message}`);
  } else {
    throw err;
  }
}

async function main() {
  while (true) {
    printMenu();
    const choice = await ask('> ');
    if (choice === '0') return;

    const item = MENU.find((option) => option.key === choice);
    if (!item) {
      console.log('Unknown option.');
      continue;
    }

    try {
      await item.run();
    } catch (err) {
      printError(err);
    }
  }
}

try {
  await main();
} catch (err) {
  // Ctrl+C, Ctrl+D or the end of piped input: leave quietly.
  if (!(err instanceof InputClosed)) throw err;
} finally {
  closeTerminal();
  close();
  console.log('\nBye.');
}
