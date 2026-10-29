// Forgot the admin password? Resets it to the default (Selco@2026, or ADMIN_DEFAULT_PASSWORD).
// Works with MongoDB (MONGODB_URI in .env) and with the local file database.
//   npm run admin:reset-password
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile?.(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'));
} catch {
  /* no .env */
}
const { getStore, hashPassword } = await import('../db.js');
const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Selco@2026';
const store = await getStore();
const s = await store.getSettings();
await store.updateSettings({ passwordHash: hashPassword(password), passwordVersion: (s.passwordVersion || 1) + 1, passwordChangedAt: null });
console.log(`Admin password reset (${store.kind === 'mongo' ? 'MongoDB' : 'local file'}). Log in with ID "${s.adminId}" and password "${password}", then change it.`);
process.exit(0);
