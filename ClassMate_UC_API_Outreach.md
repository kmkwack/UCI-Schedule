# ClassMate — UC System API Outreach Guide

> App: **ClassMate** | Developer: Park Sihyun (UCI Undergraduate) | Email: mm3762571@gmail.com

---

## 캠퍼스별 API 현황 요약

| 캠퍼스 | API 공개 여부 | 접근 방식 | 보낼 곳 |
|--------|-------------|----------|---------|
| **UCLA** | ✅ 공식 API 포털 있음 | Developer Portal 앱 생성 + RSR 제출 | api-support@it.ucla.edu |
| **UCSD** | ⚠️ 비공식 | Registrar에 직접 요청 | registrar@ucsd.edu |
| **UC Berkeley** | ✅ 공식 API Central 있음 | 외부 접근은 eis-support에 연락 | eis-support@berkeley.edu |
| **UC Davis** | ⚠️ 제한적 | Registrar/IT에 직접 요청 | registrar@ucdavis.edu |
| **UCSB** | ✅ 가장 개방적인 공식 포털 | developer.ucsb.edu 에서 앱 생성 후 승인 요청 | 포털 내 셀프서비스 |
| **UCSC** | ❌ 공식 API 없음 | Registrar에 직접 요청 | registrar@ucsc.edu |
| **UCR** | ⚠️ 포털 있으나 수업 API 없음 | Developer Portal 통해 요청 | ithelp@ucr.edu |

---

## 행동 가이드

### UCSB — 바로 시작 가능 🟢
→ [developer.ucsb.edu](https://developer.ucsb.edu/) 에서 계정 생성 → "Academic Curriculums" API 구독 신청  
별도 이메일 불필요. 포털 내에서 앱 등록 후 승인 대기.

### UCLA — 이메일 + 포털 등록 🟡
→ 아래 이메일을 `api-support@it.ucla.edu` 로 발송 + [developer.api.ucla.edu](https://developer.api.ucla.edu/) 에서 앱 생성

### UC Berkeley — 이메일 필수 🟡
→ 외부 개발자는 CalNet ID 없으므로 `eis-support@berkeley.edu` 로 직접 연락

### UC Davis, UCSD, UCSC, UCR — 이메일 필수 🔴
→ 각 이메일로 직접 협조 요청

---

## Email Templates

---

### 1. UCLA
**To:** api-support@it.ucla.edu  
**Subject:** API Access Request for ClassMate — Cross-UC Student Schedule App

---

Hi UCLA API Support Team,

My name is Sihyun Park, and I'm an undergraduate student at UC Irvine building **ClassMate**, a mobile schedule and community app for college students. The app is currently live for UCI students, powered by the Anteater API maintained by ICSSC, and I'm now looking to expand it across the UC system.

ClassMate allows students to:
- Browse and search live course offerings by department, GE category, and quarter
- Build multiple named timetables and view a weekly schedule grid
- Read and write course reviews with grade distributions
- Connect with classmates in the same sections

I'd like to request access to the **UCLA Classes API** (and optionally the Courses API) available on the UCLA API Developer Portal. My intended use is read-only: fetching sections, meeting times, instructors, and enrollment status to display to UCLA students using ClassMate.

I understand I may need to submit a Registrar's Service Request (RSR) for data approval. I'm happy to go through that process and provide any additional documentation about the app, its data usage policy, or my identity as a student developer.

Could you point me to the right steps to get started, or let me know who I should follow up with on the Registrar side?

Thank you so much for your time.

ClassMate — [Testflight Beta / https://testflight.apple.com/join/9UjRhFmz ]

review sign in email / pw : review@classmate.app / 123123

Best,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com  

---

### 2. UCSD
**To:** registrar@ucsd.edu  
**Subject:** Developer API Access Request — ClassMate Student Schedule App

---

Hi UCSD Registrar's Office,

My name is Sihyun Park, a Computer Science student at UC Irvine. I'm the developer of **ClassMate**, a mobile app that helps college students browse live course offerings, build weekly timetables, and connect with classmates. The app is currently deployed for UCI students and I'm expanding it across the UC system.

I'm reaching out to ask whether UCSD offers any programmatic access (API or data export) to the Schedule of Classes — specifically: course listings, section times, instructors, and meeting locations per quarter.

I'm not looking to access any student-identifiable data. My request is solely for read-only access to the same course listing information that's publicly visible on the UCSD Schedule of Classes website.

If there's a formal process, a student tech organization I should contact, or a specific team that handles these requests, I'd love to be pointed in the right direction.

Thank you for your time, and I look forward to hearing from you.

Best regards,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

### 3. UC Berkeley
**To:** eis-support@berkeley.edu  
**Subject:** External Developer Access Request — SIS Class API for ClassMate App

---

Hi UC Berkeley Integration Services Team,

My name is Sihyun Park, an undergraduate student at UC Irvine and the developer of **ClassMate** — a mobile schedule and community app currently serving UCI students, with plans to expand across the UC system.

I came across the UC Berkeley API Central portal and noticed the SIS Class API, which looks like exactly what I'd need to bring ClassMate to Berkeley students. I understand that API access typically requires a CalNet identity, which I don't have as an external developer.

I'm writing to ask whether there's a pathway for external student developers from other UC campuses to request read-only access to course listing data — specifically section titles, meeting times, instructors, and locations.

I'm happy to provide documentation about ClassMate's data handling practices, sign any necessary data use agreements, or go through whatever review process is appropriate.

Would this be something your team could help facilitate, or could you point me to the right contact?

Thank you for your time.

Best,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

### 4. UC Davis
**To:** registrar@ucdavis.edu  
**Subject:** API Access Request for Student Schedule App — ClassMate

---

Hi UC Davis Registrar's Office,

My name is Sihyun Park, and I'm an undergraduate student at UC Irvine building **ClassMate**, a mobile app that allows college students to browse course offerings, build timetables, and connect with classmates in the same sections. I'm currently expanding the app to serve students across the UC system.

I found that UC Davis has a Student API Service and a developer community (developers.ucdavis.edu), and I wanted to reach out to ask about gaining read-only access to course schedule data — specifically course listings, section meeting times, instructors, and locations per quarter.

I'm not requesting access to any student records or private data. My intent is solely to display the same course information available publicly on the UC Davis Schedule Builder to students who use ClassMate.

Could you let me know if there's a formal process for requesting this access, or connect me with the right team (such as IET or the Student Information Systems team)?

I really appreciate your help and look forward to hearing from you.

Warm regards,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

### 5. UCSB
**To:** (Portal 내 메시지 또는 developer@ucsb.edu 로 사전 인사)  
**Subject:** Introducing ClassMate — Requesting API Access via UCSB Developer Portal

---

Hi UCSB Developer Portal Team,

My name is Sihyun Park, a UCI undergraduate and developer of **ClassMate**, a mobile schedule and community app for college students. I've already registered on the UCSB API Developer Portal and submitted a subscription request for the **Academic Curriculums** API.

I wanted to introduce myself and provide context for the access request. ClassMate currently serves UCI students through the Anteater API (maintained by ICSSC), and I'm expanding it to other UC campuses. For UCSB students, I plan to use the API for read-only course listing display — no student data, no write operations.

If there's anything else you need from me to approve the request, or if there's a preferred point of contact I should work with, please don't hesitate to reach out.

Thank you so much — I really appreciate UCSB having such an accessible developer ecosystem!

Best,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

### 6. UCSC
**To:** registrar@ucsc.edu  
**Subject:** API Access Request for ClassMate — UC Student Schedule App

---

Hi UCSC Registrar's Office,

My name is Sihyun Park, an undergraduate student at UC Irvine. I'm developing **ClassMate**, a mobile app that helps students browse courses, build timetables, and connect with classmates. The app is live for UCI students and I'm now expanding it to serve students at other UC campuses.

I'm reaching out to inquire whether UC Santa Cruz offers any programmatic or API-based access to Schedule of Classes data — such as course listings, section times, instructor names, and meeting locations per quarter.

I'm only looking for publicly available course information (the kind shown on the UCSC Class Search page) and am not requesting access to any student records. I'd be happy to sign a data use agreement or go through any review process your office requires.

If UCSC does not currently offer a developer API, I'd also be interested to know if there's a student tech organization or IT team I should contact instead.

Thank you for your time — I look forward to your response.

Best regards,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

### 7. UCR
**To:** ithelp@ucr.edu  
**Subject:** Developer API Access Request — Course Schedule Data for ClassMate App

---

Hi UC Riverside IT Help Team,

My name is Sihyun Park, a UCI undergraduate student and developer of **ClassMate**, a mobile app for browsing courses, building timetables, and connecting with classmates. I'm currently expanding ClassMate to serve students across the UC system.

I found that UC Riverside maintains a Developer Portal (developer.ucr.edu), and I wanted to inquire whether there is, or could be, an API endpoint for course schedule data — specifically: course listings, section times, instructor names, and meeting locations per quarter.

I'm only looking for publicly available information (the same data visible at classes.ucr.edu) delivered in a structured, programmatic format. I have no interest in accessing student records or any non-public data.

Could you let me know whether UCR has an existing API for this, or who I should contact to explore the possibility? I'd be happy to work through any formal request process.

Thank you for your time.

Best,  
Sihyun Park  
B.S. Student, UC Irvine  
mm3762571@gmail.com

---

*Generated for ClassMate UC expansion outreach — April 2026*
