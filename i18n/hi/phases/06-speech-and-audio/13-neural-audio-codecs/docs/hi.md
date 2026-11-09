# न्यूरल ऑडियो कोडक्स  एनकोडेक, एसएनएसी, मिमी, डीएसी और सेमेन्टिक-अकाउस्टिक स्प्लिट

> 2026 ऑडियो पीढ़ी लगभग सभी टोकन है। एनकोडेक, एसएनएसी, मिमी और डीएसी निरंतर तरंग रूपों को अलग-अलग अनुक्रमों में बदल देते हैं जो एक ट्रांसफार्मर भविष्यवाणी कर सकते हैं। अर्थ-विरोधी ध्वनिक टोकन विभाजन  पहले कोडबुक के रूप में अर्थपूर्ण, आराम के रूप में ध्वनिक  ऑडियो के लिए ट्रांसफार्मर के बाद से सबसे महत्वपूर्ण वास्तुकला परिवर्तन है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## समस्या

भाषा मॉडल डिस्क्रिट टोकन पर काम करते हैं। ऑडियो निरंतर है। यदि आप भाषण / संगीत के लिए एलएलएम शैली मॉडल चाहते हैं  MusicGen, मोशी, सेसम सीएसएम, वाइबवॉइस, ऑर्फियस  आपको पहले एक की आवश्यकता है **neural audio codec**: एक सीखा एन्कोडर जो ऑडियो को टोकन की एक छोटी शब्दावली में भेदता है, और एक मेल खाने वाला डेकोडर जो तरंग के रूप को पुनर्निर्माण करता है।

दो परिवारों का जन्म हुआ हैः

1. **Reconstruction-first codecs** EnCodec, DAC. धारणात्मक ऑडियो गुणवत्ता को अनुकूलित करें. टोकन "अकाउस्टिक" हैं  वे स्पीकर पहचान, टिमबर, पृष्ठभूमि शोर सहित सब कुछ कैप्चर करते हैं।
2. **Semantic-first codecs** मिमी (क्यूताई), स्पीचटोकनाइज़र. भाषाई / ध्वन्यात्मक सामग्री को एन्कोड करने के लिए पहली कोडबुक को मजबूर करें (अक्सर WavLM से डिस्टिल करके) । बाद की कोडबुक ध्वनिक विवरण हैं।

2024-2026 के लिए अंतर्दृष्टिः **a pure reconstruction codec gives you blurry speech when you try to generate from text.**कोडक टोकन पर एलएलएम को एक ही कोडबुक में भाषा संरचना और ध्वनिक संरचना दोनों सीखनी होती है, जो पैमाने पर नहीं होती है। उन्हें अलग करना  अर्थपूर्ण कोडबुक 0, ध्वनिक कोडबुक 1-एन  यह है जो मोशी और सेसम सीएसएम को काम करता है।

## अवधारणा

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### मुख्य चाल: अवशिष्ट वेक्टर क्वांटिज़ेशन (आरवीक्यू)

एक बड़ी कोडबुक के बजाय (जो अच्छी गुणवत्ता के लिए लाखों कोड की आवश्यकता होगी), सभी आधुनिक ऑडियो कोडक का उपयोग करते हैं **RVQ**: छोटी कोडबुकों का एक कैस्केड। पहला कोडबुक एन्कोडर आउटपुट को क्वांटिफाई करता है; दूसरा अवशिष्ट को क्वांटिफाई करता है; आदि प्रत्येक कोडबुक में 1024 कोड होते हैं। 8 कोडबुक = प्रभावी शब्दावली $1024^8 = 10^{24}$. .

निष्कर्ष के समय, डिकोडर प्रति फ्रेम में सभी चुने गए कोडों का योग करता है।

### 2026 में महत्वपूर्ण होने वाले चार कोडेक

**EnCodec (Meta, 2022).**मूल रेखा. तरंगरूप पर एन्कोडर-डेकोडर, RVQ बोतल गला. 24 kHz, 32 कोडबुक संभव, डिफ़ॉल्ट 4 कोडबुक @ 1.5 kbps. उपयोग `1D conv + transformer + 1D conv`आर्किटेक्चर. संगीतजन द्वारा इस्तेमाल किया.

**DAC (Descript, 2023).**आरवीक्यू के साथ एल 2 मानकीकृत कोडबुक, आवधिक सक्रियण फ़ंक्शन, बेहतर नुकसान। किसी भी खुले कोडक की उच्चतम पुनर्निर्माण निष्ठा  कभी-कभी 12 कोडबुक के साथ मूल भाषण से अपरिभाषित। 44.1 किलोग्राम पूर्ण बैंड।

**SNAC (Hubert Siuzdak, 2024).**बहु-पैमाना RVQ  मोटी कोडबुक ठीक से लोगों की तुलना में कम फ्रेम दर पर काम करते हैं। प्रभावी रूप से ऑडियो पदानुक्रमिक रूप से मॉडल करते हैंः ~ 12 हर्ट्ज पर एक मोटी "स्केच" प्लस 50 हर्ट्ज पर विवरण। ऑर्फियस-3 बी द्वारा उपयोग किया जाता है क्योंकि पदानुक्रम संरचना एलएम-आधारित पीढ़ी पर अच्छी तरह से मैप करती है।

**Mimi (Kyutai, 2024).**2026 गेम-चेंजर। 12.5 हर्ट्ज फ्रेम रेट (बहुत कम), 8 कोडबुक @ 4.4 kbps। कोडबुक 0 है **distilled from WavLM** वेवएलएम की भाषण सामग्री सुविधाओं की भविष्यवाणी करने के लिए प्रशिक्षित। कोडबुक 1-7 ध्वनिक अवशेष हैं। यह विभाजन मोशी (पाठ 15) और सीएसएम सीएसएम को संचालित करता है।

### भाषा मॉडलिंग के लिए फ्रेम रेट मायने रखता है

कम फ्रेम रेट = कम क्रम = तेज एलएम।

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

12.5 हर्ट्ज पर, 10 सेकंड का बयान केवल 125 कोडेक फ्रेम है  एक ट्रांसफार्मर आसानी से उन्हें भविष्यवाणी कर सकता है।

### अर्थिक बनाम ध्वनिक टोकन

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**वेवएलएम से एक सहायक भविष्यवाणी हानि के माध्यम से डिस्टिल।
- **Acoustic tokens (codebooks 1-7).**एन्कोड टिमबर, स्पीकर पहचान, प्रोसोडी, पृष्ठभूमि शोर, बारीक विवरण।

एक एआर एलएम पहले सेमैटिक टोकन (पाठ पर स्थित) की भविष्यवाणी करता है, फिर ध्वनिक टोकन (सेमैटिक + स्पीकर संदर्भ पर स्थित) की भविष्यवाणी करता है। यह कारककरण इस कारण से आधुनिक टीटीएस शून्य शॉट-क्लोन आवाजों को संभाल सकता हैः सेमैटिक मॉडल सामग्री को संभालता है; ध्वनिक मॉडल टिमब्रे को संभालता है।

### 2026 पुनर्निर्माण गुणवत्ता (बिट प्रति सेकंड, कम बिटरेट बेहतर है)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

ओपस जैसे पारंपरिक कोडेक अभी भी धारणात्मक गुणवत्ता पर जीतते हैं।**discrete tokens**(जो ओपस नहीं बनाता है) और **generative-model quality**(LM उन टोकन के साथ क्या कर सकते हैं).

```figure
rvq-codec-cascade
```

## इसे बनाओ

### चरण 1: EnCodec के साथ एन्कोड

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

`n_codebooks=8`6 kbps. प्रत्येक कोड 0-1023 (10-बिट) है।

### चरण 2: पुनःसंरचना को डिकोड और मापें

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### चरण 3: अर्थ-असंत विभाजन (मिमी शैली)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

अर्थिक कोडबुक 0 WavLM-अनुसूचित है। आप पाठ से अर्थिक ट्रांसफार्मर को प्रशिक्षित कर सकते हैं  सीधे ऑडियो में जाने की तुलना में बहुत छोटा शब्दावली। फिर एक स्पीकर संदर्भ पर एक अलग ध्वनिक-तरंग रूप डिकोडर स्थितियां।

### चरण 4: क्यों एआर एलएम कोडक टोकन पर काम करता है

मिमी के 12.5 हर्ट्ज × 8 कोडबुक पर 10 सेकंड की स्पीच क्लिप के लिएः

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 टोकन एक ट्रांसफार्मर के लिए एक तुच्छ संदर्भ है। एक 256M पैरामीटर ट्रांसफार्मर आधुनिक जीपीयू पर मिलीसेकंड में 10 सेकंड भाषण उत्पन्न कर सकता है।

## इसका प्रयोग करें

नक्शा समस्या → कोडकः

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

अंगूठे का नियम: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## फंदे

- **Too many codebooks.**कोडबुक जोड़ने से निष्ठा में रैखिक वृद्धि होती है लेकिन एलएम अनुक्रम की लंबाई में रैखिक वृद्धि होती है। 8-12 पर रुकें।
- **Frame-rate mismatch.**12.5 हर्ट्ज पर प्रशिक्षण LM मिमी फिर 50 हर्ट्ज पर ठीक-ठीक EnCodec चुपचाप विफल रहता है।
- **Assuming all codebooks equal.**मिमी में, कोडबुक 0 सामग्री ले जाता है; इसे खोने से समझदारी नष्ट हो जाती है। कोडबुक 7 खोना शायद ही ध्यान देने योग्य है।
- **Using reconstruction quality as the only metric.**एक कोडेक में महान पुनर्निर्माण हो सकता है लेकिन यदि अर्थ संरचना खराब है तो एलएम आधारित पीढ़ी के लिए बेकार हो सकता है।

## इसे भेजें

`outputs/skill-codec-picker.md`किसी दिए गए जनरेटिव या संपीड़न कार्य के लिए एक कोडेक चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. यह एक खिलौना स्केलर + अवशिष्ट क्वांटायज़र लागू करता है और जब आप कोडबुक जोड़ते हैं तो पुनर्निर्माण त्रुटि को मापता है।
2. **Medium.**स्थापित करें`encodec`और एक लंबे समय तक भाषण क्लिप पर 1, 4, 8, 32 कोडबुक की तुलना करें।
3. **Hard.**मिमी लोड करें. एक क्लिप एन्कोड करें. कोडबुक 0 को यादृच्छिक पूर्णांक से बदलें; डिकोड करें। फिर कोडबुक 7 को इसी तरह से बदलें। दो भ्रष्टाचारों की तुलना करें  कोडबुक 0 भ्रष्टाचार समझने योग्यता को नष्ट करना चाहिए; कोडबुक 7 भ्रष्टाचार को शायद ही कुछ भी बदलना चाहिए।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## आगे पढ़ना

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) आरवीक्यू बेसलाइन।
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) उच्चतम निष्ठा खुला।
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) बहु-पैमाना RVQ।
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) अर्थ-ध्वनि विभाजन, वेवएलएम डिस्टिलिशन।
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) दो चरणों का अर्थिक/अकाउस्टिक प्रतिमान।
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) मूल स्ट्रीमिंग RVQ कोडक।
