# كابستون 06  DevOps وكيل حل المشاكل لـ Kubernetes

> وكيل ديفوبس في AWS ذهب إلى GA، وشركت Resolve AI كتابات تشغيل K8s، واكتشف NeuBird مراقبة معنوية، وربط Metoro AI SRE إلى SLOs لكل خدمة. يتم تحديد شكل الإنتاج: تنبيه ويب هوك يطلق، وكيل يقرأ التلفاز، يمر على الرسم البياني للكائنات K8s، يصنف فرضيات السبب الجذري، و ينشر قصر Slack مع أزرار الموافقة. القراءة فقط حسب الاختيار كل علاج يُعاقبه إنسان هذه الحجر النهائي هو ذلك العميل، تم تقييمها على 20 حوادث اصطناعية ومقارنة مع وكيل AWS على ثلاث حالات مشتركة.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## المشكلة

أصبح رواية 2025-2026 SRE: "مُخدرات العناصر الذكية تصنف الحوادث، يوافق البشر على التعويضات". وكيل AWS DevOps، حل AI، NeuBird، Metoro، PagerDuty AIOps جميعها ترسل هذا الشكل في الإنتاج. العميل يقرأ مقاييس Prometheus، سجلات لوكي، آثار Tempo، كوب-حالة-مقاييس، وخط المعلومات من كائنات K8s. إنه ينتج فرضية سبب جذري مرتبة مع استشهادات التليميترية في أقل من خمس دقائق. لا تنفذ أوامر مدمرة أبداً دون موافقة بشرية صريحة من خلال (سلاك)

معظم العمل الشاق هو التدقيق والسلامة ، وليس التفكير. يحتاج الوكيل إلى سطح RBAC القراءة فقط حسب الافتراض ، وخادم أداة MCP متشدد ، وقوائم مراجعة كل أمر يتم النظر فيه مقابل تنفيذه. يحتاج إلى معرفة متى يكون خارج عمقها وتصاعد. ويجب أن يعمل رخيصًا بما فيه الكفاية بحيث لا تولد طوابع قتل OOM فاتورة وكيل بقيمة 5K دولار.

## المفهوم

يعمل العميل على الرسم البياني المعرفة. العقدة هي كائنات K8s (بودز ، وتطبيقات ، وخدمات ، وعقدات ، HPAs ، PVCs) بالإضافة إلى مصادر التلفاز (سلسلة Prometheus ، تيار Loki ، آثار Tempo). ترمز الحواف الملكية (بود -> ReplicaSet -> التطبيق) ، والجدول (بود -> Node) ، والملاحظة (بود -> سلسلة Prometheus). يتم الحفاظ على الجراف جديد من خلال مزامنة الميترات الكوب-الوضعية وإعادة العينة في كل تنبيه.

عندما يطلق الإنذار، يسبب العامل الجذر من الكائن المتضرر. يمر على الحواف، ويسحب شرائح التليمترية ذات الصلة (الأخيرة 15 دقيقة) ، ويصمم فرضية. يتم تصنيف الفرضية حسب الأدلة: كم من اقتباسات التليمترية تدعمها، كم هي حديثة، كم هي محددة. تذهب الفرضيات الأولى إلى Slack مع تصورات مسار الرسم البياني وأزرار الموافقة على إجراءات التعافي.

يتم إصلاح الإصلاح. يتم السماح بإجراءات الافتراضية فقط بقراءة. تتطلب الإجراءات المدمرة (إخفض النطاق، إعادة التدفق، حذف الأقراص) موافقة Slack؛ تتطلب معقبات إعادة التدفق ArgoCD رمز auth لا يحمله الوكيل. سجل سجل المراجعة كل أمر يُعتبر الوكيل * يُعتبر *  لا يتم تنفيذه فقط  لذلك فإن عملية المراجعة تلتقط القليل من الخسائر.

## الهندسة المعمارية

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

## الـ"كثيرة"

- مصادر الملاحظة: Prometheus، Loki، Tempo، kube-state-metrics
- الرسم البياني المعرفة: Neo4j (مدار) أو kuzu (مدمج) من كائنات K8s + حواف التلفونية
- الوكيل: لنجراف مع قائمة السماح لكل أداة، فقط القراءة حسب الاختيار
- نقل الأدوات: FastMCP على StreamableHTTP؛ خادم منفصل للأدوات المدمرة وراء بوابة الموافقة
- النماذج: كلود سونيت 4.7 للتفكير في الأسباب الجذرية، جيميني 2.5 فلاش لجمع السجلات
- الإصلاح: أرقو سي دي رول بيك الويب، PagerDuty تصاعد، بطاقة موافقة سلاك
- المراجعة: سجل مهيكلي فقط (المراجعة، والتنفيذ، والموافقة، والنتيجة)
- النشر: النشر K8s مع دورها الضيق RBAC الخاص؛ مساحة أسماء منفصلة

```figure
ce-rootcause-walk
```

## بناءها

1. **Graph ingestion.**مزامنة المقاييس الحالة إلى Neo4j / kuzu كل 30 عاما. العقد: Pod، نشر، عقدة، خدمة، PVC، HPA. الحواف: OWNED_BY، SCHEDULED_ON، EXPOSES، MOUNTS، SCALES. حواف التغطية التليميترية: OBSERVED_BY (يتم ملاحظة Pod بواسطة سلسلة Prometheus).

2. **Alert receiver.**نقطة نهاية FastAPI التي تقبل PagerDuty أو Alertmanager الويب هوك. استخراج الكائن المتضرر (s) وانتهاك SLO.

3. **Read-only tool surface.**لف kubectl، استفسار Prometheus، Loki logql، Tempo traceql من خلال FastMCP. كل أداة لديها فعل RBAC ضيق ("حصل"، "القائمة"، "تصف"). لا يوجد "حذف"، "إجازة"، "مقياس" في الخادم الافتراضي.

4. **Root-cause agent.**لنجراف مع ثلاث عقدات: `sample`سحب قطعة التلفونية الـ15 دقيقة الأخيرة`walk`تسأل عن الرسم البياني لأشياء مجاورة`hypothesize`مسودات تصنيف المرشحين بسبب الجذر مع اقتباسات التلفاز.

5. **Evidence scoring.**كل فرضية لديها درجة = حديثة * تحديد * طول الرسم البياني - المسار العكسي * عدد المشاركات. عودة أعلى 3.

6. **Slack brief.**ضع ملحقًا مع الفرضية ، وتصور مسار الرسم البياني (صورة فرعية عرضت على جانب الخادم) ، وأزرار الموافقة على إجراء إصلاح واحد على الأكثر.

7. **Remediation gate.**أدوات مدمرة (تقلل النطاق، تراجع، حذف) تعيش على خادم MCP الثاني خلف رمز الموافقة. يمكن للعميل الاتصال بها فقط بعد موافقة بطاقة Slack من قبل الإنسان.

8. **Audit log.**إضافة فقط JSONL: لكل أمر مرشح، سجل ما إذا كان قد تم النظر فيه، ما إذا كان قد تم تنفيذه، من الذي وافق عليه. شحن إلى S3 يوميا.

9. **Synthetic incident suite.**بناء 20 سيناريو: OOMKill cascade، DNS flap، HPA thrash، PVC ملء، الجوار الضجيج، سيارة جانبية خاطئة، ConfigMap سوء التنفيذ، دوران الشهادة، سحب الصورة الاحتياطي، إلخ.

## استخدمها

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

## أرسله

`outputs/skill-devops-agent.md`وبالنظر إلى مجموعة K8s ومصدر التحذير، فإن الوكيل ينتج فرضيات سبب الجذر المرتبة وتدفق إصلاحية مع غرفتة.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## التمارين

1. إشغلي عميلك على نفس الحوادث الثلاثة التي تمّ إثبات عميل "ديف أوبز" في "أو إس إس" عليها، نشري الأمر جانباً إلى جانبه، وقل أين يختلف العميل.

2. إضافة مراجعة "قريبة من الإغفال" التي ترمز أي أمر كان الوكيل * يعتبر * التي كانت مدمرة دون موافقة. قياس معدل الإغفال على مدى أسبوع.

3. قم بتغيير نموذج الفرضية من (كلود سونيت) 4.7 إلى (لاما) 3.3 70B المضيفة الذاتية. قم بتقييم ديلتا دقة (آر سي اي) والدولار لكل حادثة.

4. بناء مرشح سببي: تمييز النقاط المتصلة في التلفاز عن سبب جذري حقيقي. تدريب تصنيف صغير على علامات 20 سيناريو.

5. إضافة عملية التدفق الجاف: إعادة التدفق ArgoCD ضد مجموعة التدفق ذات نفس المخطط. تحقق من خطة التدفق في مجموعة حية قبل زر الموافقة Slack.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## المزيد من القراءة

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): المرجع الكانوني لعام 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) مرجع المنافس
- [NeuBird semantic monitoring](https://www.neubird.ai) مقاربة الرسم البياني
- [Metoro AI SRE](https://metoro.io) إطار الإنتاج الأول من SLO
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) مصدر الدولة المجموعة
- [LangGraph](https://langchain-ai.github.io/langgraph/) وكيل مرجعية الموسيقي
- [FastMCP](https://github.com/jlowin/fastmcp)إطار خادم Python MCP
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) هدف التعافي المُغلق
