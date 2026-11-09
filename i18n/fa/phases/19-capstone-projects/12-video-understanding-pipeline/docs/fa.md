# Capstone 12  ویدئو درک خط لوله (مشهد، QA، جستجو)

> دوازده آزمایشگاه تولید مارنگو + پیگاسوس کردند. ویدیو دی بی API CRUD-for-video رو ارسال کرد مولمو 2 AI2 بازيگاه هاي بازي VLM رو اعلام کرد دوقلوها ساعت ها ویدیو رو به صورت بومی کنترل می کنن TimeLens-100K زمین گذاری زمانی را در مقیاس تعریف کرد. خط لوله 2026 حل شده است: بخش بندی صحنه، عنوان هر صحنه + گنجانده شدن، خط خط نقل، شاخص چند متری، و یک سوال که با (ابتدا، پایان) زمان مهر و همچنین پیش نمایش قاب پاسخ می دهد. این سنگ آخر 100 ساعت مصرف می کند، به معیار های عمومی می رسد و توهم را در مورد سوالات شمارش و عمل اندازه گیری می کند.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## مشکل

QA ویدیویی طولانی مدت، گرسنه ترین مشکل چند راهبردی در مقیاس 2026 است. جمینی 2.5 پرو می تواند یک ویدیو 2 ساعته را به صورت بومی بخواند، اما مصرف 100 ساعت ویدیو به یک کورپوس قابل جستجو هنوز هم نیاز به یک شاخص سطح صحنه دارد. شکل تولید ترکیبی از بخش بندی صحنه (TransNetV2 یا PySceneDetect) ، سرنخ گذاری هر صحنه با VLM (Gemini 2.5، Qwen3-VL-Max، یا Molmo 2) ، خط خط خط متن (Whisper-v3-turbo با زمان نامه های کلمه) و یک شاخص چند ویکتور است که سرنخ، گنجاندن قاب و متن را کنار هم ذخیره می کند. خط سوالات پاسخ با (ابتدا، پایان) زمان مهر و افزونه فریم پیش نمایش.

معیارها عمومی هستند (ActivityNet-QA، NeXT-GQA) به علاوه مجموعه سفارشی 100 سوال شما. توهم در سوالات شمارش و نوع عمل کلاس شکست سخت شناخته شده است؛ سنگ پایینی به طور صریح آن را اندازه گیری می کند.

## مفهوم

سه خط لوله در کنار آن در حال مصرف هستند.**Scene segmentation**و ویدیو رو به صحنه ها می کند.**VLM captioning**یک عنوان برای هر صحنه و یک قاب را از یک کليد تولید می کند. **ASR alignment**هر صحنه سه نوع ویکتور را در یک شاخص چند ویکتور (Qdrant) دریافت می کند: ادغام عنوان، ادغام کليد، ادغام نسخۀ متن.

در زمان جستجو، سوال زبان طبیعی در برابر سه متری است؛ نتایج با RRF ادغام می شوند؛ یک آداپتور زمین گذاری زمانی (به سبک TimeLens) پنجره (ابتدا، پایان) را در صحنه بالا بهبود می بخشد. سنتزایزر VLM (Gemini 2.5 Pro یا Qwen3-VL-Max) سوال + صحنه های بالا + فریم های برش شده و پاسخ را با مهر زمان و پیش نمایش فریم به دست می آورد.

اندازه گیری توهم مهم است. سوال های شمارش ("چقدر افراد وارد اتاق می شوند؟") و نوع عمل ("آشپز قبل از جوشاندن می ریزد؟") به طور غیرقابل اعتماد شناخته شده است. دقت را از سوالات توصیفاتی جدا کنید.

## معماری

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

## دسته

- بخش بندی صحنه: TransNetV2 (حال جدید 2024-26) یا PySceneDetect
- ASR: Whisper-v3-turbo از طریق سریعتر-سوسن با کلمات زمان مهر
- VLM captioner + answerer: Gemini 2.5 Pro یا Qwen3-VL-Max یا Molmo 2
- زمین سازی زمانی: آداپتور TimeLens-100K یا VideoITG
- شاخص: Qdrant با پشتیبانی چند متری (تاریخ / فریم / نقل)
- UI: Next.js 15 با پخش کننده ویدئو HTML5 و تمنیل صحنه
- Eval: ActivityNet-QA، NeXT-GQA، مجموعه سفارشی برچسب گذاری دست 100 سوال
- معیار توهم: فرعی دسته بندی های شمارش و نوع عمل با برچسب های دستی

```figure
cf-scene-index
```

## آن را بسازید

1. **Ingest walker.**URL های YouTube یا MP4 های محلی را قبول کنید. در صورت لزوم به 720p کاهش دهید. ادامه دهید `{video_id, file_path}`. .

2. **Scene segmentation.**برای تولید TransNetV2 یا PySceneDetect اجرا کنید`[{scene_id, start_ms, end_ms, keyframe_path}]`هدف 100 ساعت: 6 تا 8 تا صحنه

3. **ASR pass.**Whisper-v3-turbo را در صدا اجرا کنید؛ تایم استیمپ های سطح کلمه را صادر کنید؛ به قطعات نقل متن هر صحنه تقسیم کنید.

4. **VLM captioning.**در هر صحنه، با کلید فریم و یک قالب عنوان کوتاه، جیمنی 2.5 پرو (یا Qwen3-VL-Max) را فراخوانید.

5. **Multi-vector index.**جمع آوری Qdrant با سه متری نامگذاری شده.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`. .

6. **Query.**پرسش های زبان طبیعی سه پرسش کثیف را می پرند؛ با ترکیب رتبه های متقابل ادغام می شوند؛ صحنه های بالا k=5.

7. **Temporal grounding.**آداپتور سبک TimeLens را در صحنه بالا اجرا کنید تا پنجره (ابتدا، پایان) در صحنه را اصلاح کنید.

8. **VLM synth.**با درخواست + سه صحنه بالا (به عنوان تصاویر یا کلیپ های کوتاه) + نقل و نقل تماس بگیرید.`(video_id, start_ms, end_ms)`نقل قول

9. **Eval.**فعالیت شبکه-QA و NEXT-GQA را اجرا کنید. مجموعه سفارشی 100 سوال ایجاد کنید. دقت کلی + تجزیه هر کلاس را گزارش کنید (شماره، عمل، توصیف).

## ازش استفاده کن

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

## -باده

`outputs/skill-video-qa.md`در این بخش، یک URL YouTube یا یک ویدیو اپلود شده، صحنه ها را فهرست می کند و با نقل قول های زمان بندی شده به سوالات پاسخ می دهد.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## تمرینات

1. جمن 2.5 پرو رو با Qwen3-VL-Max در پاس عنوان عوض کنيد.

2. کاهش هر تصویر هر صحنه به یک ویکتور جمع شده به جای چند ویکتور. اندازه گیری بازخورد بازگشت.

3. ایجاد حالت "حصد سخت": سینتزیزر هر نمونه شمارش شده را با یک مهر زمان می کند و کاربر برای تأیید کلیک می کند. اندازه گیری کنید که آیا تأیید کاربر توهم را کاهش می دهد.

4. قیمت مصرفي: ساعت ها وديو در هر دلار در سه گزینه VLM انتخاب کن

5. نقل قولی را که با صدای بلندگو به صورت روزانه نوشته شده است اضافه کنید: روزانه سازی سخنران های pyannote را روی صدا اجرا کنید و نقل قول های هر سخنران را گنجانید. پرسش های "آلیس درباره X چه گفت؟" را نشان دهید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## خواندن بیشتر

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) باز کردن نقاط بازرسی VLM
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) زمین گذاری زمانی در مقیاس
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) مرجع میزبانی شده
- [VideoDB](https://videodb.io) CRUD-for-video API مرجع
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) مرجع تجاری
- [TransNetV2](https://github.com/soCzech/TransNetV2) مدل بخش بندی صحنه
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) جایگزین کلاسیک باز
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) معیار ارزیابی مرجع
