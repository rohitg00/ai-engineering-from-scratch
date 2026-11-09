# अनुमानित डिकोडिंग  ड्राफ्ट, सत्यापन, दोहराएं

> ऑटोरेग्रेसिव डिकोडिंग सीरियल है. प्रत्येक टोकन पिछले एक का इंतजार करता है। अटकलबाजी डिकोडिंग श्रृंखला को तोड़ता हैः एक सस्ता मॉडल N टोकन का मसौदा तैयार करता है, महंगा मॉडल एक आगे के पास में सभी N की पुष्टि करता है। जब मसौदा सही होता है तो आप N पीढ़ियों के लिए एक बड़ा आगे का भुगतान करते हैं।

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## समस्या

एक 70B LLM नमूना एक टोकन पर H100 पर ~ 30 ms लेता है. एक 3B ड्राफ्ट मॉडल ~ 3 ms लेता है. यदि हम 3B ड्राफ्ट 5 टोकन आगे जाने दें, तो सभी 5 को सत्यापित करने के लिए 70B * एक बार * चलाएं, कुल $5 \times 3 + 30 = 45$ms के लिए 5 तक स्वीकार किए गए टोकन  बनाम `5×30 = 150 ms`यह पूरी तरह से अनुमानित डिकोडिंग पिच हैः 24 × कम डिकोडिंग विलंबता के लिए अतिरिक्त GPU मेमोरी (ड्राफ्ट मॉडल) की एक छोटी मात्रा का आदान-प्रदान करें।

इस तरह के एक प्रकार का नमूना लेवीयतन और अन्य द्वारा पेश किया गया है (2023) और चेन और अन्य द्वारा एक साथ, यह गारंटी देता है कि आउटपुट अनुक्रम **identically distributed**गुणवत्ता के साथ कोई समझौता नहीं है, बस तेजी से।

चार परिवारों ड्राफ्ट-वेरिफायर जोड़े 2026 अनुमान पर हावी हैंः

1. **Vanilla speculative (Leviathan 2023).**अलग ड्राफ्ट मॉडल (जैसे, Llama 3 1B) + सत्यापनकर्ता (जैसे, Llama 3 70B)
2. **Medusa (Cai 2024).**सत्यापितकर्ता पर कई डिकोडिंग हेड भविष्यवाणी स्थिति `t+1..t+k`समानांतर में. कोई अलग मसौदा मॉडल नहीं.
3. **EAGLE family (Li 2024, 2025).**हल्के ड्राफ्ट जो सत्यापितकर्ता के छिपे हुए राज्यों का पुनः उपयोग करता है; वैनिला की तुलना में अधिक निकट स्वीकृति दर; 34× विशिष्ट।
4. **Lookahead decoding (Fu 2024).**जैकोबी पुनरावृत्ति, कोई ड्राफ्ट मॉडल की आवश्यकता नहीं है, स्व-विचार। Niche लेकिन निर्भरता मुक्त।

2026 में प्रत्येक उत्पादन निष्कर्ष स्टैक डिफ़ॉल्ट रूप से अनुमानित डिकोडिंग जहाजों। vLLM, TensorRT-LLM, SGLang, और llama.cpp सभी कम से कम वैनिला + ईगल-2 का समर्थन करते हैं।

## अवधारणा

### कोर एल्गोरिथ्म

एक सत्यापितकर्ता को देखते हुए $M_q$और सस्ता ड्राफ्ट $M_p$:

1. चलो$x_1 \ldots x_k$पहले से ही डिकोड किया गया पूर्वावचन हो।
2. **Draft**उपयोग $M_p$स्व-निर्धारी प्रस्ताव करने के लिए $d_{k+1}, d_{k+2}, \ldots, d_{k+N}$अनुमानित संभावनाओं के साथ $p_1 \ldots p_N$. .
3. **Verify in parallel**दौड़ना$M_q$एक बार पर $x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, सत्यापनकर्ता संभावनाओं प्राप्त $q_1 \ldots q_{N+1}$पदों के लिए $k+1 \ldots k+N+1$. .
4. **Accept/reject each draft token left to right**: प्रत्येक के लिए $i$, संभावना के साथ स्वीकार $\min(1, q_i(d_i) / p_i(d_i))$. .
5. पद पर पहली अस्वीकृति पर $j$नमूना $t_j$"बाकी" वितरण से $(q_j - p_j)_+$सामान्यीकृत. सभी मसौदा के बाद$j$त्याग दिया जाता है।
6. सब कुछ स्वीकार करने पर$N$: नमूना एक अतिरिक्त टोकन $t_{N+1}$से$q_{N+1}$(मुफ्त बोनस टोकन) ।

शेष वितरण चाल गणितीय अंतर्दृष्टि है जो आउटपुट को वितरित करता है जैसे कि $M_q$शून्य से नमूना लिया था।

### गति को निर्धारित करने वाला क्या है

चलो$\alpha$= प्रति ड्राफ्ट टोकन की अपेक्षित स्वीकृति दर।$c$= ड्राफ्ट-टू-वेरिफायर लागत अनुपात। प्रति चरणः

- भोले पीढ़ी प्रति टोकन एक बड़ा मॉडल कॉल करता है।
- अनुमानित प्रति 1 बड़े मॉडल कॉल करता है$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$टोकन जब $\alpha$उच्च है।

 पर आम नियम$\alpha = 0.75$और $N = 5$: 3 गुना कम बड़े मॉडल कॉल. ड्राफ्ट लागत 5 गुना सस्ता है. कुल दीवार घड़ी ~ 2.5 गुना गिर जाता है.

**$\alpha$ depends on:**

- एक ही परिवार / एक ही प्रशिक्षण डेटा को बढ़ावा देता है$\alpha$महत्वपूर्ण रूप से।
- लोभपूर्ण सत्यापनकर्ता के खिलाफ लोभपूर्ण ड्राफ्टः उच्च $\alpha$. तापमान का नमूनाकरणः मिलान करना कठिन; स्वीकृति में गिरावट
- कार्य प्रकारः कोड और संरचित आउटपुट अधिक (पूर्वानुमानित) स्वीकार करते हैं; मुक्त रूप रचनात्मक लेखन कम स्वीकार करता है।

### मेदुसा  बिना मसौदा मॉडल के मसौदे

मेडुसा सत्यापनकर्ता पर अतिरिक्त आउटपुट हेड के साथ ड्राफ्ट मॉडल की जगह लेती है।`t`:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

प्रत्येक सिर अपने स्वयं के लॉजिट को आउटपुट करता है। निष्कर्ष पर आप उम्मीदवार अनुक्रम प्राप्त करने के लिए प्रत्येक सिर से नमूना लेते हैं, फिर एक आगे पास के साथ सत्यापित करते हैं, एक पेड़-ध्यान योजना का उपयोग करते हुए जो एक ही समय में सभी उम्मीदवारों के निरंतरताओं को विचार करता है।

पेशेवरोंः कोई दूसरा मॉडल नहीं। विपक्षः प्रशिक्षित पैरामीटर जोड़ता है; एक पर्यवेक्षित बारीक-बारी से ट्यूनिंग चरण (~ 1B टोकन) की आवश्यकता होती है; स्वीकृति दर एक अच्छे ड्राफ्ट के साथ वैनिला अटकलों की तुलना में थोड़ा कम है।

### ईगल  छिपे हुए राज्यों का पुनः उपयोग करके बेहतर ड्राफ्ट

ईगल-1/2/3 (लि और अन्य, 20242025) ड्राफ्ट मॉडल को एक छोटा ट्रांसफार्मर (आमतौर पर 1 परत) बनाता है जो सत्यापितकर्ता के अंतिम परत छिपे हुए राज्यों को निगलता है। क्योंकि मसौदा सत्यापितकर्ता की विशेषता प्रतिनिधित्व को देखता है, इसकी भविष्यवाणियां सत्यापितकर्ता के आउटपुट वितरण के साथ दृढ़ता से सहसंबंधित हैं। स्वीकृति दर ~ 0.6 (वैनिला) से बढ़कर 0.85+ हो गई है। ये चैट बेंचमार्क पर प्रति टोकन दरें हैं, जिसमें एक ड्राफ्ट चैट डेटा के मिलान पर प्रशिक्षित है। मिश्रित उत्पादन यातायात पर, चरण 17 · 05 योजनाएं EAGLE-3 के लिए 0.6 से 0.8 के साथ और डोमेन यातायात कम हो सकता है।

ईगल-3 (2025) ने उम्मीदवारों के निरंतरता पर पेड़ खोज को जोड़ा। vLLM और SGLang जहाज ईगल-2/3 Llama 3/4 और Qwen 3 के लिए डिफ़ॉल्ट विनिर्देश पथ के रूप में।

### KV कैश नृत्य

सत्यापन फ़ीड $N$एक आगे पास में सत्यापित करने वाले में टोकन ड्राफ्ट। यह सत्यापित करने वाले केवी कैश को बढ़ाता है $N$प्रविष्टियों. यदि कुछ मसौदा अस्वीकार कर दिया जाता है, तो आप स्वीकार किए गए उपसर्ग लंबाई के लिए कैश वापस रोल करना होगा.

उत्पादन कार्यान्वयन (vLLMs `--speculative-config`यह अवधारणात्मक रूप से कठिन नहीं है, लेकिन यह मुश्किल है। यह एक बहुत ही कठिन है।

```figure
draft-verify-tokens
```

## इसे बनाओ

देखो`code/main.py`हम मूल अनुमानात्मक नमूनाकरण एल्गोरिथ्म (प्रतिषेध चरण + अवशिष्ट वितरण) को लागू करते हैंः

- एक "बड़ा मॉडल" जो हाथ से कोडित वितरण पर एक निर्धारात्मक-मौसम अधिकतम है (तो हम विश्लेषणात्मक रूप से स्वीकृति गणित सत्यापित कर सकते हैं) ।
- एक "ड्राफ्ट मॉडल" जो बड़े मॉडल का एक विघटन है।
- एक स्वीकृति/अस्वीकार लूप जो प्रत्यक्ष नमूना लेने के समान मार्जिनल वितरण का उत्पादन करता है।

`code/main.rs`यह केवल मानक पुस्तकालय का उपयोग करता है। यादृच्छिक संख्याएं पायथन से भिन्न होती हैं, लेकिन मुद्रित निष्कर्ष समान होते हैं।

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### चरण 1: अस्वीकार चरण

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`एक समान यादृच्छिक संख्या है।`q_prob`तैयार टोकन के लिए सत्यापितकर्ता की संभावना है। `p_prob`लेवीयथन प्रमेय यह है कि इस बर्नौली निर्णय, बाद में अस्वीकार पर शेष से नमूना लेने, सत्यापित करने के वितरण को सही ढंग से संरक्षित करता है।

### चरण 2: शेष वितरण

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

घटाएँ `p`से`q`तत्व-wise, शून्य से नकारात्मक मानों को क्लैंप, पुनर्मूल्यांकन. इस पर किसी भी अस्वीकृति पर नमूना.

### चरण 3: एक अनुमानात्मक कदम

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

पांच स्वीकार → एक बोनस → एक सत्यापन पास में उत्पन्न छह टोकन।

### चरण 4: स्वीकार्यता दर का माप

विभिन्न ड्राफ्ट गुणवत्ता स्तरों पर 10,000 अनुमानात्मक चरण चलाएं। ड्राफ्ट और सत्यापनकर्ता वितरण के बीच प्लॉट स्वीकृति दर बनाम KL विचलन। आपको एक स्वच्छ एकांत संबंध देखना चाहिए।

### चरण 5: वितरण समकक्षता की जांच करें

अनुभवजन्य रूप सेः अनुमानित लूप द्वारा उत्पन्न टोकन का हिस्टोग्राम सत्यापितकर्ता से सीधे नमूने निकालने से उत्पन्न हिस्टोग्राम से मेल खाता है। यह व्यवहार में लेवीयतन प्रमेय है। एक चि-क्वायर परीक्षण नमूने निकालने की त्रुटि के भीतर पुष्टि करता है।

## इसका प्रयोग करें

उत्पादनः

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

2026 के मध्य तक टेन्सरआरटी-एलएलएम में मेदुसा का सबसे तेज मार्ग है।`faster-whisper`एक छोटे से ड्राफ्ट के साथ विस्पर-बड़ा के लिए अटकलबाजी डिकोडिंग लपेटता है।

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- 15 टोकन के एकल अनुक्रम पीढ़ी. ओवरहेड हावी है.
- अत्यधिक रचनात्मक / उच्च तापमान नमूनाकरण ($\alpha$बूंदें) ।
- मेमोरी-सीमित तैनाती (ड्राफ्ट मॉडल VRAM जोड़ता है) ।

## इसे भेजें

देखो`outputs/skill-spec-decode-picker.md`. कौशल एक नए निष्कर्ष कार्यभार के लिए एक अनुमानित डिकोडिंग रणनीति (वैनिला / मेदुसा / ईगल / लुकहेड) और समायोजन पैरामीटर (एन, ड्राफ्ट तापमान) चुनता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. पुष्टि करें कि चौरस-पी > 0.05 के भीतर 50,000 टोकन पर सत्यापितकर्ता के प्रत्यक्ष नमूना वितरण के अनुरूप है।
2. **Medium.**प्लॉट स्पीडअप (टोकन प्रति बड़े मॉडल आगे) के रूप में एक समारोह के रूप में $N$के लिए$\alpha = 0.5, 0.7, 0.85$. इष्टतम पहचानें $N$प्रत्येक के लिए $\alpha$. (संकेतः प्रति सत्यापन कॉल अपेक्षित टोकन = $(1 - \alpha^{N+1}) / (1 - \alpha)$.)
3. **Hard.**एक छोटा मेडुसा लागू करेंः पाठ 14 से कैपस्टोन जीपीटी लें, 3 अतिरिक्त एलएम हेड जो टी + 2, टी + 3, टी + 4 की स्थिति की भविष्यवाणी करते हैं। एक संयुक्त मल्टी-हेड हानि के साथ Tinyshakespeare पर ट्रेन करें। उसी मॉडल को ट्रंक करके किए गए वैनिला ड्राफ्ट के साथ स्वीकृति दरों की तुलना करें।
4. **Hard.**रोलबैक लागू करेंः 10 टोकन प्रीफिक्स केवी कैश से शुरू करें, 5 ड्राफ्ट टोकन फ़ीड करें, स्थिति 3 पर अस्वीकृति का अनुकरण करें। अगले पुनरावृत्ति में अपने कैश को सही ढंग से पढ़ते हुए "प्रिफिक्स + पहले 2 स्वीकृत ड्राफ्ट" से मेल खाते हैं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## आगे पढ़ना

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) कोर एल्गोरिथम और समकक्षता प्रमेय।
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) समवर्ती परिचय; साफ बर्नौली-प्रतिषेध प्रमाण।
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) मेडुसा पेपर; पेड़-ध्यान सत्यापन।
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) ईगल-1; छिपा हुआ राज्य-कंडीशनिंग ड्राफ्ट।
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) एग्ल-2; गतिशील वृक्ष गहराई।
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) ईगल-3।
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) नजर रखने वाला, बिना मसौदे के दृष्टिकोण।
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) सभी चार रणनीतियों के साथ कैनोनिक उत्पादन संदर्भ।
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) EAGLE-1/2/3 के लिए संदर्भ कोड।
