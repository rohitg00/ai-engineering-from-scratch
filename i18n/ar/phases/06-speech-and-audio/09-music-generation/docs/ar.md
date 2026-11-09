# الموسيقى الجيل  الموسيقى الجيل، الصوت المستقر، سونو، والزلازل الترخيصية

> 2026 الجيل الموسيقي: سونو v5 و Udio v4 يهيمنون على التجارية. MusicGen ، Stable Audio Open ، و ACE-Step يؤدون المصدر المفتوح. المشكلة الفنية حُلَّت في الغالب. المشكلة القانونية (Warner Music 500 مليون دولار تسوية ، UMG تسوية) أعادت تشكيل المجال في 2025-2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## المشكلة

النص → مقطع موسيقي لمدة 30 ثانية إلى 4 دقائق، مع كلمات، الصوت، والهيكل. ثلاثة مشاكل فرعية:

1. **Instrumental generation.**نص مثل "طبول هيب هوب لو-في مع مفاتيح دافئة" → صوت. MusicGen, Stable Audio, AudioLDM.
2. **Song generation (with vocals + lyrics).**"غنية بلدية عن ليال مطيرة في تكساس"
3. **Conditional / controllable.**تمديد المقطع الموجود، وتجديد جسر، وتبادل النوع، أو فصل العصا، أو اللوحة. إنما يُعد التلوين + فصل العصا في أوديوه ميزة 2026 التي تتناسب مع ذلك.

## المفهوم

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### الـ LM على الـ NEC

الميتا **MusicGen**(2023, MIT) والعديد من المشتقات: حالة على إدخال النص / الميلود، التنبؤ بالتراجعة السرية لوكانيات EnCodec (32 كيلوهرتز، 4 كتب رمزية) ، فك تشفير مع EnCodec. 300M - 3.3B المعلمات. خط أساسي قوي؛ الصراعات ما بعد 30 ثانية.

**ACE-Step**(المصدر المفتوح، 4B XL أصدرت في أبريل 2026) يمتد هذا إلى الجيل الكامل من الأغاني المضمونة.

### التوزيع على الذوبان أو الاختفاء

**Stable Audio (2023)**و**Stable Audio Open (2024)**: انتشار متخفي على الصوت المضغوط. ممتاز في الحلقات، التصميم الصوتي، النسيج المحيطي. ليس جيدا في الموسيقى المكوّنة الكاملة.

**AudioLDM / AudioLDM2**: النص إلى الصوت عبر التوزيع المتخفي على شكل T2I، وتعايش إلى الموسيقى، الآثار الصوتية، الكلام.

### الهجائر (إنتاج)  سونو، أوديو، ليريا

الوزن المغلق. من المحتمل أن يكون الوسيط القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القومي القي القومي القومي القومي القومي القومي القي القي القومي القومي القومي القومي القومي القي القومي القومي القي القي القومي القومي القي القومي القومي القي القي القي القي القومي القومي القي القي القي القي القومي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي القي الق

### التقييم

- **FAD (Fréchet Audio Distance).**المسافة على مستوى إدراج بين التوزيع الصوتي المولود مقابل التوزيع الصوتي الحقيقي باستخدام ميزات VGGish أو PANNs. أقل أفضل. MusicGen صغير: 4.5 FAD على MusicCaps؛ SOTA ~ 3.0.
- **Musicality (subjective).**تفضيل البشر، سونو V5 ELO 1293
- **Text-audio alignment.**درجة CLAP بين الإتصال والخروج
- **Musicality artifacts.**الانتقالات غير المتزايدة، التجرف الصوتي، فقدان الهيكل بعد 30 ثانية.

## خريطة نموذجية 2026

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## المشهد القانوني (2025-2026)

- **Warner Music vs Suno settlement.**500 مليون دولار. وومغ الآن لديها الإشراف على شبيهة الذكاء الاصطناعي، حقوق الموسيقى، والأغاني التي يولدها المستخدم على سونو.
- **EU AI Act**+ **California SB 942**: يجب الكشف عن الموسيقى التي تم إنشاؤها بواسطة الذكاء الاصطناعي.
- **Riffusion / MusicGen**تحت MIT لا يوجد أي أمتعة التوافق ولكن أيضا لا يوجد صوت تجاري.

أنماط آمنة للنقل:

1. توليد الأدوات فقط (MusicGen، Stable Audio Open، MIT/CC0 الخروج).
2. استخدام APIs التجارية (Suno، Udio، ElevenLabs Music) مع ترخيص لكل جيل.
3. القطار على الكتالوج المملوك أو المرخص (معظم المؤسسات تنتهي هنا).
4. تعريف الأجيال مع علامات المائية + البيانات المعدنية.

```figure
sp-codec-tokens
```

## بناءها

### الخطوة 1: توليد مع MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

ثلاثة أحجام:`small`(300م، سريع)`medium`(1.5ب)`large`(3.3ب) القليل يكفي ل"فكرة الأرض".

### الخطوة الثانية: تكييف الميلود

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody يأخذ كرومغرام ويحافظ على النغمة أثناء تغيير النغمة. مفيد ل "عطني هذه النغمة كربعة أوراق".

### الخطوة الثالثة: تقييم FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

يحسب مسافة VGGish. مفيدة للاختبارات التراجعة على مستوى النوع؛ لا بديل للمستمعين البشريين.

### الخطوة الرابعة: إضافة إلى سير العمل في ماجستير في مجال الموسيقى

إجمع مع الأفكار من الدروس 7-8:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## استخدمها

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## الفخاخ التي لا تزال تشغل في عام 2026

- **Copyright-laundering prompts.**"غناء في أسلوب تيلور سويفت"  السونو / أوديومعروض تصفية هذه الآن، النماذج المفتوحة لا. إضافة قائمة تصفية الخاصة بك.
- **Repetition / drift past 30 s.**نموذجات AR حلقة. التقاطع الأجيال المتعددة، أو استخدام ACE-Step للتماسك الهيكلي.
- **Tempo drift.**النماذج تتحرك خارج BPM. استخدم علامات BPM في التشويق والبعد مع المصفاة من الكتب`beat_track`. . .
- **Vocal intelligibility.**السونو ممتازة؛ النماذج المفتوحة غالبا ما تكون خفيفة في الكلمات. إذا كانت النصوص مهمة، استخدم API تجارية أو ضبط دقيقة.
- **Mono output.**النماذج المفتوحة تولد الموسيقى الموحدة أو المزيفة. قم بتحديثها مع إعادة بناء الموسيقى الموحدة المناسبة (مثل انتشار الموسيقى الموحدة في كارتيسيا).

## أرسله

إبقوا`outputs/skill-music-designer.md`. اختيار النموذج، استراتيجية الترخيص، خطة الطول / الهيكل، وكشف البيانات المعدنية لتنفيذ الجيل الموسيقي.

## التمارين

1. **Easy.**أركض`code/main.py`. إنتاج "الإنتاج" التقدم التابع + نمط الطبول كرموز ASCII  كارتون موسيقى-جيل. تشغيله مرة أخرى عبر أي مرسوم MIDI إذا كنت تريد.
2. **Medium.**إثباط`audiocraft`، إنتاج مقاطع 10 ثوان على 4 أجهزة تشكيل مع MusicGen-small، قياس FAD ضد مجموعة تشكيل مرجعية.
3. **Hard.**باستخدام ACE-Step (أو MusicGen-melody) ، تولد ثلاثة تغيرات لنفس النغمة مع طلبات مختلفة. احسب تشابه CLAP مع طلب للتحقق من التوجه.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## المزيد من القراءة

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) مقياس مفتوح للسيطرة التنازلية.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) التصميم الصوتي الافتراضي.
- [ACE-Step](https://github.com/ace-step/ACE-Step)-فتح مولد 4B كامل الأغاني، أبريل 2026.
- [Suno v5 platform docs](https://suno.com) قائد الجودة التجارية
- [AudioLDM2](https://arxiv.org/abs/2308.05734) انتشار غامض للموسيقى + تأثيرات الصوت.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) نوفمبر 2025 سابقة.
