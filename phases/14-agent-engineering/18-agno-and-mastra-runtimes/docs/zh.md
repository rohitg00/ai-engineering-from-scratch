# 生產級代理執行環境 —— 快速實例化與具型別工作流

> 生產級代理執行環境最佳化的，正是原型框架不理會的東西：實例化成本、具型別的工作流表面，以及一個可直接上線服務的後端。2026 年的這一對：Agno（Python）瞄準微秒級的代理實例化與無狀態的 FastAPI 後端。Mastra 則在 Vercel AI SDK 的基底上出貨代理、工具、工作流、統一的模型路由與複合式儲存。

**類型：** 學習
**程式語言：** Python, TypeScript
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 13（LangGraph）
**時間：** 約 45 分鐘

## 學習目標

- 指認出 Agno 的效能目標，以及它們何時要緊。
- 說出 Mastra 的三個原語 —— Agents、Tools、Workflows —— 以及它支援的伺服器轉接器。
- 解釋為何無狀態、以工作階段為範圍的 FastAPI 後端，是 Agno 建議的生產路徑。
- 針對給定的技術堆疊（以 Python 為先或以 TypeScript 為先）在 Agno 與 Mastra 之間做選擇。

## 問題所在

LangGraph、AutoGen、CrewAI 都是重框架。想要「就只要代理迴圈，要快，而且要在我的執行環境裡」的團隊，會伸手拿 Agno（Python）或 Mastra（TypeScript）。兩者都拿一部分由框架擁有的原語，去換取原始速度與跟周邊堆疊更貼合的契合度。

## 核心概念

### Agno

- Python 執行環境，前身是 Phi-data。
- 「沒有圖、沒有鏈、沒有繞來繞去的模式 —— 就只是純 python。」
- 文件上的效能目標：約 2μs 的代理實例化、每個代理約 3.75 KiB 記憶體、約 23 家模型供應商。
- 生產路徑：無狀態、以工作階段為範圍的 FastAPI 後端。每個請求都開一個全新的代理；工作階段狀態住在 DB 裡。
- 原生多模態（文字、影像、音訊、影片、檔案）與代理式 RAG。

當你每秒有成千上萬個短命代理時（聊天扇入、評測管線），那些速度目標才要緊。當一個代理要跑 10 分鐘時，它們就沒那麼要緊。

### Mastra

- TypeScript，建構在 Vercel AI SDK 之上。
- 三個原語：**Agents**、**Tools**（以 Zod 定型）、**Workflows**。
- 統一模型路由 —— 涵蓋 94 家供應商的 3,300 種以上模型（2026 年 3 月）。
- 複合式儲存：記憶、工作流、可觀測性可以各自接到不同後端；規模化的可觀測性建議用 ClickHouse。
- Apache 2.0，但 `ee/` 目錄採 source-available 的企業授權。
- 提供 Express、Hono、Fastify、Koa 的伺服器轉接器；與 Next.js 和 Astro 有一等整合。
- 出貨 Mastra Studio（localhost:4111）供除錯。
- 在 1.0 時（2026 年 1 月）有 22k+ GitHub 星數、每週 300k+ npm 下載。

### 定位

兩者都沒有想當 LangGraph。它們競爭的是：

- **語言契合度。** Agno 給以 Python 為先的團隊；Mastra 給以 TypeScript 為先的團隊。
- **執行環境的人體工學。** Agno = 幾乎零開銷；Mastra = 與 Vercel 生態系整合。
- **可觀測性。** 兩者都跟 Langfuse／Phoenix／Opik（第 24 課）整合，但 Mastra Studio 是第一方的。

### 什麼時候挑哪個

- **Agno** —— Python 後端、大量短命代理、效能要求高、FastAPI 的店。
- **Mastra** —— TypeScript 後端、Next.js／Vercel 部署、統一的多供應商模型路由、以 Zod 定型的工具。
- **LangGraph**（第 13 課）—— 當持久狀態與明寫的圖推理比原始速度更重要時。
- **OpenAI／Claude Agent SDK** —— 當你想要供應商產品化後的形狀時（第 16–17 課）。

### 這套模式在哪裡會出錯

- **為效能而效能。** 工作負載每個請求只有一次很慢的代理呼叫，卻因為「2μs」聽起來很棒而挑了 Agno。瓶頸不在那個開銷上。
- **生態系綁定。** Mastra 那套 Vercel 口味的整合，在 Vercel 上是加分，在別處是扣分。
- **企業授權的混淆。** Mastra 的 `ee/` 目錄是 source-available，不是 Apache 2.0。如果你打算 fork，先把授權讀清楚。

```figure
wb-runtime-spawn
```

## 動手實作

這一課主要是比較性的 —— 單一份程式碼產物沒辦法對兩個框架都公平。見 `code/main.py` 的並排玩具：一個最小的「跑一個代理、把輸出串流出來、持久化工作階段」流程被實作兩次（一次是 Agno 形狀，一次是 Mastra 形狀）。

跑它：

```
python3 code/main.py
```

兩條結構上不同、但功能上等價的軌跡。

## 框架應用

- **Agno** —— 需要速度與 FastAPI 形狀的 Python 後端。
- **Mastra** —— 供應商很多、又需要工作流原語的 TypeScript 後端。
- 兩者都出貨第一方的可觀測性掛鉤。兩者都跟 Langfuse 整合。

## 產出交付

`outputs/skill-runtime-picker.md` 會依技術堆疊、延遲預算與運維形狀，在 Agno、Mastra、LangGraph 或某個供應商 SDK 之間做選擇。

## 練習

1. 讀 Agno 的文件。把 stdlib 的 ReAct 迴圈（第 01 課）移植到 Agno。什麼消失了？什麼留下來了？
2. 讀 Mastra 的文件。把同一個迴圈移植到 Mastra。工具定型上有什麼改變（Zod vs 什麼都沒有）？
3. 做基準測試：量你自己堆疊上的代理實例化延遲。Agno 那 2μs 對你的工作負載要緊嗎？
4. 設計一次遷移：如果你一直在 Python 裡跑 CrewAI，換到 Agno 會壞掉什麼？
5. 讀 Mastra `ee/` 的授權條款。哪些限制會影響一個開源 fork？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Agno | 「很快的 Python 代理」 | 無狀態、以工作階段為範圍的代理執行環境 |
| Mastra | 「跑在 Vercel AI SDK 上的 TypeScript 代理」 | Agents + Tools + Workflows + Model Router |
| 統一模型路由 | 「多供應商存取」 | 用單一客戶端存取 94 家供應商的 3,300 種以上模型 |
| 複合式儲存 | 「多個後端」 | 記憶／工作流／可觀測性各自接到不同的儲存 |
| Mastra Studio | 「本機除錯器」 | localhost:4111 的 UI，用來內省代理 |
| Source-available | 「不是 OSS」 | 授權允許閱讀原始碼，但限制商業使用 |

## 延伸閱讀

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) —— 效能目標、FastAPI 整合
- [Mastra docs](https://mastra.ai/docs) —— 原語、伺服器轉接器、Model Router
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 有狀態圖那個替代方案
- [Comet Opik](https://www.comet.com/site/products/opik/) —— Mastra 整合中引用的可觀測性比較
