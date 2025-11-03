// This file stores critical credentials and contact information for the RBAC system.
// DO NOT commit sensitive passwords to this file. Use .env for secrets.
// This file is for non-sensitive but critical identifiers, like role emails.

console.log('[LOG] Loading credentials.js...');

const credentials = {
    // The email address of the Chief Technology Officer (CTO) for receiving
    // product-level approval requests.
    CTO_EMAIL: 'vrishankvmistry@gmail.com', // <-- *** COMPANIES/CLIENTS WILL UPDATE THIS EMAIL ***
};

console.log(`[LOG] CTO Email set to: ${credentials.CTO_EMAIL}`);

module.exports = credentials;