'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const markdown = require('./lesson-markdown');
const { phaseSlug, phasePath, cheatsheetPath } = require('../lib/hub-routes');
const { SITE_HEADER } = require('./build-hubs');
const { versionHtml } = require('./version-assets');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const REPO = 'https://github.com/rohitg00/ai-engineering-from-scratch';
const ISSUES_URL = `${REPO}/issues`;
const AUTHOR = 'Rohit Ghumare';
const LICENSE = 'MIT license';
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = 'cheatsheets';
const BASE = '/cheatsheets';
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const THEME_SCRIPT = "(function(){var r=document.documentElement,s='';try{s=localStorage.getItem('theme')||'';}catch(_){}r.setAttribute('data-theme',s||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));function i(){var e=document.getElementById('themeIcon');if(e)e.textContent=r.getAttribute('data-theme')==='light'?'N':'D';}document.addEventListener('DOMContentLoaded',function(){i();var b=document.getElementById('themeToggle');if(b)b.addEventListener('click',function(){var n=r.getAttribute('data-theme')==='light'?'dark':'light';r.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(_){}i();});});})();";
const CODE_LANGS = { python: 'Python', py: 'Python', typescript: 'TypeScript', ts: 'TypeScript', javascript: 'JavaScript', js: 'JavaScript', rust: 'Rust', rs: 'Rust', julia: 'Julia', jl: 'Julia' };
const LIMITS = {
  objectives: 6,
  formulas: 8,
  formulaLines: 8,
  terms: 12,
  signatures: 12,
  practiceLines: 16,
  stepLines: 16,
  steps: 4,
  pitfalls: 6,
  phaseFormulas: 2,
  phaseFormulaChars: 140,
  phaseTerms: 5,
  phaseSignatures: 4,
  termChars: 240,
  phaseTermChars: 96,
};
const THIN_ITEMS = 6;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function numberOf(name) {
  const match = /^(\d+)-/.exec(name);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function byNumber(a, b) {
  return numberOf(a) - numberOf(b) || (a < b ? -1 : a > b ? 1 : 0);
}

function stripLinks(text) {
  return String(text).replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1');
}

function inline(text) {
  return markdown.inlineFormat(stripLinks(text));
}

function plain(text) {
  return stripLinks(text).replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+/g, ' ').trim();
}

function clip(text, max) {
  const value = String(text).replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  const sentence = value.split(/(?<=[.!?])\s+/)[0];
  if (sentence.length <= max && sentence.length >= max * 0.45) return sentence;
  const cut = value.slice(0, max + 1);
  let end = cut.lastIndexOf(' ');
  if (end < max * 0.6) end = max;
  let head = value.slice(0, end).replace(/[\s,;:(]+$/, '');
  if ((head.match(/`/g) || []).length % 2) head = head.slice(0, head.lastIndexOf('`')).replace(/[\s,;:(]+$/, '');
  if ((head.match(/\$/g) || []).length % 2) head = head.slice(0, head.lastIndexOf('$')).replace(/[\s,;:(]+$/, '');
  return `${head}…`;
}

function scanLesson(source) {
  const lines = source.split(/\r?\n/);
  const sections = [];
  let current = { title: '', lines: [], blocks: [] };
  let h3 = '';
  let fence = null;
  let para = [];
  let lastPara = '';
  sections.push(current);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (/^\s*```\s*$/.test(line)) {
        current.blocks.push({ lang: fence.lang, text: fence.lines.join('\n'), heading: fence.heading, lead: fence.lead });
        fence = null;
      } else {
        fence.lines.push(line);
      }
      continue;
    }
    const open = /^\s*```\s*([\w+-]*)/.exec(line);
    if (open) {
      if (para.length) lastPara = para.join(' ');
      para = [];
      fence = { lang: open[1].toLowerCase(), lines: [], heading: h3 || current.title, lead: lastPara };
      lastPara = '';
      continue;
    }
    if (line.trim() === '$$') {
      const tex = [];
      while (++i < lines.length && lines[i].trim() !== '$$') tex.push(lines[i]);
      current.blocks.push({ lang: 'math', text: tex.join('\n'), heading: h3 || current.title });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && heading[1].length <= 2) {
      current = { title: heading[1].length === 1 ? '' : heading[2], level: heading[1].length, lines: [], blocks: [] };
      if (heading[1].length === 1) current.h1 = heading[2];
      sections.push(current);
      h3 = '';
      para = [];
      lastPara = '';
      continue;
    }
    if (heading) {
      h3 = heading[2];
      para = [];
      lastPara = '';
    } else if (!line.trim()) {
      if (para.length) lastPara = para.join(' ');
      para = [];
    } else if (!/^\s*(?:[-*+>|]|\d+[.)]\s|!\[|<|\*\*[^*]+:\*\*)/.test(line)) {
      para.push(line.trim());
    }
    current.lines.push(line);
  }
  return sections;
}

function sectionText(section) {
  return section.title.replace(/[*_`]/g, '').trim().toLowerCase();
}

function findSection(sections, test) {
  return sections.find(section => section.title && test(sectionText(section)));
}

function bullets(lines) {
  const items = [];
  for (const line of lines) {
    const match = /^(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (match) items.push(match[1].trim());
    else if (items.length && /^\s{2,}\S/.test(line) && !/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

function tableRows(lines) {
  const rows = [];
  let header = null;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) {
      if (header && rows.length) break;
      continue;
    }
    const cells = markdown.splitTableRow(line.trim());
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) continue;
    if (!header) header = cells;
    else rows.push(cells);
  }
  return { header: header || [], rows };
}

function readMeta(lines) {
  const meta = {};
  for (const line of lines) {
    const match = /^\*\*([^*]+):\*\*\s*(.+)$/.exec(line.trim());
    if (match) meta[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return meta;
}

function hookOf(lines) {
  const line = lines.find(item => /^>\s+\S/.test(item));
  return line ? line.replace(/^>\s+/, '').trim() : '';
}

function pythonSignatures(text) {
  const out = [];
  const lines = text.split('\n');
  let currentClass = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cls = /^class\s+([A-Za-z_]\w*)\s*(\([^)]*\))?\s*:/.exec(line);
    if (cls) {
      currentClass = { name: cls[1], kind: 'class', text: `class ${cls[1]}${cls[2] && cls[2] !== '()' ? cls[2] : ''}`, methods: [] };
      out.push(currentClass);
      continue;
    }
    const def = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(line);
    if (!def) {
      if (/^\S/.test(line) && !/^(?:@|#)/.test(line)) currentClass = null;
      continue;
    }
    let header = line.trim();
    let j = i;
    const end = /\)\s*(?:->\s*[^:]+)?:/;
    while (!end.test(header) && j + 1 < lines.length && j - i < 16) header += ` ${lines[++j].trim()}`;
    const stop = end.exec(header);
    if (stop) header = header.slice(0, stop.index + stop[0].length);
    const params = (/\((.*)\)/.exec(header) || [, ''])[1].replace(/\s+/g, ' ').trim().replace(/,$/, '').replace(/^(?:self|cls)\s*(?:,\s*|$)/, '');
    const returns = (/\)\s*->\s*([^:]+):/.exec(header) || [, ''])[1].trim();
    const name = def[2];
    if (def[1].length === 0) {
      currentClass = null;
      if (name.startsWith('_') || name === 'main') continue;
      out.push({ name, kind: 'def', text: `${name}(${params})${returns ? ` -> ${returns}` : ''}` });
    } else if (currentClass && def[1].length <= 4) {
      if (name === '__init__') {
        const args = params.split(',').map(item => item.trim()).filter(Boolean);
        currentClass.text = args.length ? `class ${currentClass.name}(${args.join(', ')})` : `class ${currentClass.name}`;
      } else if (!name.startsWith('_') || name === '__call__') {
        currentClass.methods.push(name);
      }
    }
  }
  return out;
}

function otherSignatures(text, lang) {
  const out = [];
  const patterns = {
    TypeScript: [/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(<[^>]*>)?\(([^)]*)\)\s*(?::\s*([^{]+))?/, /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/],
    JavaScript: [/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*()\(([^)]*)\)()/, /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/],
    Rust: [/^(?:pub\s+)?fn\s+([A-Za-z_]\w*)\s*(<[^>]*>)?\(([^)]*)\)\s*(?:->\s*([^{]+))?/, /^(?:pub\s+)?struct\s+([A-Za-z_]\w*)/],
    Julia: [/^function\s+([A-Za-z_]\w*!?)\s*()\(([^)]*)\)()/, /^(?:mutable\s+)?struct\s+([A-Za-z_]\w*)/],
  }[lang];
  if (!patterns) return out;
  for (const line of text.split('\n')) {
    const fn = patterns[0].exec(line);
    if (fn) {
      const returns = (fn[4] || '').trim();
      const arrow = lang === 'Rust' ? ' -> ' : ': ';
      out.push({ name: fn[1], kind: 'def', text: `${fn[1]}(${fn[3].replace(/\s+/g, ' ').trim()})${returns ? arrow + returns : ''}` });
      continue;
    }
    const type = patterns[1].exec(line);
    if (type) out.push({ name: type[1], kind: 'class', text: `${lang === 'Rust' || lang === 'Julia' ? 'struct' : 'class'} ${type[1]}`, methods: [] });
  }
  return out;
}

function signaturesFor(blocks, languages) {
  const byLang = new Map();
  for (const block of blocks) {
    const lang = CODE_LANGS[block.lang];
    if (!lang) continue;
    const found = lang === 'Python' ? pythonSignatures(block.text) : otherSignatures(block.text, lang);
    if (!found.length) continue;
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push(...found);
  }
  if (!byLang.size) return { lang: '', items: [], others: [] };
  const order = String(languages || '').split(',').map(item => item.trim()).filter(Boolean);
  const langs = Array.from(byLang.keys());
  const lang = order.find(item => byLang.has(item)) || langs[0];
  const seen = new Set();
  const items = [];
  for (const item of byLang.get(lang)) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    items.push(item);
  }
  return { lang, items: items.slice(0, LIMITS.signatures), others: langs.filter(item => item !== lang) };
}

function firstSentences(text, max) {
  let out = '';
  for (const sentence of String(text).split(/(?<=[.!?])\s+(?=[A-Z`*])/)) {
    if (out && out.length + sentence.length > max) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return clip(out, max + 60);
}

function stepsFor(blocks) {
  const seen = new Set();
  const out = [];
  for (const block of blocks) {
    if (!CODE_LANGS[block.lang] || !block.heading || seen.has(block.heading)) continue;
    const lines = block.text.replace(/\s+$/, '').split('\n');
    if (lines.filter(line => line.trim()).length < 3) continue;
    seen.add(block.heading);
    let code = lines;
    let cut = false;
    if (lines.length > LIMITS.stepLines) {
      let end = LIMITS.stepLines;
      for (let i = LIMITS.stepLines; i >= 8; i--) {
        if (!lines[i].trim()) {
          end = i;
          break;
        }
      }
      code = lines.slice(0, end);
      cut = true;
    }
    out.push({ heading: plain(block.heading), lead: block.lead ? firstSentences(block.lead, 180) : '', lang: block.lang, code: code.join('\n').replace(/\s+$/, ''), cut });
    if (out.length === LIMITS.steps) break;
  }
  return out;
}

function excerptsFor(files) {
  const file = files.find(item => item.lang === 'python');
  if (!file) return [];
  const lines = file.text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length && out.length < LIMITS.steps - 1; i++) {
    const match = /^(?:async\s+)?(def|class)\s+([A-Za-z]\w*)/.exec(lines[i]);
    if (!match || match[2] === 'main') continue;
    let end = i + 1;
    while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]))) end++;
    let start = i;
    while (start > 0 && /^@/.test(lines[start - 1])) start--;
    const body = lines.slice(start, end).join('\n').replace(/\s+$/, '');
    const count = body.split('\n').length;
    if (count >= 4 && count <= LIMITS.stepLines) out.push({ heading: `${match[2]} · ${file.file}`, lead: '', lang: 'python', code: body, cut: false });
    i = end - 1;
  }
  return out;
}

function practiceFor(blocks) {
  for (const block of blocks) {
    if (!CODE_LANGS[block.lang]) continue;
    const lines = block.text.replace(/\s+$/, '').split('\n');
    const filled = lines.filter(line => line.trim());
    if (filled.length < 2 || lines.length > LIMITS.practiceLines) continue;
    return { lang: block.lang, code: lines.join('\n'), heading: block.heading };
  }
  return null;
}

function formulasFor(sections) {
  const seen = new Set();
  const out = [];
  for (const section of sections) {
    if (/^summary\b/.test(sectionText(section))) continue;
    for (const block of section.blocks) {
      if (block.lang !== 'math') continue;
      const tex = block.text.trim();
      if (!tex || seen.has(tex) || tex.split('\n').length > LIMITS.formulaLines) continue;
      seen.add(tex);
      const label = plain(block.heading || section.title).replace(/^step\s+\d+[:.]?\s*/i, '');
      out.push({ label: /^(?:the )?(?:problem|concept|build it|use it|ship it|key insight|intuition|math)$/i.test(label) ? 'Key formula' : label, tex });
    }
  }
  return out.slice(0, LIMITS.formulas);
}

function pitfallsFor(sections) {
  const section = findSection(sections, text => /^(?:common )?pitfalls\b|failure modes\b/.test(text));
  let lines = section ? section.lines : [];
  if (!section) {
    for (const candidate of sections) {
      const start = candidate.lines.findIndex(line => /^###\s+.*(?:pitfalls|failure modes)\b/i.test(line));
      if (start < 0) continue;
      const end = candidate.lines.findIndex((line, index) => index > start && /^#{3,6}\s/.test(line));
      lines = candidate.lines.slice(start + 1, end < 0 ? undefined : end);
      break;
    }
  }
  if (!lines.length) return [];
  return bullets(lines).map(item => {
    const lead = /^\*\*(.+?)\*\*[.:]?\s*(.*)$/.exec(item);
    if (lead) return { lead: lead[1].replace(/[.:]$/, ''), text: clip(plain(lead[2]), 120) };
    return { lead: '', text: clip(item, 140) };
  }).slice(0, LIMITS.pitfalls);
}

const CODE_FILES = [['main.py', 'python'], ['main.ts', 'typescript'], ['main.js', 'javascript'], ['main.rs', 'rust'], ['main.jl', 'julia']];

function codeFilesOf(lessonDir) {
  const dir = path.join(lessonDir, 'code');
  return CODE_FILES
    .filter(([name]) => fs.existsSync(path.join(dir, name)))
    .map(([name, lang]) => ({ lang, text: fs.readFileSync(path.join(dir, name), 'utf8'), file: `code/${name}` }));
}

function outputsOf(lessonDir) {
  const dir = path.join(lessonDir, 'outputs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => entry.name + (entry.isDirectory() ? '/' : ''))
    .sort();
}

function termsOf(section, table) {
  if (table.rows.length) {
    return table.rows
      .filter(row => row.length >= 2 && row[0])
      .map(row => ({ term: row[0], means: row[row.length - 1] }));
  }
  if (!section) return [];
  return bullets(section.lines)
    .map(item => /^\*\*(.+?)\*\*\s*[:.\-]?\s*(.+)$/.exec(item))
    .filter(Boolean)
    .map(match => ({ term: match[1].replace(/[:.]$/, ''), means: match[2].replace(/^[:\-]\s*/, '') }));
}

function problemOf(sections) {
  const section = findSection(sections, text => /^(?:the )?problem\b/.test(text));
  if (!section) return '';
  const paragraph = [];
  for (const line of section.lines) {
    if (!line.trim()) {
      if (paragraph.length) break;
      continue;
    }
    if (/^\s*(?:[-*+>|#]|\d+[.)]\s|!\[|<)/.test(line)) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  let out = '';
  for (const sentence of paragraph.join(' ').split(/(?<=[.!?:])\s+(?=[A-Z"])/)) {
    if (/:$/.test(sentence)) break;
    if (out && out.length + sentence.length > 320) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return clip(out, 420);
}

function extractLesson(source, info = {}) {
  const sections = scanLesson(source);
  const top = sections.find(section => section.h1) || sections[0];
  const intro = sections[0].lines.concat(top === sections[0] ? [] : top.lines);
  const meta = readMeta(intro);
  const objectives = findSection(sections, text => text === 'learning objectives');
  const terms = findSection(sections, text => /^key terms\b/.test(text));
  const summary = findSection(sections, text => /^summary\b/.test(text));
  const build = sections.filter(section => /^build\b/.test(sectionText(section)));
  const use = sections.filter(section => /^use\b/.test(sectionText(section)));
  const termTable = terms ? tableRows(terms.lines) : { header: [], rows: [] };
  let signatures = signaturesFor(build.flatMap(section => section.blocks), meta.languages);
  if (!signatures.items.length && info.code && info.code.length) {
    signatures = signaturesFor(info.code, meta.languages);
    const file = info.code.find(item => CODE_LANGS[item.lang] === signatures.lang);
    signatures.file = file ? file.file : '';
  }
  const summaryBody = summary ? summary.lines.join('\n').trim() : '';
  const summaryTable = summary ? tableRows(summary.lines) : { rows: [] };
  return {
    path: info.path || '',
    dir: info.dir || '',
    number: info.number || '',
    title: (top.h1 || info.title || '').trim(),
    hook: hookOf(intro),
    problem: problemOf(sections),
    type: meta.type || '',
    languages: meta.languages || '',
    prerequisites: meta.prerequisites || '',
    time: meta.time || '',
    objectives: objectives ? bullets(objectives.lines).slice(0, LIMITS.objectives) : [],
    summary: summaryBody ? { markdown: summaryBody, rows: summaryTable.rows.length + bullets(summary.lines).length } : null,
    formulas: formulasFor(sections),
    terms: termsOf(terms, termTable).slice(0, LIMITS.terms),
    termNames: termsOf(terms, termTable).map(item => plain(item.term)),
    signatures,
    practice: practiceFor(use.flatMap(section => section.blocks)),
    steps: (() => {
      const steps = stepsFor(build.flatMap(section => section.blocks));
      return steps.length ? steps : excerptsFor(info.code || []);
    })(),
    pitfalls: pitfallsFor(sections),
    outputs: info.outputs || [],
    hash: sha(source).slice(0, 12),
  };
}

function itemCount(card) {
  return card.objectives.length + card.formulas.length + card.terms.length + card.signatures.items.length
    + card.pitfalls.length + (card.summary ? Math.max(1, card.summary.rows) : 0) + (card.practice ? 1 : 0);
}

function imageOf(source, lessonDir, root, prefix) {
  let fence = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const match = /!\[([^\]]*)\]\(([^)\s]+\.(?:svg|png|jpg|jpeg|webp))\)/i.exec(line);
    if (!match || /^[a-z]+:/i.test(match[2])) continue;
    const file = path.resolve(lessonDir, 'docs', match[2]);
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file)) continue;
    const name = `${prefix}-${path.basename(file).toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
    return { alt: plain(match[1]) || 'Diagram from the lesson', file, name, href: `${BASE}/img/${name}` };
  }
  return null;
}

function readPhaseInfo(dir, name) {
  const readme = path.join(dir, 'README.md');
  const text = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : '';
  const title = /^#\s+Phase\s+(\d+)\s*[:·-]\s*(.+?)\s*$/m.exec(text);
  const number = String(numberOf(name)).padStart(2, '0');
  const fallback = phaseSlug(name).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return { number, name: title ? title[2].trim() : fallback, hook: hookOf(text.split(/\r?\n/)) };
}

function collect(root = REPO_ROOT) {
  const phasesDir = path.join(root, 'phases');
  const phases = [];
  for (const name of fs.readdirSync(phasesDir).filter(item => /^\d+-/.test(item)).sort(byNumber)) {
    const dir = path.join(phasesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const info = readPhaseInfo(dir, name);
    const slug = phaseSlug(name);
    const phase = { dir: name, slug, number: info.number, name: info.name, hook: info.hook, ...phaseStyle(info.number), href: cheatsheetPath(`phases/${name}`), hub: phasePath(slug), lessons: [] };
    for (const lessonName of fs.readdirSync(dir).filter(item => /^\d+-/.test(item)).sort(byNumber)) {
      const file = path.join(dir, lessonName, 'docs', 'en.md');
      if (!fs.existsSync(file)) continue;
      const lessonPath = `phases/${name}/${lessonName}`;
      const card = extractLesson(fs.readFileSync(file, 'utf8'), {
        path: lessonPath,
        dir: lessonName,
        number: String(numberOf(lessonName)).padStart(2, '0'),
        outputs: outputsOf(path.join(dir, lessonName)),
        code: codeFilesOf(path.join(dir, lessonName)),
      });
      card.href = cheatsheetPath(lessonPath);
      card.image = imageOf(fs.readFileSync(file, 'utf8'), path.join(dir, lessonName), root, `${slug}-${lessonName}`);
      card.lessonUrl = `/lesson?path=${lessonPath}`;
      card.sourceUrl = `${REPO}/blob/main/${lessonPath}/docs/en.md`;
      card.phase = phase;
      card.items = itemCount(card);
      phase.lessons.push(card);
    }
    if (phase.lessons.length) phases.push(phase);
  }
  phases.forEach((phase, index) => {
    phase.previous = phases[index - 1] || null;
    phase.next = phases[index + 1] || null;
    phase.lessons.forEach((card, position) => {
      card.previous = phase.lessons[position - 1] || null;
      card.next = phase.lessons[position + 1] || null;
    });
  });
  return phases;
}

const PHASE_STYLE = [
  ['ST', 222], ['MF', 262], ['ML', 300], ['DL', 340], ['CV', 12], ['NL', 32], ['SA', 172], ['TF', 200],
  ['GA', 280], ['RL', 150], ['LM', 232], ['LE', 318], ['MM', 186], ['TP', 24], ['AE', 248], ['AS', 132],
  ['MA', 352], ['IP', 210], ['ES', 98], ['CP', 44],
];
const ROW_UNIT = 8;
const CARD_GAP = 20;

function phaseStyle(number) {
  const entry = PHASE_STYLE[Number(number)] || ['·', 222];
  return { glyph: entry[0], hue: entry[1] };
}

function mathHtml(tex, display) {
  return display
    ? `<div class="math-display" data-math="display">${escapeHtml(tex)}</div>`
    : `<span class="math-inline" data-math="inline">${escapeHtml(tex)}</span>`;
}

function codeHtml(code, lang) {
  return `<div class="cs-code"><button type="button" class="cs-copy" data-copy aria-label="Copy code">Copy</button><pre><code>${markdown.highlightSyntax(String(code).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), lang)}</code></pre></div>`;
}

function slugOf(text) {
  return plain(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'card';
}

function idMaker() {
  const used = new Map(['main', 'start-here', 'key-ideas', 'code'].map(name => [name, 1]));
  return text => {
    const base = slugOf(text);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

function textOf(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, 'x').replace(/\s+/g, ' ').trim();
}

function linesOf(text, perLine) {
  return Math.max(1, Math.ceil(text.length / perLine));
}

function estimateHeight(body, note) {
  let height = 24 + 22 + (note ? 12 + 16 * linesOf(textOf(note), 52) : 0);
  let rest = body;
  rest = rest.replace(/<div class="cs-code">[\s\S]*?<\/code><\/pre><\/div>/g, block => {
    height += 46 + 19 * (block.match(/\n/g) || []).length + 19;
    return '';
  });
  rest = rest.replace(/<pre class="cs-sig">[\s\S]*?<\/pre>/g, block => {
    height += 30 + 17 * linesOf(textOf(block), 44);
    return '';
  });
  rest = rest.replace(/<div class="math-display"[^>]*>([\s\S]*?)<\/div>/g, (block, tex) => {
    const rows = (tex.match(/\\\\/g) || []).length + 1;
    const tall = /\\(?:frac|sum|prod|int|begin|left|underset|overset)/.test(tex) ? 14 : 0;
    height += 24 + rows * (26 + tall);
    return '';
  });
  rest = rest.replace(/<tr>([\s\S]*?)<\/tr>/g, (row, cells) => {
    const parts = cells.split(/<\/th>|<\/td>/).map(textOf);
    const lines = parts.length >= 2 ? Math.max(linesOf(parts[0], 17), linesOf(parts[1], 31)) : linesOf(parts[0] || '', 50);
    height += 13 + 20 * lines;
    return '';
  });
  rest = rest.replace(/<li>([\s\S]*?)<\/li>/g, (item, inner) => {
    if (/cs-methods/.test(inner)) height += 28 + 16 * linesOf(textOf(inner), 44);
    else height += 5 + 21 * linesOf(textOf(inner), 46);
    return '';
  });
  rest = rest.replace(/<img [^>]*>/g, () => {
    height += 240;
    return '';
  });
  rest = rest.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (paragraph, inner) => {
    height += 8 + 22 * linesOf(textOf(inner), 46);
    return '';
  });
  const left = textOf(rest);
  if (left) height += 20 * linesOf(left, 50);
  return height;
}

function rowSpan(height) {
  return Math.ceil((Math.round(height * 0.92) + CARD_GAP) / ROW_UNIT);
}

function cardHtml(id, label, body, options = {}) {
  const note = options.note ? `<p class="cs-cardnote">${options.note}</p>` : '';
  const kind = options.kind ? ` cs-card-${options.kind}` : '';
  const height = estimateHeight(body, options.note || '');
  const rows = rowSpan(options.kind === 'wide' ? Math.round(height * 0.62) : height);
  return `<section class="cs-card${kind}" id="${id}" style="--rows:${rows}"><header class="cs-tab"><h3>${label}</h3><a class="cs-anchor" href="#${id}" aria-label="Link to this card">#</a></header><div class="cs-cardbody">${body}</div>${note}</section>`;
}

function sectionHtml(id, title, cards) {
  if (!cards.length) return '';
  return `<section class="cs-section" aria-labelledby="${id}"><h2 class="cs-h" id="${id}"><a href="#${id}" aria-hidden="true" tabindex="-1">#</a> ${escapeHtml(title)}</h2><div class="cs-masonry">${cards.join('')}</div></section>`;
}

function rowsTable(rows) {
  return `<table class="cs-t"><tbody>${rows.map(([key, value]) => `<tr><th scope="row">${key}</th><td>${value}</td></tr>`).join('')}</tbody></table>`;
}

function termKey(term) {
  return plain(term).replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchConcepts(card) {
  const formulas = card.formulas.map(item => ({ item, key: termKey(item.label) }));
  const functions = card.signatures.items.map(item => ({ item, key: item.name.toLowerCase().replace(/_/g, ' ') }));
  const usedFormulas = new Set();
  const usedFunctions = new Set();
  const concepts = [];
  const rest = [];
  for (const term of card.terms) {
    const key = termKey(term.term);
    let formula = null;
    let fn = null;
    if (key.length >= 4) {
      formula = formulas.find(entry => !usedFormulas.has(entry.item) && ` ${entry.key} `.includes(` ${key} `));
      fn = functions.find(entry => !usedFunctions.has(entry.item) && (entry.key === key || entry.key === key.replace(/s$/, '') || entry.key.startsWith(`${key} `)));
    }
    if (formula || fn) {
      if (formula) usedFormulas.add(formula.item);
      if (fn) usedFunctions.add(fn.item);
      concepts.push({ term, formula: formula && formula.item, fn: fn && fn.item });
    } else {
      rest.push(term);
    }
  }
  return { concepts, rest, formulas: card.formulas.filter(item => !usedFormulas.has(item)) };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function metaRows(card) {
  return [['Type', card.type], ['Languages', card.languages], ['Time', card.time], ['Needs', card.prerequisites]]
    .map(([key, value]) => [key, plain(value)])
    .filter(([, value]) => value && value !== '—' && value.toLowerCase() !== 'none');
}

function lessonSections(card) {
  const id = idMaker();
  const start = [];
  if (card.problem) start.push(cardHtml(id('why'), 'Why it matters', `<p class="cs-lead">${inline(card.problem)}</p>`, { kind: 'start' }));
  start.push(cardHtml(id('at-a-glance'), 'At a glance', `${rowsTable(metaRows(card).map(([key, value]) => [escapeHtml(key), escapeHtml(value)]))}`));
  if (card.objectives.length) start.push(cardHtml(id('you-can'), 'After this lesson you can', `<ul class="cs-list">${card.objectives.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`));
  if (card.summary) start.push(cardHtml(id('summary'), 'Summary', markdown.parseMd(stripLinks(card.summary.markdown)), { kind: 'wide', note: 'Written by the lesson author.' }));
  if (card.image) start.push(cardHtml(id('diagram'), 'Diagram', `<a class="cs-figure" href="${card.lessonUrl}"><img src="${card.image.href}" alt="${escapeHtml(card.image.alt)}" loading="lazy" decoding="async"></a>`, { note: escapeHtml(card.image.alt) }));

  const { concepts, rest, formulas } = matchConcepts(card);
  const ideas = concepts.map(entry => {
    const extra = [];
    if (entry.formula) extra.push(mathHtml(entry.formula.tex, true));
    if (entry.fn) extra.push(`<pre class="cs-sig"><code>${escapeHtml(entry.fn.text)}</code></pre>`);
    return cardHtml(id(entry.term.term), inline(entry.term.term), `<p>${inline(clip(entry.term.means, LIMITS.termChars))}</p>${extra.join('')}`, { kind: 'concept' });
  });
  chunk(rest, Math.ceil(rest.length / Math.max(1, Math.ceil(rest.length / 6)))).forEach((group, index, all) => {
    ideas.push(cardHtml(id('terms'), all.length > 1 ? `Terms ${index + 1}/${all.length}` : 'Terms', rowsTable(group.map(item => [inline(item.term), inline(clip(item.means, LIMITS.termChars))])), { kind: 'terms' }));
  });

  const groups = [];
  for (const item of formulas) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.label) last.items.push(item);
    else groups.push({ label: item.label, items: [item] });
  }
  const math = groups.map(group => cardHtml(id(group.label || 'formula'), escapeHtml(group.label || 'Formula'), group.items.map(item => mathHtml(item.tex, true)).join(''), { kind: 'math' }));

  const code = [];
  if (card.signatures.items.length) {
    const notes = [];
    if (card.signatures.file) notes.push(`From <code>${escapeHtml(card.signatures.file)}</code>.`);
    if (card.signatures.others.length) notes.push(`Also built in ${escapeHtml(card.signatures.others.join(', '))}.`);
    const rows = card.signatures.items.map(item => {
      const methods = item.methods && item.methods.length ? `<span class="cs-methods">.${item.methods.slice(0, 6).map(escapeHtml).join(' .')}</span>` : '';
      return `<li><code>${escapeHtml(item.text)}</code>${methods}</li>`;
    });
    code.push(cardHtml(id('functions'), `What you build · ${escapeHtml(card.signatures.lang)}`, `<ul class="cs-sigs">${rows.join('')}</ul>`, { note: notes.join(' ') }));
  }
  for (const step of card.steps) {
    const lead = step.lead ? `<p>${inline(step.lead)}</p>` : '';
    code.push(cardHtml(id(step.heading), escapeHtml(step.heading), lead + codeHtml(step.code, step.lang), { kind: 'step', note: step.cut ? 'The first lines of this step. The lesson has the full code.' : '' }));
  }
  if (card.practice) {
    const heading = card.practice.heading && !/^use\b/i.test(plain(card.practice.heading)) ? plain(card.practice.heading) : '';
    code.push(cardHtml(id('library'), 'Library version', codeHtml(card.practice.code, card.practice.lang), { note: heading ? escapeHtml(heading) : '' }));
  }

  const watch = [];
  if (card.pitfalls.length) watch.push(cardHtml(id('pitfalls'), 'Pitfalls', `<ul class="cs-list">${card.pitfalls.map(item => `<li>${item.lead ? `<strong>${inline(item.lead)}.</strong> ` : ''}${inline(item.text)}</li>`).join('')}</ul>`, { kind: 'warn' }));
  if (card.outputs.length) watch.push(cardHtml(id('outputs'), 'Outputs', `<ul class="cs-files">${card.outputs.map(name => `<li><code>outputs/${escapeHtml(name)}</code></li>`).join('')}</ul>`, { note: 'Reusable files from this lesson.' }));

  return [
    sectionHtml('start-here', 'Start here', start),
    sectionHtml('key-ideas', 'Key ideas', ideas.concat(math)),
    sectionHtml('code', 'Code and practice', code.concat(watch)),
  ].join('');
}

function copyLine(year) {
  return `© ${year} ${AUTHOR} · ${LICENSE}`;
}

function sheetFooter(parts, year, hash) {
  const nav = parts.filter(Boolean).join('');
  return `<footer class="cs-foot"><nav class="cs-pager" aria-label="Cheat sheet navigation">${nav}</nav><p class="cs-stamp"><span>aiengineeringfromscratch.com</span><span>${copyLine(year)}</span>${hash ? `<span>source ${escapeHtml(hash)}</span>` : ''}</p></footer>`;
}

function pagerLink(item, rel, label) {
  if (!item) return '';
  const arrow = rel === 'prev' ? '←' : '→';
  const short = clip(label, 40);
  const text = rel === 'prev' ? `${arrow} ${short}` : `${short} ${arrow}`;
  return `<a href="${item.href}" rel="${rel}">${escapeHtml(text)}</a>`;
}

function badge(phase) {
  return `<span class="cs-glyph" aria-hidden="true">${escapeHtml(phase.glyph)}</span>`;
}

function hero(kicker, title, hook, extra, phase) {
  return `<header class="cs-hero">${phase ? badge(phase) : ''}<div class="cs-hero-text"><p class="cs-kicker">${kicker}</p><h1>${escapeHtml(title)} <span class="cs-muted">cheat sheet</span></h1>${hook ? `<p class="cs-hook">${inline(hook)}</p>` : ''}${extra}</div></header>`;
}

function lessonMain(card, year) {
  const phase = card.phase;
  const actions = `<p class="cs-actions"><a href="${card.lessonUrl}">Open the lesson</a><a href="${phase.href}">Phase ${phase.number} sheet</a><a href="${card.sourceUrl}">Source</a><button type="button" class="cs-print" data-print>Print</button></p>`;
  const head = hero(`<a href="${phase.href}">Phase ${phase.number} · ${escapeHtml(phase.name)}</a> · Lesson ${card.number}`, card.title, card.hook, actions, phase);
  const foot = sheetFooter([pagerLink(card.previous, 'prev', card.previous && card.previous.title), `<a href="${phase.href}">All of Phase ${phase.number}</a>`, pagerLink(card.next, 'next', card.next && card.next.title)], year, card.hash);
  return `<main id="main" class="cs-page cs-lesson-page">${head}${lessonSections(card)}${foot}</main>`;
}

function phaseLessonCard(card) {
  const parts = [];
  if (card.hook) parts.push(`<p class="cs-lead">${inline(card.hook)}</p>`);
  const formulas = card.formulas.filter(item => item.tex.length <= LIMITS.phaseFormulaChars && !item.tex.includes('\n')).slice(0, LIMITS.phaseFormulas);
  if (formulas.length) parts.push(`<div class="cs-mini-math">${formulas.map(item => mathHtml(item.tex, true)).join('')}</div>`);
  if (card.terms.length) parts.push(rowsTable(card.terms.slice(0, LIMITS.phaseTerms).map(item => [inline(item.term), inline(clip(item.means, LIMITS.phaseTermChars))])));
  if (card.signatures.items.length) parts.push(`<p class="cs-mini-sigs">${card.signatures.items.slice(0, LIMITS.phaseSignatures).map(item => `<code>${escapeHtml(item.text.replace(/^class\s+/, ''))}</code>`).join(' ')}</p>`);
  if (!card.terms.length && card.objectives.length) parts.push(`<ul class="cs-list">${card.objectives.slice(0, 3).map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
  const title = `<p class="cs-cardtitle"><a href="${card.href}">${escapeHtml(card.title)}</a></p>`;
  return cardHtml(`l${card.number}`, `Lesson ${card.number}`, title + parts.join(''), { kind: 'lesson' });
}

function phaseStats(phase) {
  const sum = key => phase.lessons.reduce((total, card) => total + (Array.isArray(card[key]) ? card[key].length : card[key].items.length), 0);
  return [[phase.lessons.length, 'lessons'], [sum('formulas'), 'formulas'], [sum('terms'), 'key terms'], [sum('signatures'), 'functions']]
    .filter(([value]) => value)
    .map(([value, label]) => `<li><strong>${value}</strong> ${label}</li>`).join('');
}

function phaseMain(phase, year) {
  const actions = `<ul class="cs-stats">${phaseStats(phase)}</ul><p class="cs-actions"><a href="${phase.lessons[0].lessonUrl}">Start lesson ${phase.lessons[0].number}</a><a href="${phase.hub}">Phase overview</a><a href="${BASE}">All cheat sheets</a><button type="button" class="cs-print" data-print>Print</button></p>`;
  const head = hero(`<a href="${BASE}">Cheat sheets</a> · Phase ${phase.number}`, phase.name, phase.hook, actions, phase);
  const jump = `<nav class="cs-jump" aria-label="Lessons in this phase">${phase.lessons.map(card => `<a href="#l${card.number}" title="${escapeHtml(card.title)}">${card.number}</a>`).join('')}</nav>`;
  const startBody = `<p class="cs-lead">${phase.lessons.length} lessons. Each card below is one lesson. Open a card title for the full lesson sheet.</p>${rowsTable([['First', `<a href="${phase.lessons[0].href}">${escapeHtml(phase.lessons[0].title)}</a>`], ['Last', `<a href="${phase.lessons[phase.lessons.length - 1].href}">${escapeHtml(phase.lessons[phase.lessons.length - 1].title)}</a>`], ['Before', phase.previous ? `<a href="${phase.previous.href}">Phase ${phase.previous.number} sheet</a>` : 'Nothing'], ['After', phase.next ? `<a href="${phase.next.href}">Phase ${phase.next.number} sheet</a>` : 'Nothing']])}`;
  const lessons = sectionHtml('lessons', 'Lessons', [cardHtml('this-phase', 'Start here', startBody, { kind: 'start' })].concat(phase.lessons.map(phaseLessonCard)));
  const foot = sheetFooter([pagerLink(phase.previous, 'prev', phase.previous && `Phase ${phase.previous.number}`), `<a href="${BASE}">All cheat sheets</a>`, pagerLink(phase.next, 'next', phase.next && `Phase ${phase.next.number}`)], year, '');
  return `<main id="main" class="cs-page cs-phase-page">${head}${jump}${lessons}${foot}</main>`;
}

function phaseTile(phase) {
  return `<li class="cs-tile" style="--h:${phase.hue}" data-phase="${phase.number}"><a href="${phase.href}">${badge(phase)}<span class="cs-tile-name">${escapeHtml(phase.name)}</span><span class="cs-tile-meta">Phase ${phase.number} · ${phase.lessons.length} lessons</span></a></li>`;
}

function indexMain(phases, year) {
  const total = phases.reduce((sum, phase) => sum + phase.lessons.length, 0);
  const search = `<div class="cs-search" role="search"><label for="cs-q" class="cs-kicker">Search ${total} lessons</label><input id="cs-q" type="search" autocomplete="off" spellcheck="false" placeholder="attention, LoRA, backprop, MCP" data-index="${BASE}/search.json"><p class="cs-search-count" aria-live="polite"></p><ol class="cs-results" hidden></ol></div>`;
  const head = `<header class="cs-hero cs-hero-index"><div class="cs-hero-text"><p class="cs-kicker">AI Engineering from Scratch</p><h1>Cheat sheets</h1><p class="cs-hook">One printable sheet for each phase and each lesson. Every sheet comes from the lesson text: formulas, key terms, functions and pitfalls.</p>${search}</div></header>`;
  const tiles = `<section class="cs-section" aria-labelledby="phases"><h2 class="cs-h" id="phases"><a href="#phases" aria-hidden="true" tabindex="-1">#</a> Phases</h2><ol class="cs-tiles">${phases.map(phaseTile).join('')}</ol></section>`;
  const listRows = phase => rowSpan(42 + phase.lessons.reduce((sum, card) => sum + 7 + 19 * linesOf(card.title, 38), 0));
  const lists = phases.map(phase => `<section class="cs-card cs-card-list" id="p-${phase.slug}" style="--h:${phase.hue};--rows:${listRows(phase)}"><header class="cs-tab"><h3><a href="${phase.href}">${escapeHtml(phase.glyph)} ${escapeHtml(phase.name)}</a></h3><a class="cs-anchor" href="#p-${phase.slug}" aria-label="Link to this card">#</a></header><ol class="cs-lessonlist">${phase.lessons.map(card => `<li><a href="${card.href}"><span>${card.number}</span>${escapeHtml(card.title)}</a></li>`).join('')}</ol></section>`).join('');
  const all = `<section class="cs-section" aria-labelledby="lessons"><h2 class="cs-h" id="lessons"><a href="#lessons" aria-hidden="true" tabindex="-1">#</a> All lessons</h2><div class="cs-masonry">${lists}</div></section>`;
  const how = sectionHtml('how', 'How to use them', [cardHtml('reading', 'Reading', '<ul class="cs-list"><li>Read the lesson first. A sheet helps you remember. It does not teach.</li><li>Before you start a new phase, read the sheet of the phase before it.</li></ul>'), cardHtml('printing', 'Printing', '<ul class="cs-list"><li>Use the Print button or the print command of your browser.</li><li>Lesson sheets print upright. Phase sheets print sideways in five columns. Both fit A4 and Letter paper.</li></ul>'), cardHtml('updates', 'Updates', '<ul class="cs-list"><li>A script makes the sheets from the lesson text on every deploy.</li><li>To improve a sheet, add a Summary section to the lesson.</li></ul>')]);
  return `<main id="main" class="cs-page cs-index-page">${head}${tiles}${all}${how}${sheetFooter([], year, '')}</main>`;
}

function searchIndex(phases) {
  return phases.map(phase => ({
    n: phase.number,
    t: phase.name,
    g: phase.glyph,
    h: phase.hue,
    u: phase.href,
    l: phase.lessons.map(card => [card.number, card.title, card.href.slice(phase.href.length + 1), card.termNames.concat(card.formulas.map(item => item.label)).filter((value, index, list) => value && list.indexOf(value) === index).join(', ')]),
  }));
}

function shell({ title, description, href, card, main, bodyClass, hue = 222 }, assets) {
  const canonical = ORIGIN + href;
  const image = `${ORIGIN}/og/${card}.png`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="AI Engineering from Scratch">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
${assets.head}
<script>${THEME_SCRIPT}</script>
</head>
<body class="${bodyClass}" style="--h:${hue}">
<a href="${href}#main" class="skip-link">Skip to content</a>
${SITE_HEADER}
${main}
${assets.body}
</body>
</html>
`;
}

function lessonDescription(card) {
  const bits = [];
  if (card.formulas.length) bits.push(`${card.formulas.length} formulas`);
  if (card.terms.length) bits.push(`${card.terms.length} key terms`);
  if (card.signatures.items.length) bits.push(`${card.signatures.items.length} functions`);
  const what = bits.length ? `${bits.join(', ')} from the lesson on one page.` : 'The main points of the lesson on one page.';
  return `Cheat sheet for ${card.title}. ${what}`;
}

function editionYear(root) {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  if (epoch > 0) return new Date(epoch * 1000).toISOString().slice(0, 10);
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch (_) {}
  return new Date().toISOString().slice(0, 10);
}

const HEAD_ASSETS = '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/cheatsheets.css">';
const BODY_ASSETS = '<script src="/header.js" defer></script>\n<script src="/cheatsheets.js" defer></script>';

function buildCheatsheets({ root = REPO_ROOT, siteDir = __dirname, edition } = {}) {
  const phases = collect(root);
  const assets = { head: versionHtml(HEAD_ASSETS, siteDir), body: versionHtml(BODY_ASSETS, siteDir) };
  const date = edition || editionYear(root);
  const year = date.slice(0, 4);
  const pages = [];
  pages.push({
    file: 'index.html',
    href: BASE,
    html: shell({ title: 'Cheat sheets - AI Engineering from Scratch', description: 'Printable cheat sheets for every phase and lesson of AI Engineering from Scratch.', href: BASE, card: 'page/home', main: indexMain(phases, year), bodyClass: 'cs-body' }, assets),
  });
  for (const phase of phases) {
    pages.push({
      file: `${phase.slug}/index.html`,
      href: phase.href,
      html: shell({ title: `Phase ${phase.number} ${phase.name} cheat sheet - AI Engineering from Scratch`, description: `Cheat sheet for Phase ${phase.number}, ${phase.name}. Formulas, key terms and functions from all ${phase.lessons.length} lessons on one page.`, href: phase.href, card: `phase/${phase.slug}`, main: phaseMain(phase, year), bodyClass: 'cs-body', hue: phase.hue }, assets),
    });
    for (const card of phase.lessons) {
      pages.push({
        file: `${phase.slug}/${card.dir}.html`,
        href: card.href,
        html: shell({ title: `${card.title} cheat sheet - AI Engineering from Scratch`, description: lessonDescription(card), href: card.href, card: `lesson/${card.path}`, main: lessonMain(card, year), bodyClass: 'cs-body', hue: phase.hue }, assets),
      });
    }
  }
  const images = phases.flatMap(phase => phase.lessons.map(card => card.image).filter(Boolean));
  return { phases, pages, date, images, search: JSON.stringify(searchIndex(phases)) };
}

function audit(phases) {
  const empty = [];
  const thin = [];
  for (const phase of phases) {
    for (const card of phase.lessons) {
      if (!card.title) empty.push({ path: card.path, reason: 'no title' });
      else if (card.items === 0) empty.push({ path: card.path, reason: 'no objectives, formulas, terms, functions or summary' });
      else if (card.items < THIN_ITEMS) thin.push({ path: card.path, items: card.items });
    }
  }
  return { empty, thin };
}

function checkLinks(built, root = REPO_ROOT) {
  const known = new Set(built.pages.map(page => page.href));
  const phases = new Set(built.phases.map(phase => phase.hub));
  const fixed = new Set(['/', '/catalog', '/roadmap', '/glossary', '/about', BASE]);
  const broken = [];
  for (const page of built.pages) {
    for (const match of page.html.matchAll(/\ssrc="(\/cheatsheets\/img\/[^"]+)"/g)) {
      if (!built.images.some(image => image.href === match[1])) broken.push({ page: page.href, href: match[1] });
    }
    for (const match of page.html.matchAll(/\shref="([^"]+)"/g)) {
      const href = match[1].replace(/&amp;/g, '&');
      if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com/.test(href)) continue;
      const asset = /^\/([a-z0-9./-]+\.(?:css|js|ico|svg|png))(?:\?.*)?$/.exec(href);
      if (asset) {
        if (!fs.existsSync(path.join(root, 'site', asset[1]))) broken.push({ page: page.href, href });
        continue;
      }
      if (href.startsWith(`${REPO}/blob/main/`)) {
        if (!fs.existsSync(path.join(root, href.slice(`${REPO}/blob/main/`.length)))) broken.push({ page: page.href, href });
        continue;
      }
      if (href.startsWith(ORIGIN) || /^https?:/.test(href)) continue;
      const target = href.split('#')[0];
      if (!target || known.has(target) || phases.has(target) || fixed.has(target)) continue;
      const lesson = /^\/lesson\?path=(phases\/[a-z0-9-]+\/[a-z0-9-]+)$/.exec(target);
      if (lesson && fs.existsSync(path.join(root, lesson[1], 'docs', 'en.md'))) continue;
      broken.push({ page: page.href, href });
    }
  }
  return broken;
}

function writeCheatsheets({ root = REPO_ROOT, siteDir = __dirname, edition } = {}) {
  const built = buildCheatsheets({ root, siteDir, edition });
  const outDir = path.join(siteDir, OUTPUT_DIR);
  const files = new Map(built.pages.map(page => [path.join(outDir, page.file), page.html]));
  files.set(path.join(outDir, 'search.json'), `${built.search}\n`);
  for (const image of built.images) files.set(path.join(outDir, 'img', image.name), fs.readFileSync(image.file));
  if (fs.existsSync(outDir)) {
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (!files.has(full)) fs.unlinkSync(full);
      }
    };
    walk(outDir);
  }
  for (const [file, body] of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return built;
}

function printHtml(built) {
  const year = built.date.slice(0, 4);
  const cover = `<section class="cs-cover"><div class="cs-cover-stamp"><span>AI Engineering from Scratch · Cheat sheets</span><span class="cs-copy">${copyLine(year)}</span></div><h1>Cheat sheets</h1><p class="cs-hook">Formulas, key terms and functions from ${built.phases.reduce((sum, phase) => sum + phase.lessons.length, 0)} lessons in ${built.phases.length} phases. One sheet for each phase.</p><ol class="cs-index">${built.phases.map(phase => `<li><span class="cs-num">${phase.number}</span><span class="cs-index-name">${escapeHtml(phase.name)}</span><span class="cs-index-count">${phase.lessons.length} lessons</span></li>`).join('')}</ol><div class="cs-cover-edition"><p>Edition ${escapeHtml(built.date)}. The newest edition is at the link below.</p><p><a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a> · <a href="${REPO}">source on GitHub</a></p></div></section>`;
  const sheets = built.phases.map(phase => `<section class="cs-print-phase" style="--h:${phase.hue}">${hero(`Cheat sheet · Phase ${phase.number}`, phase.name, phase.hook, '', phase)}<div class="cs-masonry">${phase.lessons.map(phaseLessonCard).join('')}</div></section>`).join('');
  const colophon = `<section class="cs-colophon"><p class="cs-kicker">About this edition</p><p>Cheat sheets, edition ${escapeHtml(built.date)}, by ${AUTHOR}. They are part of AI Engineering from Scratch, an open source course at <a href="${ORIGIN}">aiengineeringfromscratch.com</a>. The newest edition is always at <a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a>.</p><p>A script makes each sheet from the text of the lessons. It uses the formulas, the Key Terms tables, the function signatures from the lesson code and the Summary sections. No person and no model rewrites the text. The source is <code>site/build-cheatsheets.js</code> in <a href="${REPO}">${REPO.replace('https://', '')}</a>.</p><p>${copyLine(year)}. You can copy and share these sheets. Keep this page and the copyright line with them. Report an error at <a href="${ISSUES_URL}">${ISSUES_URL.replace('https://', '')}</a>.</p></section>`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>Cheat sheets - AI Engineering from Scratch</title>
<meta name="author" content="${AUTHOR}">
<meta name="subject" content="Cheat sheets for every phase of AI Engineering from Scratch, edition ${escapeHtml(built.date)}">
<meta name="keywords" content="AI engineering, cheat sheet, machine learning, deep learning, LLM, agents">
<link href="${FONT_LINK}" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="cheatsheets.css">
<link rel="stylesheet" href="cheatsheets-print.css">
</head>
<body class="cs-body cs-print-edition">
<main class="cs-page">${cover}${sheets}${colophon}</main>
<script src="cheatsheets.js"></script>
</body>
</html>
`;
}

function unescapeHtml(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&');
}

function prerenderMath(html, katex) {
  const katexCss = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" crossorigin="anonymous">';
  return html
    .replace('</head>', `${katexCss}\n</head>`)
    .replace(/<(div|span) class="(math-display|math-inline)" data-math="(display|inline)">([\s\S]*?)<\/\1>/g, (match, tag, kind, mode, tex) => {
      try {
        const rendered = katex.renderToString(unescapeHtml(tex), { displayMode: mode === 'display', throwOnError: true, strict: 'ignore', trust: false });
        return `<${tag} class="${kind}" data-math="${mode}" data-math-rendered>${rendered}</${tag}>`;
      } catch (_) {
        return match;
      }
    });
}

function writePrint(outDir, options = {}) {
  const built = buildCheatsheets(options);
  fs.mkdirSync(outDir, { recursive: true });
  const html = printHtml(built);
  fs.writeFileSync(path.join(outDir, 'print.html'), options.katex ? prerenderMath(html, options.katex) : html, 'utf8');
  for (const name of ['style.css', 'cheatsheets.css', 'cheatsheets-print.css', 'cheatsheets.js']) {
    fs.copyFileSync(path.join(__dirname, name), path.join(outDir, name));
  }
  return built;
}

function draftSummary(lessonPath, root = REPO_ROOT) {
  const file = path.join(root, lessonPath, 'docs', 'en.md');
  const card = extractLesson(fs.readFileSync(file, 'utf8'), { path: lessonPath });
  const cell = text => String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
  const rows = [];
  for (const item of card.formulas) if (!item.tex.includes('\n')) rows.push(`| $${cell(item.tex)}$ | ${cell(item.label)}. Say what it computes. |`);
  for (const item of card.terms.slice(0, 6)) rows.push(`| ${cell(item.term)} | ${cell(clip(item.means, 120))} |`);
  return ['## Summary', '', '| Idea | What to remember |', '|------|------------------|'].concat(rows).join('\n') + '\n';
}

function main(argv) {
  const flag = name => argv.includes(name);
  const value = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : '';
  };
  if (flag('--draft-summary')) {
    process.stdout.write(draftSummary(value('--draft-summary')));
    return 0;
  }
  if (flag('--print')) {
    const katexPath = value('--katex');
    const katex = katexPath ? require(path.resolve(katexPath)) : null;
    const built = writePrint(path.resolve(value('--print')), { edition: value('--edition') || undefined, katex });
    console.log(`Wrote the print edition of ${built.phases.length} phase sheets to ${value('--print')}/print.html`);
    return 0;
  }
  if (flag('--check')) {
    const first = buildCheatsheets({ edition: '2026-01-01' });
    const second = buildCheatsheets({ edition: '2026-01-01' });
    const problems = [];
    const digest = built => sha(built.pages.map(page => `${page.file}\n${page.html}`).join('\n'));
    if (digest(first) !== digest(second)) problems.push('two builds of the same input gave different bytes');
    const result = audit(first.phases);
    for (const item of result.empty) problems.push(`empty sheet: ${item.path} (${item.reason})`);
    for (const item of checkLinks(first)) problems.push(`broken link on ${item.page}: ${item.href}`);
    const lessons = first.phases.reduce((sum, phase) => sum + phase.lessons.length, 0);
    console.log(`Checked ${first.pages.length} cheat sheets (${first.phases.length} phases, ${lessons} lessons). ${result.thin.length} thin sheets have fewer than ${THIN_ITEMS} items.`);
    if (flag('--verbose')) for (const item of result.thin) console.log(`  thin: ${item.path} (${item.items} items)`);
    for (const problem of problems) console.error(`  ${problem}`);
    return problems.length ? 1 : 0;
  }
  const built = writeCheatsheets({ edition: value('--edition') || undefined });
  console.log(`Wrote ${built.pages.length} cheat sheets for ${built.phases.length} phases to site/${OUTPUT_DIR}/`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { prerenderMath, extractLesson, collect, buildCheatsheets, writeCheatsheets, writePrint, printHtml, audit, checkLinks, draftSummary, scanLesson, pythonSignatures, clip, THIN_ITEMS, LIMITS };
