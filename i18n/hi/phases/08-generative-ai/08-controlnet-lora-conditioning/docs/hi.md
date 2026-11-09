# नियंत्रणनेट, लोरा और कंडीशनिंग

> केवल पाठ एक ही एक अशिष्ट नियंत्रण संकेत है। कंट्रोलनेट आपको एक पूर्व-प्रशिक्षित विसारण मॉडल का क्लोन करने और इसे एक गहराई मानचित्र, पोज़ स्केलेटन, स्क्रबलबेल या किनारे छवि के साथ निर्देशित करने की अनुमति देता है। लोरा आपको 10 मिलियन पैरामीटर को प्रशिक्षित करके 2 बी-पैरामीटर मॉडल को ठीक करने की अनुमति देता है। साथ ही उन्होंने एक खिलौना से स्थिर विसारण को 2026 छवि पाइपलाइन में बदल दिया जो हर एजेंसी पर भेजता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## समस्या

"एक लाल कपड़े में एक महिला एक व्यस्त सड़क पर एक कुत्ते को चलती है" जैसे संकेत मॉडल को * कुत्ता कहां है, * महिला किस मुद्रा में है, या * सड़क का दृष्टिकोण * के बारे में कोई जानकारी नहीं देते हैं। पाठ एक छवि को निर्दिष्ट करने के लिए आवश्यक वस्तुओं का लगभग 10% नीचे चिह्नित करता है। बाकी दृश्य है और शब्दों में कुशलता से वर्णित नहीं किया जा सकता है।

प्रत्येक सिग्नल (स्थिति, गहराई, चालाक, खंडन) के लिए खरोंच से एक नया सशर्त मॉडल प्रशिक्षित करना निषिद्ध है। आप 2.6B-परम एसडीएक्सएल रीढ़ को जमे रखना चाहते हैं, एक छोटा सा सा साइड-नेटवर्क संलग्न करें जो कंडीशनिंग पढ़ता है, और इसे रीढ़ की हड्डी की मध्यवर्ती विशेषताओं को धक्का देना है। यह नियंत्रणनेट है।

आप मॉडल को पूरी मॉडल को फिर से प्रशिक्षित किए बिना नए अवधारणाओं (आपका चेहरा, आपका उत्पाद, आपकी शैली) सिखाना चाहते हैं। आप एक 100 गुना छोटे डेल्टा चाहते हैं। यह लोरा  निम्न-रैंक एडाप्टर है जो मौजूदा ध्यान भारों में प्लग करते हैं।

ControlNet + LoRA + text = 2026 प्रैक्टिशनर के टूलकिट। अधिकांश उत्पादन छवि पाइपलाइन 2-5 LoRAs, 1-3 ControlNets, और एक SDXL / SD3 / प्रवाह आधार के शीर्ष पर एक आईपी-एडाप्टर लेयर करती हैं।

## अवधारणा

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### नियंत्रणनेट (जंग एट अल., 2023)

एक पूर्व प्रशिक्षित एसडी लें। * यू-नेट के एन्कोडर आधा को क्लोन करें। मूल को फ्रीज करें। क्लोन को अतिरिक्त कंडीशनिंग इनपुट (एज, गहराई, मुद्रा) को स्वीकार करने के लिए प्रशिक्षित करें। * शून्य-कन्वॉल्यूशन* स्kip कनेक्शन के साथ मूल के डेकोडर आधा को क्लोन को वापस कनेक्ट करें (1 × 1 कन्व्हर्स शून्य पर शुरू किया गया  नो-ऑप के रूप में शुरू करें, डेल्टा सीखें) ।

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

शून्य-संपर्क init का अर्थ है कि नियंत्रणनेट पहचान के रूप में शुरू होता है  प्रशिक्षण से पहले भी कोई नुकसान नहीं होता है। 1M पर ट्रेन (प्रोम्प्ट, स्थिति, छवि) मानक विसारण हानि के साथ तीन गुना हो जाती है।

प्रति-मौजूदाता नियंत्रणनेट छोटे साइड मॉडल के रूप में जहाज (एसडीएक्सएल के लिए ~ 360 एम, एसडी 1.5 के लिए ~ 70 एम) । आप उन्हें निष्कर्ष पर लिख सकते हैंः

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### लोरा (Hu et al., 2021)

किसी भी रैखिक परत के लिए $W \in \mathbb{R}^{d \times d}$मॉडल में, फ्रीज $W$और एक निम्न श्रेणी के डेल्टा जोड़ेंः

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

के साथ$r \ll d$. ध्यान के लिए रैंक 4-16 मानक है, भारी बारीक-बारी से गाने के लिए रैंक 64-128। नए मापदंडों की संख्याः $2 \cdot d \cdot r$इसके बजाय $d^2$. एसडीएक्सएल के लिए ध्यान दें $d=640$,$r=16$: 410k के बजाय प्रति एडाप्टर 20k पैरामीटर  20x कमी। पूरे मॉडल मेंः एक LoRA आमतौर पर 20-200MB बनाम बेस 5GB है।

निष्कर्ष पर आप लोरा स्केल कर सकते हैंः $W' = W + \alpha \cdot B A$. .$\alpha = 0.5\text{-}1.5$कई LoRAs अतिरिक्त रूप से ढेर (आमतौर पर चेतावनी के साथ कि वे गैर-रैखिक तरीकों से बातचीत करते हैं) ।

### आईपी-एडाप्टर (Ye et al., 2023)

एक छोटा एडाप्टर जो * छवि * को कंडीशनिंग के रूप में स्वीकार करता है (टेक्स्ट के साथ) । छवि टोकन बनाने के लिए CLIP छवि एन्कोडर का उपयोग करता है, उन्हें पाठ टोकन के साथ-साथ क्रॉस-अटेंशन में इंजेक्ट करता है। ~ 20MB प्रति बेस मॉडल। आपको एक LoRA के बिना "इस संदर्भ की शैली में एक छवि उत्पन्न करने" देता है।

## सम्मिश्रण मैट्रिक्स

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

नियंत्रण नेटवर्क ≈ अंतरिक्ष, लोरा ≈ अर्थशास्त्र. दोनों का उपयोग करें.

```figure
v4-controlnet-zero
```

## इसे बनाओ

`code/main.py`1-डी पर दो तंत्रों का अनुकरण करता हैः

1. **LoRA.**एक पूर्व प्रशिक्षित रैखिक परत $W$इसे ठंढो. एक निम्न श्रेणी के प्रशिक्षित.$BA$इस तरह की$W + BA$लक्ष्य रैखिक परत से मेल खाता है. दिखाएँ कि$r = 1$एक रैंक-1 सुधार को सही ढंग से सीखने के लिए पर्याप्त है।

2. **ControlNet-lite.**एक "मुस्कृत आधार" भविष्यवाणी और एक "साइड नेटवर्क" जो एक अतिरिक्त संकेत पढ़ता है। साइड नेटवर्क के आउटपुट को शून्य (शून्य-conv का हमारा संस्करण) पर आरंभिक रूप से एक सीखने योग्य स्केलर द्वारा बंद किया जाता है। ट्रेन और गेट रैंप को ऊपर की ओर देख रहे हैं।

### चरण 1: लोरा गणित

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### चरण 2: शून्य-निट साइड नेटवर्क

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

चरण 0 में आउटपुट आधार के समान है। प्रारंभिक प्रशिक्षण अद्यतन `gate`धीरे धीरे  कोई विनाशकारी बहाव नहीं।

## फंदे

- **Over-scaling LoRAs.** $\alpha = 2$या $\alpha = 3$यह एक आम "मेक इट स्ट्रेंथ" हैक है जो ओवर-स्टाइल / टूट आउटपुट का उत्पादन करता है।$\alpha \le 1.5$. .
- **ControlNet weight conflict.**वजन 1.0 पर पोज़ कंट्रोलनेट और वजन 1.0 पर गहराई कंट्रोलनेट का उपयोग करना आमतौर पर ओवरशॉट होता है। वजन ≈ 1.0 का योग एक सुरक्षित डिफ़ॉल्ट है।
- **LoRA on the wrong base.**SDXL LoRA चुपचाप SD 1.5 पर नो-ऑप है क्योंकि ध्यान आयामों मेल नहीं खाते हैं। डिफ्यूज़र 0.30+ में चेतावनी देंगे।
- **Textual Inversion drift.**एक चेकपोस्ट पर प्रशिक्षित टोकन दूसरे पर खराब रूप से बहते हैं। लोरा अधिक पोर्टेबल है।
- **LoRA weight-merging and storage.**आप तेजी से निष्कर्ष के लिए आधार मॉडल वजन में एक लोरा बेक कर सकते हैं (कोई रनटाइम जोड़ने), लेकिन आप पैमाने की क्षमता खो देते हैं $\alpha$दोनों संस्करणों को रखें।

## इसका प्रयोग करें

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## इसे भेजें

सहेजें`outputs/skill-sd-toolkit-composer.md`. कौशल एक कार्य (इनपुट संपत्तिः शीघ्र, वैकल्पिक संदर्भ छवि, वैकल्पिक मुद्रा, वैकल्पिक गहराई, वैकल्पिक स्क्रैबल) लेता है और उपकरण स्टैक, वजन और एक पुनः उत्पन्न करने योग्य बीज प्रोटोकॉल को आउटपुट करता है।

## व्यायाम

1. **Easy.**`code/main.py`, लोरा रैंक में भिन्नता `r`1 से 4 तक। किस रैंक पर LoRA सही ढंग से रैंक-2 लक्ष्य डेल्टा से मेल खाता है?
2. **Medium.**दो अलग-अलग लोरा को दो लक्ष्य परिवर्तनों पर प्रशिक्षित करें। उन्हें एक साथ लोड करें और उनके जोड़ने वाले इंटरैक्शन को दिखाएं। इंटरैक्शन लाइनरता को कब तोड़ता है?
3. **Hard.**स्टैक करने के लिए डिफ्यूज़र का उपयोग करेंः SDXL-बेस + Canny-ControlNet (वेट 0.8) + एक शैली LoRA ($\alpha$0.8) + आईपी-एडाप्टर (वेट 0.6) स्टैक वजन के भिन्न होने के कारण FID बनाम त्वरित-अनुपालन बांटें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## उत्पादन नोटः लोरा स्वैप, कंट्रोलनेट लेन, मल्टी-रिटेन्टेन्ट सेवा

एक वास्तविक पाठ-से-छवि सास एक ही आधार चेकपॉइंट पर सैकड़ों लोरा और एक दर्जन कंट्रोलनेट की सेवा करता है। सेवा समस्या एलएलएम मल्टी-रेनेंस की तरह दिखती है (उत्पादन साहित्य निरंतर बैचिंग और लोरेक्स / एस-लोरा के तहत एलएलएम मामले को कवर करता है):

- **Hot-swap LoRAs, do not merge.**विलय$W' = W + \alpha \cdot B \cdot A$आधार में ~ 3-5% तेजी से प्रति चरण निष्कर्ष देता है लेकिन ठंड $\alpha$आर-र डेल्टा के रूप में वीआरएएम में लोरा को गर्म रखें; विसारक उजागर करते हैं`pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`प्रति अनुरोध सक्रियण के लिए। स्वैप लागत है `2 · d · r · num_layers`भार  एमबी पैमाने, उप-दूसरा।
- **ControlNet as a second attention lane.**क्लोन किए गए एन्कोडर आधार के समानांतर चलता है। वजन 1.0 के साथ दो कंट्रोलनेट = प्रत्येक चरण में दो अतिरिक्त आगे पास, एक विलय पास नहीं। बैच आकार के हेडरूम चौतरफा रूप से गिरते हैं। सक्रिय कंट्रोलनेट प्रति ~ 1.5 × चरण लागत के लिए बजट।
- **Quantized LoRAs too.**यदि आपने आधार को क्वांटिफाई किया है (लक्ष्य 07, 8GB पर प्रवाह देखें), तो लोरा डेल्टा भी 8-बिट या 4-बिट तक साफ-सुथरा क्वांटिफाई करता है। QLoRA शैली का लोडिंग आपको मेमोरी फ्लाई किए बिना 4-बिट फ्लक्स बेस के ऊपर 5-10 लोरा को ढेर करने की अनुमति देता है।

प्रवाह विशिष्टः Niels के Flux-on-8GB नोटबुक आधार को 4-बिट तक क्वांटिफाई करता है; स्टाइल लोरा (`pipe.load_lora_weights("user/style-lora")`) पर उस क्वांटिज़्ड आधार पर `weight_name="pytorch_lora_weights.safetensors"`यह 2026 में अधिकांश सास एजेंसियों द्वारा भेजा जाने वाला नुस्खा है।

## आगे पढ़ना

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) नियंत्रण नेटवर्क।
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) लोरा (मूल रूप से एलएलएम के लिए; प्रसार के लिए बंदरगाह) ।
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) आईपी-एडाप्टर।
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) नियंत्रणनेट के लिए हल्का विकल्प।
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) ड्रीमबॉट।
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) संदर्भ पाइपलाइनें।
