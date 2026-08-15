/* 譜面描画 — 噪律・稠律・玲律・晷律 共通
   Score.render(canvas, spec)
     spec.staves : ['treble'] | ['treble','bass']
     spec.items  : [{slot, stave, voice, pc, oct, dur, accent, tie}]
     dur は音価番号 0..11（第3章の表）。省略時は 5（♩）
*/
(function (root) {
"use strict";

const NOTES_JA = ["ド","ド♯","レ","レ♯","ミ","ファ","ファ♯","ソ","ソ♯","ラ","ラ♯","シ"];
const STEP  = [0,0,1,1,2,3,3,4,4,5,5,6];
const SHARP = [0,1,0,1,0,0,1,0,1,0,1,0];

/* 音価表 — 長さは4分音符を24とした相対値 */
const DUR = [
  {n:"♬",     len:6,   hollow:0, stem:1, flag:2, dot:0, tri:0},
  {n:"♬.",    len:9,   hollow:0, stem:1, flag:2, dot:1, tri:0},
  {n:"♪",     len:12,  hollow:0, stem:1, flag:1, dot:0, tri:0},
  {n:"3連♩",  len:16,  hollow:0, stem:1, flag:0, dot:0, tri:1},
  {n:"♪.",    len:18,  hollow:0, stem:1, flag:1, dot:1, tri:0},
  {n:"♩",     len:24,  hollow:0, stem:1, flag:0, dot:0, tri:0},
  {n:"3連𝅗𝅥",  len:32,  hollow:1, stem:1, flag:0, dot:0, tri:1},
  {n:"♩.",    len:36,  hollow:0, stem:1, flag:0, dot:1, tri:0},
  {n:"𝅗𝅥",     len:48,  hollow:1, stem:1, flag:0, dot:0, tri:0},
  {n:"𝅗𝅥.",    len:72,  hollow:1, stem:1, flag:0, dot:1, tri:0},
  {n:"𝅝",     len:96,  hollow:1, stem:0, flag:0, dot:0, tri:0},
  {n:"𝅝.",    len:144, hollow:1, stem:0, flag:0, dot:1, tri:0}
];

const INK = "#EDE4D2", GOLD = "#C8A23C", LINE = "#39415A",
      LEDGER = "#8A93A8", DIM = "#5A6480", BG = "#0A0C11", MUTE = "#7C8496";

/* ── 音部記号 ── */
const TREBLE = [[-0.55,5.45],
 [[-0.15,5.65],[0.25,5.35],[0.25,4.95]],[[0.25,3.50],[0.25,1.00],[0.30,-0.55]],
 [[0.32,-1.05],[0.05,-1.30],[-0.25,-1.15]],[[-0.70,-0.95],[-0.95,-0.35],[-0.90,0.35]],
 [[-0.85,1.05],[-0.45,1.55],[0.05,1.95]],[[0.55,2.35],[1.05,2.60],[1.05,3.20]],
 [[1.05,3.85],[0.50,4.25],[-0.10,4.25]],[[-0.75,4.25],[-1.08,3.80],[-1.08,3.20]],
 [[-1.08,2.62],[-0.72,2.28],[-0.25,2.30]],[[0.20,2.30],[0.55,2.60],[0.55,3.00]],
 [[0.55,3.40],[0.38,3.22],[0.10,3.16]]];

const BASS = [[0.35,1.05],
 [[0.30,0.35],[0.95,0.00],[1.45,0.40]],
 [[1.95,0.80],[1.90,1.75],[1.50,2.40]],
 [[1.10,3.05],[0.50,3.60],[-0.35,3.95]]];

function path(c, P, S, x, top) {
  c.save(); c.translate(x, top); c.scale(S, S);
  c.beginPath(); c.moveTo(P[0][0], P[0][1]);
  for (let k=1;k<P.length;k++){const s=P[k];
    c.bezierCurveTo(s[0][0],s[0][1],s[1][0],s[1][1],s[2][0],s[2][1]);}
  c.restore();
}
function clef(c, kind, x, top, S) {
  c.strokeStyle = INK; c.lineCap = "round"; c.lineJoin = "round";
  if (kind === "treble") { path(c, TREBLE, S, x, top); c.lineWidth = 0.22*S; c.stroke(); }
  else {
    path(c, BASS, S, x, top); c.lineWidth = 0.36*S; c.stroke();
    c.fillStyle = INK;
    c.beginPath(); c.arc(x + 0.38*S, top + 1.02*S, 0.42*S, 0, 7); c.fill();
    for (const dy of [0.5, 1.5]) {
      c.beginPath(); c.arc(x + 2.45*S, top + dy*S, 0.17*S, 0, 7); c.fill();
    }
  }
}

/* ── 記号 ── */
function sharp(c, x, y, S) {
  const u = S/11;
  c.strokeStyle = "#C8B89A"; c.lineWidth = 1.1*u;
  c.beginPath();
  c.moveTo(x-1.6*u, y-3.6*u); c.lineTo(x-1.6*u, y+3.0*u);
  c.moveTo(x+1.6*u, y-4.2*u); c.lineTo(x+1.6*u, y+2.4*u); c.stroke();
  c.lineWidth = 2.0*u;
  c.beginPath();
  c.moveTo(x-3.4*u, y-0.6*u); c.lineTo(x+3.4*u, y-1.9*u);
  c.moveTo(x-3.4*u, y+2.3*u); c.lineTo(x+3.4*u, y+1.0*u); c.stroke();
}
function head(c, x, y, S, hollow, color) {
  c.save(); c.translate(x, y); c.rotate(-0.33);
  c.beginPath(); c.ellipse(0, 0, 0.60*S, 0.44*S, 0, 0, 7);
  if (hollow) { c.strokeStyle = color; c.lineWidth = 0.17*S; c.stroke(); }
  else { c.fillStyle = color; c.fill(); }
  c.restore();
}
function flags(c, x, yTip, S, n, up, color) {
  c.strokeStyle = color; c.lineWidth = 0.15*S; c.lineCap = "round";
  for (let i=0;i<n;i++) {
    const y = yTip + (up ? 1 : -1) * i * 0.72*S;
    c.beginPath(); c.moveTo(x, y);
    if (up) c.bezierCurveTo(x+0.75*S, y+0.45*S, x+0.85*S, y+1.15*S, x+0.55*S, y+1.75*S);
    else    c.bezierCurveTo(x+0.75*S, y-0.45*S, x+0.85*S, y-1.15*S, x+0.55*S, y-1.75*S);
    c.stroke();
  }
}

/* ── 本体 ── */
function render(cv, spec) {
  const S = spec.S || 11, W = spec.W || 1160;
  const LEFT = 104, RIGHT = 44, GAP = spec.gap || 34;
  const staves = spec.staves || ["treble"];
  const REF = {treble: 38, bass: 26};
  const STAVE_H = 4*S, STAVE_GAP = 8*S;
  const sysH = staves.length*STAVE_H + (staves.length-1)*STAVE_GAP + 11*S;

  const slots = spec.slots ?? (Math.max(...spec.items.map(i=>i.slot)) + 1);
  const breaks = new Set(spec.breaks || []);

  /* 枠ごとの横幅 — 長い音符ほど広く取る */
  const maxLen = new Array(slots).fill(24);
  for (const it of spec.items) {
    const L = DUR[it.dur ?? 5].len;
    if (L > maxLen[it.slot]) maxLen[it.slot] = L;
  }
  const wOf = i => GAP*(0.62 + 0.38*Math.sqrt(maxLen[i]/24));

  /* 行組み */
  const avail = W - LEFT - RIGHT, rows = [];
  let cur = {from:0, xs:[], w:0};
  for (let i=0;i<slots;i++) {
    const w = wOf(i);
    if (cur.xs.length && (breaks.has(i) || cur.w + w > avail)) {
      rows.push(cur); cur = {from:i, xs:[], w:0};
    }
    cur.xs.push(cur.w); cur.w += w;
  }
  if (cur.xs.length) rows.push(cur);

  const rowOf = new Array(slots), xOf = new Array(slots);
  rows.forEach((r,ri)=> r.xs.forEach((x,k)=>{ rowOf[r.from+k]=ri; xOf[r.from+k]=LEFT+x; }));

  const head0 = spec.title ? 106 : 40;
  const H = head0 + rows.length*sysH + 34;
  const dpr = Math.min(2, (root.devicePixelRatio || 1));
  cv.width = W*dpr; cv.height = H*dpr;
  if (cv.style) cv.style.height = H + "px";
  const c = cv.getContext("2d"); c.scale(dpr, dpr);
  c.fillStyle = BG; c.fillRect(0,0,W,H);

  if (spec.title) {
    c.fillStyle = INK; c.font = '700 30px "Shippori Mincho B1",serif';
    c.fillText(spec.title, 48, 58);
    if (spec.meta) { c.fillStyle = MUTE; c.font = '400 12px "DM Mono",monospace';
      c.fillText(spec.meta, 48, 84); }
  }

  const byRow = [];
  for (const it of spec.items) (byRow[rowOf[it.slot]] = byRow[rowOf[it.slot]] || []).push(it);

  rows.forEach((r,ri)=>{
    const rowTop = head0 + ri*sysH;
    const tops = staves.map((_,i)=> rowTop + i*(STAVE_H+STAVE_GAP));
    const last = r.from + r.xs.length - 1;
    const endX = LEFT + r.xs[r.xs.length-1] + wOf(last)*0.55 + 8;
    const bottom = tops[tops.length-1] + STAVE_H;

    c.strokeStyle = LINE; c.lineWidth = 1;
    tops.forEach(t=>{ for(let k=0;k<5;k++){
      c.beginPath(); c.moveTo(48, t+k*S+.5); c.lineTo(endX, t+k*S+.5); c.stroke(); } });
    if (staves.length > 1) {
      c.beginPath(); c.moveTo(48.5, tops[0]); c.lineTo(48.5, bottom); c.stroke();
      c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(44, tops[0]); c.lineTo(44, bottom); c.stroke();
      c.lineWidth = 1;
    }
    c.beginPath(); c.moveTo(endX-.5, tops[0]); c.lineTo(endX-.5, bottom); c.stroke();
    staves.forEach((k,i)=> clef(c, k, k==="treble"?78:70, tops[i], S));

    c.fillStyle = LINE; c.font = '400 10px "DM Mono",monospace';
    c.fillText(String(ri+1).padStart(2,"0"), 48, rowTop-10);

    for (const it of (byRow[ri]||[])) {
      const si = it.stave || 0, top = tops[si], d = DUR[it.dur ?? 5];
      const x = xOf[it.slot];
      const dia = it.oct*7 + STEP[it.pc];
      const y = top + (REF[staves[si]] - dia)*S/2;
      const col = it.accent ? GOLD : INK;
      const ry = y - top;

      c.strokeStyle = LEDGER; c.lineWidth = 1.5; c.lineCap = "butt";
      for (let l=5*S; l<=ry+0.1; l+=S){c.beginPath();c.moveTo(x-1.15*S,top+l+.5);c.lineTo(x+1.15*S,top+l+.5);c.stroke();}
      for (let l=-S; l>=ry-0.1; l-=S){c.beginPath();c.moveTo(x-1.15*S,top+l+.5);c.lineTo(x+1.15*S,top+l+.5);c.stroke();}

      head(c, x, y, S, d.hollow, col);

      let up = ry > 2*S;
      if (it.voice === 1) up = false; else if (it.voice === 0 && spec.twoVoice) up = true;
      if (d.stem) {
        const sx = up ? x+0.56*S : x-0.56*S;
        const sy = up ? y-3.3*S : y+3.3*S;
        c.strokeStyle = col; c.lineWidth = 0.14*S; c.lineCap = "butt";
        c.beginPath(); c.moveTo(sx, y + (up?-1:1)*0.08*S); c.lineTo(sx, sy); c.stroke();
        if (d.flag) flags(c, sx, sy, S, d.flag, up, col);
        if (d.tri) {
          c.fillStyle = GOLD; c.font = `italic 700 ${Math.round(0.95*S)}px "DM Mono",monospace`;
          c.fillText("3", sx + (up?2:-8), sy + (up?-3:10));
        }
      }
      if (d.dot) { c.fillStyle = col;
        c.beginPath();
        c.arc(x+1.30*S, y - (Math.abs(ry/S - Math.round(ry/S))<0.01 ? 0.5*S : 0), 0.16*S, 0, 7);
        c.fill(); }
      if (SHARP[it.pc]) sharp(c, x-1.60*S, y, S);
      if (it.bar) { c.strokeStyle = DIM; c.lineWidth = 1;
        const bx = x + wOf(it.slot)*0.55 + 3;
        c.beginPath(); c.moveTo(bx, tops[0]); c.lineTo(bx, bottom); c.stroke(); }
    }
  });
  return cv;
}

root.Score = {render, DUR, NOTES_JA, STEP, SHARP};
})(typeof window !== "undefined" ? window : globalThis);
