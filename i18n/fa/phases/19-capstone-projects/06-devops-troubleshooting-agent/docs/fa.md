# Capstone 06  DevOps عامل حل مشکلات برای Kubernetes

> آژانس DevOps AWS به GA رفت، هوش مصنوعی حل کتاب های بازی K8s خود را منتشر کرد، NeuBird نظارت معنوی را نشان داد و Metoro AI SRE را به SLOs هر سرویس متصل کرد. شکل تولید تنظیم شده است: یک هشدار وب هوک آتش می زند، یک عامل از تلمتری می خواند، نمودار اشیاء K8s را می گذرد، فرضیه های علت ریشه را رتبه بندی می کند و یک خلاصه Slack را با دکمه های تایید ارسال می کند. فقط به طور پیش فرض قابل خواندن هر درماني که توسط يک انسان انجام ميده این سنگ پایین این عامل است که در 20 حادثه مصنوعی ارزیابی شده و در سه مورد مشترک با آژانس AWS مقایسه شده است.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## مشکل

داستان SRE 2025-2026 تبدیل شد: "آژان های هوش مصنوعی حوادث را تشخیص می دهند، انسان ها اصلاحات را تأیید می کنند". AWS DevOps Agent، Resolve AI، NeuBird، Metoro، PagerDuty AIOps همه این شکل را در تولید ارسال می کنند. مامور متریک Prometeus، Logs Loki، ردیاب Tempo، kube-state-metrics و یک نمودار دانش از اشیاء K8s را می خواند. این یک فرضیه ریشه ای با نقل قول های تلمتری در کمتر از پنج دقیقه تولید می کند. هيچ وقت دستورات مخرب بدون موافقت صريحي انسان از طريق Slack اجرا نميکنه

بیشتر کار سخت در مورد دامنه و ایمنی است نه استدلال. آژانس نیاز به سطح RBAC فقط به صورت پیش فرض، یک سرور ابزار MCP سخت و سوابق حسابرسی هر فرمان مورد بررسی و اجرا دارد. باید بداند که چه زمانی خارج از عمق آن است و افزایش یابد. و باید به اندازه کافی ارزان باشد که OOM-kill cascades باعث ایجاد یک لایحه آژانس 5k نمی شود.

## مفهوم

این عامل بر اساس یک نمودار دانش عمل می کند. گره ها اشیاء K8s (Pods، Deployments، Services، Nodes، HPAs، PVCs) و منابع telemetry (سلسلسل Prometeus، جریان Loki، ردیابی Tempo) هستند. حاشیه ها مالکیت (Pod -> ReplicaSet -> Deployment) ، برنامه ریزی (Pod -> Node) و مشاهده (Pod -> سری Prometeus) را رمزگذاری می کنند. نمودار توسط یک ترکیب آمارهای kube-state و دوباره نمونه گیری در هر هشدار نگهداری می شود.

هنگامی که یک هشدار می گیرد، عامل ریشه را از شیء آسیب دیده ایجاد می کند. آن کنار ها را حرکت می کند، قطعات تلهметری مربوطه را (۱۵ دقیقه اخیر) کشیده و یک فرضیه را طراحی می کند. فرضیه با شواهد رتبه بندی می شود: چه تعداد نقل قول تلهметری را پشتیبانی می کند، چقدر اخیر است، چقدر مشخص است. اولین ۳ فرضیه به Slack با تجسمات گرافیک مسیر و دکمه های تأیید برای اقدامات اصلاح می روند.

اصلاح گات شده است. اقدامات پیش فرض مجاز فقط برای خواندن هستند. اقدامات مخرب (سکیل کردن پایین، رول کردن عقب، حذف پود) نیاز به تایید Slack دارند؛ هک های رول بیک ArgoCD نیاز به یک توکن auth دارند که عامل هرگز نگه دارد. دفترچه حسابرسی هر فرمان را که عامل *نظر گرفته *  نه فقط اجرا شده  به طوری که روند بررسی تقریباً از دست می دهد.

## معماری

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

## دسته

- منابع مشاهده: Prometeus، Loki، Tempo، kube-state-metrics
- نمودار دانش: Neo4j (مدار) یا kuzu (دربنده) از اشیاء K8s + لبه های تله متری
- عامل: لانگ گراف با لیست اجازه هر ابزار، فقط برای خواندن به طور پیش فرض
- حمل و نقل ابزار: FastMCP بر روی StreamableHTTP؛ سرور جداگانه برای ابزارهای تخریب کننده در پشت دروازه تأیید
- مدل ها: کلاود سونت 4.7 برای استدلال ریشه ای، دوقلوها 2.5 فلش برای خلاصه ی روزنامه
- اصلاح: ArgoCD رول بیک وب هوک، PagerDuty افزایش، کارت تایید Slack
- حسابرسی: دفترچه ساختاری تنها به عنوان افزودن (برنظر گرفته، اجرا شده، تأیید شده، نتیجه)
- انتشار: K8s با نقش محدود خود RBAC؛ فضای نام جداگانه

```figure
ce-rootcause-walk
```

## آن را بسازید

1. **Graph ingestion.**هر 30 سال به Neo4j/kuzu هم وقت ساز کنید. گره ها: Pod، Deployment، Node، Service، PVC، HPA. کناره ها: OWNED_BY، SCHEDULED_ON، EXPOSES، MOUNTS، SCALES. کناره های پوشش تلتمیتری: OBSERVED_BY (یک Pod توسط یک سری Prometheus مشاهده می شود).

2. **Alert receiver.**نقطه پایان FastAPI که وب هاک های PagerDuty یا Alertmanager را قبول می کند.

3. **Read-only tool surface.**Wrap kubectl، پرسشی Prometeus، Loki logql، Tempo traceql از طریق FastMCP. هر ابزار دارای فعل RBAC باریک ("بگذار"، " لیست"، " توصیف") است. هیچ "حذف"، "exec"، " مقیاس" در سرور پیش فرض نیست.

4. **Root-cause agent.**لنگ گراف با سه گره: `sample`از قسمت تلمتري 15 دقيقه گذشته استفاده ميکنه`walk`سوال از نمودار برای اجسام همسایه`hypothesize`طرح ها کاندیداهای علت اصلی را با نقل قول های تلمتری رتبه بندی می کنند.

5. **Evidence scoring.**هر فرضیه دارای نمره = اخیر بودن * مشخصه * طول مسیر نمودار معکوس * تعداد نقل قول است.

6. **Slack brief.**یک ضمیمه با فرضیه، تصویربرداری مسیر گرافیک (تصاویر زیرگرافیک در طرف سرور ارائه شده) و دکمه های تأیید برای حداکثر یک اقدام اصلاحی ارسال کنید.

7. **Remediation gate.**ابزار های تخریب کننده (مقدار پایین، بازگردانیدن، حذف) در یک سرور MCP دوم پشت یک توکن تأیید زنده هستند. آژانس می تواند آنها را تنها پس از تایید کارت Slack توسط یک انسان تماس بگیرد.

8. **Audit log.**فقط JSONL اضافه کنید: برای هر دستور کاندید، ثبت کنید که آیا مورد بررسی قرار گرفته است یا اجرا شده است، چه کسی آن را تأیید کرده است. روزانه به S3 ارسال کنید.

9. **Synthetic incident suite.**20 سناریو بسازید: OOMKill cascade، DNS flap، HPA thrash، PVC fill، همسایه های سر و صدای بلند، ساید کار ناقص، انتشار خراب ConfigMap، چرخش گواهینامه، بازخورد تصویر، و غیره. امتیاز دهنده را بر اساس دقت علت ریشه و زمان به فرضیه.

## ازش استفاده کن

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

## -باده

`outputs/skill-devops-agent.md`با توجه به کلستر K8s و منبع هشدار، عامل فرضیه های ریشه ای مرتب و جریان درمان Slack-gate را تولید می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## تمرینات

1. با همين سه حادثه که مامور DevOps AWS رو آزمايش کرد خبرشو به هم بذاريد

2. اضافه کردن یک حسابرسی "تقریباً از دست رفته" که هر فرمانی را که عامل * به نظر می رسد * بدون تأیید تخریب کننده باشد نشان می دهد. نرخ نزدیک به دست رفتن را در طول یک هفته اندازه گیری کنید.

3. مدل فرضیه رو از کلود سونت 4.7 به Llama 3.3 70B خود میزبان عوض کن

4. فیلتر علت: تقاطع تله متری مرتبط را از یک علت اصلی تشخیص دهید. طبقه بندی کوچک را بر روی برچسب های 20 سناریو آموزش دهید.

5. اضافه کردن یک رول بیک خشک: رول بیک ArgoCD در برابر یک کلستر مرحله بندی با همان مانیست. برنامه رول بیک را در یک کلستر زنده قبل از دکمه تایید Slack بررسی کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## خواندن بیشتر

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): مرجع کاینونیکی 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) مرجع رقبای
- [NeuBird semantic monitoring](https://www.neubird.ai) رویکرد گراف معنوی
- [Metoro AI SRE](https://metoro.io) چارچوب تولید SLO-اول
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) منبع کلستر
- [LangGraph](https://langchain-ai.github.io/langgraph/) ارگنت مرجع سازنده
- [FastMCP](https://github.com/jlowin/fastmcp) چارچوب سرور Python MCP
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) هدف اصلاحات بسته
