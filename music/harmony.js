/* 編曲 — 玲律暗号 v0.2 用
   音高クラスの列に、リズム・オクターブ・伴奏を与えて曲の形にする。
   本文（音高クラスの並び）には一切手を触れない。
   伴奏は必ず C4(60) 未満に置かれ、主旋律は C4 以上に置かれる。
*/
(function (root) {
"use strict";

const BEAT = 24, BAR = 4*BEAT;          // 4分音符=24、1小節=4拍
const IDX = {12:2, 18:4, 24:5, 36:7, 48:8, 72:9, 96:10, 144:11};
const durIdx = len => IDX[len] ?? 5;
const BASS = 36, MID = 48;
const DEG = ["I","II","III","IV","V","VI","VII"];

/* 12音ぶんのリズム型。いずれも合計192（＝2小節） */
const MOTIF = [
  [24,12,12,24,12,12,24,12,12,12,12,24],
  [12,12,24,12,12,24,12,12,12,12,24,24],
  [18,12,18,12,24,12,12,24,12,12,12,24]
];

/* 同じ音が続いたらオクターブを振って、動きのある線にする */
function melodize(pcs, lo=60, hi=79) {
  let prev = 67; const out = [];
  for (let i=0;i<pcs.length;i++) {
    const p = pcs[i], c = [];
    for (let m=lo;m<=hi;m++) if (m%12===p) c.push(m);
    let pick;
    if (i>0 && pcs[i-1]===p && c.length>1) {
      const o = c.filter(m=>m!==prev);
      pick = o.reduce((a,b)=>Math.abs(a-prev)<Math.abs(b-prev)?a:b);
    } else {
      pick = c.reduce((a,b)=>Math.abs(a-prev)<=Math.abs(b-prev)?a:b);
    }
    out.push(pick); prev = pick;
  }
  return out;
}

function triads(scale) {
  return scale.map((_,i)=>({deg:i,
    tones:[scale[i], scale[(i+2)%7], scale[(i+4)%7]],
    minor:[1,2,5,6].includes(i)}));
}

/* 主旋律 — 節ごとにリズム型を替え、鍵の断片で息継ぎする */
function phrase(pcs, blocks, plan, dig) {
  const mel = melodize(pcs);
  const out = []; let i = 0, at = 0;
  for (let b=0;b<blocks;b++) {
    const mo = MOTIF[b % MOTIF.length];
    for (let k=0;k<dig;k++, i++) {
      out.push({pc:pcs[i], midi:mel[i], at, len:mo[k], key:false});
      at += mo[k];
    }
    const kn = plan[b];
    const kl = kn===1 ? [96] : kn===2 ? [48,48] : new Array(kn).fill(24);
    for (let k=0;k<kn;k++, i++) {
      out.push({pc:pcs[i], midi:mel[i], at, len:kl[k], key:true});
      at += kl[k];
    }
  }
  return {notes: out, total: at};
}

/* 伴奏 — 小節ごとに和音を選び、拍の格子の上に置く */
function accompany(melody, total, scale, mode) {
  const cand = triads(scale), bars = Math.ceil(total/BAR);
  const chords = [], notes = [];
  let prev = null;
  for (let b=0;b<bars;b++) {
    const t0 = b*BAR, t1 = t0+BAR;
    const w = {};
    for (const n of melody) {
      const s = Math.max(n.at, t0), e = Math.min(n.at+n.len, t1);
      if (e > s) w[n.pc] = (w[n.pc]||0) + (e-s) * (n.at>=t0 && n.at<t0+BEAT ? 1.6 : 1);
    }
    let best=null, bs=-1e9;
    for (const ch of cand) {
      let sc = 0;
      for (const p in w) sc += (ch.tones.includes(+p) ? 2.6 : -0.3) * w[p]/BEAT;
      if (ch.deg===0) sc += 0.8;
      if (ch.deg===3 || ch.deg===4) sc += 0.5;
      if (ch.deg===6) sc -= 1.6;
      if (prev) { const d=(ch.deg-prev.deg+7)%7;
        if (d===3||d===4) sc += 1.3; else if (d===5||d===2) sc += 0.5;
        else if (d===0) sc -= 2.2; }
      if (b===bars-1 && ch.deg===0) sc += 6;      // 終止は主和音へ
      if (sc>bs) { bs=sc; best=ch; }
    }
    prev = best;
    chords.push({bar:b, deg:best.deg, minor:best.minor,
                 name:DEG[best.deg]+(best.minor?"m":"")});
    const B = BASS+best.tones[0], T = MID+best.tones[1], F = MID+best.tones[2];
    const put = (m,at,len)=>notes.push({midi:m, at:t0+at, len});
    if (mode==="bass") { put(B,0,BAR/2); put(B,BAR/2,BAR/2); }
    else if (mode==="pad") { put(B,0,BAR); put(T,0,BAR); put(F,0,BAR); }
    else if (mode==="alberti") {
      put(B,0,BEAT); put(F,BEAT,BEAT); put(T,2*BEAT,BEAT); put(F,3*BEAT,BEAT);
    } else {                                       // arp — 8分で流す
      const seq=[B,T,F,T,B,T,F,T];
      for (let k=0;k<8;k++) put(seq[k], k*BEAT/2, BEAT/2);
    }
  }
  return {chords, notes, bars};
}

function arrange(pcs, opts) {
  const {blocks, plan, scale, dig=12, mode="alberti"} = opts;
  const ph = phrase(pcs, blocks, plan, dig);
  const ac = mode==="none" ? {chords:[],notes:[],bars:0}
                           : accompany(ph.notes, ph.total, scale, mode);
  return {melody: ph.notes, total: ph.total, beat: BEAT, bar: BAR,
          accomp: ac.notes, chords: ac.chords, bars: ac.bars, durIdx};
}

root.Harmony = {arrange, melodize, triads, durIdx, BEAT, BAR,
  MODES:[["alberti","アルベルティ"],["arp","分散"],["pad","持続"],["bass","低音のみ"],["none","なし"]]};
})(typeof window !== "undefined" ? window : globalThis);
