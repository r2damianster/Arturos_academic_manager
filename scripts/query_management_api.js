const fs = require('fs');

function loadEnv() {
  const env = fs.readFileSync('.env', 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
}
loadEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN;
console.log("SUPABASE_ACCESS_TOKEN:", token ? token.substring(0, 10) + "..." : "NONE");

async function main() {
  const res = await fetch('https://api.supabase.com/v1/projects', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log("Projects:", JSON.stringify(data, null, 2));

  if (Array.isArray(data)) {
    for (const proj of data) {
      console.log(`\nChecking keys for project ${proj.id} (${proj.name}):`);
      const keyRes = await fetch(`https://api.supabase.com/v1/projects/${proj.id}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const keys = await keyRes.json();
      console.log("Keys:", JSON.stringify(keys, null, 2));
    }
  }
}

main().catch(console.error);

