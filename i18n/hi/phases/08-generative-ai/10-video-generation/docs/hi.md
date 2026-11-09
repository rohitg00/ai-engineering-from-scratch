# वीडियो पीढ़ी

> एक छवि एक 2-डी टेंसर है। एक वीडियो एक 3-डी है। सिद्धांत एक ही है; गणना 10-100 गुना कठिन है। ओपनएआई के सोरा (फरवरी 2024) ने यह संभव साबित किया। 2026 तक वीओ 2, क्लिंग 1.5, रनवे जेन-3, पिका 2.0 और वाइन 2.2 जहाज उत्पादन वीडियो 1080 पी पर पाठ से है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## समस्या

10 सेकंड का 1080p वीडियो 24fps पर 240 फ्रेम 1920×1080×3 पिक्सल है. यह प्रति क्लिप लगभग 1.5 GB कच्चे डेटा है. पिक्सल-स्पेस विसार असंभव है. आपको आवश्यकता हैः

1. **Spatiotemporal compression.**एक VAE जो वीडियो को कोड करता है, फ्रेम नहीं, अंतरिक्ष-समय पैच के अनुक्रम में।
2. **Temporal coherence.**फ्रेम को सामग्री, प्रकाश व्यवस्था और वस्तु पहचान को सेकंड में साझा करना चाहिए। नेट को गति का मॉडल बनाना चाहिए।
3. **Compute budget.**वीडियो प्रशिक्षण एक ही मॉडल आकार के लिए छवि की तुलना में 10-100 गुना अधिक महंगा है।
4. **Conditioning.**अधिकांश प्रोडक्शन मॉडल इन चारों को स्वीकार करते हैं।

वास्तुकला जो इस हल किया है **Diffusion Transformer (DiT)**अंतरिक्ष-समय पैच पर लागू, विशाल (प्रोम्प्ट, कैप्शन, वीडियो) डेटा सेट पर प्रशिक्षित। पाठ 06 के समान विसारण हानि।

## अवधारणा

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### पेंच करना

वीडियो को 3 डी VAE (अध्ययन अंतरिक्ष-समय संपीड़न) के साथ एन्कोड करें। लटेंट आकार है `[T_latent, H_latent, W_latent, C_latent]`. आकार के टुकड़ों में विभाजित .`[t_p, h_p, w_p]`. सोरा शैली के मॉडल के लिए, `t_p = 1`(प्रति फ्रेम पैच) या `t_p = 2`10 सेकंड का 1080p वीडियो लगभग 20,000-100,000 पैच तक संपीड़ित होता है।

### अंतरिक्ष-समय डीआईटी

एक ट्रांसफार्मर पैचों के सपाट अनुक्रम को संसाधित करता है। प्रत्येक पैच में 3 डी स्थितित्मक एम्बेडिंग (समय + वाई + एक्स) होती है। ध्यान आमतौर पर कारक में विभाजित होता हैः

- **Spatial attention**प्रत्येक फ्रेम के पैच के भीतर।
- **Temporal attention**एक ही स्थान पर फ्रेम के पार।
- **Full 3D attention**16-100 गुना अधिक महंगा है; केवल कम रिज़ॉल्यूशन या अनुसंधान में इस्तेमाल किया जाता है।

### पाठ को संचालित करना

एक बड़े पाठ एन्कोडर के साथ क्रॉस-अटेंशन (सोरा के लिए T5-XXL, CogVideoX-5B T5-XXL का उपयोग करता है) । लंबे समय तक प्रम्प्ट्स मायने रखते हैं।

### प्रशिक्षण

स्पेस-टाइमरल लटेंट्स पर मानक विसारण हानि (ε या v भविष्यवाणी) । डेटाः वेब वीडियो + ~ 100M क्यूरेट क्लिप + सिंथेटिक पाठ कैप्शन। गणनाः 10,000+ GPU घंटे यहां तक कि एक छोटे शोध रन के लिए; सोरा-स्केल 100,000+ है।

## 2026 के उत्पादन परिदृश्य

| Model | Date | Max duration | Max res | Open weights? | Notable |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | First model to show world simulator properties at scale |
| Sora Turbo | 2024-12 | 20s | 1080p | No | Production Sora at 5x faster inference |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | Highest quality + physics in 2025 |
| Veo 3 | 2025 Q3 | 15s | 4K | No | Native audio and stronger camera control |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | Best human motion in 2025 Q1 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | Professional video tools on top |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | Strongest character consistency |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | First open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | Open SOTA late 2024 |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | Most permissively licensed |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | Strongest open model mid-2025 |

ओपन वेट इमेज स्पेस की तुलना में तेजी से अंतर को बंद कर रहे हैंः हनुआनवीडियो + वाएन 2.2 लोरा 2026 के मध्य तक अधिकांश ओपन-सोर्स वर्कफ़्लो को पहले से ही संचालित कर रहे हैं।

```figure
video-diffusion-denoise
```

## इसे बनाओ

`code/main.py`यह एक छोटे से सिंथेटिक वीडियो को पैच करने के लिए एक पैच प्रति स्थिति एम्बेडिंग जोड़ता है, और पैच पर एक ट्रांसफार्मर शैली ध्यान के साथ पूरे अनुक्रम को निषेध करता है। कोई नम्पी नहीं; शुद्ध पायथन। हम दिखाते हैं कि 1-डी में भी समयबद्ध सुसंगतता दिखाई देती है जब आसन्न फ्रेम पैच एक निषेधकर्ता और स्थिति एम्बेडिंग साझा करते हैं।

### चरण 1: एक सिंथेटिक 1-डी "वीडियो" को पैच करें

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### चरण 2: प्रति फ्रेम स्थिति एम्बेडिंग

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### चरण 3: denoiser पूरे अनुक्रम को देखता है

प्रत्येक फ्रेम को स्वतंत्र रूप से निरुत्तर करने के बजाय, हमारा छोटा सा जाल सभी फ्रेम मानों + उनकी स्थिति एम्बेडिंग को जोड़ता है और सभी फ्रेम के लिए शोर की भविष्यवाणी करता है।

### चरण 4: समयबद्ध सहसंबंध परीक्षण

प्रशिक्षण के बाद, एक वीडियो का नमूना लें। फ्रेम-टू-फ्रेम डेल्टा मापें। यदि मॉडल ने समय संरचना सीखी है, तो डेल्टा प्रत्येक फ्रेम को स्वतंत्र रूप से नमूने लेने से छोटा रहता है।

## फंदे

- **Independent per-frame sampling = flicker.**यदि आप प्रत्येक फ्रेम पर अलग से छवि विसारण चलाते हैं, तो आउटपुट फ्लिंक करता है क्योंकि प्रत्येक फ्रेम का शोर स्वतंत्र है। वीडियो विसारण ध्यान या साझा शोर के माध्यम से फ्रेम को जोड़कर इसे ठीक करता है।
- **Naive 3D attention = OOM.**10 सेकंड 1080p लटेंट पर पूर्ण 3D ध्यान सैकड़ों अरबों ऑपरेशन है। अंतरिक्ष + समय में फैक्टरीज़ करें।
- **Data captioning matters more than size.**पहले के कामों के मुकाबले सोरा का मुख्य उन्नयन ~ 10 गुना अधिक विस्तृत कैप्शन (जीपीटी-4 पुनः लेबल क्लिप) पर प्रशिक्षण था। ओपनएआई की तकनीकी रिपोर्ट इस पर स्पष्ट है।
- **First-frame conditioning.**अधिकांश उत्पादन मॉडल पहली फ्रेम के रूप में एक छवि को भी स्वीकार करते हैं। यह "छवि-टू-वीडियो" मोड है; प्रशिक्षण में यह संस्करण शामिल है।
- **Physics drift.**लम्बी क्लिप (> 10s) में सूक्ष्म असंगति होती है। स्लाइडिंग विंडो जनरेशन + कीफ्रेम एंकरिंग मदद करता है।

## इसका प्रयोग करें

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

गुणवत्ता समता पर वीडियो की प्रति सेकंड लागत 2024 से 2026 के बीच 20 गुना गिर गई है।

## इसे भेजें

सहेजें`outputs/skill-video-brief.md`. कौशल एक वीडियो संक्षिप्त (समय, पहलू अनुपात, शैली, कैमरा योजना, विषय सुसंगतता, ऑडियो) और आउटपुट लेता हैः मॉडल + होस्टिंग, शीघ्र स्टैफलिंग (कैमरा भाषा, विषय विवरण, गति वर्णक), बीज + पुनरुत्पादन प्रोटोकॉल, और फ्रेम स्तर QA चेकलिस्ट।

## व्यायाम

1. **Easy.**`code/main.py`, फ्रेम प्रति फ्रेम डेल्टा की तुलना (a) स्वतंत्र प्रति फ्रेम नमूनाकरण, (b) संयुक्त अनुक्रम नमूनाकरण के लिए करें। डेल्टा के औसत और भिन्नता की रिपोर्ट करें।
2. **Medium.**एक पहले फ्रेम की स्थिति जोड़ेंः एक दिए गए मान पर पिन फ्रेम 0 और शेष का नमूना लें। मापें कि पिन मूल्य कैसे फैलता है।
3. **Hard.**स्थानीय जीपीयू पर CogVideoX-2B चलाने के लिए HuggingFace विसारक का उपयोग करें। समय 20 अनुमान 6 सेकंड के क्लिप के लिए 720p पर कदम। बोतल गला की पहचान करने के लिए अंतरिक्ष-समय ध्यान को प्रोफाइल करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | Encoder that compresses `(T, H, W, C)` → spatiotemporal latent. |
| Patches | "The tokens" | Fixed-size 3-D blocks of the latent; input to the DiT. |
| Factorized attention | "Spatial + temporal" | Run attention over space, then over time; skip full 3-D attention. |
| Image-to-video (I2V) | "Animate this photo" | Model takes an image + text, outputs a video that starts from it. |
| Keyframe conditioning | "Anchor frames" | Pin specific frames to control the video's arc. |
| Motion brush | "Directional hint" | UI input where the user paints motion vectors onto the image. |
| Re-captioning | "Dense captions" | Using an LLM to re-label training clips with detailed prompts. |
| Flicker | "Temporal artifact" | Frame-to-frame inconsistency; fixed with coupled denoising. |

## उत्पादन नोटः वीडियो लटेंट्स मेमोरी-बैंडविड्थ समस्या है

10 सेकंड की 1080p क्लिप 24 fps पर 240 फ्रेम × 1920 × 1080 × 3 ≈ 1.5 जीबी कच्चे पिक्सल है। 4 × वीडियो VAE संपीड़न के बाद (`2 × spatial × 2 × temporal`) प्रति अनुरोध ~ 100 MB है। इसे बैच 1 पर 30 चरणों के लिए एक स्पेस-टाइमरल डीटी के माध्यम से चलाएं और आप ~ 3 GB / चरण के माध्यम से HBM  मेमोरी बैंडविड्थ, FLOPs नहीं, स्थानांतरित कर रहे हैं, यह बोतल की खाई है।

तीन उत्पादन बटन, सभी सीधे उत्पादन-उत्पाद साहित्य से बाहर निकाले गए थे

- **TP across the DiT.**पाठ-से-वीडियो मॉडल नियमित रूप से ≥10B पैरामीटर हैं। 4 H100s पर TP=4 मानक है; 405B-वर्ग के मॉडल के लिए PP=2 × TP=2। प्रत्येक चरण में लटेंसी लगभग रैखिक रूप से TP के साथ पूरी तरह से कम दीवार तक गिरती है।
- **Frame batching = continuous batching.**वीडियो उत्पादन समय पर, अवधारणात्मक रूप से ध्यान से जुड़े फ्रेमों का एक बैच है। निरंतर बैचिंग (फ्लाइट शेड्यूलिंग) लागू होता हैः आरंभ रेंडरिंग फ्रेम `t+1`फ्रेम के दौरान`t-1`यदि मॉडल वास्तुकला स्लाइडिंग विंडो जनरेशन की अनुमति देती है तो लौटाया जा रहा है।
- **Clip-level prefill cache.**छवि-टू-वीडियो के लिए, पहली फ्रेम कंडीशनिंग एलएलएम के शीघ्र प्रीफिल के समान हैः इसे एक बार गणना करें, temporal decoder पास पर पुनः उपयोग करें। यह वीडियो के लिए प्रभावी रूप से KV-कैश है।

## आगे पढ़ना

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) सोरा तकनीकी रिपोर्ट।
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX।
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) हनुयुआनवीडियो.
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview) मोची-1।
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) SOTA को मध्य 2025 में खोलना।
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) वीडियो प्रसारण पेपर।
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) स्थिर वीडियो विसारण का पूर्वज।
