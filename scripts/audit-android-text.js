// Static Android text-risk audit.
//
// This catches layout patterns that commonly look fine on iOS but clip,
// ellipsize, or wrap unexpectedly on Android due to different font metrics.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['App.tsx', 'src'];
const EXTENSIONS = new Set(['.tsx']);

function walk(entry, files = []) {
  const full = path.join(ROOT, entry);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(full)) {
      walk(path.join(entry, child), files);
    }
  } else if (EXTENSIONS.has(path.extname(full))) {
    files.push(full);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function getTextOpenTags(source) {
  const tags = [];
  const re = /<Text\b[\s\S]*?>/g;
  let match;
  while ((match = re.exec(source))) {
    tags.push({ text: match[0], index: match.index });
  }
  return tags;
}

function hasSingleLine(tag) {
  return /numberOfLines\s*=\s*(?:\{1\}|"1")/.test(tag);
}

function hasFitGuard(tag) {
  return /adjustsFontSizeToFit/.test(tag) && /minimumFontScale/.test(tag);
}

function hasTailEllipsis(tag) {
  return /ellipsizeMode\s*=\s*["']tail["']/.test(tag);
}

function hasTextOverflowGuard(tag) {
  return hasFitGuard(tag) || hasTailEllipsis(tag);
}

function hasNegativeLetterSpacing(tag) {
  return /letterSpacing\s*:\s*-\d/.test(tag);
}

function getFontSize(tag) {
  const match = tag.match(/fontSize\s*:\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function getLineHeight(tag) {
  const match = tag.match(/lineHeight\s*:\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function isTightLineHeight(tag) {
  const fontSize = getFontSize(tag);
  const lineHeight = getLineHeight(tag);
  return fontSize != null && lineHeight != null && lineHeight < Math.ceil(fontSize * 1.15);
}

const findings = [];

for (const target of TARGETS) {
  for (const file of walk(target)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const tag of getTextOpenTags(source)) {
      const issues = [];
      if (hasNegativeLetterSpacing(tag.text)) issues.push('negative-letter-spacing');
      if (hasSingleLine(tag.text) && !hasTextOverflowGuard(tag.text)) issues.push('single-line-no-fit-guard');
      if (isTightLineHeight(tag.text)) issues.push('tight-line-height');
      if (!issues.length) continue;

      findings.push({
        file: path.relative(ROOT, file),
        line: lineNumber(source, tag.index),
        issues,
        sample: tag.text.replace(/\s+/g, ' ').slice(0, 180),
      });
    }
  }
}

const severityOrder = {
  'negative-letter-spacing': 0,
  'single-line-no-fit-guard': 1,
  'single-line-tail-ellipsis': 2,
  'tight-line-height': 3,
};

findings.sort((a, b) => {
  const aRank = Math.min(...a.issues.map((issue) => severityOrder[issue] ?? 99));
  const bRank = Math.min(...b.issues.map((issue) => severityOrder[issue] ?? 99));
  return aRank - bRank || a.file.localeCompare(b.file) || a.line - b.line;
});

console.log(`Android text-risk findings: ${findings.length}`);
for (const finding of findings) {
  console.log(`${finding.file}:${finding.line} ${finding.issues.join(', ')}`);
  console.log(`  ${finding.sample}`);
}

if (findings.length > 0) {
  process.exitCode = 1;
}
