'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const ROWS = [
  { hue: 'green', title: 'unchanged', cached: 2998, total: 2999, ttft: 45.1, value: '45.1 ms' },
  { hue: 'rose', title: 'request id at the start', cached: 5, total: 3034, ttft: 1255.3, value: '1,255.3 ms' },
  { hue: 'green', title: 'request id at the end', cached: 2985, total: 3028, ttft: 88.2, value: '88.2 ms' },
];

module.exports = figure('plate-sglang-request', {
  height: 584,
  title: 'One request, three processes, one cache',
  desc: 'A chat request with a 2,999-token prompt crosses the tokenizer manager, the scheduler, and the detokenizer, drawn as three machines on one bench. The scheduler finds 2,998 tokens in the radix cache, prefills one, and the first token arrives in 34.0 ms. Below, three versions of the same system prompt: unchanged, with a request id at the start, and with the id at the end. Bar length is prompt tokens, green is cached, rose is recomputed, and tower height is median time to first token.',
}, f => {
  const bench = f.isoView({ ox: 0, oy: 168, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue, options = {}) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };

  f.kicker(20, 18, 'one request · round 3 of the stable system prompt');
  f.isoBeam(bench, { sx0: 14, sx1: 626, c: 60, back: 120, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const stations = [
    { cx: 70, w: 100, hue: 'olive', title: 'client', sub: '2,999 tokens' },
    { cx: 220, w: 160, hue: 'blue', title: 'TokenizerManager', sub: 'text to ids' },
    { cx: 390, w: 140, hue: 'blue', title: 'Scheduler', sub: 'match_prefix' },
    { cx: 550, w: 140, hue: 'blue', title: 'Detokenizer', sub: 'ids to text' },
  ];
  const face = (machine, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => machine.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const machines = stations.map(station => {
    f.box({ x: station.cx - station.w / 2, y: 32, w: station.w, h: 52, hue: station.hue, title: station.title, sub: [station.sub] });
    return unit(bench, station.cx, 0, 46, 30, station.hue);
  });
  const [client, tokenizer, scheduler, detokenizer] = machines;
  face(client, [[8, 46, 9], [38, 46, 9], [38, 46, 25], [8, 46, 25]], 'olive-ink', 0.85);
  for (const k of [20, 15]) face(client, [[12, 46, k], [30, 46, k], [30, 46, k - 1.6], [12, 46, k - 1.6]], 'olive-fill', 0.9);
  for (const v of [10, 21, 32]) face(tokenizer, [[9, v, 30], [37, v, 30], [37, v + 4, 30], [9, v + 4, 30]], 'blue-ink', 0.55);
  const drum = f.isoDrum(bench, { x: scheduler.box.x + 23, y: scheduler.box.y + 23, z: 30, r: 13, h: 12, hue: 'green' });
  const slip = detokenizer.box;
  f.isoBlock(bench, { x: slip.x + slip.w, y: slip.y + 12, z: 10, w: 12, d: 22, h: 2, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  machines.forEach((machine, index) => {
    const target = machine === scheduler ? drum.top : machine.top;
    f.leader([stations[index].cx, 86], target, { hue: stations[index].hue });
  });
  const styles = ['call', 'event', 'event'];
  for (let i = 0; i < 3; i += 1) {
    f.beat(i + 1);
    const from = machines[i].P(46, 0, 15);
    const to = machines[i + 1].P(0, 46, 15);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: styles[i] });
  }

  f.beat(4);
  const prompt = f.isoView({ ox: 0, oy: 292, angle: 'true' });
  f.kicker(20, 234, 'the prompt as the radix cache saw it');
  f.text(20, 254, '2,998 cached tokens · system prompt and chat template', { size: 12, weight: 700, hue: 'green' });
  f.isoBeam(prompt, { sx0: 20, sx1: 606, c: 0, back: 30, h: 14, hue: 'green' });
  f.beat(5);
  f.isoBeam(prompt, { sx0: 606, sx1: 620, c: 0, back: 30, h: 14, hue: 'plum', shadow: false });
  f.text(20, 316, 'first token after 34.0 ms', { size: 12, weight: 700, hue: 'plum' });
  f.text(620, 316, '1 new token', { size: 11, anchor: 'end', hue: 'plum' });

  f.beat(0);
  f.kicker(20, 356, 'the same system prompt three ways · median of rounds 2 to 5 or 1 to 5');
  const yard = f.isoView({ ox: 0, oy: 516, angle: 'true' });
  f.isoBeam(yard, { sx0: 436, sx1: 626, c: 30, back: 60, h: 5, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const span = 380;
  const scale = 108 / 1255.3;
  ROWS.forEach((row, index) => {
    f.beat(6 + index);
    const view = f.isoView({ ox: 0, oy: 410 + index * 50, angle: 'true' });
    const baseline = 410 + index * 50 - 30;
    f.step(29, baseline - 4, index + 1, { hue: row.hue });
    f.text(46, baseline, row.title, { size: 12, weight: 700 });
    f.text(404, baseline, `${row.cached.toLocaleString('en-US')} of ${row.total.toLocaleString('en-US')} cached`, { size: 12, serif: true, hue: 'ink-soft', anchor: 'end' });
    const end = 20 + span * row.total / 3034;
    const split = Math.min(end - 3, Math.max(23, 20 + span * row.cached / 3034));
    f.isoBeam(view, { sx0: 20, sx1: split, c: 0, back: 24, h: 12, hue: 'green' });
    f.isoBeam(view, { sx0: split, sx1: end, c: 0, back: 24, h: 12, hue: 'rose', shadow: false });
    const cx = 470 + index * 60;
    const height = Math.max(4, row.ttft * scale);
    const tower = unit(yard, cx, 0, 24, height, row.hue === 'rose' ? 'rose' : 'plum');
    f.text(cx, tower.top[1] - 18, row.value, { size: 13, weight: 700, anchor: 'middle', hue: row.hue === 'rose' ? 'rose' : 'plum' });
    f.step(cx, 548, index + 1, { hue: row.hue });
  });

  f.beat(0);
  f.text(20, 576, 'From capture/out/cache-experiment.txt · SGLang 0.5.22 on MLX · Qwen3-0.6B-4bit', { size: 11, serif: true, hue: 'ink-mute' });
});
