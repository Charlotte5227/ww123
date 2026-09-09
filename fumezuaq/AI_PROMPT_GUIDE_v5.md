# fumezuaq Translator v5 AI Prompt Guide

この文書と `public/prompts.js` は **言語仕様書ではありません**。
既存のfumezuaq仕様・辞書をAIが正しく利用するためのプロンプト指示です。

## 編集方針
- AIの判断順序・禁止事項・工程責任を変える: `public/prompts.js`
- UI・翻訳パイプライン・validator・compilerを変える: `public/app.js`
- 言語そのものの文法・辞書を変える: 仕様/辞書データ側

## v5の意味塊
- AI自動: AIが意味塊を推定。
- AI提案→編集: AI案をユーザーが修正して確定。
- 完全手動: ユーザーが最初から確定。
- ユーザー確定後はAIによる再分割・再結合は禁止。
