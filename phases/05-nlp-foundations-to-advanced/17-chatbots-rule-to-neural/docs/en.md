# チャットボット — ルールベースからニューラル、LLMエージェントへ

> ELIZAはパターンマッチで返答した。DialogFlowはインテントを対応付けた。GPTは重みから答えた。Claudeはツールを実行して検証する。どの時代も、前の時代で最も目立った失敗を解こうとしてきた。

**種別:** 学習
**言語:** Python
**前提:** Phase 5 · 13（Question Answering）、Phase 5 · 14（Information Retrieval）
**時間:** 約75分

## 問題

ユーザーが「フライトを変更したい」と言ったとします。システムは、ユーザーが何を望んでいるのか、どの情報が足りないのか、その情報をどう取得するのか、そして操作をどう完了するのかを判断しなければなりません。続けてユーザーが「待って、やっぱりキャンセルするなら？」と言ったら、システムは文脈を覚え、タスクを切り替え、状態を保つ必要があります。

会話はMLシステムにとって難しい問題です。入力は自由形式です。出力は複数ターンにわたって一貫していなければなりません。システムは現実世界に作用する必要があるかもしれません（フライトを変更する、カードに請求する）。そして誤った一手はすべてユーザーに見えます。

チャットボットのアーキテクチャは4つのパラダイムを巡ってきました。それぞれは、前の方式の失敗があまりに目立ったために導入されました。このレッスンではそれらを順に見ていきます。2026年の本番環境は、最後の2つを組み合わせたハイブリッドです。

## コンセプト

![チャットボットの進化: ルールベース → 検索 → ニューラル → エージェント](../assets/chatbot.svg)

**ルールベース（ELIZA、AIML、DialogFlow）。** 人手で書いたパターンをユーザー入力にマッチさせ、応答を生成します。インテント分類器は事前定義されたフローへルーティングします。スロットフィリング状態機械は必要情報を集めます。設計された狭い範囲では非常によく動きます。その外に出ると即座に失敗します。ハルシネーションが許されない安全重要領域（銀行の認証、航空券予約）では、今でも本番投入されています。

**検索ベース。** FAQ型のシステムです。（発話、応答）の各ペアをエンコードします。実行時にはユーザーのメッセージをエンコードし、保存済み応答の中から最も近いものを検索します。Zendeskの古典的な「類似記事」機能を思い浮かべてください。言い換えにはルールより強く、生成をしないためハルシネーションも起きません。

**ニューラル（seq2seq）。** 会話ログで学習したエンコーダーデコーダーです。応答をゼロから生成します。流暢ですが、汎用的な出力（"I don't know"）や事実のずれを起こしがちです。話題への追従も安定しません。Google、Facebook、Microsoftが2016-2019年に期待外れのチャットボットを出した理由です。

**LLMエージェント。** 計画し、ツールを呼び出し、結果を検証するループで言語モデルを包んだものです。長いプロンプトを持つチャットボットではありません。エージェントループは、計画 → ツール呼び出し → 結果観察 → 次の手の決定、という形を取ります。検索優先のグラウンディング（RAG）がハルシネーションを抑えます。ツール呼び出しにより、実際に何かを実行できます。これが2026年のアーキテクチャです。

4つのパラダイムは、単純な置き換えの列ではありません。2026年の本番チャットボットは4つすべてを通ります。認証と破壊的操作にはルールベース、FAQには検索、自然な言い回しにはニューラル生成、曖昧で自由度の高い問い合わせにはLLMエージェントを使います。

## 作ってみる

### Step 1: ルールベースのパターンマッチング

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

20行のELIZAです。反射のトリック（"I feel sad" → "Why do you feel sad"）は、Weizenbaum 1966の標準的な心理療法士デモです。今でも学ぶ価値があります。

### Step 2: 検索ベース（FAQ）

この説明用スニペットには `pip install sentence-transformers` が必要です（torchも入ります）。このレッスンの実行可能な `code/main.py` では代わりに標準ライブラリによるJaccard類似度を使っているため、外部依存なしで動きます。

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

しきい値に基づく拒否が重要な設計判断です。最良一致が十分に近くなければ `None` を返し、システムにエスカレーションさせます。

### Step 3: ニューラル生成（ベースライン）

小さなinstruction-tunedエンコーダーデコーダー（FLAN-T5）か、ファインチューニング済みの会話モデルを使います。2026年時点では単体で本番利用できるものではありません（矛盾、話題逸脱、事実として意味をなさない出力があるため）が、自然な言い回しを作る部品としてハイブリッドシステム内で使われます。DialoGPT型のdecoder-onlyモデルで一貫した返信を出すには、明示的なターン区切りとEOS処理が必要です。FLAN-T5のtext2text pipelineなら、教育用の例としてはそのまま動きます。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Step 4: LLMエージェントループ

2026年の本番形は次のようになります。

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

押さえるべき点は3つあります。ツールはLLMが呼び出せる関数です。LLMがツール呼び出しではなく最終回答を返すと、ループは終了します。ステップ予算は、曖昧なタスクで無限ループするのを防ぎます。

実際の本番では、検索優先のグラウンディング（各LLM呼び出し前に関連ドキュメントを注入する）、ガードレール（確認なしの破壊的操作を拒否する）、可観測性（全ステップをログに残す）、評価（エージェントの振る舞いが仕様から外れていないかを自動チェックする）が追加されます。

### Step 5: ハイブリッドルーティング

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

パターンは、破壊的なものには決定的ルール、定型FAQには検索、それ以外にはLLMエージェントです。2026年のカスタマーサポートシステムではこれが本番投入されています。

## 使ってみる

2026年のスタックは次のとおりです。

| ユースケース | アーキテクチャ |
|---------|---------------|
| 予約、支払い、認証 | ルールベース状態機械 + スロットフィリング |
| カスタマーサポートFAQ | 精選された回答に対する検索 |
| 自由度の高いヘルプチャット | RAG + ツール呼び出しを備えたLLMエージェント |
| 社内ツール / IDEアシスタント | ツール呼び出し（検索、読み取り、書き込み）を備えたLLMエージェント |
| コンパニオン / キャラクターチャットボット | ペルソナsystem promptを持つチューニング済みLLM、知識に対する検索 |

本番では必ずハイブリッドルーティングを使います。すべてのリクエストをうまく扱える単一アーキテクチャはありません。ルーティング層自体は通常、小さなインテント分類器です。

## それでも本番に入り込む失敗モード

- **自信ありげな捏造。** LLMエージェントが、実際には完了していない操作を完了したと主張します。緩和策: 結果を検証する、ツール呼び出しをログに残す、成功したツール戻り値なしにLLMが「実行した」と主張できないようにする。
- **プロンプトインジェクション。** ユーザーがsystem promptを上書きするテキストを挿入します。OWASP Top 10 for LLM Applications 2025ではLLM01にランクされています。直接インジェクション（チャットに貼り付けられる）と間接インジェクション（エージェントが読む文書、メール、ツール出力に隠される）の2種類があります。

  攻撃成功率はシナリオによって異なります。一般的なツール利用・コーディングベンチマークでは、フロンティアモデル全体で測定成功率が約0.5-8.5%です。特定の高リスク構成（AIコーディングエージェントに対する適応的攻撃、脆弱なオーケストレーション）では約84%に達しています。本番のCVEにはEchoLeak（CVE-2025-32711、CVSS 9.3）があります。これはMicrosoft 365 Copilotにおけるゼロクリックのデータ流出欠陥で、攻撃者が制御するメールによって発火します。

  緩和策: ループ全体でユーザー入力を信頼しないものとして扱う。ツール呼び出し前にサニタイズする。ツール出力をメインプロンプトから分離する。Plan-Verify-Execute（PVE）パターンを使い、エージェントがまず計画し、実行前に各アクションをその計画と照合する（これにより、ツール結果が予定外の新しいアクションを注入するのを防ぐ）。破壊的操作にはユーザー確認を必須にする。ツールスコープに最小権限を適用する。

  どれほどプロンプトエンジニアリングをしても、このリスクを完全には消せません。外部のランタイム防御層（LLM Guard、allowlist検証、意味的異常検知）が必要です。
- **スコープクリープ。** ツール呼び出しが周辺的に関連する情報を返したことで、エージェントが本来のタスクから外れます。緩和策: ツール契約を狭くする。system promptを絞る。脱線率の評価を追加する。
- **無限ループ。** エージェントが同じツールを呼び続けます。緩和策: ステップ予算、ツール呼び出しの重複排除、「進捗しているか」を判定するLLM judge。
- **コンテキストウィンドウの枯渇。** 長い会話で最初のターンがコンテキスト外に押し出されます。緩和策: 古いターンを要約する、類似度で関連する過去ターンを検索する、または長コンテキストモデルを使う。

## 仕上げ

`outputs/skill-chatbot-architect.md` として保存します。

```markdown
---
name: chatbot-architect
description: 指定されたユースケース向けのチャットボット構成を設計する。
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

プロダクトの文脈（ユーザーのニーズ、コンプライアンス制約、利用可能なツール、データ量）が与えられたら、次を出力する。

1. アーキテクチャ。ルールベース、検索、ニューラル、LLMエージェント、またはハイブリッド（どの経路をどこに流すかを明記する）。
2. 該当する場合はLLMの選定。モデルファミリー（Claude、GPT-4、Llama-3.1、Mixtral）を挙げる。ツール利用品質とコストに合わせる。
3. グラウンディング戦略。RAGのソース、検索手法（lesson 14を参照）、ツール契約。
4. 評価計画。タスク成功率、ツール呼び出しの正確性、脱線率、評価用に取り分けた対話でのハルシネーション率。

構造化された確認フローなしに、破壊的操作（支払い、アカウント削除、データ変更）へ純粋なLLMエージェントを推奨してはいけない。エージェントが何らかの書き込み権限を持つ場合は、プロンプトインジェクション監査の省略を拒否する。
```

## 演習

1. **Easy.** 上のルールベース応答を、コーヒーショップ注文ボット向けに10個のパターンで実装してください。二重注文、変更、キャンセル、不明確なインテントといったエッジケースをテストします。
2. **Medium.** FAQ + LLMフォールバックのハイブリッドを作ってください。SaaSプロダクト向けに50件の定型FAQを用意し、ドキュメントサイト検索付きのLLMフォールバックを追加します。実際のサポート質問100件で拒否率と精度を測定します。
3. **Hard.** 上のエージェントループを、3つのツール（search、read-user-data、send-email）で実装してください。プロンプトインジェクション試行を含む50件のテストシナリオで評価を実行します。脱線率、タスク失敗率、インジェクション成功の有無を報告してください。

## 重要用語

| 用語 | 一般に言うこと | 実際の意味 |
|------|-----------------|-----------------------|
| Intent | ユーザーが望むこと | カテゴリラベル（book_flight、reset_password）。ハンドラーへルーティングされる。 |
| Slot | 情報の一部 | ボットが必要とするパラメータ（日付、目的地）。スロットフィリングは質問の連続。 |
| RAG | 検索 + 生成 | 関連ドキュメントを検索し、その上にLLMの応答をグラウンディングする。 |
| Tool call | 関数呼び出し | LLMがname + argsを持つ構造化呼び出しを出す。ランタイムが実行し、結果を返す。 |
| Agent loop | 計画、行動、検証 | タスク完了までLLM呼び出しとツール呼び出しを交互に実行するコントローラー。 |
| Prompt injection | ユーザーがpromptを攻撃する | system promptを上書きしようとする悪意ある入力。 |

## 参考文献

- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) — 元祖ルールベースチャットボットの論文。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) — LLMエージェントが主流になる直前の、Googleによる後期ニューラルチャットボット論文。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — エージェントループパターンに名前を与えた論文。
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) — 2026年でも有効な、2024年の本番向けガイダンス。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) — プロンプトインジェクションの論文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — プロンプトインジェクションを最上位のセキュリティ懸念として位置付けたランキング。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) — Plan-Verify-Executeやユーザー確認フローを含む、実用的なオーケストレーション層防御。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) — 間接プロンプトインジェクションによる代表的なゼロクリックデータ流出CVE。書き込み権限を持つエージェントにランタイム防御が必要な理由を示す参照事例。
