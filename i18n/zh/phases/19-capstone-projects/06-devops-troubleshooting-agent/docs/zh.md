# 卡普斯通 06  库伯尼特斯的 DevOps 解决问题代理

> 亚华斯的DevOps代理进入GA,Resolve AI发布了K8s的游戏书籍,NeuBird演示了语义监测,Metro将AI SRE与每服务SLO联系起来. 制作形状已经确定:一个警报网络火,一个代理阅读远程测量,行走K8s对象的图表,排列根源假设, 默认情况下只能读取. 每个被人类关门的补救措施. 这块顶石是那个代理, 通过20起合成事件进行评估,

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

根据"人工智能"的描述,人工智能代理会对事件进行分类,人类会批准修复. 代理阅读普罗梅斯指标,洛基日志,泰波指标,Kube状态指标,以及K8对象的知识图. 它在不到五分钟内产生了与远程测量引用的排列根原因假设. 它从来没有通过Slack得到人类的明确批准.

经理需要一个默认只读的RBAC表面,一个硬化的MCP工具服务器,以及对每一个被考虑和执行的命令的审计日志.它需要知道它在什么时候超出了它的深度和升级.而且它必须运行足够便宜,OOM杀死场不会产生5k的经理账单.

## 概念

经纪人运作在知识图上.节点是K8s对象 (Pod,部署,服务,节点,HPA,PVC) 加上远程测量源 (Prometheus系列,Loki流,Tempo痕迹).边缘编码所有权 (Pod ->ReplicaSet ->部署),规划 (Pod -> Node),观察 (Pod -> Prometheus系列).图表通过 kube-state-metrics同步并在每个警报中重新采样.

当警报发射时,该代理从受影响对象中根源.它走边,拉出相关的远程测量切片 (最后15分钟),并草图了一个假设.假设由证据排列:有多少远程测量引用支持它,最近多久,具体多大.前三种假设将与图形路径可视化和修复行动的批准按一起进入 Slack.

修复是关闭的.允许默认操作是仅读的.破坏性操作 (缩小,滚回,删除Pod) 需要Slack批准;ArgoCD滚回需要代理永远不会持有的 auth代币.审计日志记录了代理 *考虑*  不仅执行的每一个命令,因此审查过程几乎没有错误.

## 建筑

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

## 堆

- 观察性来源:普罗梅泰斯,洛基,特马波,库贝状态测量
- 知识图:K8s对象的Neo4j (管理) 或 kuzu (嵌入式) +远程测量边缘
- 机器人:每工具允许列表的LangGraph,默认只能读取
- 工具运输:FastMCP 通过 StreamableHTTP; 通过通过门后的破坏性工具的单独服务器
- 模型:Claude Sonnet 4.7用于根源推理,双胞胎 2.5 闪存用于日志总结
- 补救:ArgoCD滚动网关,PagerDuty升级,Slack批准卡
- 审计:仅附录结构日志 (审议,执行,批准,结果)
- 部署:K8部署,具有自己的狭窄的RBAC角色;单独的名称空间

```figure
ce-rootcause-walk
```

## 建立它

1. **Graph ingestion.**每30年将ube-state-metrics同步到Neo4j/kuzu.节点:Pod,部署,节点,服务,PVC,HPA.边缘:OWNED_BY,SCHEDULED_ON,EXPOSES,MOUNTS,SCALE.电测量覆盖边缘:OBSERVED_BY (一个Pod由Prometheus系列观察).

2. **Alert receiver.**快API终端接收PagerDuty或Alertmanager网络链接. 提取受影响的对象 (s) 和SLO违规.

3. **Read-only tool surface.**包裹 kubectl,Prometheus查询,Loki logql,Tempo traceql通过FastMCP.每个工具都有一个狭窄的RBAC动词 ("获取","列表","描述").默认服务器中没有"删除","exec","规模".

4. **Root-cause agent.**具有三个节点的兰格格拉夫: `sample`拉出了最后15分钟的遥测器片段,`walk`查询邻近物体的图表,`hypothesize`根据远程测量引用,

5. **Evidence scoring.**每个假设都有分数 = 近期 * 具体性 * 图形路径长度反转 * 引用数.返回前-3.

6. **Slack brief.**附加一个附加值,包含假设,图形路径可视化 (一个服务器侧的子图像),以及最多一个修复行动的批准按.

7. **Remediation gate.**破坏性工具 (缩小,倒滚,删除) 在批准代币后的第二个MCP服务器上存活.经纪人只能在Slack卡被人批准后调用它们.

8. **Audit log.**仅添加JSONL:每一个候选命令,记录是否被考虑,是否执行,谁批准它. 每天运送到S3.

9. **Synthetic incident suite.**构建20种场景:OOMKill,DNS,HPA,PVC填充,杂的邻居,故障的侧车,ConfigMap部署不佳,证书旋转,图像拉回,等.

## 用它

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

## 运送它

`outputs/skill-devops-agent.md`由于K8s集群和警报来源, 代理产生排列的根原因假设和一个Slack-gated补救流.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## 运动

1. 运行你的代理在同一三个事件上 AWS 的 DevOps 代理被演示了. 发布一边一边. 报告代理在哪里分歧.

2. 添加一个"接近错失"审计,标记出代理认为没有批准的任何命令是破坏性的.

3. 换个假设模型从克劳德·索内特4.7到一个自主托管的Llama 3.3 70B.

4. 建立一个因果过器:区分相关的远程测量峰值与真正的根源. 训练一个小的分类器在20场景标签上.

5. 加入反弹干跑:ArgoCD反弹对一个具有相同的表格的阶段集群.在 Slack 批准按之前,在现场集群中验证反弹计划.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## 进一步阅读

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/):2026年"法典"引用
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai)竞争对手的参考
- [NeuBird semantic monitoring](https://www.neubird.ai)语义图方法
- [Metoro AI SRE](https://metoro.io) SLO-第一生产框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics)集群状态来源
- [LangGraph](https://langchain-ai.github.io/langgraph/) 参考代理主管
- [FastMCP](https://github.com/jlowin/fastmcp) Python MCP服务器框架
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/)关闭的补救目标
