// Carga credenciales de Supabase desde .env.local / .env. NUNCA hardcodear llaves en scripts.
// Uso: const { url, serviceKey, anonKey } = require('./_supabase-env');
const fs = require('fs');
const path = require('path');

for (const fileName of ['.env.local', '.env']) {
  const envPath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length && !process.env[key.trim()]) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local');
}

module.exports = { url, serviceKey, anonKey };
