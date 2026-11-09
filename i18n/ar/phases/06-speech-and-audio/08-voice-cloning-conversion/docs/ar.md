# إستنساخ الصوت وتحويل الصوت

> إنّ نسخ الصوت تقرأ نصك بصوت شخص آخر. تحويل الصوت يعيد كتابة صوتك إلى صوت شخص آخر مع الحفاظ على ما قلته. كلتا الصوتين تعتمد على نفس التفكك: هويت المتحدث منفصلة عن المحتوى.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## المشكلة

في عام 2026، يكفي مقطع صوتي 5 ثواني لإنتاج نسخة عالية الجودة لصوت أي شخص مع GPU المستهلك. ElevenLabs، F5-TTS، OpenVoice v2، VoiceBox جميع شحن صفر إطلاق أو القليل من إطلاق. التكنولوجيا هي نعمة (التوصول TTS، التدوين، الصوتات المساعدة) وسلاح (الندمات الاحتيالية، الفكايات العميقة السياسية، سرقة IP).

مهام مرتبطة ارتباطا وثيقا:

- **Voice cloning (TTS-side):**النص + صوت مرجع 5 ثواني → صوت في هذا الصوت.
- **Voice conversion (speech-side):**الصوت المصدر (الشخص A يقول X) + صوت مرجع لشخص B → الصوت من B يقول X.

كلاهما يُفكر في شكل موجة (المحتوى، المتحدث، البروسودي) ويجمع المحتويات من مصدر واحد مع المتحدث من مصدر آخر.

القيود الرئيسية التي ستحملونها الآن في عام 2026:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**أن أنابيبك يجب أن تنبعث علامة مياه غير قابلة للسمعة و ترفض النسخ غير المتوافقة

## المفهوم

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**مرسل شريط 5 ثوان إلى نموذج تم تدريبه على آلاف المتحدثين. رمز المتكبرين يرسم المقطع إلى مدخل المتكبرين؛ وضع TTS المفكّر على ذلك مدخل بالإضافة إلى النص.

يستخدمها: F5-TTS (2024) ، YourTTS (2022) ، XTTS v2 (2024) ، OpenVoice v2 (2024).

**Few-shot fine-tuning.**تسجيل 5-30 دقيقة من الصوت المستهدف. LoRA-تحسين النموذج الأساسي لمدة ساعة. قفز الجودة من "OK" إلى "غير مميز". كوكي وElevenLabs يدعم هذا النموذج؛ يستخدم المجتمع مع F5-TTS.

**Voice conversion (VC).**عائلتين:

- **Recognition-synthesis.**تشغيل نموذج ASR لتصدير تمثيل المحتوى (مثل الصوتات المضافة المرنة ، PPGs) ، ثم إعادة التخميس مع إدراج مكبرات الهدف. قوية للغة والتهجئة. تستخدم من قبل KNN-VC (2023) ، Diff-HierVC (2023).
- **Disentanglement.**تدريب جهاز تشفير السيارات الذي يفصل المحتوى والمتحدثين والإصدارات في مساحة خفية في عنق الزجاجة. تغيير المتحدثين في إضافة عند الاستنتاج. نوعية أقل ولكن أسرع. يستخدمها AutoVC (2019), فاريانات VITS-VC.

**Neural codec-based cloning (2024+).**VALL-E، VALL-E 2، NaturalSpeech 3، VoiceBox  تعامل الصوت كرموز منفصلة من SoundStream / EnCodec، تدريب نموذج كبير autoregressive أو التدفق مطابقة على رموز الكوديك. جودة مقارنة مع ElevenLabs على طلبات قصيرة.

### القصة الأخلاقية، وليس المكسر

**Watermarking.**PerTh (Perth) و SilentCipher (2024) تضمين معرف ~ 16-32 بت بشكل لا يمكن ملاحظته في الصوت. ينجو من إعادة تشفير البرمجة والتشغيل والتحريرات الشائعة. المصدر المفتوح جاهز للإنتاج.

**Consent gates.**يجب أن يربط كل إنتاج مستخدمه بسجل موافقة يمكن التحقق منه. "أنا، روهيت، في 2026-04-22، أؤذن بهذا الصوت لغرض "إكس".

**Detection.**أعلنت تحدي ASVspoof 2025 EERs من 0.82.3% لمكافحة الكشف المتطور ضد ElevenLabs و VALL-E 2 و Bark.

### العدد (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0.70 لا يمكن التمييز بينه وبين الهدف بالنسبة لمعظم المستمعين.

```figure
sp-voice-factorize
```

## بناءها

### الخطوة 1: تفكيك مع التعرف-التجميع (مظهر رمز فقط في main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

بسيط من الناحية الفكرية ، و كتلة التنفيذ هي في`tts_model`و مُرمّع السماعات

### الخطوة الثانية: كلون صفر إطلاق مع F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

يجب أن تتطابق نسخة المرجعية بالضبط مع الصوت؛ عدم التطابق يقطع التنظيم.

### الخطوة الثالثة: تحويل الصوت مع KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

تعمل KNN-VC على WavLM لاستخراج إدخالات لكل إطار لمجموعة المصدر والهدف ، ثم تستبدل كل إطار مصدر بجوارها القريب في المجموعة. غير المعلمي ، يعمل مع دقيقة من خطاب الهدف.

### الخطوة الرابعة: ضعي علامة مائية

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 بت من الحمل المفيد، يمكن اكتشافها بعد إعادة تشفير MP3 والضوضاء الضئيلة.

### الخطوة 5: بوابة الموافقة

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## الفخاخ

- **Misaligned reference transcript.**F5-TTS ومشابهة تتطلب من النص المرجعي أن يطابق الصوت المرجعي بدقة، بما في ذلك النقاط.
- **Reverberant reference.**إن صوت (إيكو) يقتل النسخة، سجل جاف، ميكروفون قريب
- **Emotional mismatch.**إشارة التدريب "ممتعة" تنتج نسخة متعة من كل شيء.
- **Language leakage.**إن تمثيل المتحدث الإنجليزي ثم طلب من النموذج التحدث بالفرنسية غالباً ما يحمل الجهز على أي حال؛ استخدم النماذج متعددة اللغات (XTTS، VALL-E X).
- **No watermark.**لا يمكن شحنها قانونياً في الاتحاد الأوروبي من أغسطس 2026.

## أرسله

إبقوا`outputs/skill-voice-cloner.md`تصميم خط أنابيب التنسخ أو التحويل مع بوابة الموافقة + علامة مياه + هدف الجودة.

## التمارين

1. **Easy.**أركض`code/main.py`. يظهر تبادل إضافة المتحدثين عن طريق حساب الكوسين بين "متحدثين" قبل وبعد التبادل.
2. **Medium.**استخدم OpenVoice v2 لتقليد صوتك، قياس SECS بين المرجع والقليد، قياس CER عن طريق السمس.
3. **Hard.**تطبيق علامة مائية SilentCipher على 20 نسخة، تشغيلها عبر 128 كيبس بتشغيل MP3 + تشكيل، اكتشاف الحمل المفيد. تقرير دقة البيت.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## المزيد من القراءة

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) النسخة المفتوحة SOTA الصفر الصور
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)و[VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS عصبي- كوديك.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) تحويل الصوت القائم على التفريق.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) الـ VC القائم على الاسترداد
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) علامة مائية صوتية 32 بت جاهزة للإنتاج.
- [ASVspoof 2025 results](https://www.asvspoof.org/)سباق السلاح ضد الكاشف المختلط، تم تحديثه في عام 2026.
