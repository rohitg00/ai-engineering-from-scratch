# 3 डी पीढ़ी

> 3D वह मोडेलिटी है जहां 2D-to-3D लीवरेज सबसे मजबूत है। 2023 का सफलता 3D गैसियन स्प्लेटिंग था। 2024-2026 के लिए जनरेटिव पुश लेयर मल्टी-व्यू डिफ्यूजन + 3D पुनर्निर्माण शीर्ष पर एक एकल प्रॉम्प्ट या फोटो से वस्तुओं और दृश्यों का उत्पादन करने के लिए।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## समस्या

3 डी सामग्री दर्दनाक हैः

- **Representation.**जाल, बिंदु बादल, वोक्सेल ग्रिड, हस्ताक्षरित दूरी क्षेत्र (एसडीएफ), तंत्रिका विकिरण क्षेत्र (एनईआरएफ), 3 डी गौसीयन। प्रत्येक में व्यापार-बदला है।
- **Data scarcity.**ImageNet में 14M छवियां हैं। सबसे बड़ा स्वच्छ 3D डेटासेट (Objaverse-XL, 2023) में ~10M वस्तुएं हैं, सबसे कम गुणवत्ता।
- **Memory.**5123 वोक्सल ग्रिड 128M वोक्सल है; एक उपयोगी दृश्य NeRF 1M नमूने / किरण की आवश्यकता है। उत्पादन पुनर्निर्माण से कठिन है।
- **Supervision.**2D छवि के लिए आप पिक्सेल है. 3D के लिए आप आमतौर पर एक मुट्ठी भर 2D दृश्य है और 3D करने के लिए उठाने के लिए है.

2026 स्टैक दोनों समस्याओं को अलग करता है। पहला, एक विसारण मॉडल के साथ * 2D मल्टी-व्यू छवियों * उत्पन्न करें। दूसरा, उन छवियों में * 3D प्रतिनिधित्व * (आमतौर पर गौशियन स्प्लैटिंग) फिट करें।

## अवधारणा

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### प्रतिनिधित्वः 3 डी गौशियन स्प्लैटिंग (केर्बल एट अल., 2023)

एक दृश्य को ~ 1M 3D गौसीन के बादल के रूप में प्रस्तुत करें। प्रत्येक में 59 पैरामीटर हैंः स्थिति (3), सह-विवर्तन (6, या क्वाटरनियन 4 + पैमाने 3), अस्पष्टता (1), गोलाकार-हार्मोनिक्स रंग (48 डिग्री 3, 3 डिग्री 0 पर) ।

रेन्डरिंग = प्रोजेक्शन + अल्फा-कंपोजिटिंग। तेज़ (~ 4090 पर 1080p पर 100 फ़ीप्स) । अंतर करने योग्य। ग्राउंड-सत्य तस्वीरों के खिलाफ ग्रेडिएंट गिरावट से फिट। एक दृश्य उपभोक्ता जीपीयू पर 5-30 मिनट में फिट बैठता है।

2023-2024 के दौरान दो नवाचारों के साथ-साथ:
- **Generative Gaussian splats.**एलजीएम, एलआरएम, इंस्टेंटमेश जैसे मॉडल एक या कुछ छवियों से सीधे गाउसियन बादल की भविष्यवाणी करते हैं।
- **4D Gaussian Splatting.**गतिशील दृश्यों के लिए प्रति फ्रेम ऑफसेट के साथ गौसीन्स।

### बहुदृश्य प्रसार

एक ही ऑब्जेक्ट के कई लगातार दृश्यों को एक पाठ प्रॉम्प्ट या एकल छवि से उत्पन्न करने के लिए एक पूर्व-प्रशिक्षित छवि विसारण मॉडल को ठीक से समायोजित करें। शून्य123 (लिउ एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट एट

### पाठ-से-3डी पाइपलाइन

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026 दिशाः खेल इंजनों के लिए उपयुक्त पीबीआर सामग्री के साथ सीधे पाठ-से-मशीन मॉडल। मल्टी-व्यू विसारक मध्यवर्ती चरण अभी भी सामान्य वस्तुओं के लिए सबसे अच्छा प्रदर्शन करने वाला नुस्खा है।

### एनईआरएफ (संदर्भ के लिए)

न्यूरल रेडिएंस फील्ड (मिलडेनहॉल एट अल, 2020) । एक छोटी सी एमएलपी लेता है `(x, y, z, view direction)`और आउटपुट `(color, density)`. रेज के साथ एकीकृत करके रेंडर करना. मेष आधारित उपन्यास दृश्य संश्लेषण की गुणवत्ता में बेहतर है लेकिन रेंडर करने में 100-1000 गुना धीमा है। अधिकांश वास्तविक समय उपयोग के लिए गौशियन स्प्लैटिंग द्वारा आगे बढ़ी है लेकिन अभी भी अनुसंधान में प्रमुख है।

```figure
v4-3d-multiview
```

## इसे बनाओ

`code/main.py`एक खिलौना 2D "गॉसियन स्प्लेटिंग" फिट लागू करता हैः 2D गॉसियन स्प्लेट के योग के रूप में एक सिंथेटिक लक्ष्य छवि (एक चिकनी ग्रेडिएंट) का प्रतिनिधित्व करें। लक्ष्य से मेल खाने के लिए ग्रेडिएंट अवतरण द्वारा पदों, रंगों और सहवर्तनों को अनुकूलित करें। आप दो कोर संचालन देख सकते हैंः आगे रेंडर (स्प्लेट + अल्फा-संयोजित) और ग्रेडिएंट अवतरण द्वारा फिट।

### चरण 1: 2D Gaussian स्प्लैट

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### चरण 2: स्प्लेट्स को जोड़कर रेंडर करें

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

वास्तविक 3 डी गौसी स्प्लैटिंग गहनता और अल्फा-संयोजित क्रम के अनुसार गौसी को क्रमबद्ध करता है. हमारे 2 डी खिलौना सिर्फ योग है.

### चरण 3: ग्रेडिएंट अवतरण द्वारा फिट

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## फंदे

- **View inconsistency.**यदि आप स्वतंत्र रूप से 4 दृश्य उत्पन्न करते हैं और वे वस्तु संरचना के बारे में असहमत होते हैं, तो 3 डी फिट धुंधला होता है। फिक्सः साझा ध्यान के साथ बहु-दृश्य विसारण।
- **Back-side hallucination.**एक छवि → 3D को अदृश्य पक्ष का आविष्कार करना है। गुणवत्ता बहुत भिन्न होती है।
- **Gaussian splat explosion.**बिना किसी प्रतिबंध के प्रशिक्षण 10M स्पॉट और ओवरफिट तक बढ़ता है। घनत्व + कटाई हेरिस्टिक्स (मूल 3D-GS पेपर से) आवश्यक हैं।
- **Topology issues.**अप्रत्यक्ष क्षेत्रों (एसडीएफ) से जाल में अक्सर छेद या स्वयं-संकुचन होते हैं। शिपिंग से पहले एक रेमेशर (जैसे ब्लेंडर के वॉक्सल रेमेश) चलाएं।
- **License of training data.**ओब्जावर्स के पास मिश्रित लाइसेंस हैं; वाणिज्यिक उपयोग मॉडल के अनुसार भिन्न होता है।

## इसका प्रयोग करें

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

गेम या ई-कॉमर्स पाइपलाइन में शिपिंग उत्पादन 3D के लिएः मेशी 4 या रोडिन जेन-1.5 आउटपुट पीबीआर जाल जो सीधे यूनिटी / अनियंत्रित में जाते हैं।

## इसे भेजें

सहेजें`outputs/skill-3d-pipeline.md`. कौशल 3D संक्षिप्त (इनपुटः पाठ / एक छवि / कुछ छवियां; आउटपुटः जाल / स्प्लैट / NeRF; उपयोगः रेंडर / खेल / वीआर) और आउटपुटः पाइपलाइन (मल्टी-व्यू डिफ्यूजन + फिट, या प्रत्यक्ष जाल मॉडल), आधार मॉडल, पुनरावृत्ति बजट, टॉपलॉजी पोस्ट-प्रोसेसिंग, आवश्यक सामग्री चैनल लेता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`4, 16, 64 गौसींस के साथ अंतिम एमएसई बनाम लक्ष्य रिपोर्ट।
2. **Medium.**रंग गाउसियन (RGB) तक विस्तारित करें। पुनर्निर्माण लक्ष्य रंग पैटर्न से मेल खाती है।
3. **Hard.**gsplat या Nerfstudio का उपयोग करके, 50 तस्वीरों की कैप्चर से एक वास्तविक वस्तु का पुनर्निर्माण करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## उत्पादन नोटः 3 डी में अभी तक कोई साझा सब्सट्रेट नहीं है

छवि (लैटिन डिफ्यूजन + डीआईटी) और वीडियो (स्पेसोटेंपोरल डीआईटी) के विपरीत, 2026 में 3 डी में कोई एकल प्रमुख रनटाइम नहीं है। उत्पादन निर्णय पेड़ प्रतिनिधित्व पर कांटे लगाता हैः

- **NeRF / triplane.**इन्फेरेंस रे-मार्चिंग + प्रति नमूना एक एमएलपी फॉरवर्ड है। 5122 रेंडर के लिए लाखों एमएलपी फॉरवर्ड की आवश्यकता होती है। रे नमूने को आक्रामक रूप से बैच करें; एसडीपीए / एक्सफॉर्मर लागू होता है।
- **Multi-view diffusion + LRM reconstruction.**दो चरण पाइपलाइन। चरण 1 (मल्टी-व्यू डीआईटी) एक विसारण सर्वर है जैसे कि पाठ 07। चरण 2 (एलआरएम ट्रांसफार्मर) दृश्यों पर एक शॉट आगे का पारित है। समग्र विलंबता प्रोफ़ाइल "विसारण + एक शॉट" है।
- **SDS / DreamFusion.**प्रति संपत्ति अनुकूलन, न कि निष्कर्ष। नौकरियां बनाएं, न कि प्रबंधकों का अनुरोध करें।

अधिकांश 2026 उत्पादों के लिए, सही उत्तर है "अनुरोध पर मल्टी-व्यू विसारण मॉडल चलाएं, असिंक्रोनस तरीके से 3DGS पर पुनर्निर्माण करें, वास्तविक समय में देखने के लिए 3DGS की सेवा करें। यह एक GPU-इन्फरेंस सर्वर (त्वरित) और एक ऑफ़लाइन अनुकूलक (धीमी) के बीच कामकाजी भार को साफ ढंग से विभाजित करता है।

## आगे पढ़ना

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) एनईआरएफ।
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) 3DGS।
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) एसडीएस।
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) शून्य123।
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) बहु दृश्य प्रसार।
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) एलआरएम।
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) CAT3D.
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) SV3D.
