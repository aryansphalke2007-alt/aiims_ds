import { initDb, seedInitialData } from './database.js';

console.log('[Seed] Initializing database schema...');
initDb();
console.log('[Seed] Seeding 10 Indian emergency patients and 3 AIIMS emergency physicians into SQLite...');
seedInitialData();
console.log('[Seed] Database successfully populated!');
process.exit(0);
