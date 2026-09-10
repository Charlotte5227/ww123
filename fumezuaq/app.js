
let DICT=[], GRAMMAR="";
const $=id=>document.getElementById(id);
const norm=s=>(s||"").normalize("NFKC").toLowerCase().replace(/[‐‑‒–—―ー_\s]/g,"");
const esc=s=>(s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let direction="ja2fu";

Promise.all([fetch("dictionary.json").then(r=>r.json()),fetch("grammar.txt").then(r=>r.text())]).then(([d,g])=>{DICT=d;GRAMMAR=g;renderDict();});

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active")); b.classList.add("active");
 document.querySelectorAll(".view").forEach(x=>x.classList.remove("active")); $(b.dataset.view).classList.add("active");
});

const TIME_UNIT_PREFIXES = Object.freeze({
  "年": "jua-",
  "月": "shae-",
  "半月": "chou-",
  "日": "yai-",
  "時間": "hie-",
  "分": "fou-",
  "秒": "jiu-"
});

// Only a single completed numeral morpheme can be used inside a time quantity.
// Composite numeral expressions are intentionally rejected, even if an X-scope exists.
function buildTimeQuantity(unitJa, numeralSurface) {
  const normalizedUnit = String(unitJa||"").replace(/単位$/,"");
  const prefix = TIME_UNIT_PREFIXES[normalizedUnit];
  if (!prefix) return { ok:false, reason:`Unknown time unit: ${normalizedUnit}` };
  const n = String(numeralSurface || "").trim();
  if (!n) return { ok:false, reason:"Missing numeral" };
  // A completed numeral morpheme is one uninterrupted form. Spaces, plus signs,
  // scope markers and explicit morpheme separators indicate a composite expression.
  if (/\s|\+|lenaq-saluq|lenaq-soluq/.test(n)) {
    return { ok:false, reason:"TIME_QUANTITY_REQUIRES_SINGLE_NUMERAL_MORPHEME" };
  }
  return { ok:true, surface:`${prefix}${n}` };
}

function isTimeQuantityCompositeNumeral(numeralSurface) {
  const n = String(numeralSurface || "").trim();
  return /\s|\+|lenaq-saluq|lenaq-soluq/.test(n);
}

function setDir(d){
 direction=d;$("ja2fu").classList.toggle("selected",d==="ja2fu");$("fu2ja").classList.toggle("selected",d==="fu2ja");
 $("modeLabel").textContent=d==="ja2fu"?"fumezuaq":"日本語";
 $("inputText").placeholder=d==="ja2fu"?"例：私は昨日、山へ行った。":"例：sanaq ... keraq ...";
}
$("ja2fu").onclick=()=>setDir("ja2fu");$("fu2ja").onclick=()=>setDir("fu2ja");$("swap").onclick=()=>setDir(direction==="ja2fu"?"fu2ja":"ja2fu");
$("inputText").oninput=()=>{$("charCount").textContent=`${$("inputText").value.length} 文字`};$("clearInput").onclick=()=>{$("inputText").value="";$("outputText").textContent="翻訳結果がここに表示されます。";$("outputText").classList.add("empty");$("analysisCards").innerHTML=""};
$("copyBtn").onclick=()=>navigator.clipboard.writeText($("outputText").textContent).then(()=>toast("コピーしました"));
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1500)}
function setPipelineStatus(name,step,total){
 const el=$("pipelineStatus");
 if(!el)return;
 el.textContent= total>1 ? `${step}/${total} ${name}` : name;
 el.classList.add("working");
 if(name==="完了")setTimeout(()=>el.classList.remove("working"),1200);
}

function relevantEntries(input){
 const q=norm(input);
 let scored=DICT.map(e=>{
   let s=0, m=norm(e.meaning), f=norm(e.form), kw=norm((e.keywords||[]).join(" "));
   if(q.includes(m)&&m.length>0)s+=8+m.length;
   for(const part of (e.meaning||"").split(/[・\/（）(),、\s]+/)){let p=norm(part);if(p.length>=1&&q.includes(p))s+=3+p.length}
   if(q.includes(f)&&f.length>1)s+=10;
   for(const k of (e.keywords||[])){let nk=norm(k);if(nk && q.includes(nk))s+=7+nk.length;}
   if(e.zone==="ROOT")s+=1;
   return {e,s};
 }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,80).map(x=>x.e);
 return relevantDedup(scored);
}
function relevantDedup(a){let seen=new Set;return a.filter(x=>{let k=x.id+"|"+x.form;if(seen.has(k))return false;seen.add(k);return true})}

function ruleTranslate(input){
 if(direction==="fu2ja"){
   const hits=analyzeFumezuaq(input);
   return {translation:hits.length?hits.map(x=>x.meaning||x.surface).join(" / "):"辞書だけでは解析できませんでした。",
     chunks:hits.map(x=>({surface:x.surface,meaning:x.meaning,zone:x.zone,note:x.note})),
     warnings:["ルールベース逆引きは形態素・語根の辞書一致を中心にした補助解析です。自然な日本語生成はAIモードが適しています。"]};
 }
 const rel=relevantEntries(input).filter(e=>e.zone==="ROOT");
 let used=[]; let out=input;
 rel.sort((a,b)=>b.meaning.length-a.meaning.length).forEach(e=>{
   const variants=(e.meaning||"").split(/[・\/]/).filter(x=>x.length>=1);
   for(const v of variants) if(out.includes(v)){out=out.replaceAll(v,e.form);used.push(e);break}
 });
 return {translation: used.length?out:"既知の基礎語根だけでは翻訳できません。AIモードを使うと意味解析と接辞選択を補助できます。",
   chunks:used.map(e=>({surface:e.form,meaning:e.meaning,zone:"ROOT",note:"基礎語根の直接置換（暫定）"})),
   warnings:["日本語→fumezuaq のルールベースモードは、現段階では語根候補の提示・直接置換を中心とする試作です。接辞選択を含む本翻訳はAIモードを使用してください。"]};
}

function analyzeFumezuaq(input){
 let raw=input.toLowerCase().replace(/[.,!?;:()[\]{}]/g," ").split(/\s+/).filter(Boolean), results=[];
 const forms=[...DICT].filter(e=>e.form).sort((a,b)=>b.form.length-a.form.length);
 for(const token of raw){
   let remaining=token, tokenHits=[];
   // exact full-form first
   const exact=forms.find(e=>norm(e.form)===norm(token));
   if(exact){results.push({...exact,surface:token});continue}
   // q-based pieces + hyphen based
   const pieces=token.split(/(?<=q)-?|-/).filter(Boolean);
   for(const p0 of pieces){
     const p=p0.replace(/-$/,"");
     let hit=forms.find(e=>norm(e.small_form)===norm(p)||norm(e.form)===norm(p)||norm(e.large_form)===norm(p));
     if(hit)tokenHits.push({...hit,surface:p});
     else tokenHits.push({surface:p,meaning:"未登録形態素",zone:"?",kind:"不明",note:"辞書に一致なし"});
   }
   results.push(...tokenHits);
 }
 return results;
}


let LAST_TRANSLATION=null,LAST_PROVIDER=null,LAST_MODEL=null;
function factualBreakdownForSurface(surface){
 const c=(LAST_TRANSLATION?.chunks||[]).find(x=>x.surface===surface);
 if(!c)return [];
 return (c.used_ids||[]).map(id=>dictById(id)).filter(Boolean).map(e=>`${e.form} = ${e.meaning} [${e.id}]`);
}
function renderExplanation(data){
 const box=$("explanationBox"); if(!box)return;
 if(!data){box.innerHTML='<div class="empty-explain">「翻訳の説明」を押すと、意味塊ごとの詳細説明を生成します。</div>';return;}
 let h=data.summary?`<div class="explain-summary">${esc(data.summary)}</div>`:"";
 h+=(data.chunks||[]).map(x=>`<article class="explain-card"><div class="explain-head"><strong>${esc(x.surface||"意味塊")}</strong><span>${esc(x.meaning||"")}</span></div>${factualBreakdownForSurface(x.surface).length?`<div class="breakdown">${factualBreakdownForSurface(x.surface).map(b=>`<code>${esc(b)}</code>`).join("")}</div>`:""}${x.reason?`<p>${esc(x.reason)}</p>`:""}${x.alternatives?`<p class="alt">他候補: ${esc(x.alternatives)}</p>`:""}</article>`).join("");
 box.innerHTML=h||'<div class="empty-explain">説明はありません。</div>';
}
async function requestExplanation(){
 if(!LAST_TRANSLATION){toast("先にAI翻訳を実行してください");return;}
 const btn=$("explainBtn"); if(btn){btn.disabled=true;btn.textContent="説明生成中…";}
 try{
  const dbg=LAST_TRANSLATION._debug||{};
  const exp=await buildExplanation(LAST_PROVIDER,LAST_MODEL,$("inputText").value.trim(),LAST_TRANSLATION,dbg.semantic,dbg.resolved);
  renderExplanation(exp);
 }catch(e){renderExplanation({summary:"説明生成エラー: "+e.message,chunks:[]});}
 finally{if(btn){btn.disabled=false;btn.textContent="翻訳の説明";}}
}

function renderAnalysis(data){
 const c=(data.chunks||[]);
 $("analysisCards").innerHTML = c.map(x=>`<article class="analysis-card"><h4>${esc(x.surface||x.form||"意味塊")}</h4><p>${esc(x.meaning||"")}</p><div class="zones">${["S","R","D","ROOT","E","K","C","NUM"].map(z=>`<span class="zone ${x.zone===z?"hit":""}">${z}</span>`).join("")}</div>${x.note?`<p style="margin-top:10px">${esc(x.note)}</p>`:""}</article>`).join("") +
 (data.warnings||[]).map(w=>`<article class="analysis-card"><h4>注意</h4><p>${esc(w)}</p></article>`).join("") + (data._debug?`<article class="analysis-card"><h4>多段階翻訳</h4><p>意味解析 → 領域判定 → 辞書照合 → 構築 → unknown再検査</p><p style="margin-top:8px">参照候補: ${esc(data._debug.candidateCount)} 項目${data._debug.fallback?" / 最終検証はフォールバック":""}</p></article>`:"");
}


const KEYCFG={
 openai:{input:"openaiKey",save:"openaiSave",state:"openaiState",storage:"fumezuaq.openai.key"},
 anthropic:{input:"anthropicKey",save:"anthropicSave",state:"anthropicState",storage:"fumezuaq.anthropic.key"},
 gemini:{input:"geminiKey",save:"geminiSave",state:"geminiState",storage:"fumezuaq.gemini.key"}
};
function updateKeyState(p){
 const c=KEYCFG[p], has=!!$(c.input).value.trim();
 $(c.state).textContent=has?(localStorage.getItem(c.storage)?"保存済み":"入力済み"):"未設定";
 $(c.state).classList.toggle("ok",has);
}
function loadKeys(){
 for(const [p,c] of Object.entries(KEYCFG)){
  const v=localStorage.getItem(c.storage)||"";
  $(c.input).value=v; $(c.save).checked=!!v; updateKeyState(p);
  $(c.input).addEventListener("input",()=>updateKeyState(p));
 }
}
document.querySelectorAll(".eye").forEach(b=>b.onclick=()=>{
 const i=$(b.dataset.target); const show=i.type==="password"; i.type=show?"text":"password"; b.textContent=show?"隠す":"表示";
});
document.querySelectorAll(".savekey").forEach(b=>b.onclick=()=>{
 const p=b.dataset.provider,c=KEYCFG[p],v=$(c.input).value.trim();
 if(!v)return toast("APIキーを入力してください");
 if($(c.save).checked){localStorage.setItem(c.storage,v);toast("このブラウザに保存しました")}
 else {localStorage.removeItem(c.storage);toast("保存せず、このタブでのみ使用します")}
 updateKeyState(p);
});
document.querySelectorAll(".deletekey").forEach(b=>b.onclick=()=>{
 const p=b.dataset.provider,c=KEYCFG[p];localStorage.removeItem(c.storage);$(c.input).value="";$(c.save).checked=false;updateKeyState(p);toast("削除しました");
});
loadKeys();

function compactEntry(e){return {id:e.id,zone:e.zone,kind:e.kind,large:e.large,middle:e.middle,meaning:e.meaning,form:e.form,status:e.status,keywords:e.keywords||[],note:e.note||""};}
function extractJsonText(t){
 let s=String(t??"").trim();
 if(!s) throw new Error("AIから空の応答が返されました");
 // Markdown fenced JSON
 const fenced=s.match(/```(?:json)?\s*([\s\S]*?)```/i);
 if(fenced) s=fenced[1].trim();
 // Try exact JSON first
 try{JSON.parse(s);return s}catch(_){}
 // Extract first balanced top-level object
 const start=s.indexOf("{");
 if(start<0) throw new Error("JSONオブジェクトが見つかりません");
 let depth=0,inString=false,escape=false;
 for(let i=start;i<s.length;i++){
   const ch=s[i];
   if(inString){
     if(escape){escape=false;continue}
     if(ch==="\\"){escape=true;continue}
     if(ch==='"')inString=false;
     continue;
   }
   if(ch==='"'){inString=true;continue}
   if(ch==="{")depth++;
   else if(ch==="}"){
     depth--;
     if(depth===0)return s.slice(start,i+1);
   }
 }
 throw new Error("JSONの閉じ括弧が不足しています");
}
function parseJsonLoose(t){
 const raw=extractJsonText(t);
 try{return JSON.parse(raw)}
 catch(e){
   // Common harmless repairs: BOM / trailing commas
   const repaired=raw.replace(/^\uFEFF/,"").replace(/,\s*([}\]])/g,"$1");
   try{return JSON.parse(repaired)}
   catch(_){throw new Error("JSON構文を解析できません: "+e.message)}
 }
}
async function parseStageJson(provider,model,stageName,raw,shapeHint){
 const source=String(raw??"").trim();
 if(!source) throw new Error(`${stageName}段階でAIから本文が返されませんでした`);
 try{return parseJsonLoose(source)}
 catch(firstErr){
   const repairPrompt=`次のAI出力を、内容を変えずに有効なJSONへ修復してください。
Markdown、説明文、コードフェンスは付けず、JSONオブジェクトだけを返してください。
期待する形:
${shapeHint}

壊れた出力:
${source.slice(0,12000)}`;
   try{
     const repaired=await callAI(provider,model,repairPrompt);
     if(!String(repaired??"").trim()) throw new Error("JSON修復でも空応答でした");
     return parseJsonLoose(repaired);
   }catch(secondErr){
     throw new Error(`${stageName}段階でAIのJSONを解析できませんでした。元エラー: ${firstErr.message} / 修復後: ${secondErr.message}`);
   }
 }
}
async function callAI(provider,model,prompt){
 const c=KEYCFG[provider],key=$(c.input).value.trim();
 if(!key)throw new Error(`${provider} のAPIキーをAI設定で入力してください`);

 if(provider==="openai"){
   const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:model||"gpt-5",input:prompt})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error?.message||`OpenAI API error (${r.status})`);
   let parts=[];
   for(const item of (j.output||[])){
     for(const c of (item.content||[])){
       if(typeof c.text==="string" && (!c.type || c.type==="output_text" || c.type==="text")) parts.push(c.text);
     }
   }
   const text=(parts.join("\n") || j.output_text || "").trim();
   if(!text){
     const types=(j.output||[]).map(x=>x.type).filter(Boolean).join(",")||"none";
     throw new Error(`OpenAIから本文が返されませんでした (status=${j.status||"unknown"}, output types=${types})`);
   }
   return text;
 }

 if(provider==="anthropic"){
   const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model:model||"claude-opus-5",max_tokens:4500,messages:[{role:"user",content:prompt}]})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error?.message||`Anthropic API error (${r.status})`);
   const text=(j.content||[]).filter(x=>x.type==="text"&&typeof x.text==="string").map(x=>x.text).join("\n").trim();
   if(!text) throw new Error(`Claudeから本文が返されませんでした (stop_reason=${j.stop_reason||"unknown"})`);
   return text;
 }

 if(provider==="gemini"){
   const mdl=encodeURIComponent(model||"gemini-3.8-flash");
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error?.message||`Gemini API error (${r.status})`);
   const cand=j.candidates?.[0];
   const text=(cand?.content?.parts||[]).filter(x=>typeof x.text==="string" && !x.thought).map(x=>x.text).join("\n").trim();
   if(!text){
     const blocked=j.promptFeedback?.blockReason;
     const finish=cand?.finishReason;
     throw new Error(`Geminiから本文が返されませんでした (finishReason=${finish||"none"}${blocked?`, blockReason=${blocked}`:""})`);
   }
   return text;
 }
 throw new Error("不明なAIプロバイダーです");
}


// AI prompt directives are loaded from prompts.js


// ===== v5: Human-in-the-loop semantic chunking =====
let chunkMode = "auto"; // auto | assist | manual
let userChunkDrafts = [];

function normalizeChunkDrafts(list){
  return (list||[]).map(x=>String(x||"").trim()).filter(Boolean);
}
function getChunkInputs(){
  return [...document.querySelectorAll(".chunk-input")].map(x=>x.value.trim()).filter(Boolean);
}
function renderChunkInputs(values){
  const box=$("chunkList");
  if(!box)return;
  const vals=(values&&values.length?values:[""]);
  box.innerHTML="";
  vals.forEach((v,i)=>{
    const row=document.createElement("div");
    row.className="chunk-row";
    row.innerHTML=`<span class="chunk-index">${i+1}</span>
      <input class="chunk-input" type="text" value="${esc(v)}" placeholder="意味塊 ${i+1}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button type="button" class="ghost chunk-up" title="上へ">↑</button>
      <button type="button" class="ghost chunk-down" title="下へ">↓</button>
      <button type="button" class="ghost chunk-remove" title="削除">−</button>`;
    box.appendChild(row);
  });
  [...box.querySelectorAll(".chunk-row")].forEach((row,i)=>{
    row.querySelector(".chunk-remove").onclick=()=>{
      const vals=getChunkInputs(); vals.splice(i,1); renderChunkInputs(vals.length?vals:[""]);
    };
    row.querySelector(".chunk-up").onclick=()=>{
      const vals=getChunkInputs(); if(i>0){[vals[i-1],vals[i]]=[vals[i],vals[i-1]];renderChunkInputs(vals)}
    };
    row.querySelector(".chunk-down").onclick=()=>{
      const vals=getChunkInputs(); if(i<vals.length-1){[vals[i+1],vals[i]]=[vals[i],vals[i+1]];renderChunkInputs(vals)}
    };
  });
}
function syncChunkModeUI(){
  chunkMode=document.querySelector('input[name="chunkMode"]:checked')?.value||"auto";
  const panel=$("chunkEditorPanel");
  const assist=$("proposeChunksBtn");
  if(panel) panel.hidden = chunkMode==="auto";
  if(assist) assist.hidden = chunkMode==="manual";
}
function userChunkDirective(chunks){
  return `
【ユーザー確定の意味塊】
以下の配列はユーザーが確定した意味塊である。これは翻訳AIへの入力条件であり、言語仕様ではない。
${JSON.stringify(chunks)}
- chunk数、順序、各chunkの原文文字列を変更しない。
- 再分割・再結合・省略・追加を禁止する。
- 「不自然だから」「述語数が一つだから」等を理由に変更しない。
- AIの仕事は各確定chunk内部の意味解析、辞書照合、IR構築、およびchunk間linkの分析のみ。
`;
}
function semanticPromptWithChunks(input,chunks){
  return `${PROMPT_SEMANTIC}${PROMPT_FIXED_CHUNK_OUTPUT}${PROMPT_UNRESOLVED_NONPROPAGATION}${PROMPT_TIME_QUANTITY_V55}
${userChunkDirective(chunks)}
原文:${input}
各ユーザーchunkを1対1でsemantic chunkとして解析する。
JSONのみ:
{"chunks":[{"source":"","meaning":"","semantic_atoms":[],"independence_reason":"user_fixed"}],"required_domains":[],"lexical_needs":[]}`;
}
async function proposeChunks(provider,model,input){
  const prompt=`${PROMPT_SEMANTIC}${PROMPT_TIME_QUANTITY_V55}
【工程】意味塊の提案だけを行う。
原文:${input}
ユーザーが後で編集するため、自然な意味塊候補を順序通りに返す。
辞書ID、fumezuaq表面形、接辞を出さない。
JSONのみ:{"chunks":[{"source":"","reason":""}]}`;
  const out=await runStage(provider,model,"意味塊提案",prompt,'{"chunks":[]}');
  return normalizeChunkDrafts((out.chunks||[]).map(x=>x.source||x.text||""));
}
function enforceFixedChunksIR(ir,chunks){
  const errs=[];
  if((ir?.chunks||[]).length!==chunks.length){
    errs.push(`ユーザー指定 ${chunks.length}塊 に対しIRは ${(ir?.chunks||[]).length}塊`);
    return errs;
  }
  (ir.chunks||[]).forEach((c,i)=>{
    const src=String(c.jp||c.source||"").trim();
    if(src && src!==chunks[i]) errs.push(`chunk${i+1}: source変更 "${src}" != "${chunks[i]}"`);
    const hasResolvedContent = !!c.center_root_id || (c.modifier_roots||[]).length>0 || (c.affix_ids||[]).length>0;
    const hasExplicitUnresolved = (c.unresolved||[]).length>0 || (c.unresolved_relation||[]).length>0;
    if(!hasResolvedContent && !hasExplicitUnresolved){
      errs.push(`chunk${i+1}: "${chunks[i]}" が解決もunresolved化もされていません`);
    }
  });
  return errs;
}

// ===== v4: Typed IR + deterministic compiler =====
const ZONE_ORDER={S:0,R:1,D:2,ROOT:3,E:4,K:5,C:6};



function parseJapaneseRelativeDay(text){
  const s=String(text||"").trim();
  const kanji={"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10};
  if(s==="昨日") return {unit:"日",direction:"前",amount:1,concept:"昨日"};
  if(s==="明日") return {unit:"日",direction:"後",amount:1,concept:"明日"};
  if(s==="一昨日"||s==="おととい") return {unit:"日",direction:"前",amount:2,concept:s};
  if(s==="明後日") return {unit:"日",direction:"後",amount:2,concept:s};
  let m=s.match(/^(\d+)日前$/);
  if(m)return {unit:"日",direction:"前",amount:Number(m[1]),concept:s};
  m=s.match(/^(\d+)日後$/);
  if(m)return {unit:"日",direction:"後",amount:Number(m[1]),concept:s};
  m=s.match(/^([一二三四五六七八九十])日前$/);
  if(m)return {unit:"日",direction:"前",amount:kanji[m[1]],concept:s};
  m=s.match(/^([一二三四五六七八九十])日後$/);
  if(m)return {unit:"日",direction:"後",amount:kanji[m[1]],concept:s};
  return null;
}
function numeralForm12(n){
  // Relative-time shortcut currently accepts only a single completed numeral form. Composite time quantities are forbidden.
  const basic=["noq","raq","teq","kiq","suq","maq","weq","poq","duq","geq","fiq","yoq"];
  if(Number.isInteger(n) && n>=0 && n<basic.length) return {surface:basic[n],direct:true};
  return {surface:null,direct:false};
}
function findEntryByMeaningAndForms(meanings,forms=[]){
  const arr=DICT||[];
  return arr.find(e=>meanings.some(m=>String(e.meaning||"").includes(m)) && (!forms.length || forms.includes(e.form)))
      || arr.find(e=>forms.includes(e.form))
      || null;
}
function buildRelativeDayComposition(source){
  const p=parseJapaneseRelativeDay(source);
  if(!p)return null;
  // Use only dictionary-confirmed entries. Day root collision is deliberately not guessed.
  const before=dictById("C3-REL-01") || findEntryByMeaningAndForms(["基準より前"],["nokuq-wipuq"]);
  const after=dictById("C3-REL-03") || findEntryByMeaningAndForms(["基準より後"],["nokuq-wepuq"]);
  const direction=p.direction==="前"?before:after;
  const numeral=numeralForm12(p.amount);

  // Find a dictionary entry explicitly meaning day/time unit; do not blindly choose a colliding form.
  const day = dictById("TIMEUNIT-DAY") || (DICT||[]).find(e=>e.kind==="時間単位接頭要素" && String(e.meaning||"").startsWith("日"));

  return {
    source,
    kind:"relative_day",
    decomposition:{unit:"日",direction:p.direction,amount:p.amount},
    confirmed:{
      day: day ? {id:day.id,form:day.form,meaning:day.meaning}:null,
      direction: direction ? {id:direction.id,form:direction.form,meaning:direction.meaning}:null,
      numeral
    },
    complete:!!(day&&direction&&numeral.direct),
    unresolved_parts:[
      ...(!day?["DAY_TIME_UNIT_MISSING"]:[]),
      ...(!direction?["RELATIVE_DIRECTION_MISSING"]:[]),
      ...(!numeral.direct?["TIME_QUANTITY_COMPOSITE_NUMERAL_FORBIDDEN"]:[])
    ]
  };
}
function analyticalCompositionsFromFixedChunks(chunks){
  return (chunks||[]).map((s,i)=>({chunk_index:i,composition:buildRelativeDayComposition(s)})).filter(x=>x.composition);
}
function rescueCoreParticipantConcepts(resolved, sem){
  const text = JSON.stringify({resolved,sem});
  const additions=[];

  const candidates = [
    {concept:"一人称", ids:["C1-P01"], forms:["giroq-vaipuq","vaipuq"], triggers:["一人称","1sg","1st person","私","わたし"]},
    {concept:"単数", ids:["C1-N01"], forms:["giroq-nyupoq","nyupoq"], triggers:["単数","singular","1sg"]},
    {concept:"意図動作主", ids:["C1-01"], forms:["giroq-jepuq","jepuq"], triggers:["意図動作主","agent","行為主体","1sg agent"]}
  ];

  for(const c of candidates){
    if(!c.triggers.some(t=>text.includes(t))) continue;
    let entry=null;
    for(const id of c.ids){ const e=dictById(id); if(e){entry=e;break;} }
    if(!entry){
      entry=(DICT||[]).find(e=>c.forms.includes(e.form));
    }
    if(entry && !text.includes(entry.id)){
      additions.push(entry);
    }
  }
  return additions;
}
function exactDictionarySearch(terms,limit=160){
 const ts=[...new Set((terms||[]).flatMap(x=>String(x||"").split(/[、,・\/／（）()\s]+/)).filter(x=>x.length>0))];
 let scored=[];
 for(const e of DICT){
   const hay=[e.id,e.form,e.meaning,e.large,e.middle,e.note,...(e.keywords||[])].join(" ");
   let s=0;
   for(const t of ts){
     if(e.id===t||e.form===t)s+=100;
     if(e.meaning===t)s+=60;
     if(hay.includes(t))s+=10+t.length;
   }
   if(s)scored.push({e,s});
 }
 return scored.sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>compactEntry(x.e));
}
function unresolvedTerms(res){
 return [...new Set((res?.unresolved||[]).flatMap(x=>{
   if(typeof x==="string")return [x];
   return [x?.concept,x?.meaning,x?.query,...(x?.aliases||[])];
 }).filter(Boolean))];
}
async function rescueUnresolved(provider,model,input,sem,resolved){
 const terms=unresolvedTerms(resolved);
 if(!terms.length)return resolved;
 const candidates=exactDictionarySearch(terms.concat(["基準より後","内容","推量","可能性","朝","期限","条件","方向"]),260);
 if(!candidates.length)return resolved;
 const prompt=`あなたはfumezuaq辞書の再検索照合器です。
${PROMPT_DICTIONARY_V55}
原文:${input}
意味解析:${JSON.stringify(sem)}
未解決:${JSON.stringify(resolved.unresolved)}
再検索候補:${JSON.stringify(candidates)}
候補に実在するIDだけを採用する。近似意味への置換は禁止。完全に対応しなければunresolvedのまま。
各意味塊について、吸収理由ではなく独立性の判定理由を優先して記録する。\nJSONのみ:{"resolved":[{"concept":"","id":"","form":"","meaning":"","zone":""}],"unresolved":[]}`;
 const retry=await runStage(provider,model,"unresolved再検索",prompt,'{"resolved":[],"unresolved":[]}');
 const map=new Map((resolved.resolved||[]).map(x=>[x.concept,x]));
 for(const x of (retry.resolved||[])) if(x?.concept&&x?.id&&dictById(x.id)) map.set(x.concept,x);
 return {resolved:[...map.values()],unresolved:retry.unresolved||[]};
}
function irPrompt(input,sem,resolved){
 return `${PROMPT_IR_V55}\nあなたはfumezuaqのTyped IR設計器です。表面形を絶対に生成しない。
${GRAMMAR}
${PROMPT_DICTIONARY_V55}
原文:${input}
意味解析:${JSON.stringify(sem)}
辞書照合:${JSON.stringify(resolved)}
IR規則:
- chunkは意味塊。surface文字列は禁止。
- lexical centerはcenter_root_idで1つだけ。時間指定等はcenter_root_id=nullを許す。
- 同一語へ吸収した副語根はmodifier_rootsに置き、relation_idを必須にする。単に語根を並べてはいけない。
- relation_idは「副語根と中心語根の関係」を示す実在辞書ID。例: 雨→止むなら非意図主体C1-02、山→行くなら方向C2-31。
- 人称・数など語根を持たない情報はaffix_ids。
- 時間量は affix_ids に TIMEUNIT-* と NUM-* を入れる。TIMEUNIT-* は必ずちょうど1個の「完成数詞」NUM-* と組にする。
- 時間量のために複数のNUM-*を並べない。Xスコープ等で複合数詞を包んで時間量にすることも禁止。
- unresolved概念はunresolvedへ。表面形を推測しない。
- 独立塊間の関係が必要なのに辞書で表現できなければunresolved_relationへ。「文脈で分かる」で済ませない。
- 「明日の朝まで」はcenter_root_id=nullの時間塊として許可。
- 「彼が山へ」と「行けるだろう」のように分離する場合、両塊が独立成立し、必要な対応関係が保持されること。保持できなければ吸収する。
JSONのみ:
{"chunks":[{"jp":"","meaning":"","center_root_id":null,"modifier_roots":[{"root_id":"","relation_id":"","meaning":""}],"affix_ids":[],"analytical_composition":null,"links":[{"type":"","target_chunk":0,"surface_required":false,"reason":""}],"unresolved":[],"unresolved_relation":[]}],"sentence_unresolved":[]}`;
}
function validateIR(ir){
 const errors=[],warnings=[];
 for(let i=0;i<(ir?.chunks||[]).length;i++){
   const c=ir.chunks[i];
   if(c.center_root_id && !dictById(c.center_root_id)) errors.push(`chunk${i+1}: center_root_id ${c.center_root_id} は辞書にありません`);
   for(const m of (c.modifier_roots||[])){
     const root=dictById(m.root_id), rel=dictById(m.relation_id);
     if(!root)errors.push(`chunk${i+1}: 副語根 ${m.root_id} は辞書にありません`);
     if(!rel)errors.push(`chunk${i+1}: 副語根関係 ${m.relation_id||"(空)"} が未解決です`);
     if(root && root.zone!=="ROOT")errors.push(`chunk${i+1}: ${m.root_id} はROOTではありません`);
   }
   for(const id of (c.affix_ids||[])) if(!dictById(id))errors.push(`chunk${i+1}: 接辞ID ${id} は辞書にありません`);

   const ids=(c.affix_ids||[]);
   const timeUnitIds=ids.filter(id=>String(id).startsWith("TIMEUNIT-"));
   const numeralEntries=ids.map(id=>dictById(id)).filter(e=>e && e.zone==="NUM" && (e.kind==="数詞" || e.kind==="派生数詞"));
   const numeralElementIds=ids.filter(id=>String(id).startsWith("NUM-ELEM-") || id==="NUM-POINT");
   const scopeIds=ids.filter(id=>String(id).startsWith("X-"));
   if(timeUnitIds.length>1) errors.push(`chunk${i+1}: 時間単位接頭要素は1時間量につき1個だけです`);
   if(timeUnitIds.length===1){
     if(numeralEntries.length!==1) errors.push(`chunk${i+1}: 時間量は単一の完成数詞形態素1個を必須とします`);
     if(numeralElementIds.length) errors.push(`chunk${i+1}: 時間量内で数詞形成要素を直接組み立ててはいけません。完成済みNUM形を1個だけ使用します`);
     if(scopeIds.length) errors.push(`chunk${i+1}: 時間量にXスコープを使用することは禁止されています`);
   }

   if((c.unresolved_relation||[]).length)warnings.push(`chunk${i+1}: 未解決関係 ${c.unresolved_relation.join(" / ")}`);
 }
 return {ok:errors.length===0,errors,warnings};
}
function affixParts(entries){
 // one large marker per large category; retain small forms thereafter
 const out=[],seenLarge=new Set();
 for(const e of entries){
   if(e.zone==="ROOT"){out.push(e.form);continue}
   const lg=e.large_form||"";
   const sm=e.small_form||"";
   const key=e.zone+"|"+(e.large||lg||e.id.split("-")[0]);
   if(lg&&sm){
     if(!seenLarge.has(key)){out.push(lg);seenLarge.add(key)}
     out.push(sm);
   }else if(e.form) out.push(e.form);
 }
 return out;
}

function cleanUnknownLabel(x, fallback="未解決"){
  if(x==null)return fallback;
  if(typeof x==="string"){
    let s=x.trim();
    s=s.replace(/^Unknown\s*:\s*/i,"").replace(/^unresolved\s*:\s*/i,"");
    return s || fallback;
  }
  if(typeof x==="object"){
    return String(x.concept||x.jp||x.source||x.meaning||x.label||x.code||fallback);
  }
  return String(x);
}
function unknownToken(label){
  return `Unknown:${cleanUnknownLabel(label)}`;
}
function collectChunkUnknowns(c){
  const raw=[...(c?.unresolved||[]),...(c?.unresolved_relation||[])];
  const seen=new Set(),out=[];
  for(const x of raw){
    const label=cleanUnknownLabel(x);
    if(!seen.has(label)){seen.add(label);out.push(label);}
  }
  return out;
}
function compileRelativeDayPartial(source){
  const comp=buildRelativeDayComposition(source);
  if(!comp)return null;
  const parts=[];
  const unknowns=[];
  if(comp.confirmed?.day?.form && comp.confirmed?.numeral?.surface) {
    const tq=buildTimeQuantity("日", comp.confirmed.numeral.surface);
    if(tq.ok) parts.push(tq.surface);
    else { parts.push(unknownToken("時間量")); unknowns.push("時間量"); }
  } else {
    if(!comp.confirmed?.day?.form){ parts.push(unknownToken("日")); unknowns.push("日"); }
    if(!comp.confirmed?.numeral?.surface){ const lab=`数値${comp.decomposition?.amount ?? ""}`; parts.push(unknownToken(lab)); unknowns.push(lab); }
  }

  if(comp.confirmed?.direction){
    const d=comp.confirmed.direction;
    if(d.large_form&&d.small_form) parts.push(d.large_form,d.small_form);
    else if(d.form) parts.push(...String(d.form).split("-").filter(Boolean));
  }else{
    parts.push(unknownToken(comp.decomposition?.direction||"前後関係"));
    unknowns.push(comp.decomposition?.direction||"前後関係");
  }

  return {parts,unknowns,composition:comp};
}
function compileIR(ir, options={}){
  const fixedChunks = Array.isArray(options.fixedChunks) ? options.fixedChunks : [];
  const preserveSlots = !!options.preserveSlots;
  const out=[];
  const compiledChunks=[];

  (ir?.chunks||[]).forEach((c,idx)=>{
    const fixedSource = fixedChunks[idx] || c.jp || c.source || "";
    const parts=[];
    const structuralUnknowns=[];

    // Deterministic analytical composition takes priority for confirmed patterns
    // such as 昨日 = 日 + 前 + 1. Missing subparts remain visible as Unknown:...
    const relDay = compileRelativeDayPartial(fixedSource);
    if(relDay){
      parts.push(...relDay.parts);
      structuralUnknowns.push(...relDay.unknowns);
    }else{
      const modifierParts=[];
      for(const mr of (c.modifier_roots||[])){
        const r = dictById(mr.root_id);
        if(r?.form) modifierParts.push(r.form);
        else if(mr.root_id) structuralUnknowns.push(mr.meaning||mr.root_id);
      }

      const center = c.center_root_id ? dictById(c.center_root_id) : null;
      if(modifierParts.length) parts.push(...modifierParts);
      if(center?.form) parts.push(center.form);
      else if(c.center_root_id) structuralUnknowns.push(c.meaning||c.jp||c.center_root_id);

      const rawAffixIds=(c.affix_ids||[]);
      const timeUnitEntry=rawAffixIds.map(id=>dictById(id)).find(e=>e?.kind==="時間単位接頭要素") || null;
      const numeralEntry=rawAffixIds.map(id=>dictById(id)).find(e=>e && e.zone==="NUM" && (e.kind==="数詞" || e.kind==="派生数詞")) || null;

      if(timeUnitEntry && numeralEntry){
        const tq=buildTimeQuantity(String(timeUnitEntry.meaning||"").replace(/単位$/,""), numeralEntry.form);
        if(tq.ok) parts.push(tq.surface);
        else structuralUnknowns.push(tq.reason||"時間量");
      }

      const genericAffixIds=rawAffixIds.filter(id=>{
        const e=dictById(id);
        return !(e && (e.kind==="時間単位接頭要素" || (e.zone==="NUM" && (e.kind==="数詞" || e.kind==="派生数詞"))));
      });
      const affixEntries=genericAffixIds.map(id=>({id,e:dictById(id)}));
      const relationEntries=(c.modifier_roots||[]).map(x=>({id:x.relation_id,e:dictById(x.relation_id),meaning:x.meaning}));
      const allAffixes=[...relationEntries,...affixEntries];

      const seenLarge=new Set();
      const realized=[];
      for(const item of allAffixes){
        const e=item.e;
        if(!e){
          if(item.id) structuralUnknowns.push(item.meaning||item.id);
          continue;
        }
        const lg=e.large_form||"";
        const sm=e.small_form||"";
        const key=e.zone+"|"+(e.large||lg||String(e.id||"").split("-")[0]);
        if(lg&&sm){
          if(!seenLarge.has(key)){realized.push(lg);seenLarge.add(key);}
          realized.push(sm);
        }else if(e.form){
          realized.push(...String(e.form).split("-").filter(Boolean));
        }
      }
      if(realized.length) parts.push(...realized);
    }

    const irUnknowns=collectChunkUnknowns(c);
    const allUnknowns=[...new Set([...structuralUnknowns,...irUnknowns].map(x=>cleanUnknownLabel(x)).filter(Boolean))];

    // Add unresolved material visibly instead of deleting or pretending it was absorbed.
    // If part of the chunk is known, keep the known surface and append only the missing concepts.
    if(!relDay){
      for(const u of allUnknowns) parts.push(unknownToken(u));
    }

    let displaySurface=parts.filter(Boolean).join("-");
    let status=allUnknowns.length ? "partial" : "resolved";

    if(!displaySurface && (preserveSlots || allUnknowns.length)){
      displaySurface=unknownToken(fixedSource || `意味塊${idx+1}`);
      status="unresolved";
    }

    compiledChunks.push({
      index:idx,
      source:fixedSource,
      surface:displaySurface,
      resolved_surface:parts.filter(x=>!String(x).startsWith("Unknown:")).join("-"),
      display_surface:displaySurface,
      status,
      unresolved:allUnknowns,
      unresolved_relation:c.unresolved_relation||[],
      analytical_composition:relDay?.composition||c.analytical_composition||null
    });

    // In fixed mode, one user semantic-chunk slot always yields one output slot.
    if(displaySurface || preserveSlots) out.push(displaySurface || unknownToken(fixedSource || `意味塊${idx+1}`));
  });

  return {translation:out.join(" "),chunks:compiledChunks};
}

function semanticPrompt(input){return `あなたは人工言語 fumezuaq の日本語意味解析器です。まだ翻訳してはいけません。
${GRAMMAR}
${PROMPT_DICTIONARY_V55}
最重要規則:
- 日本語の文節境界をそのままfumezuaqの語境界にしない。
- 「Xが」「Xは」「Xを」だけでは原則独立意味塊にしない。
- まず述語・中心概念を決め、参与者・対象・方向・時間・条件などを中心語根へ吸収できるか判定する。
- 人称代名詞を humeq「人」の独立語で表さない。私・あなた・彼・彼女などは原則C1参与者情報として中心語根へ付ける。
- 名詞語根を独立させるのは、その名詞中心の意味塊が自立するときだけ。
- 「雨が止む」は「雨」+「止む」に分けず、tokuq「止む」を中心に雨を非意図主体として吸収する。
- 「彼は山へ行ける」は「彼」を独立語にせず、waraq「行く」を中心に三人称単数・方向・可能を付ける。
- 「明日の朝まで」のように時間指定そのものとして成立するものは、語彙的中心語根がなくても独立意味塊にしてよい。中心語根の有無だけで自立性を判定しない。
- 一語が過密になる場合だけ分離し、分離後も各塊が意味的に成立すること。
入力:${input}
JSONのみ:
{"chunks":[{"jp":"","center":"","center_type":"verb|noun|time|other","participants":[{"concept":"","role":"","person":"","number":"","gender":""}],"concepts":[],"zones":[],"relations":[],"absorb":[]}],"required_domains":[],"lexical_needs":[]}`;}
function buildCandidates(input,sem){
  let rel=relevantEntries(input+" "+JSON.stringify(sem));
  for(const d of sem.required_domains||[]){
    const p=String(d).match(/^(?:[SRDEKC]\d+|NUM)/)?.[0];
    if(p==="NUM") rel.push(...DICT.filter(e=>e.zone==="NUM"));
    else if(p) rel.push(...DICT.filter(e=>String(e.id||"").startsWith(p)));
  }
  const semanticText=input+" "+JSON.stringify(sem);
  if(/年|月|半月|日|時間|分|秒|時刻|時間量/.test(semanticText)){
    rel.push(...DICT.filter(e=>e.zone==="NUM" && (
      e.kind==="時間単位接頭要素" ||
      e.kind==="数詞" ||
      e.kind==="派生数詞" ||
      e.kind==="数詞形成接辞"
    )));
  }
  rel.push(...DICT.filter(e=>/まで|期限|朝|条件|なら|三人称|単数|方向|可能|推量|過去|継続|引用/.test((e.meaning||"")+" "+(e.keywords||[]).join(" "))));
  return relevantDedup(rel).slice(0,360).map(compactEntry);
}
function resolvePrompt(input,sem,cands){return `あなたはfumezuaq辞書照合器です。最終文はまだ作らないでください。\n${GRAMMAR}\n${PROMPT_TIME_QUANTITY_V55}\n原文:${input}\n意味解析:${JSON.stringify(sem)}\n辞書候補:${JSON.stringify(cands)}\n各概念を既存辞書へ対応付け、新造は禁止。辞書にあるものをunknownにしない。
時間量では、単位概念を TIMEUNIT-*、数値を NUM-* にそれぞれ対応付ける。
例:「2時間」→ TIMEUNIT-HOUR + NUM-02。「1日前」→ TIMEUNIT-DAY + NUM-01 + C3-REL-01。
時間量単位を通常語根で代用しない。
JSONのみ: {"resolved":[{"concept":"","id":"","form":"","meaning":"","zone":"","alternatives":[]}],"unresolved":[]}`;}
function generatePrompt(input,sem,res){return `あなたはfumezuaq構文生成器です。
${GRAMMAR}
${PROMPT_DICTIONARY_V55}
原文:${input}
意味解析:${JSON.stringify(sem)}
辞書照合:${JSON.stringify(res)}
最重要:
- 最終JSONは短くする。詳細説明はここでは生成しない。
- 一語一中心語根。
- 日本語の「Xが」「Xは」を独立語へ機械的にしない。
- 人称代名詞を humeq で独立語化しない。
- 「雨が止む」は tokuq 中心、「彼が行く」は waraq 中心。
- S-R-D-ROOT-E-K-C、同一大分類一回。
- 辞書外新造禁止。
JSONのみ:
{"translation":"","chunks":[{"surface":"","meaning":"","used_ids":[]}],"warnings":[]}`;}
function rescueSet(draft){const terms=[...(draft.warnings||[])];const raw=JSON.stringify(draft);for(const m of raw.matchAll(/unknown[^=:：]*[=:：]?\s*([^"\],}]+)/gi))terms.push(m[1]);let list=[];for(const t of terms){const bits=String(t).split(/[・\/／\s「」『』（）()]+/).filter(Boolean);for(const e of DICT){const hay=[e.meaning,(e.keywords||[]).join(" "),e.large,e.middle].join(" ");if(bits.some(b=>b&&hay.includes(b)))list.push(e);}}list.push(...DICT.filter(e=>/まで|期限|朝|条件|なら|三人称|単数|方向|可能|推量|過去|継続|引用/.test((e.meaning||"")+" "+(e.keywords||[]).join(" "))));return relevantDedup(list).slice(0,180).map(compactEntry);}
function verifyPrompt(input,draft,rescue){return `あなたはfumezuaq最終検証器です。
${GRAMMAR}
${PROMPT_DICTIONARY_V55}
原文:${input}
暫定:${JSON.stringify(draft)}
再検索候補:${JSON.stringify(rescue)}
検証規則:
- 出力は短いJSONだけ。
- unknownが既存辞書で置換できるなら置換。
- 条件はC5、時間はC3、可能はE7、推量はK系を優先。
- 日本語文節単位を独立語にしない。
- humeq を代名詞の台座にしない。
- 「雨が止む」は述語中心、「彼が行く」も述語中心。
- 詳細説明は禁止。
- 辞書外新造禁止。
JSONのみ:
{"translation":"","chunks":[{"surface":"","meaning":"","used_ids":[]}],"warnings":[]}`;}
async function runStage(provider,model,stageName,prompt,shapeHint){
 try{
   const raw=await callAI(provider,model,prompt);
   return await parseStageJson(provider,model,stageName,raw,shapeHint);
 }catch(first){
   // One clean retry for transient empty output / format failure.
   const retryPrompt=prompt+`\n\n【再試行】前回の応答に問題がありました。説明を一切付けず、指定されたJSONオブジェクトだけを必ず返してください。`;
   try{
     const raw2=await callAI(provider,model,retryPrompt);
     return await parseStageJson(provider,model,stageName,raw2,shapeHint);
   }catch(second){
     throw new Error(`${stageName}: ${second.message}`);
   }
 }
}


function dictById(id){return DICT.find(e=>e.id===id)||null}
function validateTranslation(result,sem,options={}){
 const errors=[],warnings=[],chunks=result?.chunks||[];
 if(!String(result?.translation||"").trim())errors.push({code:"EMPTY",message:"翻訳結果が空です"});
 const prose=JSON.stringify(result);
 if(/一語一語根|一語二語根(?:違反|禁止|を解消)|二語根だから分離|複数語根.*分離/.test(prose))
   errors.push({code:"INVENTED_RULE",message:"存在しない「一語一語根」規則が使用されています"});
 for(let i=0;i<chunks.length;i++){
   const c=chunks[i],sf=String(c.surface||"").trim(),mn=String(c.meaning||"");
   for(const id of (c.used_ids||[]))if(!dictById(id))errors.push({code:"BAD_ID",chunk:i,message:`辞書にないID ${id}`});
   if(/^humeq(?:-|$)/.test(sf)&&/(彼|彼女|私|あなた|三人称|一人称|二人称)/.test(mn))
     errors.push({code:"PRONOUN_HUMEQ",chunk:i,message:"humeq「人」を代名詞の台座にしています"});
   if(!options.fixedMode && sf==="wesamaq"&&/(雨|主体)/.test(mn))
     errors.push({code:"ORPHAN_RAIN",chunk:i,message:"雨だけが述語から孤立しています。「雨が止む」はtokuq中心への再吸収を検討してください"});
   if(!options.fixedMode && /^keraq(?:-|$)/.test(sf)&&/山へ|方向/.test(mn)&&chunks.some(x=>/^waraq(?:-|$)/.test(String(x.surface||""))))
     errors.push({code:"ORPHAN_GOAL",chunk:i,message:"「山へ」だけをwaraqから分離しています。名詞「山」が存在することだけではこの文中の独立意味塊成立の根拠になりません。waraq側へ吸収するか、必要なら明示的対応関係を示してください"});
 }

 const prose2=JSON.stringify(result);
 if(/(?:時間|場所|条件|意味塊).{0,24}中心語根.{0,24}(?:必要|必須|不在で自立しない|持たず自立しない)/.test(prose2))
   errors.push({code:"INVENTED_CENTER_REQUIREMENT",message:"「独立意味塊には中心語根が必須」という未定義規則が使用されています"});
 for(let i=0;i<chunks.length;i++){
   const c=chunks[i],sf=String(c.surface||""),mn=String(c.meaning||"");
   if(/明日/.test(mn)&&/nokuq-miepuq/.test(sf)&&!/(?:^|-)wepuq(?:-|$)/.test(sf))
     errors.push({code:"MISSING_TOMORROW_REL",chunk:i,message:"「明日」を含む意味なのにC3-REL-03 wepuqがありません。miepuq「朝」へ明日の意味を統合せず、wepuqを確認するかunresolvedにしてください"});
 }

 const facts=chunks.map((c,i)=>({chunk:i,surface:c.surface,entries:(c.used_ids||[]).map(dictById).filter(Boolean).map(e=>({id:e.id,form:e.form,meaning:e.meaning,zone:e.zone,large:e.large,middle:e.middle,status:e.status}))}));
 return {ok:errors.length===0,errors,warnings,facts};
}
function correctionPrompt(input,result,sem,resolved,v){
 return `あなたはfumezuaq翻訳の修正器です。
${GRAMMAR}
${PROMPT_DICTIONARY_V55}
原文:${input}
現在:${JSON.stringify(result)}
意味解析:${JSON.stringify(sem)}
辞書照合:${JSON.stringify(resolved)}
機械検証違反:${JSON.stringify(v.errors)}
警告:${JSON.stringify(v.warnings)}
違反箇所だけ修正すること。新規文法規則を作らないこと。必要な辞書項目を確認できなければ近似項目へ意味を足さずwarningsに unresolved と明記すること。
JSONのみ:{"translation":"","chunks":[{"surface":"","meaning":"","used_ids":[]}],"warnings":[]}`;
}
async function validateAndRepair(provider,model,input,result,sem,resolved){
 let cur=result,v=validateTranslation(cur,sem);
 for(let n=0;!v.ok&&n<2;n++){
   setPipelineStatus(`文法違反修正 ${n+1}/2`,5,5);
   const raw=await callAI(provider,model,correctionPrompt(input,cur,sem,resolved,v));
   cur=await parseStageJson(provider,model,"文法違反修正",raw,'{"translation":"","chunks":[{"surface":"","meaning":"","used_ids":[]}],"warnings":[]}');
   v=validateTranslation(cur,sem);
 }
 cur._validation=v;
 if(!v.ok)cur.warnings=[...(cur.warnings||[]),...v.errors.map(x=>"文法検証未解決: "+x.message)];
 if(v.warnings.length)cur.warnings=[...(cur.warnings||[]),...v.warnings.map(x=>"文法検証警告: "+x.message)];
 return cur;
}

function explanationPrompt(input,result,sem,resolved){
 return `${PROMPT_EXPLANATION}${PROMPT_FIXED_CHUNK_OUTPUT}${PROMPT_UNRESOLVED_NONPROPAGATION}${PROMPT_UNKNOWN_VISIBLE_V53}\nあなたはfumezuaq Typed IRの構造理由だけを説明する。
${PROMPT_DICTIONARY_V55}
原文:${input}
Typed IR:${JSON.stringify(result?._debug?.ir||{})}
確定表面形:${JSON.stringify((result?.chunks||[]).map(x=>x.surface))}
辞書事実はプログラム表示なので、形態素の意味を自作しない。確定表面形を変更しない。
ユーザー固定意味塊は絶対に再分割・再吸収・消去しない。
Unknown:... は「未解決のため表面に残した不足部分」であり、別語へ吸収・分配実現されたと説明してはならない。
「分配的実現」「表面化不要」「リンクがあるのでチャンクを消せる」など、仕様にない概念を作らない。
surface_required=false はリンク標識そのものを表面に出さなくてよいという意味であり、意味塊自体を消してよいという意味ではない。
説明対象は「なぜこの意味塊か」「なぜこの中心語根か」「なぜ副語根をこの関係で吸収したか」「何がUnknown/unresolvedか」のみ。
JSONのみ:{"summary":"","chunks":[{"surface":"","reason":"","alternatives":""}]}`;
}
async function buildExplanation(provider,model,input,result,sem,resolved){
 const raw=await callAI(provider,model,explanationPrompt(input,result,sem,resolved));
 return await parseStageJson(provider,model,"説明生成",raw,'{"summary":"","chunks":[{"surface":"","meaning":"","breakdown":[],"reason":"","alternatives":""}]}');
}

async function aiTranslate(provider,model,input){
 if(direction==="fu2ja"){
   setPipelineStatus("逆翻訳解析",1,1);
   const hits=relevantEntries(input).map(compactEntry);
   const prompt=`fumezuaqを日本語へ解析。${GRAMMAR}\n辞書候補:${JSON.stringify(hits)}\n入力:${input}\nJSONのみ:{"translation":"","chunks":[],"warnings":[]}`;
   return await runStage(provider,model,"逆翻訳解析",prompt,'{"translation":"","chunks":[],"warnings":[]}');
 }
 setPipelineStatus("意味解析",1,6);
 const fixedChunks = chunkMode==="auto" ? [] : normalizeChunkDrafts(getChunkInputs());
 if(chunkMode!=="auto" && !fixedChunks.length) throw new Error("意味塊指定モードでは、少なくとも1つの意味塊を入力してください。");
 const analyticalCompositions = fixedChunks.length ? analyticalCompositionsFromFixedChunks(fixedChunks) : [];
 const compositionHint = analyticalCompositions.length ? `\n【既存要素による分析的構成候補】\n${JSON.stringify(analyticalCompositions)}\n完全一致語がなくても、complete=trueならこの構成を優先しunresolved扱いしない。complete=falseなら確認済み部分だけ保持し、不足部分のみunresolvedにする。` : "";
 const semPrompt = (fixedChunks.length ? semanticPromptWithChunks(input,fixedChunks) : semanticPrompt(input)) + compositionHint;
 const sem=await runStage(provider,model,"意味解析",semPrompt,'{"chunks":[],"required_domains":[],"lexical_needs":[]}');

 const cands=buildCandidates(input,sem);
 setPipelineStatus("辞書照合",2,6);
 let resolved=await runStage(provider,model,"辞書照合",resolvePrompt(input,sem,cands) + compositionHint,'{"resolved":[],"unresolved":[]}');

 if((resolved.unresolved||[]).length){
   setPipelineStatus("unresolved再検索",3,6);
   resolved=await rescueUnresolved(provider,model,input,sem,resolved);
  const coreParticipantRescue=rescueCoreParticipantConcepts(resolved,sem);
 if(coreParticipantRescue.length){
   resolved = {...resolved, forced_confirmed_entries:[...(resolved.forced_confirmed_entries||[]), ...coreParticipantRescue.map(e=>({id:e.id,form:e.form,meaning:e.meaning}))]};
 }
}

 setPipelineStatus("Typed IR構築",4,6);
 const irBasePrompt = irPrompt(input,sem,resolved) + compositionHint + (fixedChunks.length ? "\n"+PROMPT_FIXED_CHUNK_OUTPUT+"\n"+PROMPT_UNRESOLVED_NONPROPAGATION+"\n"+userChunkDirective(fixedChunks) : "");
 let ir=await runStage(provider,model,"Typed IR構築",irBasePrompt,'{"chunks":[],"sentence_unresolved":[]}');
 let iv=validateIR(ir);
 if(fixedChunks.length){
   const fixedErrors=enforceFixedChunksIR(ir,fixedChunks);
   if(fixedErrors.length){iv.ok=false;iv.errors.push(...fixedErrors);}
 }
 if(!iv.ok){
   const fix=`${irPrompt(input,sem,resolved)}
${fixedChunks.length ? userChunkDirective(fixedChunks) : ""}
前回IR:${JSON.stringify(ir)}
IR検証エラー:${JSON.stringify(iv.errors)}
エラーだけ修正。辞書にないIDを作らない。`;
   ir=await runStage(provider,model,"IR修正",fix,'{"chunks":[],"sentence_unresolved":[]}');
   iv=validateIR(ir);
 }

 setPipelineStatus("決定論コンパイル",5,6);
 let result=compileIR(ir,{fixedChunks,preserveSlots:fixedChunks.length>0});
 result._ir_validation=iv;
 result._debug={candidateCount:cands.length,semantic:sem,resolved:resolved,ir:ir,compiler:"deterministic-v4"};

 // Surface is never rewritten by AI. Validator may report only.
 const sv=validateTranslation(result,sem,{fixedMode:fixedChunks.length>0});
 result._validation=sv;
 if(!iv.ok) result.warnings.push(...iv.errors.map(x=>"IR検証未解決: "+x));
 if(!sv.ok) result.warnings.push(...sv.errors.map(x=>"表面検証: "+x.message));

 setPipelineStatus("完了",6,6);
 return result;
}

function initChunkUI(){
  renderChunkInputs([""]);
  document.querySelectorAll('input[name="chunkMode"]').forEach(r=>r.addEventListener("change",syncChunkModeUI));
  $("addChunkBtn")?.addEventListener("click",()=>renderChunkInputs([...getChunkInputs(),""]));
  $("proposeChunksBtn")?.addEventListener("click",async()=>{
    const input=$("inputText")?.value?.trim()||"";
    if(!input){alert("先に全文を入力してください。");return}
    try{
      const provider=$("provider")?.value||"openai";
      const model=selectedModelForProvider(provider);
      const chunks=await proposeChunks(provider,model,input);
      if(chunks.length)renderChunkInputs(chunks);
    }catch(e){alert("意味塊提案に失敗しました: "+e.message)}
  });
  syncChunkModeUI();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initChunkUI);
else initChunkUI();

async function testProvider(p){
 const c=KEYCFG[p],key=$(c.input).value.trim();if(!key)throw new Error("APIキーを入力してください");
 if(p==="openai"){
   const r=await fetch("https://api.openai.com/v1/models",{headers:{"Authorization":`Bearer ${key}`}});
   if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error?.message||"接続失敗")}
 }else if(p==="anthropic"){
   const model=$("anthropicModel").value;
   const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model,max_tokens:8,messages:[{role:"user",content:"Reply only OK"}]})});
   if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error?.message||"接続失敗")}
 }else{
   const model=encodeURIComponent($("geminiModel").value);
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:"Reply only OK"}]}]})});
   if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error?.message||"接続失敗")}
 }
 return true;
}
document.querySelectorAll(".testkey").forEach(b=>b.onclick=async()=>{
 b.disabled=true;const old=b.textContent;b.textContent="確認中…";
 try{await testProvider(b.dataset.provider);toast("接続できました")}
 catch(e){toast("接続失敗: "+e.message)}
 finally{b.disabled=false;b.textContent=old}
});


function selectedModelForProvider(provider){
  const id = provider==="openai" ? "openaiModel" : provider==="anthropic" ? "anthropicModel" : "geminiModel";
  const el=$(id);
  const raw=String(el?.value||"").trim();
  const fallback=String(el?.defaultValue||"").trim();
  // Provider model IDs are ASCII identifiers. Japanese sentence/chunk text here means
  // the browser has incorrectly autofilled the model field.
  const looksLikeModel=/^[A-Za-z0-9][A-Za-z0-9._:\/-]*$/.test(raw);
  const prefixOK = provider==="openai" ? /^(gpt|o\d|chatgpt|ft:)/i.test(raw)
                 : provider==="anthropic" ? /^claude-/i.test(raw)
                 : /^gemini-/i.test(raw);
  if(looksLikeModel && prefixOK) return raw;
  if(el && fallback){
    el.value=fallback;
    console.warn(`モデル欄に不正な値「${raw}」が入っていたため ${fallback} に復元しました。`);
    return fallback;
  }
  throw new Error(`モデル名が不正です: ${raw||"(空)"}`);
}

$("translateBtn").onclick=async()=>{
 const input=$("inputText").value.trim();if(!input)return toast("入力してください");
 const provider=$("provider").value;$("translateBtn").disabled=true;$("translateBtn").textContent="解析中…";
 try{
   let data;
   if(provider==="rule") data=ruleTranslate(input);
   else{
     const model=selectedModelForProvider(provider);
     data=await aiTranslate(provider,model,input);
     LAST_TRANSLATION=data;LAST_PROVIDER=provider;LAST_MODEL=model;renderExplanation(null);
   }
   $("outputText").textContent=data.translation||"(翻訳結果なし)";$("outputText").classList.remove("empty");renderAnalysis(data);
 }catch(e){$("outputText").textContent="エラー: "+e.message;$("outputText").classList.remove("empty");setPipelineStatus("エラー",0,1)}
 finally{$("translateBtn").disabled=false;$("translateBtn").innerHTML='翻訳する <span>→</span>'}
};

$("analyzeBtn").onclick=()=>{
 const a=analyzeFumezuaq($("analyzeInput").value);$("morphResult").innerHTML=a.map(x=>`<div class="morph"><div class="surface">${esc(x.surface)}</div><div class="meaning">${esc(x.meaning)}</div><div class="meta">${esc(x.kind||"")} · ${esc(x.zone||"?")} · ${esc(x.id||"未登録")}</div></div>`).join("");
};

function renderDict(){
 const q=norm($("dictSearch").value),z=$("dictZone").value,k=$("dictKind").value;
 const a=DICT.filter(e=>(!z||e.zone===z)&&(!k||e.kind===k)&&(!q||norm([e.id,e.form,e.meaning,e.large,e.middle,e.kind,e.note,(e.keywords||[]).join(" ")].join(" ")).includes(q))).slice(0,1200);
 $("dictCount").textContent=`${a.length} / ${DICT.length} 項目`;
 $("dictList").innerHTML=a.map(e=>`<article class="dict-item"><div class="form">${esc(e.form)}</div><div class="jp">${esc(e.meaning)}</div><div class="mini">${esc(e.id)} · ${esc(e.kind)} · ${esc(e.zone)} / ${esc(e.large||"—")} ${e.status==="候補"?'<span class="candidate">· 候補</span>':""}</div></article>`).join("");
}
["dictSearch","dictZone","dictKind"].forEach(id=>$(id).addEventListener(id==="dictSearch"?"input":"change",renderDict));

document.addEventListener("DOMContentLoaded",()=>{
 const b=document.getElementById("explainBtn");
 if(b)b.addEventListener("click",requestExplanation);
 renderExplanation(null);
});
