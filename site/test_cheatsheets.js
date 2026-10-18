const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sheets = require('./build-cheatsheets');
const { cheatsheetPath } = require('../lib/hub-routes');

const root = path.resolve(__dirname, '..');

const LESSON = [
  '# Tiny Attention',
  '',
  '> Every token asks every other token a question.',
  '',
  '**Type:** Build',
  '**Languages:** Python, TypeScript',
  '**Prerequisites:** [Softmax](../02-softmax/)',
  '**Time:** ~45 minutes',
  '',
  '## Learning Objectives',
  '',
  '- Compute scaled dot-product attention by hand',
  '- Explain why the scores are divided by `sqrt(d)`',
  '',
  '## The Concept',
  '',
  '### Scaled scores',
  '',
  '```math',
  '\\text{Attention}(Q,K,V) = \\mathrm{softmax}\\left(\\frac{QK^T}{\\sqrt{d}}\\right)V',
  '```',
  '',
  '## Build It',
  '',
  '### Step 1: Scores',
  '',
  '```python',
  'class Attention:',
  '    def __init__(',
  '        self,',
  '        d_model: int,',
  '        heads: int = 1,',
  '    ) -> None:',
  '        self.d = d_model',
  '',
  '    def forward(self, x):',
  '        return x',
  '',
  '    def _helper(self):',
  '        return 0',
  '',
  'def softmax(xs: list[float]) -> list[float]:',
  '    return xs',
  '',
  'def _private():',
  '    return 1',
  '```',
  '',
  '```typescript',
  'export function softmax(xs: number[]): number[] {',
  '  return xs;',
  '}',
  '```',
  '',
  '## Use It',
  '',
  '```python',
  'import torch',
  'out = torch.nn.functional.scaled_dot_product_attention(q, k, v)',
  '```',
  '',
  '## Pitfalls',
  '',
  '- **Forgetting the scale.** Large dot products push softmax into one-hot outputs and the gradients vanish.',
  '- Masks applied after softmax leak future tokens.',
  '',
  '## Key Terms',
  '',
  '| Term | What people say | What it actually means |',
  '|------|-----------------|------------------------|',
  '| Query | "The question" | The vector a token uses to score other tokens |',
  '| Key | "The label" | The vector each token offers for scoring, compared with `q` |',
  '',
  '## Summary',
  '',
  '| Formula | Meaning |',
  '|---------|---------|',
  '| $QK^T$ | Raw attention scores |',
  '',
].join('\n');

test('a lesson card takes its parts from the lesson text', () => {
  const card = sheets.extractLesson(LESSON, { path: 'phases/07-x/01-tiny-attention' });
  assert.equal(card.title, 'Tiny Attention');
  assert.equal(card.hook, 'Every token asks every other token a question.');
  assert.equal(card.type, 'Build');
  assert.equal(card.time, '~45 minutes');
  assert.deepEqual(card.objectives, ['Compute scaled dot-product attention by hand', 'Explain why the scores are divided by `sqrt(d)`']);
  assert.equal(card.formulas.length, 1);
  assert.equal(card.formulas[0].label, 'Scaled scores');
  assert.match(card.formulas[0].tex, /^\\text\{Attention\}/);
  assert.deepEqual(card.terms.map(item => [item.term, item.means]), [
    ['Query', 'The vector a token uses to score other tokens'],
    ['Key', 'The vector each token offers for scoring, compared with `q`'],
  ]);
  assert.equal(card.summary.rows, 1);
  assert.equal(card.pitfalls[0].lead, 'Forgetting the scale');
  assert.equal(card.pitfalls[1].lead, '');
  assert.equal(card.practice.lang, 'python');
  assert.match(card.practice.code, /scaled_dot_product_attention/);
});

test('signatures come from the first listed language and skip private helpers', () => {
  const card = sheets.extractLesson(LESSON, {});
  assert.equal(card.signatures.lang, 'Python');
  assert.deepEqual(card.signatures.others, ['TypeScript']);
  assert.deepEqual(card.signatures.items.map(item => item.text), [
    'class Attention(d_model: int, heads: int = 1)',
    'softmax(xs: list[float]) -> list[float]',
  ]);
  assert.deepEqual(card.signatures.items[0].methods, ['forward']);
});

test('lessons without signatures in Build It fall back to the code folder', () => {
  const source = '# Plain\n\n> Hook.\n\n**Languages:** Rust\n\n## Build It\n\nNo code here.\n';
  const card = sheets.extractLesson(source, { code: [{ lang: 'rust', file: 'code/main.rs', text: 'pub fn tokenize(text: &str) -> Vec<String> {\n}\nstruct Vocab {\n}\n' }] });
  assert.equal(card.signatures.file, 'code/main.rs');
  assert.deepEqual(card.signatures.items.map(item => item.text), ['tokenize(text: &str) -> Vec<String>', 'struct Vocab']);
});

test('clipped text keeps inline code and math balanced', () => {
  const clipped = sheets.clip('A long explanation that ends inside `some_function_name(argument, other)` and keeps going for a while.', 60);
  assert.equal((clipped.match(/`/g) || []).length % 2, 0);
  assert.ok(clipped.endsWith('…'));
  const math = sheets.clip('The rule says $a + b = c$ and then the text continues with $x^2 + y^2$ beyond the limit here.', 70);
  assert.equal((math.match(/\$/g) || []).length % 2, 0);
});

test('the same lessons give the same bytes', () => {
  const first = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const second = sheets.buildCheatsheets({ edition: '2026-01-01' });
  assert.equal(first.pages.length, second.pages.length);
  for (let i = 0; i < first.pages.length; i++) assert.equal(first.pages[i].html, second.pages[i].html, first.pages[i].href);
  assert.doesNotMatch(first.pages.map(page => page.html).join(''), /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
});

test('every lesson and phase has a sheet, no sheet is empty and no link is broken', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const lessons = built.phases.reduce((sum, phase) => sum + phase.lessons.length, 0);
  let docs = 0;
  for (const phase of fs.readdirSync(path.join(root, 'phases')).filter(name => /^\d+-/.test(name))) {
    const dir = path.join(root, 'phases', phase);
    if (!fs.statSync(dir).isDirectory()) continue;
    docs += fs.readdirSync(dir).filter(name => fs.existsSync(path.join(dir, name, 'docs', 'en.md'))).length;
  }
  assert.equal(lessons, docs);
  assert.equal(built.pages.length, 1 + built.phases.length + lessons);
  assert.deepEqual(sheets.audit(built.phases).empty, []);
  assert.deepEqual(sheets.checkLinks(built), []);
});

test('sheet URLs follow the lesson path', () => {
  assert.equal(cheatsheetPath('phases/01-math-foundations/01-linear-algebra-intuition'), '/cheatsheets/math-foundations/01-linear-algebra-intuition');
  assert.equal(cheatsheetPath('phases/01-math-foundations'), '/cheatsheets/math-foundations');
  assert.equal(cheatsheetPath('certifications/claude/lessons/01-x'), '');
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  for (const page of built.pages.slice(1)) {
    const file = page.file.replace(/\/index\.html$/, '').replace(/\.html$/, '');
    assert.equal(page.href, `/cheatsheets/${file}`);
  }
});

test('the lesson page links to its sheets without a new request', () => {
  const source = fs.readFileSync(path.join(root, 'api', 'lesson.js'), 'utf8');
  assert.match(source, /function sheetLinks\(lessonPath\)/);
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map(rule => [rule.source, rule.destination]));
  assert.equal(rewrites.get('/cheatsheets'), '/cheatsheets/index.html');
  assert.equal(rewrites.get('/cheatsheets/:phase([a-z0-9-]+)'), '/cheatsheets/:phase/index.html');
  assert.equal(rewrites.get('/cheatsheets/:phase([a-z0-9-]+)/:lesson([a-z0-9-]+)'), '/cheatsheets/:phase/:lesson.html');
});

test('the print edition carries the attribution and renders math ahead of time', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-10-01' });
  const html = sheets.printHtml(built);
  assert.match(html, /<meta name="author" content="Rohit Ghumare">/);
  assert.match(html, /<meta name="subject" content="[^"]+edition 2026-10-01">/);
  assert.match(html, /<meta name="keywords" content="[^"]+">/);
  assert.match(html, /class="cs-copy">© 2026 Rohit Ghumare · MIT license</);
  assert.match(html, /Keep this page and the copyright line with them/);
  const fake = { renderToString: (tex, options) => `<span class="katex">${options.displayMode ? 'D' : 'I'}:${tex}</span>` };
  const rendered = sheets.prerenderMath('<head></head><div class="math-display" data-math="display">a &lt; b</div>', fake);
  assert.match(rendered, /katex\.min\.css/);
  assert.match(rendered, /data-math-rendered><span class="katex">D:a < b<\/span>/);
});

test('draft summaries are a starting table for the author', () => {
  const draft = sheets.draftSummary('phases/01-math-foundations/01-linear-algebra-intuition');
  assert.match(draft, /^## Summary\n\n\| Idea \| What to remember \|\n\|------\|------------------\|\n\| /);
});

test('one-line defs, method snippets and bullet key terms parse cleanly', () => {
  const found = sheets.pythonSignatures('def encode(x):    return x * 0.5\ndef decode(z):\n    return z\ndef backward(self):\n    pass\n');
  assert.deepEqual(found.map(item => item.text), ['encode(x)', 'decode(z)', 'backward()']);
  const card = sheets.extractLesson('# T\n\n> H.\n\n## Key Terms\n\n- **Resource:** Content that a server exposes.\n- **Prompt.** A message template.\n', {});
  assert.deepEqual(card.terms, [{ term: 'Resource', means: 'Content that a server exposes.' }, { term: 'Prompt', means: 'A message template.' }]);
});

test('sheets use anchored cards, copy buttons and a static search index', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const lesson = built.pages.find(page => page.href === '/cheatsheets/math-foundations/01-linear-algebra-intuition').html;
  assert.match(lesson, /<section class="cs-section" aria-labelledby="start-here">/);
  assert.match(lesson, /<section class="cs-card cs-card-wide" id="summary" style="--rows:\d+"><header class="cs-tab"><h3>Summary<\/h3><a class="cs-anchor" href="#summary"/);
  const phase = built.pages.find(page => page.href === '/cheatsheets/math-foundations').html;
  const order = [...phase.matchAll(/ id="(l\d+|this-phase)" style="--rows:(\d+)"/g)];
  assert.deepEqual(order.slice(0, 4).map(match => match[1]), ['this-phase', 'l01', 'l02', 'l03']);
  assert.ok(order.every(match => Number(match[2]) >= 6 && Number(match[2]) < 400));
  assert.deepEqual(built.phases.map(item => item.glyph).filter(glyph => !/^[A-Z]{2}$/.test(glyph)), []);
  assert.equal(new Set(built.phases.map(item => item.glyph)).size, built.phases.length);
  assert.match(lesson, /<button type="button" class="cs-copy" data-copy/);
  const ids = [...lesson.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const index = JSON.parse(built.search);
  assert.equal(index.length, built.phases.length);
  assert.equal(index.reduce((sum, phase) => sum + phase.l.length, 0), built.phases.reduce((sum, phase) => sum + phase.lessons.length, 0));
  for (const phase of index) for (const lesson of phase.l) assert.ok(built.pages.some(page => page.href === `${phase.u}/${lesson[2]}`));
  assert.ok(built.images.every(image => fs.existsSync(image.file)));
  assert.doesNotMatch(built.pages.map(page => page.html).join(''), /&amp;#39;|&#<span/);
});

test('Build It steps carry their lead sentence and code', () => {
  const card = sheets.extractLesson(LESSON, {});
  assert.equal(card.steps.length, 1);
  assert.equal(card.steps[0].heading, 'Step 1: Scores');
  assert.match(card.steps[0].code, /^class Attention:/);
});

test('search covers every key term and formula label', () => {
  const built = sheets.buildCheatsheets({ edition: '2026-01-01' });
  const index = JSON.parse(built.search);
  const keywords = new Map(index.flatMap(phase => phase.l.map(lesson => [`${phase.u}/${lesson[2]}`, lesson[3]])));
  let checked = 0;
  for (const phase of built.phases) {
    for (const card of phase.lessons) {
      const words = keywords.get(card.href);
      for (const term of card.termNames) assert.ok(words.includes(term), `${card.path}: ${term}`);
      checked += card.termNames.length;
    }
  }
  assert.ok(checked > 3000);
});
