# BERT  मुखौटा भाषा मॉडलिंग

> जीपीटी अगले शब्द का भविष्यवाणी करता है. BERT एक गायब शब्द का भविष्यवाणी करता है. एक वाक्य अंतर  और आधा दशक सब कुछ एम्बेडिंग-आकार में.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## समस्या

2018 में, प्रत्येक एनएलपी कार्य  भावना, एनईआर, क्यूए, समावेशी  ने अपने लेबल वाले डेटा पर अपना खुद का मॉडल खरोंच से प्रशिक्षित किया। कोई पूर्व-प्रशिक्षित "अंग्रेजी समझें" चेकपॉइंट नहीं था जिसे आप ठीक कर सकते थे। ELMo (2018) ने दिखाया कि आप द्वि-दिशात्मक LSTM के साथ संदर्भ एम्बेडिंग को पूर्व-प्रशिक्षित कर सकते हैं; यह मदद करता है लेकिन सामान्य नहीं करता है।

BERT (Devlin et al. 2018) ने पूछाः क्या होगा अगर हम एक ट्रांसफार्मर एन्कोडर लेते हैं, उसे इंटरनेट पर हर वाक्य पर प्रशिक्षित करते हैं, और इसे दोनों तरफ से संदर्भ से गायब शब्दों की भविष्यवाणी करने के लिए मजबूर करते हैं? फिर आप अपने डाउनस्ट्रीम कार्य पर एक सिर को ठीक करते हैं। पैरामीटर दक्षता एक खुलासा था।

परिणामः 18 महीने के भीतर BERT और इसके संस्करण (RoBERTa, ALBERT, ELECTRA) ने मौजूद हर एनएलपी रैंकिंग बोर्ड पर हावी रहा। 2020 तक पृथ्वी पर प्रत्येक खोज इंजन, सामग्री मॉडरेशन पाइपलाइन और अर्थिक खोज प्रणाली के अंदर एक BERT था।

2026 में केवल एन्कोडर मॉडल अभी भी वर्गीकरण, पुनर्प्राप्ति और संरचित निष्कर्षण के लिए सही उपकरण हैं। वे डिकोडर की तुलना में प्रति टोकन 510x तेज़ चलते हैं और उनके एम्बेडेड प्रत्येक आधुनिक पुनर्प्राप्ति स्टैक की रीढ़ की हड्डी हैं। आधुनिकBERT (डिसेम्बर 2024) ने फ्लैश ध्यान + RoPE + GeGLU के साथ वास्तुकला को 8K संदर्भ में धकेल दिया।

## अवधारणा

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### प्रशिक्षण संकेत

एक वाक्य लेंः`the quick brown fox jumps over the lazy dog`. .

15% टोकन का आकस्मिक रूप से मास्कः

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

मॉडल को मास्क की स्थिति में मूल टोकन की भविष्यवाणी करने के लिए प्रशिक्षित करें। क्योंकि एन्कोडर द्वि-दिशात्मक है, भविष्यवाणी `[MASK]`स्थिति 1 पर उपयोग कर सकते हैं `brown fox jumps`स्थिति 2+ पर। यह बात जीपीटी नहीं कर सकता है।

### BERT मास्क नियम

भविष्यवाणी के लिए चुनिंदा टोकन के 15% में सेः

- 80% को `[MASK]`. .
- 10% को एक यादृच्छिक टोकन से प्रतिस्थापित किया जाता है।
- 10% अपरिवर्तित रहेगा।

क्यों नहीं हमेशा`[MASK]`क्योंकि ...`[MASK]`मॉडल को उम्मीद करने के लिए प्रशिक्षण`[MASK]`100% मुखौटा पदों के बीच पूर्व प्रशिक्षण और ठीक-ट्यूनिंग के बीच वितरण परिवर्तन पैदा होगा। 10% यादृच्छिक + 10% अपरिवर्तित मॉडल ईमानदार रखता है।

### अगला वाक्य भविष्यवाणी (NSP)  और यह क्यों गिरा दिया गया था

मूल BERT ने NSP पर भी प्रशिक्षण दियाः दो वाक्य A और B दिए, भविष्यवाणी करें कि B A का अनुसरण करता है। RoBERTa (2019) ने इसे हटा दिया और दिखाया कि NSP ने चोट पहुंचाई, मदद नहीं की। आधुनिक एन्कोडर इसे छोड़ देते हैं।

### 2026 में क्या बदल गयाः मॉडर्नBERT

2024 आधुनिकBERT पेपर ने 2026 आदिमों के साथ ब्लॉक को फिर से बनायाः

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

और 2018 स्टैक के विपरीत, यह फ्लैश-अटेंशन-नेटिव है। अनुक्रम लंबाई 8K पर इन्फेरेंस 23x बेहतर GLUE स्कोर के साथ DeBERTa-v3 की तुलना में तेज है।

### उपयोग के मामले जो अभी भी 2026 में एक एन्कोडर चुनते हैं

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## इसे बनाओ

### चरण 1: मास्किंग लॉजिक

देखो`code/main.py`. कार्य `create_mlm_batch`टोकन आईडी, एक शब्दावली आकार और एक मुखौटा संभावना की एक सूची लेता है। इनपुट आईडी (मास्क लागू के साथ) और लेबल (केवल मुखौटा पदों पर, -100 अन्य जगह पर  PyTorch के अनदेखा सूचकांक सम्मेलन) लौटाता है।

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### चरण 2: एक छोटे से corpus पर MLM भविष्यवाणी चलाएं

एक 2-परत एन्कोडर + MLM सिर को 20 शब्दों, 200 वाक्यों के शब्दावली पर प्रशिक्षित करें। कोई ग्रेडिएंट नहीं।

### चरण 3: मास्क प्रकारों की तुलना करें

दिखाएँ कि तीन-तरफा नियम मॉडल को बिना उपयोग किए कैसे बनाए रखता है `[MASK]`. एक अनमास्ड वाक्य और एक मास्क वाक्य पर भविष्यवाणी करें. दोनों को उचित टोकन वितरण का उत्पादन करना चाहिए क्योंकि मॉडल ने प्रशिक्षण में दोनों पैटर्न देखे।

### चरण 4: ठीक-ठीक सिर

खेलौना संवेदना डेटासेट पर वर्गीकरण के साथ एमएलएम हेड की जगह लें। केवल हेड ट्रेन; एन्कोडर जमे हुए है। यह पैटर्न हर BERT अनुप्रयोग का अनुसरण करता है।

## इसका प्रयोग करें

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`जैसे मॉडल`all-MiniLM-L6-v2`वे विपरीत हानि के साथ प्रशिक्षित BERTs हैं. एन्कोडर एक ही है. हानि बदल गई है.

**Cross-encoder rerankers are also fine-tuned BERT.** पर जोड़ी वर्गीकरण`[CLS] query [SEP] doc [SEP]`. क्वेरी और डॉक के बीच द्वि-दिशात्मक ध्यान ही क्रॉस-एन्कोडर को द्वि-कोडरों पर उनकी गुणवत्ता बढ़त देता है।

**When not to pick BERT in 2026.**कुछ भी उत्पन्न करने वाला। एन्कोडर के पास टोकन को ऑटोरेग्रेसिव रूप से उत्पन्न करने का कोई समझदार तरीका नहीं है। इसके अलावाः 1 बी पैरामीटर से नीचे की कोई भी चीज जहां एक छोटा डिकोडर अधिक लचीलापन के साथ गुणवत्ता को मेल खा सकता है (फाय -3-मिनी, क्यूवेन 2 - 1.5 बी) ।

## इसे भेजें

देखो`outputs/skill-bert-finetuner.md`. कौशल एक नए वर्गीकरण या निष्कर्षण कार्य के लिए एक BERT बारीक-टीनिंग (वापस की हड्डी चयन, सिर विनिर्देश, डेटा, मूल्यांकन, रोक) ।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`और 10,000 टोकन पर मास्क वितरण प्रिंट करें। पुष्टि ~ 15% चयनित हैं, और उन ~ 80% बन जाते हैं`[MASK]`. .
2. **Medium.**पूरे शब्द का मास्किंग लागू करेंः यदि एक शब्द को उपशब्दों में टोकन किया गया है, तो सभी उपशब्दों को एक साथ या कोई भी नहीं छिपाएं। मापें कि क्या इससे 500 वाक्य के कॉर्पस पर एमएलएम सटीकता में सुधार होता है।
3. **Hard.**सार्वजनिक डेटासेट से 10,000 वाक्य पर एक छोटी सी (2-परत, d=64) BERT को प्रशिक्षित करें।`[CLS]`एक डीकोडर-केवल बेसलाइन के साथ तुलना करें जो मैच पैरामीटर में जीतता है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## आगे पढ़ना

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) मूल कागज।
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) BERT को सही तरीके से प्रशिक्षित करने का तरीका; NSP को मारता है।
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) प्रतिस्थापित-टोकन का पता लगाना मेल खाते गणना पर एमएलएम से बेहतर है।
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) आधुनिकBERT पेपर।
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) कैनोनिक एन्कोडर संदर्भ।
