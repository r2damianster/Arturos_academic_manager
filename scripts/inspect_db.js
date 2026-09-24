const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const envFile = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const combined = envLocal + '\n' + envFile;

const urls = ['https://vylkasmcveazzaspwgcr.supabase.co', 'https://hxsnyrutyyavvljxwgku.supabase.co'];
const keys = Array.from(new Set(combined.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g) || []));

async function testAll() {
  for (const u of urls) {
    for (const [i, k] of keys.entries()) {
      const client = createClient(u, k);
      const { data, error } = await client.from('cursos').select('*').limit(1);
      console.log(`URL: ${u} | Key #${i}:`, error ? `ERROR: ${error.message} (${error.code})` : `OK! Found ${data.length} rows`);
    }
  }
}

testAll().catch(console.error);

