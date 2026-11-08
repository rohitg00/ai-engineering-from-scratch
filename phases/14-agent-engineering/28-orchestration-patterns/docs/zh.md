# 編排模式：Supervisor、Swarm、階層式

> 2026 年各框架反覆出現四種編排模式：supervisor-worker、swarm／點對點、階層式、辯論。Anthropic 的指引：「重點在於為你的需求打造對的系統。」從簡單開始；只有在「單一代理加上五種工作流模式」不夠用時，才加上拓撲。

**類型：** 學習 + 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 12（工作流模式）、階段 14 · 25（多代理辯論）
**時間：** 約 60 分鐘

## 學習目標

- 說出那四種反覆出現的編排模式，以及各自何時合用。
- 描述 2026 年 LangChain 的建議：基於工具呼叫的監督 vs supervisor 函式庫。
- 解釋 Anthropic 那條「打造對的系統」規則，以及它如何替拓撲選擇設閘門。
- 用 stdlib 對著同一個腳本化 LLM 把四種都實作出來。

## 問題所在

團隊常在需要之前就伸手拿「多代理」。四種模式在各框架間反覆出現；一旦你叫得出它們的名字，你就能挑對那一個 —— 或乾脆完全跳過拓撲。

## 核心概念

### Supervisor-worker

- 一個中央的路由 LLM 分派給專家代理。
- 它決定：迴圈回自己、交接給某位專家，或終止。
- 專家彼此不對話；所有路由都經過 supervisor。

框架：LangGraph 的 `create_supervisor`、Anthropic 的 orchestrator-workers、CrewAI 的 Hierarchical Process。

**2026 年 LangChain 的建議：** 用直接的工具呼叫來做監督，而不要用 `create_supervisor`。這給你更細緻的脈絡工程掌控 —— 每位專家看到什麼，完全由你決定。

### Swarm／點對點

- 代理透過共享的工具表面直接交接。
- 沒有中央路由器。
- 延遲比 supervisor 低（跳數較少）。
- 更難推敲（沒有單一的控制點）。

框架：LangGraph 的 swarm 拓撲、OpenAI Agents SDK 的 handoff（當所有代理都能交接給所有其他代理時）。

### 階層式

- Supervisor 管理子 supervisor，子 supervisor 再管理 worker。
- 在 LangGraph 裡以巢狀子圖實作；在 CrewAI 裡是巢狀 crew。
- 能擴展到很大的代理族群，代價是運維複雜度。

什麼時候需要它：當單一 supervisor 的脈絡預算裝不下所有專家的描述時。

### 辯論

- 平行的提議者 + 迭代式交叉批評（第 25 課）。
- 它其實不太算編排 —— 比較像查證 —— 但在框架裡確實會以拓撲選項的身分出現。

### 自主 crew vs 決定性 flow

CrewAI 把兩種部署模式形式化：

- **Flow** 給決定性、事件驅動的自動化（生產環境建議的起點）。
- **Crew** 給自主的角色制協作。

這跟上面四種模式是正交的，但可以對映到拓撲：Flow 通常是 supervisor 或階層式；Crew 通常是配了 LLM 路由器的 supervisor。

### Anthropic 的指引

「在 LLM 這個領域，成功不在於打造最精巧的系統。而在於為你的需求打造對的系統。」

決策順序：

1. 單一代理 + 工作流模式（第 12 課）—— 從這裡開始。
2. Supervisor-worker —— 當你有 2-4 位專家時。
3. Swarm —— 當延遲比推理清晰度更重要時。
4. 階層式 —— 只有在 supervisor 的脈絡預算撐不住時。
5. 辯論 —— 當準確率比成本更重要時。

### 這套模式在哪裡會出錯

- **拓撲優先的思考。** 在還沒指認出多代理要解什麼問題之前，就說「我們需要多代理」。
- **Swarm 裡來回彈跳的交接。** A -> B -> A -> B。用跳數計數器。
- **假階層。** 因為「企業級」所以做了三層；實際上只有兩個團隊。塌縮它。

```figure
orchestration-pattern
```

## 動手實作

`code/main.py` 用 stdlib 對著一個腳本化 LLM 實作全部四種模式：

- `Supervisor` —— 中央路由器。
- `Swarm` —— 帶直接交接的點對點。
- `Hierarchical` —— supervisor 的 supervisor。
- `Debate` —— 平行提議者 + 批評。

每種模式都處理同一項三意圖任務（退款／臭蟲／業務）。軌跡形狀各不相同。

跑它：

```
python3 code/main.py
```

輸出：逐模式的軌跡 + 操作數。Supervisor 最乾淨；swarm 最短；階層式最深；辯論最貴。

## 框架應用

- **LangGraph** 給 supervisor 與階層式（巢狀子圖）。
- **OpenAI Agents SDK** 給 handoff 即工具（supervisor 形狀）。
- **CrewAI Flow** 給生產環境的決定性流程。
- **自製** 給辯論，或當你想要精確掌控時。

## 產出交付

`outputs/skill-orchestration-picker.md` 會挑一種拓撲並把它實作出來。

## 練習

1. 把一個 supervisor-worker 拿掉路由器改成 swarm。什麼壞了？什麼變好了？
2. 給 swarm 加一個跳數計數器：超過 3 次交接就拒絕。它抓得到 A->B->A 的彈跳嗎？
3. 替一個有 12 位專家的領域蓋一套兩層的階層式系統。不做巢狀的話，脈絡預算會在哪裡撐不住？
4. 在一個生產形狀的工作負載上替這四種模式做剖析。哪個在哪項指標上勝出（延遲、成本、準確率、可除錯性）？
5. 讀 Anthropic 那篇〈Building Effective Agents〉。把你每一條生產流程都對映到四種之一。有哪一條對不乾淨嗎？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Supervisor-worker | 「路由器 + 專家」 | 中央 LLM 分派給專家；專家彼此不對話 |
| Swarm | 「點對點」 | 透過共享工具直接交接；沒有中央路由器 |
| 階層式 | 「supervisor 的 supervisor」 | 給大型族群用的巢狀子圖 |
| 辯論 | 「提議者 + 批評」 | 平行提議者、交叉批評（第 25 課） |
| 基於工具呼叫的監督 | 「不用函式庫的 supervisor」 | 用直接的工具呼叫實作 supervisor，以取得脈絡掌控 |
| Crew | 「自主團隊」 | CrewAI 的角色制協作模式 |
| Flow | 「決定性的工作流」 | CrewAI 的事件驅動生產模式 |

## 延伸閱讀

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 五種模式 + 代理 vs 工作流
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— supervisor、swarm、階層式
- [CrewAI docs](https://docs.crewai.com/en/introduction) —— Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) —— 辯論模式
