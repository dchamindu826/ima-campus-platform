// The ONE Prisma client for the whole backend.
//
// Every `new PrismaClient()` opens its own connection pool. The old code created
// 80+ of them (some on every request), which exhausts MySQL connections and causes
// random "Too many connections" / slow-CRM errors. Always import this instead:
//
//   const prisma = require('../src/core/db');        // from controllers/ routes/ services/
//   const prisma = require('../../core/db');         // from src/modules/<name>/
//
// Never call prisma.$disconnect() in request or job code: it is shared.

// Reuse across hot-reloads / repeated requires (tests can also put a fake client here).
const prisma = globalThis.__imaPrisma || new (require('@prisma/client').PrismaClient)();
globalThis.__imaPrisma = prisma;

// Kept for old code that reads `global.prisma`.
global.prisma = prisma;

module.exports = prisma;
