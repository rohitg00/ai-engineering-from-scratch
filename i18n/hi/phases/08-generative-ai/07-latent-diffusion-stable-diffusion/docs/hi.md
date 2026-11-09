# लातेंट विसारण और स्थिर विसारण

> 512 × 512 छवियों पर पिक्सेल-स्पेस विसारण एक कम्प्यूटेशनल युद्ध अपराध है। Rombach et al. (2022) ने देखा कि आपको एक छवि उत्पन्न करने के लिए सभी 786k आयामों की आवश्यकता नहीं है। आपको अर्थ संरचना को कैप्चर करने के लिए पर्याप्त की आवश्यकता है, और बाकी के लिए एक अलग डिकोडर। VAE के लोटेंट स्थान के अंदर विसारण चलाएं। यह एक विचार स्थिर विसारण है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## समस्या

पिक्सेल अंतरिक्ष विसारण 5122 पर मतलब है कि यू-नेट आकार के टेंसर पर चलता है `[B, 3, 512, 512]`. प्रत्येक नमूना चरण 500M-पैरम यू-नेट के लिए ~ 100 GFLOPS है. 50 चरण प्रति छवि 5 TFLOPS है. एक अरब छवियों पर ट्रेन और गणना बिल absurd है.

अधिकांश FLOP नेट के माध्यम से उच्च आवृत्ति बनावट को संपीड़ित करने के लिए जाते हैं जो एक खोने वाले VAE को दूर कर सकता है। रोम्बाच का विचारः एक बार एक VAE को प्रशिक्षित करें (*पहला चरण*), इसे जमे, और 4-चैनल 64×64 लटेंट स्पेस (* दूसरा चरण*) में पूरी तरह से प्रसारण चलाएं। वही U-Net। पिक्सल का 1/16। ~64x कम FLOPs तुलनात्मक गुणवत्ता के लिए।

यह स्थिर विसारण नुस्खा है. एसडी 1.x / 2.x एक 860M यू-नेट पर इस्तेमाल किया `64×64×4`लटेंट, SDXL एक 2.6B U-नेट पर इस्तेमाल किया `128×128×4`, SD3 ने प्रवाह मिलान के साथ एक विसारण ट्रांसफार्मर (DiT) के लिए यू-नेट को बदल दिया। Flux.1-dev (ब्लैक फॉरेस्ट लैब्स, 2024) 12B-परम DiT-MMDiT जहाज करता है। सभी एक ही दो-चरण सब्सट्रेट पर चलते हैं।

## अवधारणा

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**एन्कोडर $E(x) \to z$, डिकोडर$D(z) \to x$. लक्ष्य संपीड़नः प्रत्येक स्थानिक अक्ष में 8 × डाउनसैम्पल + चैनल समायोजित करें ताकि कुल लटेंट आकार पिक्सल की संख्या का ~1/16 वां हो। हानि = पुनर्निर्माण (L1 + LPIPS धारणा) + KL (छोटा वजन तो $z$यह भी Gaussian के लिए मजबूर नहीं है, क्योंकि हम से सटीक नमूना लेने की जरूरत नहीं है$z$) अक्सर शत्रुतापूर्ण हार के साथ प्रशिक्षित होते हैं इसलिए डिकोड किए गए चित्र तेज होते हैं।

2. **Stage 2 — diffusion on $z$.**उपचार$z = E(x_{\text{real}})$डेटा के रूप में. एक यू-नेट (या डीआईटी) को निंदा करने के लिए प्रशिक्षित करें$z_t$. निष्कर्ष परः नमूना $z_0$प्रसार के माध्यम से, तो $x = D(z_0)$. .

**Text conditioning.**दो अतिरिक्त घटक। एक जमे हुए पाठ एन्कोडर (एसडी 1.x के लिए CLIP-L, एसडी 2/एक्सएल के लिए CLIP-L+OpenCLIP-G, एसडी 3 और फ्लक्स के लिए T5-XXL) । एक क्रॉस-अटेंशन इंजेक्शनः प्रत्येक यू-नेट ब्लॉक लेता है `[Q = image features, K = V = text tokens]`टोकन केवल पाठ छवि को प्रभावित करने का तरीका है।

**The loss function is identical to Lesson 06.**शोर पर समान डीडीपीएम / प्रवाह MSE मेल खाता है. आप बस डेटा डोमेन को आदान-प्रदान.

## वास्तुकला संस्करण

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

रुझानः यू-नेट को डीआईटी (लैटिनेंट पैच पर ट्रांसफार्मर) से बदल दें, पाठ एन्कोडर को स्केल करें (T5 त्वरित अनुपालन के लिए CLIP से बेहतर है), लैटिन चैनलों को बढ़ाएं (4 → 16 अधिक विवरण हेडरूम देता है) ।

```figure
noise-schedule
```

## इसे बनाओ

`code/main.py`एक खेलौना 1-डी "VAE" (एक निश्चित पैमाने-by-0.5 एन्कोडर और इसका सटीक विपरीत डिकोडर के रूप में, प्रदर्शन के लिए; एक वास्तविक VAE एक conv नेट होगा) को DDPM के ऊपर स्टैक करता है और वर्गीकरण मुक्त मार्गदर्शन के साथ वर्ग कंडीशनिंग जोड़ता है। यह दिखाता है कि एक ही विसार हानि काम करता है चाहे आप कच्चे 1-डी मानों या एन्कोडेड मानों पर चलें। यह कुंजी अंतर्दृष्टि है।

### चरण 1: एन्कोडर/डेकोडर

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

एक वास्तविक VAE में प्रशिक्षित वजन होते हैं। शिक्षा के लिए, यह रैखिक नक्शा यह दिखाने के लिए पर्याप्त है कि विसारण पर काम करता है।$z$मूल डेटा स्थान के बारे में परवाह किए बिना।

### चरण 2: प्रसारण में`z`- अंतरिक्ष

उसी डीडीपीएम के साथ पाठ 06. नेट पर देखे जाने वाले डेटा $z = E(x)$. नमूना लेने के बाद$z_0$, के साथ डिकोड$D(z_0)$. .

### चरण 3: वर्गीकरणकर्ता मुक्त मार्गदर्शन

प्रशिक्षण के दौरान, 10% समय में वर्ग लेबल को छोड़ दें (नल टोकन से बदलें) । निष्कर्ष पर, दोनों की गणना करें $\epsilon_{\text{cond}}$और $\epsilon_{\text{uncond}}$, तो:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= कोई मार्गदर्शन नहीं (पूर्ण विविधता),$w = 3$= डिफ़ॉल्ट, $w = 7+$= संतृप्त / अति- तेज।

### चरण 4: पाठ को संचालित करना (कन्सेप्ट, कोड नहीं)

वर्ग लेबल को एक जमे हुए पाठ एन्कोडर आउटपुट के साथ बदलें. U-Net में एम्बेडेड पाठ को क्रॉस-अटेंशन के माध्यम से फ़ीड करेंः

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

यह एक वर्ग-सशर्त विसारण मॉडल और स्थिर विसारण के बीच एकमात्र भौतिक अंतर है।

## फंदे

- **VAE-scale mismatch.**SD 1.x VAEs में स्केलिंग कंसंटेंट (`scaling_factor ≈ 0.18215`यह भूलना यू-नेट को बहुत गलत विचलन के साथ लटते पर ट्रेन बनाता है। प्रत्येक चेकपोस्ट एक जहाज।
- **Text encoder silently wrong.**SD3 T5-XXL की जरूरत है के साथ >=128 टोकन, और वापस करने के लिए CLIP-केवल है घाटा. हमेशा जाँच `use_t5=True`या शीघ्र निष्ठा क्रेटर.
- **Mixing latent spaces.**SDXL, SD3, Flux सभी अलग-अलग VAEs का उपयोग करते हैं। SDXL लटेंट पर प्रशिक्षित एक LoRA SD3 पर काम नहीं करेगा। Hugging Face विसारक 0.30+ असंगत चेकपोइंट लोड करने से इनकार करता है।
- **CFG too high.** `w > 10`विविधता की कीमत पर संतृप्त, तेली छवियों का उत्पादन करता है और अति-अनुकूलता के लिए संकेत।`w = 3-7`. .
- **Negative prompts leaking.**खाली नकारात्मक संकेत शून्य टोकन बन जाता है; एक भरा नकारात्मक संकेत  बन जाता है$\epsilon_{\text{uncond}}$ये एक ही नहीं हैं; कुछ पाइपलाइन चुपचाप शून्य पर डिफ़ॉल्ट हैं।

## इसका प्रयोग करें

2026 में उत्पादन स्टैकः

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## इसे भेजें

सहेजें`outputs/skill-sd-prompter.md`. कौशल एक पाठ प्रम्प्ट + लक्ष्य शैली और आउटपुट लेता हैः मॉडल + चेकपॉइंट, CFG स्केल, नमूना, नकारात्मक प्रम्प्ट, रिज़ॉल्यूशन, वैकल्पिक ControlNet/IP-Adapter संयोजन, और प्रति चरण QA चेकलिस्ट।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`मार्गदर्शन के साथ$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$. वर्गों के अनुसार औसत नमूना रिकॉर्ड करें.$w$क्या वर्ग के साधन वास्तविक डेटा साधनों से परे भिन्न होते हैं?
2. **Medium.**पुनः निर्माण हानि के साथ एक TANH-MLP एन्कोडर / डिकोडर जोड़ी के लिए खिलौना रैखिक एन्कोडर बदलें। नए लटेंट पर प्रसार को पुनः प्रशिक्षित करें। क्या नमूना गुणवत्ता बदलती है?
3. **Hard.**डिफ्यूज़र के साथ एक वास्तविक स्थिर विसारण अनुमान स्थापित करेंः लोड `sdxl-base`, CFG के साथ 30 Euler कदम चलाओ 7, समय यह. अब स्विच करने के लिए`sdxl-turbo`4 चरणों और CFG=0 के साथ। एक ही विषय, अलग गुणवत्ता  क्या बदल गया है और क्यों का वर्णन करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## उत्पादन नोटः 8GB उपभोक्ता जीपीयू पर फ्लोक्स-12बी चलाना

संदर्भ प्रवाह एकीकरण एक विघटन डीटी पर लागू एक ही तीन-बटन नुस्खा उत्पादन inference साहित्य सूची है।

1. **Staggered loading.**फ्लेक्स में चार नेटवर्क हैं जिन्हें वीआरएएम में कभी सह-अस्तित्व की आवश्यकता नहीं हैः टी 5-एक्सएक्सएल टेक्स्ट एन्कोडर (एफपी 32 में ~ 10 जीबी), क्लिप-एल (छोटा), 12 बी एमएमडीआईटी, और वीएई। सबसे पहले प्रॉम्प्ट को एन्कोड करें, * डिलीट * एन्कोडर, डीआईटी लोड करें, डीनोइस करें, * डिलीट * डीआईटी, वीएई लोड करें, डिकोड करें। उपभोक्ता 8 जीपीयू एक समय में केवल एक चरण फिट बैठते हैं।
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`T5 एन्कोडर और DiT दोनों पर। 8× मेमोरी कटौती, गुणवत्ता में गिरावट Aritra के बेंचमार्क के लिए प्रति छवि पाठ के लिए अपरिहार्य है (नोटबुक में लिंक किया गया है) ।
3. **CPU offload.** `pipe.enable_model_cpu_offload()`प्रत्येक आगे के पास के रूप में सीपीयू और जीपीयू के बीच स्वचालित रूप से मॉड्यूल swaps. 10-20% विलंबता जोड़ता है लेकिन पाइपलाइन को चलाने के लिए बिल्कुल बनाता है।

स्मृति लेखांकन हैः `10 GB T5 / 8 = 1.25 GB`क्वांटिज़्ड, `12 B params × 0.5 bytes = ~6 GB`क्वांटिफाइड डीटी, प्लस सक्रियण. stas00 के शब्दों में यह TP=1 निष्कर्ष का चरम अंत है  कोई मॉडल समानांतर, अधिकतम क्वांटिफिकेशन. उत्पादन के लिए आप H100 पर TP=2 या TP=4 चलाएंगे; एक एकल डेव लैपटॉप के लिए, यह नुस्खा है।

## आगे पढ़ना

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) स्थिर विसारण।
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) एसडीएक्सएल।
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) डीआईटी
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT।
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG।
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) फ्लोक्स-1 परिवार।
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) उपरोक्त प्रत्येक चेक-अप बिंदु के लिए संदर्भ कार्यान्वयन।
