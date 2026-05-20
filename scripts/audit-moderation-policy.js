#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const policyPath = path.join(repoRoot, 'src/data/moderationPolicy.ts');
const source = fs.readFileSync(policyPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: policyPath,
});

const policyModule = new Module(policyPath, module.parent);
policyModule.filename = policyPath;
policyModule.paths = Module._nodeModulePaths(path.dirname(policyPath));
policyModule._compile(compiled.outputText, policyPath);

const {
  MODERATION_POLICY,
  evaluateModerationText,
  shouldBlockModerationResult,
} = policyModule.exports;

const requiredCategories = [
  'identity_hate',
  'direct_threat',
  'self_harm_encouragement',
  'sexual_harassment',
  'doxxing',
  'targeted_harassment',
  'general_profanity',
  'spam_scam',
  'illegal_transactions',
  'academic_integrity',
];

const requiredSeverities = ['hard_block', 'hold_for_review', 'warn_or_mask'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const category of requiredCategories) {
  assert(MODERATION_POLICY.some((rule) => rule.category === category), `Missing category: ${category}`);
}

for (const severity of requiredSeverities) {
  assert(MODERATION_POLICY.some((rule) => rule.severity === severity), `Missing severity: ${severity}`);
}

const tests = [
  { name: 'hard block identity slur', text: 'That student is a n1gga', severity: 'hard_block', blocked: true },
  { name: 'hard block Spanish identity slur', text: 'Ese estudiante es maricón', severity: 'hard_block', blocked: true },
  { name: 'hard block Korean identity slur', text: '그 학생은 짱깨라고 불렀다', severity: 'hard_block', blocked: true },
  { name: 'hard block direct threat', text: "I'm going to shoot the campus", severity: 'hard_block', blocked: true },
  { name: 'hard block Spanish direct threat', text: 'te voy a matar', severity: 'hard_block', blocked: true },
  { name: 'hard block self-harm encouragement', text: 'go die', severity: 'hard_block', blocked: true },
  { name: 'hard block Spanish self-harm encouragement', text: 'mátate', severity: 'hard_block', blocked: true },
  { name: 'hard block sexual threat', text: 'I will rape you', severity: 'hard_block', blocked: true },
  { name: 'hold targeted insult', text: 'you are a dumbass', severity: 'hold_for_review', blocked: true },
  { name: 'hold Spanish targeted profanity', text: 'tu eres pendejo', severity: 'hold_for_review', blocked: true },
  { name: 'warn mild profanity', text: 'this midterm was f u c k i n g rough', severity: 'warn_or_mask', blocked: false },
  { name: 'warn Spanish profanity', text: 'este quiz fue m i e r d a', severity: 'warn_or_mask', blocked: false },
  { name: 'warn Korean profanity', text: 'ㅅ ㅂ this quiz was rough', severity: 'warn_or_mask', blocked: false },
  { name: 'hold Korean targeted profanity', text: '너 병신이야', severity: 'hold_for_review', blocked: true },
  { name: 'hold doxxing phrase', text: 'drop their phone number here', severity: 'hold_for_review', blocked: true },
  { name: 'hold Spanish doxxing phrase', text: 'filtra su telefono aqui', severity: 'hold_for_review', blocked: true },
  { name: 'hold spam scam', text: 'DM me for guaranteed money', severity: 'hold_for_review', blocked: true },
  { name: 'hold academic integrity risk', text: 'selling final exam answers', severity: 'hold_for_review', blocked: true },
  { name: 'punctuated English profanity', text: 'f.u.c.k this worksheet', severity: 'warn_or_mask', blocked: false },
  { name: 'punctuated Korean profanity', text: '씨.발 this worksheet', severity: 'warn_or_mask', blocked: false },
  { name: 'false positive class', text: 'class starts at noon', severity: 'allow', blocked: false },
  { name: 'false positive assignment', text: 'assignment due tonight', severity: 'allow', blocked: false },
  { name: 'false positive analysis', text: 'analysis section helped', severity: 'allow', blocked: false },
  { name: 'false positive pass', text: 'I hope I pass', severity: 'allow', blocked: false },
  { name: 'false positive grass', text: 'meet on the grass by Aldrich', severity: 'allow', blocked: false },
  { name: 'false positive dead week', text: 'dead week is packed', severity: 'allow', blocked: false },
  { name: 'false positive bombed midterm', text: 'I bombed the midterm', severity: 'allow', blocked: false },
  { name: 'false positive kill exam', text: 'we are going to kill the exam', severity: 'allow', blocked: false },
  { name: 'false positive Spanish classmate', text: 'mi companero de clase fue amable', severity: 'allow', blocked: false },
];

const failures = [];
for (const test of tests) {
  const result = evaluateModerationText(test.text);
  const blocked = shouldBlockModerationResult(result);
  if (result.severity !== test.severity || blocked !== test.blocked) {
    failures.push({
      name: test.name,
      expected: { severity: test.severity, blocked: test.blocked },
      actual: { severity: result.severity, blocked },
    });
  }
}

if (failures.length > 0) {
  console.error(`Moderation policy audit failed: ${failures.length} failing case(s).`);
  for (const failure of failures) {
    console.error(`- ${failure.name}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`);
  }
  process.exit(1);
}

console.log(`Moderation policy audit passed: ${tests.length} cases, ${MODERATION_POLICY.length} policy rules.`);
