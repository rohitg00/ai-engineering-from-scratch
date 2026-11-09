# ऑटोकोडर और वैरिएशनल ऑटोकोडर (VAE)

> एक साधारण ऑटोकोडर संपीड़ित करता है और फिर पुनर्निर्माण करता है। यह याद करता है। यह उत्पन्न नहीं करता है। एक चाल जोड़ें  कोड को गौशियन दिखने के लिए मजबूर करें  और आपको एक नमूना प्राप्त होता है। यह एकल चाल, पुनरावर्तन $z = \mu + \sigma \cdot \epsilon$, यही कारण है कि हर लटेंट-विभाजन और प्रवाह-मिलान छवि मॉडल आप 2026 में उपयोग करते हैं में एक VAE है इनपुट पर.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## समस्या

784 पिक्सेल के MNIST अंक को 16 अंकों के कोड में संपीड़ित करें, फिर इसे पुनर्निर्माण करें। एक साधारण ऑटोएन्कोडर MSE पुनर्निर्माण को बढ़ावा देगा लेकिन कोड स्थान एक गुच्छा है। कोड स्थान में एक यादृच्छिक बिंदु चुनें, इसे डिकोड करें, और आपको शोर मिलता है। इसमें कोई नमूना नहीं है। यह एक संपीड़न मॉडल है जो तैयार है।

आप वास्तव में क्या चाहते हैंः (ए) कोड अंतरिक्ष एक साफ, चिकनी वितरण है आप नमूना कर सकते हैं  एक आइसोट्रोपिक गौशियन कहते हैं $\mathcal{N}(0, I)$, (ख) किसी भी नमूना को डिकोड करने से एक विश्वसनीय अंक उत्पन्न होता है, और (ग) एन्कोडर और डिकोडर अभी भी अच्छी तरह से संपीड़ित होते हैं। तीन लक्ष्य, एक वास्तुकला, एक हानि।

किंगमा के 2013 VAE को एक * वितरण* के उत्पादन के लिए एन्कोडर को प्रशिक्षित करके यह हल करता है।$q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$, पूर्व की ओर उस वितरण खींच $\mathcal{N}(0, I)$एक KL जुर्माना के माध्यम से, और फिर नमूना लेने के $z$से$q(z \mid x)$जब आप अनुमान लगाते हैं, तो एन्कोडर छोड़ दें, नमूना $z \sim \mathcal{N}(0, I)$KL दंड है जो कोड अंतरिक्ष को संरचित करने के लिए मजबूर करता है।

2026 में VAE शायद ही कभी स्टैंडअलोन जहाज करते हैं  उन्हें कच्चे छवि गुणवत्ता के लिए विसारण द्वारा बेहतर माना गया है  लेकिन वे हर लटेंट-विसारण मॉडल (SD 1/2/XL/3, फ्लक्स, ऑडियोक्राफ्ट) के लिए पसंद का एन्कोडर हैं। VAE को जानें और आप प्रत्येक छवि पाइपलाइन की अदृश्य पहली परत सीखते हैं जिसका आप उपयोग करते हैं।

## अवधारणा

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$,$\hat{x} = \text{decoder}(z)$, हानि = $\lVert x - \hat{x} \rVert^2$कोड स्थान असंगठित है।

**VAE encoder.**दो वेक्टरों के आउटपुटः $\mu(x)$और $\log \sigma^2(x)$. ये परिभाषित करते हैं .$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$. .

**Reparameterization trick.** से नमूना$q(z \mid x)$नमुना को पुनः लिखें$z = \mu + \sigma \cdot \epsilon$कहाँ$\epsilon \sim \mathcal{N}(0, I)$. अब .$z$ का एक निर्धारक कार्य है$(\mu, \sigma)$और एक गैर-परिमाणीकरण शोर  gradients के माध्यम से प्रवाह `μ`और $\sigma$. .

**Loss.**साक्ष्य निचला बंधन (ELBO), दो शर्तेंः

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

पुनर्निर्माण धक्का देता है $\hat{x}$दिशा में$x$. KL धक्का देता है .$q(z \mid x)$वे पूर्व के लिए. वे आदान-प्रदान. छोटे.$\beta$($<1$) = तेज नमूने, कोड स्थान कम गौशियन। बड़ा $\beta$($>1$) = स्वच्छ कोड स्थान, धुंधला नमूने। β-VAE (हिगन्स 2017) ने इस बटन को प्रसिद्ध किया और डिस्टैगमेंट अनुसंधान शुरू किया।

**Sampling.**निष्कर्ष परः खींचें $z \sim \mathcal{N}(0, I)$एक आगे पास  कोई पुनरावर्ती नमूनाकरण के रूप में विसारण नहीं.

```figure
vae-latent-grid
```

## इसे बनाओ

`code/main.py`इनपुट 8-डी में 2-कम्पोनेन्ट गौसी मिश्रण से प्राप्त 8-आयामी सिंथेटिक डेटा है। एन्कोडर और डिकोडर एकल छिपी-परत एमएलपी हैं। हम टैन सक्रियण, आगे पास, हानि और हाथ से लिखित पीछे पास लागू करते हैं। उत्पादन नहीं  शिक्षा।

### चरण 1: आगे एन्कोडर

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$इसके बजाय $\sigma$तो नेटवर्क आउटपुट निर्बंधित है (softplus के σ एक जाल है  gradients पर मर जाते हैं $\sigma \approx 0$) ।

### चरण 2: पुनः परिमाण और डिकोड

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### चरण 3: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

सही बंद-रूप KL क्योंकि दोनों वितरण Gaussian हैं. संख्यात्मक रूप से एकीकृत नहीं करते. लोग अभी भी 2026 में मोन्टे-कार्लो KL अनुमान के साथ कोड भेजते हैं  यह बिना किसी कारण के 3x धीमा है।

### चरण 4: उत्पन्न करें

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

यह जनरेटिव मॉडल है. पांच पंक्तियाँ.

## फंदे

- **Posterior collapse.**केएल टर्म ड्राइव $q(z \mid x) \to \mathcal{N}(0, I)$इतना आक्रामक रूप से कि $z$के बारे में कोई जानकारी नहीं है $x$. फिक्सः β-अनिल (स्टार्ट $\beta=0$, रैंप से 1), मुक्त बिट्स, या निष्क्रिय आयामों पर KL छोड़ दें।
- **Blurry samples.**गौशियन डिकोडर संभावना एमएसई पुनर्निर्माण को इंगित करती है, जो कि L2 (मध्यम) के लिए बेयज़-अनुकूल है।
- **β too large, too early.**पछाड़ गिरावट देखें.$\beta \approx 0.01$और रैंप।
- **Latent dim too small.**16-डी एमएनआईएसटी के लिए काम करता है, 256-डी इमेजनेट 2562, 2048-डी इमेजनेट 10242 के लिए। स्थिर विसारण का VAE 512 × 512 × 3 → 64 × 64 × 4 (8x डाउनसैम्पल प्रति पक्ष, 64x अंतरिक्ष क्षेत्र में; चैनल 3 से 4 तक जाते हैं, इसलिए कुल मिलाकर लगभग 48x कम मान हैं) ।

## इसका प्रयोग करें

2026 VAE स्टैकः

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

एक लटेंट-प्रसारण मॉडल एक वीएई है जिसमें एन्कोडर और डिकोडर के बीच रहने वाला एक विसारण मॉडल है। वीएई मोटा संपीड़न करता है, विसारण मॉडल भारी भार उठाने का काम करता है। वीडियो (वीएई + वीडियो-प्रसारण डीटी) और ऑडियो (एन्कोडेक + म्यूजिकजेन ट्रांसफार्मर) के लिए एक ही पैटर्न।

## इसे भेजें

सहेजें`outputs/skill-vae-trainer.md`. .

कौशल लेता हैः डेटासेट प्रोफ़ाइल + लातेंट-डिम लक्ष्य + डाउनस्ट्रीम उपयोग (पुनर्निर्माण, नमूनाकरण या लातेंट-विसारण इनपुट) और आउटपुटः वास्तुकला विकल्प (सादा / β / VQ / RVQ), β अनुसूची, लातेंट-डिम, डिकोडर संभावना (गॉसियन बनाम कैटेगरी), और मूल्यांकन योजना (अनुमानित MSE, KL प्रति डिम, Fréchet दूरी के बीच $q(z \mid x)$और $\mathcal{N}(0, I))$. .

## व्यायाम

1. **Easy.**परिवर्तन$\beta$में `code/main.py``0.01`,`0.1`,`1.0`,`5.0`. अंतिम पुनर्निर्माण MSE और KL रिकॉर्ड करें.$\beta$क्या आपके सिंथेटिक डेटा के लिए पैरेटो सबसे अच्छा है?
2. **Medium.**गौसीयन डिकोडर की संभावना को बर्नौली की संभावना (क्रॉस-एंट्रोपी हानि) से बदलें। समान सिंथेटिक डेटा के द्विआधारीकृत संस्करण पर नमूना गुणवत्ता की तुलना करें।
3. **Hard.**विस्तार `code/main.py`एक मिनी VQ-VAE मेंः निरंतर $z$K=32 प्रविष्टियों की एक कोडबुक में निकटतम पड़ोसी की खोज के साथ। पुनर्निर्माण MSE की तुलना करें और रिपोर्ट करें कि कोडबुक प्रविष्टियों का उपयोग कितना किया जाता है (कोडबुक कोलप वास्तविक है) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \ge \text{recon} - \mathrm{KL}[q(z \mid x) \Vert p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $\mathcal{N}(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher $\beta$ = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## उत्पादन नोटः विसारण सर्वर में VAE सबसे गर्म पथ है

एक स्थिर विसारण / प्रवाह / एसडी 3 पाइपलाइन में, वीएई को अनुरोध पर दो बार बुलाया जाता है  एक बार एन्कोडिंग के लिए (यदि img2img / inpainting कर रहा है) और एक बार डिकोडिंग के लिए। 10242 पर डिकोडर पास अक्सर पूरे पाइपलाइन में एकल सबसे बड़ी सक्रियण-मेमोरी पीक होती है क्योंकि यह अपसेंप करता है `128×128×16`लटकों को वापस करने के लिए `1024×1024×3`. दो व्यावहारिक परिणाम:

- **Slice or tile the decode.** `diffusers`उजागर करता है`pipe.vae.enable_slicing()`और `pipe.vae.enable_tiling()`. टाइलिंग एक छोटे से सीम कलाकृतियों के लिए व्यापार करता है$O(\text{tile}^2)$स्मृति के बजाय $O(H \cdot W)$उपभोक्ता जीपीयू पर 10242+ के लिए आवश्यक।
- **bf16 decoder, fp32 numerics for the final resize.**SD 1.x VAE fp32 में जारी किया गया था और 10242+ एसडीएक्सएल जहाजों पर fp16 पर फंसते समय * चुपचाप NaNs* का उत्पादन करता है।`madebyollin/sdxl-vae-fp16-fix` हमेशा fp16-fix वैरिएंट को पसंद करें या bf16 का उपयोग करें।

## आगे पढ़ना

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) वीएई पेपर।
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) विघटित β-VAE।
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE।
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) अत्याधुनिक छवि VAE।
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) स्थिर विसारण; VAE को एन्कोडर के रूप में।
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec, ऑडियो VAE मानक।
