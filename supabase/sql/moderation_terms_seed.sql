-- Central moderation policy seed for ClassMate public user-generated text.
-- This table is intended for backend moderation hooks and operational review only.
-- Do not expose raw patterns in client UI.

create table if not exists public.moderation_policy_terms (
  id text primary key,
  category text not null check (category in (
    'identity_hate',
    'direct_threat',
    'self_harm_encouragement',
    'sexual_harassment',
    'doxxing',
    'targeted_harassment',
    'general_profanity',
    'spam_scam',
    'illegal_transactions',
    'academic_integrity'
  )),
  severity text not null check (severity in ('hard_block', 'hold_for_review', 'warn_or_mask')),
  match_type text not null check (match_type in ('exact_word', 'phrase', 'regex')),
  language text not null check (language in ('en', 'es', 'ko', 'mixed')),
  patterns text[] not null,
  notes text not null default '',
  false_positive_notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.moderation_policy_terms enable row level security;
revoke all on public.moderation_policy_terms from anon, authenticated;

insert into public.moderation_policy_terms
  (id, category, severity, match_type, language, patterns, notes, false_positive_notes)
values
  (
    'identity_hate_en_slurs',
    'identity_hate',
    'hard_block',
    'exact_word',
    'en',
    array[
      'nigger', 'nigga', 'chink', 'gook', 'spic', 'kike', 'fag', 'faggot', 'dyke',
      'tranny', 'shemale', 'wetback', 'raghead', 'sandnigger', 'retard', 'coon',
      'jap', 'beaner', 'zipperhead', 'towelhead', 'cripple'
    ],
    'Common English identity-based slurs targeting protected classes.',
    'Use word boundaries so short terms do not match inside academic words.'
  ),
  (
    'identity_hate_abusive_phrases',
    'identity_hate',
    'hard_block',
    'phrase',
    'en',
    array[
      'go back to your country', 'deport them all', 'all immigrants should leave',
      'all muslims are terrorists', 'all jews are', 'all gay people are'
    ],
    'Protected-class abusive phrases beyond single-token slurs.',
    null
  ),
  (
    'identity_hate_es_slurs',
    'identity_hate',
    'hard_block',
    'exact_word',
    'es',
    array[
      'maricon', 'marica', 'joto', 'sudaca', 'mojado', 'frijolero', 'mongolico'
    ],
    'High-confidence Spanish identity slurs targeting protected classes.',
    'Use word boundaries and accent folding to reduce accidental matches.'
  ),
  (
    'identity_hate_ko_slurs',
    'identity_hate',
    'hard_block',
    'phrase',
    'ko',
    array[
      '짱깨', '쪽바리', '깜둥이', '흑형충', '장애새끼', '장애년', '병신장애',
      '개독', '무슬림새끼', '조선족새끼', '게이새끼', '트젠새끼'
    ],
    'High-confidence Korean identity slurs and protected-class abuse.',
    null
  ),
  (
    'direct_threat_en_patterns',
    'direct_threat',
    'hard_block',
    'regex',
    'en',
    array[
      '\b(?:i\s*(?:will|ll|am going to|m going to|m gonna|gonna)|we\s*(?:will|ll|are going to|re going to|re gonna)|someone should)\s+(?:kill|shoot|stab|bomb|beat|hurt|attack)\s+(?:you|him|her|them|that professor|the professor|the ta|this class|(?:the\s+)?(?:campus|school|class|lecture|building|library|dorm|hall))\b',
      '\b(?:kill|shoot|stab|bomb|beat|hurt|attack)\s+(?:you|u|him|her|them|that professor|the professor|the ta|this class|(?:the\s+)?(?:campus|school|class))\b',
      '\b(?:bomb|shoot up|attack)\s+(?:campus|school|class|lecture|building|library|dorm|hall)\b',
      '\bi\s*(?:will|ll|am going to|m gonna|gonna)\s+find\s+(?:you|u|him|her|them)\b'
    ],
    'Direct threats and campus violence threat patterns.',
    'Avoid matching casual academic phrases such as "bombed the midterm" without threat context.'
  ),
  (
    'direct_threat_es_patterns',
    'direct_threat',
    'hard_block',
    'regex',
    'es',
    array[
      '\bte\s+voy\s+a\s+(?:matar|disparar|apunalar|acuchillar|golpear|atacar|lastimar)\b',
      '\b(?:voy\s+a|vamos\s+a|alguien\s+deberia)\s+(?:matar|disparar|apunalar|acuchillar|golpear|atacar|lastimar)\s+(?:a\s+)?(?:ti|el\s+profesor|la\s+profesora|el\s+estudiante|la\s+estudiante|ese|esa|ellos|ellas|la\s+clase|el\s+campus|la\s+escuela)\b',
      '\b(?:voy\s+a|vamos\s+a)\s+(?:poner\s+una\s+bomba|bombardear|atacar)\s+(?:el\s+)?(?:campus|escuela|clase|edificio|biblioteca|dormitorio)\b',
      '\bte\s+voy\s+a\s+encontrar\b'
    ],
    'Spanish direct threats and campus violence threat patterns.',
    null
  ),
  (
    'direct_threat_ko_patterns',
    'direct_threat',
    'hard_block',
    'regex',
    'ko',
    array[
      '(?:죽여|죽일|때려죽|패죽|칼로|찌를|찔러|총으로|쏴버|폭탄|테러).*(?:너|걔|교수|조교|학생|학교|캠퍼스|강의실)',
      '(?:학교|캠퍼스|강의실|도서관|기숙사).*(?:폭탄|테러|총기|쏴버)'
    ],
    'Korean direct threat and campus violence phrasing.',
    null
  ),
  (
    'self_harm_encouragement',
    'self_harm_encouragement',
    'hard_block',
    'phrase',
    'mixed',
    array[
      'kill yourself', 'kys', 'go kill yourself', 'go die', 'you should die',
      'end yourself', 'commit suicide', 'matate', 'suicidate', 'vete a morir',
      'ojala te mueras', '자살해', '죽어', '뒤져', '목매달아'
    ],
    'Self-harm encouragement and death commands directed as abuse.',
    null
  ),
  (
    'sexual_threats_and_harassment',
    'sexual_harassment',
    'hard_block',
    'phrase',
    'mixed',
    array[
      'i will rape', 'im going to rape', 'i''m going to rape', 'rape you', 'rape her',
      'rape him', 'rape them', 'send nudes', 'show me your tits', 'show me your dick',
      'i want to fuck that professor', 'i want to fuck that ta', 'i want to fuck that classmate',
      'te voy a violar', 'voy a violarte', 'violarte', 'manda nudes',
      'manda fotos desnuda', 'manda fotos desnudo', '강간할', '강간한다', '따먹고싶',
      '몸매평가', '벗은 사진 보내'
    ],
    'Sexual threats, unsolicited sexual demands, and sexualized comments about students or staff.',
    null
  ),
  (
    'doxxing_contact_info',
    'doxxing',
    'hold_for_review',
    'regex',
    'mixed',
    array[
      '\b(?:drop|post|leak|share|send)\s+(?:their|his|her|the)\s+(?:address|phone|number|student\s*id|email)\b',
      '\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b',
      '\b(?:student\s*id|ucinetid|uid)\s*[:#]?\s*\d{6,10}\b',
      '\b[a-z0-9._%+-]+@(?!uci\.edu\b|[a-z0-9.-]*\.edu\b)[a-z0-9.-]+\.[a-z]{2,}\b',
      '\b(?:home\s+address|dorm\s+room|room\s+number)\s*[:#]?\s*\d{1,5}\b',
      '\b(?:pasa|publica|filtra|manda|comparte)\s+(?:su|el|la)\s+(?:direccion|telefono|numero|id\s+de\s+estudiante|correo)\b'
    ],
    'Likely private contact information or requests to expose private data.',
    'Official .edu addresses are allowed by the email pattern; public Board text remains conservative for phone/student IDs.'
  ),
  (
    'targeted_harassment_patterns',
    'targeted_harassment',
    'hold_for_review',
    'regex',
    'mixed',
    array[
      '\b(?:you|u|your|that\s+(?:guy|girl|student)|this\s+(?:guy|girl|student)|professor|prof|ta|classmate)\b.{0,40}\b(?:idiot|loser|moron|dumbass|worthless|ugly|fat|creep|trash|piece of shit)\b',
      '\b(?:everyone|somebody|someone)\s+(?:harass|bully|exclude|shame|doxx)\s+(?:him|her|them|that student|that professor|the ta)\b',
      '\b(?:tu|usted|profesor|profesora|estudiante|companero|companera|ese|esa)\b.{0,40}\b(?:idiota|perdedor|imbecil|estupido|basura|asqueroso|asquerosa)\b',
      '(?:너|니가|교수|조교|학생|걔|쟤).{0,20}(?:병신|멍청|못생|뚱뚱|쓰레기|찐따|왕따)'
    ],
    'Targeted bullying, appearance insults, and calls to harass or exclude a person.',
    null
  ),
  (
    'general_profanity_en',
    'general_profanity',
    'warn_or_mask',
    'exact_word',
    'en',
    array[
      'fuck', 'fucking', 'shit', 'bullshit', 'bitch', 'asshole', 'dick', 'pussy',
      'bastard', 'damn', 'crap'
    ],
    'Mild profanity alone can remain warn/mask; targeted or repeated use escalates.',
    'Boundary matching prevents terms like class, assignment, pass, grass, and analysis from matching.'
  ),
  (
    'general_profanity_es',
    'general_profanity',
    'warn_or_mask',
    'exact_word',
    'es',
    array[
      'mierda', 'joder', 'puta', 'puto', 'pendejo', 'cabron', 'chingar', 'chinga'
    ],
    'Spanish profanity is warn/mask by default and escalates when targeted or repeated.',
    'Exact-word matching and accent folding reduce accidental matches inside longer words.'
  ),
  (
    'general_profanity_ko',
    'general_profanity',
    'warn_or_mask',
    'phrase',
    'ko',
    array[
      '씨발', '시발', 'ㅅㅂ', '병신', '지랄', '좆', '존나', '개새끼', '미친',
      '꺼져', '닥쳐', '염병', 'ㅈㄴ', 'ㅂㅅ'
    ],
    'Korean profanity is warn/mask by default and escalates when targeted or repeated.',
    null
  ),
  (
    'spam_scam_patterns',
    'spam_scam',
    'hold_for_review',
    'regex',
    'en',
    array[
      '\b(?:guaranteed|risk\s*free)\s+(?:money|profit|crypto|job)\b',
      '\b(?:crypto|bitcoin|forex|nft)\s+(?:pump|signals?|investment|double your money)\b',
      '\bdm\s+me\s+for\s+(?:guaranteed\s+)?(?:money|job|answers|exam|homework)\b',
      '\bdm\s+para\s+(?:dinero|trabajo|respuestas|examen)\s+(?:garantizado|garantizada)?\b',
      '(?:https?://\S+\s*){3,}',
      '\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd)/\S+'
    ],
    'Likely scams, phishing, repeated URLs, and suspicious shortened links.',
    null
  ),
  (
    'illegal_transactions',
    'illegal_transactions',
    'hard_block',
    'regex',
    'en',
    array[
      '\b(?:buy|sell|selling|need|looking for)\s+(?:weed|cocaine|xanax|adderall|percocet|molly|shrooms|drugs)\b',
      '\b(?:fake\s*id|stolen\s+(?:exam|account|password)|sell\s+(?:login|credentials|password))\b',
      '\b(?:buy|sell|selling|need)\s+(?:gun|weapon|ammo|ammunition)\b',
      '\b(?:vendo|compro|necesito|busco)\s+(?:drogas|cocaina|xanax|adderall|armas|municiones)\b',
      '\b(?:identificacion\s+falsa|id\s+falso|vendo\s+(?:login|credenciales|contrasena|password))\b'
    ],
    'Illegal transactions, controlled-substance sales, credential sales, and weapon sales.',
    null
  ),
  (
    'academic_integrity',
    'academic_integrity',
    'hold_for_review',
    'regex',
    'en',
    array[
      '\b(?:selling|sell|buy|buying|paying for|need)\s+(?:(?:final|midterm)\s+exam|exam|midterm|final|quiz)\s+(?:answers|solutions|leak|leaked)\b',
      '\b(?:leaked\s+(?:exam|midterm|final|quiz)|exam\s+leak|answer\s+key)\b',
      '\b(?:pay|paid|paying)\s+(?:someone|somebody|you)\s+to\s+(?:take|do)\s+(?:my|the)\s+(?:exam|quiz|homework|assignment)\b',
      '\b(?:chegg|coursehero)\s+(?:answers|unlock|service)\b',
      '\b(?:vendo|compro|necesito|busco)\s+(?:respuestas|soluciones)\s+(?:del\s+)?(?:examen|midterm|final|quiz)\b',
      '\b(?:pago|pagare)\s+(?:a\s+)?(?:alguien|una\s+persona)\s+para\s+(?:tomar|hacer)\s+(?:mi|el)\s+(?:examen|quiz|tarea)\b'
    ],
    'Exam leaks, paid cheating, and answer-selling requests.',
    'Do not match normal academic stress phrases like "kill the exam" or "bombed the midterm".'
  )
on conflict (id) do update set
  category = excluded.category,
  severity = excluded.severity,
  match_type = excluded.match_type,
  language = excluded.language,
  patterns = excluded.patterns,
  notes = excluded.notes,
  false_positive_notes = excluded.false_positive_notes,
  active = true,
  updated_at = now();
