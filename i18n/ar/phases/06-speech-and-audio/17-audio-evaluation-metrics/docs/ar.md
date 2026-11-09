# تقييم الصوت  WER، MOS، UTMOS، MMAU، FAD، واللوائح المفتوحة

> لا يمكنك شحن ما لا يمكنك قياسه. هذه الدروس تسمي المقاييس 2026 لكل مهمة صوتية: ASR (WER، CER، RTFx) ، TTS (MOS، UTMOS، SECS، WER-on-ASR-round-trip) ، لغة الصوت (MMAU، LongAudioBench) ، الموسيقى (FAD، CLAP) ، والمتحدث (EER). بالإضافة إلى لوحة القيادة التي يمكنك مقارنة.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## المشكلة

كل مهمة صوتية لديها مقاييس متعددة، كل قياس محور مختلف. باستخدام المقياس الخاطئ هو كيفية شحن نموذج يبدو رائعا على لوحة التحكم الخاص بك و رهيبة في الإنتاج. قائمة 2026 القنوني:

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## المفهوم

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### مقاييس ASR

**WER (Word Error Rate).** `(S + D + I) / N`الحروف الصغرى، التخطيط، التطبيع على الأرقام قبل تسجيل النقاط`jiwer`أو شركة OpenAI`whisper_normalizer`. &lt;5% = قراءة الكلام على قدم المساواة البشرية

**CER (Character Error Rate).**نفس الصيغة، مستوى الأحرف. تستخدم لغات النغمات (الماندرين، الكانتوني) حيث التقسيم الكليمي غير واضح.

**RTFx (inverse real-time factor).**ثواني صوتية معالجة لكل ثانية من ساعة الحائط أعلى أفضل، تصل درجات Parakeet-TDT إلى 3380×

**First-token latency.**ساعة الحائط من إدخال الصوت إلى أول رمز النسخة حرجة للتسجيل

### مقاييس TTS

**MOS (Mean Opinion Score).**1-5 تصنيف بشري، معيار الذهب لكن بطيء، جمع أكثر من 20 سمعًا لكل عينة، أكثر من 100 عينة لكل نموذج.

**UTMOS (2022-2026).**علمت توقعات MOS. تتوافق مع MOS البشري عند المعايير القياسية. F5-TTS: UTMOS 3.95; الحقيقة الأرضية: 4.08.

**SECS (Speaker Encoder Cosine Similarity).**للتنسيق الصوتي. إيكابا تضمين كوسين بين الإشارة والإنتاج المنسق. &gt; 0.75 = نسخة قابلة للتعرف.

**WER-on-ASR-round-trip.**تشغيل Whisper على إصدار TTS ، وحساب WER ضد نص المدخل. يلتقط تراجعات التفاهم. 2026 SOTA: &lt; 2% WER على مجموعات اختبار الإنجليزية (مجموعات الماندرين تقرير CER بدلاً من ذلك).

**TTFA (time-to-first-audio).**تأخير الساعة الجدارية كوكورو-82م: ~100 ms F5-TTS: ~1 ثانية

### خاصة في عملية استنسخ الصوت

**SECS + MOS + CER**إن التنسيق الذي يحصل على درجة عالية من الـ SECS ولكن منخفضة من MOS يعني الـ timbre-right-but-unnatural؛ والعكس يعني صوت طبيعي ولكن المتحدث الخطأ.

### التحقق من المتحدث

**EER (Equal Error Rate).**الحد الأدنى حيث يبلغ معدل قبول كاذب معدل رفض كاذب. ECAPA على VoxCeleb1-O: 0.87%.

**minDCF (min Detection Cost).**تكلفة معينة في نقطة تشغيل مختارة (غالباً ما تكون FAR = 0.01).

### الإسهال

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. كلمة مفقودة + كلمة إنذار خاطئ + مكبر صوت-خلط ، كل منها كجزء. اجتماعات AMI: DER ~ 10-20% هو واقعي. بيانوت 3.1 + دقة-2 الإعلانية: &lt;10% DER على الصوت المسجل جيدًا.

**JER (Jaccard Error Rate).**بديل لـ DER، قوية لـ short-segment bias.

### تصنيف الصوت

متعددة العلامات: **mAP (mean Average Precision)**على جميع الفئات. مجموعة صوتية: 0.548 ماب لـ BEATs-iter3.

حصرية متعددة الفئات: **top-1, top-5 accuracy**. أوامر الكلام v2: 99.0% أعلى 1 (صوت-MAE).

غير متوازن: **macro F1**+ **per-class recall**. تقرير لكل فئة  الدقة الإجمالية تخفي فئات الفئة الفاشلة.

### جيل الموسيقى

**FAD (Fréchet Audio Distance).**المسافة بين توزيعات VGGish المدمجة من الصوت الحقيقي مقابل الصوت المولد. MusicGen-small على MusicCaps: 4.5 . MusicLM: 4.0. أقل أفضل.

**CLAP Score.**درجة التنظيم النصي-الصوتي باستخدام إدمجات CLAP. &gt; 0.3 = التنظيم المعقول.

**Listening panel MOS.**لا يزال الكلمة الأخيرة للموسيقى المستهلكة. حصلت Suno v5 على ELO 1293 على مقياس التفضيلات المزدوجة الخاص بـ Suno. هذا رقم البائع؛ تحدّث TTS Arena عن الكلام، وليس الموسيقى.

### معايير اللغة الصوتية

**MMAU (Massive Multi-Audio Understanding).**10 ألف زوج صوتي

**MMAU-Pro.**1800 عنصر صلب، أربعة فئات: الكلام / الصوت / الموسيقى / متعددة الصوت. فرصة عشوائية 25% على 4 طريق. جيميني 2.5 برو عموما ~ 60%؛ متعددة الصوت ~ 22% على جميع الطرازات.

**LongAudioBench.**مقاطع متعددة الدقائق مع استفسارات معنوية صوت فلامينغو التالي يضرب جيميني 2.5 برو

**AudioCaps / Clotho.**إعادة تعريف المعايير المرجعية، معايير SPICE، CIDER، FENSE.

### التدفق من حديث إلى حديث

**Latency P50 / P95 / P99.**ساعة الحائط من نهاية المستخدم إلى الاستجابة السمعة الأولى.

**WER / MOS**على الخروج

**Barge-in responsiveness.**وقت من توقف المستخدم إلى مساعد صامت الهدف 150 ثانية

### قائمة اللائحة لعام 2026

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## بناءها

### الخطوة الأولى: WER مع التطبيع

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### الخطوة الثانية: TTS WER ذهاب وإياب

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### الخطوة الثالثة: SECS للتنسخ الصوتي

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### الخطوة الرابعة: FAD لتوليد الموسيقى

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### الخطوة 5: إطار الإطار الإقتصادي للمؤلفين (مثل الرمز الذي يستخدم في الدروس 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## استخدمها

إزواج كل عملية نشر مع حزمة تقييم ثابتة التي تعمل على كل تحديث نموذج.

1. **Normalize before scoring.**الحروف الصغرى، شريط النقاط، رقم التوسع، إبلغ عن قاعدة التطبيع
2. **Report distributions, not averages.**P50/P95/P99 للخمول. استدعاء لكل فئة للتصنيف. لكل فئة لـ MMAU.
3. **Run one canonical public benchmark.**حتى لو كانت بيانات الإنتاج الخاصة بك تختلف، فإن تقرير في Open ASR / TTS Arena / MMAU يسمح للمراجعين بمقارنة التفاح مع التفاح.

## الفخاخ

- **UTMOS extrapolation.**تدرب على الكلام النقي في نمط VCTK؛ تسجل صوت ضجيج / مقترح / عاطفي بشكل سيء.
- **MOS panel bias.**20 عامل في شركة أمازون ميكانيكال تورك ≠ 20 مستخدم هدف. ادفع للوحة النطاق إذا كانت المخاطر مرتفعة.
- **FAD depends on reference set.**مقارنة مع نفس التوزيع المرجعي بين النماذج.
- **Aggregate WER.**5-% WER بشكل عام يمكن أن تخفي 30٪ WER على الكلام المجهز.
- **Public benchmark saturation.**معظم الطرازات الحدودية قريبة من السقف على مقارنات قياسية. قم ببناء مجموعة محمولة داخلية تعكس حركة المرور الخاصة بك.

## أرسله

إبقوا`outputs/skill-audio-evaluator.md`. اختر المقاييس والمؤشرات المرجعية و تنسيق التقارير لأي إصدار من نماذج الصوت

## التمارين

1. **Easy.**أركض`code/main.py`الحساب WER / CER / EER / SECS / FAD-ish / MMAU-ish على مدخلات الألعاب.
2. **Medium.**قم ببناء حزمة WER TTS ذهابًا وإياباً. قم بتشغيل إصدارك Kokoro أو F5-TTS من خلال Whisper. احسب WER أكثر من 50 إشارة. إشارات العلم مع WER &gt; 10%.
3. **Hard.**قم بتسجيل دروسك في الدروس 10 لـ LALM على الخطاب MMAU-Pro + مجموعة فرعية متعددة الصوت (50 عنصر لكل منها).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## المزيد من القراءة

- [jiwer](https://github.com/jitsi/jiwer) مكتبة WER/CER مع أدوات التطبيع.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152)تعلمت مقدرة المعدات النظرية
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) معيار الموسيقى
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 2026 ترتيبات حية.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) قائمة التصويت البشري في TTS
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) قائمة التفكير LALM
- [HEAR benchmark](https://hearbenchmark.com/) أداء النصوص الخاصة بـ SSL
