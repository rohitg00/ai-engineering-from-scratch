---
name: skill-prompt-patterns
description: タスク種別、信頼性要件、対象モデルに基づいて適切なプロンプトパターンを選ぶための判断フレームワーク
version: 1.0.0
phase: 11
lesson: 01
tags: [prompt-engineering, patterns, llm, temperature, cross-model, few-shot, chain-of-thought]
---

# プロンプトパターン選択ガイド

LLM を使った機能を作るときは、プロンプトを書く前にプロンプトパターンを選びます。パターンが構造を決め、内容はそこに流し込みます。

## パターン判断マトリクス

| Task Type | Primary Pattern | Secondary Pattern | Temperature | Few-Shot Needed? |
|-----------|----------------|-------------------|-------------|-----------------|
| Data extraction | Template Fill | Few-Shot | 0.0 | Yes (2-3 examples) |
| Classification | Few-Shot | Guardrail | 0.0 | Yes (3-5 examples) |
| Summarization | Persona + Template | Audience Adapt | 0.3 | No |
| Code generation | Persona | Chain-of-Thought | 0.0 | Optional |
| Creative writing | Persona | Critique | 0.7-1.0 | No |
| Multi-step reasoning | Chain-of-Thought | Decomposition | 0.3 | Optional |
| Question answering | Persona + Guardrail | Boundary | 0.3 | No |
| Prompt generation | Meta-Prompt | Critique | 0.7 | Yes (1-2 examples) |
| Content moderation | Guardrail + Boundary | Few-Shot | 0.0 | Yes (5+ examples) |
| Translation/adaptation | Audience Adapt | Few-Shot | 0.3 | Yes (2-3 examples) |

## 各パターンを使う場面

**Persona Pattern**: すべてのプロンプトの土台として使います。論点はロールをどこまで具体化するかだけです。汎用タスクなら広いロールで十分です。ドメイン固有タスクでは、ドメイン、熟練度、文脈をロールに含めます。

**Few-Shot Pattern**: 内容より出力形式が重要なときに使います。特定の JSON 形状、CSV 形式、分類ラベルを出したい場合、説明より例のほうが効果的です。目安は、単純な形式なら 2-3 例、複雑または曖昧な形式なら 5 例以上です。

**Chain-of-Thought Pattern**: 数学、論理、多段階分析、モデルに「途中式」を示させたいタスクで使います。推論タスクでは精度を 10-40% 改善します (Wei et al., 2022)。単純な事実検索や抽出には使わないでください。トークンを浪費します。

**Template Fill Pattern**: すべての出力を同じ形にしたい構造化抽出で使います。temperature=0.0 と、欠損フィールドに対する明示的な `N/A` 処理と相性がよいです。

**Critique Pattern**: 速度より品質が重要なときに使います。モデルが生成し、批評し、改善します。トークンコストはおよそ 2 倍になりますが、正確性と網羅性が大きく改善します。レポート、推奨、公開向けコンテンツなど高リスク出力に向きます。

**Guardrail Pattern**: ユーザー向けシステムでは必ず使います。含めるものは、スコープ境界、スコープ外要求への拒否動作、明示的な「わからない」処理です。アプリケーション側の入力検証と組み合わせます。

**Meta-Prompt Pattern**: 新しいタスク用のプロンプトを生成するときに使います。ゼロから書く代わりにタスクを説明し、モデルにプロンプトを書かせます。その後、テストして反復します。初期プロンプト開発の時間を節約できます。

**Decomposition Pattern**: 分割統治が効く複雑な問題で使います。モデルが問題を分解し、各部分を解き、統合します。3-7 個のサブ問題を持つタスクで最も有効です。

**Audience Adaptation Pattern**: 同じ内容を異なる読者に合わせる必要があるときに使います。読者を明示してください。文脈からモデルに推測させないでください。

**Boundary Pattern**: 絶対に答えてはいけない種類の質問がある本番システムで使います。正確な拒否メッセージ付きの厳密なスコープを定義するため、通常のガードレールより強力です。コンプライアンスが重要な領域では必須です。

## モデル横断の互換性

GPT-4o、Claude 3.5 Sonnet、Gemini 1.5 Pro、Llama 3 で一貫して機能する度合いによるランキングです。

| Pattern | Cross-Model Consistency | Notes |
|---------|------------------------|-------|
| Few-Shot | Very high | 例はすべてのモデルに移植しやすい |
| Template Fill | Very high | 明示的な構造により差異が出にくい |
| Chain-of-Thought | High | 主要モデルはすべて「think step by step」に対応する |
| Persona | High | どこでも効くが、モデルごとに最適な具体度は異なる |
| Guardrail | Moderate | Claude は最も厳密に従う。GPT-4o は長い会話で逸れることがある |
| Critique | Moderate | 自己批評の品質はモデル差が大きい |
| Meta-Prompt | Moderate | GPT-4o と Claude は異なるプロンプトスタイルを生成する |
| Boundary | Low-Moderate | 拒否動作はばらつくためモデルごとにテストする |

## よくある間違い

1. **何にでも Chain-of-Thought を使う**: CoT はトークンとレイテンシを増やします。推論ステップが必要なときだけ使います。
2. **制約が多すぎる**: 5-7 個を超える制約は落とされ始めます。最重要の 3 個を優先してください。
3. **ペルソナと制約が矛盾している**: 「創造的な作家」かつ「比喩を絶対に使わない」はモデルを混乱させます。
4. **temperature を指定しない**: 決定的な出力が必要なのにデフォルト (多くは 1.0) のままにする失敗です。
5. **モデル間でプロンプトをそのままコピーする**: 必ずテストします。GPT-4o 用に調整したプロンプトが Claude で劣ることも、その逆もあります。
6. **system message を無視する**: 継続的なルールを system message に置かず、すべて user message に入れてしまう失敗です。
7. **否定制約に頼りすぎる**: 「X, Y, Z, A, B, C をしない」より「W だけをする」のほうが明確な目標になります。

## 信頼性目標

| Use Case | Pattern Combination | Expected Accuracy | Token Cost |
|----------|-------------------|-------------------|------------|
| Production extraction | Template + Few-Shot | 95%+ | Low (500-1K) |
| User-facing Q&A | Persona + Guardrail + Boundary | 90%+ | Medium (1-2K) |
| Code generation | Persona + Chain-of-Thought | 85%+ | Medium (1-3K) |
| Content generation | Persona + Critique | 90%+ quality | High (2-4K, double pass) |
| Classification | Few-Shot + Guardrail | 95%+ | Low (300-800) |
| Complex analysis | Decomposition + Chain-of-Thought | 85%+ | High (3-5K) |
