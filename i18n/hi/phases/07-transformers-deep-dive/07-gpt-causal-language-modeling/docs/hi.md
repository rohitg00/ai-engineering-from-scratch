# जीपीटी  कारण भाषा मॉडलिंग

> BERT दोनों तरफ देखता है. GPT केवल अतीत को देखता है. त्रिकोण मुखौटा आधुनिक AI में कोड की सबसे महत्वपूर्ण एकल पंक्ति है।

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## समस्या

एक भाषा मॉडल एक प्रश्न का उत्तर देता हैः पहली दी गई `t-1`टोकन, टोकन पर संभावना वितरण क्या है `t`उस संकेत पर अभ्यास करें  अगले टोकन भविष्यवाणी  और आप एक मॉडल प्राप्त कर सकते हैं जो एक समय में एक टोकन के साथ मनमाने पाठ उत्पन्न कर सकता है।

इसे समानांतर में पूरे अनुक्रम पर अंत-से-अंत तक प्रशिक्षित करने के लिए, आपको प्रत्येक स्थिति की भविष्यवाणी केवल पहले की स्थिति पर निर्भर करने की आवश्यकता है। अन्यथा मॉडल उत्तर को देखकर मामूली धोखा देता है।

कारणों का मुखौटा ऐसा करता है. यह एक एकल ऊपरी त्रिकोण मैट्रिक्स है`-inf`ध्यान स्कोर में जोड़े गए मानों softmax से पहले. softmax के बाद, उन पदों को 0 हो जाता है. प्रत्येक स्थिति केवल खुद को और पिछले पदों को ध्यान में रख सकती है. और क्योंकि आप इसे पूरे अनुक्रम पर एक बार लागू करते हैं, आपको एक आगे पास में N समानांतर अगले टोकन भविष्यवाणियां मिलती हैं।

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), क्लाउड, लामा, क्यूवेन, मिस्ट्रल, डीपसेक, किमी  वे सभी एक ही कोर लूप के साथ केवल डिकोडर-कौससल ट्रांसफार्मर हैं। जो उन्हें अलग करता है वह डेटा गुणवत्ता, पैमाने और वास्तुकला परिष्करण, और पोस्ट-ट्रेनिंग (SFT, RLHF, DPO, और उनके उत्तराधिकारी) है।

## अवधारणा

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### मास्क

लंबाई की एक अनुक्रम को देखते हुए $N$, एक निर्माण$N \times N$मैट्रिक्सः

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

जोड़ें `M`softmax से पहले कच्चे ध्यान स्कोर पर। $\exp(-\infty) = 0$ध्यान मैट्रिक्स की प्रत्येक पंक्ति केवल पिछले स्थानों पर एक संभावना वितरण है।

कार्यान्वयन लागतः एक `torch.tril()`कॉल. समय गणनाः नैनोसेकंड. क्षेत्र पर प्रभावः सब कुछ.

### जहां से त्रिकोण आता है

मुखौटा आमतौर पर ध्यान पर एक पैच के रूप में प्रस्तुत किया जाता है। व्युत्पन्न को दूसरी दिशा में चलाएं और यह रहस्यमय होना बंद कर देता हैः ध्यान एक पूर्वावलोकन औसत का तीसरा परिष्करण है, और त्रिकोण उस औसत की लूप सीमाएं हैं, जो मैट्रिक्स के रूप में लिखी जाती हैं।

**Stage 1 — prefix average.**एक अनुक्रम के सबसे बेवकूफ कारण सारांशः स्थिति $i$पदों का औसत बन जाता है $0 \ldots i$. एक लूप के रूप में, यह है `out[i] = X[:i+1].mean(0)`. एक ही गणना एक मैट्रिक्स गुणा है. एक से एक के निचले त्रिकोण मैट्रिक्स ले लो, उसकी गिनती से प्रत्येक पंक्ति को विभाजित, गुणाः

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

पंक्ति $i$$A$है $[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$भविष्य के बारे में कुछ भी छिपाया नहीं गया था; भविष्य कभी भी योग में नहीं था।

**Stage 2 — learned weights.**एक समान औसत पिछले टोकन के रूप में समान रूप से प्रासंगिक के रूप में व्यवहार करता है। एक सीखा स्कोर मैट्रिक्स के साथ उन लोगों की जगह`S`. अब पंक्तियों का निर्माण द्वारा एक से जोड़ नहीं है, इसलिए गिनती द्वारा विभाजित करने के बजाय प्रत्येक पंक्ति को सॉफ्टमैक्स के साथ सामान्य बनाएं। सॉफ्टमैक्स कभी भी सटीक शून्य का उत्पादन नहीं करता है, जो कारणों से संबंध को तोड़ता है  जब तक भविष्य के स्कोर में नहीं जाते `-inf`, क्योंकि `exp(-inf) = 0`:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

एक ही त्रिकोण, एक ही पंक्ति-स्टोकैस्टिक मैट्रिक्स, एक ही matmul.`-inf`मास्क नई मशीनरी नहीं है यह चरण 1 शून्य प्रविष्टियों है, softmax के इनपुट डोमेन में अनुवादित।

**Stage 3 — content-dependent weights.**चरण 2 में, `S`प्रशिक्षण के बाद तय किया जाता हैः स्थिति 7 हमेशा स्थिति 3 के समान वजन, जो भी टोकन कहते हैं। स्कोर खुद टोकन पर निर्भर करते हैंः `S = Q @ K.T / sqrt(d_k)`मास्क, सॉफ्टमैक्स, मत्मूल  समान हैं।

तीन चरण, एक अपरिवर्तनीयः निचले त्रिकोण-पंक्ति-स्टोकैस्टिक मैट्रिक्स अनुक्रम से गुणा। समान औसत, सीखे गए स्थैतिक वजन, सामग्री-निर्भर वजन। मास्क को ध्यान में कभी नहीं जोड़ा गया। यह औसत से जीवित रहा।

```figure
mask-derivation
```

### समानांतर प्रशिक्षण, धारावाहिक निष्कर्ष

प्रशिक्षणः आगे-पास पूरे `(N, d_model)`अनुक्रम एक बार, गणना N क्रॉस-एंट्रोपी हानि (एक प्रति स्थिति), योग, बैकप्रॉप. अनुक्रम के साथ समानांतर. यही कारण है कि जीपीटी प्रशिक्षण पैमाने  आप एक GPU पास में एक बैच में 1M टोकन को संसाधित करते हैं।

तर्कः आप टोकन द्वारा टोकन उत्पन्न करते हैं. फ़ीड `[t1, t2, t3]`, जाओ`t4`. फ़ीड `[t1, t2, t3, t4]`, जाओ`t5`. फ़ीड `[t1, t2, t3, t4, t5]`, जाओ`t6`. KV कैश (पाठ 12) `t1…tn`तो आप उन्हें हर कदम को फिर से गणना नहीं करते हैं. लेकिन सिरीयल गहराई पर निष्कर्ष = आउटपुट लंबाई. यह autoregressive कर है और क्यों डिकोडिंग हर LLM की विलंबता bottleneck है.

### नुकसान  शिफ्ट-दर-एक

दिए गए टोकन `[t1, t2, t3, t4]`:

- इनपुटः `[t1, t2, t3]`
- लक्ष्य: `[t2, t3, t4]`

हर पद के लिए `i`, गणना `-log P(target_i | inputs[:i+1])`सारांश. यह पूरे अनुक्रम के लिए क्रॉस-एंट्रोपी है.

प्रत्येक ट्रांसफार्मर LM आप इस हानि पर ट्रेनों के बारे में सुना है. पूर्व प्रशिक्षण, ठीक-ट्यूनिंग, एसएफटी  एक ही हानि, अलग डेटा.

### डिकोडिंग रणनीतियाँ

प्रशिक्षण के बाद, लोगों के विचार से अधिक नमूना लेने का विकल्प महत्वपूर्ण है।

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

2026 में, min-p + तापमान 0.7 खुले-वजन मॉडल के लिए एक उचित डिफ़ॉल्ट है। अनुमानात्मक डिकोडिंग किसी भी उत्पादन निष्कर्ष स्टैक के लिए टेबल दांव है।

### "जीपीटी नुस्खा" का काम करने का कारण क्या था

1. **Decoder-only.**कोई एन्कोडर ओवरहेड. ध्यान एक पास + FFN प्रति परत.
2. **Scaling.**124M → 1.5B → 175B → ट्रिलियन. चिंचिला स्केलिंग के नियम (पाठ 13) आपको बताता है कि गणना कैसे खर्च करें।
3. **In-context learning.**6B13B के आसपास उभरा। मॉडल बिना ठीक से ट्यून किए कुछ शॉट उदाहरणों का पालन कर सकता है।
4. **RLHF.**मानव वरीयताओं पर पोस्ट-शिक्षण कच्चे पूर्व-शिक्षित पाठ को चैट सहायकों में परिवर्तित किया।
5. **Pre-norm + RoPE + SwiGLU.**स्थिर प्रशिक्षण पैमाने पर।

जीपीटी-2 के बाद से मूल वास्तुकला में ज्यादा बदलाव नहीं आया है। डेटा, स्केल और पोस्ट-ट्रेनिंग में कुछ भी दिलचस्प हुआ है।

```figure
causal-mask
```

## इसे बनाओ

### चरण 1: कारणात्मक मुखौटा

देखो`code/main.py`एक लाइनर:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

इसे सॉफ्टमैक्स से पहले ध्यान स्कोर में जोड़ें।

### चरण 2: दो परतों का जीपीटी-शैक्षिक मॉडल

दो डिकोडर ब्लॉक स्टैक करें (मास्किंग स्व-अतक्षणा + FFN, कोई क्रॉस-अतक्षणा नहीं) । एक टोकन एम्बेडिंग, एक स्थिति एन्कोडिंग और एक अनइम्बेडिंग जोड़ें (टोकन एम्बेडिंग मैट्रिक्स से बंधा हुआ  एक मानक ट्रिक GPT-2 के बाद से) ।

### चरण 3: अगले टोकन भविष्यवाणी, अंत से अंत

20 टोकन खिलौना शब्दावली पर, प्रत्येक स्थिति पर लॉजिट उत्पन्न करें। शिफ्ट-टू-वन लक्ष्य के खिलाफ क्रॉस-एंट्रोपी हानि की गणना करें। कोई ग्रेडिएंट नहीं  यह आगे-पास सेहत जांच है।

### चरण 4: नमूनाकरण

लोभ, तापमान, शीर्ष-के, शीर्ष-पी, मिन-पी लागू करें. प्रत्येक को एक निश्चित संकेत पर चलाएं और आउटपुट की तुलना करें। एक नमूना फ़ंक्शन 10 पंक्तियों है।

## इसका प्रयोग करें

पायटॉर्च, 2026 भाषाः

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

हुड के नीचे,`generate()`आगे की पास चलाता है, अंतिम स्थिति लॉजिट खींचता है, अगले टोकन का नमूना लेता है, इसे जोड़ता है, और दोहराता है। प्रत्येक उत्पादन एलएलएम निष्कर्ष स्टैक (वीएलएलएम, टेंसरआरटी-एलएलएम, लामा.सीपीपी, ओल्मा, एमएलएक्स) भारी अनुकूलन के साथ एक ही लूप को लागू करता है  बैच प्रीफिल, निरंतर बैचिंग, केवी कैश पेगिंग, अटकल डिकोडिंग।

**GPT vs BERT, one line each:**जीपीटी भविष्यवाणी $P(x_t \mid x_{<t})$. BERT भविष्यवाणी $P(x_{\text{masked}} \mid x_{\text{unmasked}})$. हानि यह निर्धारित करती है कि मॉडल उत्पन्न कर सकता है या नहीं.

## इसे भेजें

देखो`outputs/skill-sampling-tuner.md`. कौशल नई पीढ़ी के कार्य के लिए नमूना लेने के मापदंडों का चयन करता है और निर्धारात्मक डिकोडिंग की आवश्यकता होने पर संकेत देता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`और जांचें कि सॉफ्टमैक्स के बाद कारण संबंधी ध्यान मैट्रिक्स निचले त्रिकोणात्मक है। स्पॉट-चेकः पंक्ति 3 में केवल कॉलम 03 में वजन होना चाहिए।
2. **Medium.**चौड़ाई के लिए बीम खोज लागू करें 4. 10 छोटे संकेतों पर बीम-4 बनाम लालची की उलझन की तुलना करें। क्या बीम हमेशा जीतता है? (संकेतः आमतौर पर अनुवाद के लिए, खुले अंत चैट के लिए नहीं) ।
3. **Hard.**अनुमानात्मक डिकोडिंग लागू करेंः ड्राफ्ट के रूप में एक छोटा 2-परत मॉडल और सत्यापनकर्ता के रूप में एक 6-परत मॉडल का उपयोग करें। लंबाई के 100 पूर्णताओं पर दीवार-घड़ी गति मापें 64. सत्यापन आउटपुट सत्यापनकर्ता की लालच से मेल खाते हैं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## आगे पढ़ना

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) जीपीटी-1
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) जीपीटी-2।
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) जीपीटी-3 और संदर्भ में सीखने।
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) स्पेसिफिकेशन डिकोडिंग पेपर।
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) कैनोनिक कारण-LM संदर्भ कोड।
