// ─────────────────────────────────────────────────────────────────────────────
// Push Announcement Sender
// Sends a one-off Expo push announcement to users who enabled push notifications.
//
// Dry-run by default:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/send-push-announcement.js \
//     --title "Canvas assignment sync update" \
//     --body "Canvas/Instructure is investigating a security incident. ClassMate assignment sync may be delayed, so please check Canvas directly for the latest deadlines."
//
// Actual send:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/send-push-announcement.js --send \
//     --title "Canvas assignment sync update" \
//     --body "Canvas/Instructure is investigating a security incident. ClassMate assignment sync may be delayed, so please check Canvas directly for the latest deadlines."
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PAGE_SIZE = 1000;
const PUSH_BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY.');
}

const args = parseArgs(process.argv.slice(2));
if (!args.title || !args.body) {
  throw new Error('Usage: node scripts/send-push-announcement.js [--send] --title "..." --body "..."');
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

function parseArgs(argv) {
  const parsed = {
    send: false,
    title: '',
    body: '',
    dataType: 'announcement',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--send') {
      parsed.send = true;
    } else if (arg === '--title' && next) {
      parsed.title = next;
      i += 1;
    } else if (arg === '--body' && next) {
      parsed.body = next;
      i += 1;
    } else if (arg === '--type' && next) {
      parsed.dataType = next;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/send-push-announcement.js [--send] --title "..." --body "..."

Options:
  --send           Actually send pushes. Without this flag, the script only counts recipients.
  --title "..."    Push title.
  --body "..."     Push body.
  --type "..."     Optional data.type payload. Defaults to "announcement".
`);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isExpoPushToken(value) {
  return typeof value === 'string' && value.startsWith('ExponentPushToken[');
}

async function fetchRows(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseHeaders,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase query failed for ${path}: ${errorText}`);
  }
  return response.json();
}

async function updateRow(path, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase update failed for ${path}: ${errorText}`);
  }
}

async function fetchRecipients() {
  const recipients = [];
  let from = 0;

  while (true) {
    const rows = await fetchRows(
      `user_settings?select=user_id,expo_push_token,notification_settings&expo_push_token=not.is.null&offset=${from}&limit=${PAGE_SIZE}`
    );
    rows.forEach((row) => {
      if (
        isExpoPushToken(row.expo_push_token)
        && row.notification_settings?.pushNotifications === true
      ) {
        recipients.push({
          userId: row.user_id,
          token: row.expo_push_token,
        });
      }
    });
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return recipients;
}

async function sendBatch(batch) {
  const messages = batch.map((recipient) => ({
    to: recipient.token,
    title: args.title,
    body: args.body,
    sound: 'default',
    data: {
      type: args.dataType,
      sentAt: new Date().toISOString(),
    },
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo push failed: ${errorText}`);
  }

  const result = await response.json();
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const invalidUsers = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.details?.error === 'DeviceNotRegistered') {
      invalidUsers.push(batch[index].userId);
    }
  });

  await Promise.all(invalidUsers.map((userId) =>
    updateRow(`user_settings?user_id=eq.${encodeURIComponent(userId)}`, { expo_push_token: null })
  ));

  return {
    attempted: batch.length,
    invalid: invalidUsers.length,
  };
}

async function main() {
  const recipients = await fetchRecipients();
  console.log(`Recipients with push enabled: ${recipients.length}`);
  console.log(`Title: ${args.title}`);
  console.log(`Body: ${args.body}`);

  if (!args.send) {
    console.log('\nDry-run only. Add --send to actually deliver this announcement.');
    return;
  }

  let attempted = 0;
  let invalid = 0;
  for (const batch of chunk(recipients, PUSH_BATCH_SIZE)) {
    const result = await sendBatch(batch);
    attempted += result.attempted;
    invalid += result.invalid;
    console.log(`Sent batch: ${result.attempted} attempted, ${result.invalid} invalid tokens`);
  }

  console.log(`\nDone. ${attempted} push messages attempted. ${invalid} invalid tokens cleared.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
