const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['App.tsx', 'src'];
const EXTENSIONS = new Set(['.tsx']);
const ALLOWLIST_MARKER = 'text-autoshrink-ok';
const MIN_ALLOWED_SCALE = 0.85;

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

function nearbyLines(lines, lineIndex, radius = 4) {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length, lineIndex + radius + 1);
  return lines.slice(start, end).join('\n');
}

function minimumScaleFor(source, matchIndex) {
  const textTagStart = source.lastIndexOf('<Text', matchIndex);
  const tagStart = textTagStart >= 0 ? textTagStart : matchIndex;
  const tagEnd = source.indexOf('>', matchIndex);
  const tagText = source.slice(tagStart, tagEnd >= 0 ? tagEnd + 1 : matchIndex + 160);
  const match = tagText.match(/minimumFontScale\s*=\s*(?:\{(\d+(?:\.\d+)?)\}|["'](\d+(?:\.\d+)?)["'])/);
  if (!match) return null;
  return Number(match[1] ?? match[2]);
}

const findings = [];
const allowed = [];

for (const target of TARGETS) {
  for (const file of walk(target)) {
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split('\n');
    const re = /adjustsFontSizeToFit/g;
    let match;
    while ((match = re.exec(source))) {
      const line = lineNumber(source, match.index);
      const context = nearbyLines(lines, line - 1);
      const rel = path.relative(ROOT, file);
      if (!context.includes(ALLOWLIST_MARKER)) {
        findings.push({
          file: rel,
          line,
          issue: `missing ${ALLOWLIST_MARKER} allowlist comment`,
        });
        continue;
      }

      const scale = minimumScaleFor(source, match.index);
      if (scale == null || scale < MIN_ALLOWED_SCALE) {
        findings.push({
          file: rel,
          line,
          issue: `allowed autoshrink must set minimumFontScale >= ${MIN_ALLOWED_SCALE}`,
        });
        continue;
      }

      allowed.push({ file: rel, line, scale });
    }
  }
}

console.log(`Text autoshrink findings: ${findings.length}`);
for (const finding of findings) {
  console.log(`${finding.file}:${finding.line} ${finding.issue}`);
}

if (allowed.length > 0) {
  console.log(`Allowed autoshrink usages: ${allowed.length}`);
  for (const item of allowed) {
    console.log(`${item.file}:${item.line} minimumFontScale=${item.scale}`);
  }
}

if (findings.length > 0) {
  process.exitCode = 1;
}
