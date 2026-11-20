require('dotenv').config();
const {createDatabase} = require('../src/db');
const {migrate} = require('../src/db/migrate');
async function main() {
 if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
 const db=createDatabase(process.env.DATABASE_URL);
 try {await migrate(db); console.log('Migrations applied.');} finally {await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
