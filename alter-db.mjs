import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vylkasmcveazzaspwgcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bGthc21jdmVhenphc3B3Z2NyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3OTA0NCwiZXhwIjoyMDkwNDU1MDQ0fQ.vFofTZhXGHOx32IC1ptzjQLaIHoi7Y246RL0o043eeI',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase.rpc('execute_sql_v2', {
    sql_query: "ALTER TABLE trabajos_asignados ADD COLUMN IF NOT EXISTS urgente BOOLEAN DEFAULT false; NOTIFY pgrst, 'reload schema';"
  });
  if (error) {
    // If execute_sql_v2 doesn't exist, we fallback
    console.error("RPC failed, we might need manual SQL:", error);
  } else {
    console.log("Success:", data);
  }
}
main();
