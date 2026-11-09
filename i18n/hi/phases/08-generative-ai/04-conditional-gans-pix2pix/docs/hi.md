# सशर्त जीएएन और पिक्स्२पिक्स्

> 2014-2017 के पहले बड़े अनलॉक में यह नियंत्रित किया गया था कि एक GAN क्या बनाता है। एक लेबल, या एक छवि, या एक वाक्य संलग्न करें। Pix2Pix ने छवि संस्करण किया और यह अभी भी संकीर्ण छवि-से-छवि कार्यों पर प्रत्येक सामान्य पाठ-से-छवि मॉडल को हराता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## समस्या

एक बिना शर्त GAN संयोग से आकस्मिक चेहरे का नमूना. डेमो के लिए उपयोगी, उत्पादन में बेकार. आप चाहते हैंः *एक स्केच को एक तस्वीर में नक्शा*, *एक हवाई तस्वीर में नक्शा*, *दिन के दृश्य को रात में नक्शा*, *एक ग्रेस्केल छवि को रंग दें। इन सभी में, आपको एक इनपुट छवि दी जाती है।$x$और आउटपुट करना चाहिए $y$कुछ अर्थपूर्ण अनुरूपता के साथ।$y$प्रति $x$. औसत वर्ग त्रुटि उन्हें मश् में फ्लैट करता है. एक विरोधी हार नहीं करता है, क्योंकि "वास्तविक लग रहा है" तेज है.

सशर्त जीएएन (मिर्जा और ओसिंडेरो, 2014) एक शर्त जोड़ता है $c$दोनों के लिए एक इनपुट के रूप में $G$और $D$. Pix2Pix (Isola et al., 2017) ने इस पर विशेषज्ञता दीः स्थिति एक पूर्ण इनपुट छवि है, जनरेटर एक यू-नेट है, भेदभावकर्ता एक * पैच-आधारित* वर्गीकरण (PatchGAN) है, और हानि प्रतिकूल है + L1. यह नुस्खा 2026 में भी संकीर्ण छवि-छवि डोमेन पर स्क्रैच से पाठ-छवि मॉडल से बेहतर प्रदर्शन करता है क्योंकि यह * जोड़े के डेटा* पर प्रशिक्षित है।

## अवधारणा

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$. पिक्स्२पिक्स् में, $z$G के अंदर ड्रॉपआउट है (कोई इनपुट शोर नहीं  Isola पाया स्पष्ट शोर को अनदेखा किया गया है) ।

**Conditional D.** $D(x, y) \to [0, 1]$. इनपुट *पियर* (कंडीशन, आउटपुट) है। यह मुख्य अंतर हैः डी को यह तय करना होगा कि क्या $y$$x$, न केवल कि क्या $y$असली लग रहा है.

**U-Net generator.**बोतल के गले के पार स्पिप कनेक्शन के साथ एन्कोडर-डेकोडर। इनपुट और आउटपुट कम-स्तरीय संरचना (कनाड़, सिल्हूट) साझा करने वाले कार्यों के लिए महत्वपूर्ण। स्पिप्स के बिना, उच्च आवृत्ति विवरण गायब हो जाता है।

**PatchGAN discriminator.**एक एकल वास्तविक/नकली स्कोर के बजाय, डी एक $N \times N$ग्रिड जहां प्रत्येक सेल ~ 70 × 70 पिक्सल के एक रिसेप्टिव क्षेत्र का न्याय करता है। औसत। यह एक मार्कोव यादृच्छिक क्षेत्र परिकल्पना हैः यथार्थवाद स्थानीय है। प्रशिक्षण करने के लिए बहुत तेज, कम मापदंड, तेज आउटपुट।

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

L1 शब्द प्रशिक्षण को स्थिर करता है और G को ज्ञात लक्ष्य की ओर धकेलता है। L1 L2 की तुलना में तेज किनारे देता है (मध्य, नहीं साधन) । $\lambda = 100$यह पूर्वनिर्धारित Pix2Pix था।

## CycleGAN  जब आपके पास जोड़े नहीं हों

Pix2Pix जोड़ी की जरूरत है $(x, y)$डेटा. CycleGAN (Zhu et al., 2017) अतिरिक्त हानि की कीमत पर इस आवश्यकता को कम करता हैः * चक्र स्थिरता हानि। दो जनरेटर $G: X \to Y$और $F: Y \to X$उन्हें प्रशिक्षित करें$F(G(x)) \approx x$और $G(F(y)) \approx y$इससे आप घोड़ों को जबरा में, गर्मियों को सर्दियों में, बिना जोड़े के उदाहरणों के अनुवाद कर सकते हैं।

2026 में, साइकिलगेन के बजाय अपर्जित छवि-टू-इमेज ज्यादातर प्रसार (कंट्रोलनेट, आईपी-एडाप्टर) के माध्यम से किया जाता है, लेकिन चक्र-समरूपता विचार लगभग हर अपर्जित डोमेन अनुकूलन पेपर में जीवित रहता है।

```figure
gx-patchgan
```

## इसे बनाओ

`code/main.py`1 डी डेटा पर एक छोटी सी सशर्त GAN लागू करता है।$c$एक वर्ग लेबल (0 या 1) है। कार्यः दिए गए वर्ग के लिए सशर्त वितरण से एक नमूना तैयार करना।

### चरण 1: G और D इनपुट दोनों को स्थिति जोड़ें

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

एक-हॉट एन्कोडिंग सबसे सरल तरीका है। बड़े मॉडल सीख गए एम्बेडिंग, FiLM मॉड्यूलेशन या क्रॉस-एटेंशन का उपयोग करते हैं।

### चरण 2: ट्रेन सशर्त

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

जनरेटर को दिए गए स्थिति के लिए वास्तविक वितरण * से मेल खाना चाहिए*, मार्जिनल से नहीं।

### चरण 3: प्रति वर्ग आउटपुट की जांच करें

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## फंदे

- **Condition ignored.**G को हाशिए पर रखना सीखता है, D को कभी दंडित नहीं करना पड़ता क्योंकि स्थिति संकेत कमजोर है। फिक्सः स्थिति D को अधिक आक्रामक रूप से (शुरुआती परत, न कि केवल देर से), प्रोजेक्शन भेदभाव का उपयोग करें (Miyato & Koyama 2018) ।
- **L1 weight too low.**जी संयोग से वास्तविक रूप से दिखने वाले आउटपुट पर बहती है, निष्ठा से नहीं।$\lambda \approx 100$Pix2Pix शैली के कार्यों के लिए।
- **L1 weight too high.**G धुंधली आउटपुट का उत्पादन करता है क्योंकि L1 अभी भी एक $L_p$प्रशिक्षण स्थिर होने के बाद एनेल नीचे।
- **Ground-truth leakage in D.**कंकेटेनेट $(x, y)$D इनपुट के रूप में, न केवल $y$. इसके बिना डी को स्थिरता की जांच नहीं कर सकते.
- **Mode collapse per class.**प्रत्येक वर्ग स्वतंत्र रूप से गिर सकता है। वर्ग-सर्त विविधता जांच चलाएं।

## इसका प्रयोग करें

2026 छवि-से-छवि कार्यों की स्थितिः

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix सही उपकरण बना रहता है जब (ए) आपके पास हजारों जोड़े हुए उदाहरण हैं, (बी) कार्य संकीर्ण और दोहराया जा सकता है, और (सी) आपको त्वरित निष्कर्ष की आवश्यकता है। सामान्य ओपन-डोमेन कार्यों पर, विसारण जीतता है।

## इसे भेजें

सहेजें`outputs/skill-img2img-chooser.md`. कौशल कार्य विवरण, डेटा उपलब्धता (जोड़ी बनाम अनजोड़ी, N नमूने) और विलंबता/गुणवत्ता बजट लेता है, फिर आउटपुटः दृष्टिकोण (Pix2Pix, CycleGAN, ControlNet संस्करण, SDXL + IP-Adapter), प्रशिक्षण डेटा आवश्यकताएं, निष्कर्ष लागत, और मूल्यांकन प्रोटोकॉल (LPIPS, FID, कार्य-विशिष्ट) ।

## व्यायाम

1. **Easy.**संशोधित करें`code/main.py`पुष्टि G अभी भी प्रत्येक वर्ग की ध्वनि को सही मोड में मैप करता है।
2. **Medium.**1-डी सेटिंग में L1 को एक धारणा-शैली के नुकसान से बदलें (उदाहरण के लिए एक छोटा जमे हुए D जो सुविधा निकालने के रूप में कार्य करता है) क्या यह सशर्त वितरण की तीक्ष्णता को बदलता है?
3. **Hard.**1-डी सेटिंग में एक CycleGAN स्केच करेंः दो वितरण, दो जनरेटर, चक्र हानि। दिखाएं कि यह बिना जोड़े के डेटा के बीच नक्शा बनाना सीखता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## उत्पादन नोटः विलंबता-सीमित आधार रेखा के रूप में Pix2Pix

जब आप डेटा और एक संकीर्ण कार्य (स्केच → रेंडर, अर्थपूर्ण नक्शा → फोटो, दिन → रात) को जोड़ते हैं, तो Pix2Pix का एक शॉट निष्कर्ष विलंबता पर परिमाण के क्रम से प्रसार को हराता है। उत्पादन तुलना आमतौर पर हैः

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix स्थैतिक बैच में आउटपुट पर जीतता है (हर अनुरोध एक ही FLOPs है) । गुणवत्ता और सामान्यीकरण पर विसारण जीतता है। आधुनिक खेल अक्सर संकीर्ण कार्य के लिए Pix2Pix शैली का डिस्टिल्ड मॉडल और पूंछ इनपुट के लिए विसारण बैकअप भेजने के लिए होता है।

## आगे पढ़ना

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) सीजीएएन पेपर।
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) पिक्स्२पिक्स्।
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) साइकिलगान।
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) पिक्सेल 2 पिक्सेल एचडी।
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) SPADE / गोगान।
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) प्रक्षेपण D.
