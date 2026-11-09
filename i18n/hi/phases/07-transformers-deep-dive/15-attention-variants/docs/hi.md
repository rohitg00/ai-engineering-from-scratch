# ध्यान वैरिएंट  स्लाइडिंग विंडो, स्पर, डिफरेंशियल

> पूर्ण ध्यान एक वृत्त है. प्रत्येक टोकन प्रत्येक टोकन को देखता है, और स्मृति कीमत का भुगतान करती है. तीन प्रकारों को आकार के वृत्त को मोड़ते हैं और लागत का आधा वापस मिलता है।

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## समस्या

पूर्ण ध्यान की लागत $O(N^2)$स्मृति और $O(N^2)$अनुक्रम लंबाई में गणना करें। 128K-संदर्भ Llama 3 70B के लिए जो प्रति परत 16 बिलियन ध्यान प्रविष्टियों है, गुना 80 परतों। फ्लैश ध्यान (पढ़ना 12) छिपाता है $O(N^2)$सक्रियण स्मृति लेकिन अंकगणितीय लागत को नहीं बदलता  हर टोकन अभी भी हर अन्य टोकन में भाग लेता है।

तीन प्रकार के प्रकार ध्यान मैट्रिक्स की शीर्षिकी को बदलते हैंः

1. **Sliding window attention (SWA).**प्रत्येक टोकन पड़ोसी की एक निश्चित खिड़की पर ध्यान देता है, पूर्ण पूर्वावलोकन नहीं।$O(N \cdot W)$कहाँ$W$Gemma 2/3, मिस्ट्रल 7B की पहली परतों, Phi-3-Long.
2. **Sparse / block attention.**केवल चयनित जोड़े `(i, j)`Longformer, BigBird, OpenAI स्पायर ट्रांसफार्मर।
3. **Differential attention.**अलग Q / K प्रोजेक्शन के साथ दो ध्यान मानचित्रों की गणना करें, एक को दूसरे से घटाएं। "अंतर्वार्ता सिंक" को मारता है जो पहले कुछ टोकन में वजन को रक्तदान करता है। माइक्रोसॉफ्ट का डीआईएफएफ ट्रांसफार्मर (2024).

ये एक साथ रहते हैं। 2026 सीमा मॉडल अक्सर उन्हें मिश्रित करता हैः अधिकांश परतें SWA-1024 हैं, हर पांचवां वैश्विक पूर्ण ध्यान है, और कुछ अंतर सिर हैं जो निकासी को साफ करते हैं। जेम्मा 3 का 5:1 SWA-to-global अनुपात वर्तमान पाठ्यपुस्तक डिफ़ॉल्ट है।

## अवधारणा

### स्लाइडिंग विंडो ध्यान (SWA)

स्थिति पर प्रत्येक क्वेरी $i$केवल पदों पर भाग लेता है $[i - W, i]$(स्रोत SWA) या $[i - W/2, i + W/2]$(दो दिशा में) खिड़की के बाहर टोकन प्राप्त $-\infty$स्कोर मैट्रिक्स में।

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

के लिए$N = 8192$और $W = 1024$, स्कोर मैट्रिक्स में 1024 × 8192 गैर-शून्य पंक्तियाँ हैं जो उम्मीद में हैं  8 × कमी।

**KV cache shrinks with SWA.**केवल अंतिम $W$के और वी के टोकन को प्रति परत रखा जाना चाहिए। एक जेम्मा-3-ish कॉन्फ़िग (1024 विंडो, 128K संदर्भ) के लिए, केवी कैश 128x गिर जाता है।

**Quality cost.**केवल SWA-केवल ट्रांसफार्मर लंबी दूरी की निकासी के साथ संघर्ष करते हैं। फिक्सः पूर्ण-ध्यान परतों के साथ SWA परतों को इंटरलेव करें। जेम्मा 3 5:1 SWA: ग्लोबल का उपयोग करता है। मिस्ट्रल 7 बी ने एक कारण-SWA स्टैक का उपयोग किया जहां सूचना "आगे की ओर बहती है" ओवरलैपिंग विंडो के माध्यम से  प्रत्येक परत प्रभावी रिसेप्टिव फ़ील्ड को बढ़ाता है $W$और उसके बाद`L`स्तरों मॉडल भाग ले सकते हैं `L × W`टोकन वापस.

### स्पायर / ब्लॉक ध्यान

एक चुनें `N × N`समय से पहले स्पायरसिटी पैटर्न। तीन कैनोनिक आकारः

- **Local + strided (OpenAI sparse transformer).**अंतिम तक ध्यान दें $W$टोकन प्लस प्रत्येक `stride`स्थानीय और लंबी दूरी पर दोनों को कैप्चर करता है।$O(N \cdot \sqrt{N})$गणना।
- **Longformer / BigBird.**स्थानीय विंडो + वैश्विक टोकन का एक छोटा सेट (जैसे `[CLS]`) जो सभी के लिए उपस्थित हैं और सभी द्वारा उपस्थित हैं + यादृच्छिक-स्थानिक लिंक। दो गुणा अनुभवजन्य संदर्भ एक समान गुणवत्ता पर।
- **Native Sparse Attention (DeepSeek, 2025).**जानें कि कौन से ब्लॉक `(Q, K)`विषय; नाभिक स्तर पर शून्य ब्लॉक छोड़ दें. फ्लैश ध्यान के साथ संगत.

स्पर ध्यान एक कर्नेल-इंजीनियरिंग कहानी है। गणित सरल है (स्कोर मैट्रिक्स को मास्क करें); जीत SRAM में शून्य प्रविष्टियों को कभी लोड नहीं करने से आती है। फ्लैशएटेंशन -3 और 2026 फ्लेक्सएटेंशन एपीआई PyTorch में कस्टम स्पर पैटर्न प्रथम श्रेणी बनाते हैं।

### अंतर ध्यान (डीआईएफएफ ट्रांसफार्मर, 2024)

नियमित ध्यान में एक "ध्यान सिंक" समस्या हैः सॉफ्टमैक्स प्रत्येक पंक्ति को 1 तक जोड़ने के लिए मजबूर करता है, इसलिए टोकन जो कुछ भी विशेष रूप से ध्यान नहीं देना चाहते हैं, पहले टोकन (या पहले कुछ) पर वजन डंप करते हैं। यह क्षमता चुराता है जो वास्तविक सामग्री में जाना चाहिए था।

अंतर ध्यान गणना द्वारा यह ठीक करता है **two**ध्यान के नक्शे और घटानेः

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

कहाँ$\lambda$A1 वास्तविक सामग्री वजन को कैप्चर करता है; A2 सिंक को कैप्चर करता है। घटाकर सिंक को रद्द करता है, वजन को प्रासंगिक टोकन में पुनः आवंटित करता है।

रिपोर्ट किए गए परिणाम (माइक्रोसॉफ्ट 2024): 510% कम उलझन, 1.52× अधिक प्रभावी संदर्भ, समान प्रशिक्षित लंबाई पर, तेज सुई-इन-शेमस्टैक निकासी।

### भिन्न तुलना

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## इसे बनाओ

देखो`code/main.py`, या उसके Rust पोर्ट`code/main.rs`. रस्ट संस्करण चलाने के लिएः `rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`हम एक कारणात्मक मुखौटा तुलनाकर्ता लागू करते हैं जो खिलौना अनुक्रम पर पूर्ण, एसडब्ल्यूए, स्थानीय+ट्रिड और अंतर ध्यान को एक साथ दिखाता है।

### चरण 1: पूर्ण कारणात्मक मुखौटा (बॉझलाइन)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

पाठ 07 से आधार रेखा। निचला त्रिकोण; विकर्ण से ऊपर शून्य भार।

### चरण 2: स्लाइडिंग विंडो कासियल मास्क

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

एक पैरामीटर  `window`. . के लिए .`window >= n`, आप पूर्ण कारण का ध्यान प्राप्त.`window = 1`, प्रत्येक टोकन केवल अपने आप को ध्यान में रखता है।

### चरण 3: स्थानीय + चरणबद्ध स्पायर मास्क

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

घने स्थानीय खिड़की प्लस प्रत्येक `stride`अनुक्रम की शुरुआत के लिए वापस टोकन. प्राप्त क्षेत्र अतिरिक्त परतों के साथ लॉग चरणों में बढ़ता है.

### चरण 4: अंतर ध्यान

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

दो ध्यान पास, एक सीखा मिश्रण गुणांक के साथ घटाएं. कोड में हम एकल बनाम अंतर के ध्यान-सिंग हीटमैप की तुलना करते हैं और सिंक को गिरते हुए देखते हैं।

### चरण 5: KV कैश आकार

प्रति परत कैश आकार पर प्रिंट करें $N = 131072$प्रत्येक संस्करण के लिए. SWA और दुर्लभ संस्करणों 10 100 × गिर जाता है. अंतर दोगुना. अपने स्मृति बिल का भुगतान करना.

## इसका प्रयोग करें

2026 उत्पादन के पैटर्नः

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ में FlexAttention मास्क फ़ंक्शन स्वीकार करता हैः

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

यह एक कस्टम ट्रिटन कर्नेल में संकलित करता है। सामान्य पैटर्न के लिए फ्लैशएटेंशन -3 गति के 10% के भीतर, और मुखौटा समारोह एक पायथन कॉल करने योग्य है।

**When to pick each:**

- **Pure full attention** प्रत्येक परत ~ 16K संदर्भ तक, या जब पुनर्प्राप्ति गुणवत्ता सबसे महत्वपूर्ण है।
- **SWA + global mix** लंबी संदर्भ (> 32K), प्रशिक्षण और अनुमान स्मृति-बंद। 2026 डिफ़ॉल्ट 32K से ऊपर।
- **Sparse block attention** कस्टम कर्नेल, कस्टम पैटर्न। विशेष कार्यभार (पुनर्प्राप्त, ऑडियो) के लिए आरक्षित।
- **Differential attention** किसी भी कार्यभार पर जहां ध्यान-सिंक प्रदूषण दर्दनाक हो (लंबे संदर्भ में RAG, सुई-इन-हेमस्टैक) ।

## इसे भेजें

देखो`outputs/skill-attention-variant-picker.md`. कौशल एक नए मॉडल के लिए एक ध्यान टॉपॉलजी चुनता है, लक्ष्य संदर्भ लंबाई, निकासी की मांग और प्रशिक्षण/उपयोग गणना प्रोफ़ाइल को देखते हुए।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. SWA पर सत्यापित करें `window=4`प्रत्येक पंक्ति में अंतिम 4 टोकन के बाहर सब कुछ शून्य। सत्यापित करें`window=n`पूर्ण कारण संबंधी ध्यान को बिट-इडेंटिफिक रूप से पुनः प्रस्तुत करता है।
2. **Medium.** के साथ कारणों से SWA लागू करें`window=1024`Lesson 07 के शीर्ष पर. Tinyshakespeare पर 1,000 कदम के लिए प्रशिक्षण. कितना वैल हानि वि पूर्ण ध्यान में गिरावट? कितना पीक स्मृति गिरता है?
3. **Hard.**कैपस्टोन मॉडल में जेम्मा-3-शैली 5:1 परत मिश्रण (5 एसडब्ल्यूए, 1 ग्लोबल) लागू करें। शुद्ध-एसडब्ल्यूए और शुद्ध-ग्लोबल बेसलाइन के साथ मिलान पैरामीटर पर हानि, स्मृति और उत्पादन की गुणवत्ता की तुलना करें।
4. **Hard.**एक शिक्षित के साथ अंतर ध्यान लागू करें $\lambda$प्रति व्यक्ति. एक सिंथेटिक रिट्रीवल टास्क (एक सुई, 2,000 विचलित करने वाले) पर प्रशिक्षण। मिलान पैरामीटर पर एकल ध्यान आधार रेखा के साथ रिट्रीवल सटीकता मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## आगे पढ़ना

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) कैनोनिक स्लाइडिंग विंडो + ग्लोबल टोकन पेपर।
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) स्थानीय + वैश्विक + यादृच्छिक।
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) ओपनएआई का स्थानीय+तरह वाला पैटर्न।
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) 1:1 SWA:ग्लोबल मिक्स।
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) 5 के साथ मिश्रण 5 के साथ खिड़की = 1024 कि अब पाठ्यपुस्तक डिफ़ॉल्ट है.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) डीआईएफएफ ट्रांसफार्मर पेपर।
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) डीपसेक-वी3.2 का सीखा-स्पार्सिटी ध्यान।
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) उपयोग करें में मास्क-जैसे-कॉल करने योग्य पैटर्न के लिए एपीआई संदर्भ।
