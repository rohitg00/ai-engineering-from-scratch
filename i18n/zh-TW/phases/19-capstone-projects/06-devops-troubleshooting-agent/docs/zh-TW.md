# 專案實戰 06——Kubernetes DevOps 故障排查 Agent（Capstone 06 — DevOps Troubleshooting Agent for Kubernetes）

> 亞馬遜 AWS 正式商用發布了 DevOps Agent，Resolve AI 公開了其針對 K8s 的自動化排障 Playbook，NeuBird 展示了語義監控架構，而 Metoro 則將 AI SRE 與每個微服務的 SLO 嚴格綁定。2026 年正式環境的標準架構已徹底定型：告警 Webhook 觸發、Agent 自動擷取全鏈路遙測資料、遍歷 K8s 實體拓撲知識圖譜、對根本原因假設展開加權排序，並向 Slack 通道推播附帶審批按鈕的分析簡報。系統**預設僅具備唯讀權限**。任何線上修復與變更指令必須經由人類工程師在環審批。本專案實戰要求你端到端建置該 SRE Agent，在包含 20 個合成生產事故的測試集中展開客觀評測，並在三個共有案例上直接對標 AWS DevOps Agent。

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## Problem｜問題

2025 至 2026 年的網站可靠性工程（SRE）標準共識已徹底收斂為：「AI Agent 負責故障排查與分類，人類工程師負責審批修復變更。」AWS DevOps Agent、Resolve AI、NeuBird、Metoro 以及 PagerDuty AIOps，在正式環境中全體採用此一架構。Agent 能自動讀取 Prometheus 指標、Loki 紀錄串流、Tempo 分散式追蹤、kube-state-metrics 叢集狀態，以及整個 K8s 叢集物件的拓撲知識圖譜。它能在 5 分鐘之內產出一份附帶確鑿遙測證據引用的根因分析（RCA）假設清單。且在未取得 Slack 中人類工程師明確點選授權之前，絕對嚴禁擅自執行任何具備破壞性的維運指令。

大部分難題在範圍界定與安全，而非推理。Agent 需要預設嚴格唯讀的 RBAC 角色綁定、經過資安加固的 MCP 工具伺服器，以及針對「曾經考慮過但未執行」與「已獲批執行」之所有命令的審計紀錄。它必須清楚感知自身的能力邊界並及時升級告警。此外，其推論呼叫成本必須足夠低廉，以確保當叢集爆發 OOM-Kill 級聯連鎖反應時，不會產生 5,000 美元的 Agent 帳單。

## Concept｜核心概念

該 Agent 全面運作於一套動態更新的知識圖譜之上。圖譜中的節點代表 K8s 實體物件（Pod、Deployment、Service、Node、HPA、PVC）以及對應的遙測資料來源（Prometheus 指標時序、Loki 紀錄串流、Tempo Trace 鏈路）。圖譜中的邊編碼了嚴格的所有權關聯（Pod -> ReplicaSet -> Deployment）、排程調度關聯（Pod -> Node）以及觀測關聯（Pod -> Prometheus series）。這套圖譜透過定時同步 kube-state-metrics 保持增量鮮度，並在接收到每一次告警時對周邊拓撲展開重採樣。

當線上告警觸發時，Agent 從受影響的目標物件節點出發展開根因排查。它沿著圖譜中的邊展開拓撲游走、擷取最近 15 分鐘內的相關遙測片段，並起草初步假設。所有假設皆依據客觀證據權重展開排序：有多少條實體遙測證據支持該推論、資料的時間新鮮度如何、關聯的特異性有多高。排名前 3 的核心根因假設將連同動態渲染的圖譜呼叫路徑圖，直接推播至企業 Slack 通道，並附帶具體修復方案的互動審批按鈕。

修復操作實施嚴格門禁。預設允許執行的工具均為唯讀查詢。任何破壞性變更（例如縮容副本數、版本回滾、強制刪除異常 Pod）必須經過 Slack 上的工程師點選確認；呼叫 ArgoCD 回滾 Webhook 所需的高權限 Token 永遠由獨立閘道器持有，Agent 本身絕對無權直接存取。審計紀錄完整記錄 Agent *曾經納入考量* 的每一條候選指令——而不僅僅是最終被執行的指令——確保安全審查流程能即時揪出所有的「險些出錯（Near-misses）」邊界。

## 系統架構

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

- 遙測資料來源：Prometheus 時序資料庫、Loki 紀錄庫、Tempo 分散式鏈路追蹤、kube-state-metrics
- 拓撲知識圖譜：Neo4j（全託管）或 kuzu（高性價比內嵌式圖資料庫），儲存 K8s 物件實體與遙測觀測邊
- Agent 狀態機：LangGraph，搭載精確的單工具白名單機制，架構預設強制唯讀
- 工具通訊協定：基於 FastMCP 的 StreamableHTTP 雙向串流協定；破壞性工具獨立部署於審批閘道器後方
- 後台驅動模型：Claude Sonnet 4.7 專責深度根因因果推理，Gemini 2.5 Flash 專責海量終端紀錄極速摘要
- 線上修復聯動：ArgoCD 自動回滾 Webhook、PagerDuty 人工升級通道、Slack 互動式審批卡片
- 審計紀錄追蹤：Append-only 結構化審計串流（記錄：考量指令、執行指令、審批人資訊、執行結果）
- 部署實體環境：部署於 K8s 獨立 Namespace，綁定專屬的極度狹窄唯讀 RBAC ServiceAccount

```figure
ce-rootcause-walk
```

## Build It｜動手實作

1. **知識圖譜攝取同步**。每隔 30 秒自動將 kube-state-metrics 的最新叢集狀態同步進 Neo4j/kuzu。節點型別：Pod、Deployment、Node、Service、PVC、HPA。關聯邊：OWNED_BY（歸屬）、SCHEDULED_ON（調度於）、EXPOSES（暴露）、MOUNTS（掛載）、SCALES（擴縮容）。遙測覆蓋邊：OBSERVED_BY（某個 Pod 正被某條 Prometheus 指標時序持續觀測）。

2. **告警接收閘道器**。使用 FastAPI 開發接收端點，接收 PagerDuty 或 Alertmanager 的 Webhook 事件。自動解析出受影響的 K8s 物件清單與觸發違規的具體 SLO 閾值。

3. **唯讀工具介面封裝**。使用 FastMCP 將 kubectl、Prometheus 查詢、Loki logql、Tempo traceql 封裝為標準工具。每個工具嚴格綁定唯讀動詞（"get"、"list"、"describe"）。預設伺服器中絕對嚴禁暴露出 "delete"、"exec"、"scale" 等危險動詞。

4. **根因推理狀態機**。使用 LangGraph 編排三大核心節點：`sample` 節點精確擷取最近 15 分鐘的遙測資料切片；`walk` 節點在圖譜中由故障節點向周邊拓撲展開鄰居遍歷；`hypothesize` 節點綜合圖譜拓撲與時序異常，起草附帶遙測引用的候選根因假設。

5. **客觀證據加權打分**。為每條候選假設計算信心得分：Score = 新鮮度 * 異常特異性 * (圖譜路徑長度)^-1 * 實證引用條數。精準輸出排名前 3 的最可能假設。

6. **Slack 分析簡報推播**。向維運通道推播富媒體訊息卡片：呈現根本原因假設、伺服器端動態渲染的故障關聯子圖縮圖，以及最多對應一個具體修復處方的「審批授權」按鈕。

7. **破壞性修復門禁攔截**。破壞性工具（縮容、版本回滾、刪除 Pod）隔離部署在第二個 MCP 伺服器中，並由核准權杖保護。只有在人員核准 Slack 卡片後，Agent 才能呼叫這些工具。

8. **審計紀錄**。建置 Append-only JSONL 審計追蹤：針對 Agent 考慮過的每一條候選指令，完整記錄其是否僅被納入考量、是否被實際執行、是由哪位工程師點選授權的。每日送至 S3。

9. **合成故障測試靶場**。打造包含 20 個經典正式環境事故的測試場景集：OOMKill 連鎖崩潰、DNS 異常、HPA 震盪顛簸、PVC 儲存空間耗盡、吵鬧鄰居（Noisy Neighbor）資源爭搶、異常 Sidecar 阻塞、錯誤的 ConfigMap 上線、憑證輪替、ImagePullBackOff 映像檔下載失敗等。在根因定位準確率與排障耗時兩個維度上對 Agent 進行極限打分。

## Use It｜實際應用

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

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-devops-agent.md`。給定一個目標 K8s 叢集連線與告警來源，該 Agent 能全自動推導出附帶嚴格引用的根因假設，並打通 Slack 人工在環的安全修復閉環。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 故障場景庫 RCA 準確率 | 在 20 個合成正式環境事故測試集中，根因定位正確率達到 ≥80% |
| 20 | 系統安全性與門禁防禦 | 審計紀錄中 100% 驗證：破壞性維運指令絕未在未獲 Slack 人工授權前擅自觸發 |
| 20 | 故障定位推論時效性 | 從告警觸發到 Slack 簡報成功發布，端到端 p50 耗時嚴格控制在 5 分鐘以內 |
| 20 | 結論可解釋性與溯源性 | 正文中的每一條根因假設皆具備圖譜拓撲關聯路徑與確鑿的時序紀錄引用 |
| 15 | 生態整合完備度 | PagerDuty、Slack、ArgoCD、Prometheus 全鏈路端到端閉環實戰打通 |
| **100** | | |

## Exercises｜練習

1. 將你的 Agent 與 AWS 官方展示的 DevOps Agent 在完全相同的三個公開生產事故案例上展開平行測試。產出詳細的橫向對比報告，指出你的 Agent 在推理邊界上與商業大廠方案的核心差異。
2. 開發一套「險些出錯（Near-miss）」審查模組：自動標記 Agent 曾考慮、但未經核准便會造成破壞的候選指令。在連續運作一週的測試中，度量該類潛在危險指令的湧現頻率。
3. 將根因推理的主力模型從 Claude Sonnet 4.7 替換為本地私有化託管的 Llama 3.3 70B。客觀測量 RCA 根因定位準確率的變動幅度，以及單個事故排查所耗費的具體推論成本。
4. 建置一套因果過濾機制：自動區分「彼此相關的遙測尖峰」與「真正的根本原因」。以 20 個測試場景的標籤訓練小型分類器。
5. 為自動回滾操作引入 Dry-Run 演練環境：在正式點選確認回滾前，ArgoCD 自動在具備相同清單的 Staging 預備叢集中先行模擬回滾演習，並將模擬回滾的健康檢查結果展示在 Slack 審批卡片內部。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| K8s knowledge graph |「叢集圖譜」| 節點是 K8s 物件與遙測序列；邊表示所有權、排程及觀測關係 |
| Read-only-by-default |「具範圍限制的 RBAC」| agent 的服務帳戶只有 get／list／describe 動詞；破壞性動詞則放在需經審批的另一台伺服器上 |
| Audit log |「已考慮與已執行」| 僅能附加的記錄，列出每個候選指令、是否執行及核准者 |
| Hypothesis ranking |「證據分數」| 時效性 × 特定性 × 圖路徑長度的倒數 × 引用數量 |
| Slack approval card |「人工介入閘門」| 含有補救按鈕的互動式 Slack 訊息；須由人員點選後 agent 才能繼續 |
| Telemetry citation |「證據指標」| 支持某項主張的 Prometheus 查詢、Loki 選取器或 Tempo trace URL |
| MTTR |「解決時間」| 從告警觸發到 SLO 回復所經過的實際時間 |

## Further Reading｜延伸閱讀

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年工業級 SRE Agent 權威標竿參考。
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 商業級 K8s 排障核心實踐。
- [NeuBird semantic monitoring](https://www.neubird.ai) — 基於語義拓撲圖譜的智慧監控架構。
- [Metoro AI SRE](https://metoro.io) — 以服務 SLO 為核心目標的正式環境維運框架。
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — K8s 叢集狀態資料權威來源。
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 複雜 Agent 流程編排官方儲存庫。
- [FastMCP](https://github.com/jlowin/fastmcp) — Python 原生 MCP 伺服器高效能開發框架。
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 具備門禁保護的自動化回滾目標端點。
