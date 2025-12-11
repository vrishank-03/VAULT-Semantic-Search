// backend/reset_db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'postgres',
    password: process.env.PG_PASSWORD || 'root',
    port: process.env.PG_PORT || 5432,
});

async function wipeDatabase() {
    const client = await pool.connect();
    try {
        console.log('⚠️  WARNING: INITIATING FULL DATABASE WIPE ⚠️');
        console.log('🔴 Dropping schema "public"...');

        // This command deletes EVERYTHING in the public schema
        await client.query('DROP SCHEMA public CASCADE;');

        console.log('🟢 Recreating schema "public"...');
        await client.query('CREATE SCHEMA public;');

        // Restore default permissions so your user can access it
        await client.query('GRANT ALL ON SCHEMA public TO public;');

        // Restore necessary extensions immediately
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

        console.log('✅ DATABASE CLEARED SUCCESSFULLY.');
        console.log('You can now run "npm run dev" to rebuild the tables.');

    } catch (err) {
        console.error('❌ ERROR WIPING DATABASE:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

wipeDatabase();