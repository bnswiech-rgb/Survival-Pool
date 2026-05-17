import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../supabase/schema.sql'), 'utf8');

const PAT = process.env.SUPABASE_PAT;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qciigixpgfoxkeglesax';

console.log('Running schema...');

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const data = await res.json();

if (data.error || data.message) {
  console.error('Error:', data.error || data.message);
  process.exit(1);
} else {
  console.log('✅ Schema applied successfully!');
  console.log(JSON.stringify(data).substring(0, 200));
}
