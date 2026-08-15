/* 伴奏づけ — 玲律暗号 v0.2 用
   長音階の主旋律に、その調の三和音（ダイアトニック・コード）だけを当てる。
   音階の中から選ぶので、原理的に極端な不協和が起きない。
   Harmony.accompany(pcs, {scale, mode, window})
   伴奏は必ず C4(60) 未満に置かれる。
*/
(function (root) {
"use strict";
const BASS = 36, MID = 48;
const DEG = ["I","II","III","IV","V","VI","VII"];

function triads(scale) {                 // scale: 主音から昇順の7音
  return scale.map((_,i)=>({
    deg: i,
    tones: [scale[i], scale[(i+2)%7], scale[(i+4)%7]],
    minor: [1,2,5,6].includes(i)
  }));
}

function accompany(pcs, opts={}) {
  const mode = opts.mode || "arp", win = opts.window || 3;
  const scale = opts.scale;
  if (!scale || scale.length!==7) throw new Error("音階が要ります。");
  const cand = triads(scale);
  const chords = [], notes = [];
  let prev = null;

  for (let i=0;i<pcs.length;i+=win) {
    const span = Math.min(win, pcs.length - i);
    let best=null, bs=-1e9;
    for (const ch of cand) {
      let sc = 0;
      for (let k=0;k<win;k++) {
        const p = pcs[i+k];
        if (p === undefined) break;
        const w = 3 - k*0.7;
        if (ch.tones.includes(p)) sc += 2.4*w;
        else sc += 0.3*w;                       // 音階内なので外れても致命的でない
      }
      if (ch.deg===0) sc += 0.9;                // I をやや優遇
      if (ch.deg===3 || ch.deg===4) sc += 0.5;  // IV・V も
      if (ch.deg===6) sc -= 1.2;                // VII（減三和音）は控えめに
      if (prev) {
        const d = (ch.deg - prev.deg + 7)%7;
        if (d===3 || d===4) sc += 1.4;          // 4度・5度進行
        else if (d===5 || d===2) sc += 0.6;
        else if (d===0) sc -= 2.6;
      }
      if (sc > bs) { bs = sc; best = ch; }
    }
    prev = best;
    chords.push({slot:i, span, deg:best.deg, minor:best.minor,
                 name: DEG[best.deg] + (best.minor ? "m" : "")});
    const b = BASS + best.tones[0], t = MID + best.tones[1], f = MID + best.tones[2];
    if (mode === "bass") notes.push({midi:b, slot:i, span});
    else if (mode === "pad") { notes.push({midi:b,slot:i,span});
      notes.push({midi:t,slot:i,span}); notes.push({midi:f,slot:i,span}); }
    else { const seq=[b,t,f]; for (let k=0;k<span;k++) notes.push({midi:seq[k%3], slot:i+k, span:1}); }
  }
  return {chords, notes};
}
root.Harmony = {accompany, triads,
  MODES:[["none","なし"],["arp","分散"],["pad","持続"],["bass","低音のみ"]]};
})(typeof window !== "undefined" ? window : globalThis);
