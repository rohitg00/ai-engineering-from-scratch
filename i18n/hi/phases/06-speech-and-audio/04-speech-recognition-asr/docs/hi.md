# भाषण पहचान (एएसआर)  सीटीसी, आरएनएन-टी, ध्यान

> भाषण पहचान हर समय के चरण में ऑडियो वर्गीकरण है, जो एक अनुक्रम मॉडल द्वारा चिपकाया जाता है जो अंग्रेजी और चुप्पी जानता है। सीटीसी, आरएनएन-टी और ध्यान इसे करने के तीन तरीके हैं। एक चुनें और समझें कि क्यों।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## समस्या

आपके पास 10 सेकंड का 16 kHz क्लिप है। आप एक स्ट्रिंग चाहते हैंः "किचन लाइट्स को चालू करें।" चुनौती संरचनात्मक हैः ऑडियो फ्रेम अक्षरों के साथ एक-एक के साथ संरेखित नहीं होते हैं। "ठीक है" शब्द में 200 ms या 1200 ms लग सकता है। मौन बयान को अंकित करता है। कुछ ध्वन्यात्मक अन्य से अधिक हैं। आउटपुट टोकन की संख्या पहले से ज्ञात नहीं है।

तीन सूत्रों ने इस समस्या का समाधान किया हैः

1. **CTC (Connectionist Temporal Classification).**एक विशेष * रिक्त* सहित प्रति फ्रेम टोकन संभावनाओं को निष्पादित करें। डिकोड समय पर गिरावट दोहराएं और रिक्त करें। गैर-स्वतः-पुनर्निर्णायक, तेज। wav2vec 2.0 द्वारा उपयोग किया जाता है, एमएमएस।
2. **RNN-T (Recurrent Neural Network Transducer).**संयुक्त नेटवर्क अगले टोकन को एन्कोडर फ्रेम और पिछले टोकन दिए जाने की भविष्यवाणी करता है। स्ट्रीम करने योग्य। Google के ऑन-डिवाइस एएसआर, एनवीआईडीए पैराकीट द्वारा उपयोग किया जाता है।
3. **Attention encoder-decoder.**एन्कोडर ऑडियो को छिपे हुए राज्यों में संपीड़ित करता है, डिकोडर ऑटोरेग्रेसिव रूप से टोकन उत्पन्न करने के लिए क्रॉस-एटेंडर करता है।

2026 में, लिब्री स्पीच परीक्षण-स्वच्छता पर SOTA WER 1.4% (पाराकीट-TDT-1.1B, NVIDIA) और 1.58% (विस्पर-लार्ज-v3-टर्बो) है। अंतर छोटे हैं; तैनाती अंतर विशाल हैं।

## अवधारणा

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**एन्कोडर आउटपुट को छोड़ दें `T`फ्रेम स्तर पर वितरण `V+1`टोकन (V अक्षर + रिक्त) । एक लक्ष्य स्ट्रिंग के लिए `y`लम्बाई `U < T`, किसी भी फ्रेम संरेखण जो गिर जाता है करने के लिए `y`गणना करता है। सीटीसी हानि ऐसे सभी संरेखणों पर योग करता है। इन्फरेन्सः प्रति फ्रेम argmax, गिरावट दोहराता है, रिक्त स्थानों को हटाता है।

लाभः गैर-स्वतः-रिग्रेसिव, स्ट्रीमेबल, शून्य लुकहेड। नुकसानः *सशर्त स्वतंत्रता धारणा*  प्रत्येक फ्रेम भविष्यवाणी दूसरों से स्वतंत्र है, इसलिए कोई आंतरिक भाषा मॉडल नहीं है। बीम खोज या क्षैतिज संलयन के माध्यम से बाहरी एलएम के साथ फिक्स करें।

**RNN-T intuition.**एक * भविष्यवाणीकर्ता * नेटवर्क जो टोकन इतिहास एम्बेड करता है और एक * जोइनर * जो एक संयुक्त वितरण में एन्कोडर फ्रेम के साथ भविष्यवाणीकर्ता राज्य को जोड़ता है `V+1`(द `+1`स्पष्ट रूप से CTC की अवहेलना की सशर्त निर्भरता का मॉडल। स्ट्रीम करने योग्य क्योंकि प्रत्येक चरण केवल पिछले फ्रेम और पिछले टोकन पर स्थित है।

लाभः स्ट्रीमेबल + आंतरिक एलएम। नुकसानः प्रशिक्षण अधिक जटिल और स्मृति-भूख (3D हानि जाल) है; आरएनएन-टी हानि कर्नेल अपने आप में एक पूरी पुस्तकालय श्रेणी हैं।

**Attention encoder-decoder.**लॉग-मेल फ्रेम पर एन्कोडर (6-32 ट्रांसफार्मर परतें) । डेकोडर (6-32 ट्रांसफार्मर परतें) ऑटोरेग्रेसिव रूप से टोकन उत्पन्न करने के लिए एन्कोडर आउटपुट की क्रॉस-एटेंडर करता है। कोई संरेखण प्रतिबंध नहीं  ऑडियो में कहीं भी ध्यान देख सकता है। ध्यान को सीमित करने के अलावा गैर-स्ट्रीम करने योग्य (छंटनी हुई व्हिस्पर-स्ट्रीमिंग, 2024) ।

लाभः ऑफ़लाइन एएसआर पर उच्चतम गुणवत्ता, मानक सीक्यू2सेक्यू उपकरण के साथ प्रशिक्षित करना आसान। नुकसानः ऑटोरेग्रेसिव विलंबता आउटपुट लंबाई के समान है; इंजीनियरिंग के बिना स्ट्रीम नहीं किया जा सकता है।

### WER: एक संख्या

**Word Error Rate**= $(S + D + I) / N$, जहां $S$=विनिमय, $D$=विनाश, $I$=संवर्धन, $N$= संदर्भ शब्द गणना. शब्द स्तर पर लेवेंसस्टाइन संपादन दूरी से मेल खाता है. निम्न बेहतर है. 20% से अधिक का WER आमतौर पर उपयोग करने योग्य नहीं है; 5% से नीचे पढ़ना भाषण के लिए मानव-सामान्यता है। मानक बेंचमार्क पर 2026 संख्याएंः

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

ये सभी एन्कोडर-डेकोडर या आरएनएन-टी आधारित हैं। शुद्ध सीटीसी सिस्टम (वाव2वीसी 2.0) परीक्षण-स्वच्छता पर लगभग 1.82.1% पर बैठते हैं।

```figure
ctc-collapse
```

## इसे बनाओ

### चरण 1: लालची सीटीसी डिकोड

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

दो नियमः लगातार दोहराव को तोड़ना, खाली छोड़ना। उदाहरणः `a a _ _ a b b _ c`→ `a a b c`. .

### चरण 2: बीम-सर्च सीटीसी

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

उत्पादन में एलएम संलयन के साथ पूर्वावलोकन पेड़ बीम खोज का उपयोग किया जाता है; यह अवधारणात्मक कंकाल है।

### चरण 3: WER

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

### चरण 4: विस्मय के खिलाफ निष्कर्ष

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026 में सबसे मजबूत सामान्य एएसआर के लिए एक लाइनर। यह वास्तविक समय में ~ 20 × पर 24 जीबी जीपीयू पर चलता है।

### चरण 5: Parakeet या wav2vec 2.0 के साथ स्ट्रीमिंग

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

स्ट्रीमिंग एएसआर को टुकड़े टुकड़े एन्कोडर ध्यान और ले जाने की स्थिति की आवश्यकता है; एक पुस्तकालय का उपयोग करें जो इसे समर्थन करता है (NeMo के लिए Parakeet, `transformers``chunk_length_s`) ।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## 2026 में भी फंसे हुए जाल

- **No VAD.**चुपचाप चलना हिलसिनेंस पैदा करता है ("देखने के लिए धन्यवाद!") हमेशा VAD के साथ गेट।
- **Character vs word vs subword WER.**शब्द स्तर के WER *after* normalization (कम अक्षर, अंकन हटाया गया) की रिपोर्ट करें।
- **Language ID drift.**विस्पर का ऑटो एलआईडी शोर क्लिप को जापानी या वेल्श में गलत मार्ग पर ले जाता है; बल `language="en"`जब आप जानते हैं.
- **Long clips without chunking.**विस्पर में 30 सेकंड का एक विंडो है।`chunk_length_s=30, stride=5`किसी भी लंबे समय के लिए.

## इसे भेजें

`outputs/skill-asr-picker.md`. एक दिए गए तैनाती लक्ष्य के लिए मॉडल, डिकोडिंग रणनीति, चश्मांकन और एलएम संलयन चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. यह लालची से हस्तनिर्मित सीटीसी आउटपुट को डिक्रिप्ट करता है और संदर्भ के साथ WER की गणना करता है।
2. **Medium.**चरण 2 में पूर्वावलोकन-वृक्ष बीम खोज को ठीक से लागू करें (खाली विलय नियम की गणना करें) 10 उदाहरण सिंथेटिक डेटासेट पर लालच के साथ तुलना करें।
3. **Hard.**उपयोग करें`whisper-large-v3-turbo`पर[LibriSpeech test-clean](https://www.openslr.org/12). पहले 100 बयानों पर WER की गणना करें. प्रकाशित संख्याओं की तुलना करें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## आगे पढ़ना

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) सीटीसी पेपर।
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) आरएनएन-टी पेपर।
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) 2022 के कैनोनिकल पेपर; 2024 में v3-turbo विस्तार।
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026 ओपन एएसआर लीडरबोर्ड का नेता।
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 25+ मॉडल पर लाइव बेंचमार्क।
