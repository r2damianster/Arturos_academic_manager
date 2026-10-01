// Credenciales de PRODUCCIÓN desde .env.local. NUNCA hardcodear llaves en scripts.
// Aborta si .env.local no apunta al proyecto de producción (hxsnyrutyyavvljxwgku).
const { url, serviceKey } = require('./_supabase-env');

const PROD_PROJECT_REF = 'hxsnyrutyyavvljxwgku';
if (!url.includes(PROD_PROJECT_REF)) {
  throw new Error(`.env.local apunta a ${url}, no a producción (${PROD_PROJECT_REF}). Abortado.`);
}

module.exports = { url, serviceKey, host: url.replace(/^https?:\/\//, '') };
