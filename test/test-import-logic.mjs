// Unit tests for the CSV import (src/js/import.js) using a small synthetic
// fixture — no browser, no backend, just the parsing/merging logic. Run
// with `npm run test:import`. See test-function.mjs for the backend-side
// tests and README-testing notes for how these were verified against the
// real ~500-row import before shipping.
import assert from 'assert';
import { parseImportCsv, applyImport } from '../src/js/import.js';

const csv = `Date,Type,Account,To Account,Category,Mode,Description,Amount
2025-04-01,Expense,Primary Account,,Transport,Cash,Bus,24
2025-04-01,Expense,Primary Account,,Transport,Cash,Bus,24
2025-04-05,Income,Savings Account,,,NEFT,Salary,50000
2025-04-06,Transfer,Savings Account,Primary Account,,NEFT,Monthly transfer,10000
2025-04-07,Expense,Primary Account,,NewCategory,Cash,Something new,99
2025-04-08,Expense,,,,Cash,Missing account,50
2025-04-09,Expense,Primary Account,,Food,Cash,Bad amount,notanumber
2025-04-10,Weird,Primary Account,,Food,Cash,Bad type,10
`;

const ud = {
  accounts: [{ id: 'acc_primary', name: 'Primary Account', opening: 0 }, { id: 'acc_savings', name: 'Savings Account', opening: 0 }],
  categories: [{ id: 'cat_food', name: 'Food', budget: 100 }, { id: 'cat_transport', name: 'Transport', budget: 100 }],
  transactions: []
};

const result = parseImportCsv(csv, ud);

assert.strictEqual(result.totalRows, 8, 'totalRows');
assert.strictEqual(result.transactions.length, 5, 'valid rows: two Bus fares + Salary + Transfer + NewCategory expense');
assert.strictEqual(result.rowErrors.length, 3, 'missing account / bad amount / bad type should all error');
console.log('PASS: within-batch identical rows (two ₹24 bus fares same day) both kept, not deduped against each other');

assert.strictEqual(result.newCategories.length, 1);
assert.strictEqual(result.newCategories[0].name, 'NewCategory');
console.log('PASS: unknown category auto-created');

const transfer = result.transactions.find((t) => t.type === 'Transfer');
assert.ok(transfer && transfer.fromAccountId === 'acc_savings' && transfer.toAccountId === 'acc_primary');
console.log('PASS: Transfer row resolves From/To accounts correctly');

const income = result.transactions.find((t) => t.type === 'Income');
assert.strictEqual(income.category, '', 'Income never carries a category, matching the live UI');
console.log('PASS: Income category discarded, matching manual-entry behavior');

const merged = applyImport(ud, result);
assert.strictEqual(merged.transactions.length, 5);
assert.strictEqual(merged.categories.length, 3);
console.log('PASS: applyImport merges transactions + new categories/accounts');

// Re-parsing the same file against the now-merged ledger should catch
// everything as a duplicate, including the two identical bus fares.
const second = parseImportCsv(csv, merged);
assert.strictEqual(second.transactions.length, 0, 'second import should add nothing new');
assert.strictEqual(second.duplicates, 5, 'all 5 previously-imported rows recognized as duplicates');
console.log('PASS: re-importing the same file is a no-op (including the two identical bus fares)');

console.log('\nALL IMPORT LOGIC TESTS PASSED');
