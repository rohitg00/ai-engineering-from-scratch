# जनरेटिव मॉडल  टैक्सोनामी और इतिहास

> प्रत्येक छवि मॉडल, पाठ मॉडल, वीडियो मॉडल और 3 डी मॉडल पांच बाल्टियों में से एक में फिट बैठता है। गलत बाल्ट चुनें और आप हफ्तों तक गणित से लड़ेंगे। सही एक चुनें और क्षेत्र के पिछले बारह वर्षों की प्रगति आपके सिर में साफ-सुथरा ढेर हो जाएगा।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## समस्या

एक जनरेटिव मॉडल एक काम करता हैः किसी अज्ञात वितरण से लिए गए प्रशिक्षण नमूने $p_{\text{data}}(x)$चेहरे, वाक्य, मिडी फ़ाइलें, प्रोटीन संरचना  सभी एक ही समस्या है यदि आप आँखें बंद.

मसाला यह है कि $p_{\text{data}}$एक 512x512 RGB छवि ~ 786k आयामों है), नमूने उस अंतरिक्ष के अंदर एक पतले मल्टीफ़ोल्ड पर बैठे हैं, और आपके पास केवल 10M उदाहरण हैं। घनत्व को क्रूर रूप से मजबूर करना निराशाजनक है। प्रत्येक जनरेटिव मॉडल एक समझौता है जो एक कठिन समस्या को थोड़ा कम कठिन के लिए बदल देता है।

पिछले बारह वर्षों में पांच परिवार जीवित रहे हैं। यह जानकर कि प्रत्येक परिवार किस तरह का समझौता करता है, आपको पता चलता है कि यह कुछ कार्यों पर क्यों जीतता है और दूसरों पर क्यों गिरता है।

## अवधारणा

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**लिखें $\log p(x)$एक वास्तविक आंकड़ा के रूप में आप वास्तव में मूल्यांकन कर सकते हैं। autoregressive मॉडल (PixelCNN, WaveNet, GPT) कारक$p(x) = \prod_i p(x_i \mid x_{<i})$. सामान्य प्रवाह (रियलएनवीपी, चमक) निर्माण $p(x)$एक साधारण आधार के एक पलटाव योग्य परिवर्तन के रूप में। प्रोः सटीक संभावना, साफ प्रशिक्षण हानि। कॉनः ऑटोरेग्रेसिव इन्फेरेंस अनुक्रमिक है (लंबे अनुक्रमों के लिए धीमा), प्रवाह को पलटाव योग्य वास्तुकला की आवश्यकता है (आर्किटेक्चरल रूप से प्रतिबंधात्मक) ।

**2. Explicit density, approximate.**बंधा हुआ$\log p(x)$एवीई (किंगमा 2013) एक एसीओडर-डेकोडर का उपयोग करते हैं जिसमें एक वैरिएशनल पछाड़ होता है। विसारण मॉडल (डीडीपीएम, हो 2020) एक डीनोइज़र को प्रशिक्षित करते हैं जो संवेदी रूप से एक भारित एएलबीओ को अनुकूलित करता है। विसारण 2026 में प्रमुख छवि, वीडियो और 3 डी रीढ़ की हड्डी है।

**3. Implicit density.**घनत्व पूरी तरह से छोड़; एक जनरेटर सीखें $G(z)$जो नमूने और भेदभाव का उत्पादन करता है $D(x)$जीएएन (गुडफेलो 2014). अनुमान लगाने में तेज़ (एक आगे पास) लेकिन प्रशिक्षण के दौरान कुख्यात रूप से अस्थिर। स्टाइलजीएएन 1/2/3 2026 में भी फिक्स्ड-डोमेन फोटोरियलिज्म (चाहे, बेडरूम) के लिए अत्याधुनिक है।

**4. Score-based / continuous-time.**लकड़ी घनत्व की ग्रेडिएंट जानें $\nabla_x \log p(x)$(स्कोर) सीधे। Song & Ermon (2019) ने दिखाया स्कोर मिलान एक SDE में विसारण को सामान्य बनाता है। प्रवाह मिलान (लिपमैन 2023) 2024-2026 की गर्मजोशी हैः सिमुलेशन-मुक्त प्रशिक्षण, सीधे पथ, डीडीपीएम की तुलना में 4-10 गुना तेज़ नमूनाकरण। स्थिर विसारण 3, प्रवाह, ऑडियोक्राफ्ट 2 सभी प्रवाह मिलान का उपयोग करते हैं।

**5. Token-based autoregressive over discrete codes.**VQ-VAE या अवशिष्ट क्वांटायर के साथ उच्च-डिम डेटा को एक छोटे से डिस्क्रिट टोकन अनुक्रम में संपीड़ित करें, फिर टोकन अनुक्रम को मॉडल करने के लिए एक ट्रांसफार्मर का उपयोग करें। पार्टि, म्यूज़नेट, ऑडियोएलएम, वाल-ई, सोरा के पैच टोकनराइज़र सभी इसका उपयोग करते हैं। यह बाल्टी 1 प्लस एक सीखा टोकनराइज़र है।

## संक्षिप्त इतिहास

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## पांच प्रश्नों का वर्गीकरण

जब कोई नया जनरेटिव मॉडल पेपर गिर जाता है, तो विधि अनुभाग पढ़ने से पहले इन पांच सवालों के जवाब दें।

1. **What is being modeled?**पिक्सेल, लातेंट, डिस्क्रिट टोकन, 3 डी गौसीयन, जाल, तरंगों के रूप?
2. **Is the density explicit or implicit?**क्या वे लिखते हैं $\log p(x)$?
3. **Sampling: one-shot or iterative?**पुनरावृत्ति का अर्थ है धीमा निष्कर्ष; एक शॉट का अर्थ आमतौर पर प्रतिकूल या डिस्टिल होता है।
4. **Conditioning: unconditional, class, text, image, pose?**इससे नुकसान और वास्तुकला के ढांचे का निर्धारण होता है।
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**प्रत्येक में असफलता के तरीके ज्ञात हैं (पाठ 14 देखें) ।

इस चरण में आप इन पांचों को हर पाठ के लिए फिर से जवाब देंगे। अंत तक, वे प्रतिबिंब होंगे।

```figure
autoencoder-bottleneck
```

## इसे बनाओ

इस पाठ के लिए कोड एक हल्के दृश्य है: तीन खिलौना दृष्टिकोणों (कर्नेल घनत्व, विवश हिस्टोग्राम, और निकटतम नमूना "GAN-ish" जनरेटर) का उपयोग करके नमूनों से 1-डी गॉसियन मिश्रण को फिट करें ताकि आप एक स्क्रीन पर प्रिंट कर सकें।

दौड़ें`code/main.py`यह दो मोड वाले गौसी मिश्रण से 2000 नमूने निकालता है, फिर प्रिंट करता हैः

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

ध्यान देंः पहले दो आपको यह पूछने देते हैं कि "यह बिंदु कितना संभव है?" तीसरा नहीं कर सकता। यह *स्पष्ट बनाम अप्रत्यक्ष* अंतर है जो भविष्य के प्रत्येक पाठ के लिए मायने रखता है।

## इसका प्रयोग करें

किस परिवार, किस कार्य के लिए, 2026 में?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## इसे भेजें

`outputs/skill-model-chooser.md`. .

कौशल में एक कार्य विवरण और आउटपुट शामिल हैंः (1) किस परिवार का उपयोग करना है, (2) तीन खुले और तीन होस्ट किए गए विकल्पों की एक क्रमबद्ध सूची, (3) संभावित विफलता मोड जिसे आपको देखना चाहिए, और (4) एक गणना / समय बजट।

## व्यायाम

1. **Easy.**इन पांच उत्पादों में से प्रत्येक के लिए, परिवार और रीढ़ की हड्डी की पहचान करेंः चैटजीपीटी छवि, मिडजॉर्नी v7, सोरा, रनवे जेन-3, इलेवनलैब्स। सबूत सार्वजनिक तकनीकी रिपोर्टों से होना चाहिए।
2. **Medium.**कल आप जो पेपर पढ़ रहे हैं, उसमें फैलाव से 100 गुना तेज नमूना लेने का दावा किया गया है। यह जांचने के लिए तीन प्रश्न लिखिए कि क्या स्पीडअप कंडीशनिंग और उच्च रिज़ॉल्यूशन से बचता है।
3. **Hard.**एक डोमेन लें जो आपको रुचि रखता है (जैसे प्रोटीन संरचना, सीएडी, अणु, पटरियां) उस डोमेन में वर्तमान SOTA मॉडल के लिए पांच-सवाल का triage उत्तर दें और स्केच करें कि एक बेहतर मॉडल क्या बदल सकता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## उत्पादन नोटः पांच परिवार, पांच निष्कर्ष आकार

प्रत्येक परिवार एक अलग अनुमान-सेवर लागत वक्र के लिए नक्शे बनाता है। उत्पादन-उत्पाद साहित्य LLM अनुमान को प्रीफिल + डिकोड के रूप में ढांचे; यहां एक ही विघटन लागू होता हैः

- **Autoregressive (bucket 1 and 5).**अनुक्रमिक डिकोडिंग में विलंबता पर हावी होती है; KV-कैश, निरंतर बैचिंग और अनुमानित डिकोडिंग सभी सीधे लागू होते हैं।
- **VAE / diffusion / flow-matching (buckets 2 and 4).**LLM के अर्थ में कोई डिकोड नहीं है।`num_steps × step_cost`, और `step_cost`उत्पादन बटन चरण गणना (डीडीआईएम / डीपीएम-सोल्वर / डिस्टिलिशन), बैच आकार और सटीकता (बीएफ 16 / एफपी 8 / इंट 4) हैं।
- **GAN (bucket 3).**एक आगे पास, कोई कार्यक्रम, कोई KV कैश नहीं TTFT ≈ कुल विलंबता. यही कारण है कि StyleGAN अभी भी संकीर्ण डोमेन UX पर जीतता है.

जब आप एक पेपर सार में "प्रसार से तेज" देखें, तो इसे "कम कदम × समान कदम लागत" या "समान कदम × सस्ता कदम लागत" में अनुवाद करें। बाकी सब विपणन है।

## आगे पढ़ना

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) GAN पेपर।
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) वीएई पेपर।
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) डीडीपीएम पेपर।
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) एसडीई के रूप में विसारण।
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) प्रवाह संगत कागज।
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) स्थिर विसारण 3.
