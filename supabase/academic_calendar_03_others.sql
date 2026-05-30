-- Step 3: Cornell, Purdue, UMD, UIUC data
-- Run AFTER academic_calendar_01_table.sql

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('cornell-sp26-start',        'Cornell University', '2026-Spring', 'Classes Begin',        null,                          '2026-01-21', null,         'instruction', null),
  ('cornell-sp26-add',          'Cornell University', '2026-Spring', 'Add Deadline',         null,                          '2026-02-03', null,         'enrollment',  'https://registrar.cornell.edu/academic-calendar'),
  ('cornell-sp26-su',           'Cornell University', '2026-Spring', 'S/U Grade Deadline',   'Satisfactory/Unsatisfactory', '2026-03-06', null,         'passnopass',  'https://registrar.cornell.edu/student-services/su-option'),
  ('cornell-sp26-spring',       'Cornell University', '2026-Spring', 'Spring Break',         null,                          '2026-03-21', '2026-03-29', 'holiday',     null),
  ('cornell-sp26-withdraw',     'Cornell University', '2026-Spring', 'Withdrawal Deadline',  'W grade assigned',            '2026-04-10', null,         'withdrawal',  'https://registrar.cornell.edu/academic-calendar'),
  ('cornell-sp26-lastday',      'Cornell University', '2026-Spring', 'Last Day of Classes',  null,                          '2026-05-05', null,         'instruction', null),
  ('cornell-sp26-finals',       'Cornell University', '2026-Spring', 'Finals Period',        null,                          '2026-05-07', '2026-05-13', 'finals',      'https://registrar.cornell.edu/academic-calendar'),
  ('cornell-fa26-start',        'Cornell University', '2026-Fall',   'Classes Begin',        null,                          '2026-08-24', null,         'instruction', null),
  ('cornell-fa26-add',          'Cornell University', '2026-Fall',   'Add Deadline',         null,                          '2026-09-04', null,         'enrollment',  'https://registrar.cornell.edu/academic-calendar'),
  ('cornell-fa26-su',           'Cornell University', '2026-Fall',   'S/U Grade Deadline',   'Satisfactory/Unsatisfactory', '2026-10-02', null,         'passnopass',  'https://registrar.cornell.edu/student-services/su-option'),
  ('cornell-fa26-fall',         'Cornell University', '2026-Fall',   'Fall Break',           null,                          '2026-10-08', '2026-10-11', 'holiday',     null),
  ('cornell-fa26-withdraw',     'Cornell University', '2026-Fall',   'Withdrawal Deadline',  'W grade assigned',            '2026-11-06', null,         'withdrawal',  'https://registrar.cornell.edu/academic-calendar'),
  ('cornell-fa26-thanksgiving', 'Cornell University', '2026-Fall',   'Thanksgiving Break',   null,                          '2026-11-21', '2026-11-29', 'holiday',     null),
  ('cornell-fa26-lastday',      'Cornell University', '2026-Fall',   'Last Day of Classes',  null,                          '2026-12-05', null,         'instruction', null),
  ('cornell-fa26-finals',       'Cornell University', '2026-Fall',   'Finals Period',        null,                          '2026-12-07', '2026-12-15', 'finals',      'https://registrar.cornell.edu/academic-calendar')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('purdue-sp26-start',        'Purdue University', '2026-Spring', 'Classes Begin',        null,                          '2026-01-12', null,         'instruction', null),
  ('purdue-sp26-mlk',          'Purdue University', '2026-Spring', 'MLK Day',              'No classes',                  '2026-01-19', null,         'holiday',     null),
  ('purdue-sp26-add',          'Purdue University', '2026-Spring', 'Add/Drop Deadline',    null,                          '2026-01-21', null,         'enrollment',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-sp26-su',           'Purdue University', '2026-Spring', 'S/U Grade Deadline',   'Satisfactory/Unsatisfactory', '2026-02-27', null,         'passnopass',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-sp26-spring',       'Purdue University', '2026-Spring', 'Spring Break',         null,                          '2026-03-09', '2026-03-15', 'holiday',     null),
  ('purdue-sp26-withdraw',     'Purdue University', '2026-Spring', 'Withdrawal Deadline',  'W grade assigned',            '2026-03-27', null,         'withdrawal',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-sp26-lastday',      'Purdue University', '2026-Spring', 'Last Day of Classes',  null,                          '2026-04-25', null,         'instruction', null),
  ('purdue-sp26-finals',       'Purdue University', '2026-Spring', 'Finals Week',          null,                          '2026-04-27', '2026-05-01', 'finals',      'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-fa26-start',        'Purdue University', '2026-Fall',   'Classes Begin',        null,                          '2026-08-24', null,         'instruction', null),
  ('purdue-fa26-labor',        'Purdue University', '2026-Fall',   'Labor Day',            'No classes',                  '2026-09-07', null,         'holiday',     null),
  ('purdue-fa26-add',          'Purdue University', '2026-Fall',   'Add/Drop Deadline',    null,                          '2026-09-02', null,         'enrollment',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-fa26-su',           'Purdue University', '2026-Fall',   'S/U Grade Deadline',   'Satisfactory/Unsatisfactory', '2026-10-16', null,         'passnopass',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-fa26-fall',         'Purdue University', '2026-Fall',   'Fall Break',           null,                          '2026-10-08', '2026-10-09', 'holiday',     null),
  ('purdue-fa26-withdraw',     'Purdue University', '2026-Fall',   'Withdrawal Deadline',  'W grade assigned',            '2026-11-13', null,         'withdrawal',  'https://www.purdue.edu/registrar/calendars/'),
  ('purdue-fa26-thanksgiving', 'Purdue University', '2026-Fall',   'Thanksgiving Break',   null,                          '2026-11-25', '2026-11-29', 'holiday',     null),
  ('purdue-fa26-lastday',      'Purdue University', '2026-Fall',   'Last Day of Classes',  null,                          '2026-12-12', null,         'instruction', null),
  ('purdue-fa26-finals',       'Purdue University', '2026-Fall',   'Finals Week',          null,                          '2026-12-14', '2026-12-18', 'finals',      'https://www.purdue.edu/registrar/calendars/')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('umd-sp26-start',        'University of Maryland, College Park', '2026-Spring', 'Classes Begin',       null,                   '2026-01-26', null,         'instruction', null),
  ('umd-sp26-add',          'University of Maryland, College Park', '2026-Spring', 'Schedule Adjustment', 'Add/drop period ends', '2026-02-06', null,         'enrollment',  'https://registrar.umd.edu/current-students/registration/registration-schedule'),
  ('umd-sp26-pf',           'University of Maryland, College Park', '2026-Spring', 'Pass/Fail Deadline',  null,                   '2026-02-27', null,         'passnopass',  'https://registrar.umd.edu/current-students/registration/grading-options'),
  ('umd-sp26-spring',       'University of Maryland, College Park', '2026-Spring', 'Spring Break',        null,                   '2026-03-16', '2026-03-22', 'holiday',     null),
  ('umd-sp26-withdraw',     'University of Maryland, College Park', '2026-Spring', 'Withdrawal Deadline', 'W grade assigned',     '2026-04-10', null,         'withdrawal',  'https://registrar.umd.edu/current-students/registration/registration-schedule'),
  ('umd-sp26-lastday',      'University of Maryland, College Park', '2026-Spring', 'Last Day of Classes', null,                   '2026-05-11', null,         'instruction', null),
  ('umd-sp26-finals',       'University of Maryland, College Park', '2026-Spring', 'Finals Period',       null,                   '2026-05-13', '2026-05-19', 'finals',      'https://registrar.umd.edu/current-students/registration/registration-schedule'),
  ('umd-fa26-start',        'University of Maryland, College Park', '2026-Fall',   'Classes Begin',       null,                   '2026-09-02', null,         'instruction', null),
  ('umd-fa26-add',          'University of Maryland, College Park', '2026-Fall',   'Schedule Adjustment', 'Add/drop period ends', '2026-09-11', null,         'enrollment',  'https://registrar.umd.edu/current-students/registration/registration-schedule'),
  ('umd-fa26-pf',           'University of Maryland, College Park', '2026-Fall',   'Pass/Fail Deadline',  null,                   '2026-10-09', null,         'passnopass',  'https://registrar.umd.edu/current-students/registration/grading-options'),
  ('umd-fa26-withdraw',     'University of Maryland, College Park', '2026-Fall',   'Withdrawal Deadline', 'W grade assigned',     '2026-11-06', null,         'withdrawal',  'https://registrar.umd.edu/current-students/registration/registration-schedule'),
  ('umd-fa26-thanksgiving', 'University of Maryland, College Park', '2026-Fall',   'Thanksgiving Break',  null,                   '2026-11-25', '2026-11-29', 'holiday',     null),
  ('umd-fa26-lastday',      'University of Maryland, College Park', '2026-Fall',   'Last Day of Classes', null,                   '2026-12-11', null,         'instruction', null),
  ('umd-fa26-finals',       'University of Maryland, College Park', '2026-Fall',   'Finals Period',       null,                   '2026-12-14', '2026-12-20', 'finals',      'https://registrar.umd.edu/current-students/registration/registration-schedule')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;

INSERT INTO academic_calendar (id, school, quarter_key, title, subtitle, date, end_date, category, url) VALUES
  ('uiuc-sp26-start',       'University of Illinois Urbana-Champaign', '2026-Spring', 'Classes Begin',             null,               '2026-01-20', null,         'instruction', null),
  ('uiuc-sp26-add',         'University of Illinois Urbana-Champaign', '2026-Spring', 'Add Deadline',              null,               '2026-01-30', null,         'enrollment',  'https://registrar.illinois.edu/academic-calendars/'),
  ('uiuc-sp26-cn',          'University of Illinois Urbana-Champaign', '2026-Spring', 'Credit/No Credit Deadline', null,               '2026-03-06', null,         'passnopass',  'https://registrar.illinois.edu/courses-grades/credit-no-credit/'),
  ('uiuc-sp26-spring',      'University of Illinois Urbana-Champaign', '2026-Spring', 'Spring Break',              null,               '2026-03-16', '2026-03-22', 'holiday',     null),
  ('uiuc-sp26-withdraw',    'University of Illinois Urbana-Champaign', '2026-Spring', 'Withdrawal Deadline',       'W grade assigned', '2026-04-03', null,         'withdrawal',  'https://registrar.illinois.edu/academic-calendars/'),
  ('uiuc-sp26-lastday',     'University of Illinois Urbana-Champaign', '2026-Spring', 'Last Day of Classes',       null,               '2026-05-06', null,         'instruction', null),
  ('uiuc-sp26-finals',      'University of Illinois Urbana-Champaign', '2026-Spring', 'Finals Period',             null,               '2026-05-07', '2026-05-13', 'finals',      'https://registrar.illinois.edu/academic-calendars/'),
  ('uiuc-fa26-start',       'University of Illinois Urbana-Champaign', '2026-Fall',   'Classes Begin',             null,               '2026-08-24', null,         'instruction', null),
  ('uiuc-fa26-add',         'University of Illinois Urbana-Champaign', '2026-Fall',   'Add Deadline',              null,               '2026-09-04', null,         'enrollment',  'https://registrar.illinois.edu/academic-calendars/'),
  ('uiuc-fa26-cn',          'University of Illinois Urbana-Champaign', '2026-Fall',   'Credit/No Credit Deadline', null,               '2026-10-09', null,         'passnopass',  'https://registrar.illinois.edu/courses-grades/credit-no-credit/'),
  ('uiuc-fa26-withdraw',    'University of Illinois Urbana-Champaign', '2026-Fall',   'Withdrawal Deadline',       'W grade assigned', '2026-11-06', null,         'withdrawal',  'https://registrar.illinois.edu/academic-calendars/'),
  ('uiuc-fa26-thanksgiving','University of Illinois Urbana-Champaign', '2026-Fall',   'Thanksgiving Break',        null,               '2026-11-21', '2026-11-29', 'holiday',     null),
  ('uiuc-fa26-lastday',     'University of Illinois Urbana-Champaign', '2026-Fall',   'Last Day of Classes',       null,               '2026-12-09', null,         'instruction', null),
  ('uiuc-fa26-finals',      'University of Illinois Urbana-Champaign', '2026-Fall',   'Finals Period',             null,               '2026-12-10', '2026-12-16', 'finals',      'https://registrar.illinois.edu/academic-calendars/')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  date = EXCLUDED.date, end_date = EXCLUDED.end_date,
  category = EXCLUDED.category, url = EXCLUDED.url;
