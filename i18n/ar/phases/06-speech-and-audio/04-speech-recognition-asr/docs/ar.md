# التعرف على الكلام (ASR)  CTC، RNN-T، الاهتمام

> التعرف على الكلام هو تصنيف الصوت في كل خطوة زمنية، تم لصقه معاً بواسطة نموذج تسلسل يعرف الإنجليزية والصمت. CTC، RNN-T، والاهتمام هي الطرق الثلاث للقيام بذلك. اختر واحد وفهم لماذا.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## المشكلة

لديك شريط 10 ثواني 16 كيلوهرتز. تريد سلسلة: "اشعل أضواء المطبخ". التحدي هو الهيكلي: لا تتوافق إطارات الصوت مع أحرف واحد إلى واحد. قد تستغرق كلمة "حسنا" 200 ms أو 1200 ms. الصمت يقاطع النطق. بعض الصوتات أطول من غيرها. عدد رموز الخروج لا يعرف مسبقا.

ثلاث صيغ تحل هذا:

1. **CTC (Connectionist Temporal Classification).**إصدار احتمالات رمزية لكل إطار بما في ذلك * فارغ * خاص. تكرار الانهيار والبيانات الفارغة في وقت فك التشفير. غير التراجعي، سريع. يستخدم بواسطة wav2vec 2.0، MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**الشبكة المشتركة تتوقع إطار رمز التشفير المقبل والرموز السابقة. قابل للتدفق. تستخدم بواسطة ASR على الجهاز من Google ، NVIDIA Parakeet.
3. **Attention encoder-decoder.**يقوم المُشفّر بتقليص الصوت إلى الحالات الخفية، ويقوم المُشفّر بتقليص الرموز لتوليد الرموز بشكل متراجع. يستخدمها Whisper، SeamlessM4T.

في عام 2026، SOTA WER على LibriSpeech اختبار-نظافة هو 1.4% (باراكيت-TDT-1.1B، NVIDIA) و 1.58% (سيسبر-Large-v3-توربو). الفرق صغيرة؛ الفرق في نشر كبيرة.

## المفهوم

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**دع المشفر يخرج`T`التوزيعات على مستوى الإطار على `V+1`الرموز (V حرف + فارغ). لسلسلة هدف `y`طولها`U < T`، أي تحديد الإطار الذي ينهار إلى `y`تعدد. خسارة CTC مجموع على جميع هذه التوجهات. الإستدلال: لكل إطار argmax، الإنهيار تكرار، إزالة الفراغات.

مزايا: غير متراجعة الذاتية، قابلة للتدفق، صفر رأس النظر. النقص: * افتراض الاستقلال المشروط *  كل تنبؤ إطار مستقل عن الآخرين، لذلك لا يوجد نموذج لغة داخلية. تصحيح مع LM الخارجية عن طريق البحث عن الشعاع أو الاندماج السطح.

**RNN-T intuition.**يضيف شبكة * predictor * التي تضم تاريخ الوهم و * joiner * التي تجمع حالة الوهم مع إطار مرموز في توزيع مشترك على `V+1`(الـ`+1`هو صفر / لا إصدار). نموذج صريح الاعتماد المشروط CTC تجاهل. قابل للتدفق لأن كل خطوة شرط فقط على الإطارات السابقة والرموز السابقة.

مزايا: قابل للتدفق + LM الداخلي. عيب: التدريب أكثر تعقيداً وجوعاً للذاكرة (3D شبكة الخسارة) ؛ أجزاء الخسارة RNN-T هي فئة مكتبة كاملة على حد ذاتها.

**Attention encoder-decoder.**مُخترع (6-32 طبقة من المحول) على إطارات الملفات. المُخترع (6-32 طبقة من المحول) يُعَمِّل الخروجات المُخترعة لتوليد الرموز بشكل متراجع. لا توجد قيود التنحيّص  يمكن أن تنظر الاهتمام في أي مكان في الصوت. غير قابل للتدفق ما لم تقيد الاهتمام (تدفق فيسبر، 2024).

مزايا: أعلى جودة على ASR غير متصلة بالإنترنت، سهلة التدريب مع أدوات seq2seq القياسية. العيب: التأخير السريع هو متناسب مع طول الخروج. لا يمكن التدفق دون هندسة.

### WER: الرقم الوحيد

**Word Error Rate**= $(S + D + I) / N$، حيث$S$=المستبدلات$D$= التخلص$I$=إدراجات، $N$=عدد الكلمات المرجعية. يطابق مسافة ليفينشتاين على مستوى الكلمات. أقل هو أفضل. WER فوق 20٪ غير صالحة للاستخدام عموماً؛ أقل من 5٪ هو التساوي البشري للخطاب القراءة.

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

جميع هذه هي مُخترع-مُخترع أو مبني على RNN-T. النظم CTC النقية (wav2vec 2.0) تقع حول 1.82.1% على النظافة التجريبية.

```figure
ctc-collapse
```

## بناءها

### الخطوة الأولى: فك تشفيرات CTC الفاسدة

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

قواعد: الإنهيار التالي التكرار، إسقاط الفراغات.`a a _ _ a b b _ c``a a b c`. . .

### الخطوة الثانية: تشغيل الشعاع

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

إنتاج يستخدم البحث عن شعاع شجرة المسبق مع اندماج LM؛ وهذا هو العظم المفاهمي.

### الخطوة الثالثة: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### الخطوة الرابعة: الإستنتاج ضد التهديد

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

واحد خط للقوى عام ASR في عام 2026، يعمل على GPU 24 جيجابايت في ~ 20 × في الوقت الحقيقي.

### الخطوة 5: التدفق مع Parakeet أو wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

يحتاج التدفق ASR إلى الاهتمام المرموزة المجزأة وحالة نقل ؛ استخدم مكتبة تدعمها (NeMo لـ Parakeet ، `transformers`خط أنابيب مع `chunk_length_s`)

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## الفخاخ التي لا تزال تشغل في عام 2026

- **No VAD.**تشغيل السسسل على الصمت ينتج الهلوسة ("شكراً على مشاهدتكم!").
- **Character vs word vs subword WER.**تقرير مستوى الكلمات WER * بعد * التطبيع (أقل حرف، تم إزالة النقاط).
- **Language ID drift.**الـ "Whisper" LID الآلي يُضلل طريق المقاطع الضوضاء إلى اليابانية أو الويلزية. القوة `language="en"`عندما تعرف
- **Long clips without chunking.**"سيسبر" لديه نافذة 30 ثانية`chunk_length_s=30, stride=5`لأي شيء أطول

## أرسله

إبقوا`outputs/skill-asr-picker.md`اختيار النموذج، استراتيجية فك التشفير، التجزئة، والاندماج LM لهدف نشر معين.

## التمارين

1. **Easy.**أركض`code/main.py`. إنه يفكّر بفارق طموح مصدر CTC يدوياً ويحسب WER مع مرجع
2. **Medium.**قم بتنفيذ البحث عن شعاع الشجرة في الخطوة 2 بشكل صحيح (حسب قاعدة الاندماج الفارغ). مقارنة مع الفلسفة على مجموعة بيانات صناعية من 10 أمثلة.
3. **Hard.**استخدام`whisper-large-v3-turbo`على[LibriSpeech test-clean](https://www.openslr.org/12)-حسب WER على أول 100 تصريح. مقارنة مع الأرقام المنشورة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## المزيد من القراءة

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf)ورقة "سي تي سي"
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711)ورقة RNN-T
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) ورقة القنونية 2022؛ التوسع v3-turbo في 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026 قائد قائمة المنظمات المفتوحة للشركات.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) مقياس مباشر على 25+ نموذج.
