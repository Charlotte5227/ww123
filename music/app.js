/* 画面の共通部品 — 音律環・コピー・書き出し */
(function (root) {
"use strict";
const $ = id => document.getElementById(id);

function drawRing(el, row) {
  const cx=150, cy=150, R=108;
  let h='<circle cx="150" cy="150" r="108" fill="none" stroke="#252C3E" stroke-width="1"/>';
  for (let p=0;p<12;p++) {
    const a=(p/12)*Math.PI*2-Math.PI/2;
    const x=cx+R*Math.cos(a), y=cy+R*Math.sin(a);
    const lx=cx+(R+30)*Math.cos(a), ly=cy+(R+30)*Math.sin(a);
    h+=`<g class="rn" data-pc="${p}">
      <circle class="rn-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17"/>
      <text class="rn-num" x="${x.toFixed(1)}" y="${(y+1).toFixed(1)}">${row.indexOf(p)}</text>
      <text class="rn-name" x="${lx.toFixed(1)}" y="${(ly-5).toFixed(1)}">${Core.JA[p]}</text>
      <text class="rn-ritsu" x="${lx.toFixed(1)}" y="${(ly+8).toFixed(1)}">${Core.RITSU[p]}</text>
    </g>`;
  }
  el.innerHTML = h;
}
function litRing(el, pc) {
  el.querySelectorAll(".rn").forEach(g=>g.classList.toggle("lit", +g.dataset.pc===pc));
}
function say(id, t, ok) { const e=$(id); e.textContent=t; e.className="msg on"+(ok?" ok":""); }
function hush(id) { $(id).className="msg"; }
function dl(blob, name) {
  const u=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),4000);
}
async function copy(el, flagId) {
  const txt = el.value; if (!txt) return;
  let ok=false;
  try { await navigator.clipboard.writeText(txt); ok=true; }
  catch(_) {
    el.removeAttribute("readonly"); el.select(); el.setSelectionRange(0,txt.length);
    try { ok=document.execCommand("copy"); } catch(__){}
    el.setAttribute("readonly","");
  }
  if (ok && flagId) { const c=$(flagId); c.classList.add("on"); setTimeout(()=>c.classList.remove("on"),1600); }
  else el.select();
}
function tabs() {
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.setAttribute("aria-selected", x===t));
    document.querySelectorAll(".panel").forEach(p=>
      p.classList.toggle("on", "p-"+t.id.slice(2)===p.id));
  });
}
function drawers(pairs) {
  for (const [btn,drw] of pairs) $(btn).onclick=()=>{
    const d=$(drw), on=!d.classList.contains("on");
    d.classList.toggle("on",on); $(btn).setAttribute("aria-pressed",on);
  };
}
function nav(cur) {
  const L=[["souritsu","噪律"],["churitsu","稠律"],["reiritsu","玲律"],["kiritsu","晷律"]];
  return L.map(([f,n])=>`<a href="${f}.html"${f===cur?' aria-current="page"':""}>${n}</a>`).join("");
}
root.App = {$, drawRing, litRing, say, hush, dl, copy, tabs, drawers, nav};
})(typeof window !== "undefined" ? window : globalThis);
