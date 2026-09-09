
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

function relevantEntries(input){
 const q=norm(input);
 let scored=DICT.map(e=>{
   let s=0, m=norm(e.meaning), f=norm(e.form);
   if(q.includes(m)&&m.length>0)s+=8+m.length;
   for(const part of (e.meaning||"").split(/[・\/（）(),、\s]+/)){let p=norm(part);if(p.length>=1&&q.includes(p))s+=3+p.length}
   if(q.includes(f)&&f.length>1)s+=10;
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
 (data.warnings||[]).map(w=>`<article class="analysis-card"><h4>注意</h4><p>${esc(w)}</p></article>`).join("");
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

function buildPrompt({direction,input,relevant}){
 const dictionary=(relevant||[]).map(e=>`${e.id}\t${e.zone}\t${e.form}\t${e.meaning}\t${e.large||""}/${e.middle||""}`).join("\n");
 return `あなたは人工言語 fumezuaq 専用の翻訳解析器です。
以下の仕様を厳守してください。

${GRAMMAR}

今回参照してよい辞書候補:
${dictionary || "(候補なし)"}

方向: ${direction==="ja2fu"?"日本語 → fumezuaq":"fumezuaq → 日本語"}
入力:
${input}

重要:
- 辞書にない語根・接辞を既存語のように捏造しない。
- 必要概念が欠落していれば warnings へ書く。
- fumezuaq出力では、意味塊ごとに適切に分離し、一文全体を無理に一語化しない。
- 大分類接辞は同一大分類につき一語内一回。
- 可能なら chunks の zone を S/R/D/ROOT/E/K/C のいずれかで示す。
- 日本語→fumezuaqで厳密な翻訳不能なら、最善の暫定形を出しつつ warnings で不足を明記する。

次のJSONのみを返してください:
{"translation":"翻訳結果","chunks":[{"surface":"fumezuaq側の語または意味塊","meaning":"日本語での意味","zone":"S/R/D/ROOT/E/K/C/複合","note":"簡潔な説明"}],"warnings":["不足や曖昧性"]}`;
}
function parseJsonLoose(t){
 const s=t.indexOf("{"),e=t.lastIndexOf("}"); if(s<0||e<s)throw new Error("AIのJSONを解析できませんでした");
 return JSON.parse(t.slice(s,e+1));
}
async function aiTranslate(provider,model,input){
 const c=KEYCFG[provider],key=$(c.input).value.trim(); if(!key)throw new Error(`${provider} のAPIキーをAI設定で入力してください`);
 const prompt=buildPrompt({direction,input,relevant:relevantEntries(input)});
 if(provider==="openai"){
   const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:model||"gpt-5",input:prompt})});
   const j=await r.json(); if(!r.ok)throw new Error(j.error?.message||"OpenAI API error");
   const text=j.output?.flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n")||j.output_text||"";
   return parseJsonLoose(text);
 }
 if(provider==="anthropic"){
   const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model:model||"claude-opus-5",max_tokens:3000,messages:[{role:"user",content:prompt}]})});
   const j=await r.json(); if(!r.ok)throw new Error(j.error?.message||"Anthropic API error");
   return parseJsonLoose((j.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n"));
 }
 if(provider==="gemini"){
   const mdl=encodeURIComponent(model||"gemini-3.8-flash");
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
   const j=await r.json(); if(!r.ok)throw new Error(j.error?.message||"Gemini API error");
   return parseJsonLoose(j.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("\n")||"");
 }
 throw new Error("不明なAIプロバイダーです");
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
 }catch(e){$("outputText").textContent="エラー: "+e.message;$("outputText").classList.remove("empty")}
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
