# विस्फोर  वास्तुकला और ठीक-ठीक ट्यूनिंग

> विस्पर एक 30 सेकंड विंडो ट्रांसफार्मर एन्कोडर-डेकोडर है, जिसे बहुभाषी कम से कम पर्यवेक्षित ऑडियो-पाठ जोड़े के 680k घंटे पर प्रशिक्षित किया गया है। एक वास्तुकला, कई कार्य, 99 भाषाओं में मजबूत। 2026 संदर्भ एएसआर।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## समस्या

ओपनएआई द्वारा सितंबर 2022 में जारी किया गया व्हिस्पर, एक वस्तु के रूप में जहाज करने वाला पहला एएसआर मॉडल थाः ऑडियो पेस्ट करें, पाठ प्राप्त करें, 99 भाषाएं, शोर के लिए मजबूत, लैपटॉप पर चलता है। 2024 तक ओपनएआई ने लार्ज-वी 3 और टर्बो संस्करणों को भेजा था; 2026 तक, व्हास्पर पॉडकास्ट प्रतिलेखन से लेकर वॉयस असिस्टेंट तक यूट्यूब उपशीर्षक तक सब कुछ के लिए डिफ़ॉल्ट बेसलाइन है।

लेकिन विस्पर एक पाइपलाइन नहीं है जिसे आप हमेशा के लिए ब्लैक बॉक्स के रूप में व्यवहार कर सकते हैं। डोमेन शिफ्ट इसे मारता है  तकनीकी जारगोन, स्पीकर उच्चारण, उचित संज्ञाएं, लघु क्लिप, चुपचाप। आपको यह जानना होगाः

1. यह वास्तव में अंदर क्या है.
2. इसे ठीक से टुकड़े टुकड़े, स्ट्रीमिंग या लंबी-आकार का ऑडियो कैसे दें।
3. कब और कैसे ठीक करना है।

## अवधारणा

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**मानक ट्रांसफार्मर एन्कोडर-डेकोडर।

- इनपुटः 30 सेकंड लॉग-मेल स्पेक्ट्रोग्राम, 80 मील, 10 एमएस हॉप → 3000 फ्रेम। छोटे क्लिप शून्य-पैड हैं, लंबे क्लिप टुकड़े हैं।
- एन्कोडरः conv-downsample (चरण 2) + `N`बड़े V3: 32 परतों, 1280-अस्तित्व, 20 सिर के लिए.
- डिकोडर: `N`कारण स्वयं-attn + क्रॉस-attn को encoder आउटपुट के साथ ट्रांसफार्मर ब्लॉक. कोडर के समान आकार.
- आउटपुट: 51,865 टोकन वाले शब्दकोश पर बीपीई टोकन।

बड़े v3 में 1.55B पैरामीटर हैं। टर्बो एक 4-परत डिकोडर (32 से) का उपयोग करता है, जो <1% WER हिट के साथ 8 × विलंबता को काटता है।

**The prompt format.**विस्पर एक मल्टीटास्क मॉडल है जो डिकोडर प्रॉम्प्ट में विशेष टोकन द्वारा निर्देशित हैः

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: भाषा टैग; ऑडियो में बोली जाने वाली भाषा का नाम। इसे बाहर छोड़ दें और विस्पर पहले भाषा का पता लगाता है।
- `<|transcribe|>`या `<|translate|>`: कार्य टैग; भाषण को उसकी स्रोत भाषा में ट्रांसक्रिप्ट करें, या इसे अंग्रेजी पाठ में अनुवाद करें।
- `<|notimestamps|>`: शब्द स्तर के समय टिकटों को छोड़ें (जल्दी) ।

प्रॉम्प्ट वह है जो एक मॉडल को कई कार्य करने देता है। परिवर्तन `<|en|>``<|fr|>`और यह फ्रेंच में अनुवादित है।

**30-second window.**सब कुछ 30 सेकंड तक चिपकाया जाता है। लंबे क्लिप को चकनाचूर करने की आवश्यकता होती है; छोटे क्लिप पैड होते हैं। विंडोज को मूल रूप से स्ट्रीम नहीं किया जाता है।

**Log-mel normalization.** `(log_mel - mean) / std`आप *मोस्ट* उपयोग करना चाहिए Whisper के पूर्व प्रसंस्करण (`whisper.audio.log_mel_spectrogram`), नहीं `librosa.feature.melspectrogram`. .

### 2026 में वैरिएंट

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### ठीक से समायोजित करना

2026 में कैनोनिक वर्कफ़्लोः

1. लक्षित डोमेन ऑडियो के 10100 घंटे संरेखित प्रतिलेखन के साथ एकत्र करें।
2. दौड़ें`transformers.Seq2SeqTrainer`के साथ`generate_with_loss`वापस कॉल.
3. पैरामीटर-प्रभावी: लोरा पर `q_proj`,`k_proj`,`v_proj`ध्यान परतों की लागत के साथ 4 × GPU स्मृति कम WER लागत के साथ.
4. यदि आपके पास <10 घंटे हैं तो एन्कोडर को फ्रीज करें। केवल डिकोडर को समायोजित करें।
5. विस्पर के अपने टोकनाइज़र और शीघ्र प्रारूप का उपयोग करें; टोकनाइज़र कभी नहीं बदला।

सामुदायिक परिणामः 20 घंटे के चिकित्सा निर्देश पर मध्यम स्तर पर चिकित्सा शब्दावली पर WER 12% से घटकर 4.5% हो जाता है। 4 घंटे के आइसलैंडिक भाषा में Turbo के ठीक से समायोजित होने पर WER 18% से घटकर 6% हो जाता है।

```figure
sp-asr-attention
```

## इसे बनाओ

### चरण 1: बॉक्स से बाहर Whisper चलाएं

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

कुंजी डिफ़ॉल्ट आप हमेशा ओवरराइड करना चाहिएः `temperature=0.0`(0.0 → 0.2 → 0.4 ... बैक-अप श्रृंखला के लिए डिफ़ॉल्ट नमूने) ।`condition_on_previous_text=False`(कस्केडिंग हल्यूसिनेशन समस्या को रोकता है), तथा`no_speech_threshold=0.6`(चुपचाप का पता लगाने) ।

### चरण 2: टुकड़े टुकड़े लंबे आकार

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

विस्परएक्स (1) सिलेरो VAD गेटिंग, (2) वेव2वीसी 2.0 के माध्यम से शब्द स्तर संरेखण, (3) डायरीकरण के माध्यम से जोड़ता है `pyannote.audio`. उत्पादन प्रतिलेखन के लिए 2026 कार्य घोड़ा.

### चरण 3: लोरा के साथ ठीक से ट्यून करें

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

फिर मानक ट्रेनर लूप, हर 1000 कदम पर चेकपॉइंट, WER के साथ मूल्यांकन किया गया था.

### चरण 4: प्रत्येक परत क्या सीखती है, उसका निरीक्षण करें

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

एक हीटमैप के साथ दृश्यमान करें  आप शब्द समयशीर्षक की विस्पर की अवधारणा है।

## इसका प्रयोग करें

2026 स्टैकः

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 बैकेंड) 2026 में सबसे तेज CPU + GPU निष्कर्षण रनटाइम है 4x वैनिला से तेज समान आउटपुट के साथ।

## 2026 में भी फंसे हुए जाल

- **Hallucinated text on silence.**शिलालेखों पर प्रशिक्षित विस्पर में "देखने के लिए धन्यवाद!", "सब्स्क्राइब करें!", गीत गीत शामिल हैं। हमेशा कॉल करने से पहले VAD-गेट।
- **`condition_on_previous_text` cascade.**एक भ्रम बाद के खिड़कियों को प्रदूषित करता है।`False`जब तक आप टुकड़ों के पार धाराप्रवाहता की जरूरत है.
- **Short-clip padding.**30 सेकंड तक पैच किए गए 2 सेकंड के क्लिप में पीछे की चुप्पी में हलुसिनाशन हो सकता है।`pad=False`या VAD-गेट.
- **Wrong mel stats.**विस्पर के बजाय लिब्रोसा के मिल्स का उपयोग करने से लगभग यादृच्छिक आउटपुट होता है।`whisper.audio.log_mel_spectrogram`. .

## इसे भेजें

`outputs/skill-whisper-tuner.md`किसी दिए गए डोमेन के लिए एक विस्पर फाइन-ट्यूनिंग या इन्फेरेंस पाइपलाइन डिजाइन करें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`यह एक विस्पर शैली के संकेतों को टोकन बनाता है, decoded आकार बजट की गणना, और 10 मिनट क्लिप के लिए टुकड़ा कार्यक्रम प्रिंट करता है।
2. **Medium.**स्थापित करें`faster-whisper`, एक 10 मिनट का पॉडकास्ट ट्रांसक्रिप्ट, मानव ट्रांसक्रिप्ट के साथ WER तुलना.`language="auto"`वि. मजबूर`language="en"`. .
3. **Hard.**एचएफ का उपयोग करना `datasets`, एक भाषा चुनें जो विस्पर (उदाहरण के लिए उर्दू) के साथ संघर्ष करती है, 2 घंटे में 2 काल के लिए मध्यम को लोरा के साथ ठीक से ट्यून करें, और डब्ल्यूईआर डेल्टा रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## आगे पढ़ना

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) मूल वास्तुकला और प्रशिक्षण नुस्खा।
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) 4 परतों का डिकोडर, 8x गति।
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) लम्बे आकार, शब्द-अनुसूचित, दैनिक।
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 समर्थित, 4x तेज।
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) कैनोनिक लोरा/ फुल-एफटी वॉचथ्रू।
