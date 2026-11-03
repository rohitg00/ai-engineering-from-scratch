# अनुमानित डिकोडिंग और ईगल

> एक टोकन उत्पन्न करने वाले एक सीमांत LLM को अरबों मापदंडों पर पूर्ण अग्रिम पास की आवश्यकता होती है। यह आगे की पास भारी मात्रा में अधिक आपूर्ति हैः ज्यादातर समय एक बहुत छोटे मॉडल अगले 3-5 टोकन सही ढंग से अनुमान लगा सकता है, और बड़े मॉडल को केवल अनुमान को * सत्यापित करने की आवश्यकता है। जब अनुमान सही है आप एक की कीमत के लिए 5 टोकन है. अनुमानित डिकोडिंग (लेवीयतन और अन्य। 2023) ने यह सटीक किया, और EAGLE-3 (2025) ने स्वीकार्यता दरों को ~4.5 टोकन प्रति सत्यापित करने के लिए बढ़ाया  एक मेल खाने वाले आउटपुट वितरण पर 4-5x गति।

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## समस्या

H100 पर 70B वर्ग के मॉडल के लिए डिकोड आउटपुट आमतौर पर 40-80 टोकन / सेकंड होता है। प्रत्येक टोकन को HBM से सभी मॉडल वजन को पढ़ने के लिए एक पूर्ण फॉरवर्ड पास की आवश्यकता होती है। आप इसके आउटपुट को बदलने के बिना मॉडल को छोटा नहीं कर सकते। आप मेमोरी से परे बैच आकार नहीं बढ़ा सकते। आप  पर अटक गए हैं जब तक आप मॉडल को प्रति फॉरवर्ड पास एक से अधिक टोकन आउटपुट नहीं दे सकते।

ऑटोरेग्रेसिव पीढ़ी स्वाभाविक रूप से धारावाहिक दिखती हैः`x_{t+1} = sample(p(· | x_{1:t}))`. लेकिन एक समवर्ती अवसर है. अगर आपके पास एक सस्ता भविष्यवाणी है जो कहती है "अगले 4 टोकन शायद [ए, बी, सी, डी]" आप एक में सभी 5 पदों की पुष्टि कर सकते हैं **single forward pass of the big model**और सबसे लंबे मिलान उपसर्ग स्वीकार करें।

लेवीयथन, कलाई, मटियास (2023, "स्पेक्लूटिव डिकोडिंग के माध्यम से ट्रांसफार्मर से फास्ट इन्फरेंस") ने एक स्मार्ट स्वीकार / अस्वीकार नियम के माध्यम से यह सटीक किया जो लक्ष्य मॉडल के नमूने वितरण को संरक्षित करता है। वही आउटपुट वितरण, 2-4x तेज़।

## अवधारणा

### दो मॉडल सेटअप

- **Target model** `M_p`: बड़े, धीमे, उच्च गुणवत्ता वाले मॉडल आप वास्तव में नमूने चाहते हैं से. वितरणः `p(x)`. .
- **Draft model** `M_q`: एक छोटा, तेज, कम गुणवत्ता वाला मॉडल। वितरणः `q(x)`. 5-30 गुना छोटे.

प्रति चरण:

1. प्रारूप मॉडल प्रस्ताव `K`टोकन ऑटोरेग्रेसिव रूप सेः `x_1, x_2, ..., x_K ~ q`. .
2. लक्ष्य मॉडल सभी पर एक आगे पास चलाता है `K+1`समानांतर स्थितियों में, उत्पादन `p(x_k)`प्रत्येक प्रस्तावित टोकन के लिए।
3. नीचे दिए गए संशोधित अस्वीकृति-सैंपलिंग नियम के माध्यम से प्रत्येक टोकन को बाएं से दाएं स्वीकार/ अस्वीकार करें। सबसे लंबे मिलान पूर्ववर्ती को स्वीकार करें।
4. यदि कोई टोकन अस्वीकार कर दिया जाता है, तो सही वितरण से प्रतिस्थापन का नमूना लें और रोकें। अन्यथा `p(· | x_1...x_K)`. .

यदि ड्राफ्ट लक्ष्य से सही ढंग से मेल खाता है, तो आपको प्रति लक्ष्य-आगे के लिए K + 1 टोकन मिलता है। यदि ड्राफ्ट स्थिति 1 पर गलत है, तो आपको केवल 1 टोकन मिलता है।

### सटीकता नियम

अनुमानित डिकोडिंग है **provably equivalent in distribution to sampling from p**. अस्वीकार नियमः

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

कहाँ`(p - q)+`बिंदुओं के अंतर का सकारात्मक भाग दर्शाता है। जब मसौदा और लक्ष्य सहमत होते हैं (`p ≈ q`) स्वीकृति लगभग 1 है। जब वे असहमत होते हैं, तो शेष वितरण का निर्माण किया जाता है ताकि समग्र नमूना अभी भी सटीक हो।`p`. .

**Greedy case.**तापमान=0 के लिए नमूना लेने के लिए बस जांच `argmax(p) == x_t`यदि हां, तो स्वीकार करें; यदि नहीं, तो आउटपुट`argmax(p)`और रुक जाओ.

### अपेक्षित गति

यदि मसौदा मॉडल के टोकन स्तर पर स्वीकृति दर `α`, प्रति लक्ष्य-अग्रिम पास उत्पन्न होने वाले अपेक्षित टोकन निम्न हैंः

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

`α = 0.8, K = 4``(1 - 0.8^5)/(1 - 0.8) = 3.36`प्रति अग्रिम टोकन। एक एकल लक्ष्य अग्रिम लागत लगभग `cost_q * K + cost_p`(के ड्राफ्ट स्टेप्स प्लस एक लक्ष्य सत्यापन) यदि `cost_p >> cost_q * K`गति अनुपात `3.36× / 1 = 3.36×`संचलन पर।

एकमात्र वास्तविक पैरामीटर है `α`एक अच्छा मसौदा सब कुछ है।

### ड्राफ्ट को प्रशिक्षित करनाः डिस्टिलिशन

एक यादृच्छिक छोटे मॉडल एक खराब ड्राफ्ट बनाता है। मानक नुस्खा लक्ष्य से डिस्टिल करने के लिए हैः

1. एक छोटे वास्तुकला चुनें (70B लक्ष्य के लिए ~1B, 7B लक्ष्य के लिए ~500M) ।
2. लक्ष्य मॉडल को एक बड़े पाठ कॉर्पस पर चलाएं; उसके अगले टोकन वितरण को स्टोर करें।
3. लक्ष्य वितरण के खिलाफ (भू-सत्य टोकन के खिलाफ नहीं) के साथ KL विचलन के साथ ड्राफ्ट को प्रशिक्षित करें।

परिणाम: `α`आमतौर पर 0.6-0.8 कोडिंग पर, 0.7-0.85 प्राकृतिक भाषा चैट पर. उत्पादन में 2-3x गति।

### ईगलः पेड़ का चित्रण + विशेषता पुनः उपयोग

ली, वेई, झांग, झांग (2024, "एगेलः अनुमानात्मक नमूनाकरण को फीचर अनिश्चितता को पुनर्विचार करने की आवश्यकता होती है") ने मानक अनुमानात्मक डिकोडिंग में दो अक्षमताओं का निरीक्षण कियाः

1. मसौदा K सीरियल चरणों, प्रत्येक पूर्ण स्टैक करता है। लेकिन मसौदा लक्ष्य की विशेषताओं (छिपे हुए राज्यों) को नवीनतम सत्यापित कर सकता है।
2. ड्राफ्ट एक रैखिक श्रृंखला का उत्पादन करता है। यदि ड्राफ्ट उम्मीदवारों का एक *tree* (प्रत्येक नोड कई अनुमान) आउटपुट कर सकता है, तो लक्ष्य का एकल आगे पास पेड़ ध्यान मास्क के माध्यम से समानांतर में कई उम्मीदवार पथों की जांच कर सकता है, और सबसे लंबी स्वीकार की गई शाखा चुन सकता है।

ईगल-1 परिवर्तनः
- ड्राफ्ट इनपुट = लक्ष्य की अंतिम छिपी स्थिति स्थिति t पर, कच्चे टोकन नहीं।
- ड्राफ्ट आर्किटेक्चर = 1 ट्रांसफार्मर डिकोडर लेयर (अलग छोटे मॉडल नहीं) ।
- आउटपुट = पेड़ K = 4-8 उम्मीदवार प्रति गहराई, गहराई 4-6।

ईगल-2 (2024) में एक गतिशील वृक्ष टोपोलॉजी जोड़ी गई हैः पेड़ व्यापक होता है जहां रेखाचित्र अनिश्चित है और संकीर्ण रहता है जहां यह आश्वस्त है।`α_effective`सत्यापन लागत में वृद्धि के बिना।

ईगल-3 (Li et al. 2025 में, "एजीएल-3: प्रशिक्षण-समय परीक्षण के माध्यम से बड़े भाषा मॉडल के इन्फेरेंस त्वरण को स्केल करना") निश्चित शीर्ष-स्तर सुविधा निर्भरता को हटा देता है और एक नए "परीक्षण-समय अनुकरण" हानि के साथ ड्राफ्ट को प्रशिक्षित करता है। स्वीकृति दर 0.75 (EAGLE-2) से 0.82 (EAGLE-3) तक बढ़ जाती है, और औसत टोकन/जाँच 3.0 से 4.5 तक बढ़ जाती है। ये आंकड़े एक संदर्भ सेटअप से आते हैं। स्वीकार्यता मॉडल जोड़े, ड्राफ्ट ट्री और ट्रैफ़िक पर निर्भर करती हैः चैट बेंचमार्क पर स्वीकार किए गए पथ टोकन पर चरण 10 · 15 0.88 से 0.92 को उद्धृत करता है, और चरण 17 · 05 योजनाओं पर 0.6 से 0.8 के साथ उत्पादन सामान्य चैट पर।

### पेड़ ध्यान सत्यापन

जब मसौदा एक पेड़ को आउटपुट करता है, तो लक्ष्य मॉडल एक **tree attention mask** एक कारण का मुखौटा जो एक शुद्ध रेखा के बजाय पेड़ की टोपोलॉजी को एन्कोड करता है। प्रत्येक टोकन केवल पेड़ में अपने पूर्वजों की सेवा करता है। सत्यापित पास अभी भी एक आगे है, एक मत्मुल; टोपोलॉजिकल मास्क की लागत केवल कुछ अतिरिक्त KV प्रविष्टियां है।

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

यदि`a, b`प्रथम टोकन उम्मीदवारों के साथ प्रतिस्पर्धा कर रहे हैं और `c, d, e, f`दूसरे टोकन उम्मीदवार हैं, सभी छह पदों को एक आगे पास में सत्यापित किया जाता है। आउटपुट किसी भी स्वीकार किए गए पथ के साथ सबसे लंबा पूर्वावलोकन है।

### जब यह जीतता है, जब यह नहीं जीतता है

**Wins:**
- अनुमानित पाठ (कोड, सामान्य अंग्रेजी, संरचित आउटपुट) के साथ चैट / समापन। `α`उच्च है।
- डिकोडिंग के दौरान अप्रयुक्त GPU गणना (मेमोरी-बाउंड चरण) के साथ सेटिंग्स। पेड़ ड्राफ्टिंग उपलब्ध FLOPs का उपयोग करता है।

**Loses / no win:**
- उच्च तापमान पर रचनात्मक लेखन (उच्च तापमान पर रचनात्मक लेखन) ।`α``1/|vocab|`. .
- बहुत उच्च समवर्तीता के साथ बैच सेवा  बैचिंग पहले से ही FLOPs को भरती है, पेड़ सत्यापन के लिए बहुत कम जगह है।
- बहुत छोटे लक्ष्य मॉडल जहां ड्राफ्ट बहुत छोटा नहीं है।

उत्पादन दुकानें आमतौर पर चैट पर 2-3x वॉल क्लॉक स्पीडअप, कोड जनरेशन पर 3-5x और रचनात्मक लेखन पर लगभग शून्य रिपोर्ट करती हैं।

```figure
speculative-decoding
```

## इसे बनाओ

`code/main.py`:

- एक संदर्भ `speculative_decode(target, draft, prompt, K, temperature)`जो सटीक अस्वीकृति नियम को लागू करता है और यह सत्यापित करता है कि यह लक्ष्य के वितरण को संरक्षित करता है (प्रायोगिक KL < 0.01 बनाम सादा लक्ष्य नमूनाकरण) ।
- एक एग्ल शैली के पेड़ का ड्राफ्टर जो शीर्ष-पी शाखाओं के साथ एक गहराई-के पेड़ बनाता है।
- एक पेड़ ध्यान मुखौटा निर्माता जो एक सत्यापनकर्ता के लिए सही कारण पैटर्न का उत्पादन करता है।
- एक स्वीकृति दर के हार्नेस जो दोनों को एक छोटे से LM पर चलाता है (जीपीटी-2-मध्यम लक्ष्य से एक GPT-2-छोटे को डिस्टिल करें) ।

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## इसका प्रयोग करें

- **vLLM**और **SGLang**VLLM में, पास `--speculative-config` के साथ एक JSON वस्तु`method`,`model`और `num_speculative_tokens`; ईगल-3 है `"method": "eagle3"`. .
- **NVIDIA TensorRT-LLM**मेदुसा और ईगल के पेड़ों का मूल रूप से समर्थन करता है।
- **Reference draft models**`Qwen/Qwen3-0.6B`(Qwen3-32B के मसौदे), `meta-llama/Llama-3.2-1B-Instruct`(लामा 3.x 70B के मसौदे) ।
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): एक मसौदा मॉडल के बजाय, लक्ष्य के लिए K समानांतर भविष्यवाणी के सिर जोड़ें। तैनात करने के लिए सरल, EAGLE की तुलना में थोड़ा कम स्वीकृति।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-speculative-tuning.md` एक कौशल जो लक्ष्य मॉडल के कार्यभार का प्रोफाइल बनाता है और चुनता हैः ड्राफ्ट मॉडल, K (ड्राफ्ट लंबाई), पेड़ की चौड़ाई, तापमान, और कब वापस सामान्य डिकोड में गिरना है।

## व्यायाम

1. सही अस्वीकृति नियम लागू करें और अनुभवजन्य रूप से इसकी पुष्टि करें।`speculative_decode`और सादे लक्ष्य नमूनाकरण के माध्यम से; दो आउटपुट वितरणों के बीच टीवी दूरी की गणना करें। < 0.01 होना चाहिए।

2. गति सूत्र की गणना करें।`α`और `K`, प्रति लक्ष्य आगे के लिए अपेक्षित टोकन का ग्राफ। इष्टतम खोजें $K$के लिए$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$. .

3. एक छोटे से ड्राफ्ट को प्रशिक्षित करें, 124M GPT-2 लक्ष्य ले लो और KL हानि के साथ 100M टोकन पर 30M GPT-2 ड्राफ्ट को डिस्टिल करें।`α`अपेक्षितः 0.6-0.7.

4. ईगल शैली के पेड़ के ड्राफ्टिंग को लागू करें। श्रृंखला के बजाय, प्रत्येक गहराई पर ड्राफ्ट आउटपुट शीर्ष 3 शाखाओं को रखें। पेड़ ध्यान मास्क बनाएं। लक्ष्य को सबसे लंबी सही शाखा स्वीकार करता है।

5. विफलता मोड मापें. तापमान=1.5 (उच्च स्टोकास्टिकता) पर अनुमानित डिकोड चलाएं। दिखाएं α को collapses और एल्गोरिदम ड्राफ्ट ओवरहेड के कारण सादे डिकोड से धीमा है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## आगे पढ़ना

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) सटीक अस्वीकार नियम और सैद्धांतिक गति विश्लेषण
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) डीपमाइंड में समवर्ती अनुमानात्मक नमूनाकरण पेपर
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) समानांतर सिरों के साथ एक प्रारूप मॉडल का विकल्प
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) सुविधाओं का पुनः उपयोग और वृक्षों का निर्माण
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) गतिशील वृक्ष टोपोलॉजी
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) ट्रेन-समय परीक्षण-समय मिलान
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) जैकोबी/लुकाहेड डिकोडिंग, एक अटकलबाज मुक्त विकल्प
