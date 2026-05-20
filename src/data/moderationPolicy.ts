export type ModerationSeverity = 'hard_block' | 'hold_for_review' | 'warn_or_mask';
export type ModerationMatchType = 'exact_word' | 'phrase' | 'regex';
export type ModerationLanguage = 'en' | 'es' | 'ko' | 'mixed';
export type ModerationCategory =
  | 'identity_hate'
  | 'direct_threat'
  | 'self_harm_encouragement'
  | 'sexual_harassment'
  | 'doxxing'
  | 'targeted_harassment'
  | 'general_profanity'
  | 'spam_scam'
  | 'illegal_transactions'
  | 'academic_integrity';

export type ModerationPolicyRule = {
  id: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  matchType: ModerationMatchType;
  language: ModerationLanguage;
  patterns: string[];
  notes: string;
  falsePositiveNotes?: string;
};

export type ModerationResult = {
  allowed: boolean;
  severity: ModerationSeverity | 'allow';
  categories: ModerationCategory[];
  ruleIds: string[];
};

type NormalizedText = {
  raw: string;
  folded: string;
  normalized: string;
  skeleton: string;
  compact: string;
  compactSkeleton: string;
};

const HOLD_FOR_REVIEW_MESSAGE =
  'Please edit your post. It may contain language that violates ClassMate community guidelines.';

const LETTER_OR_NUMBER = /[a-z0-9]/;

export const MODERATION_POLICY: ModerationPolicyRule[] = [
  {
    id: 'identity_hate_en_slurs',
    category: 'identity_hate',
    severity: 'hard_block',
    matchType: 'exact_word',
    language: 'en',
    patterns: [
      'nigger', 'nigga', 'chink', 'gook', 'spic', 'kike', 'fag', 'faggot', 'dyke',
      'tranny', 'shemale', 'wetback', 'raghead', 'sandnigger', 'retard', 'coon',
      'jap', 'beaner', 'zipperhead', 'towelhead', 'cripple',
    ],
    notes: 'Blocks common English identity-based slurs targeting protected classes.',
    falsePositiveNotes: 'English exact-word matching uses boundaries so short terms do not match inside academic words.',
  },
  {
    id: 'identity_hate_abusive_phrases',
    category: 'identity_hate',
    severity: 'hard_block',
    matchType: 'phrase',
    language: 'en',
    patterns: [
      'go back to your country', 'deport them all', 'all immigrants should leave',
      'all muslims are terrorists', 'all jews are', 'all gay people are',
    ],
    notes: 'Blocks abusive protected-class phrases beyond single-token slurs.',
  },
  {
    id: 'identity_hate_es_slurs',
    category: 'identity_hate',
    severity: 'hard_block',
    matchType: 'exact_word',
    language: 'es',
    patterns: [
      'maricon', 'marica', 'joto', 'sudaca', 'mojado', 'frijolero', 'mongolico',
    ],
    notes: 'Blocks high-confidence Spanish identity slurs targeting protected classes.',
    falsePositiveNotes: 'Spanish exact-word matching uses boundaries and accent folding to reduce accidental matches.',
  },
  {
    id: 'identity_hate_ko_slurs',
    category: 'identity_hate',
    severity: 'hard_block',
    matchType: 'phrase',
    language: 'ko',
    patterns: [
      '짱깨', '쪽바리', '깜둥이', '흑형충', '장애새끼', '장애년', '병신장애',
      '개독', '무슬림새끼', '조선족새끼', '게이새끼', '트젠새끼',
    ],
    notes: 'Blocks high-confidence Korean identity slurs and protected-class abuse.',
  },
  {
    id: 'direct_threat_en_patterns',
    category: 'direct_threat',
    severity: 'hard_block',
    matchType: 'regex',
    language: 'en',
    patterns: [
      '\\b(?:i\\s*(?:will|ll|am going to|m going to|m gonna|gonna)|we\\s*(?:will|ll|are going to|re going to|re gonna)|someone should)\\s+(?:kill|shoot|stab|bomb|beat|hurt|attack)\\s+(?:you|him|her|them|that professor|the professor|the ta|this class|(?:the\\s+)?(?:campus|school|class|lecture|building|library|dorm|hall))\\b',
      '\\b(?:kill|shoot|stab|bomb|beat|hurt|attack)\\s+(?:you|u|him|her|them|that professor|the professor|the ta|this class|(?:the\\s+)?(?:campus|school|class))\\b',
      '\\b(?:bomb|shoot up|attack)\\s+(?:campus|school|class|lecture|building|library|dorm|hall)\\b',
      '\\bi\\s*(?:will|ll|am going to|m gonna|gonna)\\s+find\\s+(?:you|u|him|her|them)\\b',
    ],
    notes: 'Blocks direct threats and campus violence threat patterns.',
    falsePositiveNotes: 'Does not match casual academic phrases like "bombed the midterm" without threat context.',
  },
  {
    id: 'direct_threat_es_patterns',
    category: 'direct_threat',
    severity: 'hard_block',
    matchType: 'regex',
    language: 'es',
    patterns: [
      '\\bte\\s+voy\\s+a\\s+(?:matar|disparar|apunalar|acuchillar|golpear|atacar|lastimar)\\b',
      '\\b(?:voy\\s+a|vamos\\s+a|alguien\\s+deberia)\\s+(?:matar|disparar|apunalar|acuchillar|golpear|atacar|lastimar)\\s+(?:a\\s+)?(?:ti|el\\s+profesor|la\\s+profesora|el\\s+estudiante|la\\s+estudiante|ese|esa|ellos|ellas|la\\s+clase|el\\s+campus|la\\s+escuela)\\b',
      '\\b(?:voy\\s+a|vamos\\s+a)\\s+(?:poner\\s+una\\s+bomba|bombardear|atacar)\\s+(?:el\\s+)?(?:campus|escuela|clase|edificio|biblioteca|dormitorio)\\b',
      '\\bte\\s+voy\\s+a\\s+encontrar\\b',
    ],
    notes: 'Blocks Spanish direct threats and campus violence threat patterns.',
  },
  {
    id: 'direct_threat_ko_patterns',
    category: 'direct_threat',
    severity: 'hard_block',
    matchType: 'regex',
    language: 'ko',
    patterns: [
      '(?:죽여|죽일|때려죽|패죽|칼로|찌를|찔러|총으로|쏴버|폭탄|테러).*(?:너|걔|교수|조교|학생|학교|캠퍼스|강의실)',
      '(?:학교|캠퍼스|강의실|도서관|기숙사).*(?:폭탄|테러|총기|쏴버)',
    ],
    notes: 'Blocks Korean direct threat and campus violence phrasing.',
  },
  {
    id: 'self_harm_encouragement',
    category: 'self_harm_encouragement',
    severity: 'hard_block',
    matchType: 'phrase',
    language: 'mixed',
    patterns: [
      'kill yourself', 'kys', 'go kill yourself', 'go die', 'you should die',
      'end yourself', 'commit suicide', 'matate', 'suicidate', 'vete a morir',
      'ojala te mueras', '자살해', '죽어', '뒤져', '목매달아',
    ],
    notes: 'Blocks self-harm encouragement and death commands directed as abuse.',
  },
  {
    id: 'sexual_threats_and_harassment',
    category: 'sexual_harassment',
    severity: 'hard_block',
    matchType: 'phrase',
    language: 'mixed',
    patterns: [
      'i will rape', 'im going to rape', "i'm going to rape", 'rape you', 'rape her',
      'rape him', 'rape them', 'send nudes', 'show me your tits', 'show me your dick',
      'i want to fuck that professor', 'i want to fuck that ta', 'i want to fuck that classmate',
      'te voy a violar', 'voy a violarte', 'violarte', 'manda nudes',
      'manda fotos desnuda', 'manda fotos desnudo', '강간할', '강간한다', '따먹고싶',
      '몸매평가', '벗은 사진 보내',
    ],
    notes: 'Blocks sexual threats, unsolicited sexual demands, and sexualized comments about students or staff.',
  },
  {
    id: 'doxxing_contact_info',
    category: 'doxxing',
    severity: 'hold_for_review',
    matchType: 'regex',
    language: 'mixed',
    patterns: [
      '\\b(?:drop|post|leak|share|send)\\s+(?:their|his|her|the)\\s+(?:address|phone|number|student\\s*id|email)\\b',
      '\\b(?:\\+?1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}\\b',
      '\\b(?:student\\s*id|ucinetid|uid)\\s*[:#]?\\s*\\d{6,10}\\b',
      '\\b[a-z0-9._%+-]+@(?!uci\\.edu\\b|[a-z0-9.-]*\\.edu\\b)[a-z0-9.-]+\\.[a-z]{2,}\\b',
      '\\b(?:home\\s+address|dorm\\s+room|room\\s+number)\\s*[:#]?\\s*\\d{1,5}\\b',
      '\\b(?:pasa|publica|filtra|manda|comparte)\\s+(?:su|el|la)\\s+(?:direccion|telefono|numero|id\\s+de\\s+estudiante|correo)\\b',
    ],
    notes: 'Holds likely private contact information or requests to expose private data.',
    falsePositiveNotes: 'Official .edu addresses are allowed by the email pattern; Board text remains conservative for phone/student IDs.',
  },
  {
    id: 'targeted_harassment_patterns',
    category: 'targeted_harassment',
    severity: 'hold_for_review',
    matchType: 'regex',
    language: 'mixed',
    patterns: [
      '\\b(?:you|u|your|that\\s+(?:guy|girl|student)|this\\s+(?:guy|girl|student)|professor|prof|ta|classmate)\\b.{0,40}\\b(?:idiot|loser|moron|dumbass|worthless|ugly|fat|creep|trash|piece of shit)\\b',
      '\\b(?:everyone|somebody|someone)\\s+(?:harass|bully|exclude|shame|doxx)\\s+(?:him|her|them|that student|that professor|the ta)\\b',
      '\\b(?:tu|usted|profesor|profesora|estudiante|companero|companera|ese|esa)\\b.{0,40}\\b(?:idiota|perdedor|imbecil|estupido|basura|asqueroso|asquerosa)\\b',
      '(?:너|니가|교수|조교|학생|걔|쟤).{0,20}(?:병신|멍청|못생|뚱뚱|쓰레기|찐따|왕따)',
    ],
    notes: 'Holds targeted bullying, appearance insults, and calls to harass or exclude a person.',
  },
  {
    id: 'general_profanity_en',
    category: 'general_profanity',
    severity: 'warn_or_mask',
    matchType: 'exact_word',
    language: 'en',
    patterns: [
      'fuck', 'fucking', 'shit', 'bullshit', 'bitch', 'asshole', 'dick', 'pussy',
      'bastard', 'damn', 'crap',
    ],
    notes: 'Mild profanity alone is allowed for normal student frustration; targeted or repeated use escalates.',
    falsePositiveNotes: 'Boundary matching prevents terms like "class", "assignment", "pass", "grass", and "analysis" from matching.',
  },
  {
    id: 'general_profanity_es',
    category: 'general_profanity',
    severity: 'warn_or_mask',
    matchType: 'exact_word',
    language: 'es',
    patterns: [
      'mierda', 'joder', 'puta', 'puto', 'pendejo', 'cabron', 'chingar', 'chinga',
    ],
    notes: 'Spanish profanity is warn/mask by default and escalates when targeted or repeated.',
    falsePositiveNotes: 'Exact-word matching and accent folding reduce accidental matches inside longer words.',
  },
  {
    id: 'general_profanity_ko',
    category: 'general_profanity',
    severity: 'warn_or_mask',
    matchType: 'phrase',
    language: 'ko',
    patterns: [
      '씨발', '시발', 'ㅅㅂ', '병신', '지랄', '좆', '존나', '개새끼', '미친',
      '꺼져', '닥쳐', '염병', 'ㅈㄴ', 'ㅂㅅ',
    ],
    notes: 'Korean profanity is warn/mask by default and escalates when targeted or repeated.',
  },
  {
    id: 'spam_scam_patterns',
    category: 'spam_scam',
    severity: 'hold_for_review',
    matchType: 'regex',
    language: 'en',
    patterns: [
      '\\b(?:guaranteed|risk\\s*free)\\s+(?:money|profit|crypto|job)\\b',
      '\\b(?:crypto|bitcoin|forex|nft)\\s+(?:pump|signals?|investment|double your money)\\b',
      '\\bdm\\s+me\\s+for\\s+(?:guaranteed\\s+)?(?:money|job|answers|exam|homework)\\b',
      '\\bdm\\s+para\\s+(?:dinero|trabajo|respuestas|examen)\\s+(?:garantizado|garantizada)?\\b',
      '(?:https?://\\S+\\s*){3,}',
      '\\b(?:bit\\.ly|tinyurl\\.com|t\\.co|goo\\.gl|is\\.gd)/\\S+',
    ],
    notes: 'Holds likely scams, phishing, repeated URLs, and suspicious shortened links.',
  },
  {
    id: 'illegal_transactions',
    category: 'illegal_transactions',
    severity: 'hard_block',
    matchType: 'regex',
    language: 'en',
    patterns: [
      '\\b(?:buy|sell|selling|need|looking for)\\s+(?:weed|cocaine|xanax|adderall|percocet|molly|shrooms|drugs)\\b',
      '\\b(?:fake\\s*id|stolen\\s+(?:exam|account|password)|sell\\s+(?:login|credentials|password))\\b',
      '\\b(?:buy|sell|selling|need)\\s+(?:gun|weapon|ammo|ammunition)\\b',
      '\\b(?:vendo|compro|necesito|busco)\\s+(?:drogas|cocaina|xanax|adderall|armas|municiones)\\b',
      '\\b(?:identificacion\\s+falsa|id\\s+falso|vendo\\s+(?:login|credenciales|contrasena|password))\\b',
    ],
    notes: 'Blocks illegal transactions, controlled-substance sales, credential sales, and weapon sales.',
  },
  {
    id: 'academic_integrity',
    category: 'academic_integrity',
    severity: 'hold_for_review',
    matchType: 'regex',
    language: 'en',
    patterns: [
      '\\b(?:selling|sell|buy|buying|paying for|need)\\s+(?:(?:final|midterm)\\s+exam|exam|midterm|final|quiz)\\s+(?:answers|solutions|leak|leaked)\\b',
      '\\b(?:leaked\\s+(?:exam|midterm|final|quiz)|exam\\s+leak|answer\\s+key)\\b',
      '\\b(?:pay|paid|paying)\\s+(?:someone|somebody|you)\\s+to\\s+(?:take|do)\\s+(?:my|the)\\s+(?:exam|quiz|homework|assignment)\\b',
      '\\b(?:chegg|coursehero)\\s+(?:answers|unlock|service)\\b',
      '\\b(?:vendo|compro|necesito|busco)\\s+(?:respuestas|soluciones)\\s+(?:del\\s+)?(?:examen|midterm|final|quiz)\\b',
      '\\b(?:pago|pagare)\\s+(?:a\\s+)?(?:alguien|una\\s+persona)\\s+para\\s+(?:tomar|hacer)\\s+(?:mi|el)\\s+(?:examen|quiz|tarea)\\b',
    ],
    notes: 'Holds exam leaks, paid cheating, and answer-selling requests.',
    falsePositiveNotes: 'Does not match normal academic stress phrases like "kill the exam" or "bombed the midterm".',
  },
];

export const COMMUNITY_GUIDELINES_MESSAGE = HOLD_FOR_REVIEW_MESSAGE;

export function normalizeModerationText(input: string): NormalizedText {
  const raw = input.normalize('NFKC').toLowerCase();
  const folded = raw
    .replace(/[áàäâãå]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/ㅅ\s*ㅂ/g, 'ㅅㅂ')
    .replace(/ㅈ\s*ㄴ/g, 'ㅈㄴ')
    .replace(/ㅂ\s*ㅅ/g, 'ㅂㅅ');
  const normalized = folded
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[._*~`'"“”‘’()[\]{}<>:;,+/\\|¿¡-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const skeleton = collapseRepeatedLetters(normalized);
  const compact = normalized.replace(/\s+/g, '');
  const compactSkeleton = skeleton.replace(/\s+/g, '');
  return { raw, folded, normalized, skeleton, compact, compactSkeleton };
}

export function evaluateModerationText(
  input: string,
  options: { extraRules?: ModerationPolicyRule[] } = {}
): ModerationResult {
  const text = normalizeModerationText(input);
  const rules = [...MODERATION_POLICY, ...(options.extraRules ?? [])];
  const matchedRules = rules.filter((rule) => ruleMatches(rule, text));
  const matchedCategories = Array.from(new Set(matchedRules.map((rule) => rule.category)));
  const matchedRuleIds = matchedRules.map((rule) => rule.id);
  const baseSeverity = strongestSeverity(matchedRules.map((rule) => rule.severity));
  const profanityMatches = matchedRules.filter((rule) => rule.category === 'general_profanity').length;
  const targetedProfanity = profanityMatches > 0 && hasTargetContext(text);
  const repeatedProfanity = profanityMatches >= 3 || repeatedProfanityTerms(text);
  const escalatedSeverity: ModerationSeverity | 'allow' =
    baseSeverity === 'warn_or_mask' && (targetedProfanity || repeatedProfanity)
      ? 'hold_for_review'
      : baseSeverity;

  const categories: ModerationCategory[] =
    (targetedProfanity || repeatedProfanity) && !matchedCategories.includes('targeted_harassment')
      ? [...matchedCategories, 'targeted_harassment']
      : matchedCategories;

  return {
    allowed: escalatedSeverity === 'allow' || escalatedSeverity === 'warn_or_mask',
    severity: escalatedSeverity,
    categories,
    ruleIds: matchedRuleIds,
  };
}

export function shouldBlockModerationResult(result: ModerationResult) {
  return result.severity === 'hard_block' || result.severity === 'hold_for_review';
}

export function moderationUserMessage(result: ModerationResult) {
  return HOLD_FOR_REVIEW_MESSAGE;
}

export function moderationRulesFromCustomBlocklist(words: string[]): ModerationPolicyRule[] {
  return words
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word, index) => ({
      id: `custom_blocklist_${index}_${stableIdPart(word)}`,
      category: 'targeted_harassment' as ModerationCategory,
      severity: 'hard_block' as ModerationSeverity,
      matchType: 'phrase' as ModerationMatchType,
      language: 'mixed' as ModerationLanguage,
      patterns: [word],
      notes: 'Moderator-managed custom blocklist term.',
    }));
}

function ruleMatches(rule: ModerationPolicyRule, text: NormalizedText) {
  return rule.patterns.some((pattern) => {
    if (rule.matchType === 'regex') return regexMatches(pattern, text);
    if (rule.matchType === 'exact_word') return exactWordMatches(pattern, rule.language, text);
    return phraseMatches(pattern, rule.language, text);
  });
}

function phraseMatches(pattern: string, language: ModerationLanguage, text: NormalizedText) {
  const normalizedPattern = normalizeModerationText(pattern);
  if (language === 'ko' || containsKorean(pattern)) {
    return text.compact.includes(normalizedPattern.compact)
      || text.compactSkeleton.includes(normalizedPattern.compactSkeleton);
  }
  return text.normalized.includes(normalizedPattern.normalized)
    || text.skeleton.includes(normalizedPattern.skeleton)
    || looseWordSequenceRegex(normalizedPattern.normalized).test(text.folded);
}

function exactWordMatches(pattern: string, language: ModerationLanguage, text: NormalizedText) {
  const normalizedPattern = normalizeModerationText(pattern);
  if (language === 'ko' || containsKorean(pattern)) {
    return phraseMatches(pattern, language, text);
  }
  const safePattern = escapeRegex(normalizedPattern.normalized);
  const boundaryPattern = new RegExp(`(^|[^a-z0-9])${safePattern}([^a-z0-9]|$)`, 'i');
  return boundaryPattern.test(text.normalized)
    || boundaryPattern.test(text.skeleton)
    || looseExactWordRegex(normalizedPattern.normalized).test(text.folded);
}

function regexMatches(pattern: string, text: NormalizedText) {
  const regex = new RegExp(pattern, 'i');
  return regex.test(text.raw)
    || regex.test(text.normalized)
    || regex.test(text.skeleton)
    || regex.test(text.compact)
    || regex.test(text.compactSkeleton);
}

function strongestSeverity(severities: ModerationSeverity[]): ModerationSeverity | 'allow' {
  if (severities.includes('hard_block')) return 'hard_block';
  if (severities.includes('hold_for_review')) return 'hold_for_review';
  if (severities.includes('warn_or_mask')) return 'warn_or_mask';
  return 'allow';
}

function hasTargetContext(text: NormalizedText) {
  return /\b(?:you|your|professor|prof|ta|student|classmate|him|her|them|that guy|that girl|this guy|this girl|tu|tus|usted|profesor|profesora|estudiante|companero|companera|el|ella|ellos|ellas|ese|esa)\b/i.test(text.normalized)
    || /(?:너|니|교수|조교|학생|걔|쟤)/.test(text.normalized);
}

function repeatedProfanityTerms(text: NormalizedText) {
  let count = 0;
  for (const rule of MODERATION_POLICY.filter((entry) => entry.category === 'general_profanity')) {
    for (const pattern of rule.patterns) {
      if (rule.matchType === 'exact_word' && exactWordMatches(pattern, rule.language, text)) count += 1;
      if (rule.matchType === 'phrase' && phraseMatches(pattern, rule.language, text)) count += 1;
    }
  }
  return count >= 3;
}

function collapseRepeatedLetters(value: string) {
  return value.replace(/([a-z])\1{1,}/g, '$1');
}

function looseExactWordRegex(word: string) {
  return new RegExp(`(^|[^a-z0-9])${looseCharacters(word)}([^a-z0-9]|$)`, 'i');
}

function looseWordSequenceRegex(value: string) {
  return new RegExp(value.split(/\s+/).map(looseCharacters).join('[^a-z0-9]+'), 'i');
}

function looseCharacters(value: string) {
  return value
    .split('')
    .map((char) => LETTER_OR_NUMBER.test(char) ? `${escapeRegex(char)}+[^a-z0-9]*` : escapeRegex(char))
    .join('');
}

function containsKorean(value: string) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(value);
}

function stableIdPart(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
