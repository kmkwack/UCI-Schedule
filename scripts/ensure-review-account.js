// ─────────────────────────────────────────────────────────────────────────────
// Review Account Bootstrap
// Creates or updates a Supabase Auth email/password account that can be used
// from the in-app "Review access" sign-in box. This lets us test newly added
// schools without owning that school's email domain.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... REVIEW_PASSWORD='...' node scripts/ensure-review-account.js
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... REVIEW_EMAIL='qa@classmate.app' REVIEW_PASSWORD='...' node scripts/ensure-review-account.js
//
// AFTER RUNNING:
//   1. Open the app.
//   2. Select any supported university.
//   3. Tap "Sign in instead".
//   4. Use the review email/password in "Review access".
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REVIEW_EMAIL = process.env.REVIEW_EMAIL || 'review@classmate.app';
const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !REVIEW_PASSWORD) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, or REVIEW_PASSWORD environment variable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAuthUser() {
  const existing = await findUserByEmail(REVIEW_EMAIL);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email: REVIEW_EMAIL,
      password: REVIEW_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        classmate_signup_started: true,
        classmate_school: existing.user_metadata?.classmate_school || 'UC Irvine',
        classmate_review_account: true,
      },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: REVIEW_EMAIL,
    password: REVIEW_PASSWORD,
    email_confirm: true,
    user_metadata: {
      classmate_signup_started: true,
      classmate_school: 'UC Irvine',
      classmate_review_account: true,
    },
  });
  if (error) throw error;
  return data.user;
}

async function ensureProfile(user) {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: REVIEW_EMAIL,
    name: 'ClassMate Review',
    major: 'Undeclared',
    year: 'Reviewer',
    school: user.user_metadata?.classmate_school || 'UC Irvine',
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function main() {
  const user = await ensureAuthUser();
  await ensureProfile(user);

  console.log(`Review account ready: ${REVIEW_EMAIL}`);
  console.log('Use this account from Sign In → Review access after selecting the school you want to test.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
