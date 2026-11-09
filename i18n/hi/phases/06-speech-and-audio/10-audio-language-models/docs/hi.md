# ऑडियो-भाषा मॉडल  Qwen2.5-Omni, ऑडियो फ्लेमिंगो, GPT-4o ऑडियो

> 2026 ऑडियो-भाषा मॉडल भाषण + पर्यावरण ध्वनि + संगीत पर तर्क देते हैं। Qwen2.5-Omni-7B MMAU-Pro पर GPT-4o ऑडियो से मेल खाता है। ऑडियो फ्लेमिंगो नेक्स्ट LongAudioBench पर Gemini 2.5 Pro से बेहतर है। खुले और बंद के बीच अंतर अनिवार्य रूप से बंद है  मल्टी-ऑडियो कार्यों के अलावा, जहां सभी लगभग यादृच्छिक हैं।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## समस्या

आपके पास 5 सेकंड का ऑडियो हैः कुत्ते का लात, कोई चिल्लाता है "रोक!", फिर चुपचाप। उपयोगी प्रश्न कई अक्षों पर फैले हुए हैंः

- **Transcription.**"क्या कहा गया था?
- **Semantic reasoning.**"क्या व्यक्ति खतरे में है? "  को चीख + चिल्ला + चुपचाप की संयुक्त समझ की आवश्यकता होती है।
- **Music reasoning.**"क्या वाद्ययंत्रों ने गाने बजाए हैं?
- **Long-audio retrieval.**"इस 90 मिनट के व्याख्यान में प्रशिक्षक ने ग्रेडिएंट डाउनसेंट को कहां समझाया?

एक मॉडल जो इन सभी का एक ही संकेत के साथ जवाब देता है एक है **audio-language model**शुद्ध एएसआर से अलगः एलएएलएम केवल प्रतिलेखन नहीं बल्कि मुक्त रूप से प्राकृतिक भाषा में उत्तर प्रदान करते हैं।

## अवधारणा

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### तीन घटक टेम्पलेट

2026 के प्रत्येक LALM में एक ही कंकाल होता हैः

1. **Audio encoder.**विस्पर एन्कोडर · बीएटीएस · CLAP · वेवएलएम · या प्रति मॉडल कस्टम एन्कोडर।
2. **Projector.**एलएलएम के टोकन एम्बेडिंग स्पेस में रैखिक या एमएलपी ब्रिजिंग ऑडियो-एन्कोडर सुविधाएं।
3. **LLM.**Llama / Qwen / Gemma आधारित डिकोडर। इंटरलेव्ड टेक्स्ट + ऑडियो टोकन लेता है; टेक्स्ट उत्पन्न करता है।

प्रशिक्षणः

- **Stage 1.**फ्रीज एन्कोडर + LLM; केवल ASR / कैप्शन डेटा पर ट्रेन प्रोजेक्टर।
- **Stage 2.**निर्देशों के बाद ऑडियो कार्यों (QA, तर्क, संगीत समझ) पर पूर्ण / लोरा बारीक-बारी से ट्यून करना।
- **Stage 3 (optional).**आवाज-इन / आवाज-आउट एक भाषण डिकोडर जोड़ता है। Qwen2.5 Omni और AF3-चैट ऐसा करते हैं।

### 2026 मॉडल नक्शा

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### वास्तविकता जांच (2026)

**MMAU-Pro.**1800 QA जोड़े भाषण / ध्वनि / संगीत / मिश्रित को कवर करते हैं। बहु-ऑडियो उपसमूह शामिल है।

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

**multi-audio column is damning for everyone.**4-विकल्प बहुविकल्पीय विकल्प पर यादृच्छिक संभावना = 25%; अधिकांश मॉडल वहां के आसपास स्कोर करते हैं। LALM अभी भी दो क्लिप की तुलना करने के लिए संघर्ष करते हैं।

### 2026 में जहां LALM उपयोगी हैं

- **Compliance audit of call-center recordings.**"क्या एजेंट ने आवश्यक प्रकटीकरण का उल्लेख किया?
- **Accessibility.**बधिर उपयोगकर्ताओं को ध्वनि घटनाओं का वर्णन करें (केवल प्रतिलेखन नहीं) ।
- **Content moderation.**हिंसक भाषा + धमकी देने वाली आवाज़ + पृष्ठभूमि संदर्भ का पता लगाएं।
- **Podcast / meeting chaptering.**अर्थपूर्ण सारांश, न केवल वक्ता के मोड़।
- **Music catalog analysis.**"बी-सेक्शन कुंजी परिवर्तन के साथ सभी ट्रैक खोजें। "

### जहां वे (अभी तक) उपयोगी नहीं हैं

- बारीक-खोल संगीत सिद्धांत (अकॉर्ड स्तर से नीचे) ।
- लंबी बातचीत (अंतिम 10 मिनट) के दौरान वक्ता द्वारा जिम्मेदार तर्क।
- बहु-ऑडियो तुलना (22-26 प्रतिशत) केवल यादृच्छिक से ऊपर है।
- वास्तविक समय स्ट्रीमिंग तर्क (ज्यादातर ऑफलाइन बैच inference हैं) ।

```figure
v4-alm-tokens
```

## इसे बनाओ

### चरण 1: Qwen2.5-Omni क्वेरी

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### चरण 2: प्रोजेक्टर पैटर्न

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

यह है. प्रोजेक्टर आमतौर पर 1-3 रैखिक परतों है. इसे एएसआर जोड़े (ऑडियो → ट्रांसक्रिप्ट) पर प्रशिक्षित करना चरण-1 बहाना कार्य है।

### चरण 3: एमएमएयू / लॉन्गऑडियोबेंच की बेंचमार्किंग

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`डेटासेट रेपो में अंक `data.zip`(लगभग 47 जीबी), तो स्कोर करने से पहले इसे डाउनलोड और अनज़िप। यह सटीक मैच लूप एक मानसिकता जांच है, बेंचमार्क स्कोरर नहीं है, इसलिए इसकी संख्या प्रकाशित एमएमएयू-प्रो परिणामों के साथ तुलनात्मक नहीं है। आधिकारिक मूल्यांकनकर्ता समानता (NV-Embed-v2) को एम्बेड करके बहुविकल्पीय उत्तरों से मेल खाता है, LLM न्यायाधीश के साथ खुले अंत उत्तरों को दर्जा देता है, और निर्देश के बाद के उत्तरों को रेजेक्स नियमों के साथ जांचता हैः एक के लिए भविष्यवाणियां लिखें `model_output`स्तंभ और रन `evaluate_mmau_pro_comprehensive.py`[MMAU-Pro repo](https://github.com/sonalkum/MMAUPro). प्रत्येक रिपोर्ट`category`(भाषण, ध्वनि, संगीत, बहु, और बाकी) अलग अलग। संकलित संख्याएं छिप जाती हैं जहां मॉडल विफल रहता है।

## इसका प्रयोग करें

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## फंदे

- **Over-trust on multi-audio.**यदि आपके कार्य को "कौन सी क्लिप में X है" की आवश्यकता है, तो यादृच्छिक-संयोग स्तर पर प्रदर्शन वास्तविक है।
- **Long-audio degradation.**10 मिनट के बाद, अधिकांश मॉडल के स्पीकर एट्रिब्यूशन टूट जाते हैं। पहले डायरीज करें (पाठ 6) , फिर सारांशित करें।
- **Hallucinations on silence.**वही विस्पर शैली समस्या LALMs द्वारा विरासत में मिली है कि विस्पर एन्कोडर का उपयोग. VAD-गेट.
- **Benchmark cherry-picking.**विक्रेता ब्लॉग पोस्ट सर्वश्रेष्ठ मामले श्रेणियों को उजागर करते हैं. अपने आप को MMAU-प्रो बहु ऑडियो उपसमूह चलाएं।

## इसे भेजें

`outputs/skill-alm-picker.md`किसी दिए गए ऑडियो-समझने के कार्य के लिए LALM + बेंचमार्क उपसमूह + आउटपुट-मोडालिटी (पाठ बनाम भाषण) चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`एक खिलौना प्रोजेक्टर पैटर्न + नकली LALM रूटिंग (ऑडियो-एम्बेडेड, पाठ-टोकन) → आउटपुट टोकन देखने के लिए।
2. **Medium.**100 MMAU-प्रो भाषण वस्तुओं पर Qwen2.5-ओम्नी-7B स्कोर करें। कागज की रिपोर्ट संख्या की तुलना करें।
3. **Hard.**न्यूनतम ऑडियो कैप्शनिंग बेसलाइन बनाएंः बीएटीएस एन्कोडर + 2-परत प्रोजेक्टर + जमे हुए लैमा-3.2-1बी। केवल ऑडियोकैप्स पर प्रोजेक्टर को ठीक से ट्यून करें। क्लोटो-एक्यूए पर सल्मन की तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## आगे पढ़ना

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) संदर्भ वास्तुकला।
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) भाषण-इन-स्पीच-आउट।
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) खुले लंबे ऑडियो नेता।
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA।
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) दोहरे एन्कोडर के अग्रणी।
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) लाइव 2026 रैंकिंग।
