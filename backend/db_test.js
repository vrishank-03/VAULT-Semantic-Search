// const { ChromaClient } = require('chromadb');
// const sqlite3 = require('sqlite3').verbose();

// const runDBTest = async () => {
//   let sqliteStatus = 'Disconnected';
//   let chromaStatus = 'Disconnected';

//   // Test SQLite Connection
//   try {
//     const db = new sqlite3.Database(':memory:'); // Use in-memory DB for a quick test
//     await new Promise((resolve, reject) => {
//       db.get("SELECT 1", (err) => {
//         if (err) reject(err);
//         else resolve();
//       });
//     });
//     db.close();
//     sqliteStatus = 'Connected';
//   } catch (e) {
//     sqliteStatus = `Error: ${e.message}`;
//   }

//   // Test ChromaDB Connection
//   try {
//     const client = new ChromaClient({ path: "http://localhost:8000" });
//     await client.heartbeat(); // This function checks if the server is alive
//     chromaStatus = 'Connected';
//   } catch (e) {
//     chromaStatus = `Error: ${e.message}`;
//   }

//   return { sqlite: sqliteStatus, chroma: chromaStatus };
// };

// module.exports = { runDBTest };

const { getDb, initializeDatabase } = require('./database');
const bcrypt = require('bcryptjs');

/*
================================================================================
THIS IS A ONE-TIME SETUP SCRIPT to unblock development.
It bypasses the normal approval flow to create a confirmed product
and an active Admin user.

RUN THIS ONCE by opening your backend terminal and typing:
node -e "require('./db_test.js').runSetup()"
================================================================================
*/

const runSetup = async () => {
    console.log('[SETUP_SCRIPT] Connecting to database...');
    try {
        await initializeDatabase();
        const db = getDb();

        // 1. --- Create and Confirm a Product ---
        const productName = "Main Product";
        const ownerName = "CTO";
        const ownerEmail = "cto@company.com";
        const productStatus = "confirmed"; // <-- Manually confirm it

        const productSql = `
            INSERT INTO products (product_name, product_owner_name, product_owner_email, status) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(product_name) DO UPDATE SET
                product_owner_name = excluded.product_owner_name,
                product_owner_email = excluded.product_owner_email,
                status = excluded.status
        `;
        
        const productResult = await new Promise((resolve, reject) => {
            db.run(productSql, [productName, ownerName, ownerEmail, productStatus], function(err) {
                if (err) return reject(err);
                // Get the ID of the inserted or updated product
                db.get(`SELECT id FROM products WHERE product_name = ?`, [productName], (err, row) => {
                    if (err) return reject(err);
                    resolve(row.id);
                });
            });
        });

        const productId = productResult;
        console.log(`[SETUP_SCRIPT] SUCCESS: Product "${productName}" (ID: ${productId}) is 'confirmed'.`);


        // 2. --- Create and Activate an Admin User ---
        const adminEmail = "admin@vault.com";
        const adminPass = "Password123!";
        const adminRole = "Administrator";
        const adminStatus = "active"; // <-- Manually activate them
        const isVerified = 1; // <-- Manually verify their email

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(adminPass, salt);

        const userSql = `
            INSERT INTO users (email, password_hash, is_email_verified, role, status, product_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                password_hash = excluded.password_hash,
                is_email_verified = excluded.is_email_verified,
                role = excluded.role,
                status = excluded.status,
                product_id = excluded.product_id
        `;
        
        await new Promise((resolve, reject) => {
            db.run(userSql, [adminEmail, password_hash, isVerified, adminRole, adminStatus, productId], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        console.log(`[SETUP_SCRIPT] SUCCESS: Admin user "${adminEmail}" is 'active'.`);
        console.log("================================================================");
        console.log("🚀 SETUP COMPLETE 🚀");
        console.log("You can now log in with:");
        console.log(`   Email: admin@vault.com`);
        console.log(`   Pass:  Password123!`);
        console.log("================================================================");

    } catch (e) {
        console.error('[SETUP_SCRIPT_ERROR] Setup failed:', e.message);
    } finally {
        const db = getDb();
        if (db) {
            db.close((err) => {
                if (err) console.error(err.message);
                console.log('[SETUP_SCRIPT] Database connection closed.');
            });
        }
    }
};

module.exports = { runSetup };