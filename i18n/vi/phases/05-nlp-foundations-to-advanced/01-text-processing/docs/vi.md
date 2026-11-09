# Việc xử lý văn bản  Đánh dấu, phát âm, Lemmatization

> Ngôn ngữ là liên tục, mô hình là riêng biệt, xử lý trước là cầu nối.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Vấn đề

Một mô hình không thể đọc "Căn mèo đang chạy". Nó đọc số nguyên.

Mỗi hệ thống NLP bắt đầu với cùng ba câu hỏi. Từ nào bắt đầu. Nguồn từ là gì. Làm thế nào chúng ta đối xử với "run", "run", "run" như một điều giống nhau khi nó giúp đỡ, và như những thứ khác nhau khi nó không giúp đỡ?

Nếu bạn sai việc mã hóa và mô hình học hỏi từ rác rác.`don't`như một dấu hiệu nhưng `do n't`Nếu các bạn bị thất bại, thì các bạn sẽ bị chia rẽ.`organization`và `organ`Nếu lemmatizer của bạn cần một phần của ngữ cảnh nói nhưng bạn không vượt qua nó, động từ được coi như các từ.

Bài học này xây dựng ba bước xử lý trước từ đầu, sau đó cho thấy cách NLTK và spaCy làm việc tương tự để bạn có thể thấy sự thỏa hiệp.

## Khái niệm

Ba hoạt động, mỗi hoạt động đều có một nhiệm vụ và một chế độ thất bại.

**Tokenization**"Token" là một từ không rõ ràng vì sự phân mảnh đúng đắn phụ thuộc vào nhiệm vụ.

**Stemming**- Đánh dấu với quy tắc, nhanh, hung hăng, ngu ngốc.`running -> run`- `organization -> organ`Cái thứ hai là chế độ thất bại.

**Lemmatization**Giảm từ thành từ điển của nó bằng cách sử dụng kiến thức ngữ pháp.`ran -> run`(đáng cần biết "run" là quá khứ của "run").`better -> good`(cần biết các hình thức so sánh).

Quy tắc ngón tay. Nhận tiếng khi tốc độ quan trọng và bạn có thể dung nạp tiếng ồn (tăng chỉ mục tìm kiếm, phân loại thô). Lemmatize khi ý nghĩa quan trọng (phản ứng câu hỏi, tìm kiếm ngữ nghĩa, bất cứ điều gì người dùng sẽ đọc).

```figure
edit-distance
```

## Hãy xây dựng nó

### Bước 1: một token từ regex

Các token hữu ích đơn giản nhất chia thành các ký tự không chữ số trong khi giữ dấu chấm như các token của riêng mình. Không hoàn hảo, không hoàn chỉnh, nhưng nó chạy trong một dòng.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Ba mô hình theo thứ tự ưu tiên.`don't`- `it's`) Số nguyên chất: bất kỳ ký tự không-lượng trắng nào không phải là chữ số như một biểu tượng độc lập (chỉ dấu).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Các chế độ thất bại để nhận thấy. `3pm`chia thành `['3', 'pm']`vì chúng tôi thay đổi giữa các dòng chữ và số. đủ tốt cho hầu hết các nhiệm vụ. URL, email, hashtags tất cả đều phá vỡ.

### Bước 2: một Porter stemmer (chỉ bước 1a)

Các thuật toán Porter đầy đủ có năm giai đoạn của các quy tắc. bước 1a một mình bao gồm các hậu tố tiếng Anh thường xuyên nhất và dạy các mô hình.

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

Hãy đọc các quy tắc từ trên xuống.`ies -> i`vì thế là vì điều luật`ponies -> poni`Không .`pony`Porter thực sự có bước 1b sẽ sửa chữa điều đó các quy tắc cạnh tranh các quy tắc trước đó thắng lệnh quan trọng hơn bất kỳ quy tắc nào

### Bước 3: một máy tạo ra các hình ảnh

Lemmatization thích hợp cần hình học. Một phiên bản giảng dạy dễ xử lý sử dụng một bảng lemma nhỏ và một fallback.

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

Vụ cuối cùng là khoảnh khắc giảng dạy quan trọng.`watched`Không có mặt trên bàn của chúng ta và sự thất bại của chúng ta chỉ xử lý `ing`- Lêm hóa thực sự bao gồm`ed`, động từ bất thường, đặc tính so sánh, đa số với thay đổi âm thanh (`children -> child`Đó là lý do tại sao các hệ thống sản xuất sử dụng WordNet, một nhà phân tích hình thái của spaCy, hoặc một nhà phân tích hình thái đầy đủ.

### Bước 4: Đơn vị kết hợp chúng

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

Phần còn lại là một thẻ POS. giai đoạn 5 · 07 (POS Tagging) tạo ra một. Cho đến nay, mặc định mọi thứ để `NOUN`và thừa nhận giới hạn.

## Sử dụng nó

NLTK và spaCy sẽ đưa ra phiên bản sản xuất.

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`xử lý các sự suy giảm, Unicode, các trường hợp cạnh mà Regex của bạn bỏ lỡ. `PorterStemmer`chạy tất cả năm giai đoạn. `WordNetLemmatizer`cần thẻ POS được dịch từ chương trình Penn Treebank của NLTK sang tập hợp viết tắt của WordNet.

### spacy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

SpaceCy giấu toàn bộ đường ống sau `nlp(text)`- Đồ ký, thẻ POS, và lemmatization tất cả chạy. nhanh hơn NLTK trên quy mô. chính xác hơn ngoài hộp.

### Khi nào để chọn

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### Hai chế độ thất bại không ai cảnh báo bạn về

Hầu hết các bài tập dạy các thuật toán và dừng lại. Hai thứ sẽ cắn một đường ống xử lý trước thực sự, và chúng hầu như không bao giờ được bao phủ.

**Reproducibility drift.**NLTK và spaCy thay đổi hành vi token hóa và lemmatizer giữa các phiên bản.`['do', "n't"]`trong spaCy 2.x có thể tạo ra `["don't"]`trong 3.x. mô hình của bạn được đào tạo trên một phân phối. Inference bây giờ chạy trên một phân phối khác. độ chính xác lặng lẽ suy giảm và không ai biết tại sao. Pin thư viện phiên bản trong`requirements.txt`Viết một bài kiểm tra hồi quy trước xử lý mà đóng băng dự kiến token hóa của 20 câu mẫu.

**Training / inference mismatch.**Trình luyện với quá trình xử lý trước (bản chữ thấp, loại bỏ từ dừng, stemming), triển khai vào đầu vào của người dùng thô, miệng núi lửa hiệu suất đồng hồ. Đây là sự thất bại NLP sản xuất phổ biến nhất. Nếu bạn xử lý trước trong quá trình đào tạo, bạn phải chạy chức năng tương tự trong quá trình suy luận.

## Chuyển nó

Một lời nhắc có thể được sử dụng nhiều lần giúp các kỹ sư chọn một chiến lược xử lý trước mà không cần đọc ba cuốn sách giáo khoa.

Cứ như `outputs/prompt-preprocessing-advisor.md`- Có thể là:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## Các bài tập

1. **Easy.**Tăng `tokenize`để giữ URL như một token.`tokenize("Visit https://example.com today.")`sẽ tạo ra một mã URL.
2. **Medium.**Thực hiện Porter bước 1b. Nếu một từ chứa một âm và kết thúc trong `ed`hoặc `ing`, loại bỏ nó. xử lý quy tắc hai âm âm (`hopping -> hop`Không .`hopp`().
3. **Hard.**Xây dựng một lemmatizer sử dụng WordNet như một bảng tìm kiếm nhưng rơi lại vào Porter stemmer của bạn khi WordNet không có mục nhập. đo độ chính xác trên một corpus được dán so với WordNet đơn giản và đơn giản Porter.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## Đọc thêm

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) tờ giấy ban đầu, năm trang, vẫn là lời giải thích rõ ràng nhất.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) cách dây đường ống thực sự được dây.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) các trường hợp cạnh của token hóa mà bạn chưa nghĩ đến.
