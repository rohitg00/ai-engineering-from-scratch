# 交接與例行程序 —— 無狀態的編排

> OpenAI 的 Swarm（2024 年 10 月）把多代理編排蒸餾成兩個原語：**routine**（把指示與工具寫成一段系統提示詞）與 **handoff**（一項回傳另一個 Agent 的工具）。沒有狀態機、沒有分支 DSL —— 由 LLM 呼叫對的交接工具來做路由。OpenAI Agents SDK（2025 年 3 月）是它的生產接班人。Swarm 本身仍是概念上最乾淨的參考 —— 它的整份原始碼只有幾百行。這個模式之所以病毒式擴散，是因為 API 表面大致就是「代理 = 提示詞 + 工具；交接 = 回傳代理的函數」。侷限：無狀態，所以記憶是呼叫者的問題。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 16 · 04（原語模型）
**時間：** 約 60 分鐘

## 問題

每一個多代理框架都想要你學它的 DSL：LangGraph 的節點與邊、CrewAI 的 crew 與 task、AutoGen 的 GroupChat 與 manager。這些 DSL 是真的抽象，但它們讓這件事感覺比必要的更沉重。

Swarm 往反方向推：直接用模型本來就有的工具呼叫能力。交接變成工具呼叫。編排者就是當下持有對話的那個代理。狀態機隱含在各代理的系統提示詞裡。

## 概念

### 兩個原語

**Routine。** 一段定義代理角色與可用工具的系統提示詞。把它想成一組劃定範圍的指示：「你是檢傷分類代理；若使用者問退款，就交接給退款代理。」

**Handoff。** 一項代理可以呼叫、且會回傳一個新 Agent 物件的工具。Swarm 執行環境偵測到 Agent 這個回傳值，就把下一輪的活躍代理切換過去。

整個抽象就這樣。

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

檢傷分類代理的系統提示詞，讓它依使用者訊息挑出對的交接。LLM 的工具呼叫就完成了路由。

### 它為什麼會病毒式擴散

- **很小的 API。** 只有兩個概念要學。
- **用的是模型本來就會的東西。** 工具呼叫在各家供應商那裡早已是生產等級。
- **沒有狀態機的負擔。** 你不用去描述那張圖；代理的提示詞就描述了它們會交接給誰。

### 那筆無狀態的交易

Swarm 在多次執行之間明確地是無狀態的。框架在一趟執行期間會保留訊息歷史，但它不持久化任何東西。記憶、連續性、長時間執行的任務 —— 全是呼叫者的問題。

在生產環境（OpenAI Agents SDK，2025 年 3 月）中，這正是主要改變之一：該 SDK 在保留交接原語的同時，加上了內建的工作階段管理、護欄與追蹤。

### Swarm／交接適合的時候

- **檢傷分類模式。** 第一線代理把使用者路由給專家。
- **基於技能的交接。** 「若任務需要程式碼，就叫寫程式的；若需要研究，就叫研究員。」
- **短而有界的對話。** 客服、常見問題轉工單、簡單工作流。

### Swarm 吃力的時候

- **帶共享記憶的長工作階段。** 交接會把對話狀態重設成新代理的提示詞加歷史。沒有呼叫者自管的記憶，代理之間就沒有持久狀態。
- **平行執行。** 交接是一次一個 —— 活躍代理切換。要平行，就得由呼叫者去編排多趟 Swarm 執行。
- **稽核與重播。** 無狀態的執行很難精確重播；LLM 的交接選擇不是決定性的。

### OpenAI Agents SDK（2025 年 3 月）

這個生產接班人加上：

- **工作階段狀態。** 跨執行持久的討論串。
- **護欄。** 輸入／輸出的驗證掛鉤。
- **追蹤。** 每一次工具呼叫與交接都被記錄。
- **交接過濾器。** 掌控交接時哪些脈絡會轉移過去。

交接原語活了下來；周圍加上了生產級的人體工學。

### Swarm vs GroupChat

兩者都用 LLM 驅動的路由，但差別在**誰挑下一個**：

- GroupChat：一個選擇器（函數或 LLM）從外部挑出下一位發言者。
- Swarm：由當前代理呼叫交接工具，挑出自己的後繼者。

Swarm 是「由代理決定接下來是什麼」；GroupChat 是「由管理者決定接下來是什麼」。Swarm 的決策住在活躍代理的那次工具呼叫裡；GroupChat 的住在 `GroupChatManager` 裡。

```figure
sw-handoff-routing
```

## 動手實作

`code/main.py` 從零實作 Swarm：一個 Agent dataclass、一套交接機制（工具回傳 Agent），以及一個會偵測代理切換的執行迴圈。

示範：一個檢傷分類代理路由到退款、業務或客服專家。每個專家有自己的工具。執行迴圈會印出每一次交接。

跑：

```
python3 code/main.py
```

## 框架應用

`outputs/skill-handoff-designer.md` 替一項給定任務設計交接拓撲：有哪些代理存在、它們可以呼叫哪些交接、哪些脈絡會轉移。

## 產出交付

檢查清單：

- **交接記錄。** 每一次交接都寫下一個追蹤事件，含來源代理、目標代理、脈絡快照。
- **脈絡轉移規則。** 決定交接時什麼會跟著走：完整歷史（很貴）、最後 N 則訊息，或一份摘要。
- **交接上的護欄。** 交接給一個擁有不同工具權限的專家時必須經過認證 —— 否則提示詞注入可以逼出不想要的交接。
- **迴圈偵測。** 兩個代理來回互踢是常見的失敗；用一個簡單的「最後 K 個」環狀檢查就偵測得到。
- **退路代理。** 若交接目標不存在，就退回一個安全的預設。

## 練習

1. 跑 `code/main.py`，檢傷分類到退款代理。確認第二輪的活躍代理是退款代理。
2. 加一條迴圈偵測規則：若同樣兩個代理連續交接 3 次，就強制退出。設計那個退路。
3. 讀 OpenAI Agents SDK 關於交接過濾器的文件。實作一個「交接時摘要」版本：外出的代理在接手者上場之前，把脈絡壓縮成條列摘要。
4. 把 Swarm 的交接跟 GroupChatManager 的選擇器做比較。哪一種模式讓提示詞注入更嚴重，為什麼？
5. 讀 Swarm 的 cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指認出 Swarm 做的一項明確設計決策，並說明 OpenAI Agents SDK 是改掉它還是保留它。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Routine | 「代理的提示詞」 | 系統提示詞 + 工具清單。定義角色與可用的交接。 |
| Handoff | 「轉移給另一個代理」 | 活躍代理可以呼叫、且回傳一個新 Agent 的工具。執行環境據此切換活躍代理。 |
| 無狀態 | 「多次執行之間沒有記憶」 | Swarm 什麼都不持久化；記憶是呼叫者的責任。 |
| 活躍代理 | 「現在是誰在講話」 | 當下持有對話的那個代理。交接會改變它。 |
| 脈絡轉移 | 「交接時什麼會跟著走」 | 決定接手代理看到什麼歷史的政策：完整、最後 N 則，或摘要。 |
| 交接迴圈 | 「代理在打乒乓」 | 兩個代理一直互相交接回去的失敗模式。 |
| OpenAI Agents SDK | 「生產版的 Swarm」 | 2025 年 3 月的接班人；在交接原語之上加了工作階段、護欄與追蹤。 |
| 交接過濾器 | 「轉移時的閘門」 | SDK 的功能，可在交接邊界檢視並修改脈絡。 |

## 延伸閱讀

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 那份參考表述
- [OpenAI Swarm repo](https://github.com/openai/swarm) —— 原始實作，作為概念參考保留下來
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— 帶工作階段與追蹤的生產接班人
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) —— Claude Code 的子代理如何透過 `Task` 使用類交接的模式
