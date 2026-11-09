# إضفاء الطرف  محرك Apple Neural Engine، Qualcomm Hexagon، WebGPU/WebLLM، Jetson

> القيود الأساسية للقاعدة هي عرض النطاق الترددي للذاكرة، وليس الحساب. يجلس DRAM المحمول في 50-90 جيجابايت/ ثانية؛ مركز البيانات HBM3 يزيل 2-3 تي بي/ ثانية  فجوة 30-50x. فك الرمز يرتبط بالذاكرة لذا الفجوة حاسمة في عام 2026، تُقسم المناظر الطبيعية إلى أربعة أجزاء. محرك Apple M4 / A18 Neural Engine يصل إلى 38 TOPS مع ذاكرة موحدة (لا نسخة من CPUNPU). كوالكوم ستانابدراغون إكس النخبة / 8 جنرال 4 هيكساجون يصل إلى 45 TOPS. ويب جي بي يو + ويب إل إل إم تعمل على إلاما 3.1 8 بي (ق 4) عند ~ 41 توك / ثانية على M3 ماكس (حوالي 70-80٪ من الأصليين) ؛ 17.6k نجوم غيت هوب ، API متوافقة مع OpenAI ، ~ 70-75% تغطية المحمول. NVIDIA Jetson Orin Nano Super (8GB) يتناسب مع Llama 3.2 3B / Phi-3; AGX Orin يعمل gpt-oss-20b عبر vLLM عند ~ 40 tok / s. تدعم TensorRT Edge-LLM EAGLE-3 ، NVFP4 ، prefill prefill  المجزأة التي عرضت في CES 2026 من قبل Bosch ، ThunderSoft ، MediaTek.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## أهداف التعلم

- شرح لماذا استنتاج الجامعة المحمولة محدودة بالذاكرة والنطاق النطاق والحساب ثانوي.
- قم بإدراج الأهداف الأربعة (Apple ANE، Qualcomm Hexagon، WebGPU/WebLLM، NVIDIA Jetson) وتطابق كل منها مع حالة الاستخدام.
- أسمائ الفجوة في تغطية 2026 WebGPU (فايرفوكس أندرويد استيعاب) و Safari iOS 26 الهبوط.
- اختر تنسيق الكمي لكل هدف (Core ML INT4 + FP16 لـ ANE، QNN INT8/INT4 لـ Hexagon، WebGPU Q4 لمتصفح، NVFP4 لـ Jetson Thor).

## المشكلة

يريد العميل جهازًا على الجهاز: صوتًا أولاً ، خاصًا حسب الافتراض ، يعمل خارج الإنترنت. على MacBook Pro M3 Max ، يعمل Llama 3.1 8B Q4 عند ~ 55 توك / ثانية  على ما يرام. على iPhone 16 Pro ، يعمل نفس النموذج عند 3 توك / ثانية  على ما يرام. على Android من منتصف المدى مع Snapdragon 8 Gen 3, 7 توك / ثانية. في المتصفح عبر WebGPU على Chrome Android v121 + ، 4-8 توك / ثانية اعتمادًا على الجهاز.

إن اختلاف التوصيل ليس مشكلة نقل. إنها فجوة عرض النطاق المشترك × فجوة تنسيق الكميات إذا كان NPU متاحًا من مساحة المستخدم. استنتاج الحافة في عام 2026 هو أربعة مشاكل مختلفة مع أربعة حلول مختلفة.

## المفهوم

### عرض النطاق هو السقف الحقيقي

يقرأ التشفير مجموعة كاملة من الوزن لكل رمز. واحد من نماذج 7B في Q4 هو 3.5 GB. تقرأ 3.5 GB عند 50 GB / ثانية يستغرق 70 ms  سقف نظري من ~ 14 tok / s. عند 90 GB / s (DRAM المحمول عالي المستوى) يتحرك السقف إلى ~ 25 tok / s. لا توجد كمية من الحوسبة تساعد أقل من هذا الرقم.

مركز البيانات HBM3 عند 3 TB / ثانية يزيل نفس 3.5 GB في 1.2 ms  السقف هو 830 tok / s. نفس النموذج، نفس الوزن. مختلفة نظام تحت الذاكرة.

### محرك عصبي أبل (M4 / A18)

- ما يصل إلى 38 نقطة. ذاكرة موحدة (CPU و ANE يشتركون في نفس الحجم)  لا تكلفة نقل.
- الوصول عبر ML + Core `.mlmodel`النماذج المجمعة، أو عبر أجهزة أداء المعادن (MPS) من خلال PyTorch.
- Llama.cpp Metal backend يستخدم MPS ، وليس ANE مباشرة ؛ يتطلب ANE الأصلي تحويل Core ML.
- أفضل مسار عملي لتطبيقات iOS في عام 2026: ML الأساسي مع ثقيلات INT4 + تفعيلات FP16.

### كوالكوم هيكساجون (سنيب دراجون إكس النخبة / 8 جنرال 4)

- متكامل مع المعالجة المركزية و GPU في SoC ولكن مجال الذاكرة منفصل.
- QNN (Qualcomm Neural Network) SDK و AI Hub توفر تحويل من PyTorch / ONNX.
- نماذج الدردشة، إلاما 3.2، في 3 جميعها شحن كقطع أثرية من الدرجة الأولى على مركز الذكاء الاصطناعي.

### إنتل / AMD NPUs (بحيرة القمر، رايزن AI 300)

- 40-50 TOPS. البرمجيات تتخلف عن آبل / كوالكوم؛ OpenVINO يتحسن ولكن مكانة.
- أفضل لتطبيقات Windows ARM المعاونة؛ الأصلية على أجهزة مكتب AMD / Intel للمحلية أولا.

### ويب جي بي يو + ويب إل ام

- تشغيل نماذج في المتصفح عبر شاتر محاسبة WebGPU؛ لا تثبيت.
- Llama 3.1 8B Q4 عند ~ 41 توك / ثانية على M3 ماكس  حوالي 70- 80% من الأصلي عبر نفس الخلفية.
- 17.6k GitHub نجوم على WebLLM؛ OpenAI متوافقة API JS؛ Apache 2.0.
- تغطية 2026: كروم أندرويد v121+، سفاري iOS 26 GA، فايرفوكس أندرويد لا يزال يصل. تغطية محمولة إجمالية ~ 70-75%.

### عائلة (جيتسون)

- أورين نانو سوفر (8 جيجابايت): يتناسب مع إلاما 3.2 3 بي، في 3 عند تحديد المواقع في الثانية.
- AGX Orin: تعمل gpt-oss-20b عبر vLLM عند ~ 40 tok/s.
- ثور / T4000 (جيتباك 7.1): أداء 2x AGX Orin، EAGLE-3 و NVFP4 مدعومة.
- TensorRT Edge-LLM (2026) يدعم إيهجلي 3 تشفير التكهنات، وزن NVFP4، شقق المكملات السابقة  تحسينات مركز البيانات المحمولة إلى الحافة.

### اختيار الكميات لكل هدف

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### فخ طويل السياق على الحافة

إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار إطار

### الصوت هو التطبيق القاتل

وكلاء الصوت حساسون للضيق (الرمز الأول < 500 ms). الإستنتاج المحلي يزيل ضيق الشبكة بالكامل. الجمع مع الخطاب إلى النص (تغيرات ويسبر توربو تعمل على الحافة) ويحصل استستنتاج الحافة على حلقة الصوت من نوعية الإنتاج.

### أرقام يجب أن تتذكر

- أبل M4 / A18 ANE: 38 TOPS.
- كوالكوم هيكساجون SD X النخبة: 45 TOPS.
- ويبليم M3 ماكس: ~ 41 توك/ ثانية على Llama 3.1 8B Q4.
- AGX Orin: ~ 40 توك/ ثانية على gpt-oss-20b عبر vLLM.
- الفجوة في عرض النطاق بين مركز البيانات و الحافة: 30-50x
- تغطية الهواتف المحمولة من WebGPU: ~ 70-75% (تخلف في Firefox Android).

```figure
edge-bandwidth-pipe
```

## استخدمها

`code/main.py`يُحسب السقف النظري لإنتاج تشخيص النطاق من الرياضيات المحددة للفاصل على حدة النطاق عبر أهداف الحافة. يُقارن مع المعايير والمؤشرات الملاحظة حيث يكون عرض النطاق، وليس الحساب، عقد الزجاجة.

## أرسله

هذا الدرس يُنتج`outputs/skill-edge-target-picker.md`. تحدد المنصة (iOS/Android/browser/Jetson) والنموذج وميزانية التأخير/ذاكرة، تنسيق شكل الكميات وتحويل الأنابيب.

## التمارين

1. أركض`code/main.py`. بالنسبة لنموذج 7B في Q4 على Snapdragon 8 Gen 3 (~ 77 GB / س عرض النطاق) ، احسب سقف فك الرمز. مقارنة مع 6-8 tok / s الملاحظ  هل الوقت التشغيلي فعال؟
2. يتطلب WebGPU على Android Chrome v121 +. تصميم إعادة التشغيل للمصفحات القديمة  جانب الخادم عبر نفس API متوافقة OpenAI.
3. تطبيق iOS الخاص بك يحتاج إلى 4K-تواصل البث. أي نموذج / مجموعة من الشكل يسمح لك البقاء تحت 4 جيجابايت من الذاكرة النشطة على iPhone 16؟
4. جيتسون AGX Orin يعمل gpt-oss-20b في 40 توك / ثانية. جيتسون نانو يتناسب فقط 3B. إذا كان منتجك يستهدف كل منهما، كيف تجمع كومة الاستنتاج؟
5. جدل ما إذا كانت "WebLLM جاهزة للإنتاج في عام 2026". ذكر التغطية والأداء والفجوة في Firefox Android.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## المزيد من القراءة

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) المشهد والمؤشرات المرجعية.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) Orin / AGX / ثور.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/)إعلان الميناء الحدودي لعام 2026
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) التصميم والمعايير
- [Apple Core ML](https://developer.apple.com/documentation/coreml) تحويل من الأم
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) نماذج سابقة لـ Hexagon.
