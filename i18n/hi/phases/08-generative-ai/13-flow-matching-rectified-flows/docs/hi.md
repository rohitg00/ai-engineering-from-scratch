# प्रवाह मिलान और सुधारित प्रवाह

> फैलाव मॉडल 20-50 नमूना लेने के चरणों का उपयोग करते हैं क्योंकि वे शोर से डेटा तक एक घुमावदार पथ पर चलते हैं। प्रवाह मिलान (लिपमैन और सहयोगियों, 2023) और सुधारित प्रवाह (लिउ और सहयोगियों, 2022) ने सीधे पथों को प्रशिक्षित किया है। सीधे पथों का मतलब है कि कम कदम तेजी से निष्कर्ष का मतलब है। स्थिर फैलाव 3, फ्लक्स.1, और ऑडियोक्राफ्ट 2 सभी ने 2024 में प्रवाह मिलान पर स्विच किया।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## समस्या

डीडीपीएम की रिवर्स प्रक्रिया एक 1000 कदम स्टोकास्टिक पैदल दूरी पर है $\mathcal{N}(0, I)$डेटा वितरण पर वापस. DDIM इसे 20-50 निर्धारक चरणों में गिरा दिया. आप कम चरणों  आदर्श रूप से एक चाहते हैं. ब्लॉकर यह है कि ODE उलटा प्रक्रिया को हल करने के लिए कठोर है; पथ घुमाया है.

यदि आप इस मॉडल को प्रशिक्षित कर सकते हैं कि शोर से डेटा तक का रास्ता एक *सही रेखा* था, एक एकल Euler कदम से $t=1$$t=0$प्रवाह मिलान यह सीधे बनाता हैः एक सीधी रेखा इंटरपोलेशन को परिभाषित करें$x_1 \sim \mathcal{N}(0, I)$$x_0 \sim \text{data}$, वेक्टर क्षेत्र को प्रशिक्षित करें $v_\theta(x, t)$समय व्युत्पन्न से मेल खाने के लिए, निष्कर्ष पर एकीकृत करें।

सुधारित प्रवाह (Liu 2022) आगे बढ़ता हैः पुनरावर्ती प्रक्रिया के साथ पथों को पुनरावर्ती रूप से सीधा करें जो एक प्रगतिशील रूप से अधिक रैखिक ओडीई का उत्पादन करता है। दो पुनरावर्ती पुनरावर्ती के बाद, एक 2-चरण नमूना 50 चरण डीडीपीएम गुणवत्ता से मेल खाता है।

## अवधारणा

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### सीधा प्रवाह

परिभाषित करेंः

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

कहाँ$x_0 \sim \text{data}$और $x_1 \sim \mathcal{N}(0, I)$इस सीधी रेखा के साथ समय व्युत्पन्न निरंतर हैः

```math
\frac{dx_t}{dt} = x_1 - x_0
```

एक तंत्रिका वेक्टर क्षेत्र को परिभाषित करें $v_\theta(x_t, t)$और इसे इस व्युत्पन्न से मेल खाने के लिए प्रशिक्षित करेंः

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

यह है **conditional flow matching**प्रशिक्षण सिमुलेशन मुक्त हैः आप कभी भी ODE को अनरोल नहीं करते हैं। बस नमूना $(x_0, x_1, t)$और पीछे हटने के लिए।

### नमूनाकरण

निष्कर्ष पर, समय में * पीछे* से सीखे गए वेक्टर क्षेत्र को एकीकृत करेंः

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

$x_1 \sim \mathcal{N}(0, I)$, Euler-चरण नीचे करने के लिए $t=0$. .

### सुधारित प्रवाह (Liu 2022)

सीधी रेखा प्रवाह काम करता है लेकिन सीखे रास्ते * वास्तव में सीधी नहीं हैं * वे वक्र क्योंकि कई $x_0$एक ही पर नक्शा कर सकते हैं$x_1$. सुधारित प्रवाह का पुनः प्रवाह चरणः

1. रेल प्रवाह मॉडल $v_1$यादृच्छिक जोड़े के साथ।
2. नमूना N जोड़े $(x_1, x_0)$एकीकृत करके $v_1$से$x_1$उसके उतरने तक $x_0$. .
3. ट्रेन $v_2$क्योंकि जोड़े अब "ODE-पहचाने" हैं, उनके बीच सीधा रेखा इंटरपोलेंट वास्तव में सपाट है.
4. दोहराएँ।

अभ्यास में 2 रिफ्लो पुनरावृत्ति आपको लगभग रैखिक तक ले जाती है, जिससे 2-4 चरणों में निष्कर्ष निकाला जा सकता है। SDXL-Turbo, SD3-Turbo, LCM सभी प्रवाह-अनुरूपता मॉडल से डिस्टिल किए गए हैं।

### क्यों यह 2024 में छवियों के लिए जीता

तीन कारण:

1. **Simulation-free training** प्रशिक्षण के दौरान कोई ओडीई नहीं चल रहा है, इसे लागू करने के लिए तुच्छ है।
2. **Better loss geometry** सीधे मार्गों में सिग्नल-टू-शोर सुसंगत होता है, जबकि डीडीपीएम ε-लॉस में समय सारिणी के किनारों पर खराब एसएनआर होता है।
3. **Faster inference** SDXL-Turbo गुणवत्ता पर 4-8 कदम; स्थिरता के साथ 1 कदम।

## प्रवाह मिलान बनाम डीडीपीएम  सटीक कनेक्शन

एक गाउसियन-सशर्त पथ के साथ प्रवाह मिलान विसारण है *एक विशिष्ट शोर कार्यक्रम के साथ।$x_t = \alpha(t) x_0 + \sigma(t) x_1$समय और प्रवाह के मिलान को पुनः प्राप्त Stratonovich-संशोधित विसारण के साथ $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$दोनों बीजगणित के लिए समान हैं Gaussian पथ.

जो प्रवाह मिलान ने जोड़ाः लक्ष्य की * स्पष्टता* (एक सादे वेग), एक स्वच्छ हानि, और गैर-गॉसियन इंटरपोलांट के साथ प्रयोग करने की अनुमति।

```figure
normalizing-flow
```

## इसे बनाओ

`code/main.py`दो मोड गाउसियन मिश्रण पर 1-डी प्रवाह मिलान लागू करता है।$v_\theta(x, t)$एक छोटा MLP सीधा लक्ष्य के साथ प्रशिक्षित है। निष्कर्ष पर, 1, 2, 4 और 20 Euler कदम को एकीकृत करें और नमूना गुणवत्ता की तुलना करें।

### चरण 1: प्रशिक्षण हानि

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### चरण 2: बहु-चरण निष्कर्ष

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### चरण 3: चरण संख्याओं की तुलना करें

4 चरणों के नमूने की गुणवत्ता के साथ पहले से ही मेल खाने की उम्मीद करें 20 चरणों  विलंबता के लिए एक बड़ी बात है।

## फंदे

- **Time parameterization.**प्रवाह मिलान उपयोग $t \in [0, 1]$के साथ$t=0$डेटा पर, $t=1$DDPM का उपयोग करता है$t \in [0, T]$के साथ$t=0$डेटा पर, $t=T$एक ही दिशा में, अलग पैमाने पर. कागज यह लगातार गलत हो जाता है.
- **Schedule choice.**सुधारित प्रवाह की सीधी रेखा "प्रवाह-अनुरूपता" अनुसूची है, लेकिन आप बेहतर पैमाने पर कवरेज के लिए कॉसिन या लॉजिट-सामान्य टी-सैम्प्लिंग (एसडी 3 ऐसा करता है) का उपयोग कर सकते हैं।
- **Reflow cost.**रिफ्लो के लिए जोड़े गए डेटासेट को उत्पन्न करना प्रति नमूना एक पूर्ण निष्कर्ष पास है। केवल जब आपको वास्तव में 1-2 चरणों का निष्कर्ष चाहिए।
- **Classifier-free guidance still applies.**बस आदान-प्रदान $\epsilon$के लिए$v$रैखिक संयोजन मेंः $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$. .

## इसका प्रयोग करें

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

जब भी एक पेपर में 2025-2026 में "विसार से तेज" कहा जाता है, तो यह लगभग हमेशा प्रवाह मिलान + डिस्टिलैशन होता है।

## इसे भेजें

सहेजें`outputs/skill-fm-tuner.md`. कौशल एक फैलाव शैली मॉडल विनिर्देश लेता है और इसे एक प्रवाह-अनुरूप प्रशिक्षण विन्यास में परिवर्तित करता हैः समय अनुसूची का चयन, समय नमूने वितरण (समान / लॉजिट-सामान्य), अनुकूलक, रिफ्लो योजना, लक्ष्य चरण गणना, मूल्यांकन प्रोटोकॉल।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`और तुलना करें 1-चरण बनाम 20-चरण MSE बनाम वास्तविक डेटा वितरण.
2. **Medium.**वर्दी से स्विच $t$नमूनाकरण को लॉजिट-नॉर्मल (मध्य-टी में नमूनाकरण केंद्रित) में ले जाया जाता है। क्या मॉडल की गुणवत्ता में सुधार होता है?
3. **Hard.**एक पुनरावृत्ति पुनरावृत्ति लागू करेंः जोड़ी उत्पन्न $(x_0, x_1)$पहले मॉडल को एकीकृत करके, जोड़े पर दूसरे मॉडल को प्रशिक्षित करें, और 1-चरण नमूना गुणवत्ता की तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## उत्पादन नोटः Flux.1-schnell अपने सबसे तेजी से प्रवाह मिलान है

फ्लो मिलान की उत्पादन जीत Flux.1-schnell  एक प्रवाह-मिलान DiT है जो फ्लोस-डेव-ग्रेड की गुणवत्ता बनाए रखते हुए 1-4 निष्कर्ष चरणों तक डिस्टिल किया गया है। नील्स की "रन फ्लोस 8GB मशीन पर" नोटबुक संदर्भ तैनाती नुस्खा हैः T5 + CLIP कोड, क्वांटिज़्ड MMDiT डीनोइस (वेव के लिए 4 चरणों में त्वरित बनाम 50 के लिए), VAE डिकोड। लागत लेखांकनः

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

उत्पादन नियम: **flow-matched base + distillation = the 2026 default for fast text-to-image.**प्रत्येक प्रमुख आपूर्तिकर्ता इस संयोजन को भेजता हैः SD3-Turbo (SD3 + प्रवाह + डिस्टिलिशन), फ्लक्स-शनेल (फ्लक्स-डेव + सुधारित-प्रवाह सीधा), CogView-4-फ्लैश। शुद्ध विसारण आधार केवल विरासत चेकपोइंट के लिए मौजूद हैं।

## आगे पढ़ना

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) सुधारित प्रवाह।
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) प्रवाह मिलान।
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, पैमाने पर सुधारित प्रवाह।
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) एफएम + प्रसार को कवर करने वाला सामान्य ढांचा।
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) विसारण/प्रवाह का 1-चरण का डिस्टिलिशन।
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) टर्बो वेरिएंट।
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) उत्पादन में प्रवाह मिलान।
