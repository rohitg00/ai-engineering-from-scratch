# पेंटिंग, आउटपेंटिंग और इमेज एडिटिंग

> टेक्स्ट-टू-इमेज नई चीजें बनाता है। पेंटिंग पुराने को ठीक करता है। उत्पादन में, बिल करने योग्य छवि कार्य का 70% संपादन है  पृष्ठभूमि को बदलना, लोगो को हटाना, कैनवास को बढ़ा देना, हाथ को पुनर्जीवित करना। पेंटिंग वह जगह है जहां विसारक अपना बचाव कमाता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## समस्या

एक ग्राहक पृष्ठभूमि में एक विचलित करने वाले संकेत के साथ एक सही उत्पाद फोटो भेजता है। आप संकेत को मिटा देना चाहते हैं और बाकी सब कुछ पिक्सेल-समान छोड़ देना चाहते हैं। आप स्क्रैच से पाठ-चित्र नहीं चला सकते हैं। परिणाम में एक अलग रंग, अलग प्रकाश व्यवस्था, अलग उत्पाद कोण होगा। आप * केवल * मुखौटा क्षेत्र को पुनर्जीवित करना चाहते हैं, और आप चाहते हैं कि पुनर्जीवित परिवेश का सम्मान करें।

यह पेंटिंग है।

- **Inpainting.**मास्क के अंदर पुनरुत्पादित करें, पिक्सेल के बाहर रखें।
- **Outpainting.**मास्क के बाहर (या कैनवास के बाहर) पुनर्जनन करें, अंदर रखें।
- **Image editing.**पूरी छवि को पुनर्जनित करें लेकिन मूल के लिए अर्थ या संरचनात्मक निष्ठा बनाए रखें (SDEdit, InstructPix2Pix).

2026 में प्रत्येक विसारण पाइपलाइन एक पेंटिंग मोड जहाज करता है। फ्लोक्स.1-फिल, स्थिर विसारण पेंट, एसडीएक्सएल-पीईंट, डेल-ई 3 संपादित। वे एक ही सिद्धांत पर काम करते हैं।

## अवधारणा

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### साफ़-साफ़ दृष्टिकोण (और यह गलत क्यों है)

एक मास्क के साथ मानक पाठ-छवि चलाएं। प्रत्येक नमूना लेने के चरण में, शोर लटेंट के खुले क्षेत्र को आगे-प्रसारित स्वच्छ छवि के साथ बदलें। यह काम करता है ... खराब। सीमा पार कलाकृतियों को रक्तपात से गुजरता है क्योंकि मॉडल में मास्क क्षेत्र में क्या है के बारे में कोई जानकारी नहीं है।

### सही पेंटिंग मॉडल

एक संशोधित यू-नेट को ट्रेन करें जो 4 के बजाय 9 इनपुट चैनल लेता हैः

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

अतिरिक्त चैनल VAE-encoded source image की एक प्रति और एक single-channel mask की होती है। प्रशिक्षण के समय, आप छवि के यादृच्छिक क्षेत्रों को मास्क करते हैं और मॉडल को केवल मास्क वाले क्षेत्र को दर्शाने के लिए प्रशिक्षित करते हैं जबकि अनमास्क्ड क्षेत्र को एक साफ कंडीशनिंग सिग्नल के रूप में दिया जाता है। निष्कर्ष पर, मॉडल "देख सकता है" जो मास्क वाले क्षेत्र के आसपास है और सुसंगत पूर्णता उत्पन्न करता है।

SD-Inpaint, SDXL-Inpaint, Flux-Fill सभी इस 9-चैनल (या एनालॉग) इनपुट का उपयोग करते हैं।`StableDiffusionInpaintPipeline`,`FluxFillPipeline`. .

### SDEdit (Meng et al., 2022)  मुफ्त संपादन

स्रोत छवि में कुछ मध्यवर्ती तक शोर जोड़ें `t`, फिर रिवर्स चेन से चलाएँ `t`एक नए संकेत के साथ 0 से नीचे। कोई पुनर्व्यास नहीं।`t`रचनात्मक स्वतंत्रता के लिए निष्ठा का व्यापार करता हैः

- `t/T = 0.3`→ स्रोत के समान, छोटे स्टाइलिस्टिक परिवर्तन
- `t/T = 0.6`→ मध्यम संपादन, कच्ची संरचना को बनाए रखता है
- `t/T = 0.9`→ शोर के निकट, स्रोत संरक्षण के न्यूनतम स्तर से उत्पन्न

### InstructPix2Pix (ब्रुक्स एट अल, 2023)

एक विसारण मॉडल पर ठीक से ट्यून करें `(input_image, instruction, output_image)`निष्कर्ष पर, इनपुट छवि और एक पाठ निर्देश दोनों पर स्थिति ("सूर्यास्त करें", "ड्रैगन जोड़ें") दो CFG पैमानेः छवि पैमाने और पाठ पैमाने।

### रिपेन्ट (Lugmayr et al., 2022)

एक मानक बिना शर्त विसारण मॉडल बनाए रखें। प्रत्येक उलट कदम पर, पुनः नमूना  कभी-कभी शोर की स्थिति में वापस कूदें और पुनर्जनन करें। सीमा कलाकृतियों से बचें। जब आपके पास एक प्रशिक्षित पेंटिंग मॉडल नहीं है तो इसका उपयोग किया जाता है।

```figure
inpaint-mask-reinject
```

## इसे बनाओ

`code/main.py`5-आयामी डेटा पर खिलौना 1-डी पेंटिंग योजना लागू करता है। हम 5-आयामी मिश्रण डेटा पर एक डीडीपीएम को प्रशिक्षित करते हैं जहां प्रत्येक नमूना दो समूहों में से एक से 5 फ्लोट होता है। निष्कर्ष पर, हम 5 आयामों में से 2 को "मास्क" करते हैं, प्रत्येक चरण में तीनों के शोर-आगे संस्करण का इंजेक्शन करते हैं, और केवल मास्क वाले आयामों को पुनर्जीवित करते हैं।

### चरण 1: 5-डीडीपीएम डेटा

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### चरण 2: सभी 5 dims पर ट्रेन denoiser

मानक डीडीपीएम. नेट आउटपुट 5-डी शोर इनपुट के लिए 5-डी शोर भविष्यवाणी करता है।

### चरण 3: निष्कर्ष पर, मास्क-जागरूक उल्टा

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

यह एक साफ़ दृष्टिकोण है और यह खिलौना 1-डी डेटा पर काम करता है। वास्तविक छवि पेंटिंग 9-चैनल इनपुट का उपयोग करता है क्योंकि बनावट सुसंगतता अधिक मायने रखती है।

### चरण 4: पेंटिंग

पेंटिंग मास्क को उल्टा करके पेंटिंग हैः नए (पूर्व में मौजूद नहीं) कैनवास को मास्क करें, बाकी को मूल के साथ भरें। एक ही प्रशिक्षण उद्देश्य।

## फंदे

- **Seams.**इस सरल दृष्टिकोण से दृश्य सीमाएं बनती हैं क्योंकि ग्रेडिएंट की जानकारी मास्क के माध्यम से नहीं बहती है। ठीक करेंः मास्क को 8-16 पिक्सल तक विस्तारित करें, या एक उचित पेंटिंग मॉडल का उपयोग करें।
- **Mask leakage.**यदि कंडीशनिंग छवि का अनमास्क क्षेत्र कम गुणवत्ता वाला या शोरबाज है, तो यह मास्क के अंदर की पीढ़ी को प्रदूषित करता है।
- **CFG interacts with mask size.**छोटे मास्क पर उच्च सीएफजी = संतृप्त पैच। छोटे संपादन के लिए सीएफजी को कम करें।
- **SDEdit fidelity cliff.**`t/T = 0.5``t/T = 0.6`वे शख्स की पहचान खो सकते हैं.
- **Prompt mismatch.**इस संकेत को न केवल नई सामग्री बल्कि *पूरी* छवि का वर्णन करना चाहिए। "एक बिल्ली कुर्सी पर बैठी" न कि "एक बिल्ली"।

## इसका प्रयोग करें

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

SAM (मेटा के सेगमेंट कुछ भी, 2023) + विसारक पेंट 2026 पृष्ठभूमि हटाने पाइपलाइन है। SAM 2 (2024) वीडियो पर काम करता है।

## इसे भेजें

सहेजें`outputs/skill-editing-pipeline.md`. कौशल एक मूल छवि + संपादन विवरण + वैकल्पिक मुखौटा (या SAM प्रॉम्प्ट) लेता है और आउटपुटः मुखौटा-उत्पादन दृष्टिकोण, आधार मॉडल, CFG स्केल (छवि + पाठ), SDEdit-t या इनपेंटिंग मोड, और QA चेकलिस्ट।

## व्यायाम

1. **Easy.**`code/main.py`, 0.2 से 0.8 तक छिपे हुए आयामों का अंश भिन्न होता है। किस अंश पर पेंट की गुणवत्ता (छिपे हुए dims में शेष) बिना शर्त उत्पादन के बराबर होती है?
2. **Medium.**RePaint लागू करेंः प्रत्येक 10 वें रिवर्स स्टेप पर, 5 स्टेप पीछे कूदें (गूंज जोड़ें) और फिर से डीनोइज़ करें। मापें कि क्या यह मास्क के किनारे पर सीमा अवशिष्ट को कम करता है।
3. **Hard.**तुलना करने के लिए Hugging Face diffusers का उपयोग करेंः SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1- चेहरे की पुनर्जनन के 20 कार्यों पर भरें। स्कोर अनुपालन और पहचान संरक्षण को अलग से प्रस्तुत करता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## उत्पादन नोटः संपादन पाइपलाइनों विलंब-संवेदनशील हैं

एक छवि को संपादित करने वाले उपयोगकर्ता 5 सेकंड से कम समय में यात्रा की उम्मीद करते हैं। 10242 पर 30-चरण एसडीएक्सएल-इंपेंट एक एल 4 पर 3-4 सेकंड है, साथ ही एसएएम मास्क पीढ़ी (~ 200 एमएस) और वीएई एन्कोड / डिकोड (~ 500 एमएस संयुक्त) । उत्पादन फ्रेमिंग में, यह आउटपुट-बाउंड के बजाय टीटीएफटी-बाउंड है  बैच 1, कम समवर्ती, हर चरण को कम से कम करेंः

- **SAM-H is the slow one.**SAM-H 10242 पर ~ 200 ms है; SAM-ViT-B ~ 40 ms है, जिसमें मामूली गुणवत्ता हानि होती है। SAM 2 (वीडियो) temporal overhead जोड़ता है; इसे single-image edits के लिए उपयोग न करें।
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`यदि आपके पास पिछली पीढ़ी के लटेंट हैं (आधारात्मक संपादन UI में आम), तो उन्हें सीधे `latents=...`एक VAE कोड को छोड़ने के लिए।
- **Mask dilation matters for throughput too.**एक छोटे से मास्क का मतलब है कि यू-नेट आगे पास का अधिकांश बर्बाद हो जाता है (अनमास्क्ड पिक्सल वैसे भी क्लैंप कर रहे हैं) ।`diffusers`"`StableDiffusionInpaintPipeline`बिना किसी पर पूरा यू-नेट चलाता है; केवल 9-चैनल सही-पैन्ट संस्करणों छिपे हुए कंप्यूटिंग का लाभ उठाते हैं।
- **Flux-Kontext is the 2025 answer.**एक आगे की पार पार `(source_image, instruction)` कोई अलग मुखौटा नहीं, कोई SDEdit शोर स्वीप नहीं। एक H100 पर यह लगभग 1.5 सेकंड में एक संपादन भेजता है। वास्तुकला पाठः चरणों को ढहाना।

## आगे पढ़ना

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) प्रशिक्षण मुक्त पेंटिंग।
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) SDEdit।
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) पाठ-निर्देश संपादन।
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) SAM, मुखौटा स्रोत.
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) वीडियो SAM.
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) ध्यान स्तर का संपादन।
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) 2024 उपकरण।
