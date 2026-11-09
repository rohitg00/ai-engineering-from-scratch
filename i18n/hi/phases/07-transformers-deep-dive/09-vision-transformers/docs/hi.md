# दृष्टि परिवर्तनक (ViT)

> एक छवि एक पैच ग्रिड है एक वाक्य टोकन ग्रिड है एक ही ट्रांसफार्मर दोनों को खाता है।

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## समस्या

2020 से पहले, कंप्यूटर विजन का मतलब घुमाव था। इमेजनेट, COCO, और डिटेक्शन बेंचमार्क पर हर SOTA में सीएनएन रीढ़ की हड्डी का उपयोग किया गया था। ट्रांसफार्मर भाषा के लिए थे।

डोसोविट्स्की और अन्य (2020)  "एक छवि 16x16 शब्दों के लायक है"  दिखाया कि आप पूरी तरह से घुमाव को छोड़ सकते हैं। एक छवि को निश्चित आकार के पैचों में काटें, प्रत्येक पैच को रैखिक रूप से एम्बेडिंग में प्रोजेक्ट करें, अनुक्रम को वनीला ट्रांसफार्मर एन्कोडर में खिलाएं। पर्याप्त पैमाने पर (ImageNet-21k प्रीट्रेनिंग या बड़ा), ViT ResNet-आधारित मॉडल से मेल खाता है या हराता है।

ViT 2026 में एक व्यापक पैटर्न की शुरुआत थीः एक वास्तुकला, कई मोडेल। व्हिस्पर ऑडियो टोकन बनाता है। ViT छवियों को टोकन बनाता है। रोबोटिक्स के लिए एक्शन टोकन। वीडियो के लिए पिक्सेल टोकन। ट्रांसफार्मर परवाह नहीं करता है  इसे एक अनुक्रम खिलाता है और यह सीखता है।

2026 तक, वीआईटी और इसके वंशज (डीईटी, स्विन, डिनोव2, वीआईटी-22बी, एसएएम 3) के पास अधिकांश दृष्टि है। सीएनएन अभी भी किनारे उपकरणों और विलंबता-संवेदनशील कार्यों पर जीत हासिल करते हैं। बाकी सब कुछ स्टैक में कहीं भी वीआईटी है।

## अवधारणा

![Image → patches → tokens → transformer](../assets/vit.svg)

### चरण 1  पैच करें

एक को विभाजित करें`H × W × C`छवि में एक `N × (P·P·C)`फ्लैट पैच का क्रम।`224 × 224`छवि, `16 × 16`पैच → 196 पैच 768 मानों के प्रत्येक।

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

पैच का आकार लीवर है। छोटे पैच = अधिक टोकन, बेहतर संकल्प, वर्ग ध्यान लागत। बड़े पैच = मोटे, सस्ता।

### चरण 2  रैखिक एम्बेडिंग

एक एकल सीखा मैट्रिक्स प्रत्येक फ्लैट पैच को अनुमानित करता है`d_model`. कर्नेल आकार के एक घुमाव के बराबर `P`और कदम `P`. PyTorch में यह सचमुच है`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` दो पंक्ति का कार्यान्वयन।

### चरण 3  prepend `[CLS]`टोकन, स्थितित्मक एम्बेड जोड़ें

- सीखने योग्य को तैयार करें `[CLS]`इसका अंतिम छिपा हुआ राज्य छवियों का प्रतिनिधित्व है वर्गीकरण के लिए इस्तेमाल किया।
- सीखने योग्य स्थितित्मक एम्बेडमेंट (वीटी-मूल) या सिनुसोइडल 2डी (बाद में वेरिएंट) जोड़ें।
- 2024+ में RoPE को स्थिति के लिए 2D तक बढ़ाया गया, कभी-कभी स्पष्ट रूप से एम्बेड किए बिना।

### चरण 4  मानक ट्रांसफार्मर एन्कोडर

 के स्टैक L ब्लॉक`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

### चरण 5  सिर

वर्गीकरण के लिएः ले लो `[CLS]`छिपी हुई स्थिति → रैखिक → नरम अधिकतम। DINOv2 या SAM के लिए, त्याग दें `[CLS]`, सीधे पैच एम्बेड का उपयोग करें।

### महत्वपूर्ण वेरिएंट

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### क्यों यह कुछ समय लगा

वीआईटी को सीएनएन से मेल खाने के लिए *बहुत सारे* डेटा की आवश्यकता है क्योंकि इसमें सीएनएन के प्रेरक पूर्वाग्रहों (अनुवाद अपरिवर्तनीयता, स्थानीयता) में से कोई भी नहीं है। बिना 100 मिलियन से अधिक लेबल वाली छवियों या मजबूत स्व-निरीक्षण पूर्व प्रशिक्षण के, सीएनएन अभी भी मेल खाने वाले गणना में जीतते हैं। डेआईटी ने इसे 2021 में डिस्टिलिशन ट्रिक्स के साथ ठीक किया; डीआईएनओवी 2 ने इसे 2023 में स्थायी रूप से स्व-निरीक्षण के साथ ठीक किया।

```figure
n5-patch-stream
```

## इसे बनाओ

देखो`code/main.py`. शुद्ध-स्टडलिब पैच + रैखिक एम्बेडिंग + मानसिकता जांच. कोई प्रशिक्षण  किसी भी यथार्थवादी पैमाने पर ViT PyTorch और घंटे GPU समय की आवश्यकता होती है.

### चरण 1: नकली छवि

 की पंक्तियों की सूची के रूप में एक 24 × 24 RGB छवि`(R, G, B)`हम 6×6 पैच → 16 पैच, 108-डी एम्बेडिंग वेक्टर प्रत्येक का उपयोग करते हैं।

### चरण 2: पैच करें

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

रेस्टर क्रमः ग्रिड पर पंक्ति-मुख्य। हर ViT इस क्रम का उपयोग करता है।

### चरण 3: रैखिक एम्बेड

प्रत्येक फ्लैट पैच को यादृच्छिक से गुणा करें `(patch_flat_size, d_model)`मैट्रिक्स. आउटपुट आकार की पुष्टि करें `(N_patches + 1, d_model)`प्रपेंडिंग के बाद `[CLS]`. .

### चरण 4: यथार्थवादी वीआईटी के लिए गणना पैरामीटर

ViT-बेस के लिए पैरामीटर गिनती प्रिंट करेंः 12 परतें, 12 सिर, d=768, पैच=16. ResNet-50 (~25M) की तुलना करें। ViT-बेस ~86M पर उतरता है। ViT-Large ~307M। ViT-Huge ~632M।

## इसका प्रयोग करें

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**रीढ़ को फ्रीज करें, एक छोटे सिर को प्रशिक्षित करें। वर्गीकरण, पुनर्प्राप्ति, पता लगाने, कैप्शन के लिए काम करता है। मेटा के DINOv2 चेकपोइंट हर गैर-पाठ दृष्टि कार्य पर CLIP से बेहतर प्रदर्शन करते हैं।

**Patch-size picking.**छोटे मॉडल 16 × 16 (ViT-B/16) का उपयोग करते हैं। घने भविष्यवाणी (विभाजन) 8 × 8 या 14 × 14 (SAM, DINOv2) का उपयोग करता है। बहुत बड़े मॉडल 14 × 14 का उपयोग करते हैं।

## इसे भेजें

देखो`outputs/skill-vit-configurator.md`. कौशल डेटासेट आकार, संकल्प और गणना बजट को देखते हुए एक नए दृष्टि कार्य के लिए एक ViT संस्करण और पैच आकार चुनता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. पट्टियों की संख्या बराबर है की जाँच करें `(H/P) * (W/P)`और सपाट पैच आयाम बराबर है `P*P*C`. .
2. **Medium.**2D सिनोसाइडल स्थिति सम्मिलित करें  दो स्वतंत्र सिनोसाइडल कोड के लिए `row`और `col`प्रत्येक पैच के साथ, एक साथ। उन्हें एक छोटे से PyTorch ViT में खिलाएं और सीआईएफएआर -10 पर सटीकता बनाम सीखने योग्य स्थिति एम्बेडमेंट की तुलना करें।
3. **Hard.**एक 3-परत ViT (PyTorch) बनाएं, 4×4 पैच के साथ 1,000 MNIST छवियों पर प्रशिक्षण दें। परीक्षण की सटीकता मापें। अब उसी 1,000 छवियों पर DINOv2 प्री-प्रशिक्षण जोड़ें (सरलीकृतः बस एन्कोडर को मास्क पैच से पैच एम्बेडमेंट की भविष्यवाणी करने के लिए प्रशिक्षित करें) । क्या सटीकता में सुधार होता है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## आगे पढ़ना

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) वीआईटी पेपर।
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) डेटिटी।
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) स्विन।
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) DINOv2
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) DINOv2 के लिए रजिस्टर-टोकन फिक्स।
