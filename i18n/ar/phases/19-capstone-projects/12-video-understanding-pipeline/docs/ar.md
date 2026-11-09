# كابستون 12  الفيديو فهم خط الأنابيب (المشهد، QA، البحث)

> 12 مختبرة أنتجت مارينغو + بيغاسوس. (فيديو دي بي) أرسلت (CRUD-for-video API) (مولمو 2) من (إي آي 2) أعلن عن فتح نقاط تفتيش (فيلم التوأم يتعامل مع ساعات الفيديو بشكل طبيعي تعريف TimeLens-100K التأريخ الزمني على نطاق واسع. تم تسوية خط الأنابيب لعام 2026: قسم المشهد، وصف لكل مشهد + إضافة، وتحديد النصوص، ومؤشر متعدد المتجهات، ومسألة تجيب مع (بدء، نهاية) طوابع زمنية بالإضافة إلى مشاهدات الإطار. الحجر النهائي يتناول 100 ساعة، يصل إلى المعايير العامة، ويقيس الهلوسة على الأسئلة العد والعمل.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## المشكلة

قاعدة الفيديو الطويلة هي مشكلة متعددة الحركات الأكثر جشعاً للوضوح النطاق في مقياس 2026. يمكن أن يقرأ جيميني 2.5 برو فيديو لمدة ساعتين بشكل طبيعي، ولكن استهلاك 100 ساعة من الفيديو في جسم قابل للتسجيل لا يزال يتطلب مؤشر مستوى المشهد. يجمع شكل الإنتاج بين قسم المشهد (TransNetV2 أو PySceneDetect) ، والقسم لكل المشهد مع VLM (Gemini 2.5 ، Qwen3-VL-Max ، أو Molmo 2) ، وتحديد النصوص (Whisper-v3-turbo مع طوابع زمنية الكلمة) ، ومرجع متعدد المتجهات الذي يحفظ القسم والإطار المضمن والقسم جانباً إلى جانبه. استجابة خط البحث مع (بدء، نهاية) علامات زمنية بالإضافة إلى عرض إطار.

علامات الاستعراضية عامة (ActivityNet-QA ، NeXT-GQA) بالإضافة إلى مجموعة مخصصة الخاصة بك من 100 سؤال. الهلوسة على الأسئلة العد والنوع من العمل هي فئة الفشل المعروفة-الصلبة.

## المفهوم

ثلاثة خطوط أنابيب تعمل بالتوازي عند الإبتلاع**Scene segmentation**يقطع الفيديو إلى مشاهد.**VLM captioning**يخلق عنوان لكل مشهد و إطار مدمج من إطار مفاتيح**ASR alignment**تنتج علامات زمنية على مستوى الكلمات. يتم دمج ثلاث تيارات (scene_id، interval time). كل مشهد يحصل على ثلاثة أنواع متجهة في مؤشر متعدد المتجهات (Qdrant): إدراج الأسطوانات، إدراج الإطار الرئيسي، إدراج النص المتحرك.

في وقت الاستفسار، يطلق السؤال اللغوي الطبيعي ضد جميع المتجهات الثلاثة؛ والنتائج تتضامن مع RRF؛ ومعدل التأرجح الزمني (طريقة TimeLens) يضبط نافذة (بدء، نهاية) داخل المشهد العلوي. يقوم جهاز VLM (Gemini 2.5 Pro أو Qwen3-VL-Max) بتحويل الاستفسار + المشهد العلوي + الإطارات المقطوعة والجوابات مع طوابع الزمن المشار إليها ومشاهدة مسبقة للإطارات.

إن قياس الهلوسة مهم. أسئلة العد ("كم من الناس يدخلون الغرفة؟") ونوع العمل ("هل يقوم الطاهي بالسكب قبل أن يخلط؟") غير موثوقة بشكل سيء. قم بتقديم الدقة بشكل منفصل عن الأسئلة الوصفية.

## الهندسة المعمارية

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## الـ"كثيرة"

- قسم المشهد: TransNetV2 (أحدث 2024-26) أو PySceneDetect
- ASR: Whisper-v3-turbo عبر أسرع-سوسر مع علامات زمنية الكلمة
- VLM كابشن + الجواب: Gemini 2.5 Pro أو Qwen3-VL-Max أو Molmo 2
- التأريخ الزمني: جهاز التكيف المدرب على TimeLens-100K أو VideoITG
- المؤشر: Qdrant مع دعم متعدد المتجهات (الترجمة / الإطار / النص)
- واجهة الوصول: Next.js 15 مع محرك تشغيل الفيديو HTML5 ومقاطع المشهد
- Eval: ActivityNet-QA، NeXT-GQA، مجموعة مخصصة لـ 100 سؤال مع علامة يدوية
- مقياس الهلوسة: مجموعة فرعية للعد والنوع من العمل مع علامات يدوية

```figure
cf-scene-index
```

## بناءها

1. **Ingest walker.**اقبل عناوين URL على YouTube أو MP4 المحلية. تنخفض إلى 720p إذا لزم الأمر. اصمت`{video_id, file_path}`. . .

2. **Scene segmentation.**تشغيل TransNetV2 أو PySceneDetect لإنتاج `[{scene_id, start_ms, end_ms, keyframe_path}]`الهدف 100 ساعة: 6K-8K مشاهد.

3. **ASR pass.**تشغيل Whisper-v3-turbo على الصوت؛ تصدير العلامات الزمنية على مستوى الكلمة؛ تقسيم إلى شرائح النسخ لكل مشهد.

4. **VLM captioning.**لكل مشهد، اتصل بـ Gemini 2.5 Pro (أو Qwen3-VL-Max) مع الإطار المفتاحي ومعملة قصيرة. قم بتحويل الإطار + الإطار.

5. **Multi-vector index.**مجموعة Qdrant مع ثلاثة متجهات مسموحة.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`. . .

6. **Query.**السؤال في اللغة الطبيعية يطلق ثلاثة أسئلة كثيفة؛ الاندماج مع اندماج الترتيب المتبادل؛ أعلى ك = 5 مشاهد.

7. **Temporal grounding.**تشغيل جهاز التكيف في نمط TimeLens على المشهد العلوي لتصميم نافذة (بدء، نهاية) داخل المشهد.

8. **VLM synth.**اتصل بـ Gemini 2.5 Pro مع استفسار + مقاطع المشهد الثلاثة الأولى (كصور أو مقاطع قصيرة) + نسخ.`(video_id, start_ms, end_ms)`الإستشهادات

9. **Eval.**تشغيل ActivityNet-QA و NeXT-GQA. قم ببناء مجموعة مخصصة لـ 100 استفسار. قم بتقديم تقرير عن الدقة العامة + التقسيم لكل فئة (العد، الإجراء، التصفية).

## استخدمها

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## أرسله

`outputs/skill-video-qa.md`يُعطى عنوان URL على YouTube أو الفيديو الذي يتم تحميله، يُصفّح النوافذ المشاهد ويجيب على الأسئلة بإقتباسات مع علامة زمنية.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## التمارين

1. تغيير جيميني 2.5 برو ل Qwen3-VL-Max على جواز الترجمة. تقرير نوعية الترجمة ديلتا على عينة 50 مشاهد من تصنيف البشر.

2. خفض إدراج الإطار لكل مشهد إلى متجه واحد بدلاً من المتجهات المتعددة. قياس رجعة الاسترداد.

3. قم ببناء وضع "التقييد القياسي": يقوم المختبر بتصوير كل حالة معينة مع علامة زمنية ويقرر المستخدم أن يضغط عليها للتحقق. قم بقياس ما إذا كان التحقق من المستخدم يقلل من الهلوسة.

4. التكلفة المرجعية: ساعات الفيديو لكل دولار عبر ثلاثة خيارات VLM.

5. إضافة النسخة المكتوبة من الناطق بالهاتف: تشغيل النسخة المكتوبة من الناطق بالهاتف على الصوت وإدمج النسخة لكل الناطق بالهاتف. إظهار "ماذا قالت أليس عن X؟"

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## المزيد من القراءة

- [AI2 Molmo 2](https://allenai.org/blog/molmo2)فتح نقاط تفتيش في إم بي
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) التأرجح الزمني على نطاق واسع
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) المرجع المضيف
- [VideoDB](https://videodb.io) إشارة API CRUD-for-video
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) إشارة تجارية
- [TransNetV2](https://github.com/soCzech/TransNetV2) نموذج قسم المشهد
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) بديل مفتوح كلاسيكي
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) مقياس تقييم مرجعي
