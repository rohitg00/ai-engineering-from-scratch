# मशीन अनुवाद

> अनुवाद वह काम है जिसने तीस वर्षों तक एनएलपी अनुसंधान का भुगतान किया और अब भी भुगतान करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## समस्या

एक मॉडल एक भाषा में एक वाक्य पढ़ता है और दूसरे भाषा में एक वाक्य उत्पन्न करता है। लंबाई भिन्न होती है। शब्द क्रम भिन्न होता है। कुछ स्रोत शब्द कई लक्ष्य शब्दों के लिए नक्शा बनाते हैं और इसके विपरीत। इडिओम एक-एक मानचित्रण से इनकार करते हैं। फ्रेंच में "मैं आपको याद करता हूं" है "tu me manques"  शाब्दिक रूप से "मुझे आपकी कमी है।" कोई शब्द-स्तर संरेखण जीवित नहीं है।

मशीन अनुवाद वह कार्य है जिसने एनएलपी को एन्कोडर-डेकोडर, ध्यान, ट्रांसफार्मर और अंततः पूरे एलएलएम प्रतिमान का आविष्कार करने के लिए मजबूर किया। आगे का हर कदम आया क्योंकि अनुवाद की गुणवत्ता मापी जा सकती थी और मानव और मशीन के बीच का अंतर जिद्दी था।

यह पाठ इतिहास के पाठ को छोड़ देता है और 2026 की कार्य लाइन सिखाता हैः पूर्व-प्रशिक्षित बहुभाषी एन्कोडर-डेकोडर (NLLB-200 या mBART), उपशब्द टोकनाइज़ेशन, बीम सर्च, BLEU और chrF मूल्यांकन, और कुछ विफलता मोड जो अभी भी उत्पादन में अनकैप्चर किए जाते हैं।

## अवधारणा

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

आधुनिक एमटी एक समानांतर पाठ पर प्रशिक्षित ट्रांसफार्मर एन्कोडर-डेकोडर है। एन्कोडर अपनी भाषा के टोकनकरण में स्रोत पढ़ता है। डेकोडर क्रॉस-अटेंशन (पाठ 10) के माध्यम से एन्कोडर के आउटपुट का उपयोग करके लक्ष्य, एक उपशब्द एक समय में उत्पन्न करता है। डेकोडिंग लालची-डेकोडिंग जाल से बचने के लिए बीम खोज का उपयोग करता है। आउटपुट को डिटोकन किया जाता है, नष्ट कर दिया जाता है, और संदर्भ के खिलाफ स्कोर किया जाता है।

तीन परिचालन विकल्प वास्तविक दुनिया में एमटी गुणवत्ता को चलाते हैं।

- **Tokenizer.**SentencePiece BPE को मिश्रित भाषाओं के पाठ्यक्रम पर प्रशिक्षित किया गया है। NLLB में शून्य-शॉट जोड़े को सक्षम बनाने के लिए भाषाओं के बीच साझा शब्दावली है।
- **Model size.**NLLB-200 डिस्टिल 600M लैपटॉप पर फिट बैठता है। NLLB-200 3.3B प्रकाशित उत्पादन डिफ़ॉल्ट है। 54.5B अनुसंधान छत है।
- **Decoding.**सामान्य सामग्री के लिए बीम चौड़ाई 4-5। लंबे समय से दंडित करने के लिए बहुत कम आउटपुट से बचने के लिए। जब आपको शब्दावली सुसंगतता की आवश्यकता होती है तो प्रतिबंधित डिकोडिंग।

```figure
seq2seq-alignment
```

## इसे बनाओ

### चरण 1: पूर्व प्रशिक्षित एमटी कॉल

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

यहाँ तीन बातें मायने रखती हैं।`src_lang`टोकनराइज़र को बताता है कि कौन सा स्क्रिप्ट और विभाजन लागू करना है। `forced_bos_token_id`एमबीएआरटी और एम2एम-100 अपने स्वयं के सम्मेलनों का उपयोग करते हैं और वे परस्पर विनिमय योग्य नहीं हैं।

### चरण 2: BLEU और chrF

ब्लू आउटपुट और संदर्भ के बीच n-ग्राम ओवरलैप को मापता है। चार संदर्भ n-ग्राम आकार (1-4), सटीकता का ज्यामितीय औसत, बहुत कम आउटपुट के लिए संक्षिप्तता दंड। स्कोर [0, 100] में है। आम तौर पर उपयोग किया जाता है। व्याख्या करने के लिए निराशाजनकः 30 ब्लू "उपयोग योग्य" है; 40 "अच्छी" है; 50 "असाधारण" है; 1 ब्लू के तहत अंतर शोर है।

chrF वर्ण स्तर F-स्कोर मापता है। जहां BLEU घटता है, जहां morphologically समृद्ध भाषाओं के लिए अधिक संवेदनशील है। अक्सर BLEU के साथ रिपोर्ट किया जाता है।

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

हमेशा उपयोग करें`sacrebleu`यह टोकनकरण को सामान्य बनाता है ताकि अंक कागजातों में तुलनात्मक हों। अपने स्वयं के ब्लूई गणना को रोलिंग करना है कि भ्रामक बेंचमार्क कैसे होते हैं।

### तीन स्तरीय मूल्यांकन पदानुक्रम (2026)

आधुनिक एमटी मूल्यांकन में तीन पूरक मीट्रिक परिवारों का उपयोग किया जाता है। कम से कम दो के साथ जहाज।

- **Heuristic**(BLEU, chrF) तेज, संदर्भ आधारित, व्याख्या योग्य, पैराफ्रेसेस के प्रति असुरक्षित। विरासत तुलना और प्रतिगमन का पता लगाने के लिए उपयोग किया जाता है।
- **Learned**(COMET, BLEURT, BERTScore) मानव न्याय पर प्रशिक्षित तंत्रिका मॉडल; स्रोत और संदर्भ के साथ अनुवाद की अर्थिक समानता की तुलना करें। COMET 2023 के बाद से एमटी अनुसंधान के साथ सबसे अधिक संबंध रखता है और गुणवत्ता के मामले में 2026 उत्पादन डिफ़ॉल्ट है।
- **LLM-as-judge**(संदर्भ मुक्त) अनुवादों को धाराप्रवाहता, पर्याप्तता, स्वर, सांस्कृतिक उपयुक्तता पर स्कोर करने के लिए एक बड़ा मॉडल प्रदान करें। GPT-4-जैसा-जज्यू मानव सहमति से मेल खाता है ~ 80% समय जब rubric अच्छी तरह से डिजाइन किया जाता है। जहां कोई संदर्भ नहीं है, तो खुला अंत सामग्री के लिए उपयोग करें।

व्यावहारिक 2026 स्टैक: `sacrebleu`BLEU और chrF के लिए, `unbabel-comet`COMET के लिए, और अंतिम मानव-मुखी संकेत के लिए एक प्रेरित LLM। उत्पादन डेटा पर भरोसा करने से पहले 50-100 मानव-लेबल उदाहरणों के साथ प्रत्येक मीट्रिक को कैलिब्रेट करें।

संदर्भ मुक्त माप (COMET-QE, BLEURT-QE, LLM-as-judge) आपको संदर्भ के बिना अनुवादों का मूल्यांकन करने की अनुमति देता है, जो लंबे पूंछ वाले भाषा जोड़े के लिए महत्वपूर्ण है जहां संदर्भ अनुवाद मौजूद नहीं हैं।

### चरण 3: उत्पादन में क्या टूटता है

उपरोक्त कामकाजी पाइपलाइन 80% समय में धाराप्रवाह रूप से अनुवाद करेगी और शेष 20% चुपचाप विफल हो जाएगी।

- **Hallucination.**मॉडल सामग्री का आविष्कार करता है जो स्रोत में नहीं था। अपरिचित डोमेन शब्दावली में आम है। लक्षणः आउटपुट धाराप्रवाह है लेकिन स्रोत ने तथ्यों का दावा नहीं किया है। मिट्यागः डोमेन शब्दों पर प्रतिबंधित डिकोडिंग, विनियमित सामग्री पर मानव समीक्षा, इनपुट से अधिक समय तक आउटपुट की निगरानी।
- **Off-target generation.**मॉडल गलत भाषा में अनुवाद करता है। एनएलएलबी दुर्लभ भाषा जोड़े पर आश्चर्यजनक रूप से इस के लिए इच्छुक है।`forced_bos_token_id`और हमेशा आउटपुट पर भाषा-आईडी मॉडल जांच के साथ डिकोड।
- **Terminology drift.**"सिनॉइन अप" डॉक 1 में "s'inscribe" और डॉक 2 में "creer un compte" बन जाता है। यूआई पाठ और उपयोगकर्ता-अनुकूलित स्ट्रिंग के लिए, क्रूड गुणवत्ता से अधिक सुसंगतता महत्वपूर्ण है।
- **Formality mismatch.**फ्रेंच "tu" बनाम "vous", जापानी शिष्टाचार स्तर। मॉडल प्रशिक्षण में जो भी रूप अधिक आम था, उसे चुनता है। ग्राहक-उन्मुख सामग्री के लिए यह आमतौर पर गलत होता है। मिट्यागः औपचारिकता टोकन के साथ त्वरित पूर्वावलोकन यदि मॉडल इसे समर्थन करता है, या केवल औपचारिक कॉर्पो पर एक छोटे मॉडल को ठीक से ट्यून करता है।
- **Length explosion on short input.**बहुत छोटे इनपुट वाक्य अक्सर बहुत लंबे अनुवाद का उत्पादन करते हैं क्योंकि लंबाई दंड ~ 5 स्रोत टोकन से नीचे की चट्टान से गिरता है।

### चरण 4: डोमेन के लिए ठीक से ट्यून करना

पूर्व प्रशिक्षित मॉडल सामान्यवादी हैं। कानूनी, चिकित्सा या गेम-डायलॉग अनुवाद डोमेन समानांतर डेटा पर बारीकी से समायोजित करने से मापने योग्य लाभ प्राप्त करता है। नुस्खा विदेशी नहीं हैः

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

कुछ हज़ार उच्च गुणवत्ता वाले समानांतर उदाहरण कुछ सौ हज़ार शोर-शोर वेब-स्क्रैप किए गए उदाहरणों से बेहतर हैं। प्रशिक्षण डेटा की गुणवत्ता उत्पादन का सबसे बड़ा एकल लीवर है।

## इसका प्रयोग करें

MT के लिए 2026 उत्पादन स्टैकः

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

एलएलएम अब 2026 से कई भाषा जोड़े पर विशेषज्ञ एमटी मॉडल से बेहतर प्रदर्शन करते हैं, विशेष रूप से मौखिक सामग्री और लंबे संदर्भ पर। समझौता प्रति टोकन लागत और विलंबता है। संदर्भ लंबाई, शैलीत्मक स्थिरता या डोमेन अनुकूलन के माध्यम से संदर्भ की तुलना में अधिक मुद्दों को प्रेरित करके एलएलएम चुनें।

## इसे भेजें

`outputs/skill-mt-evaluator.md`:

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## व्यायाम

1. **Easy.** का उपयोग करके अंग्रेजी में एक 5 वाक्य का अनुच्छेद फ्रेंच में अनुवाद करें और अंग्रेजी में वापस जाएं`nllb-200-distilled-600M`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
2. **Medium.**अनुवाद आउटपुट पर भाषा आईडी की जांच करें `fasttext lid.176`या `langdetect`. एमटी कॉल में एकीकृत करें ताकि लक्ष्य से बाहर आने वाली पीढ़ियों को वापस आने से पहले पकड़ा जाए।
3. **Hard.**ठीक-ठीक `nllb-200-distilled-600M`अपनी पसंद के 5,000 जोड़े के डोमेन कॉर्पस पर। ब्लू को एक लंबे समय तक चलने वाले सेट पर मापें, ठीक से ट्यून करने से पहले और बाद में। रिपोर्ट करें कि किस तरह के वाक्य में सुधार हुआ और कौन से पीछे हटे।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## आगे पढ़ना

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) एनएलएलबी पेपर।
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) क्यों `sacrebleu`ब्लू रिपोर्ट करने का एकमात्र सही तरीका है।
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) chrF कागज।
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) व्यावहारिक सूक्ष्म समायोजन।
