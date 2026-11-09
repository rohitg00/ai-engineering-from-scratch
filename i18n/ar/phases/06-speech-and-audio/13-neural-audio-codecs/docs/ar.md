# كوديكات الصوت العصبي  EnCodec، SNAC، Mimi، DAC والفصل السمينتي-الاصوتي

> إن إن كوديك، SNAC، Mimi، و DAC تحول أشكال الموجات المستمرة إلى تسلسلات منفصلة يمكن للمتحول التنبؤ بها. تقسيم رمز التسمية ضد الصوت  كتاب التعليمات الأول كالتسمية، والراحة كالتسمية  هي أهم تحول معماري منذ المحول الصوتي.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## المشكلة

نموذج اللغة تعمل على رموز منفصلة. الصوت مستمر. إذا كنت تريد نموذج LLM على النمط للخطاب / الموسيقى  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  تحتاج أولاً إلى **neural audio codec**: مرموزة تعلمت التي تتميز الصوت إلى مجموعة صغيرة من المعلامات، ومرموزة مُطابقة التي تعيد تشكيل شكل الموجة.

لقد ظهرت عائلات:

1. **Reconstruction-first codecs** EnCodec، DAC. تحسين جودة الصوت التدريجي. الوهم "صوتي"  أنها تسجل كل شيء بما في ذلك هوية المتحدث، الاهتزاز، ضوضاء الخلفية.
2. **Semantic-first codecs** ميمي (كيوتاي) ، SpeechTokenizer. إجبار أول كتاب كود لتشفير المحتوى اللغوي / الصوتي (غالباً عن طريق نزيف من WavLM). الكتب الكودية اللاحقة هي التفاصيل الصوتية.

رؤى 2024-2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**يجب على ماجستير في التعليمات العليا على رموز الكوديك أن يتعلم كل من بنية اللغة والهيكل الصوتي في نفس كتاب الكود ، والذي لا يتحكم في النطاق. فصلهم  كتاب الكود التعريفية 0 ، الكود الكود الصوتي 1-N  هو ما يجعل Moshi و Sesame CSM يعمل.

## المفهوم

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### الخدعة الأساسية: كوانتيسة المتجهات المتبقية (RVQ)

بدلاً من كتاب كود واحد كبير (الذي يحتاج لملايين الكودات لجودة جيدة) ، جميع الكوديكات الصوتية الحديثة تستخدم **RVQ**: سلسلة من الكتب الصغيرة. الكتب الأولى تعدد كمية إصدار المُشفّر؛ والثانية تعدد كمية البقايا؛ إلخ. كل كتب تعدد 1024 رمزًا. 8 كتب = المفرد الفعّال لـ $1024^8 = 10^{24}$. . .

في وقت الإستنتاج، يجمع المفكّر جميع الرموز المختارة لكل إطار لإعادة بناءها.

### الرابع من المواد الموثقة التي تهم في عام 2026

**EnCodec (Meta, 2022).**الخط الأساسي. رمز التشفير عبر شكل الموجة، عنق الزجاجة RVQ. 24 كيلوهرتز، 32 كتاب رمزية ممكنة، 4 كتب رمزية افتراضية @ 1.5 كيلوبيتس. الاستخدامات `1D conv + transformer + 1D conv`معمارية تستخدمها MusicGen

**DAC (Descript, 2023).**RVQ مع كتب رمزية L2 المعتادة ، وظائف تفعيل دورية ، فقدان محسنة. أعلى نسبة fidelity إعادة التعمير من أي كوديك مفتوح  أحيانا لا يمكن التمييز عن الخطاب الأصلي مع 12 كتاب رمزية. 44.1 kHz كامل النطاق.

**SNAC (Hubert Siuzdak, 2024).**كتب الرموز الجافة تعمل بمعدل أقل من معدلات الإطار من الكتب الجافة. تقوم بتصوير الصوت بشكل سلسلي بشكل فعال: "خطوط" جافة عند ~ 12 هرتز بالإضافة إلى تفاصيل عند 50 هرتز. تستخدم من قبل أورفيوس-3B لأن الهيكل الهرمي يقوم بتخطيط جيد على الجيل القائم على LM.

**Mimi (Kyutai, 2024).**2026 Game-Changer. 12.5 Hz سرعة الإطار (منخفضة للغاية) ، 8 كودكوب @ 4.4 كيبيديا. كودكوب 0 هو **distilled from WavLM**تم تدريبها على التنبؤ بخصائص محتوى الكلام في WavLM. كتب الشفرة 1-7 هي بقايا صوتية. هذا الانقسام يعمل على Moshi (الدرس 15) و Sesame CSM.

### معدلات الإطار مهمة في نمذجة اللغة

معدل الإطار المنخفض = التسلسل أقصر = LM أسرع.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

عند 12.5 هرتز، تعتبر صياغة 10 ثوان فقط 125 إطار كوديك  يمكن للمتحول التنبؤ بها بسهولة.

### الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات" المفروضة على الـ "مؤشرات"

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**يرمز ما قيل  صوتيات، كلمات، المحتوى. مستقطب من WavLM عن طريق فقدان التنبؤ مساعد.
- **Acoustic tokens (codebooks 1-7).**تسمية التشفير، هوية المتحدث، البروسودي، ضجيج الخلفية، التفاصيل الدقيقة.

يتنبأ AR LM بالرمز التمويلي أولاً (مشترك في النص) ، ثم يتنبأ بالرمز الصوتي (مشترك في مرجع المتكبر). هذا التنفيذ هو السبب في أن TTS الحديثة يمكن أن تسفر الصوتات: يتعامل النموذج التمويلي مع المحتوى؛ يتعامل النموذج الصوتي مع النغمة.

### 2026 جودة إعادة الإعمار (بيتات في الثانية، وتيرة البيتات أقل أفضل)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

الكوديكات التقليدية مثل Opus لا تزال تفوز على الجودة الإدراكية**discrete tokens**(التي لا تنتجها Opus) و **generative-model quality**(ما الذي يمكن أن يفعله الـ LM مع تلك الرموز).

```figure
rvq-codec-cascade
```

## بناءها

### الخطوة 1: ترميز مع EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`في 6 كيبتس. كل رمز هو 0-1023 (10 بت).

### الخطوة الثانية: فك تشفير وتقييم إعادة الإعمار

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### الخطوة الثالثة: الانقسام المفصل (ميمي)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

كتاب التعليمات التعليمية التعليمية 0 هو المتحالف مع WavLM. يمكنك تدريب محول نص إلى تعبيرات تعليمي  مخزون لغوي أصغر بكثير من الذهاب مباشرة إلى الصوت. ثم وضع مفكّر صوتي منفصل إلى شكل موجة على مرجع مكبر صوت.

### الخطوة 4: لماذا تعمل AR LM على رموز الكوديك

لقطة خطاب 10 ثانية في 12.5 هرتز × 8 كودكوبات ميمي:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 رمز هو سياق بسيط لمحول. يمكن لمحول ذو برميل 256M توليد 10 ثوان من الكلام في ملثانية على جهاز GPU الحديث.

## استخدمها

مشكلة خريطة → كوديك:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

قاعدة عامة:**if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## الفخاخ

- **Too many codebooks.**إضافة كتب الرموز تزيد من الوفاء بشكل خطي ولكن طول تسلسل LM خطي أيضا. توقف في 8-12.
- **Frame-rate mismatch.**تدريب LM على 12.5 هرتز Mimi ثم ضبط على 50 هرتز EnCodec يفشل بصمت.
- **Assuming all codebooks equal.**في ميمي، الكود 0 يحمل محتوى، فقدانه يدمّر التفاهم. فقدان الكود 7 بالكاد يلاحظ.
- **Using reconstruction quality as the only metric.**يمكن أن يكون للكومديك إعادة بناء كبير ولكن لا فائدة له للجيل القائم على LM إذا كانت الهيكل التمويلي سيء.

## أرسله

إبقوا`outputs/skill-codec-picker.md`اختر كوديك لمهمة توليد أو ضغط معينة

## التمارين

1. **Easy.**أركض`code/main.py`. يطبق مقياس لعبة مقياس + بقايا الكميات ويقيس خطأ إعادة الإعمار أثناء إضافة الكتب.
2. **Medium.**إثباط`encodec`و مقارنة 1, 4, 8, 32 كتاب كود على شريط خطاب مدمر.
3. **Hard.**تحميل ميمي. تشفير شريط. استبدل كتاب الكود 0 بأعداد كاملة عشوائية؛ فك الشفرة. ثم استبدل كتاب الكود 7 على نحو مماثل. مقارنة الفسادين  كتاب الكود 0 الفساد يجب أن يدمر التفاهم؛ كتاب الكود 7 الفساد يجب بالكاد تغيير أي شيء.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## المزيد من القراءة

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) خط أساسية RVQ
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546)-أعلى الوفاء مفتوح
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ متعدد النطاقات
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) الانقسام المفصل الصوتي-السماني، التقطير الموج
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) النموذج المفصل المميز/الصوتي المكون من مرحلتين.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) الموسم المباشر الأصلي RVQ.
