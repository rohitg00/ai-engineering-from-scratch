# स्ट्रीमिंग स्पीच-टू-स्पीच  मोशी, हिबिकी और फुल-डप्लक्स डायलॉग

> 2024-2026 में आवाज एआई को फिर से परिभाषित किया गया। मोशी एक एकल मॉडल भेजता है जो 200 एमएस विलंबता पर एक साथ सुनता है और बोलता है। हिबिकी भाषण-से-भाषण अनुवाद टुकड़ा-टुकड़ा करता है। दोनों मिमी कोडेक टोकन पर एक एकीकृत फुल-डप्लक्स वास्तुकला के लिए एएसआर → एलएलएम → टीटीएस पाइपलाइन को छोड़ देते हैं। यह नया संदर्भ डिजाइन है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## समस्या

पाठ 11 + 12 से निर्मित प्रत्येक वॉयस एजेंट में 300-500 एमएस के आसपास एक मौलिक विलंब स्तर होता हैः VAD फायर, STT प्रक्रियाएं, LLM कारण, TTS उत्पन्न करता है। प्रत्येक चरण की अपनी न्यूनतम विलंबता होती है। आप ट्यून और समानांतर कर सकते हैं, लेकिन पाइपलाइन आकार आपको कैप करता है।

मोशी (क्यूताई, 2024-2026) एक अलग सवाल पूछता हैः अगर कोई पाइपलाइन नहीं है तो क्या होगा? क्या होगा यदि एक मॉडल ऑडियो ले जाता है और सीधे, लगातार ऑडियो बाहर निकलता है, जिसमें आवश्यक चरण के बजाय पाठ एक मध्यवर्ती "आंतरिक मोनोलॉग" के रूप में होता है?

उत्तर है**full-duplex speech-to-speech**. सैद्धांतिक विलंबता 160 ms (80 ms मिमी फ्रेम + 80 ms ध्वनिक देरी) । एक एकल L4 GPU पर व्यावहारिक विलंबता 200 ms. यह एक वर्ग में सबसे अच्छा पाइपलाइन आवाज एजेंट हासिल करता है कि आधे है।

## अवधारणा

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### मोशी वास्तुकला

**Inputs.**दो मिमी कोडेक स्ट्रीम, दोनों 12.5 हर्ट्ज × 8 कोडबुक परः

- स्ट्रीम 1: उपयोगकर्ता ऑडियो (मिमी-एन्कोड, लगातार पहुंच)
- धारा 2: मोशी का अपना ऑडियो (मोशी द्वारा निर्मित)

**The transformer.**एक 7B पैरामीटर समय ट्रांसफार्मर दोनों धाराओं और एक पाठ "आंतरिक मोनोलॉग" धारा को संसाधित करता है। प्रत्येक 80 एमएस चरण पर, यहः

1. नवीनतम उपयोगकर्ता मिमी टोकन (8 कोडबुक) का उपभोग करता है।
2. नवीनतम मोशी मिमी टोकन (8 कोडबुक, जैसा कि उत्पादित है) का उपभोग करता है।
3. अगले मोशी पाठ टोकन (आंतरिक एकांतर) उत्पन्न करता है।
4. एक छोटे से गहराई ट्रांसफार्मर के माध्यम से अगले मोशी मिमी टोकन (8 कोडबुक) उत्पन्न करता है।

तीनों धाराएँ  उपयोगकर्ता ऑडियो, मोशी ऑडियो, मोशी पाठ  समानांतर चलती हैं। मोशी बोलते समय उपयोगकर्ता को सुन सकता है; उपयोगकर्ता के बाधित होने पर खुद को बाधित कर सकता है; अपने मुख्य कथन को तोड़ने के बिना बैक-चैनल ("एमएचएम") कर सकता है।

**The depth transformer.**फ्रेम के भीतर, 8 कोडबुक समानांतर में भविष्यवाणी नहीं की जाती हैं  उनके पास इंटर-कोडबुक निर्भरताएं हैं। एक छोटे से 2-परत "गहनता ट्रांसफार्मर" उन्हें 80 एमएस के भीतर क्रमशः भविष्यवाणी करता है। यह एआर कोडक एलएम के लिए मानक कारक है (जो VALL-E, VibeVoice द्वारा भी उपयोग किया जाता है) ।

### क्यों आंतरिक एकांत पाठ मदद करता है

बिना स्पष्ट पाठ के, मॉडल को अपनी ध्वनिक धारा में भाषा का तात्पर्य रूप से मॉडल करना होगा। मोशी का अंतर्दृष्टिः इसे ऑडियो के साथ पाठ टोकन जारी करने के लिए मजबूर करें। पाठ धारा अनिवार्य रूप से मोशी जो कह रहा है उसका प्रतिलिपि है। यह अर्थपूर्ण सुसंगतता में सुधार करता है, भाषा मॉडल हेड को बदलना आसान बनाता है, और आपको मुफ्त में प्रतिलिपि देता है।

### Hibiki: स्ट्रीमिंग भाषण-से-भाषण अनुवाद

एक ही वास्तुकला, अनुवाद जोड़े पर प्रशिक्षित। स्रोत ऑडियो में, लक्षित भाषा ऑडियो बाहर, निरंतर। Hibiki-Zero (फरवरी 2026) शब्द स्तर संरेखित प्रशिक्षण डेटा की आवश्यकता को समाप्त करता है।

चार भाषा जोड़े प्रारंभ में समर्थित; ≈1000 घंटे के साथ एक नई भाषा में अनुकूलित किया जा सकता है।

### व्यापक क्युताई स्टैक (2026)

- **Moshi** पूर्ण द्विपक्षीय संवाद (फ्रांसीसी पहले, अंग्रेजी अच्छी तरह से समर्थित)
- **Hibiki / Hibiki-Zero** समवर्ती भाषण अनुवाद
- **Kyutai STT** स्ट्रीमिंग एएसआर (500 ms या 2.5 सेकंड आगे की ओर देखते हुए)
- **Kyutai Pocket TTS** 100M-पैरम TTS CPU पर चलता है (जनवरी 2026)
- **Unmute** सार्वजनिक सर्वर पर इनका संयोजन करने वाली पूरी पाइपलाइन

L40S GPU पर पारगमनः 3× वास्तविक समय पर 64 समवर्ती सत्र।

### सीसाम सीएसएम  चचेरे भाई

सीसैम सीएसएम (2025) एक समान विचार का उपयोग करता है  एक मिमी कोडेक हेड के साथ एक लामा -3 रीढ़ की हड्डी। लेकिन सीएसएम पूर्ण-डूप्लेक्स के बजाय एकल-दिशात्मक है (संदर्भ + पाठ लेता है, भाषण का उत्पादन करता है) । यह बाजार पर सबसे अच्छा "ध्वनि उपस्थिति" टीटीएस है; मोशी की पूर्ण-डूप्लेक्स क्षमता के समान नहीं है।

### 2026 प्रदर्शन संख्या

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## इसे बनाओ

### चरण 1: इंटरफ़ेस

मोशी एक वेबसॉकेट सर्वर को उजागर करता है जो मिमी-एन्कोडेड ऑडियो के 80 एमएस टुकड़े लेता है और मिमी-एन्कोडेड ऑडियो के 80 एमएस टुकड़े लौटाता है। दोनों तरीकों से। लगातार।

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### चरण 2: पूर्ण-डूप्लेक्स लूप

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

दोनों दिशाएं एक साथ चलती हैं। पायथन असिनसियो या रुस्ट वायदा मानक परिवहन हैं।

### चरण 3: प्रशिक्षण उद्देश्य (संवैधानिक)

प्रत्येक 80 एमएस फ्रेम के लिए `t`:

- इनपुटः `user_mimi[0..t]`,`moshi_mimi[0..t-1]`,`moshi_text[0..t-1]`
- भविष्यवाणीः `moshi_text[t]`, तो `moshi_mimi[t, codebook_0..7]`

ऑडियो (आंतरिक एकांतर) से पहले पाठ का अनुमान लगाया जाता है; गहनता ट्रांसफार्मर के भीतर कोडबुक-अनुक्रमिक ऑडियो का अनुमान लगाया जाता है।

### चरण 4: जहां मोशी जीतता है और जहां वह नहीं जीतता है

मोशी जीतता हैः

- सस्ते हार्डवेयर पर अंत-से-अंत 250 ms के तहत।
- प्राकृतिक बैक-चैनल और विराम।
- कोई पाइपलाइन चिपकने कोड नहीं।

मोशी नहीं जीतता:

- उपकरण कॉल (इसके लिए प्रशिक्षित नहीं है; आपको एक अलग LLM पथ की आवश्यकता है) ।
- लंबी तर्क (मोशी 8 बी-श संवाद मॉडल है, क्लाउड/जीपीटी-4 नहीं) ।
- आला विषयों पर तथ्यात्मक सटीकता।
- अधिकांश उत्पादन उद्यम उपयोग के मामले (2026 में भी पाइपलाइन का उपयोग किया जाता है) ।

## इसका प्रयोग करें

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## फंदे

- **Limited tool calling.**मोशी एक संवाद मॉडल है, एक एजेंट ढांचा नहीं। उपकरण के लिए पाइपलाइन के साथ संयोजन।
- **Specific-voice conditioning.**मोशी एक ही प्रशिक्षित व्यक्ति का उपयोग करता है; क्लोनिंग एक अलग प्रशिक्षण रन है।
- **Language coverage.**फ्रेंच + अंग्रेजी उत्कृष्ट है; अन्य सीमित हैं। हिबिकी-ज़ेरो मदद करता है, लेकिन आपको अभी भी प्रशिक्षण डेटा की आवश्यकता है।
- **Resource cost.**एक पूर्ण मोशी सत्र में GPU स्लॉट होता है; सस्ते साझा किरायेदार तैनाती पैटर्न नहीं।

## इसे भेजें

`outputs/skill-duplex-pipeline.md`. एक आवाज एजेंट कार्यभार के लिए पाइपलाइन बनाम पूर्ण-डूपलेक्स वास्तुकला चुनें, कारण के साथ।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`यह दो धारा + आंतरिक मोनोलॉग वास्तुकला को प्रतीकात्मक रूप से अनुकरण करता है।
2. **Medium.**HuggingFace से मोशी को खींचें, सर्वर चलाएं, एक बातचीत का परीक्षण करें, उपयोगकर्ता के अंत-उपयोगकर्ता भाषण से मोशी प्रतिक्रिया की शुरुआत तक दीवार घड़ी की लटेंसी को मापें।
3. **Hard.**अपने पाठ 12 पाइपलाइन एजेंट ले लो और 20 मिलान परीक्षण बयानों पर P50 विलंबता बनाम मोशी की तुलना करें। लिखें जब एक पाइपलाइन वास्तुकार रूप से वैसे भी जीतता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## आगे पढ़ना

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) अखबार।
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) संरेखित डेटा के बिना स्ट्रीमिंग अनुवाद।
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) सीएसएम विनिर्देश।
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) स्थापित + सर्वर।
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) बंद वाणिज्यिक समकक्ष।
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) हुड के नीचे STT/TTS फ्रेमवर्क।
