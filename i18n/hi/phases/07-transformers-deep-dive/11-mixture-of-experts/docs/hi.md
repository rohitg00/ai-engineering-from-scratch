# विशेषज्ञों का मिश्रण (एमओई)

> एक घने 70B ट्रांसफार्मर प्रत्येक टोकन के लिए प्रत्येक पैरामीटर को सक्रिय करता है। एक 671B MoE केवल 37B प्रति टोकन को सक्रिय करता है और इसे प्रत्येक बेंचमार्क पर हराता है। Sparsity दशक का सबसे महत्वपूर्ण स्केलिंग विचार है।

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## समस्या

एक घने ट्रांसफार्मर के FLOPs का अनुमान उसके पैरामीटर की गिनती के बराबर है (आगे के पास के लिए 2 गुना) । एक घने मॉडल को स्केल करें और प्रत्येक टोकन पूर्ण बिल का भुगतान करता है। 2024 तक सीमा एक कंप्यूटिंग दीवार को हिट कर रही थीः सार्थक रूप से स्मार्ट होने के लिए, आपको प्रति टोकन में तेजी से अधिक FLOPs की आवश्यकता थी।

विशेषज्ञों के मिश्रण इस लिंक को तोड़ता है। प्रत्येक FFN को बदलकर $E$स्वतंत्र विशेषज्ञ + एक राउटर जो चुनता है $k$प्रति टोकन विशेषज्ञ। कुल मापदंड = $E \times \text{FFN size}$. प्रति टोकन सक्रिय पैरामीटर = $k \times \text{FFN size}$. 2026 की विशिष्ट संरचना: $E=256$,$k=8$.  के साथ भंडारण स्केल$E$, के साथ गणना पैमाने$k$. .

2026 की सीमा लगभग पूरी तरह से एमओई हैः डीपसेक-वी 3 (671 बी कुल / 37 बी सक्रिय), मिक्स्ट्रल 8 × 22 बी, क्यूवेन 2.5-एमओई, लामा 4, किमी के 2, जीपीटी-ओएस। कृत्रिम विश्लेषण के स्वतंत्र लीडरबोर्ड पर, शीर्ष 10 ओपन-सोर्स मॉडल सभी एमओई हैं।

## अवधारणा

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### एफएफएन स्वैप

घने ट्रांसफार्मर ब्लॉकः

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

मोई ब्लॉकः

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

प्रत्येक विशेषज्ञ एक स्वतंत्र FFN (आमतौर पर SwiGLU) है। राउटर एक एकल रैखिक परत है। प्रत्येक टोकन अपना खुद का चुनता है।`k`विशेषज्ञों और उनके आउटपुट के एक बंद मिश्रण मिलता है।

### भार संतुलन समस्या

यदि रूटर एक्सपर्ट 3 के माध्यम से 90% टोकन डालता है, तो अन्य विशेषज्ञों को भूख लगती है। तीन फिक्स की कोशिश की गई हैः

1. **Auxiliary load-balancing loss**(स्विच ट्रांसफार्मर, मिक्स्ट्रल) विशेषज्ञ उपयोग में भिन्नता के अनुरूप एक दंड जोड़ें। काम करता है, लेकिन एक हाइपरपैरामीटर और एक दूसरे ग्रेडिएंट संकेत जोड़ता है।
2. **Expert capacity + token dropping**(प्रारंभिक स्विच) प्रत्येक विशेषज्ञ प्रक्रियाओं के अधिकतम $C \times N/E$टोकन, ओवरफ्लो टोकन परत को छोड़ दें। गुणवत्ता को नुकसान पहुंचाता है।
3. **Auxiliary-loss-free balancing**(DeepSeek-V3) एक सीखा प्रति विशेषज्ञ पूर्वाग्रह जो रूटर के शीर्ष-के चयन को स्थानांतरित करता है जोड़ें। पूर्वाग्रह प्रशिक्षण हानि के बाहर अद्यतन किया जाता है। मुख्य उद्देश्य पर कोई दंड नहीं। 2024 का बड़ा अनलॉक।

डीपसेक-वी३ का दृष्टिकोणः प्रत्येक प्रशिक्षण चरण के बाद, प्रत्येक विशेषज्ञ के लिए, जांचें कि इसका उपयोग लक्ष्य से ऊपर या नीचे है।`±γ`. चयन उपयोग `scores + bias`. गेटिंग के लिए प्रयोग विशेषज्ञ संभावनाओं कच्चे हैं `scores`अपरिवर्तित. अभिव्यक्ति से रूटिंग डिकूपल्स.

### साझा विशेषज्ञ

डीपसईक-वी 2 / वी 3 विशेषज्ञों को *शेयर किया गया* और *रूट किया गया* में भी विभाजित करता है। प्रत्येक टोकन सभी साझा विशेषज्ञों के माध्यम से गुजरता है। रूट किए गए विशेषज्ञों को शीर्ष-के के माध्यम से चुना जाता है। साझा विशेषज्ञ सामान्य ज्ञान को कैप्चर करते हैं; रूट किए गए विशेषज्ञ विशेषज्ञ विशेषज्ञ हैं। वी 3 1 साझा विशेषज्ञ और 256 रूट किए गए शीर्ष-8 को चलाता है।

### बारीक अनाज विशेषज्ञ

क्लासिक एमओई (जीशार्ड, स्विच): प्रत्येक विशेषज्ञ एक पूर्ण एफएफएन के समान व्यापक है। `E`छोटा है (864), `k`छोटा है (12).

आधुनिक बारीक-अमल वाली एमओई (डीपसेक-वी3, क्यूवेन-एमओई): प्रत्येक विशेषज्ञ संकीर्ण है (1/8 एफएफएन आकार) । $E$बड़ा है (256+), $k$समान कुल मापदंड, लेकिन संयोजन बहुत तेजी से पैमाने पर है। $\binom{256}{8} \approx 400$प्रत्येक टोकन पर संभावित "विशेषज्ञ" ट्रिलियन। गुणवत्ता बढ़ जाती है, विलंबता स्थिर रहती है।

### लागत प्रोफ़ाइल

प्रति टोकन, प्रति परतः

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

डीपसेक-वी3 लगभग हर बेंचमार्क पर Llama 3 70B को हराता है।**fewer active FLOPs per token**अधिक पैरामीटर = अधिक ज्ञान। अधिक सक्रिय FLOPs = प्रति टोकन अधिक गणना। MoE उन्हें डिपॉर्सेड करता है।

### कैचः स्मृति

सभी विशेषज्ञों को GPU पर रहने की आवश्यकता होती है, चाहे कोई भी फ़ायर हो। एक 671B मॉडल को fp16 वजन के लिए ~ 1.3 TB VRAM की आवश्यकता होती है। फ्रंटियर MoE तैनाती के लिए विशेषज्ञ समानांतरता की आवश्यकता होती है।

```figure
expert-routing
```

## इसे बनाओ

देखो`code/main.py`. शुद्ध स्टडलिब में एक कॉम्पैक्ट एमओई परत जिसमेंः

- `n_experts=8`SwiGLU-ish विशेषज्ञ (हर एक रैखिक, उदाहरण के लिए)
- शीर्ष-k=2 रूटिंग
- नरम अधिकतम-सामान्य गेटिंग वजन
- प्रति विशेषज्ञ पूर्वाग्रह के माध्यम से सहायक हानि मुक्त संतुलन

`code/main.rs`यह केवल मानक पुस्तकालय का उपयोग करता है। यादृच्छिक संख्याएं पायथन से भिन्न होती हैं, लेकिन मुद्रित निष्कर्ष समान होते हैं।

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### चरण 1: राउटर

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

पूर्वाग्रह चयन को प्रभावित करता है, गेट वजन को नहीं। यह है डीपसेक-वी 3 ट्रिक  पूर्वाग्रह मॉडल की भविष्यवाणियों को निर्देशित किए बिना लोड असंतुलन को ठीक करता है।

### चरण 2: राउटर के माध्यम से 100 टोकन चलाएं

यह पता लगाएं कि विशेषज्ञ किस तरह से आग लगाते हैं। पूर्वाग्रह के बिना, उपयोग विकृत है। पूर्वाग्रह अद्यतन लूप (`-γ`अति प्रयोग विशेषज्ञों के लिए, `+γ`कम इस्तेमाल के लिए), उपयोग कुछ पुनरावृत्ति के दौरान एक समान वितरण के लिए अभिसरण।

### चरण 3: पैरामीटर गणना तुलना

एक एमओई कॉन्फ़िग के "घन समकक्ष" को प्रिंट करें। डीपसेक-वी 3 आकारः 256 रूटेड + 1 साझा, 8 सक्रिय, d_model=7168. कुल पैरामीटर गिनती आंखों को पानी देती है। सक्रिय गिनती घने Llama 3 70B का सातवां है।

## इसका प्रयोग करें

गले लगाना चेहरा लोड करनाः

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 उत्पादन निष्कर्षः vLLM नेटिव रूप से MoE रूटिंग का समर्थन करता है। SGLang सबसे तेज़ विशेषज्ञ-समान पथ है। दोनों स्वचालित रूप से शीर्ष-के चयन और विशेषज्ञ समानांतर को संभालते हैं।

**When to pick MoE:**
- आप प्रति टोकन कम अनुमान लागत पर सीमा गुणवत्ता चाहते हैं।
- आपके पास वीआरएएम/विशेषज्ञ समानांतर बुनियादी ढांचा है।
- आपका कार्यभार टोकन-भारी (चैट, कोड) है न कि संदर्भ-भारी (लंबे डॉक्स) ।

**When NOT to pick MoE:**
- एज डिप्लोयमेंट  आप किसी भी सक्रिय FLOP के लिए पूर्ण भंडारण का भुगतान करते हैं।
- लटेंसी-महत्वपूर्ण एकल-उपयोगकर्ता सेवा  विशेषज्ञ रूटिंग ओवरहेड जोड़ता है।
- छोटे मॉडल (<7B)  MoE का गुणवत्ता लाभ केवल एक गणना सीमा (~6B सक्रिय पैरामीटर) से ऊपर दिखाई देता है।

## इसे भेजें

देखो`outputs/skill-moe-configurator.md`. कौशल एक नए एमई के लिए E, k और साझा-विशेषज्ञ लेआउट चुनता है, जो एक पैरामीटर बजट, प्रशिक्षण टोकन और तैनाती लक्ष्य देता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. देखो कैसे सहायक-हानि-मुक्त पूर्वाग्रह अद्यतन 50 पुनरावृत्ति से अधिक विशेषज्ञ उपयोग को संतुलित करता है.
2. **Medium.**सीखे हुए राउटर को हैश आधारित राउटर (निर्णायक, कोई सीखने) से बदलें। गुणवत्ता और संतुलन की तुलना करें। सीखे हुए राउटर बेहतर क्यों है?
3. **Hard.**GRPO-शैली "रोलआउट-मेच रूटिंग" (डीपसेक-वी3.2 ट्रिक) लागू करेंः लॉग जो विशेषज्ञों ने निष्कर्ष के दौरान फायर किया, ग्रेडिएंट गणना के दौरान उसी रूटिंग को मजबूर किया। खिलौना नीति-ग्रेडिएंट सेटअप पर प्रभाव मापें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## आगे पढ़ना

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) विचार।
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) स्विच, क्लासिक मोई।
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) मिश्रित 8 × 7B।
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) एमएलए + सहायक हानि मुक्त एमओई + एमटीपी।
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) पूर्वाग्रह आधारित संतुलन पत्र।
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) इस पाठ के राउटर का उपयोग इस प्रकार किया जाता है।
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) मूल साझा-विशेषज्ञ पेपर।
