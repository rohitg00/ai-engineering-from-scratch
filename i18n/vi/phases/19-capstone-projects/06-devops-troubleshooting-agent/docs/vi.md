# Capstone 06  DevOps Trình tác giải quyết các vấn đề cho Kubernetes

> Trưởng DevOps của AWS đã đi GA, Resolve AI đã xuất bản sách chơi game K8s của mình, NeuBird đã thử nghiệm giám sát ngữ pháp, và Metoro đã gắn AI SRE với các SLO mỗi dịch vụ. Hình thức sản xuất đã được thiết lập: một máy báo động webhook phát nổ, một đại lý đọc đo lường từ xa, đi qua một biểu đồ của các vật thể K8, xếp hạng giả thuyết nguyên nhân gốc, và đăng một thư ngắn Slack với nút chấp thuận. Đọc chỉ theo mặc định. Mọi phương pháp chữa bệnh được một con người kiểm soát. Ngọc đá này là đại lý, được đánh giá trên 20 vụ việc tổng hợp và so sánh với đại lý của AWS trên ba vụ chia sẻ.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## Vấn đề

Câu chuyện SRE 2025-2026 trở thành: "Các nhân viên AI phân loại các sự cố, con người chấp thuận các biện pháp khắc phục". AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps tất cả đều đưa ra hình dạng này trong sản xuất. Các đại lý đọc Prometheus métrics, Loki logs, Tempo dấu vết, kube-state-metrics, và một biểu đồ kiến thức của các đối tượng K8. Nó tạo ra một giả thuyết gốc nguyên nhân xếp hạng với các trích dẫn về viễn thông trong vòng chưa đầy 5 phút. Nó không bao giờ thực hiện các lệnh hủy diệt mà không có sự chấp thuận của con người rõ ràng thông qua Slack.

Hầu hết công việc khó khăn là phạm vi và an toàn, không phải lý luận. Đại lý cần một bề mặt RBAC đọc-chỉ-by-default, một máy chủ công cụ MCP cứng, và nhật ký kiểm toán của mọi lệnh được xem xét và thực hiện. Nó cần biết khi nào nó nằm ngoài chiều sâu của nó và leo thang. Và nó phải chạy đủ rẻ để OOM-kill cascades không tạo ra một hóa đơn đại lý $ 5k.

## Khái niệm

Các nút là các đối tượng K8s (Pod, Deployments, Services, Nodes, HPAs, PVCs) cộng với các nguồn đo lường theo chiều dài (Prometheus series, Loki streams, Tempo traces).

Khi một cảnh báo phát nổ, tác nhân gây ra gốc từ đối tượng bị ảnh hưởng. Nó đi qua các cạnh, kéo các mảnh telemetry liên quan (tối cùng 15 phút) và soạn ra một giả thuyết. giả thuyết được xếp hạng bằng bằng chứng: bao nhiêu trích dẫn telemetry hỗ trợ nó, gần đây, cụ thể như thế nào. 3 giả thuyết hàng đầu đi đến Slack với hình ảnh đường viền và nút phê duyệt cho các hành động khắc phục.

Phục hồi được khóa. Các hành động mặc định được phép chỉ đọc. Các hành động phá hủy (thấp xuống, xoay lại, xóa Pods) yêu cầu sự chấp thuận Slack; các nếp nhăn xoay ArgoCD yêu cầu một mã thông báo mà đại lý không bao giờ giữ. nhật ký kiểm toán ghi lại mọi lệnh mà đại lý * xem xét *  không chỉ thực hiện  do đó quá trình xem xét bắt gần bị bỏ lỡ.

## Kiến trúc

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

## Thống

- Nguồn quan sát: Prometheus, Loki, Tempo, kube-state-metrics
- Hình đồ kiến thức: Neo4j (được quản lý) hoặc kuzu (đã nhúng) của các vật thể K8s + cạnh đo lường từ xa
- LangGraph với danh sách cho phép mỗi công cụ, chỉ đọc theo mặc định
- Truyền công cụ: FastMCP trên StreamableHTTP; máy chủ riêng cho các công cụ phá hủy phía sau cổng chấp thuận
- Mô hình: Claude Sonnet 4.7 cho lý luận gốc nguyên nhân, Gemini 2.5 Flash cho tổng kết nhật ký
- Phù hợp: ArgoCD rollback webhook, PagerDuty leo thang, thẻ phê duyệt Slack
- Kiểm toán: sổ sách có cấu trúc chỉ là phụ lục (được xem xét, thực hiện, phê duyệt, kết quả)
- Việc triển khai: K8s triển khai với vai trò RBAC hẹp riêng của nó; không gian tên riêng

```figure
ce-rootcause-walk
```

## Hãy xây dựng nó

1. **Graph ingestion.**Đồng bộ hóa các metrics kube-state thành Neo4j/kuzu mỗi 30s. Lớp: Pod, Deployment, Node, Service, PVC, HPA. Biên: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Biên lớp phủ điện tử: OBSERVED_BY (một Pod được quan sát bởi một chuỗi Prometheus).

2. **Alert receiver.**Endpoint FastAPI chấp nhận PagerDuty hoặc Alertmanager webhooks.

3. **Read-only tool surface.**Wrap kubectl, Prometheus query, Loki logql, Tempo traceql thông qua FastMCP. Mỗi công cụ có động từ RBAC hẹp ("get", "list", "describe"). Không có "delete", "exec", "scale" trong máy chủ mặc định.

4. **Root-cause agent.**LangGraph với ba nút: `sample`kéo đoạn đo điện thoại 15 phút cuối cùng,`walk`truy vấn biểu đồ cho các vật thể lân cận, `hypothesize`Các bản thảo xếp hạng các ứng cử viên gốc nguyên nhân với các trích dẫn về viễn thông.

5. **Evidence scoring.**Mỗi giả thuyết có điểm số = gần đây * đặc điểm * chiều dài đường viền ngược * số lượng trích dẫn.

6. **Slack brief.**Đăng một phụ lục với giả thuyết, hình ảnh đường đồ thị (một hình ảnh phụ đồ được hiển thị bên máy chủ), và các nút chấp thuận cho tối đa một hành động khắc phục.

7. **Remediation gate.**Các công cụ phá hủy (thấp giảm, lật ngược, xóa) sống trên một máy chủ MCP thứ hai sau một token chấp thuận.

8. **Audit log.**Chỉ cần thêm JSONL: cho mỗi lệnh ứng cử viên, ghi lại xem nó đã được xem xét, liệu nó đã được thực hiện hay không, ai đã phê duyệt nó.

9. **Synthetic incident suite.**Xây dựng 20 kịch bản: OOMKill cascade, DNS flap, HPA thrash, PVC fill, tiếng ồn, xe phụ bị lỗi, ConfigMap rollout xấu, quay chứng chỉ, thu hút hình ảnh backoff, vv Điểm đại lý trên chính xác gốc nguyên nhân và thời gian-to-hypothesis.

## Sử dụng nó

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

## Chuyển nó

`outputs/skill-devops-agent.md`Với một nhóm K8s và nguồn cảnh báo, đại lý tạo ra các giả thuyết gốc nguyên nhân và một dòng khôi phục Slack-gate.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## Các bài tập

1. Hãy chạy đại lý của bạn trên cùng ba sự cố mà đại lý DevOps của AWS đã được demo'd trên, xuất bản bên cạnh nhau, báo cáo nơi đại lý khác nhau.

2. Thêm một kiểm toán "các người bị bỏ lỡ" đánh dấu bất kỳ lệnh nào mà nhân viên * xem xét * sẽ gây hư hại nếu không được phê duyệt.

3. Thay đổi mô hình giả thuyết từ Claude Sonnet 4.7 thành Llama 3.3 70B tự lưu trữ. đo độ chính xác RCA delta và đô la cho mỗi sự cố.

4. Xây dựng một bộ lọc nguyên nhân: phân biệt các đỉnh điện đo tương quan với nguyên nhân gốc thực sự. Tập một bộ phân loại nhỏ trên các nhãn 20 kịch bản.

5. Thêm một rollback dry run: ArgoCD rollback chống lại một cluster giai đoạn với cùng một biểu đồ. Kiểm tra kế hoạch rollback trong một cluster sống trước nút Slack phê duyệt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## Đọc thêm

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): tài liệu tham chiếu của năm 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) tham chiếu đối thủ cạnh tranh
- [NeuBird semantic monitoring](https://www.neubird.ai) Phương pháp biểu đồ ngữ nghĩa
- [Metoro AI SRE](https://metoro.io) SLO- đầu tiên khung sản xuất
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) nguồn của trạng thái cluster
- [LangGraph](https://langchain-ai.github.io/langgraph/) Nhà tổ chức đại lý tham khảo
- [FastMCP](https://github.com/jlowin/fastmcp) Python MCP Server Framework
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) mục tiêu khôi phục bị đóng cửa
