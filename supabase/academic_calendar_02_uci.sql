-- Step 2: UC Irvine data
-- Source: https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html
-- Run AFTER academic_calendar_01_table.sql

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('uci-fa25-start',        'UC Irvine', '2025-Fall', 'Instruction Begins',      null,                                  '2025-09-22', null,         'instruction', null),
  ('uci-fa25-adddrop',      'UC Irvine', '2025-Fall', 'Add/Drop Deadline',       'No deans approval needed (5 PM)',     '2025-10-10', null,         'enrollment',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-fa25-pnp',          'UC Irvine', '2025-Fall', 'P/NP Change Deadline',    'Last drop without W grade (5 PM)',    '2025-11-07', null,         'passnopass',  'https://reg.uci.edu/enrollment/grading/passnopass.html'),
  ('uci-fa25-veterans',     'UC Irvine', '2025-Fall', 'Veterans Day',            'No classes',                          '2025-11-11', null,         'holiday',     null),
  ('uci-fa25-thanksgiving', 'UC Irvine', '2025-Fall', 'Thanksgiving',            'No classes',                          '2025-11-27', '2025-11-28', 'holiday',     null),
  ('uci-fa25-withdraw',     'UC Irvine', '2025-Fall', 'Withdrawal Deadline',     'W grade assigned (5 PM)',             '2025-12-05', null,         'withdrawal',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-fa25-lastday',      'UC Irvine', '2025-Fall', 'Last Day of Instruction', null,                                  '2025-12-05', null,         'instruction', null),
  ('uci-fa25-finals',       'UC Irvine', '2025-Fall', 'Finals Week',             null,                                  '2025-12-06', '2025-12-12', 'finals',      'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-fa25-grades',       'UC Irvine', '2025-Fall', 'Final Grades Due',        'Grades available 10 PM',              '2025-12-18', null,         'deadline',    null)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('uci-wi26-start',       'UC Irvine', '2026-Winter', 'Instruction Begins',      null,                              '2026-01-05', null,         'instruction', null),
  ('uci-wi26-mlk',         'UC Irvine', '2026-Winter', 'MLK Day',                 'No classes',                      '2026-01-19', null,         'holiday',     null),
  ('uci-wi26-adddrop',     'UC Irvine', '2026-Winter', 'Add/Drop Deadline',       'No deans approval needed (5 PM)', '2026-01-16', null,         'enrollment',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-wi26-pnp',         'UC Irvine', '2026-Winter', 'P/NP Change Deadline',    'Last drop without W grade (5 PM)','2026-02-13', null,         'passnopass',  'https://reg.uci.edu/enrollment/grading/passnopass.html'),
  ('uci-wi26-presidents',  'UC Irvine', '2026-Winter', 'Presidents Day',          'No classes',                      '2026-02-16', null,         'holiday',     null),
  ('uci-wi26-withdraw',    'UC Irvine', '2026-Winter', 'Withdrawal Deadline',     'W grade assigned (5 PM)',         '2026-03-13', null,         'withdrawal',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-wi26-lastday',     'UC Irvine', '2026-Winter', 'Last Day of Instruction', null,                              '2026-03-13', null,         'instruction', null),
  ('uci-wi26-finals',      'UC Irvine', '2026-Winter', 'Finals Week',             null,                              '2026-03-14', '2026-03-20', 'finals',      'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-wi26-grades',      'UC Irvine', '2026-Winter', 'Final Grades Due',        'Grades available 10 PM',          '2026-03-26', null,         'deadline',    null)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('uci-sp26-start',        'UC Irvine', '2026-Spring', 'Instruction Begins',      null,                              '2026-03-30', null,         'instruction', null),
  ('uci-sp26-adddrop',      'UC Irvine', '2026-Spring', 'Add/Drop Deadline',       'No deans approval needed (5 PM)','2026-04-10', null,         'enrollment',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-sp26-pnp',          'UC Irvine', '2026-Spring', 'P/NP Change Deadline',    'Last drop without W grade (5 PM)','2026-05-08', null,        'passnopass',  'https://reg.uci.edu/enrollment/grading/passnopass.html'),
  ('uci-sp26-memorial',     'UC Irvine', '2026-Spring', 'Memorial Day',            'No classes',                      '2026-05-25', null,         'holiday',     null),
  ('uci-sp26-withdraw',     'UC Irvine', '2026-Spring', 'Withdrawal Deadline',     'W grade assigned (5 PM)',         '2026-06-05', null,         'withdrawal',  'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-sp26-lastday',      'UC Irvine', '2026-Spring', 'Last Day of Instruction', null,                              '2026-06-05', null,         'instruction', null),
  ('uci-sp26-finals',       'UC Irvine', '2026-Spring', 'Finals Week',             null,                              '2026-06-06', '2026-06-12', 'finals',      'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html'),
  ('uci-sp26-grades',       'UC Irvine', '2026-Spring', 'Final Grades Due',        'Grades available 10 PM',          '2026-06-18', null,         'deadline',    null),
  ('uci-sp26-commencement', 'UC Irvine', '2026-Spring', 'Commencement',            null,                              '2026-06-13', null,         'graduation',  null)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('uci-fa26-start',        'UC Irvine', '2026-Fall', 'Instruction Begins',      null,                              '2026-09-21', null,         'instruction', null),
  ('uci-fa26-adddrop',      'UC Irvine', '2026-Fall', 'Add/Drop Deadline',       'No deans approval needed (5 PM)','2026-10-09', null,         'enrollment',  'https://reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html'),
  ('uci-fa26-pnp',          'UC Irvine', '2026-Fall', 'P/NP Change Deadline',    'Last drop without W grade (5 PM)','2026-11-06', null,        'passnopass',  'https://reg.uci.edu/enrollment/grading/passnopass.html'),
  ('uci-fa26-veterans',     'UC Irvine', '2026-Fall', 'Veterans Day',            'No classes',                      '2026-11-11', null,         'holiday',     null),
  ('uci-fa26-thanksgiving', 'UC Irvine', '2026-Fall', 'Thanksgiving',            'No classes',                      '2026-11-26', '2026-11-27', 'holiday',     null),
  ('uci-fa26-withdraw',     'UC Irvine', '2026-Fall', 'Withdrawal Deadline',     'W grade assigned (5 PM)',         '2026-12-04', null,         'withdrawal',  null),
  ('uci-fa26-lastday',      'UC Irvine', '2026-Fall', 'Last Day of Instruction', null,                              '2026-12-04', null,         'instruction', null),
  ('uci-fa26-finals',       'UC Irvine', '2026-Fall', 'Finals Week',             null,                              '2026-12-05', '2026-12-11', 'finals',      'https://reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;
