import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const home = process.env.HOME;
const tok = fs.existsSync(home + '/.supabase/access-token')
  ? fs.readFileSync(home + '/.supabase/access-token','utf8').trim() : env.SUPABASE_ACCESS_TOKEN;
export async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    { method:'POST', headers:{ Authorization:'Bearer '+tok, 'Content-Type':'application/json' },
      body: JSON.stringify({ query: sql }) });
  const t = await r.text();
  if (!r.ok) throw new Error('SQL '+r.status+' '+t.slice(0,300));
  return JSON.parse(t);
}
