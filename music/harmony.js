/* 伴奏づけ — 玲律暗号用
   無調の主旋律に、衝突の少ない和音を当てる。本文は一切変えない。
   Harmony.accompany(pcs, {mode, window}) -> {chords, notes}
     notes : [{midi, slot, span}]  slot は主旋律の何音目か
   伴奏は必ず C4(60) 未満に置かれる。主旋律を C4 以上に置く限り、
   「同時に鳴る音のうち最も高いものが主旋律」が常に成り立つ。
*/
(function (root) {
"use strict";

const MAJ = [0,4,7], MIN = [0,3,7];
const NAME = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const BASS_BASE = 36;   // C2〜B2
const MID_BASE  = 48;   // C3〜B3

/* 和音を選ぶ — 先の数音との一致と、根音の動きやすさで採点 */
function pick(pcs, from, win, prev) {
  let best = null, bestScore = -1e9;
  for (let r=0;r<12;r++) for (const q of [MAJ, MIN]) {
    const tones = q.map(x=>(r+x)%12);
    let sc = 0;
    for (let k=0;k<win;k++) {
      const p = pcs[from+k];
      if (p === undefined) break;
      const w = 3 - k*0.7;                      // 手前の音ほど重く
      if (tones.includes(p)) sc += 2.2*w;
      else if (tones.some(t=>Math.abs(((p-t+18)%12)-6)===5)) sc += 0.4*w;  // 半音隣は軽い減点扱い
      else sc -= 0.5*w;
    }
    if (prev !== null) {
      const d = ((r - prev.root)%12+12)%12;
      if (d===5 || d===7) sc += 1.6;            // 4度・5度進行
      else if (d===2 || d===10) sc += 0.7;      // 全音
      else if (d===0) sc -= 2.4;                // 同じ和音の続きを避ける
      if (q === prev.q) sc += 0.2;
    }
    if (sc > bestScore) { bestScore = sc; best = {root:r, q, tones}; }
  }
  return best;
}

function accompany(pcs, opts={}) {
  const mode = opts.mode || "arp", win = opts.window || 3;
  const chords = [], notes = [];
  let prev = null;

  for (let i=0;i<pcs.length;i+=win) {
    const span = Math.min(win, pcs.length - i);
    const ch = pick(pcs, i, win, prev);
    prev = ch;
    chords.push({slot:i, span, root:ch.root, minor:ch.q===MIN,
                 name: NAME[ch.root] + (ch.q===MIN ? "m" : "")});

    const bass = BASS_BASE + ch.root;
    const third = MID_BASE + ch.tones[1];
    const fifth = MID_BASE + ch.tones[2];

    if (mode === "bass") {
      notes.push({midi:bass, slot:i, span});
    } else if (mode === "pad") {
      notes.push({midi:bass, slot:i, span});
      notes.push({midi:third, slot:i, span});
      notes.push({midi:fifth, slot:i, span});
    } else {                                     // arp
      const seq = [bass, third, fifth];
      for (let k=0;k<span;k++) notes.push({midi:seq[k%3], slot:i+k, span:1});
    }
  }
  return {chords, notes};
}

root.Harmony = {accompany, MODES:[["none","なし"],["arp","分散"],["pad","持続"],["bass","低音のみ"]]};
})(typeof window !== "undefined" ? window : globalThis);
