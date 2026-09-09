
let DICT=[], GRAMMAR="";
const STRICT_CONTRACT=`
【ハルシネーション禁止契約】
- 文法書・辞書にない規則を追加・一般化・推測しない。
- 「一語一中心語根」は「一語一語根」ではない。中心語根は1つだが修飾語根・参与者語根は同一語内に置ける。
- 複数語根があることだけを理由に分割しない。
- 分割後の塊が単独で意味的に成立しないなら分割せず、可能なら中心語根へ再吸収する。
- humeq「人」を私・あなた・彼・彼女などの代名詞の台座にしない。
- 辞書ID/form/meaning/zone/large/middleを推測・改変しない。不明ならunresolved。
- 辞書外の形を正式形として生成しない。
- AIは規則制定者ではなく候補生成器である。
- 仕様書に明記されていない一般則を新たに導出して翻訳判断へ使用してはならない。
- 「独立意味塊には必ず中心語根が必要」という規則は存在しない。時間・場所・条件等は十分に限定されれば語彙的中心語根なしでも独立意味塊になり得る。
- 「明日の。」は不十分でも「明日の朝まで。」は独立した時間指定意味塊として成立可能。
- 必要な辞書項目が見つからない場合、近い項目へ意味を勝手に統合・拡張してはならない。必ず unresolved とする。
- 辞書項目の意味を文脈都合で増やしてはならない。例: 「朝」に「明日」の意味を含めない。
- 不明→unresolved、不足→unresolved、仕様矛盾→validator error。推測による穴埋めは禁止。
`;
const $=id=>document.getElementById(id);
const norm=s=>(s||"").normalize("NFKC").toLowerCase().replace(/[‐‑‒–—―ー_\s]/g,"");
const esc=s=>(s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let direction="ja2fu";

Promise.all([fetch("dictionary.json").then(r=>r.json()),fetch("grammar.txt").then(r=>r.text())]).then(([d,g])=>{DICT=d;GRAMMAR=g;renderDict();});

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active")); b.classList.add("active");
 document.querySelectorAll(".view").forEach(x=>x.classList.remove("active")); $(b.dataset.view).classList.add("active");
});
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
 $("analysisCards").innerHTML = c.map(x=>`<article class="analysis-card"><h4>${esc(x.surface||x.form||"意味塊")}</h4><p>${esc(x.meaning||"")}</p><div class="zones">${["S","R","D","ROOT","E","K","C"].map(z=>`<span class="zone ${x.zone===z?"hit":""}">${z}</span>`).join("")}</div>${x.note?`<p style="margin-top:10px">${esc(x.note)}</p>`:""}</article>`).join("") +
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
function semanticPrompt(input){return `あなたは人工言語 fumezuaq の日本語意味解析器です。まだ翻訳してはいけません。
${GRAMMAR}
${STRICT_CONTRACT}
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
function buildCandidates(input,sem){let rel=relevantEntries(input+" "+JSON.stringify(sem));for(const d of sem.required_domains||[]){const p=String(d).match(/^[SRDEKC]\d+/)?.[0];if(p)rel.push(...DICT.filter(e=>String(e.id||"").startsWith(p)));}rel.push(...DICT.filter(e=>/まで|期限|朝|条件|なら|三人称|単数|方向|可能|推量|過去|継続|引用/.test((e.meaning||"")+" "+(e.keywords||[]).join(" "))));return relevantDedup(rel).slice(0,300).map(compactEntry);}
function resolvePrompt(input,sem,cands){return `あなたはfumezuaq辞書照合器です。最終文はまだ作らないでください。\n${GRAMMAR}\n原文:${input}\n意味解析:${JSON.stringify(sem)}\n辞書候補:${JSON.stringify(cands)}\n各概念を既存辞書へ対応付け、新造は禁止。辞書にあるものをunknownにしない。JSONのみ: {"resolved":[{"concept":"","id":"","form":"","meaning":"","zone":"","alternatives":[]}],"unresolved":[]}`;}
function generatePrompt(input,sem,res){return `あなたはfumezuaq構文生成器です。
${GRAMMAR}
${STRICT_CONTRACT}
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
${STRICT_CONTRACT}
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
function validateTranslation(result,sem){
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
   if(sf==="wesamaq"&&/(雨|主体)/.test(mn))
     errors.push({code:"ORPHAN_RAIN",chunk:i,message:"雨だけが述語から孤立しています。「雨が止む」はtokuq中心への再吸収を検討してください"});
   if(/^keraq(?:-|$)/.test(sf)&&/山へ|方向/.test(mn)&&chunks.some(x=>/^waraq(?:-|$)/.test(String(x.surface||""))))
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
${STRICT_CONTRACT}
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
 return `あなたはfumezuaq翻訳の構造理由だけを説明します。
${GRAMMAR}
${STRICT_CONTRACT}
原文:${input}
確定翻訳:${JSON.stringify(result)}
意味解析:${JSON.stringify(sem||{})}
禁止: 辞書項目のform・meaning・分類を自分で説明しない。辞書事実はプログラムが表示する。「一語一語根」や「中心語根がない意味塊は自立不能」という規則を作らない。翻訳を変更しない。validator警告を新規規則で後付け正当化しない。
各chunkについて中心・吸収・分離を選んだ理由だけ説明。
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
 setPipelineStatus("意味解析",1,4);
 const sem=await runStage(provider,model,"意味解析",semanticPrompt(input),'{"chunks":[{"jp":"","center":"","concepts":[],"zones":[],"relations":[]}],"required_domains":[],"lexical_needs":[]}');

 const cands=buildCandidates(input,sem);
 setPipelineStatus("辞書照合",2,4);
 const resolved=await runStage(provider,model,"辞書照合",resolvePrompt(input,sem,cands),'{"resolved":[{"concept":"","id":"","form":"","meaning":"","zone":"","alternatives":[]}],"unresolved":[]}');

 setPipelineStatus("構文生成",3,4);
 const draft=await runStage(provider,model,"構文生成",generatePrompt(input,sem,resolved),'{"translation":"","chunks":[{"surface":"","meaning":"","zone":"複合","used_ids":[],"note":""}],"warnings":[]}');
 if(!String(draft.translation||"").trim()) throw new Error("構文生成段階で翻訳本文が空でした");

 setPipelineStatus("最終検証",4,4);
 try{
   const final=await runStage(provider,model,"最終検証",verifyPrompt(input,draft,rescueSet(draft)),'{"translation":"","chunks":[{"surface":"","meaning":"","zone":"複合","note":""}],"warnings":[]}');
   if(!String(final.translation||"").trim()) throw new Error("最終検証の翻訳本文が空でした");
   let checked=await validateAndRepair(provider,model,input,final,sem,resolved);
   checked._debug={candidateCount:cands.length,fallback:false,semantic:sem,resolved:resolved};
   setPipelineStatus("完了",5,5);
   return checked;
 }catch(finalErr){
   // The verifier is optional: never discard a valid generated translation.
   draft.warnings=[...(draft.warnings||[]),`最終検証を完了できなかったため、構文生成段階の訳を表示しています: ${finalErr.message}`];
   draft._debug={candidateCount:cands.length,fallback:true};
   setPipelineStatus("完了（暫定訳）",4,4);
   return draft;
 }
}
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

$("translateBtn").onclick=async()=>{
 const input=$("inputText").value.trim();if(!input)return toast("入力してください");
 const provider=$("provider").value;$("translateBtn").disabled=true;$("translateBtn").textContent="解析中…";
 try{
   let data;
   if(provider==="rule") data=ruleTranslate(input);
   else{
     const model=provider==="openai"?$("openaiModel").value:provider==="anthropic"?$("anthropicModel").value:$("geminiModel").value;
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
 const a=DICT.filter(e=>(!z||e.zone===z)&&(!k||e.kind===k)&&(!q||norm([e.id,e.form,e.meaning,e.large,e.middle].join(" ")).includes(q))).slice(0,1200);
 $("dictCount").textContent=`${a.length} / ${DICT.length} 項目`;
 $("dictList").innerHTML=a.map(e=>`<article class="dict-item"><div class="form">${esc(e.form)}</div><div class="jp">${esc(e.meaning)}</div><div class="mini">${esc(e.id)} · ${esc(e.kind)} · ${esc(e.zone)} / ${esc(e.large||"—")} ${e.status==="候補"?'<span class="candidate">· 候補</span>':""}</div></article>`).join("");
}
["dictSearch","dictZone","dictKind"].forEach(id=>$(id).addEventListener(id==="dictSearch"?"input":"change",renderDict));

document.addEventListener("DOMContentLoaded",()=>{
 const b=document.getElementById("explainBtn");
 if(b)b.addEventListener("click",requestExplanation);
 renderExplanation(null);
});
