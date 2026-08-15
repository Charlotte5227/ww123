/* 玲律暗号 v0.2 — 独立した符号化
   他の3方式が12進なのに対し、これだけが7進。長音階の7音しか使わない。
   共通の下ごしらえ（UTF-16、音名）だけ core.js に頼る。 */
(function (root) {
"use strict";
const RDIG = 12, RPER = 2, RKEY = 7;      // 2文字 = 32bit = 7進12桁
const MAJOR = [0,2,4,5,7,9,11];
const R = {
  DIG:RDIG, PER:RPER, KEY:RKEY,
  /* 7音が長音階を成すか。成すならその主音を返し、成さなければ -1 */
  tonicOf(pcs) {
    if (pcs.length!==7 || new Set(pcs).size!==7) return -1;
    const set = new Set(pcs);
    for (let t=0;t<12;t++) if (MAJOR.every(x=>set.has((x+t)%12))) return t;
    return -1;
  },
  scaleOf(tonic) { return MAJOR.map(x=>(x+tonic)%12); },
  makeRow(tonic) {
    const t = tonic===undefined ? Math.floor(Math.random()*12) : tonic;
    const r = R.scaleOf(t);
    for (let i=6;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; }
    return r;
  },
  checkRow(row) {
    if (!Array.isArray(row) || row.length!==RKEY)
      throw new Error("鍵表は7音でなければなりません。");
    if (R.tonicOf(row) < 0)
      throw new Error("鍵表の7音が長音階を成していません。");
    return row;
  },
  spread(n) {
    const T = RKEY*Math.ceil(n/RKEY), q = Math.floor(T/n), r = T%n;
    return [...Array(n).keys()].map(i => q + (i >= n-r ? 1 : 0));
  },
  encode(text, row) {
    R.checkRow(row);
    const u = Core.toUnits(text,0);
    while (u.length % RPER || !u.length) u.push(0);
    const n = u.length/RPER, plan = R.spread(n), out=[];
    let k = 0;
    for (let b=0;b<n;b++) {
      let x = u[b*RPER]*0x10000 + u[b*RPER+1];       // 32bit、多倍長は不要
      const d = [];
      for (let i=0;i<RDIG;i++) { d.push(x%7); x = Math.floor(x/7); }
      d.reverse();
      for (const y of d) out.push(row[y]);
      for (let i=0;i<plan[b];i++) out.push(row[(k++)%RKEY]);
    }
    return {pcs: out, row, blocks: n, plan, tonic: R.tonicOf(row)};
  },
  blocksOf(total) {
    for (let n=1;n<200000;n++) {
      const t = RDIG*n + RKEY*Math.ceil(n/RKEY);
      if (t===total) return n;
      if (t>total) break;
    }
    throw new Error(`総音数 ${total} に対応する節の数がありません。`);
  },
  decode(pcs) {
    const n = R.blocksOf(pcs.length), plan = R.spread(n);
    const body=[], frag=[]; let i=0;
    for (let b=0;b<n;b++) { body.push(pcs.slice(i,i+RDIG)); i+=RDIG;
      frag.push(...pcs.slice(i,i+plan[b])); i+=plan[b]; }
    const row = frag.slice(0,RKEY);
    if (new Set(row).size!==RKEY) throw new Error("集めた鍵表の7音に重複があります。");
    const tonic = R.tonicOf(row);
    if (tonic < 0) throw new Error("集めた鍵表の7音が長音階を成していません。");
    for (let j=0;j<frag.length;j++) if (frag[j]!==row[j%RKEY])
      throw new Error(`鍵表の${Math.floor(j/RKEY)+1}周目が1周目と食い違います（${j+1}音目）。`);
    const inv={}; row.forEach((p,j)=>inv[p]=j);
    const u=[];
    for (const blk of body) {
      let x = 0;
      for (const p of blk) {
        if (!(p in inv)) throw new Error("鍵表にない音があります。");
        x = x*7 + inv[p];
      }
      u.push(Math.floor(x/0x10000), x%0x10000);
    }
    return {text: Core.fromUnits(Core.trim(u),0), row, blocks:n, plan, tonic};
  }
};
root.Reiritsu = R;
})(typeof window !== "undefined" ? window : globalThis);
