# T5, BART  एन्कोडर-डेकोडर मॉडल

> एन्कोडर समझते हैं. डिकोडर उत्पन्न करते हैं. उन्हें एक साथ रखें और आपको इनपुट → आउटपुट कार्यों के लिए एक मॉडल बनाया जाता हैः अनुवाद, सारांश, पुनर्लेखन, प्रतिलिपि।

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## समस्या

केवल डिकोडर-केवल जीपीटी और केवल एन्कोडर-केवल BERT प्रत्येक अलग लक्ष्य के लिए 2017 वास्तुकला को नीचे खींचते हैं। लेकिन कई कार्य स्वाभाविक रूप से इनपुट-आउटपुट हैंः

- अनुवादः अंग्रेजी → फ्रेंच।
- सारांशः 5,000 टोकन लेख → 200 टोकन सारांश।
- भाषण पहचानः ऑडियो टोकन → पाठ टोकन।
- संरचित निकासीः प्रोसा → JSON।

इन के लिए, एन्कोडर-डेकोडर सबसे साफ फिट बनाता है। एन्कोडर स्रोत का घना प्रतिनिधित्व उत्पन्न करता है। डेकोडर आउटपुट उत्पन्न करता है, प्रत्येक चरण में उस प्रतिनिधित्व का क्रॉस-एड करते हैं। आउटपुट पक्ष पर प्रशिक्षण शिफ्ट-दर-एक होता है। जीपीटी के समान हानि, केवल एन्कोडर आउटपुट पर शर्त लगाई जाती है।

आधुनिक नाटक पुस्तिका को दो कागजातों ने परिभाषित कियाः

1. **T5**(राफेल एट अल. 2019). "टेक्स्ट-टू-टेक्स्ट ट्रांसफर ट्रांसफार्मर।" प्रत्येक एनएलपी कार्य को टेक्स्ट-इन, टेक्स्ट-आउट के रूप में रीफ्रेम किया गया। एकल वास्तुकला, एकल शब्दावली, एकल हानि। मास्क स्पैन भविष्यवाणी पर पूर्व-प्रशिक्षित (इनपुट में भ्रष्ट स्पैन, आउटपुट में उन्हें डिकोड करें) ।
2. **BART**(Lewis et al. 2019). "बिडायरेक्शनल और ऑटो-रेग्रेसिव ट्रांसफार्मर।" ऑटोकोडर का खंडन करनाः कई तरीकों से भ्रष्ट इनपुट (मिश, मास्क, हटाने, घूमने), मूल को पुनर्निर्माण करने के लिए डिकोडर से पूछें।

2026 में एन्कोडर-डेकोडर प्रारूप उस पर रहता है जहां इनपुट संरचना महत्वपूर्ण हैः

- विस्फोर (भाषण → पाठ) ।
- गूगल का अनुवाद स्टैक।
- कुछ कोड-पूरा/सही-सुधार मॉडल जिनके अलग-अलग संदर्भ-और-संपादन संरचनाएं हैं।
- फ्लेन-टी5 और संरचनात्मक तर्क कार्य के लिए वैरिएंट्स।

केवल डिकोडर ने स्पॉटलाइट जीता, लेकिन डिकोडर-डिकोडर कभी नहीं चला गया।

## अवधारणा

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### आगे की लूप

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

महत्वपूर्ण रूप से, एन्कोडर प्रत्येक इनपुट पर एक बार चलता है। डिकोडर ऑटोरेग्रेसिव रूप से चलता है लेकिन प्रत्येक चरण में *एक ही * एन्कोडर आउटपुट की पार-अन्तर्वार्ता करता है। एन्कोडर आउटपुट को कैश करना लंबे इनपुट के लिए एक मुफ्त स्पीडअप है।

### T5 पूर्व प्रशिक्षण  अवधि भ्रष्टाचार

इनपुट के यादृच्छिक अवधि चुनें (औसत लंबाई 3 टोकन, 15% कुल) । प्रत्येक अवधि को एक अद्वितीय sentinel के साथ बदलेंः `<extra_id_0>`,`<extra_id_1>`, आदि. डिकोडर केवल अपने sentinel prefix के साथ भ्रष्ट span आउटपुट करता हैः

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

पूरे अनुक्रम की भविष्यवाणी करने की तुलना में सस्ता संकेत। T5 पेपर के अपवर्तन में MLM (BERT) और उपसर्ग-LM (UniLM) के साथ प्रतिस्पर्धी।

### BART प्री ट्रेनिंग  मल्टी-शोर डीनोइंग

BART पांच शोर कार्यों की कोशिश करता हैः

1. टोकन मास्किंग.
2. टोकन हटाने.
3. पाठ भरना (एक स्पैन का मुखौटा डालें, डिकोडर सही लंबाई डालें) ।
4. वाक्य प्रतिस्थापन।
5. दस्तावेज रोटेशन.

टेक्स्ट इन्फिलिंग + वाक्य परमुटेशन को जोड़कर सबसे अच्छी डाउनस्ट्रीम संख्याएं उत्पन्न हुईं। डिकोडर हमेशा मूल का पुनर्निर्माण करता है। BART का आउटपुट संपूर्ण अनुक्रम है, न कि केवल भ्रष्ट अवधि  इसलिए प्रीट्रेनिंग गणना T5 से अधिक है।

### तर्क

जीपीटी के समान ऑटोरेग्रेसिव पीढ़ी। लोभी / बीम / टॉप-पी नमूनाकरण लागू होता है। बीम खोज (चौड़ाई 45) अनुवाद और सारांश के लिए मानक है क्योंकि आउटपुट वितरण चैट की तुलना में संकीर्ण है।

### 2026 में प्रत्येक संस्करण को कब चुनना है

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

~2022 के बाद से प्रवृत्तिः केवल डेकोडर उन कार्यों को संभालेगा जो एन्कोडर-डेकोडर के पास पहले थे क्योंकि (ए) निर्देश-ट्यून किए गए केवल डेकोडर-एलएलएम किसी भी चीज़ को उत्तेजना के माध्यम से सामान्य करते हैं, (बी) एक वास्तुकला दो से आसान है, (सी) आरएलएचएफ एक डेकोडर को मानता है। एन्कोडर-डेकोडर तब रहता है जब इनपुट मोडलिटी भिन्न होती है (भाषण, छवियां) या जहां बीम खोज गुणवत्ता मायने रखती है।

```figure
encoder-decoder
```

## इसे बनाओ

देखो`code/main.py`हम एक खिलौना corpus के लिए T5 शैली स्पैन भ्रष्टाचार लागू करते हैं इस सबक का सबसे उपयोगी एकल टुकड़ा क्योंकि यह तब से प्रत्येक एन्कोडर-डेकोडर प्री-प्रशिक्षण नुस्खा में दिखाई देता है।

### चरण 1: स्पैन भ्रष्टाचार

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

लक्ष्य प्रारूप T5 सम्मेलन हैः `<sent0> span0 <sent1> span1 ...`. भ्रष्ट इनपुट स्पैन स्थानों पर Sentinel टोकन के साथ अपरिवर्तित टोकन को पार करता है।

### चरण 2: वापसी-यात्रा की जांच करें

भ्रष्ट इनपुट और लक्ष्य को देखते हुए, मूल वाक्य को पुनर्निर्माण करें। यदि आपका भ्रष्टाचार उलटनीय है, तो आगे का पास अच्छी तरह से परिभाषित है। यह एक मानसिकता जांच है  वास्तविक प्रशिक्षण कभी भी ऐसा नहीं करता है, लेकिन परीक्षण सस्ता है और आपके स्पैन कीबकीपिंग में एक-एक बग को पकड़ता है।

### चरण 3: BART शोर

पांच कार्य: `token_mask`,`token_delete`,`text_infill`,`sentence_permute`,`document_rotate`. दो को मिलाकर परिणाम दिखाएं.

## इसका प्रयोग करें

HuggingFace संदर्भः

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 ट्रिकः कार्य नाम इनपुट पाठ में जाता है। एक ही मॉडल दर्जनों कार्यों को संभालता है क्योंकि प्रत्येक कार्य टेक्स्ट-इन, टेक्स्ट-आउट है। 2026 में इस पैटर्न को केवल निर्देश-ट्यून किए गए डिकोडर मॉडल द्वारा सामान्यीकृत किया गया है, लेकिन T5 ने इसे पहले संकलित किया है।

## इसे भेजें

देखो`outputs/skill-seq2seq-picker.md`. इनपुट-आउटपुट संरचना, विलंबता और गुणवत्ता लक्ष्यों को देखते हुए कौशल केवल एक नए कार्य के लिए एन्कोडर-डेकोडर और डेकोडर-के बीच चयन करता है।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`, 30 टोकन वाक्य पर स्पैन भ्रष्टाचार लागू करें, सत्यापित करें कि decoded लक्ष्य स्पैन के साथ गैर-सेंटिनल स्रोत टोकन को संयोजन मूल को पुनः प्रस्तुत करता है।
2. **Medium.**BART को लागू करें `text_infill`शोरः एक एकल के साथ यादृच्छिक स्पैन बदलें `<mask>`टोकन, और decoder सही अवधि लंबाई और सामग्री का अनुमान लगाना चाहिए. एक उदाहरण दिखाएं.
3. **Hard.**ठीक-ठीक `flan-t5-small`एक छोटे से अंग्रेजी → सूअर-लैटिन कॉर्पस (200 जोड़े) पर। एक लंबे समय तक चलने वाले 50-जोड़े सेट पर ब्लू मापें। बारीक- बारीक ट्यूनिंग के खिलाफ तुलना करें `Llama-3.2-1B`एक ही गणना के साथ एक ही डेटा पर।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## आगे पढ़ना

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) टी5
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) BART.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) फ्लेन-टी5
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) विस्पर, 2026 के लिए एक कैनोनिक एन्कोडर-डेकोडर।
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) संदर्भ कार्यान्वयन।
