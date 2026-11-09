# GPU Autoscaling در Kubernetes  کارپنتر، برنامه نویس KAI، برنامه ریزی گروه

> سه لایه، نه يک لایه کارپنتر به طور پویا (کمتر از یک دقیقه، 40٪ سریعتر از Cluster Autoscaler) برنامه ریزی KAI برنامه ریزی گروه، آگاهی از توپولوژی و صف های سلسله مراتبی را مدیریت می کند. این از تله اختصاصی جزئی 7 از 8 جلوگیری می کند که در آن 7 گره منتظر و بر روی یک GPU گم شده می سوزند. آوتوسکالرهای سطح برنامه نویسی (NVIDIA Dynamo Planner، llm-d Workload Variant Autoscaler) بر اساس سیگنال های خاص نتیجه گیری  عمق صف، استفاده از کیش KV  نه چرخه کاری CPU / DCGM. کلاسيک تله HPA اينه که`DCGM_FI_DEV_GPU_UTIL`یک اندازه گیری چرخه وظیفه است: 100٪ می تواند 10 درخواست یا 100 باشد. vLLM حافظه پیش از وقت KV را اختصاص می دهد، بنابراین حافظه هرگز مقیاس را کاهش نمی دهد. این درس به شما یاد می دهد که سه لایه را ترکیب کنید و از کارپنتر پیش فرض اجتناب کنید.`WhenEmptyOrUnderutilized`اين سيستم که در وسط اينفرنس، کار هاي GPU رو متوقف ميکنه

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## اهداف یادگیری

- سه لایه اتوماتیک مقیاس بندی (توفیه گره، برنامه ریزی گروه، سطح برنامه) را نمودار کنید و ابزار مورد استفاده در هر لایه را نام دهید.
- چرا توضیح بده`DCGM_FI_DEV_GPU_UTIL`یک سیگنال HPA برای vLLM اشتباه است و دو جایگزین را نام دهید (عمق ردیف، استفاده از کیش KV).
- برنامه ریزی گروه و حالت شکست بخش اختصاصی KAI Scheduler را توصیف کنید که مانع از (۷ از ۸ GPU بیکار) می شود.
- سیاست های تکثیر کارپنتر را ذکر کنید (`WhenEmptyOrUnderutilized`) که کار GPU را متوقف می کند و گزینه امن 2026 را اعلام می کند.

## مشکل

تو تیمت يه سرویس براي خدمات حقوق بشر رو در کوبرنتس ارسال ميکنه`DCGM_FI_DEV_GPU_UTIL`این در حالی است که این در حال حاضر به عنوان یک سیگنال است. پن های سرویس در 100٪ استفاده در طول ساعات کاری. HPA هرگز مقیاس  آن را فکر می کند که شما پر شده است. شما یک نسخه را به صورت دستی اضافه کنید. TTFT کاهش می یابد. HPA هنوز هم مقیاس نمی کند. سیگنال شما را دروغ می گوید.

به طور جداگانه، شما از Cluster Autoscaler برای گره ها استفاده می کنید. یک درخواست 1M-توکن در ساعت 2 صبح می آید؛ گره 3 دقیقه را صرف تهیه یک گره می کند و زمان درخواست را از بین می برد.

در یک مدل 70B که به 8 گپيو در 2 گره نیاز دارد، استفاده می شود. کلستر دارای 7 گپيو آزاد است که در 3 گپ منتشر شده است و به 1 گپ دیگر نیاز دارد. کلستر آتو اسکالر یک گپوی برای 1 گپيو گم شده را فراهم می کند. 7 گپيو ذخیره شده برای 4 دقیقه در حال سوختن پول هستند.

سه لایه، سه حالت شکست مختلف. خود مقیاس پذیری GPU در سال 2026 "HPA" نیست. این تشکیل دادن ذخیره سازی گره، برنامه ریزی گروه و خود مقیاس گذاری سیگنال های برنامه است.

## مفهوم

### لایه 1  تامین گره (کارپنتر)

کارپنتر در عرض 45-60 ثانیه، پوشه های منتظر و گره های ذخیره سازی را مشاهده می کند (Cluster Autoscaler معمولا 90 تا 120 ثانیه برای گره های GPU طول می کشد).`NodePool`محدودیت  اگر کپسول شما به 8 H100 نیاز دارد و کلستر هیچ گره ای مطابقت ندارد، کارپنتر به جای مقیاس بندی یک گروه موجود، به طور مستقیم یک گره را فراهم می کند.

**The consolidation trap**: کارپنتر به طور غیرمستقیم`consolidationPolicy: WhenEmptyOrUnderutilized`برای محفظه های GPU خطرناک است. این یک گره GPU اجرا را به صورت مهاجرت گره به یک نمونه مناسب ارزان تر می کند. برای بار کاری نتیجه گیری که به معنای اخراج درخواست های اجرا و بارگذاری مجدد یک مدل 70B در گره جدید است. از دست دادن دقیقه ظرفیت و شکست درخواست است.

تنظیم امن برای مجموعه های GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

اجازه می دهد کارپنتر بعد از یک ساعت لنز های واقعی خالی را متحد کند اما هرگز یک شغل اجرا را اخراج نکند.

### لایه 2  برنامه ریزی گروه (KAI Scheduler)

برنامه ریزی کننده KAI (پروژه "Karp" پس از آن نامگذاری شد) آنچه که برنامه ریزی کننده kube پیش فرض انجام نمی دهد را اداره می کند:

**Gang scheduling** برنامه همه یا هیچ. یک قاب تخفیف توزیع شده که 8 GPU نیاز دارد یا هر 8 شروع به یک یا هیچ. بدون این، شما به تله اختصاص جزئی می رسید: 7 از 8 قاب شروع می شود، به طور نامحدودی صبر می کند، پول می سوزاند.

**Topology awareness** بدانید که کدام GPU ها NVLink را به اشتراک می گذارند، که روی یک قفسه قرار دارند و InfiniBand بین آنها وجود دارد. به همین ترتیب پودها را قرار دهید. یک بار کاری تنسور متوازد DeepSeek-V3 67B باید در یک دامنه NVLink باقی بماند؛ KAI Scheduler این را احترام می گذارد.

**Hierarchical queues** تیم های متعدد برای یک مجموعه GPU با اولویت و کوتا رقابت می کنند. پیچ تولید تیم A فقط با کار آموزش تیم B پیشرو می شود اگر قوانین اولویت اجازه دهد.

KAI به همراه kube-scheduler به عنوان یک برنامه نویس ثانویه استفاده می شود؛ برای استفاده از آن، بار کاری را یادداشت می کنید.

### لایه 3  سیگنال های سطح کاربرد

**The HPA trap**.`DCGM_FI_DEV_GPU_UTIL`این یک متریک چرخه وظیفه است  این اندازه گیری می کند که آیا GPU در هر دوره نمونه گیری کار می کند. استفاده 100٪ می تواند به 10 درخواست همزمان یا 100 معنی داشته باشد؛ GPU به هر دو صورت مشغول بود. مقیاس در چرخه وظیفه به طور نابینا مقیاس می گیرد.

بدتر از این، vLLM و موتورهای مشابه پیش از این حافظه cache KV را اختصاص می دهند (تا `--gpu-memory-utilization`استفاده از حافظه حتی با یک درخواست نزدیک به 90 درصد باقی می ماند. HPA مبتنی بر حافظه هرگز کاهش نمی یابد.

**2026 replacement signals**:

- عمق صف (عدد درخواست هایی که منتظر پر کردن پیش بینی هستند)
- استفاده از KV cache (چه بخش از بلوک ها به دنباله های فعال اختصاص داده می شود).
- هر نسخه P99 TTFT (سیگنال SLA شما)
- تولید خوب (تطلبات ملاقات با تمام SLO ها در ثانیه)

NVIDIA Dynamo Planner و llm-d Workload Variant Autoscaler این سیگنال ها و نسخه های مقیاس را مصرف می کنند. آنها به طور کامل جایگزین HPA برای LLM خدمت می کنند.

### چه زمانی باید از چه

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### پر کردن / رمزگذاری پیش از تقسیم همه چیز را پیچیده می کند

اگر از پیش پر کردن/شکستن دسته بندی شده (فاز 17 · 17) استفاده کنید، دو کلاس پود با محرک های مقیاس بندی متفاوت دارید: مقیاس پود پر کردن قبل در عمق صف، مقیاس پود کید در فشار حافظه KV. llm-d این ها را به صورت جداگانه نشان می دهد `Services`با HPA هر نقش. سعی نکنید یک HPA را در مقابل هر دو قرار دهید.

### شروع سرد هم اينجا مهمه

کاهش شروع سرد (فاز 17 · 10) زمانی است که زمان ذخیره سازی گره به کاربر قابل مشاهده می شود. گرم شدن 45-60 ثانیه کارپنتر به علاوه بار مدل 20GB به علاوه موتور init به این معنی است که یک درخواست از صفر 2-5 دقیقه طول می کشد.`min_workers=1`) برای مسیرهای SLO-کریتیکی، یا از کنترل کنترل به سبک Modal در لایه کاربردی استفاده کنید.

### شماره هایی که باید به یاد داشته باشی

- تامین گره کارپنتری: ~ 45-60s در مقابل Cluster Autoscaler ~ 90-120s (گره GPU).
- برنامه ریزی KAI از تله های 7 از 8 از ضایعات توزیع جزئی جلوگیری می کند.
- `DCGM_FI_DEV_GPU_UTIL`به عنوان سیگنال HPA: شکسته شده؛ استفاده از عمق صف یا KV استفاده کنید.
- کارپنت`WhenEmptyOrUnderutilized`: کار GPU رو متوقف ميکنه`WhenEmpty + consolidateAfter: 1h`برای نتیجه گیری

```figure
autoscaling
```

## ازش استفاده کن

`code/main.py`شبیه سازی یک اتوماتیک سه لایه بر روی یک بار کاری GPU انفجار می کند. HPA ساده ( چرخه وظیفه) ، HPA عمق صف و مقیاس بندی برنامه ریزی شده توسط گروه KAI را مقایسه می کند. گزارش درخواست های برآورده نشده، دقیقه های بیکار GPU و نمره ترکیبی را گزارش می دهد.

## -باده

این درس به ما کمک می کند`outputs/skill-gpu-autoscaler-plan.md`با توجه به توپولوژی کلستر، شکل بار کاری و SLO، یک طرح سه لایه اتوماتیک مقیاس بندی را طراحی می کند.

## تمرینات

1. فرار کن`code/main.py`تحت یک بار کار پرتاب، چند درخواست HPA چرخه وظیفه ساده ای که HPA در عمق صف گرفتن می کند؟ تفاوت از کجا می آید؟
2. طراحی یک کارپنتر NodePool برای یک کلستر که Llama 3.3 70B FP8 را در H100 SXM5 خدمت می کند. مشخص کنید `capacity-type`،`disruption.consolidationPolicy`،`consolidateAfter`، و یک لکه که بار کاری غیر GPU را از این گره ها دور نگه می دارد.
3. تیم شما گزارش می دهد که انتشار در انتظار است چون "GPU ها در دسترس هستند اما قاب برنامه ریزی نمی کند". تشخیص دهید  آیا این کارپنتر، kube-تجزیه کننده، یا KAI برنامه ریزی کننده است؟ کدام متریک تایید می کند؟
4. يه سيگنال براي سيگنال هاي پيشکشي و سيگنال هاي ديگر براي سيگنال هاي رمزگشایی را انتخاب کن
5. هزینه ی `WhenEmptyOrUnderutilized`در یک سرویس تولید 24×7 که به طور متوسط 60 رویداد کاهش درخواست در روز در P99 TTFT > 10s است، تله konsolidاسیون وجود دارد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## خواندن بیشتر

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) اسناد طراحی و نمونه های پیکربندی
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) سیمانیک سیاست های تحکیم و معیارهای ایمن GPU
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) برنامه ريزي دينامو سيگنال هاي مقیاس
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) الگوی ادغام اشعه
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) راهنمایی های مدیریت شده مخصوص کوبرنتس
- [llm-d GitHub](https://github.com/llm-d/llm-d) طراحی متغیر Autoscaler بار کاری
