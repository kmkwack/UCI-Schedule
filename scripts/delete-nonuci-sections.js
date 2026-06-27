// Batched delete of non–UC Irvine sections, to avoid the Supabase SQL editor's
// ~2-minute gateway timeout on the 1.5GB `sections` table.
//
// Usage (same env vars as the seed scripts):
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/delete-nonuci-sections.js
//
// Safe: only deletes rows where school <> 'UC Irvine'. UCI rows are never touched.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY env var.');
}

const KEEP = 'UC Irvine';
const BATCH = 2000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  let total = 0;
  for (;;) {
    // grab a batch of ids to delete
    const { data, error } = await supabase
      .from('sections')
      .select('id')
      .neq('school', KEEP)
      .limit(BATCH);
    if (error) throw new Error(`select failed: ${error.message}`);
    if (!data || data.length === 0) break;

    const ids = data.map((r) => r.id);
    const { error: delError } = await supabase.from('sections').delete().in('id', ids);
    if (delError) throw new Error(`delete failed: ${delError.message}`);

    total += ids.length;
    process.stdout.write(`\rDeleted ${total} non-UCI sections...`);
  }
  console.log(`\nDone. Removed ${total} non-UCI section rows. UCI sections untouched.`);
  console.log('Tip: run `vacuum sections;` in the SQL editor to reclaim space (or let autovacuum handle it).');
}

main().catch((e) => {
  console.error('\nError:', e.message);
  process.exit(1);
});
