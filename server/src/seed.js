/* CLI entry: `npm run seed` (append `-- --force` to wipe and reseed). */
process.env.LOG_LEVEL ??= 'warn'; // keep CLI output human-readable
const { closeDb, initDb } = await import('./db/connection.js');
const { seedDemoData } = await import('./services/seed.service.js');

const force = process.argv.includes('--force');
initDb();
try {
  const result = seedDemoData({ force });
  console.log('Demo data loaded:');
  for (const g of result.groups) console.log(`  group  ${g.name}  (${g.id})`);
  for (const u of result.users) console.log(`  user   ${u.name}  (${u.id})`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  closeDb();
}
