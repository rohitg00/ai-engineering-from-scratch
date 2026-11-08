# 綜合專案 06 —— Kubernetes 的 DevOps 排障代理

> AWS 的 DevOps Agent 正式上線、Resolve AI 發表了它的 K8s 操作手冊、NeuBird 展示了語意監控，而 Metoro 把 AI SRE 綁到逐服務的 SLO 上。生產上的形狀已經定了：一個警報 webhook 觸發、一個代理讀取遙測、走過一張 K8s 物件圖、替根因假說排序，然後在 Slack 上貼出一份帶核可按鈕的簡報。預設唯讀。每一項修復都由人類把關。這個綜合專案就是那個代理，在 20 起合成事故上受評，並在三個共同案例上與 AWS 的 Agent 比較。

**類型：** 總結專案
**程式語言：** Python (agent), TypeScript (Slack integration)
**先修單元：** 階段 11（LLM 工程）、階段 13（工具與 MCP）、階段 14（代理）、階段 15（自主）、階段 17（基礎設施）、階段 18（安全）
**演練到的階段：** P11 · P13 · P14 · P15 · P17 · P18
**時間：** 30 小時

## 問題

2025-2026 年的 SRE 敘事變成了：「AI 代理做事故檢傷，人類核可修復。」AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps，全都在生產環境出貨了這個形狀。代理讀取 Prometheus 指標、Loki 日誌、Tempo 軌跡、kube-state-metrics，以及一張 K8s 物件的知識圖。它在五分鐘之內產出一份帶遙測引用、經過排序的根因假說。它絕不在沒有透過 Slack 取得人類明確核可的情況下執行破壞性指令。

大部分的苦工在範圍界定與安全性上，不在推理上。這個代理需要一個預設唯讀的 RBAC 介面、一台加固過的 MCP 工具伺服器，以及一份「考慮過 vs 實際執行」的每道指令稽核日誌。它得知道自己什麼時候超出深度並升級。而且它得跑得夠便宜，別讓 OOM-kill 的連鎖反應生出一張 5 千美元的代理帳單。

## 概念

這個代理運作在一張知識圖上。節點是 K8s 物件（Pod、Deployment、Service、Node、HPA、PVC）加上遙測來源（Prometheus 時間序列、Loki 串流、Tempo 軌跡）。邊編碼了從屬關係（Pod -> ReplicaSet -> Deployment）、排程（Pod -> Node）與觀測（Pod -> Prometheus 時間序列）。這張圖由 kube-state-metrics 同步維持新鮮，並在每次警報時重新取樣。

警報觸發時，代理從受影響的物件開始找根因。它走過邊、拉出相關的遙測切片（最近 15 分鐘），並草擬一份假說。假說依證據排序：有多少遙測引用支持它、多近期、多具體。前三個假說連同圖路徑視覺化與修復動作的核可按鈕一起送到 Slack。

修復是有閘門的。預設允許的動作都是唯讀。破壞性動作（縮容、回滾、刪 Pod）需要 Slack 核可；ArgoCD 的回滾掛鉤需要一個代理從不持有的認證權杖。稽核日誌會記下代理「考慮過」的每一道指令 —— 不只是執行過的 —— 好讓審查流程抓得到那些差點出事的情況。

## 架構

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## 技術堆疊

- 可觀測性來源：Prometheus、Loki、Tempo、kube-state-metrics
- 知識圖：K8s 物件 + 遙測邊，存於 Neo4j（託管）或 kuzu（嵌入式）
- 代理：帶逐工具允許清單的 LangGraph，預設唯讀
- 工具傳輸：跑在 StreamableHTTP 上的 FastMCP；破壞性工具另用一台在核可閘門之後的伺服器
- 模型：根因推理用 Claude Sonnet 4.7，日誌摘要用 Gemini 2.5 Flash
- 修復：ArgoCD 回滾 webhook、PagerDuty 升級、Slack 核可卡片
- 稽核：只能追加的結構化日誌（考慮過、執行過、核可過、結果）
- 部署：以自己那份權限收窄的 RBAC 角色做 K8s 部署；獨立命名空間

```figure
ce-rootcause-walk
```

## 動手實作

1. **圖的攝取。** 每 30 秒把 kube-state-metrics 同步進 Neo4j/kuzu。節點：Pod、Deployment、Node、Service、PVC、HPA。邊：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。遙測疊層邊：OBSERVED_BY（某個 Pod 被某條 Prometheus 時間序列觀測）。

2. **警報接收器。** 一個接受 PagerDuty 或 Alertmanager webhook 的 FastAPI 端點。抽出受影響的物件與被違反的 SLO。

3. **唯讀工具介面。** 透過 FastMCP 把 kubectl、Prometheus 查詢、Loki logql、Tempo traceql 包起來。每個工具都只帶窄的 RBAC 動詞（"get"、"list"、"describe"）。預設伺服器裡沒有 "delete"、"exec"、"scale"。

4. **根因代理。** 三個節點的 LangGraph：`sample` 拉出最近 15 分鐘的遙測切片、`walk` 向圖查詢鄰接物件、`hypothesize` 草擬帶遙測引用、經過排序的根因候選。

5. **證據評分。** 每個假說的分數 = 近期程度 * 具體程度 * 圖路徑長度的倒數 * 引用數。回傳前三個。

6. **Slack 簡報。** 貼一則附件，帶上假說、圖路徑視覺化（一張伺服器端渲染的子圖影像），以及最多一項修復動作的核可按鈕。

7. **修復閘門。** 破壞性工具（縮容、回滾、刪除）放在第二台 MCP 伺服器上，藏在一個核可權杖之後。代理只有在 Slack 卡片被人類核可之後才呼叫得到它們。

8. **稽核日誌。** 只能追加的 JSONL：對每一道候選指令，記錄它是否被考慮過、是否被執行、是誰核可的。每天送到 S3。

9. **合成事故套件。** 建 20 個情境：OOMKill 連鎖、DNS 抖動、HPA 震盪、PVC 滿載、吵鬧的鄰居、故障的 sidecar、錯誤的 ConfigMap 上線、憑證輪替、映像檔拉取退避等等。就根因準確率與到假說的時間替代理評分。

## 框架應用

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## 產出交付

`outputs/skill-devops-agent.md` 就是那份交付物。給定一個 K8s 叢集與警報來源，這個代理會產出經過排序的根因假說，以及一條由 Slack 把關的修復流程。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 情境套件上的根因分析準確率 | 20 起合成事故中根因正確率 ≥80% |
| 20 | 安全性 | 稽核日誌中，破壞性動作守衛從未在沒有 Slack 核可時放行 |
| 20 | 到假說的時間 | 從警報到 Slack 簡報的 p50 低於 5 分鐘 |
| 20 | 可解釋性 | 每個假說都有圖路徑與遙測引用 |
| 15 | 整合完整度 | PagerDuty、Slack、ArgoCD、Prometheus 端到端都能運作 |
| **100** | | |

## 練習

1. 在 AWS DevOps Agent 用來展示的那三起事故上跑你的代理。發表並排比較。回報代理在哪裡出現分歧。

2. 加上一項「差點出事」稽核，標出任何代理「考慮過」、且在沒有核可下會造成破壞的指令。量測一週內的差點出事率。

3. 把假說模型從 Claude Sonnet 4.7 換成自架的 Llama 3.3 70B。量測根因分析準確率的差值與每起事故的花費。

4. 建一個因果過濾器：把相關的遙測尖峰與真正的根因區分開來。用那 20 個情境的標籤訓練一個小分類器。

5. 加上回滾試跑：對一個帶相同資訊清單的預備叢集執行 ArgoCD 回滾。在 Slack 核可按鈕之前，先在一個實際叢集上驗證那份回滾計畫。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| K8s 知識圖 | 「叢集圖」 | 節點 = K8s 物件 + 遙測序列；邊 = 從屬、排程、觀測 |
| 預設唯讀 | 「權限收窄的 RBAC」 | 代理的服務帳號只有 get/list/describe 動詞；破壞性動詞放在另一台核可閘門後的伺服器 |
| 稽核日誌 | 「考慮過 vs 執行過」 | 每一道候選指令、是否執行、誰核可的只能追加紀錄 |
| 假說排序 | 「證據分數」 | 近期程度 × 具體程度 × 圖路徑長度的倒數 × 引用數 |
| Slack 核可卡片 | 「人類介入閘門」 | 帶修復按鈕的互動式 Slack 訊息；人類沒點下去代理就不能繼續 |
| 遙測引用 | 「證據指標」 | 支撐某項主張的 Prometheus 查詢、Loki 選擇器，或 Tempo 軌跡網址 |
| MTTR | 「解決時間」 | 從警報觸發到 SLO 恢復的實際時間 |

## 延伸閱讀

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/)：2026 年那份經典參考
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) —— 競品的參考
- [NeuBird semantic monitoring](https://www.neubird.ai) —— 語意圖的做法
- [Metoro AI SRE](https://metoro.io) —— 以 SLO 為先的生產框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) —— 叢集狀態的來源
- [LangGraph](https://langchain-ai.github.io/langgraph/) —— 參考用的代理編排器
- [FastMCP](https://github.com/jlowin/fastmcp) —— Python 的 MCP 伺服器框架
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) —— 那個有閘門的修復標的
