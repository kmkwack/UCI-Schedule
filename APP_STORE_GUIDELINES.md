# App Store Review Guidelines — Compliance Audit

**App:** ClassMate  
**Audited:** 2026-05-18  
**Reference:** https://developer.apple.com/app-store/review/guidelines/

---

## 1. Safety

| # | Requirement | Status | Notes / Action Required |
|---|---|---|---|
| **1.1.1** | No defamatory/discriminatory content | ✅ | No such content in the app itself |
| **1.1.6** | No false information or prank functionality | ✅ | Data sourced from Anteater API and Supabase |
| **1.2** | UGC: mechanism to **filter** objectionable material | ✅ | `banned_words` Supabase table; `containsBannedContent()` checks post title+body before submission; `BannedWordsScreen` in Settings → Admin for moderators to manage the list |
| **1.2** | UGC: mechanism to **report** offensive content | ✅ | Report modal with 6 reasons + Supabase `reports` table; covers posts (BoardScreen), comments (BoardScreen action sheet), and direct messages (MessagesScreen `···` menu) |
| **1.2** | UGC: ability to **block abusive users** | ✅ | Block button on posts + comment action sheet (BoardScreen); ban icon in ClassMates edit mode (FriendsScreen); `···` → Block in Messages; Settings → Blocked Users sub-screen (clear all anonymous / individual friend unblock) |
| **1.2** | UGC: published **contact information** | ✅ | Help screen has "Contact Support" that opens email |
| **1.5** | Developer contact info accessible | ✅ | Support email in Settings → Help |
| **1.6** | Data security for user information | ✅ | Supabase handles auth + RLS; no raw credential storage |

---

## 2. Performance

| # | Requirement | Status | Notes / Action Required |
|---|---|---|---|
| **2.1** | App must be **complete** — no placeholder/empty screens | ✅ | `MessagesScreen` is fully implemented (1563 lines) with real Supabase DMs, conversation list, message bubbles, and read receipts |
| **2.1** | Backend services live during review | ✅ | Supabase and Anteater API are live |
| **2.1** | Provide demo account for reviewers | ⚠️ | If Google OAuth is the only login, reviewers may be unable to create accounts. Need a demo email/password account |
| **2.3.3** | Screenshots show app in use | ⚠️ | No screenshots produced yet — needed for App Store Connect submission |
| **2.3.6** | Age rating questions answered honestly | ⚠️ | Community board UGC and direct messages likely push this to **12+** (or higher). Must select correct content ratings in App Store Connect |
| **2.3.7** | App name ≤ 30 characters, no trademarked keywords | ⚠️ | "ClassMate" is fine; must not stuff keywords like "UCI," "UC Irvine," "Schedule" into the keyword field |
| **2.4.1** | iPhone apps should run on iPad | ⚠️ | Not tested on iPad. Layout may break on wider screens |
| **2.4.2** | No excessive battery drain | ✅ | No crypto mining, no polling abuse |
| **2.5.1** | Only public APIs; runs on current iOS | ✅ | Uses Expo SDK 55, public React Native APIs |
| **2.5.2** | Self-contained bundle; no code downloaded at runtime | ✅ | No remote code execution |
| **2.5.4** | Background services only for allowed purposes | ✅ | Push notifications are the only background feature; properly implemented |
| **2.5.14** | Visual/audible indication if recording user activity | ✅ | No screen recording or audio capture |
| **2.5.16** | Widgets/notifications relate to app content | ✅ | Push notifications are class/assignment reminders |

---

## 3. Business

| # | Requirement | Status | Notes / Action Required |
|---|---|---|---|
| **3.1.1** | Must use IAP for paid digital content | — | App is free with no paid features — no IAP needed |
| **3.2.2(iii)** | No artificially inflated ad impressions | ✅ | No advertising in the app |
| **3.2.2(iv)** | No in-app charity fundraising (without Apple approval) | ✅ | No fundraising features |

---

## 4. Design

| # | Requirement | Status | Notes / Action Required |
|---|---|---|---|
| **4.1** | No copycat apps; original concept | ✅ | Unique scheduling + social features for university students |
| **4.2** | App must provide lasting utility, not just a webpage | ✅ | Full native experience — timetable, grades, social, course picker |
| **4.2.2** | Not primarily marketing/content aggregator | ✅ | Course data is integrated into a full planning workflow |
| **4.3** | No spam (multiple copies of same app) | ✅ | Single app |
| **4.5.4** | Push notifications: only marketing with explicit opt-in | ✅ | User explicitly enables push notifications in Settings → Notifications |
| **4.8** | **Sign in with Apple required if any social login is offered** | ❌ | **CRITICAL BLOCKER.** App offers Google Sign-in (a third-party social login). Apple requires Sign in with Apple as an equivalent option. This is one of the most common hard rejections |

---

## 5. Legal

| # | Requirement | Status | Notes / Action Required |
|---|---|---|---|
| **5.1.1(i)** | Privacy policy link in **App Store Connect metadata** | ❌ | Privacy policy exists in-app (`LegalDocumentModal`) but must also be hosted at a public URL and linked in App Store Connect before users download the app |
| **5.1.1(i)** | Privacy policy inside the app | ✅ | `LegalDocumentModal` with full privacy policy text in Settings |
| **5.1.1(ii)** | User consent before data collection | ⚠️ | Push notification permission is requested. However, no explicit consent screen for Supabase data collection (profile, timetables, posts) is shown at sign-up |
| **5.1.1(v)** | Account deletion offered within the app | ✅ | "Delete Account" in Settings, implemented in `App.tsx` |
| **5.1.1(v)** | No forced sign-in for features that don't need it | ⚠️ | App requires sign-in for everything — if any read-only browsing (e.g. course catalog) is possible without account, it should be accessible |
| **5.1.2(i)** | No sharing personal data without permission | ✅ | Supabase is the only data processor; no third-party ad/analytics SDKs found |
| **5.1.2(i)** | App Tracking Transparency (ATT) if tracking across apps | ✅ | No cross-app tracking; no need for ATT prompt |
| **5.2.1** | No third-party trademarks without permission | ⚠️ | App displays "UC Irvine," "UCI," course data, and UCI Athletics content. Should have explicit permission or acknowledgement from UCI; add "Not affiliated with UC Irvine" disclaimer |
| **5.2.2** | Comply with third-party service ToS | ⚠️ | Scraping `ucirvinesports.com` HTML needs to be verified against their ToS. Anteater API (ICSSC) is publicly maintained for this purpose — OK |
| **5.2.4** | Cannot imply Apple endorsement | ✅ | No Apple branding misuse found |
| **5.3** | No real-money gambling | ✅ | Not applicable |

---

## Priority Action Table

| Priority | Issue | Guideline | Status | What To Do |
|---|---|---|---|---|
| 🔴 **Blocker** | No **Sign in with Apple** | 4.8 | ❌ Open | Add Apple OAuth via `expo-apple-authentication` alongside Google Sign-in |
| 🟠 **Required** | **Privacy Policy public URL** needed for App Store Connect | 5.1.1(i) | ❌ Open | Host the privacy policy at a public URL (e.g. GitHub Pages) and paste it into App Store Connect |
| 🟠 **Required** | **Content filtering** for UGC posts | 1.2 | ✅ Done | `banned_words` Supabase table + `containsBannedContent()` in BoardScreen; admin UI in Settings |
| 🟠 **Required** | **Demo account** credentials for App Review | 2.1 | ❌ Open | Create a static email/password test account and include credentials in App Review Notes |
| 🟡 **Important** | Age rating likely **12+** due to community UGC | 2.3.6 | ❌ Open | Select 12+ in App Store Connect; answer "Yes" to infrequent/mild mature content for UGC |
| 🟡 **Important** | UCI/UC Irvine **trademark authorization** | 5.2.1 | ❌ Open | Obtain written permission or add "Not affiliated with UC Irvine" disclaimer |
| 🟡 **Important** | **iPad layout** not tested | 2.4.1 | ❌ Open | Test on iPad simulator; fix horizontal layout issues |
| 🟡 **Important** | Sports data **web scraping ToS** | 5.2.2 | ❌ Open | Check `ucirvinesports.com` ToS or switch to an authorized data source |
| 🟢 **Low** | Forced sign-in for all features | 5.1.1(v) | ❌ Open | Consider allowing read-only course browsing without an account |
| 🟢 **Low** | App Store screenshots not yet created | 2.3.3 | ❌ Open | Create at least 3 screenshots per required device size (6.7" and 6.1" iPhone) |
