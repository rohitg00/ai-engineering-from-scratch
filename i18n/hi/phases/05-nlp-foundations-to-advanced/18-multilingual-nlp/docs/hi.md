# बहुभाषी एनएलपी

> एक मॉडल, 100 से अधिक भाषाएं, उनमें से अधिकांश के लिए प्रशिक्षण डेटा शून्य। क्रॉस-लिंग्वेज ट्रांसफर 2020 के दशक का व्यावहारिक चमत्कार है।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## समस्या

अंग्रेजी में अरबों लेबल वाले उदाहरण हैं। उर्दू में हजारों हैं। मैथिली में लगभग कोई नहीं है। वैश्विक दर्शकों की सेवा करने वाली किसी भी व्यावहारिक एनएलपी प्रणाली को उन भाषाओं की लंबी पूंछ पर काम करना होगा जहां कार्य-विशिष्ट प्रशिक्षण डेटा मौजूद नहीं है।

बहुभाषी मॉडल एक ही समय में कई भाषाओं पर एक मॉडल को प्रशिक्षित करके इस समस्या का समाधान करते हैं। साझा प्रतिनिधित्व मॉडल को उच्च संसाधन भाषाओं में सीखे गए कौशल को कम संसाधन वाले भाषाओं में स्थानांतरित करने की अनुमति देता है। अंग्रेजी भावना विश्लेषण पर मॉडल को ठीक से समायोजित करें, और यह उर्दू पर आश्चर्यजनक रूप से अच्छी भावना भविष्यवाणियां उत्पन्न करता है। यह शून्य-शॉट क्रॉस-लिंगुअल ट्रांसफर है, और इसने दुनिया में एनएलपी के शिप को फिर से आकार दिया है।

इस पाठ में समझौता, वैदिक मॉडल और एक निर्णय का नाम दिया गया है जो बहुभाषी काम के लिए नई टीमों को प्रेरित करता हैः स्थानांतरण के लिए स्रोत भाषा चुनना।

## अवधारणा

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**बहुभाषी मॉडल सभी लक्षित भाषाओं के पाठ पर प्रशिक्षित SentencePiece या WordPiece टोकनराइज़र का उपयोग करते हैं। शब्दावली साझा हैः एक ही उपशब्द इकाई संबंधित भाषाओं में एक ही मॉर्फेम का प्रतिनिधित्व करती है। `anti-`अंग्रेजी और इतालवी में एक ही टोकन मिलता है।

**Shared representation.**कई भाषाओं में मास्क भाषा मॉडलिंग पर पूर्व प्रशिक्षित एक ट्रांसफार्मर सीखता है कि विभिन्न भाषाओं में अर्थशास्त्र के रूप में समान वाक्य समान छिपे हुए राज्यों का उत्पादन करते हैं। एमबीईआरटी, एक्सएलएम-आर और एनएलएलबी सभी इसे प्रदर्शित करते हैं। अंग्रेजी में "कैट" के लिए एम्बेडमेंट फ्रेंच में "चैट" के पास समूह और स्पेनिश में "गटो" के पास, और इसी तरह पूर्ण-संसा की एम्बेडमेंट भी करते हैं।

**Zero-shot transfer.**एक भाषा (आमतौर पर अंग्रेजी) में लेबल किए गए डेटा पर मॉडल को ठीक से ट्यून करें। निष्कर्ष पर, इसे किसी अन्य भाषा पर चलाएं जो मॉडल समर्थन करता है। लक्षित भाषा लेबल की आवश्यकता नहीं है। परिणाम टाइपोलॉजिकल रूप से संबंधित भाषाओं के लिए मजबूत हैं और दूरस्थ भाषाओं के लिए कमज़ोर हैं।

**Few-shot fine-tuning.**लक्ष्य भाषा में 100-500 लेबल किए गए उदाहरण जोड़ें। वर्गीकरण कार्यों पर अंग्रेजी बेसलाइन के 95-98% तक सटीकता कूदती है। यह बहुभाषी एनएलपी में सबसे अधिक लागत प्रभावी लीवर है।

## मॉडल

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

उपयोग के मामले के अनुसार चुनें। वर्गीकरण सामान्य डिफ़ॉल्ट के रूप में XLM-R-बेस के साथ अच्छी तरह से काम करता है। अनुवाद बनाम खुली पीढ़ी के आधार पर पीढ़ी के कार्यों में mT5 या NLLB की आवश्यकता होती है। स्पष्ट बहुभाषी प्रलोभन का उपयोग करके Aya-23 या क्लाउड के साथ LLM शैली के काम के जोड़े।

## स्रोत भाषा निर्णय (2026 अनुसंधान)

अधिकांश टीमों ने अंग्रेजी को ठीक-ठीक स्रोत के रूप में डिफ़ॉल्ट रूप से चुना है। हालिया शोध (2026) से पता चलता है कि यह अक्सर गलत है।

भाषा समानता कच्चे कॉर्पस आकार से बेहतर हस्तांतरण गुणवत्ता का अनुमान लगाती है। स्लाव लक्ष्य के लिए, जर्मन या रूसी अक्सर अंग्रेजी से बेहतर होते हैं। इंडिक लक्ष्य के लिए, हिंदी अक्सर अंग्रेजी से बेहतर होती है।**qWALS**समानता मीट्रिक (2026, विश्व भाषा संरचनाओं के एटलस की विशेषताओं पर आधारित) इसे मात्राबद्ध करता है। **LANGRANK**(Lin et al., ACL 2019) एक अलग, पहले की विधि है जो भाषाई समानता, शरीर का आकार और आनुवंशिक संबंध के संयोजन से उम्मीदवार स्रोत भाषाओं को रैंक करती है।

व्यावहारिक नियमः यदि आपकी लक्षित भाषा में एक विशिष्ट रूप से निकटता वाला उच्च संसाधन सापेक्ष है, तो पहले उस पर ठीक से ट्यून करने का प्रयास करें, फिर अंग्रेजी के साथ तुलना करें।

```figure
n5-crosslingual-bridge
```

## इसे बनाओ

### चरण 1: शून्य-शॉट क्रॉस-लिंगुअल वर्गीकरण

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

एक मॉडल, तीन भाषाएं, एक ही एपीआई। एनएलआई पर प्रशिक्षित एक्सएलएम-आर डेटा को समाहित ट्रिक के माध्यम से वर्गीकरण में अच्छी तरह से स्थानांतरित करता है।

### चरण 2: बहुभाषी एम्बेडिंग स्पेस

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

अनुवादों को एम्बेडिंग स्पेस में बंद करना पड़ता है। एक अलग अंग्रेजी वाक्य आगे बढ़ता है। यही कारण है कि पार-भाषा खोज, क्लस्टरिंग और समानता काम करती है।

### चरण 3: कुछ शॉट की बारीक-ट्यूनिंग रणनीति

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

100-500 लक्षित भाषा उदाहरणों के लिए, `num_train_epochs=5`और `learning_rate=2e-5`उच्च सीखने की दर बहुभाषी संरेखण को ढहने का कारण बनती है और आपको केवल अंग्रेजी मॉडल मिलता है।

## वास्तव में काम करने वाला मूल्यांकन

- **Per-language accuracy on held-out sets.**संकलित नहीं है। संकलित लंबे पूंछ को छिपाता है।
- **Benchmark against monolingual baseline.**पर्याप्त डेटा वाली भाषाओं के लिए, स्क्रैच से प्रशिक्षित एक भाषाई मॉडल कभी-कभी बहुभाषी से बेहतर होता है।
- **Entity-level tests.**लक्षित भाषा में नामित संस्थाएं। बहुभाषी मॉडल में अक्सर लैटिन से दूर लिपि के लिए कमजोर टोकनकरण होता है।
- **Cross-lingual consistency.**दो भाषाओं में एक ही अर्थ एक ही भविष्यवाणी का उत्पादन करना चाहिए। अंतर को मापें।

## इसका प्रयोग करें

2026 स्टैकः

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

यदि प्रदर्शन मायने रखता है तो लक्ष्य भाषा में बारीकी से समायोजित करने के लिए हमेशा बजट बनाएं। शून्य शॉट एक प्रारंभिक बिंदु है, अंतिम उत्तर नहीं।

### टोकनकरण कर (कम संसाधन वाली भाषाओं के लिए क्या गलत होता है)

बहुभाषी मॉडल अपनी सभी भाषाओं में एक टोकनराइज़र साझा करते हैं। यह शब्दावली अंग्रेजी, फ्रेंच, स्पेनिश, चीनी, जर्मन द्वारा हावी एक कॉर्पस पर प्रशिक्षित की जाती है। हावी सेट के बाहर किसी भी भाषा के लिए, तीन कर चुपचाप मिश्रित होते हैंः

- **Fertility tax.**कम संसाधन वाले भाषा पाठ को अंग्रेजी की तुलना में प्रति शब्द में बहुत अधिक टोकन में चिह्नित किया जाता है। एक हिंदी वाक्य को समकक्ष अंग्रेजी वाक्य के टोकन की 3-5 गुना आवश्यकता हो सकती है। यह 3-5x आपके संदर्भ विंडो, प्रशिक्षण दक्षता और विलंबता को खाता है।
- **Variant recovery tax.**प्रत्येक टाइप त्रुटि, डायक्रिटिक संस्करण, यूनिकोड सामान्यीकरण असंगतता, या केस वेरिएशन एम्बेडिंग स्पेस में एक कोल्ड-स्टार्ट असंबद्ध अनुक्रम बन जाता है। मॉडल वर्तनी अनुरूपता नहीं सीख सकता है जो एक मूल वक्ता को स्पष्ट लगता है।
- **Capacity spillover tax.**टैक्स 1 और 2 संदर्भ स्थितियों, परत की गहराई और एम्बेडिंग आयामों का उपभोग करते हैं। वास्तविक तर्क के लिए जो बचा है वह समान मॉडल से उच्च संसाधन भाषा के लिए मिलता है उससे व्यवस्थित रूप से छोटा है।

व्यावहारिक लक्षणः आपका मॉडल सामान्य रूप से हिंदी में प्रशिक्षित होता है, हानि वक्र सही दिखता है, मूल्यांकन की उलझन उचित दिखती है, और उत्पादन के आउटपुट सूक्ष्म रूप से गलत होते हैं। वाक्य के बीच में मॉर्फोलॉजी टूट जाती है। दुर्लभ झुकाव अपरिवर्तनीय रहते हैं। **You cannot data-scale your way out of a broken tokenizer.**

कम करने के लिएः अपनी लक्षित भाषा के लिए अच्छी कवरेज के साथ एक टोकनराइज़र चुनें (XLM-V की 1M-token शब्दावली एक प्रत्यक्ष फिक्स है); प्रशिक्षण से पहले आयोजित लक्षित पाठ पर टोकनकरण की प्रजनन क्षमता की जांच करें; बाइट स्तर की वापसी का उपयोग करें (SentencePiece `byte_fallback=True`वास्तव में लंबे-पूंछ स्क्रिप्ट के लिए जीपीटी-2 शैली बाइट-स्तर BPE) इसलिए कुछ भी कभी OOV नहीं है।

## इसे भेजें

`outputs/skill-multilingual-picker.md`:

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## व्यायाम

1. **Easy.**अंग्रेजी, फ्रेंच, हिंदी और अरबी में प्रति भाषा 10 वाक्य पर शून्य शॉट वर्गीकरण पाइपलाइन चलाएं। प्रत्येक पर सटीकता रिपोर्ट करें। आपको मजबूत फ्रेंच, सभ्य हिंदी, चर अरबी देखना चाहिए।
2. **Medium.**उपयोग करें`paraphrase-multilingual-MiniLM-L12-v2`एक छोटी मिश्रित भाषा के कॉर्पस पर एक क्रॉस-लिंग्वेज रिट्रीवर का निर्माण करना। अंग्रेजी में क्वेरी करें, किसी भी भाषा में दस्तावेज़ प्राप्त करें। याद@5 मापें।
3. **Hard.**हिन्दी वर्गीकरण कार्य के लिए अंग्रेजी-स्रोत और हिंदी-स्रोत ठीक-ठीक की तुलना करें। दोनों शासनों के तहत कुछ शॉट ठीक-ठीक करने के लिए 500 लक्ष्य भाषा उदाहरणों का उपयोग करें। रिपोर्ट करें कि किस स्रोत से बेहतर हिंदी सटीकता और कितनी से उत्पन्न होती है। यह लघु में लैंग्रैंक थीसिस है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## आगे पढ़ना

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) XLM-R पेपर।
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) विश्लेषणात्मक पेपर जो क्रॉस-लिंग्वेज ट्रांसफर रिसर्च लाइन की शुरुआत करता है।
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) एनएलएलबी-200 पेपर।
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) अय्या, कोहरे की बहुभाषी LLM।
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) QWALS/LANGRANK स्रोत भाषा का पेपर।
