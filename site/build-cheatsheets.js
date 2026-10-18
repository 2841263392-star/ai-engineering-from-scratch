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
  pitfalls: 6,
  phaseFormulas: 2,
  phaseFormulaChars: 140,
  phaseTerms: 5,
  phaseSignatures: 4,
  termChars: 150,
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
  sections.push(current);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (/^\s*```\s*$/.test(line)) {
        current.blocks.push({ lang: fence.lang, text: fence.lines.join('\n'), heading: fence.heading });
        fence = null;
      } else {
        fence.lines.push(line);
      }
      continue;
    }
    const open = /^\s*```\s*([\w+-]*)/.exec(line);
    if (open) {
      fence = { lang: open[1].toLowerCase(), lines: [], heading: h3 || current.title };
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
      continue;
    }
    if (heading) h3 = heading[2];
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
    while (!/\)\s*(?:->\s*[^:]+)?:\s*(?:#.*)?$/.test(header) && j + 1 < lines.length && j - i < 16) header += ` ${lines[++j].trim()}`;
    const params = (/\((.*)\)/.exec(header) || [, ''])[1].replace(/\s+/g, ' ').replace(/,\s*\)/, ')').trim();
    const returns = (/\)\s*->\s*([^:]+):/.exec(header) || [, ''])[1].trim();
    const name = def[2];
    if (def[1].length === 0) {
      currentClass = null;
      if (name.startsWith('_') || name === 'main') continue;
      out.push({ name, kind: 'def', text: `${name}(${params})${returns ? ` -> ${returns}` : ''}` });
    } else if (currentClass && def[1].length <= 4) {
      if (name === '__init__') {
        const args = params.split(',').map(item => item.trim()).filter(item => item && item !== 'self');
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
      out.push({ label: plain(block.heading || section.title).replace(/^step\s+\d+[:.]?\s*/i, ''), tex });
    }
  }
  return out.slice(0, LIMITS.formulas);
}

function pitfallsFor(sections) {
  const section = findSection(sections, text => /^(?:common )?pitfalls\b|failure modes\b/.test(text));
  if (!section) return [];
  return bullets(section.lines).map(item => {
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
    type: meta.type || '',
    languages: meta.languages || '',
    prerequisites: meta.prerequisites || '',
    time: meta.time || '',
    objectives: objectives ? bullets(objectives.lines).slice(0, LIMITS.objectives) : [],
    summary: summaryBody ? { markdown: summaryBody, rows: summaryTable.rows.length + bullets(summary.lines).length } : null,
    formulas: formulasFor(sections),
    terms: termTable.rows
      .filter(row => row.length >= 2 && row[0])
      .map(row => ({ term: row[0], means: row[row.length - 1], says: row.length >= 3 ? row[1] : '' }))
      .slice(0, LIMITS.terms),
    signatures,
    practice: practiceFor(use.flatMap(section => section.blocks)),
    pitfalls: pitfallsFor(sections),
    outputs: info.outputs || [],
    hash: sha(source).slice(0, 12),
  };
}

function itemCount(card) {
  return card.objectives.length + card.formulas.length + card.terms.length + card.signatures.items.length
    + card.pitfalls.length + (card.summary ? Math.max(1, card.summary.rows) : 0) + (card.practice ? 1 : 0);
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
    const phase = { dir: name, slug, number: info.number, name: info.name, hook: info.hook, href: cheatsheetPath(`phases/${name}`), hub: phasePath(slug), lessons: [] };
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

function mathHtml(tex, display) {
  return display
    ? `<div class="math-display" data-math="display">${escapeHtml(tex)}</div>`
    : `<span class="math-inline" data-math="inline">${escapeHtml(tex)}</span>`;
}

function codeHtml(code, lang) {
  return `<pre class="cs-code"><code>${markdown.highlightSyntax(escapeHtml(code), lang)}</code></pre>`;
}

function panel(kind, title, body, extra = '') {
  return `<section class="cs-panel cs-p-${kind}${extra}" aria-label="${escapeHtml(title)}"><h2 class="cs-label">${escapeHtml(title)}</h2>${body}</section>`;
}

function signatureList(signatures, compact) {
  const items = (compact ? signatures.items.slice(0, LIMITS.phaseSignatures) : signatures.items).map(item => {
    const methods = !compact && item.methods && item.methods.length ? `<span class="cs-methods">.${item.methods.slice(0, 6).map(escapeHtml).join(' .')}</span>` : '';
    return `<li><code>${escapeHtml(item.text)}</code>${methods}</li>`;
  });
  return `<ul class="cs-sigs">${items.join('')}</ul>`;
}

function termList(terms, compact) {
  const list = compact ? terms.slice(0, LIMITS.phaseTerms) : terms;
  const max = compact ? LIMITS.phaseTermChars : LIMITS.termChars;
  return `<dl class="cs-terms">${list.map(item => `<div><dt>${inline(item.term)}</dt><dd>${inline(clip(item.means, max))}</dd></div>`).join('')}</dl>`;
}

function formulaList(formulas) {
  return `<dl class="cs-formulas">${formulas.map(item => `<div><dt>${escapeHtml(item.label)}</dt><dd>${mathHtml(item.tex, true)}</dd></div>`).join('')}</dl>`;
}

function lessonPanels(card) {
  const panels = [];
  if (card.summary) panels.push(panel('summary', 'Summary', markdown.parseMd(stripLinks(card.summary.markdown)), ' cs-wide'));
  if (card.formulas.length) panels.push(panel('formulas', 'Formulas', formulaList(card.formulas)));
  if (card.terms.length) panels.push(panel('terms', 'Key terms', termList(card.terms, false)));
  if (card.signatures.items.length) {
    const notes = [];
    if (card.signatures.file) notes.push(`From <code>${escapeHtml(card.signatures.file)}</code>.`);
    if (card.signatures.others.length) notes.push(`Also built in ${escapeHtml(card.signatures.others.join(', '))}.`);
    const also = notes.length ? `<p class="cs-note">${notes.join(' ')}</p>` : '';
    panels.push(panel('sigs', `What you build · ${card.signatures.lang}`, signatureList(card.signatures, false) + also));
  }
  if (card.practice) panels.push(panel('practice', 'Library version', `${card.practice.heading && !/^use\b/i.test(plain(card.practice.heading)) ? `<p class="cs-note">${escapeHtml(plain(card.practice.heading))}</p>` : ''}${codeHtml(card.practice.code, card.practice.lang)}`));
  if (card.objectives.length) panels.push(panel('objectives', 'After this lesson you can', `<ul class="cs-list">${card.objectives.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`));
  if (card.pitfalls.length) panels.push(panel('pitfalls', 'Pitfalls', `<ul class="cs-list">${card.pitfalls.map(item => `<li>${item.lead ? `<strong>${inline(item.lead)}.</strong> ` : ''}${inline(item.text)}</li>`).join('')}</ul>`));
  if (card.outputs.length) panels.push(panel('outputs', 'Outputs', `<ul class="cs-files">${card.outputs.map(name => `<li><code>outputs/${escapeHtml(name)}</code></li>`).join('')}</ul>`));
  return panels;
}

function metaList(card) {
  const rows = [['Type', card.type], ['Languages', card.languages], ['Time', card.time], ['Needs', plain(card.prerequisites)]]
    .filter(([, value]) => value && value !== '—' && value.toLowerCase() !== 'none');
  return `<ul class="cs-meta">${rows.map(([key, value]) => `<li><span>${key}</span>${escapeHtml(value)}</li>`).join('')}</ul>`;
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
  const text = rel === 'prev' ? `${arrow} ${label}` : `${label} ${arrow}`;
  return `<a href="${item.href}" rel="${rel}">${escapeHtml(text)}</a>`;
}

function lessonMain(card, year) {
  const phase = card.phase;
  const actions = `<p class="cs-actions"><a href="${card.lessonUrl}">Open the lesson</a><a href="${phase.href}">Phase ${phase.number} sheet</a><a href="${card.sourceUrl}">Source</a><button type="button" class="cs-print" data-print>Print</button></p>`;
  const head = `<header class="cs-head"><p class="cs-kicker">Cheat sheet · Phase ${phase.number} · Lesson ${card.number}</p><h1>${escapeHtml(card.title)}</h1>${card.hook ? `<p class="cs-hook">${inline(card.hook)}</p>` : ''}${metaList(card)}${actions}</header>`;
  const panels = lessonPanels(card);
  const body = panels.length ? `<div class="cs-grid">${panels.join('')}</div>` : '<p class="cs-empty">This lesson has no key terms, formulas or code signatures yet.</p>';
  const foot = sheetFooter([pagerLink(card.previous, 'prev', card.previous && card.previous.title), `<a href="${phase.href}">All of Phase ${phase.number}</a>`, pagerLink(card.next, 'next', card.next && card.next.title)], year, card.hash);
  return `<main id="main" class="cs-page cs-lesson-page"><article class="cs-sheet">${head}${body}${foot}</article></main>`;
}

function phaseCard(card) {
  const parts = [];
  const formulas = card.formulas.filter(item => item.tex.length <= LIMITS.phaseFormulaChars && !item.tex.includes('\n')).slice(0, LIMITS.phaseFormulas);
  if (formulas.length) parts.push(`<div class="cs-mini-math">${formulas.map(item => mathHtml(item.tex, true)).join('')}</div>`);
  if (card.terms.length) parts.push(termList(card.terms, true));
  if (card.signatures.items.length) parts.push(`<p class="cs-mini-sigs">${card.signatures.items.slice(0, LIMITS.phaseSignatures).map(item => `<code>${escapeHtml(item.text.replace(/^class\s+/, ''))}</code>`).join(' ')}</p>`);
  if (!parts.length && card.objectives.length) parts.push(`<ul class="cs-list">${card.objectives.slice(0, 3).map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
  return `<article class="cs-card" id="l${card.number}"><h2><span class="cs-num">${card.number}</span><a href="${card.href}">${escapeHtml(card.title)}</a></h2>${card.hook ? `<p class="cs-hook">${inline(card.hook)}</p>` : ''}${parts.join('')}</article>`;
}

function phaseStats(phase) {
  const sum = key => phase.lessons.reduce((total, card) => total + (Array.isArray(card[key]) ? card[key].length : card[key].items.length), 0);
  return [[phase.lessons.length, 'lessons'], [sum('formulas'), 'formulas'], [sum('terms'), 'key terms'], [sum('signatures'), 'functions']]
    .filter(([value]) => value)
    .map(([value, label]) => `<li><strong>${value}</strong> ${label}</li>`).join('');
}

function phaseMain(phase, year) {
  const actions = `<p class="cs-actions"><a href="${phase.hub}">Phase ${phase.number} overview</a><a href="${BASE}">All cheat sheets</a><button type="button" class="cs-print" data-print>Print</button></p>`;
  const head = `<header class="cs-head"><p class="cs-kicker">Cheat sheet · Phase ${phase.number}</p><h1>${escapeHtml(phase.name)}</h1>${phase.hook ? `<p class="cs-hook">${inline(phase.hook)}</p>` : ''}<ul class="cs-stats">${phaseStats(phase)}</ul>${actions}</header>`;
  const cards = `<div class="cs-columns">${phase.lessons.map(phaseCard).join('')}</div>`;
  const foot = sheetFooter([pagerLink(phase.previous, 'prev', phase.previous && `Phase ${phase.previous.number}`), `<a href="${BASE}">All cheat sheets</a>`, pagerLink(phase.next, 'next', phase.next && `Phase ${phase.next.number}`)], year, '');
  return `<main id="main" class="cs-page cs-phase-page"><article class="cs-sheet">${head}${cards}${foot}</article></main>`;
}

function indexMain(phases, year) {
  const total = phases.reduce((sum, phase) => sum + phase.lessons.length, 0);
  const rows = phases.map(phase => `<li><a href="${phase.href}"><span class="cs-num">${phase.number}</span><span class="cs-index-name">${escapeHtml(phase.name)}</span><span class="cs-index-count">${phase.lessons.length} lessons</span></a></li>`).join('');
  const head = `<header class="cs-head"><p class="cs-kicker">Cheat sheets</p><h1>One page for each phase</h1><p class="cs-hook">Each sheet collects the formulas, key terms and functions from the lessons of one phase. Each lesson also has its own sheet.</p><ul class="cs-stats"><li><strong>${phases.length}</strong> phase sheets</li><li><strong>${total}</strong> lesson sheets</li></ul></header>`;
  const how = '<section class="cs-panel cs-wide" aria-label="How to use the sheets"><h2 class="cs-label">How to use them</h2><ul class="cs-list"><li>Read the lesson first. A sheet helps you remember. It does not teach.</li><li>Before you start a new phase, read the sheet of the phase before it.</li><li>To print a sheet, use the Print button or the print command of your browser. The sheet fits A4 and Letter paper.</li><li>The sheets come from the lesson text. When a lesson changes, its sheet changes on the next deploy.</li></ul></section>';
  return `<main id="main" class="cs-page cs-index-page"><article class="cs-sheet">${head}<ol class="cs-index">${rows}</ol>${how}${sheetFooter([], year, '')}</article></main>`;
}

function shell({ title, description, href, card, main, bodyClass }, assets) {
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
<body class="${bodyClass}">
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
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch (_) {}
  return '2026-01-01';
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
      html: shell({ title: `Phase ${phase.number} ${phase.name} cheat sheet - AI Engineering from Scratch`, description: `Cheat sheet for Phase ${phase.number}, ${phase.name}. Formulas, key terms and functions from all ${phase.lessons.length} lessons on one page.`, href: phase.href, card: `phase/${phase.slug}`, main: phaseMain(phase, year), bodyClass: 'cs-body' }, assets),
    });
    for (const card of phase.lessons) {
      pages.push({
        file: `${phase.slug}/${card.dir}.html`,
        href: card.href,
        html: shell({ title: `${card.title} cheat sheet - AI Engineering from Scratch`, description: lessonDescription(card), href: card.href, card: `lesson/${card.path}`, main: lessonMain(card, year), bodyClass: 'cs-body' }, assets),
      });
    }
  }
  return { phases, pages, date };
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
  const keep = new Set(built.pages.map(page => path.join(outDir, page.file)));
  if (fs.existsSync(outDir)) {
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.html') && !keep.has(full)) fs.unlinkSync(full);
      }
    };
    walk(outDir);
  }
  for (const page of built.pages) {
    const file = path.join(outDir, page.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page.html, 'utf8');
  }
  return built;
}

function printHtml(built) {
  const year = built.date.slice(0, 4);
  const cover = `<section class="cs-cover"><div class="cs-cover-stamp"><span>AI Engineering from Scratch · Cheat sheets</span><span class="cs-copy">${copyLine(year)}</span></div><h1>Cheat sheets</h1><p class="cs-hook">Formulas, key terms and functions from ${built.phases.reduce((sum, phase) => sum + phase.lessons.length, 0)} lessons in ${built.phases.length} phases. One sheet for each phase.</p><ol class="cs-index">${built.phases.map(phase => `<li><span class="cs-num">${phase.number}</span><span class="cs-index-name">${escapeHtml(phase.name)}</span><span class="cs-index-count">${phase.lessons.length} lessons</span></li>`).join('')}</ol><div class="cs-cover-edition"><p>Edition ${escapeHtml(built.date)} · a snapshot of living cheat sheets · the newest edition is at the link below</p><p><a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a> · <a href="${REPO}">source on GitHub</a></p></div></section>`;
  const sheets = built.phases.map(phase => `<section class="cs-print-phase"><header class="cs-head"><p class="cs-kicker">Cheat sheet · Phase ${phase.number}</p><h1>${escapeHtml(phase.name)}</h1>${phase.hook ? `<p class="cs-hook">${inline(phase.hook)}</p>` : ''}</header><div class="cs-columns">${phase.lessons.map(phaseCard).join('')}</div></section>`).join('');
  const colophon = `<section class="cs-colophon"><p class="cs-kicker">About this edition</p><p>Cheat sheets, edition ${escapeHtml(built.date)}, by ${AUTHOR}. They are part of AI Engineering from Scratch, an open source course at <a href="${ORIGIN}">aiengineeringfromscratch.com</a>. The newest edition is always at <a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a>.</p><p>A script makes each sheet from the text of the lessons. It takes the formulas, the Key Terms tables, the function signatures from the lesson code and the Summary sections. No person and no model rewrites the text. The source is <code>site/build-cheatsheets.js</code> in <a href="${REPO}">${REPO.replace('https://', '')}</a>.</p><p>${copyLine(year)}. You can copy and share these sheets. Keep this page and the copyright line with them. Report an error at <a href="${ISSUES_URL}">${ISSUES_URL.replace('https://', '')}</a>.</p></section>`;
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
