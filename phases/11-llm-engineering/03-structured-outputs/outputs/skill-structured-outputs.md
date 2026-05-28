---
name: skill-structured-outputs
description: プロバイダー、信頼性、複雑さに基づいて適切な structured output 戦略を選ぶための判断フレームワーク
version: 1.0.0
phase: 11
lesson: 03
tags: [structured-output, json, schema, constrained-decoding, pydantic, function-calling]
---

# Structured Output 戦略

構造化データを必要とする LLM アプリケーションを作るときは、この判断フレームワークを適用します。

## 各アプローチを使う場面

**Prompt-based ("Return JSON")**: プロトタイプ専用です。たまの parse failure が許容できる内部ツールなら使えます。try/except と retry を追加してください。本番パイプラインでは使わないでください。

**JSON mode (API flag)**: 有効な JSON は保証したいが、schema が単純または柔軟でよい場合に使います。形状はアプリケーション側で検証します。OpenAI、Anthropic (tool use 経由)、Google で利用できます。

**Schema mode (constrained decoding)**: すべての出力が特定 schema に一致しなければならない本番システムで使います。parse failure はゼロ、schema violation もゼロです。本番の抽出または分類タスクではデフォルトで使います。OpenAI structured outputs、Outlines、Guidance で利用できます。

**Function calling / tool use:** モデルがパラメータを埋めるだけでなく、どの関数を呼ぶか選ぶ必要がある場合に使います。複数の schema があり、入力に応じてモデルが適切なものを選ぶケースです。既存の tool/function 基盤と統合する場合にも使います。

**Instructor library:** 任意のプロバイダーで Pydantic validation と automatic retry が欲しい場合に使います。Python プロジェクトでは最も開発体験がよい選択です。OpenAI、Anthropic、Google、open-source models をラップします。

## プロバイダー別ガイダンス

**OpenAI:** `json_schema` type の `response_format` を使います。constrained decoding が組み込まれています。Pydantic models を直接使えます。最も信頼性の高い structured output 実装です。

**Anthropic:** structured output には tool use を使います。目的の schema を持つ単一 tool を定義します。モデルは schema に一致する tool call arguments を返します。信頼できますが、tool use API パターンが必要です。

**Open-source models (vLLM, Ollama):** constrained decoding には Outlines または Guidance を使います。これらのライブラリは JSON Schemas を finite state machines にコンパイルし、生成中に無効な tokens を mask します。ローカル推論が必要です。

## Schema 設計ガイドライン

1. 可能なら schema は平坦に保ちます。2 階層を超える nested objects は抽出エラーを増やします。
2. カテゴリ値には enums を使います。モデルに正しい文字列を発明させないでください。
3. 曖昧なフィールドは optional ではなく、明示的な null support 付きで required にします。モデルに判断を強制します。
4. schema properties に descriptions を追加します。モデルはそれらを指示として読みます。
5. 必要がなければ union types (oneOf/anyOf) は避けます。decoding complexity が増えます。
6. 数値には minimum/maximum を設定します。極端な hallucinated values を捕捉できます。
7. arrays には minItems/maxItems を使い、空または無制限の出力を防ぎます。

## よくある失敗パターンと修正

- **モデルが JSON を markdown fences で囲む**: prompt-based から JSON mode または schema mode へ切り替える
- **schema-valid だが事実として誤り**: 抽出後に LLM-as-judge validation step を追加する
- **enum values が一貫しない**: constrained decoding に切り替えるか、post-processing normalization を追加する
- **optional fields が欠落する**: required にするか、アプリケーションコードで default values を追加する
- **抽出が非常に遅い**: constrained decoding は 5-15% の latency を追加するため、latency-sensitive なら schema complexity を下げる
- **多様な items を持つ large arrays**: 入力を chunk して chunk ごとに抽出し、結果を merge する

## 信頼性ラダー

| Approach | Parse Success | Schema Match | Setup Effort |
|----------|-------------|-------------|-------------|
| Prompt-based | ~90% | ~80% | 1 minute |
| JSON mode | 100% | ~90% | 5 minutes |
| Schema mode | 100% | ~99% | 15 minutes |
| Constrained decoding | 100% | 100% | 30 minutes |
| Instructor + retry | 100% | ~99.5% | 10 minutes |
