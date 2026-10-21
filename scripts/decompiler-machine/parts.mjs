import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as ink from "../agent-machine/kit/ink.mjs";

export const W = 1000;
export const H = 470;
export const AZIMUTH = 60;

export const PLATE = { x: -250, y: -82, w: 500, d: 132, r: 8 };
export const PLATE_H = 8;
export const FOOT_H = 4;
export const RAIL = { x0: -240, x1: 240, y0: 13, y1: 21, z: 1.6 };
export const RAIL_Y = 17;
export const STATIONS = ["header", "sections", "disasm", "cfg", "lift", "types", "structure", "pseudocode", "ledger"];
export const XS = Object.fromEntries(STATIONS.map((asm, i) => [asm, -208 + i * 52]));
export const HOME_X = -240 + 12;
export const SLED = { w: 22, y0: 11, y1: 23, z0: RAIL.z, z1: RAIL.z + 3 };
export const STACK = { z0: SLED.z1, step: 1.15, t: 0.9, slots: 9 };
export const HEAD = { home: 21, h: 4.4, armZ: 31, armTop: 34 };
export const BED = { half: 17, y0: -40, y1: -24, z: 13.8 };
export const BOARD = { y0: -62, y1: -12, z: 9 };
export const IR = { y0: -46, y1: -30, z: 20, t: 0.62, gap: 0.08 };
export const PINS = { z: 15, rise: 5, r: 1.5, slots: 8 };
export const SHEET = { y: -35.4, t: 0.6, z: 24.4, line: 1.5, half: 10 };
export const TRAYS = { y0: -50, y1: -30, z: 18.8, t: 0.7, step: 0.85, slots: 10, kinds: ["observed", "derived", "inferred", "unknown"] };

export const stackTop = (n) => STACK.z0 + n * STACK.step;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-250, -96, 58], [250, -96, 58], [-250, -20, 62], [250, -20, 62], [250, 56, 20]],
  W,
  H,
  { pad: 8, headroom: 34, azimuth: AZIMUTH },
);
export const V = [k.depthOf([1, 0, 0], P), k.depthOf([0, 1, 0], P), k.depthOf([0, 0, 1], P)];
export const at = (p) => k.iso(p, P);
export const depth = (p) => p[0] * V[0] + p[1] * V[1] + p[2] * V[2];

export const S = (paths, style = {}) => ink.inkSolid(paths, style);
export const Ln = (d, style) => k.lineSvg(d, style);
export const Dots = (points, style) => k.dotsSvg(points, style);
export const box = (x0, y0, z0, x1, y1, z1, style = {}, { r = 0.6, steps = 3, bevel = 0, inner = "" } = {}) =>
  S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: Math.min(r, (x1 - x0) / 2.2, (y1 - y0) / 2.2) }, z0, z1 - z0, P, r ? steps : 1, bevel), { tone: "mid", ...style, inner });
export const post = (x, y, r, z0, z1, style = {}, steps = 24) => S(k.cylinder(x, y, r, z0, z1 - z0, P, steps), { tone: "mid", ...style });
export const screws = (points, size = 0.42, tone = "mid") => Dots(points.map(at), { size, tone });
export const seam = (plan, z, steps = 3) => Ln(k.sideSeam(plan, z, P, steps), { tone: "faint" });
export const plan = (x0, y0, x1, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

export const DRAWERS = [[4.4, 12.2], [13, 20.8], [21.6, 29.4], [30.2, 38]];
export const TEXT_DRAWER = 2;
export function drawerSvg(x, open) {
  const [z0, z1] = DRAWERS[TEXT_DRAWER];
  const out = [];
  const y = -16 + open;
  if (open > 0.4) {
    out.push(box(x - 12.4, -16.4, z0 + 0.6, x + 12.4, y, z1 - 1.4, { tone: "lo" }, { r: 0, steps: 1 }));
    const tops = [];
    for (let i = 0; i < 5; i++) {
      const ly = y - 1.6 - i * 2.2;
      if (ly < -15.6) break;
      tops.push(k.lineOnTop([x - 10, ly], [x + 10, ly], z1 - 1.4, P));
    }
    out.push(Ln(tops.join(""), { tone: "mid" }));
  }
  out.push(box(x - 13, y, z0, x + 13, y + 1.2, z1, { tone: "mid" }, { r: 0.4 }));
  out.push(box(x - 4, y + 1.2, z0 + 2.6, x + 4, y + 2.8, z0 + 4.2, { tone: "hi" }, { r: 0.4 }));
  return out.join("");
}

export function cursorSvg(cx) {
  return box(cx - 1.4, -43.6, 15, cx + 1.4, -42, 21, { tone: "hi" }, { r: 0.3 })
    + box(cx - 1.4, -22, 15, cx + 1.4, -20.4, 21, { tone: "hi" }, { r: 0.3 })
    + box(cx - 1.6, -43.6, 21, cx + 1.6, -20.4, 23, { tone: "hi" }, { r: 0.5, bevel: 0.3 })
    + box(cx - 0.5, -32.8, 16.4, cx + 0.5, -31.2, 21, { tone: "hi" }, { r: 0 , steps: 1 });
}

export function sheetSvg(lines, printed) {
  const x = XS.pseudocode;
  if (!printed) return "";
  const height = printed * SHEET.line + 1.6;
  const z1 = SHEET.z + height;
  const out = [box(x - SHEET.half, SHEET.y, SHEET.z, x + SHEET.half, SHEET.y + SHEET.t, z1, { tone: "hi" }, { r: 0, steps: 1 })];
  const face = SHEET.y + SHEET.t;
  const strokes = [];
  for (let i = 0; i < printed; i++) {
    const line = lines[i];
    const indent = line.length - line.trimStart().length;
    const length = line.trim().length;
    if (!length) continue;
    const x0 = x - SHEET.half + 1.4 + indent * 0.32;
    const x1 = Math.min(x + SHEET.half - 1.2, x0 + length * 0.36);
    const z = z1 - 1.2 - i * SHEET.line;
    strokes.push(k.segment([x0, face, z], [x1, face, z], P));
  }
  out.push(Ln(strokes.join(""), { tone: "mid" }));
  return out.join("");
}

export function tilesSvg(variant) {
  const x = XS.disasm;
  const [start, end] = variant.range;
  const span = end - start;
  const reached = new Set(variant.reached);
  const scale = (BED.half * 2) / span;
  const out = [];
  variant.insns.forEach((insn, i) => {
    const x0 = x - BED.half + (insn.a - start) * scale;
    const x1 = x0 + insn.n * scale;
    const gap = Math.min(0.12, (x1 - x0) * 0.2);
    const hot = reached.has(insn.a);
    const h = hot ? 1.6 : 0.7;
    out.push([x0, `<g data-tile="${i}" style="display:none">${box(x0 + gap, BED.y0 + 2, BED.z, x1 - gap, BED.y1 - 2, BED.z + h, { tone: hot ? "hi" : "lo" }, { r: 0, steps: 1 })}</g>`]);
  });
  const marks = [];
  for (const a of variant.missed) {
    const insn = variant.descentInsns.find((item) => item.a === a);
    const x0 = x - BED.half + (insn.a - start) * scale;
    const x1 = x0 + insn.n * scale;
    marks.push(`<g data-missed style="display:none">${Ln(k.planOutline(plan(x0 + 0.1, BED.y0 + 1.4, x1 - 0.1, BED.y1 - 1.4, 0), BED.z, P, 1), { tone: "mid", dotted: true })}</g>`);
  }
  if (variant.conflict) {
    const px = x - BED.half + (variant.conflict.target - start) * scale;
    marks.push(`<g data-conflict style="display:none">${post(px, BED.y1 - 3.4, 0.7, BED.z, BED.z + 5.4, { tone: "hi" }, 12)}${S(k.cylinder(px, BED.y1 - 3.4, 1.3, BED.z + 5.4, 0.8, P, 14), { tone: "hi" })}</g>`);
  }
  return out.map(([, svg]) => svg).join("") + marks.join("");
}

export function cursorX(variant, address) {
  const [start, end] = variant.range;
  return XS.disasm - BED.half + ((address - start) / (end - start)) * BED.half * 2;
}

export function graphLayout(variant) {
  const x = XS.cfg;
  const live = variant.blocks.filter((block) => block.live);
  const layers = {};
  for (const block of live) (layers[block.layer] = layers[block.layer] || []).push(block);
  const pos = {};
  for (const [layer, list] of Object.entries(layers)) {
    list.forEach((block, j) => {
      pos[block.s] = [x - 6 + (j - (list.length - 1) / 2) * 11, BOARD.y0 + 8 + Number(layer) * 10];
    });
  }
  return pos;
}

export function graphSvg(variant) {
  const x = XS.cfg;
  const pos = graphLayout(variant);
  const live = variant.blocks.filter((block) => block.live);
  const dead = variant.blocks.filter((block) => !block.live);
  const edges = variant.edges
    .filter((edge) => pos[edge.f] && pos[edge.t] && edge.f !== edge.t)
    .map((edge) => k.lineOnTop(pos[edge.f], pos[edge.t], BOARD.z, P))
    .join("");
  const out = [`<g data-edges style="display:none">${Ln(edges, { tone: "hi" })}</g>`];
  const cubes = live
    .map((block) => [pos[block.s], block])
    .sort((a, b) => depth([a[0][0], a[0][1], 0]) - depth([b[0][0], b[0][1], 0]))
    .map(([[bx, by], block]) => {
      const h = 2.2 + Math.min(block.n, 8) * 0.45;
      return `<g data-block="${block.s}" style="display:none">${box(bx - 3.2, by - 2.6, BOARD.z, bx + 3.2, by + 2.6, BOARD.z + h, { tone: "hi" }, { r: 0.5, bevel: 0.3 })}</g>`;
    });
  out.push(...cubes);
  const row = dead.map((block, i) => {
    const bx = x - 17 + i * 2;
    return box(bx, -17, BOARD.z, bx + 1.5, -14.4, BOARD.z + 1.6, { tone: "lo" }, { r: 0, steps: 1 });
  });
  out.push(`<g data-dead style="display:none">${row.join("")}</g>`);
  return out.join("");
}

export function binSvg(count) {
  const x = XS.cfg;
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = BOARD.z + 0.6 + i * 0.5;
    out.push(box(x + 11.4, -30.4, z, x + 16.6, -20.6, z + 0.4, { tone: "lo" }, { r: 0, steps: 1 }));
  }
  return out.join("");
}

export function irSvg(count) {
  const x = XS.lift;
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = IR.z + 0.6 + i * (IR.t + IR.gap);
    out.push(`<g data-ir="${i}" style="display:none">${box(x - 9, IR.y0, z, x + 9, IR.y1, z + IR.t, { tone: "hi" }, { r: 0.4, steps: 2 })}</g>`);
  }
  return out.join("");
}


export const castShadowSvg = (points, z0 = 0) => ink.castShadowSvg(points, P, z0);
export const glassSvg = (x0, y0, z0, x1, y1, z1) => ink.glassSvg(x0, y0, z0, x1, y1, z1, P);
export const silhouetteSvg = (points) => ink.silhouetteSvg(points, P);
export const pillSvg = ink.pillSvg;
