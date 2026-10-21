import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as G from "../agent-machine/kit/lathe.mjs";
import { CONCEPT, PART_ORDER } from "./content.mjs";
import { castShadowSvg, glassSvg, silhouetteSvg, W, H, PLATE, PLATE_H, FOOT_H, RAIL, RAIL_Y, XS, HOME_X, SLED, STACK, HEAD, BED, BOARD, IR, PINS, SHEET, TRAYS, stackTop, P, V, at, depth, S, Ln, Dots, box, post, screws, seam, plan, DRAWERS, TEXT_DRAWER, cursorSvg } from "./parts.mjs";

export * from "./parts.mjs";

export const items = [];
export const EXPLODE = { base: [0, 0, 0], rail: [0, 0, 0], carriage: [0, 8, 12] };
PART_ORDER.forEach((asm, i) => {
  if (asm !== "carriage") EXPLODE[asm] = [(i - 4) * 3, -16 - (i % 2) * 8, 10 + (i % 3) * 4];
});
export const ASSEMBLIES = Object.keys(EXPLODE);

function put(id, asm, ref, svg, { bias = 0 } = {}) {
  items.push({ id, asm, ref, key: depth(ref) + bias, svg });
}

const corners3 = (x0, y0, z0, x1, y1, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
export const BODIES = {
  header: [-15, -52, 2.4, 15, -21, 30],
  sections: [-16, -60, 2.4, 16, -16, 45],
  disasm: [-19, -56, 2.4, 19, -14, 15],
  cfg: [-19, -62, 2.4, 19, -12, 12],
  lift: [-16, -60, 2.4, 16, -16, 35],
  types: [-17, -58, 2.4, 17, -16, 20],
  structure: [-17, -58, 2.4, 17, -16, 19],
  pseudocode: [-16, -58, 2.4, 16, -18, 28],
  ledger: [-19, -62, 2.4, 19, -14, 21],
};
function shadows() {
  const out = [];
  for (const [asm, [x0, y0, z0, x1, y1, z1]] of Object.entries(BODIES)) {
    const x = XS[asm];
    out.push(castShadowSvg([...corners3(x - 19, -66, 0, x + 19, -8, 2.4), ...corners3(x + x0, y0, z0, x + x1, y1, z1)]));
  }
  put("shadows", "base", [0, 0, -90], out.join(""), { bias: -900 });
}
const BODY_TOP = { sections: 40, disasm: 13, cfg: 9, lift: 20, types: 15, structure: 12, pseudocode: 24, ledger: 18 };
const bodyInk = (asm) => inkHull(XS[asm] + BODIES[asm][0], BODIES[asm][1], BODIES[asm][2], XS[asm] + BODIES[asm][3], BODIES[asm][4], BODY_TOP[asm]);
const inkHull = (x0, y0, z0, x1, y1, z1) => silhouetteSvg(corners3(x0, y0, z0, x1, y1, z1));

function stationBase(x, y0 = -66, y1 = -8, h = 2.4) {
  const p = plan(x - 19, y0, x + 19, y1, 2);
  return S(k.slabOf(p, 0, h, P, 4, 0.6), { tone: "lo" }) + screws(k.corners(p, 2.2).map(([px, py]) => [px, py, h])) + inkHull(x - 19, y0, 0, x + 19, y1, h);
}

function lamp(asm) {
  const body = BODIES[asm];
  const x = asm === "header" ? XS.header + 12 : XS[asm] + body[3] - 3;
  const y = asm === "header" ? -24 : body[4] - 3;
  const z = asm === "header" ? 2.4 : BODY_TOP[asm];
  const svg = S(k.cylinder(x, y, 2.6, z, 0.9, P, 20), { tone: "lo" }) + S(k.cylinder(x, y, 2, z + 0.9, 2.2, P, 20), { material: "lamp", tone: "hi" });
  put(`lamp-${asm}`, asm, [x, y, z + 2], `<g data-live="lamp-${asm}">${svg}</g>`, { bias: 4 });
}

function basePlate() {
  const out = [castShadowSvg(k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0).map(([x, y, z]) => [x, y, z]), -PLATE_H - FOOT_H)];
  const feet = k.corners(PLATE, 20).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo", material: "board" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid", material: "board" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", material: "board", inner: Ln(k.sideSeam(PLATE, -3.4, P, 8), { tone: "faint" }) }));
  out.push(silhouetteSvg(k.boxCorners(PLATE, -PLATE_H, 0)));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 9);
  out.push(Ln(corners.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(screws(corners.map(([x, y]) => [x, y, 0]), 0.5));
  const strip = plan(-238, PLATE.y + PLATE.d - 9, 238, PLATE.y + PLATE.d - 5, 1);
  out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 13, strip.y, 0.5, [1.4, 2.8], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  put("plate", "base", [0, 0, -100], out.join(""), { bias: -1000 });
}

function rail() {
  const out = [];
  out.push(box(RAIL.x0, RAIL.y0, 0, RAIL.x1, RAIL.y1, RAIL.z, { tone: "lo" }, { r: 1, steps: 3 }));
  out.push(Ln(k.lineOnTop([RAIL.x0 + 2, RAIL_Y - 2], [RAIL.x1 - 2, RAIL_Y - 2], RAIL.z, P) + k.lineOnTop([RAIL.x0 + 2, RAIL_Y + 2], [RAIL.x1 - 2, RAIL_Y + 2], RAIL.z, P), { tone: "mid" }));
  const stops = Object.values(XS).map((x) => k.lineOnTop([x, RAIL.y0 + 0.6], [x, RAIL.y1 - 0.6], RAIL.z, P)).join("");
  out.push(Ln(stops, { tone: "faint" }));
  out.push(screws([[RAIL.x0 + 3, RAIL_Y, RAIL.z], [RAIL.x1 - 3, RAIL_Y, RAIL.z]], 0.45));
  put("rail", "rail", [0, 0, -50], out.join(""), { bias: -500 });
}

export const plateWidth = (text, size) => text.length * size * 0.62 + size * 1.8;
function nameplate(asm) {
  const text = CONCEPT[asm];
  const size = 5.2;
  const cx = XS[asm];
  const w = plateWidth(text, size);
  const y = 30;
  const svg = box(cx - w / 2, y, 0, cx + w / 2, y + 7, 0.8, { tone: "mid" }, { r: 0.6, steps: 2 })
    + k.faceTextSvg(k.topMatrix([cx, y + 3.5 + size * 0.36], 0.8, P, "x"), text, { size, tone: "hi", anchor: "middle" })
    + screws([[cx - w / 2 + 1.2, y + 3.5, 0.8], [cx + w / 2 - 1.2, y + 3.5, 0.8]], 0.38);
  put(`tag-${asm}`, asm, [cx, y + 3.5, 0.4], svg, { bias: 1.5 });
}

function press(asm) {
  const x = XS[asm];
  const cx = x + 16;
  const out = [];
  out.push(post(cx, 7, 3.4, 0, 1.4, { tone: "lo" }, 24));
  out.push(post(cx, 7, 2.2, 1.4, HEAD.armZ, { tone: "mid", crease: "none" }, 20));
  out.push(Ln([10, 20].map((z) => k.sideArc(cx, 7, 2.2, z, P, 14)).join(""), { tone: "faint" }));
  put(`${asm}-column`, asm, [cx, 7, 24], out.join(""), { bias: 2 });
  const arm = box(x - 6, 4, HEAD.armZ, cx + 3, 22, HEAD.armTop, { tone: "mid" }, { r: 1, bevel: 0.4, inner: seam(plan(x - 6, 4, cx + 3, 22, 1), HEAD.armZ + 2, 3) })
    + screws([[x - 3, 19, HEAD.armTop], [x + 3, 19, HEAD.armTop], [cx, 7, HEAD.armTop]], 0.42);
  put(`${asm}-arm`, asm, [x + 4, 13, HEAD.armZ + 2], arm, { bias: 14 });
  put(`${asm}-rod`, asm, [x, RAIL_Y, HEAD.armZ - 6], `<path class="iso-line" data-tone="mid" data-live="rod-${asm}" style="stroke-width:1.2" d=""/>`, { bias: 15 });
  put(`${asm}-head`, asm, [x, RAIL_Y, HEAD.home + 2], headSvg(x), { bias: 16 });
}

export function headSvg(x) {
  const z0 = HEAD.home;
  const z1 = z0 + HEAD.h;
  return box(x - 6.5, RAIL_Y - 5.5, z0 + 1.2, x + 6.5, RAIL_Y + 5.5, z1, { tone: "hi" }, { r: 1.2, bevel: 0.4 })
    + box(x - 7.5, RAIL_Y - 4.5, z0, x + 7.5, RAIL_Y + 4.5, z0 + 1.2, { tone: "mid" }, { r: 0.5 })
    + Dots(k.dotGrid(x - 4.4, RAIL_Y - 3.6, 5, 4, 2.2, z1, P), { size: 0.34, tone: "lo" });
}

function header() {
  const x = XS.header;
  const out = [stationBase(x)];
  out.push(box(x - 15, -52, 2.4, x - 11.5, -38, 30, { tone: "mid" }, { r: 0.6 }));
  out.push(box(x + 11.5, -52, 2.4, x + 15, -38, 30, { tone: "mid" }, { r: 0.6 }));
  out.push(screws([[x - 13.2, -45, 30], [x + 13.2, -45, 30]], 0.42));
  put("header", "header", [x, -45, 14], out.join(""));
  const reel = G.frameAlong([x - 11.5, -45, 24], [1, 0, 0]);
  const drum = S(G.disc(0, 23, 8, reel, P, { steps: 48 }), { tone: "hi", inner: k.fadedSvg(G.ribsOf(reel, 0, 23, 8, 28, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) })
    + S(G.disc(3, 5, 9.6, reel, P, { steps: 48 }), { tone: "mid" }) + S(G.disc(18, 20, 9.6, reel, P, { steps: 48 }), { tone: "mid" });
  put("header-reel", "header", [x, -45, 24], drum, { bias: 2 });
  const tape = box(x - 6, -40, 2.4, x + 6, -9.5, 2.9, { tone: "hi" }, { r: 0, steps: 1 })
    + Ln(Array.from({ length: 13 }, (_, i) => k.lineOnTop([x - 6, -38 + i * 2.2], [x + 6, -38 + i * 2.2], 2.9, P)).join(""), { tone: "faint" });
  put("header-tape", "header", [x, -25, 2.6], tape, { bias: 1 });
  const reader = box(x - 9, -31, 2.9, x + 9, -21, 11, { tone: "mid" }, { r: 1, bevel: 0.4, inner: seam(plan(x - 9, -31, x + 9, -21, 1), 6, 3) })
    + S(k.cylinder(x, -26, 3.6, 11, 1.2, P, 32), { tone: "hi" })
    + Ln(k.radialTicks(x, -26, 3.2, 12, 3, 12.2, [0.5, 0.9], P, -Math.PI * 0.6, Math.PI * 0.6).major, { tone: "mid" })
    + Ln(k.ring(x, -26, 0.6, 12.2, P, 12), { tone: "mid" })
    + `<path class="iso-line" data-tone="hi" data-free="end" data-live="needle" style="stroke-width:1" d=""/>`;
  put("header-reader", "header", [x, -26, 8], reader, { bias: 3 });
  RIG.needle = [x, -26, 12.3];
}

function sections() {
  const x = XS.sections;
  const out = [stationBase(x)];
  const cab = plan(x - 16, -60, x + 16, -16, 1.4);
  out.push(S(k.slabOf(cab, 2.4, 37.6, P, 3, 0.8), { tone: "mid", inner: seam(cab, 21.2, 3) }));
  DRAWERS.forEach(([z0, z1], i) => {
    if (i === TEXT_DRAWER) {
      out.push(box(x - 13, -16.2, z0, x + 13, -16, z1, { tone: "lo" }, { r: 0, steps: 1 }));
      return;
    }
    out.push(box(x - 13, -16, z0, x + 13, -14.8, z1, { tone: "mid" }, { r: 0.4 }));
    out.push(box(x - 4, -14.8, z0 + 2.6, x + 4, -13.2, z0 + 4.2, { tone: "hi" }, { r: 0.4 }));
  });
  const index = plan(x - 11, -52, x + 11, -30, 1);
  out.push(S(k.slabOf(index, 40, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(Ln(Array.from({ length: 6 }, (_, i) => k.lineOnTop([x - 9, -49 + i * 3.4], [x + 9, -49 + i * 3.4], 45, P)).join(""), { tone: "lo" }));
  out.push(bodyInk("sections"));
  put("sections", "sections", [x, -38, 22], out.join(""));
  put("drawer", "sections", [x, -10, DRAWERS[TEXT_DRAWER][0] + 4], `<g data-live="drawer"></g>`, { bias: 2 });
  const lock = box(x - 13, -43, 45, x + 13, -39.5, 47.4, { tone: "hi" }, { r: 0.6, bevel: 0.3 }) + post(x - 13.6, -41.2, 1.4, 40, 47.6, { tone: "mid" }, 14) + post(x + 13.6, -41.2, 1.4, 40, 47.6, { tone: "mid" }, 14);
  put("lock", "sections", [x, -41, 46], `<g data-live="lock" style="display:none">${lock}</g>`, { bias: 9 });
}

function disasm() {
  const x = XS.disasm;
  const out = [stationBase(x)];
  const body = plan(x - 19, -56, x + 19, -14, 1.6);
  out.push(S(k.slabOf(body, 2.4, 10.6, P, 3, 0.8), { tone: "mid", inner: seam(body, 8, 3) }));
  out.push(box(x - BED.half - 0.6, BED.y0, 13, x + BED.half + 0.6, BED.y1, BED.z, { tone: "lo" }, { r: 0.3, steps: 2 }));
  out.push(box(x - 18, -44, 13, x + 18, -42.6, 15, { tone: "mid" }, { r: 0.3 }));
  out.push(box(x - 18, -21.4, 13, x + 18, -20, 15, { tone: "mid" }, { r: 0.3 }));
  out.push(bodyInk("disasm"));
  put("disasm", "disasm", [x, -35, 8], out.join(""));
  put("tiles", "disasm", [x, -32, BED.z + 0.5], `<g data-live="tiles"></g>`, { bias: 6 });
  put("bed-glass", "disasm", [x, -32, 16.2], glassSvg(x - BED.half - 0.4, BED.y0 + 0.6, 16.1, x + BED.half + 0.4, BED.y1 - 0.6, 16.4), { bias: 7 });
  put("cursor", "disasm", [x, -32, 20], `<g data-live="cursor">${cursorSvg(x - BED.half)}</g>`, { bias: 8 });
}

function cfg() {
  const x = XS.cfg;
  const out = [stationBase(x)];
  const board = plan(x - 19, BOARD.y0, x + 19, BOARD.y1, 1.6);
  out.push(S(k.slabOf(board, 2.4, BOARD.z - 2.4, P, 3, 0.8), { tone: "mid" }));
  out.push(Dots(k.dotGrid(x - 16, BOARD.y0 + 3, 9, 12, 4, BOARD.z, P), { size: 0.3, tone: "faint" }));
  out.push(box(x + 10, -32, BOARD.z, x + 18, -19, BOARD.z + 3, { tone: "lo" }, { r: 0.4 }));
  out.push(box(x + 11, -31, BOARD.z + 0.4, x + 17, -20, BOARD.z + 0.6, { tone: "lo" }, { r: 0, steps: 1 }));
  out.push(bodyInk("cfg"));
  put("cfg", "cfg", [x, -37, 5], out.join(""));
  put("graph", "cfg", [x - 4, -40, BOARD.z + 1], `<g data-live="graph"></g>`, { bias: 8 });
  put("bin", "cfg", [x + 14, -25, BOARD.z + 2], `<g data-live="bin"></g>`, { bias: 9 });
}

function lift() {
  const x = XS.lift;
  const out = [stationBase(x)];
  const body = plan(x - 16, -60, x + 16, -16, 1.4);
  out.push(S(k.slabOf(body, 2.4, 17.6, P, 3, 0.8), { tone: "mid", inner: seam(body, 11, 3) }));
  out.push(box(x - 11, -48, 20, x + 11, -28, 20.6, { tone: "lo" }, { r: 0.4 }));
  for (const px of [x - 12.6, x + 12.6]) out.push(post(px, -38, 1.5, 20, 35, { tone: "mid" }, 16));
  out.push(screws([[x - 14, -58, 20], [x + 14, -58, 20], [x - 14, -18, 20], [x + 14, -18, 20]], 0.42));
  out.push(bodyInk("lift"));
  put("lift", "lift", [x, -38, 11], out.join(""));
  put("irstack", "lift", [x, -38, IR.z + 4], `<g data-live="irstack"></g>`, { bias: 6 });
  put("ir-glass", "lift", [x, -38, 27], glassSvg(x - 10.2, -47.4, 20.6, x + 10.2, -28.6, 34), { bias: 7 });
  const bolt = box(x - 15, -40, 33, x + 15, -36, 36, { tone: "hi" }, { r: 0.8, bevel: 0.3 });
  put("bolt", "lift", [x, -38, 34], `<g data-live="bolt" style="display:none">${bolt}</g>`, { bias: 9 });
}

export function pinSlot(i) {
  const x = XS.types;
  return [x - 9 + (i % 4) * 6, i < 4 ? -44 : -32];
}
function types() {
  const x = XS.types;
  const out = [stationBase(x)];
  const body = plan(x - 17, -58, x + 17, -16, 1.4);
  out.push(S(k.slabOf(body, 2.4, PINS.z - 2.4, P, 3, 0.8), { tone: "mid", inner: seam(body, 9, 3) }));
  const rings = [];
  for (let i = 0; i < PINS.slots; i++) {
    const [px, py] = pinSlot(i);
    rings.push(k.ring(px, py, PINS.r + 0.6, PINS.z, P, 20));
  }
  out.push(Ln(rings.join(""), { tone: "lo" }));
  out.push(bodyInk("types"));
  put("types", "types", [x, -37, 8], out.join(""));
  for (let i = 0; i < PINS.slots; i++) {
    const [px, py] = pinSlot(i);
    const pin = post(px, py, PINS.r, PINS.z, PINS.z + PINS.rise, { tone: "hi" }, 18) + S(k.cylinder(px, py, PINS.r + 0.5, PINS.z + PINS.rise, 0.8, P, 18), { tone: "hi" });
    put(`pin${i}`, "types", [px, py, PINS.z + 2], `<g data-live="pin${i}" style="display:none">${pin}</g>`, { bias: 8 + i * 0.01 });
  }
}

function structure() {
  const x = XS.structure;
  const out = [stationBase(x)];
  const body = plan(x - 17, -58, x + 17, -16, 1.4);
  out.push(S(k.slabOf(body, 2.4, 9.6, P, 3, 0.8), { tone: "mid", inner: seam(body, 7, 3) }));
  out.push(box(x - 14, -50, 12, x + 14, -24, 13, { tone: "lo" }, { r: 0.6 }));
  out.push(box(x - 3.4, -42, 13, x + 3.4, -32, 19, { tone: "mid" }, { r: 0.6, bevel: 0.3 }));
  out.push(bodyInk("structure"));
  put("structure", "structure", [x, -37, 7], out.join(""));
  put("jaw-a", "structure", [x - 10, -37, 16], `<g data-live="jaw-a">${box(x - 13, -46, 13, x - 8.4, -28, 18, { tone: "hi" }, { r: 0.6, bevel: 0.3 })}</g>`, { bias: 8 });
  put("jaw-b", "structure", [x + 10, -37, 16], `<g data-live="jaw-b">${box(x + 8.4, -46, 13, x + 13, -28, 18, { tone: "hi" }, { r: 0.6, bevel: 0.3 })}</g>`, { bias: 8 });
}

function pseudocode() {
  const x = XS.pseudocode;
  const out = [stationBase(x)];
  const body = plan(x - 16, -58, x + 16, -18, 1.4);
  out.push(S(k.slabOf(body, 2.4, 21.6, P, 3, 0.8), { tone: "mid", inner: seam(body, 14, 3) }));
  out.push(box(x - 12, -37, 24, x + 12, -33.6, 24.4, { tone: "lo" }, { r: 0.3, steps: 2 }));
  const roll = G.frameAlong([x - 14, -26, 27], [1, 0, 0]);
  out.push(box(x - 15, -28.5, 24, x - 13.5, -23.5, 27, { tone: "mid" }, { r: 0.3 }) + box(x + 13.5, -28.5, 24, x + 15, -23.5, 27, { tone: "mid" }, { r: 0.3 }));
  out.push(S(G.disc(0.6, 27.4, 2.4, roll, P, { steps: 28 }), { tone: "hi" }));
  out.push(bodyInk("pseudocode"));
  put("pseudocode", "pseudocode", [x, -38, 12], out.join(""));
  put("sheet", "pseudocode", [x, SHEET.y, SHEET.z + 4], `<g data-live="sheet"></g>`, { bias: 6 });
}

export function trayX(i) {
  return XS.ledger - 13.2 + i * 8.8;
}
function ledger() {
  const x = XS.ledger;
  const out = [stationBase(x)];
  const cab = plan(x - 19, -62, x + 19, -14, 1.6);
  out.push(S(k.slabOf(cab, 2.4, 15.6, P, 3, 0.8), { tone: "mid", inner: seam(cab, 10, 3) }));
  for (let i = 0; i < 4; i++) {
    const tx = trayX(i);
    out.push(box(tx - 3.8, TRAYS.y0 - 1, 18, tx + 3.8, TRAYS.y1 + 1, TRAYS.z, { tone: "lo" }, { r: 0.4 }));
    out.push(box(tx - 3.8, TRAYS.y0 - 1, TRAYS.z, tx + 3.8, TRAYS.y0, TRAYS.z + 2.4, { tone: "mid" }, { r: 0.2 }));
  }
  out.push(bodyInk("ledger"));
  put("ledger", "ledger", [x, -38, 10], out.join(""));
  for (let i = 0; i < 4; i++) {
    const tx = trayX(i);
    const tone = ["hi", "mid", "lo", "faint"][i];
    const cards = [];
    for (let j = 0; j < TRAYS.slots; j++) {
      const z = TRAYS.z + j * TRAYS.step;
      cards.push(`<g data-card="${j}" style="display:none">${box(tx - 3, TRAYS.y0 + 1, z, tx + 3, TRAYS.y1 - 1, z + TRAYS.t, { tone }, { r: 0.3, steps: 2 })}</g>`);
    }
    put(`tray${i}`, "ledger", [tx, (TRAYS.y0 + TRAYS.y1) / 2, TRAYS.z + 3], `<g data-live="tray${i}">${cards.join("")}</g>`, { bias: 6 + i * 0.01 });
  }
}

function carriage() {
  const x = HOME_X;
  const out = [];
  out.push(box(x - SLED.w / 2, SLED.y0, SLED.z0, x + SLED.w / 2, SLED.y1, SLED.z1, { tone: "mid", material: "ride" }, { r: 1.2, bevel: 0.4 }));
  out.push(box(x - SLED.w / 2 - 1, RAIL_Y - 3, 0.6, x + SLED.w / 2 + 1, RAIL_Y + 3, SLED.z0 + 0.6, { tone: "lo" }, { r: 0.6 }));
  out.push(box(x + 8.4, SLED.y0 + 1, SLED.z1, x + 10, SLED.y1 - 1, SLED.z1 + 11.6, { tone: "mid" }, { r: 0.3 }));
  out.push(screws([[x - 9, SLED.y0 + 1.4, SLED.z1], [x - 9, SLED.y1 - 1.4, SLED.z1]], 0.4));
  put("carriage", "carriage", [x, RAIL_Y, SLED.z1], out.join(""), { bias: 0 });
  for (let i = 0; i < STACK.slots; i++) {
    const z = stackTop(i);
    put(`card${i}`, "carriage", [x, RAIL_Y, z + 0.5], `<g data-live="card${i}" style="display:none">${box(x - 8, SLED.y0 + 1.6, z, x + 8, SLED.y1 - 1.6, z + STACK.t, { tone: "hi" }, { r: 0.4, steps: 2 })}</g>`, { bias: 0.2 + i * 0.02 });
  }
}

export const RIG = {};
const ANCHORS = {
  header: [XS.header, -26, 12],
  sections: [XS.sections, -41, 45],
  disasm: [XS.disasm, -32, 16.4],
  cfg: [XS.cfg - 6, -44, 13],
  lift: [XS.lift, -38, 34],
  types: [XS.types, -38, 20],
  structure: [XS.structure, -37, 19],
  pseudocode: [XS.pseudocode, -35, 26],
  ledger: [XS.ledger, -40, 22],
};
export const LABELS = Object.entries(ANCHORS).map(([asm, point], i) => {
  const roof = at([XS[asm], -62, 46])[1] - [62, 38, 14][i % 3];
  return { asm, at: point, dx: 0, dy: Math.round(roof - at(point)[1]) };
});

export function build() {
  items.length = 0;
  basePlate();
  rail();
  header();
  sections();
  disasm();
  cfg();
  lift();
  types();
  structure();
  pseudocode();
  ledger();
  for (const asm of PART_ORDER) if (asm !== "carriage") press(asm);
  for (const asm of PART_ORDER) if (asm !== "carriage") lamp(asm);
  shadows();
  carriage();
  return RIG;
}

