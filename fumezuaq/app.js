
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
function semanticPrompt(input){return `あなたはfumezuaqの意味解析器です。まだ翻訳しないでください。\n${GRAMMAR}\n入力:${input}\nJSONのみ: {"chunks":[{"jp":"","center":"","concepts":[],"zones":[],"relations":[]}],"required_domains":[],"lexical_needs":[]}`;}
function buildCandidates(input,sem){let rel=relevantEntries(input+" "+JSON.stringify(sem));for(const d of sem.required_domains||[]){const p=String(d).match(/^[SRDEKC]\d+/)?.[0];if(p)rel.push(...DICT.filter(e=>String(e.id||"").startsWith(p)));}rel.push(...DICT.filter(e=>/まで|期限|朝|条件|なら|三人称|単数|方向|可能|推量|過去|継続|引用/.test((e.meaning||"")+" "+(e.keywords||[]).join(" "))));return relevantDedup(rel).slice(0,300).map(compactEntry);}
function resolvePrompt(input,sem,cands){return `あなたはfumezuaq辞書照合器です。最終文はまだ作らないでください。\n${GRAMMAR}\n原文:${input}\n意味解析:${JSON.stringify(sem)}\n辞書候補:${JSON.stringify(cands)}\n各概念を既存辞書へ対応付け、新造は禁止。辞書にあるものをunknownにしない。JSONのみ: {"resolved":[{"concept":"","id":"","form":"","meaning":"","zone":"","alternatives":[]}],"unresolved":[]}`;}
function generatePrompt(input,sem,res){return `あなたはfumezuaq構文生成器です。\n${GRAMMAR}\n原文:${input}\n意味解析:${JSON.stringify(sem)}\n辞書照合:${JSON.stringify(res)}\n一語一中心語根、S-R-D-ROOT-E-K-C、同一大分類一回、辞書外新造禁止。JSONのみ: {"translation":"","chunks":[{"surface":"","meaning":"","zone":"複合","used_ids":[],"note":""}],"warnings":[]}`;}
function rescueSet(draft){const terms=[...(draft.warnings||[])];const raw=JSON.stringify(draft);for(const m of raw.matchAll(/unknown[^=:：]*[=:：]?\s*([^"\],}]+)/gi))terms.push(m[1]);let list=[];for(const t of terms){const bits=String(t).split(/[・\/／\s「」『』（）()]+/).filter(Boolean);for(const e of DICT){const hay=[e.meaning,(e.keywords||[]).join(" "),e.large,e.middle].join(" ");if(bits.some(b=>b&&hay.includes(b)))list.push(e);}}list.push(...DICT.filter(e=>/まで|期限|朝|条件|なら|三人称|単数|方向|可能|推量|過去|継続|引用/.test((e.meaning||"")+" "+(e.keywords||[]).join(" "))));return relevantDedup(list).slice(0,180).map(compactEntry);}
function verifyPrompt(input,draft,rescue){return `あなたはfumezuaq最終検証器です。\n${GRAMMAR}\n原文:${input}\n暫定:${JSON.stringify(draft)}\n再検索候補:${JSON.stringify(rescue)}\nunknownを再検査し、既存辞書で置換できるなら必ず置換。条件をE扱いする等の領域誤りも修正。辞書外新造禁止。JSONのみ: {"translation":"","chunks":[{"surface":"","meaning":"","zone":"複合","note":""}],"warnings":[]}`;}
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
   final._debug={candidateCount:cands.length,fallback:false};
   setPipelineStatus("完了",4,4);
   return final;
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
