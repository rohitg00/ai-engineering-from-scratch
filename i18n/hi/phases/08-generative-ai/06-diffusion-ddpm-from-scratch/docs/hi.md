# विसारण मॉडल  स्क्रैच से डीडीपीएम

> हो, जैन, अब्बील (2020) ने क्षेत्र को एक नुस्खा दिया जो इसे छोड़ नहीं सकता था। एक हजार छोटे चरणों पर शोर के साथ डेटा को नष्ट करें। शोर की भविष्यवाणी करने के लिए एक तंत्रिका जाल को प्रशिक्षित करें। निष्कर्ष पर प्रक्रिया को उलट दें। आज हर मुख्यधारा की छवि, वीडियो, 3 डी और संगीत मॉडल इस लूप पर चलता है, संभवतः ऊपर प्रवाह मिलान या स्थिरता ट्रिक्स के साथ।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## समस्या

आप एक नमूना के लिए चाहते हैं $p_{\text{data}}(x)$. GANs एक न्यूनतम खेल खेलते हैं जो अक्सर भिन्न होता है। VAEs एक गौसीयन डिकोडर से धुंधले नमूने बनाते हैं। आप वास्तव में क्या चाहते हैं एक प्रशिक्षण लक्ष्य है जो (ए) एक स्थिर हानि (कोई सaddle point, कोई minimax नहीं) है, (बी) एक निचली सीमा पर $\log p(x)$(तो आपके पास संभावनाएं हैं), और (सी) नमूने जो SOTA गुणवत्ता से मेल खाते हैं।

Sohl-Dickstein et al. (2015) के पास एक सैद्धांतिक उत्तर थाः एक मार्कोव श्रृंखला को परिभाषित करें $q(x_t \mid x_{t-1})$जो धीरे-धीरे Gaussian शोर जोड़ता है, और एक रिवर्स श्रृंखला को प्रशिक्षित करता है$p_\theta(x_{t-1} \mid x_t)$हो, जैन, अबील (2020) ने दिखाया कि नुकसान को एक पंक्ति में सरल किया जा सकता है  शोर की भविष्यवाणी करें  और गणित को साफ किया। 2020 में यह एक जिज्ञासा थी। 2021 में यह अत्याधुनिक नमूने का उत्पादन किया। 2022 में यह स्थिर विसारण बन गया। 2026 में यह सब्सट्रेट है।

## अवधारणा

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Gaussian शोर जोड़ें $T$बंद रूप  गणित के लिए ट्रेटेबल है  क्योंकि संचयी कदम भी गौशियन हैः

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

कहाँ$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$$\beta_t$चुनें$\beta_t$1e-4 से 0.02 तक रैखिक रूप से पार $T=1000$कदम और $x_T$लगभग $\mathcal{N}(0, I)$. .

**Reverse process $p_\theta$.**एक तंत्रिका नेटवर्क सीखें $\epsilon_\theta(x_t, t)$जो जोड़ा गया शोर की भविष्यवाणी करता है।$x_t$, के द्वारा परिभाषित किया गया हैः

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

कहाँ$\sigma_t$या तो $\sqrt{\beta_t}$यह अभिव्यक्ति बदसूरत है लेकिन यह सिर्फ बीजगणित है$x_{t-1}$पिछली दी गई है$q(x_{t-1} \mid x_t, x_0)$और प्रतिस्थापन$x_0$इसके शोर-पूर्वानुमानित अनुमान के साथ।

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

नमूना $x_0$डेटा से, एक यादृच्छिक चुनें $t$, नमूना $\epsilon \sim \mathcal{N}(0, I)$, शोर की गणना $x_t$बंद रूप के माध्यम से एक शॉट में, और शोर पर वापस. एक हानि, कोई न्यूनतम, कोई KL, कोई reparameterization चालें नहीं.

**Sampling.**शुरू करो$x_T \sim \mathcal{N}(0, I)$.  से रिवर्स कदम दोहराएं$t = T$1 तक।

## यह काम क्यों करता है

तीन अंतर्ज्ञानः

1. **Denoising is easy; generating is hard.**$t=T$, डेटा शुद्ध शोर है  नेटवर्क एक तुच्छ समस्या को हल करने के लिए है।$t=0$, नेट केवल कुछ पिक्सेल साफ करने के लिए है. मध्यवर्ती पर$t$, समस्या कठिन है लेकिन नेट में कई gradients प्रत्येक शोर स्तर से एक ही वजन के माध्यम से बहती है।

2. **Score matching in disguise.**विंसेंट (2011) ने साबित किया कि शोर की भविष्यवाणी अनुमान के बराबर है $\nabla_x \log q(x_t \mid x_0)$, *स्कोर*। रिवर्स एसडीई इस स्कोर का उपयोग घनत्व ग्रेडिएंट  पर चलने के लिए करता है।

3. **The ELBO reduces to simple MSE.**पूर्ण वैरिएशनल निचली सीमा में समय चरण के लिए एक KL शब्द होता है। डीडीपीएम के पैरामीटरकरण के साथ, उन KL शब्दों को विशिष्ट गुणांक के साथ शोर भविष्यवाणी पर एमएसई में सरल बनाया जाता है; हो ने गुणांक (इसका "सरल" नुकसान कहते हैं) गिरा दिया और गुणवत्ता *बनी हुई*।

```figure
diffusion-denoise
```

## इसे बनाओ

`code/main.py`एक 1 डी डी डी पी एम लागू करता है। डेटा दो मोड मिश्रण है। "नेट" एक छोटे से MLP है जो लेता है$(x_t, t)$प्रशिक्षण एक पंक्ति हानि है. नमूनाकरण रिवर्स श्रृंखला दोहराता है.

### चरण 1: आगे की योजना (बंद फॉर्म)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### चरण 2: नमूना `x_t`एक शॉट में

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### चरण 3: एक प्रशिक्षण चरण

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### चरण 4: उल्टा नमूनाकरण

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

40 समय चरणों और 24 इकाई एमएलपी के साथ 1-डी समस्या के लिए, यह ~ 200 युगों में दो-मोड मिश्रण सीखता है।

## समय की स्थिति

नेट को यह जानना चाहिए कि वह किस समय की गति को रेखांकित कर रहा है। दो मानक विकल्पः

- **Sinusoidal embedding.**ट्रांसफार्मर स्थिति एन्कोडिंग की तरह।$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$एक एमएलपी के माध्यम से पारित, नेटवर्क में प्रसारित.
- **Film / group-norm conditioning.**प्रत्येक ब्लॉक पर परियोजना एम्बेडिंग प्रति चैनल पैमाने/अवशिष्ट (FiLM) पर।

हमारे खिलौना कोड का उपयोग sinus → concat. उत्पादन U-नेट FiLM का उपयोग करते हैं।

## फंदे

- **Schedule matters a lot.**रैखिक $\beta$डीडीपीएम डिफ़ॉल्ट है लेकिन कॉसिन शेड्यूल (निचोल एंड धारिवाल, 2021) एक ही गणना के लिए बेहतर एफआईडी देता है। गुणवत्ता पठारों के मामले में शेड्यूल स्विच करें।
- **Timestep embedding is fragile.**कच्चे पासिंग $t$एक फ्लोट खिलौना 1-डी के लिए काम करता है लेकिन छवियों के लिए विफल रहता है; हमेशा एक उचित एम्बेडिंग का उपयोग करें।
- **V-prediction vs ε-prediction.**संकीर्ण व्यवस्थाओं के लिए (बहुत छोटा या बहुत बड़ा t), $\epsilon$कम संकेत-गर्जन है।$v = \alpha \cdot \epsilon - \sigma \cdot x$) अधिक स्थिर है; SDXL, SD3 और Flux इसका उपयोग करते हैं।
- **Classifier-free guidance.**निष्कर्ष पर, सशर्त और असीमित दोनों गणना करें $\epsilon$, तो $\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$के साथ$w \approx 3\text{-}7$. पाठ 08 में शामिल है.
- **1000 steps is a lot.**उत्पादन में डीडीआईएम (20-50 चरण), डीपीएम-सोल्वर (10-20 चरण) या डिस्टिलिशन (1-4 चरण) का उपयोग किया जाता है। पाठ 12 देखें।

## इसका प्रयोग करें

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

फैलाव सार्वभौमिक जनरेटिव रीढ़ है। प्रवाह मिलान (पाठ 13) 2024-2026 प्रतियोगी है जो आमतौर पर एक ही गुणवत्ता के लिए निष्कर्ष गति पर जीतता है।

## इसे भेजें

सहेजें`outputs/skill-diffusion-trainer.md`. कौशल एक डेटासेट + गणना बजट और आउटपुट लेता हैः कार्यक्रम (रेखीय/कोसिन/सिग्मोइड), भविष्यवाणी लक्ष्य (ε/v/x), चरणों की संख्या, मार्गदर्शन पैमाने, नमूना परिवार और एक मूल्यांकन प्रोटोकॉल।

## व्यायाम

1. **Easy.**40 से 10 में T को बदलें `code/main.py`. नमूना गुणवत्ता (आउटपुट के दृश्य हिस्टोग्राम) कैसे घटती है?
2. **Medium.**ε-पूर्वानुमान से v-पूर्वानुमान पर स्विच करें। रिवर्स चरण पुनः प्राप्त करें। अंतिम नमूना गुणवत्ता की तुलना करें।
3. **Hard.**वर्ग लेबल पर स्थिति $c \in \lbrace 0, 1 \rbrace$, प्रशिक्षण के दौरान 10% समय में इसे छोड़ दें, और नमूना लेने के समय उपयोग $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$. सशर्त मोड से प्रभावित होने की दर को मापें $w = 0, 1, 3, 7$. .

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## उत्पादन नोटः विसारण अनुमान एक चरण गणना समस्या है

डीडीपीएम पेपर T=1000 रिवर्स स्टेप्स चलाता है। उत्पादन में कोई भी इसे जहाज नहीं करता है। प्रत्येक वास्तविक निष्कर्ष स्टैक तीन रणनीतियों में से एक का चयन करता है  और प्रत्येक "लैटेंसी कहां से आती है" के उत्पादन फ्रेमिंग के लिए साफ नक्शा बनाता हैः

1. **Faster sampler, same model.**डीडीआईएम (20-50 चरण), डीपीएम-सोलवर++ (10-20), यूनिपीसी (8-16) । रिवर्स लूप का ड्रॉप-इन प्रतिस्थापन; प्रशिक्षित $\epsilon_\theta$वजन अछूता है. 20 से 50 गुना लेटेंसी कटौती.
2. **Distillation.**एक छात्र को कम चरणों में शिक्षक से मेल खाने के लिए प्रशिक्षित करेंः प्रगतिशील डिस्टिलिशन (2 → 1), सुसंगतता मॉडल (शून्य → 1-4), एलसीएम, एसडीएक्सएल-टर्बो, एसडी3-टर्बो। विलंबता को और 5-10 × कम करता है, पुनर्व्यवस्था की आवश्यकता होती है।
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, TensorRT-LLM के प्रसार बैकेंड्स,`xformers`/SDPA ध्यान, bf16 वजन. प्रति चरण विलंबता ~ 2 × कटौती. (1) और (2) के साथ ढेर.

उत्पादन प्रसारण सर्वर के लिए बजट वार्तालाप LLM के लिए उत्पादन साहित्य के रूप में वर्णित है: विलंबता है `num_steps × step_cost + VAE_decode`, पारगम्यता है `batch_size × (num_steps × step_cost)^-1`. टीटीएफटी छोटा है (एक कदम); टीपीओटी-बराबर पूर्ण प्रतिक्रिया समय है क्योंकि छवि उत्पादन उपयोगकर्ता के दृष्टिकोण से "सभी एक बार" है।

## आगे पढ़ना

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) प्रसार पत्र, अपने समय से पहले।
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) डीडीपीएम।
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) डीडीआईएम, कम कदम।
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) कॉसिन अनुसूची, सीखा भिन्नता।
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) वर्गीकरण निर्देश।
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG।
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) एकजुट संकेतन, सबसे साफ नुस्खा।
