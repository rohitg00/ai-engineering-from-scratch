# KV कैश, फ्लैश ध्यान और इन्फरेंस अनुकूलन

> प्रशिक्षण समानांतर है और FLOP-bound है. इन्फरेंस सीरियल है और स्मृति-bound है. अलग-अलग बोतल गला, अलग-अलग ट्रिक्स.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## समस्या

एक भोले ऑटोरेग्रेसिव डिकोडर करता है $O(N^2)$उत्पादन के लिए काम करना $N$टोकनः प्रत्येक चरण में यह पूर्ण पूर्वावलोकन पर ध्यान को पुनः गणना करता है। 4K-token प्रतिक्रिया के लिए जो 16M ध्यान संचालन है, उनमें से अधिकांश अधिशेष हैं। एक पूर्वावलोकन टोकन की हर छिपी हुई स्थिति निर्धारित है एक बार गणना की गई है। आपको केवल नए टोकन के क्वेरी को पहले की सभी कैश कुंजी और मूल्यों के खिलाफ चलाने की आवश्यकता है।

इसके अलावा, ध्यान स्वयं बहुत सारे डेटा को स्थानांतरित करता है। मानक ध्यान एक N×N स्कोर मैट्रिक्स, N×d सॉफ्टमैक्स आउटपुट, N×d अंतिम आउटपुट  को HBM पर बहुत अधिक पढ़ता और लिखता है। N≥2K के लिए, ध्यान FLOP-bound बनने से पहले स्मृति-बंधित हो जाता है। क्लासिक ध्यान कर्नेल 410× द्वारा आधुनिक GPU का उपयोग कम करते हैं।

दो अनुकूलन, दोनों दावो और अन्य से, सीमा पर निष्कर्ष को "धीमी" से "त्वरित" तक धकेल दियाः

1. **KV cache.**प्रत्येक उपसर्ग टोकन के K और V वेक्टरों को स्टोर करें. प्रत्येक नए टोकन का ध्यान कैश की कुंजी के खिलाफ एक क्वेरी है। इन्फेरेंस से कम होता है $O(N^2)$$O(N)$प्रति पीढ़ी कदम।
2. **Flash Attention.**ध्यान गणना टाइल ताकि पूर्ण N × N मैट्रिक्स कभी HBM को नहीं हिट करता है। सभी सॉफ्टमैक्स + मत्मूल SRAM में होता है। A100 पर 24× वॉल-क्लॉक स्पीडअप; FP8 के साथ H100 पर 510×।

2026 तक दोनों सार्वभौमिक हैं। प्रत्येक उत्पादन निष्कर्ष स्टैक (vLLM, TensorRT-LLM, SGLang, llama.cpp) उन्हें मानता है। फ्लैश ध्यान सक्षम प्रत्येक सीमा मॉडल जहाज।

## अवधारणा

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV कैश गणित

प्रत्येक डिकोडर परत, प्रत्येक टोकन, सभी KV हेड परः

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

32 परतों के साथ 7B मॉडल के लिए, 32 सिर (के और वी के लिए सभी उपयोग किए जाते हैं), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Llama 3 70B के लिए (80 परतें, d_head=128, GQA 8 KV heads के साथ):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

32K पर 10 GiB बढ़कर 128K पर 40 GiB हो जाता है, जो बैच आकार 1 पर केवल KV कैश के लिए 40 GB A100 का पूरा है।

**GQA is the KV-cache win.**64 केवी हेड वाला एमएचए 8 गुना बड़ा होगा, लगभग 80 जीबी 32K पर। एमएलए और भी अधिक संपीड़ित करता है।

आयामों को खींचें और कैश आकार को आगे बढ़ते देखें। अनुक्रम की लंबाई या बैच को आगे बढ़ाएं और देखें कि यह एक एकल GPU से आगे कितनी तेजी से उड़ता हैः

```figure
kv-cache-sizer
```

### फ्लैश ध्यान  टाइलिंग ट्रिक

मानक ध्यानः

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

तीन एचबीएम राउंड ट्रिप। एच 100 पर, एचबीएम बैंडविड्थ 3 टीबी / एस है; एसआरएएम 30 टीबी / एस है। हर एचबीएम यात्रा 10 का कारक है सब कुछ चिप पर रखने के मुकाबले धीमा।

फ्लैश ध्यानः

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

प्रति टाइल एक HBM यात्रा. कुल स्मृति पदचिह्न से गिरता है$O(N^2)$$O(N)$. बैकवर्ड पास आगे के पास से कुछ मानों को स्टोर करने के बजाय पुनः गणना करता है  एक और मेमोरी जीत।

**Numerical trick.**चल रही softmax बनाए रखता है `(max, sum)`फ्लैश ध्यान मानक ध्यान के लिए बिट-समान आउटपुट की गणना करता है (मॉड्यूल fp16 गैर-संबद्धता) ।

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

फ्लैश 4 केवल लॉन्च के समय आगे-पास है। प्रशिक्षण अभी भी फ्लैश 3 का उपयोग करता है। GQA और varlen फ्लैश 4 के लिए समर्थन (मध्य 2026) इंतजार कर रहा है।

### अनुमानित डिकोडिंग  अन्य विलंबता जीत

सस्ते मॉडल N टोकन का प्रस्ताव करता है। बड़ा मॉडल सभी N को समानांतर में सत्यापित करता है। यदि सत्यापन k टोकन स्वीकार करता है, तो आपने k पीढ़ियों के लिए 1 बड़ा मॉडल फॉरवर्ड पास का भुगतान किया है। कोड और प्रोसेस पर विशिष्ट k = 35।

2026 चूकेंः
- **EAGLE 2 / Medusa.**एकीकृत ड्राफ्ट हेड जो सत्यापनकर्ता के छिपे हुए राज्यों को साझा करते हैं। 23x गुणवत्ता हानि के बिना गति।
- **Speculative decoding with draft model.**उपभोक्ता हार्डवेयर पर 24x गति।
- **Lookahead decoding.**जैकोबी पुनरावृत्ति; कोई ड्राफ्ट मॉडल की जरूरत नहीं. Niche लेकिन मुक्त.

### निरंतर बैचिंग

क्लासिक बैचड इन्फेरेंसः सबसे धीमी अनुक्रम के समाप्त होने की प्रतीक्षा करें, फिर एक नया बैच शुरू करें। जब लघु प्रतिक्रियाएं जल्दी समाप्त होती हैं तो जीपीयू बर्बाद होती है।

निरंतर बैचिंग (पहले ऑर्का में शिप किया गया, अब vLLM, TensorRT-LLM, SGLang में): पुराने काम खत्म होने के तुरंत बाद नए अनुरोधों को बैच में स्विच करें। सामान्य चैट वर्कलोड के लिए 510x थ्रूपुट लाभ।

### PagedAttention  KV कैश वर्चुअल मेमोरी के रूप में

vLLM की मुख्य विशेषता। KV कैश को 16 टोकन ब्लॉकों में आवंटित किया जाता है; एक पृष्ठ तालिका भौतिक ब्लॉकों के लिए तार्किक स्थानों का नक्शा बनाती है। यह आपको समानांतर नमूनों (बीम खोज, समानांतर नमूनाकरण), शीघ्र कैशिंग के लिए हॉट-स्वैप प्रीफिक्स और डिफ्रागमेंट मेमोरी के माध्यम से साझा करने की अनुमति देता है।

```figure
flash-attention-memory
```

## इसे बनाओ

```figure
iso-machine {"machine":"kv-cache"}
```

देखो`code/main.py`हम लागू करते हैंः

1. एक भोले आदमी$O(N^2)$वृद्धिशील डिकोडर।
2. ए $O(N)$KV कैश किए गए डिकोडर।
3. एक टाइल सॉफ्टमैक्स जो फ्लैश ध्यान के चल-मैक्स एल्गोरिथ्म का अनुकरण करता है।

### चरण 1: KV कैश

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

सरलः प्रति टोकन के, प्रति परत, प्रति सिर सूचियों में V वेक्टरों को बढ़ाते रहें।

### चरण 2: टाइलें सॉफ्टमैक्स

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

 के लिए बिट-समान आउटपुट`softmax(qK) V`एक शॉट में, लेकिन किसी भी समय काम सेट एक है`tile × d_head`ब्लॉक, पूर्ण नहीं `N × d_head`. .

### चरण 3: साफ़ बनाम कैश डिकोडिंग की तुलना करें

ध्यान गणना संचालन. दोनों डिकोडर एक ही क्वेरी-की तुलना करते हैंः कदम `t`उपस्थित होता है `t`टोकन, तो कुल 1 + 2 + ... + N = N(N+1)/2. कोड में N = 10 का उपयोग किया जाता है और प्रत्येक डिकोडर के लिए 55 प्रिंट किए जाते हैं। 100 टोकन पीढ़ी के लिए, दोनों 5050 तुलना करते हैं। कैश K और V प्रक्षेपणों को सहेजता है। बिना कैश के, प्रत्येक चरण में K और V को फिर से पूरा पूर्वावलोकन के लिए गणना की जाती है, इसलिए 100 टोकन पीढ़ी 5050 टोकन राज्यों की गणना करती है। कैश के साथ, प्रत्येक टोकन के K और V को एक बार गणना की जाती है, इसलिए एक ही पीढ़ी 100 टोकन राज्यों की गणना करती है।

## इसका प्रयोग करें

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

vLLM उत्पादनः

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

अनुरोधों के बीच पूर्वावलोकन कैशिंग एक बड़ी 2026 जीत है  एक ही सिस्टम प्रॉम्प्ट, कुछ शॉट उदाहरण, या लंबे संदर्भ दस्तावेज़ कॉल के बीच KV का पुनः उपयोग करता है। दोहराए गए टूल प्रॉम्प्ट के साथ एजेंट वर्कलोड के लिए, पूर्वावलोकन कैशिंग नियमित रूप से 5 × थ्रूपुट लाभ है।

## इसे भेजें

देखो`outputs/skill-inference-optimizer.md`. कौशल एक नए निष्कर्ष तैनाती के लिए ध्यान कार्यान्वयन, KV कैश रणनीति, मात्रा और अनुमानात्मक डिकोडिंग चुनता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`. निर्दोष और कैश किए गए डेकोडर एक ही आउटपुट का उत्पादन करते हैं; अप-कंट अंतर को ध्यान में रखें।
2. **Medium.**पूर्वावलोकन कैशिंग लागू करेंः एक प्रॉम्प्ट P और कई पूर्णताएं दी गई हैं, KV कैश भरने के लिए P पर एक आगे का पास चलाएं, फिर प्रति पूर्णता शाखाएं। प्रत्येक के लिए स्पीडअप बनाम पुनः एन्कोडिंग P मापें।
3. **Hard.**एक खिलौना को लागू करें PagedAttention: एक मुक्त सूची के साथ 16 टोकन ब्लॉकों में KV कैश। जब एक अनुक्रम समाप्त हो जाता है, तो उसके ब्लॉकों को पूल में वापस लौटाएं। विभिन्न लंबाई के साथ 1,000 चैट पूर्णता का अनुकरण करें। स्मृति टुकड़े टुकड़े बनाम आसन्न आवंटन की तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## आगे पढ़ना

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) फ्लैश 1
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) फ्लैश 2
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) फ्लैश 3।
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) ब्लैकवेल 5 चरण पाइपलाइन और सॉफ्टवेयर-exp2 ट्रिक; इस पाठ में उल्लेखित केवल आगे के लॉन्च चेतावनी के लिए रेपो README पढ़ें।
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) VLLM पेपर।
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) विनिर्देशों का डिकोडिंग।
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) समन्वित मसौदा दृष्टिकोण के लिए ईगल-1/2 पेपर जो पाठ में उद्धृत किया गया है।
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) ईगल के साथ मेडुसा दृष्टिकोण का संदर्भ।
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) 16 टोकन ब्लॉक और पृष्ठ-तालिका डिजाइन पर कैनोनिक गहरी गोता लगाना।
