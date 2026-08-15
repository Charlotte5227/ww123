/* 律暗号 共通中核 — 噪律 / 稠律 / 玲律 / 晷律
   すべて12進の桁と鍵表を共有する。方式の違いは配置だけ。 */
(function (root) {
"use strict";

const JA = ["ド","ド♯","レ","レ♯","ミ","ファ","ファ♯","ソ","ソ♯","ラ","ラ♯","シ"];
const EN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const RITSU = ["神仙","上無","壱越","断金","平調","勝絶","下無","双調","鳧鐘","黄鐘","鸞鏡","盤渉"];
const DURN = ["♬","♬.","♪","3連♩","♪.","♩","3連𝅗𝅥","♩.","𝅗𝅥","𝅗𝅥.","𝅝","𝅝."];
const DURLEN = [6,9,12,16,18,24,32,36,48,72,96,144];

/* ── 鍵表 ── */
function makeRow() {
  const r = [...Array(12).keys()];
  for (let i=11;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; }
  return r;
}
function checkRow(row) {
  if (!Array.isArray(row) || row.length!==12 || new Set(row).size!==12 ||
      row.some(x=>!Number.isInteger(x)||x<0||x>11))
    throw new Error("鍵表は0〜11の並べ替えでなければなりません。");
  return row;
}

/* ── 符号単位 ── */
function toUnits(t, style) {
  if (style===1) return [...t].map(c=>c.codePointAt(0));
  const u=[];
  for (const ch of t) { const c=ch.codePointAt(0);
    if (c>0xFFFF){const v=c-0x10000; u.push(0xD800|(v>>10), 0xDC00|(v&0x3FF));} else u.push(c); }
  return u;
}
function fromUnits(u, style) {
  return style===1 ? u.map(x=>String.fromCodePoint(x)).join("")
                   : u.map(x=>String.fromCharCode(x)).join("");
}
function pack(units, hexw) {
  const sh = BigInt(hexw*4); let n = 0n;
  for (const u of units) n = (n<<sh) | BigInt(u);
  return n;
}
function unpack(n, hexw, per) {
  const sh = BigInt(hexw*4), mask = (1n<<sh)-1n, out=[];
  for (let s=per-1;s>=0;s--) out.push(Number((n>>(sh*BigInt(s)))&mask));
  return out;
}
function toDigits(n, len) {
  const d=[]; for(let i=0;i<len;i++){ d.push(Number(n%12n)); n/=12n; }
  return d.reverse();
}
function fromDigits(d) { let n=0n; for(const x of d) n = n*12n + BigInt(x); return n; }
function padUnits(u, per) { while (u.length%per || !u.length) u.push(0); return u; }
function trim(u) { while (u.length && u[u.length-1]===0) u.pop(); return u; }

/* ── 音名の読み書き ── */
const BJ = {"ド":0,"レ":2,"ミ":4,"ファ":5,"ソ":7,"ラ":9,"シ":11};
const BE = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function parseNote(x) {
  let n=x.trim(), acc=0;
  while (/[#＃♯b♭ｂ]$/.test(n)) { acc += /[#＃♯]$/.test(n) ? 1 : -1; n=n.slice(0,-1); }
  let base = BJ[n]; if (base===undefined) base = BE[n.toUpperCase()];
  if (base===undefined) throw new Error(`「${x}」は音名として読めません。`);
  return ((base+acc)%12+12)%12;
}
function parseNotes(s) {
  return s.replace(/[、,\/|・]/g," ").trim().split(/\s+/).filter(Boolean).map(parseNote);
}
function parseTimed(s) {
  const order = [...DURN].sort((a,b)=>b.length-a.length);
  return s.replace(/[、,\/|・]/g," ").trim().split(/\s+/).filter(Boolean).map(tok=>{
    for (const d of order) if (tok.endsWith(d) && tok.length>d.length)
      return {pc: parseNote(tok.slice(0,tok.length-d.length)), dur: DURN.indexOf(d)};
    throw new Error(`「${tok}」に音価が付いていません。`);
  });
}
const name = (p,en)=> (en?EN:JA)[p];

/* ══════════ 噪律暗号 v1.1 ══════════ */
const STYLES = {0:{hexw:4,per:4,dig:18}, 1:{hexw:6,per:4,dig:27}};
const Souritsu = {
  autoStyle(t, check=true) {
    const c=check?1:0, a=[...t].filter(x=>x.codePointAt(0)>0xFFFF).length, L=[...t].length;
    return Math.ceil((L+a)/4)*(18+c) <= Math.ceil(L/4)*(27+c) ? 0 : 1;
  },
  encode(text, row, style=null, check=true) {
    checkRow(row);
    if (style===null) style = Souritsu.autoStyle(text, check);
    const S = STYLES[style];
    const u = toUnits(text, style);
    while (u.length % S.per) u.push(0);      // 空の本文は0節（ヘッダ13音のみ）
    const out = row.concat([row[style]]);
    for (let i=0;i<u.length;i+=S.per) {
      const d = toDigits(pack(u.slice(i,i+S.per), S.hexw), S.dig);
      if (check) d.push(d.reduce((a,b)=>a+b,0)%12);
      for (const x of d) out.push(row[x]);
    }
    return {pcs: out, style, blk: S.dig+(check?1:0), row};
  },
  decode(pcs, check=true) {
    if (pcs.length<13) throw new Error("音が足りません。最低13音必要です。");
    const row = pcs.slice(0,12);
    if (new Set(row).size!==12) throw new Error("冒頭12音に同じ音名があります。鍵表として読めません。");
    const inv={}; row.forEach((p,i)=>inv[p]=i);
    const style = inv[pcs[12]];
    if (!(style in STYLES)) throw new Error(`13音目の様式番号 ${style} は未定義です。`);
    const S = STYLES[style], w = S.dig+(check?1:0), body = pcs.slice(13);
    if (body.length%w) throw new Error(`本体が${body.length}音で、${w}の倍数になりません。`);
    let u=[];
    for (let i=0;i<body.length;i+=w) {
      const d = body.slice(i,i+w).map(p=>inv[p]);
      if (check && d.slice(0,S.dig).reduce((a,b)=>a+b,0)%12 !== d[S.dig])
        throw new Error(`第${i/w+1}区切りの検査音が合いません。写し間違いがあります。`);
      u = u.concat(unpack(fromDigits(d.slice(0,S.dig)), S.hexw, S.per));
    }
    return {text: fromUnits(trim(u), style), row, style, blk: w};
  }
};

/* ══════════ 玲律暗号 v0.1 ══════════ */
const RDIG = 18, RPER = 4;
const Reiritsu = {
  spread(n) {
    const T = 12*Math.ceil(n/12), q = Math.floor(T/n), r = T%n;
    return [...Array(n).keys()].map(i => q + (i >= n-r ? 1 : 0));
  },
  encode(text, row) {
    checkRow(row);
    const u = padUnits(toUnits(text,0), RPER), n = u.length/RPER;
    const plan = Reiritsu.spread(n), out=[]; let k=0;
    for (let b=0;b<n;b++) {
      for (const x of toDigits(pack(u.slice(b*RPER,(b+1)*RPER),4), RDIG)) out.push(row[x]);
      for (let i=0;i<plan[b];i++) out.push(row[(k++)%12]);
    }
    return {pcs: out, row, blocks: n, plan};
  },
  blocksOf(total) {
    for (let n=1;n<200000;n++) {
      const t = RDIG*n + 12*Math.ceil(n/12);
      if (t===total) return n;
      if (t>total) break;
    }
    throw new Error(`総音数 ${total} に対応する節の数がありません。`);
  },
  decode(pcs) {
    const n = Reiritsu.blocksOf(pcs.length), plan = Reiritsu.spread(n);
    const body=[], frag=[]; let i=0;
    for (let b=0;b<n;b++) { body.push(pcs.slice(i,i+RDIG)); i+=RDIG;
      frag.push(...pcs.slice(i,i+plan[b])); i+=plan[b]; }
    const row = frag.slice(0,12);
    if (new Set(row).size!==12) throw new Error("集めた鍵表の12音に重複があります。");
    for (let j=0;j<frag.length;j++) if (frag[j]!==row[j%12])
      throw new Error(`鍵表の${Math.floor(j/12)+1}周目が1周目と食い違います（${j+1}音目）。`);
    const inv={}; row.forEach((p,j)=>inv[p]=j);
    let u=[];
    for (const blk of body) u = u.concat(unpack(fromDigits(blk.map(p=>inv[p])),4,RPER));
    return {text: fromUnits(trim(u),0), row, blocks:n, plan};
  }
};

/* ══════════ 稠律暗号 v0.2 ══════════ */
const BASE = {1:72, 2:60, 3:48, acc:36};
const Churitsu = {
  BASE,
  pattern() {
    const out=["/"]; let n=0;
    for (let i=0;i<6;i++){ out.push(n,n+1); out.push(i<5?"→":"/"); n+=2; }
    return out;
  },
  layout(text, row, check=true) {
    // 前奏を持たないため、空の本文でも1ページは必要（伴奏が鍵表の唯一の出どころ）
    const r = Souritsu.encode(text.length ? text : "\u0000", row, 0, check);
    const L = r.blk, body = r.pcs.slice(13), blocks=[];   // ヘッダ13音は捨てる
    for (let i=0;i<body.length;i+=L) blocks.push(body.slice(i,i+L));
    const pat = Churitsu.pattern(), pages=[];
    for (let p=0;p<blocks.length;p+=3) {
      const grp = blocks.slice(p,p+3), voices={};
      grp.forEach((b,v)=> voices[v+1] = b.map(pc=>BASE[v+1]+pc));
      pages.push({voices, acc: pat.map(x=> typeof x==="number" ? BASE.acc+row[x] : null), tie: pat});
    }
    return {pages, row, slots:L, blk:L};
  },
  /* 伴奏の音高クラス列（発音した12音）と、声部の音高クラス列から本文へ */
  read(sheet, check=true) {
    const pcs = Churitsu.assemble(
      sheet.pages.map(pg=>pg.acc.filter(m=>m!==null).map(m=>((m%12)+12)%12)),
      sheet.pages.map(pg=>Object.keys(pg.voices).sort()
        .map(v=>pg.voices[v].map(m=>((m%12)+12)%12))));
    return Souritsu.decode(pcs, check);
  },
  /* accs: ページごとの伴奏12音   voices: ページごとの声部（各19音）*/
  assemble(accs, voices) {
    if (!accs.length || !accs[0] || accs[0].length!==12)
      throw new Error("1ページ目の伴奏12音が見つかりません。鍵表を復元できません。");
    const row = accs[0];
    if (new Set(row).size!==12) throw new Error("伴奏の12音に重複があります。鍵表として読めません。");
    accs.forEach((a,i)=>{ if (i && a && a.length===12)
      a.forEach((p,j)=>{ if (p!==row[j])
        throw new Error(`第${i+1}ページの伴奏が1ページ目と食い違います（${j+1}音目）。`); }); });
    let pcs = row.concat([row[0]]);          // 様式0を表す音を補う
    for (const pg of voices) for (const v of pg) pcs = pcs.concat(v);
    return pcs;
  }
};

/* ══════════ 晷律暗号 v0.1 ══════════ */
const KDIG = 18, KPER = 4, KNOTES = 9;
const Kiritsu = {
  encode(text, row) {
    checkRow(row);
    const u = padUnits(toUnits(text,0), KPER);
    const out = [...Array(12).keys()].map(i=>({pc:row[i], dur:row[i], accent:true}));
    for (let b=0;b<u.length;b+=KPER) {
      const d = toDigits(pack(u.slice(b,b+KPER),4), KDIG);
      for (let i=0;i<KNOTES;i++) out.push({pc:row[d[2*i]], dur:row[d[2*i+1]]});
    }
    return {notes: out, row, blocks: u.length/KPER};
  },
  decode(notes) {
    if (notes.length<12) throw new Error("音が足りません。最低12音必要です。");
    const head = notes.slice(0,12), body = notes.slice(12);
    const row = head.map(n=>n.pc);
    if (new Set(row).size!==12) throw new Error("冒頭12音の音高に重複があります。");
    if (head.some((n,i)=>n.dur!==row[i]))
      throw new Error("冒頭12音の音価が音高と同じ並びになっていません。");
    if (body.length%KNOTES) throw new Error(`本体が${body.length}音で、${KNOTES}の倍数になりません。`);
    const inv={}; row.forEach((p,i)=>inv[p]=i);
    let u=[];
    for (let b=0;b<body.length;b+=KNOTES) {
      const d=[];
      for (const n of body.slice(b,b+KNOTES)) {
        if (!(n.pc in inv) || !(n.dur in inv)) throw new Error("鍵表にない音高か音価があります。");
        d.push(inv[n.pc], inv[n.dur]);
      }
      u = u.concat(unpack(fromDigits(d),4,KPER));
    }
    return {text: fromUnits(trim(u),0), row, blocks: body.length/KNOTES};
  }
};

/* ── 旋律化（音高クラス -> MIDI）── */
function voice(pcs, lo=60, hi=81, start=69) {
  let prev=start; const out=[];
  for (const p of pcs) {
    let best=null;
    for (let m=lo;m<=hi;m++) { if (m%12!==p) continue;
      if (best===null || Math.abs(m-prev)<Math.abs(best-prev)) best=m; }
    out.push(best); prev=best;
  }
  return out;
}

root.Core = {JA,EN,RITSU,DURN,DURLEN,makeRow,checkRow,parseNote,parseNotes,parseTimed,
             name,voice,toUnits,fromUnits,Souritsu,Reiritsu,Churitsu,Kiritsu};
})(typeof window !== "undefined" ? window : globalThis);
