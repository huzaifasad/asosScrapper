import 'dotenv/config';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL, // your Postgres connection string
});

await client.connect();
await client.query(`NOTIFY pgrst, 'reload schema'`);
await client.end();

console.log("✅ Schema cache reloaded");
