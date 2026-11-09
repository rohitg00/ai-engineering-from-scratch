# संगीत पीढ़ी  संगीत पीढ़ी, स्थिर ऑडियो, सूनो और लाइसेंसिंग भूकंप

> 2026 संगीत पीढ़ीः Suno v5 और Udio v4 वाणिज्यिक पर हावी हैं; MusicGen, Stable Audio Open, और ACE-Step ओपन-सोर्स का नेतृत्व करते हैं। तकनीकी समस्या ज्यादातर हल हो गई है। कानूनी समस्या (वॉर्नर म्यूजिक $ 500M निपटान, UMG निपटान) ने 2025-2026 में क्षेत्र को फिर से आकार दिया।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## समस्या

पाठ → 30 सेकंड से 4 मिनट तक का संगीत क्लिप, जिसमें गीत, स्वर और संरचना है। तीन उप-समस्याएंः

1. **Instrumental generation.**"लो-फी हिप-हॉप ड्रम के साथ गर्म कुंजी" → ऑडियो।
2. **Song generation (with vocals + lyrics).**"टेक्सस में बारिश की रातों के बारे में देश का गीत" → पूरा गीत.
3. **Conditional / controllable.**एक मौजूदा क्लिप का विस्तार करें, एक पुल, स्वैप शैली, स्टेम-अलग या इनपेंट को पुनर्जीवित करें। यूडियो का इनपेंटिंग + स्टेम सेपरेशन 2026 फीचर के अनुरूप है।

## अवधारणा

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### तंत्रिका-कोडेक टोकन पर टोकन LM

मेटा **MusicGen**(2023, MIT) और कई व्युत्पन्नः पाठ / संगीत एम्बेडिंग पर स्थिति, ऑटोरेग्रेसिव रूप से एनकोडेक टोकन (32 kHz, 4 कोडबुक) की भविष्यवाणी करें, एनकोडेक के साथ डिकोड करें। 300M - 3.3B पैरामीटर। मजबूत बेसलाइन; संघर्ष 30 सेकंड से अधिक।

**ACE-Step**(खुले स्रोत, 4B XL अप्रैल 2026 में जारी) यह पूर्ण गीत गीत-संरचित पीढ़ी के लिए विस्तारित है। खुला समुदाय की सबसे करीबी चीज सूनो है।

### पिघल या लटेंट पर फैलाव

**Stable Audio (2023)**और **Stable Audio Open (2024)**संपीड़ित ऑडियो पर लटेंट विसारण. लूप, ध्वनि डिजाइन, परिवेश बनावट में उत्कृष्ट. संरचित पूर्ण गीतों में अच्छा नहीं है।

**AudioLDM / AudioLDM2**: T2I शैली के लटेंट प्रसार के माध्यम से पाठ-ऑडियो, संगीत, ध्वनि प्रभाव, भाषण के लिए सामान्य।

### हाइब्रिड (उत्पादन)  सुनो, उडियो, लिरिया

बंद वजन. संभवतः एआर कोडेक एलएम + विसारक आधारित वोकॉडर विशेष आवाज / ड्रम / मेलोडी हेड के साथ। Suno v5 (2026) ELO 1293 गुणवत्ता नेता है। Udio v4 में पेंटिंग + स्टेम अलगाव (बास, ड्रम, वोकल्स अलग डाउनलोड) जोड़ता है।

### मूल्यांकन

- **FAD (Fréchet Audio Distance).**VGGish या PANNs सुविधाओं का उपयोग करके उत्पन्न बनाम वास्तविक ऑडियो वितरण के बीच एम्बेडिंग-स्तर की दूरी। निचला बेहतर है। MusicGen छोटाः MusicCaps पर 4.5 FAD; SOTA ~3.0.
- **Musicality (subjective).**मानव प्राथमिकता. सूनो V5 ELO 1293 लीड.
- **Text-audio alignment.**शीघ्र और आउटपुट के बीच CLAP स्कोर।
- **Musicality artifacts.**अप-बीट संक्रमण, आवाज-वक्तों की बहाव, संरचना का नुकसान 30 सेकंड के बाद.

## 2026 मॉडल नक्शा

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

## कानूनी परिदृश्य (2025-2026)

- **Warner Music vs Suno settlement.**$500 मिलियन. WMG अब Suno पर AI-like, संगीत अधिकारों और उपयोगकर्ता-जनित ट्रैक की देखरेख करता है।
- **EU AI Act**+ **California SB 942**: एआई द्वारा उत्पन्न संगीत का खुलासा किया जाना चाहिए।
- **Riffusion / MusicGen**MIT के तहत कोई अनुपालन सामान नहीं है लेकिन कोई वाणिज्यिक आवाज भी नहीं है।

जहाज के सुरक्षित पैटर्नः

1. केवल वाद्ययंत्र (MusicGen, स्थिर ऑडियो ओपन, MIT/CC0 आउटपुट) उत्पन्न करें।
2. प्रति पीढ़ी लाइसेंस के साथ वाणिज्यिक एपीआई (सुनो, यूडियो, इलेवनलैब्स म्यूजिक) का उपयोग करें।
3. स्वामित्व या लाइसेंस प्राप्त कैटलॉग पर ट्रेन (ज्यादातर उद्यम यहां समाप्त होते हैं) ।
4. वॉटरमार्क + मेटाडेटा के साथ पीढ़ी को टैग करें।

```figure
sp-codec-tokens
```

## इसे बनाओ

### चरण 1: MusicGen के साथ उत्पन्न करें

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

तीन आकारः `small`(300M, तेजी से), `medium`(1.5B), `large`(3.3B) "विचार को भूमि देता है" के लिए छोटा पर्याप्त है।

### चरण 2: संगीत को अनुकूलित करना

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody एक क्रोमोग्राम लेता है और टिमब्रे को बदलते हुए धुन को संरक्षित करता है। "मुझे यह धुन स्ट्रिंग क्वार्टेट के रूप में दें" के लिए उपयोगी।

### चरण 3: एफएडी मूल्यांकन

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

VGGish एम्बेडिंग दूरी का गणना करता है. शैली स्तर पर प्रतिगमन परीक्षण के लिए उपयोगी; मानव श्रोताओं के लिए कोई विकल्प नहीं।

### चरण 4: एमएलए-संगीत कार्यप्रवाह में जोड़ना

पाठ 7-8 के विचारों के साथ मिलाएंः

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## इसका प्रयोग करें

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## 2026 में भी फंसे हुए जाल

- **Copyright-laundering prompts.**"टायलर स्विफ्ट की शैली में गीत"  वाणिज्यिक सुन / ऑडियो फिल्टर इन अब, खुले मॉडल नहीं करते हैं. अपनी खुद की फिल्टर सूची जोड़ें।
- **Repetition / drift past 30 s.**एआर मॉडल लूप। कई पीढ़ियों को क्रॉसफेड करें, या संरचनात्मक सुसंगतता के लिए एसीई-स्टेप का उपयोग करें।
- **Tempo drift.**मॉडल BPM से भटकते हैं। librosa के साथ शीघ्र और पोस्ट फ़िल्टर में BPM टैग का उपयोग करें `beat_track`. .
- **Vocal intelligibility.**सुनो उत्कृष्ट है; खुले मॉडल अक्सर शब्दों पर शर्मीली होते हैं। यदि गीत महत्वपूर्ण हैं, तो एक वाणिज्यिक एपीआई या फाइन-ट्यून का उपयोग करें।
- **Mono output.**खुले मॉडल मोनो या नकली स्टीरियो उत्पन्न करते हैं। एक उचित स्टीरियो पुनर्निर्माण (जैसे, कार्टेशिया का स्टीरियो प्रसार) के साथ अपग्रेड करें।

## इसे भेजें

`outputs/skill-music-designer.md`. संगीत-जन के तैनाती के लिए मॉडल, लाइसेंस रणनीति, लंबाई / संरचना योजना और प्रकटीकरण मेटाडेटा चुनें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. यह एक "जनरेटिव" एकॉर्ड प्रगति + ड्रम पैटर्न ASCII प्रतीकों के रूप में उत्पन्न करता है  एक संगीत-जन कार्टून. यदि आप चाहते हैं तो किसी भी MIDI रेंडरर के माध्यम से इसे वापस खेलें।
2. **Medium.**स्थापित करें`audiocraft`, 10 सेकंड क्लिप उत्पन्न करें 4 शैली संकेतों के साथ MusicGen-छोटे, संदर्भ शैली सेट के खिलाफ FAD मापने.
3. **Hard.**ACE-Step (या MusicGen-melody) का उपयोग करके, एक ही धुन के तीन भिन्नताओं को अलग-अलग टाइम्बर प्रॉम्प्ट के साथ उत्पन्न करें। संरेखण सत्यापित करने के लिए प्रॉम्प्ट के साथ CLAP समानता की गणना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## आगे पढ़ना

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) खुला ऑटोरेग्रेसिव बेंचमार्क।
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) ध्वनि डिजाइन डिफ़ॉल्ट।
- [ACE-Step](https://github.com/ace-step/ACE-Step) 4B फुल-सिंग जनरेटर, अप्रैल 2026 खोलें।
- [Suno v5 platform docs](https://suno.com) वाणिज्यिक गुणवत्ता के नेता।
- [AudioLDM2](https://arxiv.org/abs/2308.05734) संगीत + ध्वनि प्रभाव के लिए लटेंट विसारण।
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) नवंबर 2025 पूर्वानुमान।
