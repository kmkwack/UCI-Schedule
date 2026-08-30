-- ClassMate — 운영 지표 쿼리 모음
--
-- Supabase 대시보드 → SQL Editor에 붙여넣고 필요한 블록만 실행하면 된다.
-- 읽기 전용이라 아무것도 바꾸지 않는다.
--
-- ⚠️ 한계: 앱에 이벤트 추적이 없어서 "화면을 열어본 것"은 기록되지 않는다.
-- 아래 활성 지표는 전부 (a) 로그인 시각과 (b) 쓰기 활동에서 유추한 근사치다.
-- 앱을 켜서 시간표만 보고 끈 사용자는 어디에도 안 잡힌다.


-- ─────────────────────────────────────────────────────────
-- 1. 한눈에 보기
-- ─────────────────────────────────────────────────────────
select
  count(*)                                                          as 총가입자,
  count(*) filter (where email_confirmed_at is not null)            as 인증완료,
  count(*) filter (where created_at > now() - interval '24 hours')  as 오늘가입,
  count(*) filter (where created_at > now() - interval '7 days')    as 최근7일가입,
  count(*) filter (where last_sign_in_at > now() - interval '24 hours') as 오늘로그인,
  count(*) filter (where last_sign_in_at > now() - interval '7 days')  as 최근7일로그인
from auth.users;


-- ─────────────────────────────────────────────────────────
-- 2. 일별 신규 가입 (최근 30일)
--    개강 전후로 어떻게 움직이는지 보는 용도
-- ─────────────────────────────────────────────────────────
select
  date_trunc('day', created_at)::date as 날짜,
  count(*)                            as 신규가입,
  sum(count(*)) over (order by date_trunc('day', created_at)) as 누적
from auth.users
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;


-- ─────────────────────────────────────────────────────────
-- 3. 가입 깔때기 — 어디서 이탈하는가
--    인증 미완료가 많으면 이메일이 안 가고 있다는 뜻 (Resend 한도 확인)
-- ─────────────────────────────────────────────────────────
select
  count(*)                                                as 가입시도,
  count(*) filter (where email_confirmed_at is not null)  as 이메일인증완료,
  round(100.0 * count(*) filter (where email_confirmed_at is not null)
        / nullif(count(*), 0), 1)                         as 인증율_퍼센트,
  count(*) filter (where last_sign_in_at is not null)     as 로그인성공,
  count(*) filter (where last_sign_in_at > created_at + interval '1 day') as 재방문
from auth.users
where created_at > now() - interval '30 days';


-- ─────────────────────────────────────────────────────────
-- 4. 주차별 리텐션 근사
--    가입한 주 이후에 다시 로그인한 비율.
--    투자자나 프로그램 지원 시 요구하는 숫자가 이거다.
-- ─────────────────────────────────────────────────────────
select
  date_trunc('week', created_at)::date as 가입주차,
  count(*)                             as 가입자,
  count(*) filter (where last_sign_in_at > created_at + interval '1 day')  as 익일이후재방문,
  count(*) filter (where last_sign_in_at > created_at + interval '7 days') as 일주일후재방문,
  round(100.0 * count(*) filter (where last_sign_in_at > created_at + interval '7 days')
        / nullif(count(*), 0), 1)      as 주간리텐션_퍼센트
from auth.users
group by 1
order by 1 desc;


-- ─────────────────────────────────────────────────────────
-- 5. 실제로 앱을 쓰고 있는가 — 시간표를 만든 사람
--    가입만 하고 안 쓰는 사람과 구분된다. 핵심 기능 도달률.
-- ─────────────────────────────────────────────────────────
select
  (select count(*) from auth.users)                        as 총가입자,
  (select count(distinct user_id) from timetables)         as 시간표만든사람,
  round(100.0 * (select count(distinct user_id) from timetables)
        / nullif((select count(*) from auth.users), 0), 1) as 도달률_퍼센트,
  (select count(*) from timetables)                        as 시간표총개수;


-- ─────────────────────────────────────────────────────────
-- 6. 커뮤니티 활동 (최근 14일)
-- ─────────────────────────────────────────────────────────
select
  date_trunc('day', created_at)::date as 날짜,
  count(*)                            as 게시글,
  count(distinct user_id)             as 작성자수
from posts
where created_at > now() - interval '14 days'
group by 1
order by 1 desc;


-- ─────────────────────────────────────────────────────────
-- 7. 이메일 발송량 추정 — Resend 한도 감시용
--    무료 플랜은 하루 100통. 가입 + 재설정 요청이 모두 메일을 쓴다.
--    이 수치가 100에 근접하면 즉시 플랜을 올려야 한다.
--    (실제 발송량은 Resend 대시보드가 정확하다. 이건 가입 기준 하한선)
-- ─────────────────────────────────────────────────────────
select
  date_trunc('day', created_at)::date as 날짜,
  count(*)                            as 가입발송_최소
from auth.users
where created_at > now() - interval '14 days'
group by 1
order by 1 desc;
