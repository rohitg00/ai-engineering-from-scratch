# स्क्रैच से टोकन बनाने का काम

> पाठ 1 आपको एक खिलौना देता है।

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## सीखने के लक्ष्य

- एक उत्पादन-ग्रेड बीपीई टोकनराइज़र बनाएं जो यूनिकोड, व्हाइटस्पेस नॉर्मलाइजेशन और विशेष टोकन को संभालता है
- बाइट-स्तर के बैकअप को लागू करें ताकि टोकनइज़र अज्ञात टोकन के बिना किसी भी इनपुट (इमोजी, सीजेके और कोड सहित) को कोड कर सके
- BPE विलय लागू करने से पहले शब्द सीमाओं पर पाठ को विभाजित करने वाले पूर्व-टोकेनाइज़ेशन रेजेक्स पैटर्न जोड़ें
- एक कॉर्पस पर कस्टम टोकनराइज़र को प्रशिक्षित करें और बहुभाषी पाठ पर टिक्टोकन के खिलाफ इसके संपीड़न अनुपात का मूल्यांकन करें

## समस्या

पाठ 01 से आपका BPE टोकन टाइगर अंग्रेजी पाठ पर काम करता है अब इसे जापानी या इमोजी या मिश्रित टैब और स्थानों के साथ पायथन कोड पर फेंक दें।

यह टूट जाता है.

यह इसलिए नहीं है क्योंकि बीपीई गलत है - क्योंकि कार्यान्वयन अधूरा है. एक उत्पादन टोकनराइज़र किसी भी एन्कोडिंग में कच्चे बाइट्स को संभालता है, विभाजन से पहले यूनिकोड को सामान्य बनाता है, विशेष टोकन को प्रबंधित करता है जो कभी विलय नहीं होते हैं, उपशब्द विभाजन के साथ श्रृंखला पूर्व टोकनकरण, और यह सब इतनी तेजी से करता है कि प्रशिक्षण पाइपलाइन को 15 ट्रिलियन टोकन को संसाधित करने में बाधा नहीं आती है।

GPT-2 के टोकन 50257 टोकन है। लामा 3 में 128,256 हैं। GPT-4 में लगभग 100,000 हैं। ये खिलौना संख्या नहीं हैं। उन शब्दावली के पीछे के मेज टेबल को सैकड़ों गीगाबाइट टेक्स्ट पर प्रशिक्षित किया गया था, और आसपास की मशीनें -- सामान्यीकरण, पूर्व-टोकनाइज़ेशन, विशेष टोकन इंजेक्शन, चैट टेम्पलेट स्वरूपण -- वह है जो एक टोकनराइज़र को अलग करती है जो "हैलो वर्ल्ड" को संभालने वाला है और एक जो पूरे इंटरनेट को संभालने वाला है।

आप उस मशीन का निर्माण करने जा रहे हैं।

## अवधारणा

### पूरी पाइपलाइन

एक उत्पादन टोकन एक एल्गोरिथ्म नहीं है, यह पांच चरणों की पाइपलाइन है, प्रत्येक एक अलग समस्या को हल करता है।

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

प्रत्येक चरण का एक विशिष्ट कार्य होता हैः

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### बाइट लेवल बीपीई

पाठ 01 के टोकनराइज़र UTF-8 बाइट्स पर काम किया। यह सही कॉल था। लेकिन हमने कुछ महत्वपूर्ण छोड़ दियाः क्या होता है जब वे बाइट्स UTF-8 वैध नहीं हैं?

बाइट-स्तर बीपीई हर संभव बाइट मान (0-255) को वैध टोकन के रूप में मानकर इसे हल करता है. आपकी आधार शब्दावली ठीक 256 प्रविष्टियां है. कोई भी फ़ाइल - पाठ, द्विआधारी, भ्रष्ट - एक अज्ञात टोकन उत्पन्न किए बिना टोकन किया जा सकता है।

GPT-2 ने एक चाल जोड़ीः प्रत्येक बाइट को प्रिंट करने योग्य यूनिकोड वर्ण में मैप करें ताकि शब्दावली मानव-पठनीय बनी रहे। बाइट 0x20 (अंतरिक्ष) उनके मैपिंग में वर्ण "जी" बन जाता है। यह शुद्ध रूप से सौंदर्य प्रसाधन है। एल्गोरिदम पर कोई फर्क नहीं पड़ता।

वास्तविक शक्तिः बाइट स्तर BPE पृथ्वी पर हर भाषा को संभालता है. चीनी वर्ण 3 UTF-8 बाइट्स प्रत्येक हैं. जापानी 3-4 बाइट्स हो सकता है. अरबी, देवनागरी, इमोजी - सभी बस बाइट अनुक्रम. BPE एल्गोरिदम इन बाइट अनुक्रमों में पैटर्न ठीक उसी तरह पाता है जैसे यह अंग्रेजी ASCII बाइट्स में पैटर्न पाता है.

### पूर्व टोकनकरण

इससे पहले कि BPE आपके पाठ को छू ले, आपको इसे टुकड़ों में विभाजित करना होगा। यह विलय एल्गोरिदम को शब्द सीमाओं को कवर करने वाले टोकन बनाने से रोकता है।

GPT-2 पाठ को विभाजित करने के लिए एक रेजेक्स पैटर्न का उपयोग करता हैः

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

यह पैटर्न संकुचन ("don't" बन जाता है "don" + "'t"), वैकल्पिक अग्रणी स्थानों, संख्याओं, विरामचिह्न और सफेद स्थानों वाले शब्दों पर विभाजित होता है। अग्रणी स्थान शब्द से जुड़ा रहता है - इसलिए "cat" ["the", "cat"] बन जाता है, न कि ["the", " ", "cat"] ।

Llama SentencePiece का उपयोग करता है, जो regex को पूरी तरह से छोड़ देता है। यह कच्चे बाइट स्ट्रीम को एक लंबे अनुक्रम के रूप में व्यवहार करता है और BPE एल्गोरिदम को सीमाओं का पता लगाने देता है। यह सरल है लेकिन BPE को क्रॉस-वर्ड टोकन बनाने के लिए अधिक स्वतंत्रता देता है।

विकल्प मायने रखता है। जीपीटी -2 का रेजेक्स टोकनराइज़र को यह सीखने से रोकता है कि एक शब्द के अंत में "the" और अगले की शुरुआत में "the" को मिलाया जाना चाहिए। SentencePiece इसे अनुमति देता है, जो कभी-कभी अधिक कुशल संपीड़न का उत्पादन करता है लेकिन कम व्याख्या योग्य टोकन।

### विशेष टोकन

प्रत्येक उत्पादन टोकनराइज़र संरचनात्मक मार्करों के लिए टोकन आईडी आरक्षित करता हैः

| Token | Purpose | Used By |
|-------|---------|---------|
| `[BOS]` / `<s>` | Beginning of sequence | Llama 3, GPT |
| `[EOS]` / `</s>` | End of sequence | All models |
| `[PAD]` | Padding for batch alignment | BERT, T5 |
| `[UNK]` | Unknown token (byte-level BPE eliminates this) | BERT, WordPiece |
| `<\|im_start\|>` | Chat message boundary start | ChatGPT, Qwen |
| `<\|im_end\|>` | Chat message boundary end | ChatGPT, Qwen |
| `<\|user\|>` | User turn marker | Llama 3 |
| `<\|assistant\|>` | Assistant turn marker | Llama 3 |

विशेष टोकन कभी भी बीपीई द्वारा विभाजित नहीं होते हैं। वे विलय एल्गोरिथ्म चलाने से ठीक पहले मेल खाते हैं, उनकी फिक्स्ड आईडी के साथ प्रतिस्थापित होते हैं, और आसपास के पाठ को सामान्य रूप से टोकन किया जाता है।

### चैट टेम्पलेट्स

यह वह जगह है जहाँ अधिकांश लोग भ्रमित हो जाते हैं और अधिकांश कार्यान्वयन टूट जाते हैं।

जब आप चैट मॉडल को संदेश भेजते हैं, तो एपीआई संदेशों की एक सूची स्वीकार करता हैः

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

मॉडल JSON नहीं देखता है। यह एक फ्लैट टोकन अनुक्रम देखता है। चैट टेम्पलेट विशेष टोकन का उपयोग करके संदेशों को उस फ्लैट अनुक्रम में परिवर्तित करता है। प्रत्येक मॉडल यह अलग तरह से करता हैः

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

टेम्पलेट गलत हो गया और मॉडल कचरा पैदा करता है. यह एक सटीक प्रारूप पर प्रशिक्षित किया गया था. किसी भी विचलन - एक गायब नई रेखा, एक swapped टोकन, एक अतिरिक्त स्थान - इनपुट को प्रशिक्षण वितरण के बाहर डालता है.

### गति

उत्पादन टोकन के लिए पायथन बहुत धीमा है।

tiktoken (OpenAI) रास्ट में पायथन बंधन के साथ लिखा गया है। HuggingFace टोकनाइज़र भी रास्ट है। SentencePiece C++ है। ये शुद्ध पायथन पर 10-100x स्पीडअप प्राप्त करते हैं।

परिप्रेक्ष्य के लिएः Llama 3 के लिए 15 ट्रिलियन टोकन को 1 मिलियन टोकन प्रति सेकंड (फास्ट पायथन) पर प्री-ट्रेनिंग करने में 174 दिन लगेंगे। 100 मिलियन टोकन प्रति सेकंड (रस्ट) पर, इसमें 1.7 दिन लगेंगे।

आप पायथन में निर्माण कर रहे हैं एल्गोरिथ्म को समझने के लिए. उत्पादन में, आप एक संकलित कार्यान्वयन का उपयोग करेंगे और केवल पायथन रैपर को छूना होगा.

```figure
weight-tying
```

## इसे बनाओ

### चरण 1: बाइट-स्तर एन्कोडिंग

किसी भी स्ट्रिंग को बाइट्स के अनुक्रम में परिवर्तित करें, प्रत्येक बाइट को प्रदर्शित करने के लिए प्रिंट करने योग्य वर्ण में मैप करें, और प्रक्रिया को उलट दें।

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

बाइट की गिनती देखने के लिए बहुभाषी पाठ पर परीक्षण करेंः

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

"हैलो" 5 बाइट्स है. "你好" 6 बाइट्स है (3 प्रति वर्ण). फायर इमोजी 4 बाइट्स है. बाइट स्तर टोकनराइज़र को परवाह नहीं है कि यह किस भाषा है। बाइट्स बाइट्स हैं।

### चरण 2: रेजेक्स के साथ प्री-टोकनाइज़र

GPT-2 रेजेक्स पैटर्न का उपयोग करके पाठ को टुकड़ों में विभाजित करें। प्रत्येक टुकड़ा BPE द्वारा स्वतंत्र रूप से टोकन किया जाता है।

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

`regex`मॉड्यूल Unicode गुणों को बचाने का समर्थन करता है (`\p{L}`पत्रों के लिए, `\p{N}`संख्याओं के लिए) मानक पुस्तकालय `re`मॉड्यूल नहीं है, तो हम ASCII वर्ण वर्गों पर वापस गिर जाते हैं. उत्पादन बहुभाषी टोकनाइज़र के लिए, स्थापित `regex`. .

कोशिश करो:

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

अग्रणी स्थान उसके बाद के शब्द से जुड़ा रहता है। पहले शब्द के सामने कोई स्थान नहीं है, इसलिए इसका टुकड़ा है`Hello`संकुचन अपोस्ट्रोफ पर विभाजित. अंकन अपने खुद के टुकड़े बन जाता है. BPE कभी भी इन सीमाओं के पार टोकन को मिला नहीं करेगा.

### चरण 3: बाइट अनुक्रम पर बीपीई

पाठ 01, लेकिन अब स्वतंत्र रूप से पूर्व-टोकन टुकड़े पर काम कर रहे कोर एल्गोरिथ्म.

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### चरण 4: विशेष टोकन हैंडलिंग

विशेष टोकन सटीक मिलान और निश्चित आईडी की आवश्यकता है। वे BPE पूरी तरह से बायपास.

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### चरण 5: पूर्ण टोकनइज़र वर्ग

सब कुछ एक साथ चेन करें: सामान्यीकरण, विशेष टोकन पर विभाजित, पूर्व टोकन, बीपीई विलय, मानचित्र से आईडी तक।

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### चरण 6: बहुभाषी परीक्षा

असली परीक्षा. अंग्रेजी, चीनी, इमोजी, और कोड फेंक दो।

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

चीनी वर्ण प्रत्येक 3 बाइट्स उत्पन्न करते हैं. इमोजी 4 बाइट्स उत्पन्न करता है. इनमें से कोई भी टोकनराइज़र को क्रैश नहीं करता है. कोई भी अज्ञात टोकन उत्पन्न नहीं करता है. यह बाइट स्तर BPE की शक्ति है।

## इसका प्रयोग करें

### वास्तविक टोकन बनाने वालों की तुलना

Llama 3, GPT-4 और Mistral के वास्तविक टोकन बनाने वाले को लोड करें। देखें कि प्रत्येक पैराग्राफ एक ही बहुभाषी पैराग्राफ को कैसे संभालता है।

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

आप एक ही पाठ के लिए अलग-अलग टोकन गिनती देखेंगे। 128K शब्दावली के साथ Llama 3 सामान्य पैटर्न को मिलाकर अधिक आक्रामक है। 100K के साथ GPT-4 बीच में बैठता है। 32K के साथ मिस्ट्रल अधिक टोकन उत्पन्न करता है लेकिन इसमें एक छोटा एम्बेडिंग परत है।

समझौता हमेशा एक ही होता हैः बड़ी शब्दावली का अर्थ है छोटे अनुक्रम लेकिन अधिक मापदंड।

## इसे भेजें

इस पाठ में उत्पादन टोकन बनाने और डिबग करने के लिए एक प्रॉम्प्ट उत्पन्न होता है।`outputs/prompt-tokenizer-builder.md`. .

## व्यायाम

1. **Easy:**एक जोड़ें `get_token_bytes(id)`विधि जो किसी भी टोकन आईडी के लिए कच्चे बाइट्स दिखाता है. इसका उपयोग अपने सबसे आम विलय टोकन वास्तव में क्या प्रतिनिधित्व करते हैं की जांच करने के लिए.
2. **Medium:**लामा शैली के प्री-टोकनीज़र को लागू करें जो सफेद स्थान और अंकों पर विभाजित होता है लेकिन अग्रणी स्थानों को बनाए रखता है। उसी कॉर्पस पर जीपीटी - 2 रेजेक्स दृष्टिकोण के साथ इसकी शब्दावली की तुलना करें।
3. **Hard:**एक चैट टेम्पलेट विधि जोड़े जो सूची लेता है `{"role": ..., "content": ...}`संदेश और Llama 3 चैट प्रारूप के लिए सही टोकन अनुक्रम उत्पन्न करता है. HuggingFace कार्यान्वयन के साथ परीक्षण करें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Byte-level BPE | "Tokenizer that works on bytes" | BPE with a base vocabulary of 256 byte values -- handles any input without unknown tokens |
| Pre-tokenization | "Splitting before BPE" | Regex or rule-based splitting that prevents BPE from merging across word boundaries |
| NFKC normalization | "Unicode cleanup" | Canonical decomposition followed by compatibility composition -- "fi" ligature becomes "fi", fullwidth "A" becomes "A" |
| Chat template | "How messages become tokens" | The exact format for converting a list of role/content messages into a flat token sequence -- model-specific and must match training format |
| Special tokens | "Control tokens" | Reserved token IDs that bypass BPE -- [BOS], [EOS], [PAD], chat markers -- matched exactly before merge |
| Fertility | "Tokens per word" | Ratio of output tokens to input words -- 1.3 for English in GPT-4, 2-3 for Korean, higher means wasted context |
| tiktoken | "OpenAI tokenizer" | Rust BPE implementation with Python bindings -- 10-100x faster than pure Python |
| Merge table | "The vocabulary" | Ordered list of byte-pair merges learned during training -- this IS the tokenizer's learned knowledge |

## आगे पढ़ना

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- GPT-3.5/4 द्वारा उपयोग किए जाने वाले जंग बीपीई कार्यान्वयन
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- Rust Tokenizer लाइब्रेरी BPE, WordPiece, Unigram का समर्थन
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- 128K शब्दावली और टोकनराइज़र प्रशिक्षण के बारे में विवरण
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- भाषा-अज्ञानी टोकनकरण
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- मूल बाइट-टू-यूनीकोड मानचित्रण
