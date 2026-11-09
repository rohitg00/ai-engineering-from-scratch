# स्टाइलगान

> अधिकांश जनरेटर हलचल $z$स्टाइलगैन इसे अलग अलग करता हैः पहला नक्शा$z$मध्यवर्ती $w$, फिर * इंजेक्शन *$w$यह एक परिवर्तन लटके हुए स्थान को उजागर किया और सात वर्षों तक फोटोरियल चेहरे को एक हल समस्या बना दिया।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## समस्या

एक डीसीजीएएन नक्शे $z$एक छवि के लिए एक ढेर के माध्यम से ट्रांसपोस्टेड घुमावदार. समस्याः $z$सब कुछ नियंत्रित करता है  आसन, प्रकाश, पहचान, पृष्ठभूमि  एक साथ उलझा हुआ।$z$आप मॉडल से "एक ही व्यक्ति, अलग पोज़" नहीं पूछ सकते क्योंकि प्रतिनिधित्व इस तरह कारक नहीं है।

Karras et al. (2019, NVIDIA) ने प्रस्तावित कियाः भोजन बंद करो $z$सीधे कंव परतों में। एक स्थिर फ़ीड`4×4×512`नेटवर्क इनपुट के रूप में tensor. एक 8-परत MLP जो मानचित्रण सीखें $z \in Z \to w \in W$इंजेक्शन$w$*अनुकूली उदाहरण सामान्यीकरण* (AdaIN) के माध्यम से प्रत्येक संकल्प परः प्रत्येक conv विशेषता मानचित्र को सामान्य बनाएं, फिर स्केल और बदलाव के द्वारा परिमाण अनुमान $w$स्टोकास्टिक विवरण (त्वचा के छिद्र, बालों के तार) के लिए प्रति परत शोर जोड़ें।

परिणाम: $W$"उच्च स्तर की शैली" (स्थिति, पहचान) बनाम "अच्छी शैली" (प्रकाश, रंग) के लिए लगभग ओर्तोगनल अक्ष हैं। आप छवि ए का उपयोग करके दो छवियों के बीच शैलियों को आदान-प्रदान कर सकते हैं $w$निम्न-रिज़ॉल्यूशन स्तर और छवि बी के लिए $w$यह अनलॉक संपादन, cross-domain स्टाइलिज़ेशन, और "StyleGAN-inversion" अनुसंधान की पूरी लाइन.

## अवधारणा

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, एक 8 परत MLP. $Z = \mathcal{N}(0, I)^{512}$. .$W$यह Gaussian होने के लिए मजबूर नहीं है  यह एक डेटा अनुकूलित आकार सीखता है।

**Synthesis network.**एक सीखे हुए निरंतर से शुरू होता है `4×4×512`. प्रत्येक संकल्प ब्लॉक: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`. प्रस्ताव दोहरे: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

कहाँ$y_{\text{scale}}$और $y_{\text{bias}}$$w$. विशेषता मानचित्र के अनुसार सामान्यीकरण, फिर पुनर्व्यवहार. "शैली" यहाँ विशेषता मानचित्र के प्रथम और द्वितीय क्रम के आंकड़े है.

**Per-layer noise.**एकल-चैनल गौशियन शोर प्रत्येक सुविधा मानचित्र में जोड़ा गया, एक सीखे गए प्रति-चैनल कारक द्वारा स्केल किया गया। वैश्विक संरचना को प्रभावित किए बिना स्टोकास्टिक विवरण को नियंत्रित करता है।

**Truncation trick.**निष्कर्ष पर, नमूना $z$, गणना $w = \text{mapping}(z)$, तो $w' = \hat{w} + \psi \cdot (w - \hat{w})$कहाँ$\hat{w}$औसत है $w$कई नमूनों पर।$\psi < 1$लगभग हर StyleGAN डेमो उपयोग करता है$\psi \approx 0.7$. .

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

2026 में StyleGAN3 (a) उच्च FPS पर संकीर्ण डोमेन फोटोरियलिज्म, (b) कुछ शॉट डोमेन अनुकूलन (एक नए डेटासेट पर 100 छवियों के साथ ट्रेन, फ्रीज मैपिंग), (c) इन्वर्शन आधारित संपादन (पाएं $w$जो एक असली तस्वीर को पुनर्निर्माण करता है, फिर संपादित करता है कि $w$) ओपन-डोमेन टेक्स्ट-टू-इमेज के लिए, यह उपकरण नहीं है  प्रसार है।

```figure
gx-stylegan-mapping
```

## इसे बनाओ

`code/main.py`1-डी में एक खिलौना "शैली-गैन लाइट" लागू करता हैः एक मानचित्रण एमएलपी, एक संश्लेषण समारोह जो एक सीखा निरंतर वेक्टर लेता है और इसे मॉड्यूल करता है $w$-उत्पन्न पैमाने/ पूर्वाग्रह, और प्रति परत शोर। यह दर्शाता है कि इंजेक्शन$w$अफ़िन-मॉड्यूलेशन मैच या धड़कनों के माध्यम से संरेखण $z$जनरेटर के इनपुट में.

### चरण 1: मानचित्रण नेटवर्क

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### चरण 2: अनुकूलन उदाहरण सामान्यीकरण

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

विशेषता-मैप पैमाने और पूर्वाग्रह से आते हैं $w$रैखिक प्रक्षेपण के माध्यम से।

### चरण 3: प्रति परत शोर

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

सिग्मा प्रति चैनल सीखना संभव है।

## फंदे

- **Droplet artifacts.**स्टाइलगैन 1 ने फीचर मैप्स में एक ब्लिब ड्रॉपलेट का उत्पादन किया क्योंकि एडाइन ने औसत शून्य कर दिया। स्टाइलगैन 2 के वजन डिमोड्यूलेशन ने इसे इसके बजाय कन्वॉल्यूशन वजन को स्केल करके ठीक किया।
- **Texture sticking.**StyleGAN 1 और 2 बनावट पिक्सेल निर्देशांक के बाद, ऑब्जेक्ट निर्देशांक (अंतरपूर्ती करते समय दिखाई देते हैं) के बजाय पीक्सेल निर्देशांक का पालन करती है। StyleGAN 3 के उपनाम मुक्त घुमाव इस विंडो वाले सिंक फ़िल्टर के साथ तय करते हैं।
- **Mode coverage.**काटना `ψ < 0.7`साफ दिखता है लेकिन संकीर्ण शंकु से नमूने; उपयोग `ψ = 1.0`अगर आपको विविधता की जरूरत है।
- **Inversion is lossy.**एक असली तस्वीर में उलटा $W$आमतौर पर अनुकूलन या एक एन्कोडर (e4e, ReStyle, HyperStyle) के माध्यम से किया जाता है। परिणाम कई पुनरावृत्ति पर बहते हैं।

## इसका प्रयोग करें

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

उत्पाद-ग्रेड डेमो के लिए जहां उत्तर "व्यक्ति के चेहरे की तस्वीर" है, स्टाइलगैन अनुमान लागत पर प्रसार (एक ही गुणवत्ता पट्टी पर <10ms, 4090 पर एक एकल आगे पास) और तीक्ष्णता से बेहतर है।

## इसे भेजें

सहेजें`outputs/skill-stylegan-inversion.md`. कौशल एक वास्तविक तस्वीर लेता है और आउटपुटः उल्टा विधि (e4e / ReStyle / HyperStyle), अपेक्षित लटेंट हानि, संपादन बजट (कई हद तक $W$आप कलाकृतियों से पहले आगे बढ़ सकते हैं), और ज्ञात-अच्छी तरह से संपादन दिशाओं (वयो, अभिव्यक्ति, मुद्रा) की एक सूची।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`के साथ`adain_on=True`और `adain_on=False`. एक निश्चित लटेंट बनाम परेशान लटेंट के लिए आउटपुट के प्रसार की तुलना करें.
2. **Medium.**मिश्रण नियमितकरण लागू करेंः प्रशिक्षण बैच के लिए, गणना $w_a$,$w_b$, और लागू करें $w_a$संश्लेषण के पहले आधे और $w_b$क्या डिकोडर अलग-अलग शैलियों को सीखता है?
3. **Hard.**एक पूर्व प्रशिक्षित StyleGAN3 FFHQ मॉडल (ffhq-1024.pkl) ले लो।$w$एक एसवीएम को लेबल किए गए नमूनों पर प्रशिक्षण देकर "स्मित" को नियंत्रित करने वाले दिशा; पहचान के विचलन से पहले आप कितनी दूर जा सकते हैं, इसकी रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## उत्पादन नोटः क्यों स्टाइलगैन अभी भी 2026 में जहाज

4090 पर StyleGAN3 10242 FFHQ चेहरे को 10 ms से कम में उत्पन्न करता है `num_steps = 1`उत्पादन के संदर्भ में यह किसी भी छवि जनरेटर के लिए तल की लटेंसी है. एक 50-चरण SDXL + VAE-डिकोड पाइपलाइन एक ही संकल्प पर ~ 3 सेकंड है।**300× gap**, और संकीर्ण डोमेन उत्पादों (अवतार सेवाओं, पहचान दस्तावेज पाइपलाइन, स्टॉक चेहरा पीढ़ी) के लिए यह TCO पर जीतता है।

दो परिचालन परिणामः

- **No scheduler, no batcher.**लक्ष्य कब्जे पर स्थैतिक बैच इष्टतम है। निरंतर बैचिंग (एलएलएम और प्रसार के लिए आवश्यक) शून्य लाभ प्रदान करता है क्योंकि प्रत्येक अनुरोध में समान एफएलओपी होते हैं।
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`नक्शांकन नेटवर्क की सीमा के एक संकीर्ण शंकु से नमूने। यह नमूना भिन्नता पर सेवा परत का एकमात्र लीवर है। नीचे `ψ`पीक लोड पर, प्रीमियम उपयोगकर्ताओं के लिए इसे बढ़ाएं।

## आगे पढ़ना

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) स्टाइलगान।
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) स्टाइलगेन2
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) स्टाइलगेन3।
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) ई4ई उल्टा।
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) स्टाइलगान-एक्सएल।
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) आधुनिक न्यूनतम जीएएन नुस्खा।
