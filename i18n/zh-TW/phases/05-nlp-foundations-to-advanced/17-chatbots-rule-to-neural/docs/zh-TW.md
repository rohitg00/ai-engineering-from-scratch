# 聊天機器人——從規則到神經到 agent

> ELIZA 用模式相符來回。DialogFlow 把意圖對上。GPT 從權重回答。Claude 跑工具並驗證。每個時代都解決了前一個時代最糟的失敗。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## The Problem｜問題

使用者說「I want to change my flight.」。系統得弄清他們要什麼、缺哪些資訊、怎麼拿到、怎麼把動作做完。接著使用者說「wait, what if I cancel instead?」，系統得記住脈絡（context）、切換任務、保住狀態。

對話對機器學習系統很難。輸入是開放的。輸出要在很多輪之後仍連貫。系統可能得對世界做事（改航班、刷卡扣款）。每一步錯，使用者都看得到。

聊天機器人的架構循環過四種典範，每一種都是因為前一種失敗得太明顯才出現。這一課依序走一遍。2026 年的正式環境（production）樣貌，是後兩者的混合。

## The Concept｜核心概念

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### 寫腳本的半個世紀，1950–2001

第一種典範不是只活五年。它活了五十年。了解它的發展歷程很重要，因為裡面每個系統都是同一台機器——比對輸入、吐出制式回應、更新一點狀態——五十年不斷加規則，從未做出普遍情況。那個上限就是第二到第四種典範存在的原因。

**1950。** Turing 繞開「機器會思考嗎？」，提出一個可操作的替代：若詢問者透過電傳打字分不出機器和人，那個哲學問題就不再有意義。對話在這個領域有名字之前，就成了它的評測。

**1956。** 人工智慧一詞由達特茅斯夏季研討會提出；提案預期兩個月內能取得重大進展——達特茅斯的夏季工作坊造出「人工智慧（artificial intelligence）」，猜想是智力的每個特徵「原則上可以被描述得夠精確，讓機器能夠模擬它」。

**1966。** ELIZA 交付了你在步驟 1 會做的反射技巧：分解規則從輸入抽出片段，重組規則把它們回聲成問題。總共大約 200 個模式，零狀態、零理解——使用者還是對它傾訴。Weizenbaum 餘生都對「只靠這麼少的機制就能做到」感到警惕。

**1972。** 史丹佛做來模擬偏執的 PARRY，補上 ELIZA 缺的那塊：內部狀態。恐懼、憤怒、不信任的數值變數每一輪都更新，並決定下一輪觸發哪支腳本，所以相同輸入會因到目前為止的對話而給出不同回應。在盲測逐字稿裡，精神科醫師分辨 PARRY 和人類病人的表現和隨機猜一樣。它是人格條件化的直接祖先——用三個浮點數實作的 system prompt。同一年，兩個機器人在 ARPANET 上對接：治療師腳本訪問一個偏執狀態機，網路上第一次機器人對機器人的對話。

**1995。** ALICE 用 AIML 把 ELIZA 的配方放大。AIML 是給模式–模板對用的 XML 方言。大約 4 萬個手寫類別，拿過三次 Loebner Prize。它證明了規則系統的縮放規律：規則越多，覆蓋越廣，永遠換不到普遍性。每一條規則都是某人必須維護的負擔。

**2001。** SmarterChild 把這套配方放到 3000 萬即時通訊使用者面前，並加上後端查詢——天氣、股價、電影時刻——接進模板。瞇眼看，就是穿著 2001 年戲服的工具呼叫：解析意圖、呼叫服務、把結果渲染進回覆。

五十年，一種機制，規則數往上爬。這個典範結束，不是因為有人證明它錯，而是因為手寫狀態機的維護成本隨覆蓋線性成長，使用者的期待卻跟著他們上週看到的東西長。

```figure
chatbot-lineage
```

**規則式（ELIZA、AIML、DialogFlow）。** 手寫的模式比對使用者輸入並產出回應。意圖（intent）分類器（classifier）把請求路由到預先定義的流程。槽位填充的狀態機收集必要資訊。在設計好的窄範圍裡非常好用。一出範圍立刻失敗。在不容忍幻覺（hallucination）的安全關鍵領域（銀行驗證、機票訂位）仍會交付。

**檢索式。** FAQ 式的系統。把每一對（話語，回應）編碼。執行時把使用者訊息編碼，檢索最近的已存回應。想想 Zendesk 經典的「相似文章」。比規則更能處理改寫。沒有生成，所以沒有幻覺。

**神經（seq2seq）。** 在對話紀錄上訓練的編碼器–解碼器。從零生成回應。流暢，但容易給出泛泛的輸出（「I don't know」）和事實漂移。也無法穩定切合主題。這是 Google、Facebook、Microsoft 在 2016 到 2019 年的聊天機器人都令人失望的原因。

**LLM agent。** 包在迴圈裡的語言模型，會規劃、呼叫工具、驗證結果。不是一條很長 prompt 的聊天機器人。是 LLM agent：規劃 → 呼叫工具 → 觀察結果 → 決定下一步。先檢索、再以檢索到的文件作為依據（grounding，即 RAG）讓它不幻覺。工具呼叫讓它真的做事。這是 2026 年的架構。

這四種典範不是依序取代。2026 年正式環境的聊天機器人四條都走：規則處理驗證和破壞性動作，檢索處理 FAQ，神經生成處理自然說法，agent 處理含糊的開放查詢。

## Build It｜動手實作

### 步驟 1：規則式的模式比對

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

20 行的 ELIZA。反射技巧（「I feel sad」→「Why do you feel sad」）是 Weizenbaum 1966 的標準心理治療示範。現在仍有教學價值。

### 步驟 2：檢索式（FAQ）

這段示意需要 `pip install sentence-transformers`（會帶進 torch）。本課可執行的 `code/main.py` 改用標準函式庫（library）的 Jaccard 相似度，所以不靠外部依賴也能跑。

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

基於閾值的拒答是關鍵設計。最佳結果的相似度未達門檻，就回 `None`，讓系統升級處理。

### 步驟 3：神經生成（基準模型，baseline）

用小型、做過 instruction tuning 的編碼器–解碼器（FLAN-T5），或 fine-tune 過的對話模型。2026 年單獨使用無法上正式環境（自相矛盾、離題漂移、事實胡說），但在混合系統裡會為了自然說法而交付。DialoGPT 風格、只有解碼器的模型需要明確的輪次分隔和 EOS 處理，才生得出連貫回覆；FLAN-T5 的 text2text 管線（pipeline）拿來教學，開箱就能用。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 步驟 4：agent 迴圈

2026 年正式環境的形狀：

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

三件事要點名。工具是大型語言模型可以呼叫的函式。迴圈在模型回最終答案、而不是工具呼叫時結束。步數預算防止含糊任務上的無限迴圈。

正式環境還會加：每次呼叫模型前先注入相關文件，以檢索到的文件作為依據（grounding）、護欄（破壞性動作沒確認就拒絕）、可觀測性（每一步都記下來）、評估（自動檢查 agent 行為有沒有偏離規格）。

### 步驟 5：混合路由

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

模式是：破壞性的事情用確定性規則，制式 FAQ 用檢索，其餘用 agent。2026 年的客服系統就是這樣交付的。

## Use It｜實際應用

2026 年的組合：

| 用途 | 架構 |
|---------|---------------|
| 訂位、付款、驗證 | 規則狀態機加槽位填充 |
| 客服 FAQ | 在整理過的答案上檢索 |
| 開放的求助對話 | 帶 RAG 和工具呼叫的 agent |
| 內部工具／IDE 助理 | 帶工具呼叫（搜尋、讀、寫）的 agent |
| 伴侶／角色聊天機器人 | 調校過的 LLM，加上人格 system prompt，知識用檢索 |

正式環境永遠用混合路由。沒有單一架構能把每個請求都處理好。路由層本身通常是一個小的意圖分類器。

## 仍會交付出去的失敗模式

- **自信的捏造。** agent 宣稱完成了它沒做的動作。緩解：驗證結果、記錄工具呼叫、沒有成功的工具回傳就不讓模型宣稱做過。
- **prompt 注入（prompt injection）。** 使用者插入文字，蓋過 system prompt。在 OWASP Top 10 for LLM Applications 2025 裡列為 LLM01。兩種：直接注入（貼進對話）和間接注入（藏在 agent 會讀的文件、電子郵件或工具輸出裡）。

  攻擊成功率隨情境而變。在一般工具使用和程式評測上，前沿模型測到的成功率大約 0.5% 到 8.5%。特定高風險設定（對 AI agent loop 的適應性攻擊、脆弱的編排）達到約 84%。正式環境的 CVE 包括 EchoLeak（CVE-2025-32711，CVSS 9.3）——Microsoft 365 Copilot 裡由攻擊者控制的電子郵件觸發的零點選（zero-click）資料外洩缺陷。

  緩解：在整個迴圈裡把使用者輸入當成不可信；工具呼叫前先清理；把工具輸出和主 prompt 隔離；用規劃–驗證–執行（Plan-Verify-Execute，PVE），agent 先規劃，再對照計畫驗證每個動作才執行（這能阻止工具結果注入新的、計畫外的動作）；破壞性動作要使用者確認；工具範圍用最小權限。

  再多的 prompt 工程也不能完全消掉這個風險。需要外部的執行期防禦層（LLM Guard、允許清單驗證、語意異常偵測）。
- **任務範圍失控。** 工具呼叫回了沾邊的資訊，agent 就離題。緩解：收窄工具契約；system prompt 保持聚焦；為離題比率加評估。
- **無限迴圈。** agent 一直呼叫同一個工具。緩解：步數預算、工具呼叫去重、用 LLM 評審「我們有沒有在前進」。
- **脈絡視窗耗盡。** 長對話把最早的輪次推出脈絡。緩解：摘要較舊的輪次、按相似度檢索相關的過去輪次，或用長脈絡模型。

## Ship It｜交付成果

存成 `outputs/skill-chatbot-architect.md`：

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Exercises｜練習

1. **簡單。** 用上面的規則式回應，為咖啡店點餐機器人做 10 個模式。測邊界：重複點餐、修改、取消、意圖不清。
2. **中等。** 做混合的 FAQ 加 LLM 後援。一個 SaaS 產品的 50 則制式 FAQ，LLM 後援在文件站上檢索。在 100 則真實客服問題上量拒答率和準確率（accuracy）。
3. **困難。** 用三個工具（搜尋、讀使用者資料、寄信）實作上面的 LLM agent。用 50 個測試情境跑評估，其中包含 prompt 注入嘗試。報告離題比率、失敗任務比率、以及任何注入成功。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 意圖 | 使用者想要什麼 | 類別標籤（label）（book_flight、reset_password）。路由到處理器。 |
| 槽位 | 一塊資訊 | 機器人需要的參數（日期、目的地）。槽位填充是一連串的詢問。 |
| RAG | 檢索加生成 | 檢索相關文件，再讓 LLM 的回應有依據。 |
| 工具呼叫 | 函式呼叫 | LLM 發出帶名稱和引數的結構化呼叫。執行期執行，回傳結果。 |
| LLM agent | 規劃、行動、驗證 | 控制器把 LLM 呼叫和工具呼叫交錯跑，直到任務完成。 |
| prompt 注入 | 使用者攻擊 prompt | 惡意輸入試圖蓋過 system prompt。 |

## Further Reading｜延伸閱讀

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) ——把對話變成這個領域評測的論文。
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) ——原始的規則式聊天機器人論文。
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6) ——PARRY 的情緒變數架構，第一個有狀態的聊天機器人。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) ——Google 晚期的神經聊天機器人論文，就在 agent 接手之前。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) ——為 LLM agent 模式命名的論文。
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) ——2024 年的正式環境指引，2026 年仍然成立。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) ——prompt 注入的論文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) ——把 prompt 注入列成首要安全疑慮的排名。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) ——編排層的實務防禦，包括規劃–驗證–執行和使用者確認流程。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) ——間接 prompt 注入造成的標準的零點選資料外洩 CVE。說明為什麼有寫入權限的 agent 需要執行期防禦。
