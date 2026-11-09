# जीएएन  जनरेटर बनाम भेदभावकर्ता

> 2014 में गुडफेलो की चाल घनत्व को पूरी तरह से छोड़ना था। दो नेटवर्क। एक नकली बनाता है। एक उन्हें पकड़ता है। वे तब तक लड़ते हैं जब तक नकली वास्तविक से अलग नहीं होते। यह काम नहीं करना चाहिए। यह अक्सर नहीं करता है। जब यह होता है, तो नमूना अभी भी संकीर्ण डोमेन के लिए साहित्य में सबसे तेज हैं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## समस्या

VAEs धुंधले नमूने बनाते हैं क्योंकि उनके MSE डिकोडर का नुकसान * औसत * छवि के लिए बेयज़-अनुकूल है और कई यथार्थवादी अंकों का औसत एक धुंधला अंक है। आप एक हानि चाहते हैं जो किसी एक लक्ष्य के निकटता को * यथार्थवाद *, न कि पिक्सेल के अनुसार पुरस्कृत करता है। यथार्थवाद के लिए कोई बंद-रूप नहीं है। आपको इसे सीखना होगा।

गुडफेलो का विचारः एक वर्गीकरण प्रशिक्षित करें $D(x)$वास्तविक चित्रों को नकली से अलग करने के लिए। एक जनरेटर को प्रशिक्षित करें।$G(z)$मूर्खता करने के लिए$D$. हानि संकेत के लिए$G$जो भी है$D$वर्तमान में लगता है कि कुछ वास्तविक लग रहा है. यह संकेत अद्यतन के रूप में$G$यदि दोनों नेटवर्क अभिसरण,$G$बिना कभी लिखते हुए डेटा वितरण सीख लिया है `log p(x)`. .

यह एक विरोधी प्रशिक्षण है। गणित एक न्यूनतम खेल हैः

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

2026 में GAN अब SOTA जनरेटर नहीं हैं (विसार और प्रवाह मिलान ने उस मुकुट को खा लिया) लेकिन StyleGAN 2/3 अब तक के सबसे तेज चेहरे के मॉडल बने हुए हैं, GAN भेदभावक का उपयोग विसार प्रशिक्षण में * धारणा हानि * के रूप में किया जाता है, और विरोधी प्रशिक्षण तेजी से 1-चरण डिस्टिलिएशन (SDXL-Turbo, SD3-Turbo, LCM) को सक्षम बनाता है जो आपको वास्तविक समय में विसारण भेजने की अनुमति देता है।

## अवधारणा

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**शोर वेक्टर का नक्शा $z \sim \mathcal{N}(0, I)$एक नमूना पर$\hat{x}$. एक डिकोडर के रूप में नेटवर्क (घन या ट्रांसपोस्टेड कन्वर्ट) ।

**Discriminator $D(x)$.**एक नमूना को स्केलर संभावना (या स्कोर) पर मैप करें। वास्तविक → 1, नकली → 0.

**Loss.**दो बारी-बारी से अद्यतनः

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$. वास्तविक = 1 पर द्विआधारी क्रॉस-एंट्रोपी, नकली = 0 ।
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$. यह गुडफ़ेलो द्वारा इस्तेमाल किया गया * गैर-स saturating * फॉर्म है (मूल $\log(1 - D(G(z)))$संतोष और gradients को मारता है जब $D$आत्मविश्वास है) ।

**Training loop.**एक कदम के लिए $D$, एक कदम के $G$दोहराएँ।

**Why it works.**यदि$G$बिल्कुल मेल खाता है $p_{\text{data}}$, तो $D$भाग्य से बेहतर नहीं कर सकते और हर जगह 0.5 आउटपुट। $G$और अधिक ग्रेडिएंट नहीं मिलता है। संतुलन.

**Why it breaks.**मोड कोलप ($G$एक मोड खोजता है $D$वर्गीकृत नहीं कर सकते हैं और इसे हमेशा के लिए मिंट), गायब ग्रेडिएंट ($D$बहुत जल्दी सीखता है और $\log D$प्रशिक्षण अस्थिरता (शिक्षा दर, बैच आकार, कुछ भी) ।

## जीएएन को काम करने के लिए वेरिएंट

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## इसे बनाओ

`code/main.py`1 डी डेटा पर एक छोटा GAN को प्रशिक्षित करता हैः दो गौसीयन का मिश्रण। जनरेटर और भेदभावकर्ता एकल छिपे हुए परत वाले एमएलपी हैं। हम आगे, पीछे और न्यूनतम लूप को हाथ से लागू करते हैं। लक्ष्य दो प्रमुख विफलता मोड (मोड कोलप + गायब होने वाला ग्रेडिएंट) को देखने के लिए है जैसे वे होते हैं।

### चरण 1: गैर-स saturating हानि

वनिला गुडफेलो की हानि$\log(1 - D(G(z)))$जब D G के लिए नकली को उच्च आत्मविश्वास के साथ नकली के रूप में वर्गीकृत करता है तो 0 तक जाता है। उस बिंदु पर G के लिए ग्रेडिएंट मूल रूप से शून्य है  G में सुधार नहीं हो सकता है। गैर-स saturating रूप $-\log D(G(z))$इसके विपरीत असंबोट हैः यह जब D आत्मविश्वास है जब विस्फोट, G एक मजबूत संकेत देता है।

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### चरण 2: प्रत्येक जनरेटर चरण के लिए एक भेदभावक चरण

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

जी के लिए ताजा नकली, अन्यथा gradients पुराने हो जाते हैं.

### चरण 3: मोड को विफल करने के लिए देखो

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

कैनोनिक लक्षणः दो वास्तविक मोड में से एक उत्पन्न करना बंद कर देता है भेदभावकर्ता इसे सुधारना बंद कर देता है क्योंकि इसे कभी भी नकली नहीं माना जाता है।

## फंदे

- **Discriminator too strong.**डी की सीखने की दर को 2-5 गुना कम करें, या इंस्टेंस/लेयर शोर जोड़ें। यदि डी 95% से अधिक सटीकता तक पहुंचता है, तो जी मृत है।
- **Generator memorizes a mode.**डी इनपुट में शोर जोड़ें, एक मिनी बैच-विभेदक परत का उपयोग करें, या WGAN-GP पर स्विच करें।
- **Batch norm leaking statistics.**वास्तविक बैच + एक ही बीएन परत के माध्यम से बहने वाले नकली बैच अपने आंकड़ों को मिलाते हैं। इसके बजाय इंस्टेंट मानदंड या स्पेक्ट्रल मानदंड का उपयोग करें।
- **Inception-score gaming.**FID और IS कम नमूना गिनती पर शोर करते हैं। eval पर ≥10k नमूने का उपयोग करें।
- **One-shot sampling is a lie for conditional tasks.**आप अभी भी CFG पैमाने की जरूरत है, truncation ट्रिक्स, और पुनः नमूना करने के लिए उपयोग करने योग्य आउटपुट प्राप्त करने के लिए.

## इसका प्रयोग करें

2026 GAN स्टैकः

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

GAN तेज लेकिन संकीर्ण हैं। एक बार जब आपका डोमेन फ़ोटो खोलता है, तो मनमाने पाठ संकेत, वीडियो प्रसार पर स्विच करता है। प्रतिकूल चाल एक घटक (धारणात्मक नुकसान, डिस्टिलशन) के रूप में रहती है, एक स्वतंत्र जनरेटर नहीं।

## इसे भेजें

सहेजें`outputs/skill-gan-debugger.md`. कौशल एक विफल GAN रन (लॉस वक्र, नमूना ग्रिड, डेटासेट आकार) लेता है और संभावित कारणों की एक क्रमबद्ध सूची, एक पंक्ति के सुधार और एक पुनः आरंभ प्रोटोकॉल को आउटपुट करता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`शेयर सेटिंग्स के साथ।`D_LR = 5 * G_LR`G के नुकसान एक स्थिर तक गिरता है?
2. **Medium.**Goodfellow BCE हानि को WGAN हानि से प्रतिस्थापित करें: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$,$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, और क्लिप डी के वजन करने के लिए `[-0.01, 0.01]`क्या प्रशिक्षण अधिक स्थिर है? दीवार घड़ी अभिसरण की तुलना करें।
3. **Hard.**1-डी उदाहरण को 2-डी डेटा (रिंग पर 8 गौसीयन का मिश्रण) तक बढ़ाएं। जनरेटर चरण 1k, 5k, 10k में कितने 8 मोड को कैप्चर करता है, उसका ट्रैक करें। मिनी बैच भेदभाव लागू करें और फिर से मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## उत्पादन नोटः एक शॉट का निष्कर्ष जीएएन का स्थायी लाभ है

जीएएन अब ओपन-डोमेन जनरेशन के लिए नमूना गुणवत्ता पर जीत नहीं लेते हैं, लेकिन वे अभी भी निष्कर्ष लागत पर जीतते हैं। उत्पादन-उत्पादन साहित्य शब्दावली में एक जीएएन में हैः

- **No prefill, no decode stages.**एक एकल $G(z)$आगे की पास. TTFT ≈ कुल विलंबता.
- **No KV-cache pressure.**बैच आकार सक्रियण स्मृति द्वारा सीमित है, कैश नहीं.
- **Trivial continuous batching.**चूंकि प्रत्येक अनुरोध में एक ही फिक्स्ड FLOPs होते हैं, इसलिए सर्वर के लक्ष्य कब्जे पर एक स्थिर बैच आमतौर पर इष्टतम होता है। उड़ान में कोई शेड्यूलर की आवश्यकता नहीं होती है।

यही कारण है कि 2026 में GAN डिस्टिलिशन (SDXL-Turbo, SD3-Turbo, ADD, LCM) तेजी से पाठ-छवि के लिए प्रमुख तकनीक हैः यह एक धीमी जनरेटर को तेज़ जनरेटर में बदलने के लिए एक प्रशिक्षण समय के बटन के रूप में जीवित रहता है।

## आगे पढ़ना

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) मूल GAN पेपर।
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) पहला स्थिर वास्तुकला।
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN।
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) स्टाइलगेन2
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) स्टाइलगेन3।
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) एसडीएक्सएल-टर्बो।
