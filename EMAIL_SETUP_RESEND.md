# Email Setup — Resend + Supabase (UNFINISHED — resume here)

> **Why this exists:** Supabase's built-in email service is capped at ~2 emails/hour
> for the whole app ("email rate limit exceeded"). Since all auth (signup codes,
> password-reset codes) is delivered by email, a custom SMTP provider is
> **required before real users can sign up**. We chose Resend.
>
> ⚠️ **Strongly recommended: finish this BEFORE submitting build 62 to App Review.**
> Reviewers sometimes test "create account" with their own email; if the 2/hour cap
> blocks the code email, that's another Guideline 2.1(a) rejection.

---

## Status (as of 2026-08-06)

- [x] Resend account created (free plan: 3,000 emails/month, 100/day)
- [x] Domain added in Resend: **`theseans.app`** (NOT classmate.app — we don't own
      that domain; it's someone else's and listed for sale. The review account was
      switched to `review@theseans.app` for the same reason — see
      `supabase/sql/update_review_account_2026-08-06.sql`.)
- [ ] **STEP 1 — Add 4 DNS records at Porkbun** ← resume here
- [ ] STEP 2 — Verify domain in Resend
- [ ] STEP 3 — Create Resend API key
- [ ] STEP 4 — Enter SMTP settings in Supabase
- [ ] STEP 5 — Raise Supabase auth rate limits
- [ ] STEP 6 — Send a test email end-to-end

---

## STEP 1 — DNS records at Porkbun

`theseans.app` is registered at **Porkbun** (nameservers `*.ns.porkbun.com` —
verified via dig). The website on it is hosted on Netlify; **do not delete any
existing records**, only add.

Login needed: the Porkbun account that owns `theseans.app` (coworker's, most likely).

Go to **porkbun.com → log in → Domain Management → theseans.app → DNS Records** and
add these four records. Porkbun auto-appends `.theseans.app` to the Host field, so
enter only the prefix shown. Copy the full Content values from the Resend domain
page (resend.com → Domains → theseans.app) — the values below are truncated:

| Type | Host (prefix only) | Content / Answer | Priority | TTL |
|------|--------------------|------------------|----------|-----|
| TXT  | `resend._domainkey` | `p=MIGfMA...wIDAQAB` (long DKIM key) | — | default |
| MX   | `send` | `feedback-smtp.us-east-1.amazonses.com` (exact value on Resend page) | `10` | default |
| TXT  | `send` | `v=spf1 include:amazonses.com ~all` (exact value on Resend page) | — | default |
| TXT  | `_dmarc` | `v=DMARC1; p=none;` | — | default |

(The DMARC row is listed "optional" by Resend — add it anyway, it improves inbox
delivery.)

## STEP 2 — Verify in Resend

Back on resend.com → Domains → theseans.app → click **"I've already added the
records"** / **Verify**. Usually green within minutes on Porkbun; up to an hour if
DNS is slow. All records must show "Verified".

## STEP 3 — Resend API key

resend.com → **API Keys → Create API Key**
- Name: `supabase-smtp`
- Permission: "Sending access" is enough
- **Copy it immediately** — it is shown only once.

## STEP 4 — Supabase SMTP settings

Supabase dashboard → **Project Settings → Authentication → SMTP Settings** →
enable **Custom SMTP**:

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (literally the word "resend") |
| Password | the API key from Step 3 |
| Sender email | `no-reply@theseans.app` (MUST be on the verified domain) |
| Sender name | `ClassMate` |

Save. Nothing else changes — email templates (both already contain `{{ .Token }}`),
OTP length (8), and expiration (3600s) all stay as configured.

## STEP 5 — Raise rate limits

Supabase dashboard → **Authentication → Rate Limits** → raise "emails per hour"
(only editable once custom SMTP is on). Start with **100/hour**; bump later if the
app grows.

## STEP 6 — Test

From the app (simulator is fine):
1. Sign In → Forgot password? → enter your own school email → **Send code**.
2. The email should arrive within seconds, from `no-reply@theseans.app`, using the
   styled ClassMate template with a large 8-digit code.
3. Check spam the first time. If it lands there, DNS likely hasn't fully
   propagated — retry in an hour. Persistent spam placement → consider adding the
   DMARC record if skipped, or ask in Resend's dashboard (it shows delivery logs
   per email under "Emails").

---

## Reference

- Resend docs for Supabase SMTP: https://resend.com/docs/send-with-supabase-smtp
- Supabase custom SMTP docs: https://supabase.com/docs/guides/auth/auth-smtp
- Resend delivery logs (debugging): resend.com → Emails
