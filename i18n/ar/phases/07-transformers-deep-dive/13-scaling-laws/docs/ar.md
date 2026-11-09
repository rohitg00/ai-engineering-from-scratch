# قوانين الحجم

> ورقة كابلان 2020 قالت: نموذج أكبر، خسارة أقل. ورقة هوفمان 2022 قالت: كنت تحت التدريب. الحساب يذهب إلى علبين  المعلمات والرموز  والانقسام ليس واضحا.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## المشكلة

عندما يكون لديك C FLOPs من التدريب الحوسبة وتريد أفضل نموذج، تواجهين عقدين:

1. **How many parameters (N)?**نموذج أكبر، طاقة أكبر.
2. **How many training tokens (D)?**المزيد من البيانات، استخدام أفضل للقدرة.

مقياسات الفلو تقريباً `6 × N × D`يمكنك دفع N صعوداً و D أسفل، أو D صعوداً و N أسفل. أيّ من أفضل؟

قبل عام 2022 ، كانت الإجابة "دفع N بقوة". كانت GPT-3 (2020) معايير 175B تدرب على tokens ~ 300B. نسبة حوالي 1.7 tokens لكل معايير. قوانين مقياس كابلان تدعم هذا.

وجد هوفمان وآخرون (2022) ، الذين تدربوا على عائلة صغيرة من النماذج تسمى تشينشيلا ، شيئاً مختلفاً: النسبة المثلى أقرب إلى **20 tokens per parameter**. كان GPT-3 أقل تدريبًا 10x. كينشيللا (70B بارامز، 1.4T توكن) هزمت GPT-3 (175B، 300B توكن) على كل معيار بتكلفة استنتاج أقل 2.5x.

2026 هو عالم تشينشيلا  مع تحول واحد مهم. تم تدريب Llama 3 8B على 15 تريليون رمز ، وهو نسبة من 1,875 رمز لكل مبرر. تسعة وعشرون مرة الماضي تشينشيلا-أفضل. تكلفة التأثير مهمة أكثر من تكلفة التدريب للنماذج التي سيتم استخدامها على نطاق واسع ، لذلك التدريب الزائد (ماضي تشينشيلا) لذات الوقعة القابلة لتنفيذ أصغر هو افتراض 2026.

## المفهوم

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### قانون هوفمان

من ورقة "تشينشيلا" ، الخسارة هي:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= المعلمات (غير التضمين).
- $D$= رموز تدريب
- $\alpha \approx 0.34$،$\beta \approx 0.28$(تقريباً متماثل)
- $E \approx 1.69$، السقف الخسارة غير القابلة للتقليل
- $A \approx 406$،$B \approx 411$. . .

تعاملت مع شروط مع بعضها البعض كما تتحكم. خذ المشتقات w.r.t.$N$عند الحساب الثابت ($C = 6ND$و الحل.$\alpha$و$\beta$فوق، فإن المضربين يخرجون عند حوالي 0.45 ل $N$و 0.55 لـ$D$، لذلك النسبة المثلى بالضبط تتحرك ببطء مع الميزانية .`code/main.py`يجد ذلك عن طريق البحث عن الشبكة. أول اثنين من مقاربتين التكيفية في الورقة، التي تقيس المثالي مباشرة، وضع كل من المضربين في حوالي 0.5 . وهذا يعطي القاعدة التجريبية للنسبة الثابتة.$D = 20N$في$C = 6ND$والقاعدة العملاقة تقول:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

الحساب المثالي: 20 رمزا لكل مبرمج.

### لماذا تعليمه كثيرا على أي حال

التدريب المثالي يقلل من خسائر التدريب لكل تدريب فلوب ولكنك تدفع تكلفة التدريب مرة واحدة

بالنسبة لروبوتات الدردشة التي تخدم تريليون رمز شهرياً، فإن الاستنتاج يهيمن على التكلفة الإجمالية. نهج إلاما: القطار أصغر، أطول. 8B عند 15T رموز تحسن بشكل عميق الاستنتاج:

- يتناسب مع أجهزة البيانات البيانية المستهلكة
- التأخير جزء من 70B Chinchilla-مثل.
- الجودة قريبة بما فيه الكفاية لمعظم المهام

ورقة DeepMind 2024 ("التدريب الزائد هو المثالي الجديد") رسمية هذا. بالنسبة لحملات العمل التي تهيمن على الاستدلال، فإن النسبة الصحيحة أقرب إلى 100500 رمز لكل پیرامتر اعتمادًا على حجم الخدمة.

### الظهور مقابل السلاسة

الادعاء: بعض القدرات (العدل، التفكير متعدد الخطوات، اتباع سلسلة الفكر) "تظهر" فجأة على نطاق ما.

جادل Schaeffer et al. (2023) أن هذا هو عنصر قياس: تستخدم المقاييس الناشئة تسجيلات غير مستمرة (التطابق الدقيق، الدقة عند العدالة) التي تخفي تحسن سلس في اللوجيتات الأساسية. تظهر المقاييس المستمرة (الترابط المتقاطع) منحنى سلسة.

في عام 2026، يتوافق الإجماع على أن التنبؤات عن طريق الخسارة المستمرة موثوقة. قفزات المقياس غالبا ما تكون أثرية. تخطيط الميزانيات مقابل المقاييس المستمرة.

### الصورة لعام 2026

قوانين التوسع لا تزال تعمل، ولكن:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

أظهر محفز الميون (كيمي مون لايت ، 2024) زيادة في الحساب الفعال ~ 2 × على آدم ووت عند البيانات المقابلة. بعض عمليات التدريب 2026 تستخدم الميون بشكل افتراضي. يغير الثابت المطلق في قانون التوسع ، وليس شكله.

```figure
scaling-laws
```

## بناءها

انظر`code/main.py`نطبق معادلة خسائر (تشينشيل) و نحل لتحقيق الحساب المثالي$(N, D)$في كل من ميزانيات الحوسبة العديدة.

### الخطوة الأولى: فقدان الشينشيللا

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

قصة$L$كخط فوق$(N, D)$في ثابتة$C = 6ND$-اجد الحد الأدنى

### الخطوة الثانية: الحدود المثلى الحساب

لـ ميزانيات الحوسبة من`1e17`إلى`1e25`"فلو" ، أجد$(N, D)$التي تقلل من الخسائر$6ND = C$. تحقق من النسبة$D/N \approx 20$. . .

### الخطوة الثالثة: تكلفة التدريب الزائد

حساب الخسارة الإضافية التي تدفعها لتدريب نموذج أصغر 10 × (1/10 من N المثالي، 10 × D المثالي).

### الخطوة الرابعة: مقارنة مع النماذج الحقيقية

أرسلي إلى المعروف`(N, D)`أزواج GPT-3، Chinchilla، Llama 3 8B، DeepSeek- V3 (المتصفحات النشطة) ، ومقارنة الخسارة المتوقعة مقابل المبلغ عنها.

## استخدمها

من غير المرجح أن تدرب نموذج حدودي بنفسك لكن قوانين التوسع تقول لك

1. **Whether your fine-tune has enough data.**إذا كانت بياناتك الخاصة بالمهمة أقل من 20 رمز لكل شريط من النموذج الأساسي، فانتظر الاكتفاء في بعض مستوى الخسارة.
2. **Whether to pick a bigger base model.**إذا كنت تنفق كل ميزانيتك على الاستنتاج، تفضل نموذج أصغر، مدربة أكثر.
3. **Where the returns diminish.**وبالنسبة إلى ما هو أفضل من 1000 × Chinchilla، فإن تغييرات خسارة السجل تصبح ضجة.

**The research trajectory in 2026:**

- **Data-constrained regime.**يحتوي الويب على عدد محدود من الرموز ذات الجودة العالية (~ 510 تريليونات الإنجليزية بعد التصفية). يتقترب التدريب المسبق للحدود من هذا السقف. البيانات الاصطناعية والعددية اللغات والمتعددة الحالة والترتيب الدقيق على نطاق RLHF هي الجهاز التالي.
- **Compute-multiplier tricks.**تحسين الميونات، و MoE، تحسين إدارة البيانات  كل تحول ثابتات مطلقة، وليس asymptote.
- **Scaling laws for RL.**سؤال مفتوح. الأدلة المبكرة تشير إلى قانون القوة في عينات RL ولكن مع مؤشرات مختلفة جدا عن التدريب المسبق.

## أرسله

انظر`outputs/skill-training-budget-estimator.md`. المهارات تختار`(N, D, hours, GPU)`في إطار عملية تدريب جديدة، نظراً لقيود الحساب والقيود على التنفيذ والخسارة المستهدفة.

## التمارين

1. **Easy.**أركض`code/main.py`طبع " تشينشيلا " - مثالي$(N, D)$لـ ميزانيات الحوسبة `1e20`،`1e22`،`1e24`مقارنة مع الطاولة النموذجية الحقيقية.
2. **Medium.**تنفيذ منحنى خسارة هوفمان كعمل من الحساب.`log10(C)`لتحديد الحدود المثلى الحسابية، تحديد متى يتوقع القانون أننا سنحتاج$>10^{28}$(فلو) لخفض التقاطع للاندروبيات 0.1
3. **Hard.**تطبيق قانون التوسع الخاص بك على 5 نماذج صغيرة (100K إلى 10M بارام) تدرب على نفس مجموعة البيانات. تقدير $\alpha$و$E$ما مدى مدى توازن المُعبرين الخاصين بك مع المُعبرين المنشروين؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## المزيد من القراءة

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361)أول ورقة قانونية في مجال التوسع؛ غير متدربة.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)(شينشيللا)
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) ظهور كآلي قياس.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)لماذا تدريب (لاما) الزائد مناسب لعبوده
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) مضاعف الحساب 2 ×
