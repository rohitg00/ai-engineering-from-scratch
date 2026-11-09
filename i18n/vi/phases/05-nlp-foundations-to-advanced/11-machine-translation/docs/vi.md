# Truyền dịch máy

> Việc dịch là nhiệm vụ đã trả tiền cho nghiên cứu NLP trong ba mươi năm và vẫn trả tiền cho nó ngay bây giờ.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Vấn đề

Một mô hình đọc một câu trong một ngôn ngữ và tạo ra một câu trong một ngôn ngữ khác. Độ dài thay đổi. Tỷ tự từ thay đổi. Một số từ nguồn lập bản đồ cho nhiều từ mục tiêu và ngược lại. Các ngôn ngữ từ chối lập bản đồ một đến một. "Tôi nhớ bạn" bằng tiếng Pháp là "tu me manques"  nghĩa đen "bạn đang thiếu tôi". Không có sự sắp xếp ở mức từ tồn tại.

Truyền dịch máy là nhiệm vụ buộc NLP phát minh ra các bộ mã hóa-chế định, chú ý, biến đổi và cuối cùng là toàn bộ mô hình LLM. Mỗi bước tiến đã đến vì chất lượng dịch thuật có thể đo lường và khoảng cách giữa con người và máy tính là cứng đầu.

Bài học này bỏ qua bài học lịch sử và dạy đường ống làm việc của năm 2026: mã hóa-bản giải đa ngôn ngữ được đào tạo trước (NLLB-200 hoặc mBART), mã hóa từ phụ, tìm kiếm chùm, đánh giá BLEU và chrF, và một số chế độ thất bại vẫn được chuyển đến sản xuất chưa bị bắt.

## Khái niệm

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

MT hiện đại là một bộ mã hóa mã hóa được đào tạo trên văn bản song song. Bộ mã hóa đọc nguồn trong mã hóa ngôn ngữ của nó. Bộ mã hóa tạo ra mục tiêu, một từ phụ một lúc, sử dụng đầu ra của bộ mã hóa thông qua sự chú ý qua chéo (câu 10). Việc mã hóa sử dụng tìm kiếm chùm để tránh bẫy mã hóa tham lam.

Ba lựa chọn hoạt động thúc đẩy chất lượng MT trong thế giới thực.

- **Tokenizer.**SentencePiece BPE được đào tạo trên một cơ sở ngôn ngữ hỗn hợp.
- **Model size.**NLLB-200 600M được chưng cất phù hợp với máy tính xách tay. NLLB-200 3.3B là sản phẩm mặc định được công bố. 54.5B là giới hạn nghiên cứu.
- **Decoding.**Độ rộng chùm 4-5 cho nội dung chung. Độ dài phạt để tránh đầu ra quá ngắn. Khóa mã hạn chế khi bạn cần sự nhất quán thuật ngữ.

```figure
seq2seq-alignment
```

## Hãy xây dựng nó

### Bước 1: cuộc gọi MT được đào tạo trước

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

Ba điều quan trọng ở đây.`src_lang`cho tokenizer biết kịch bản và phân đoạn nào để áp dụng. `forced_bos_token_id`cho decoder biết ngôn ngữ nào để tạo. Cả hai đều là thủ thuật cụ thể của NLLB; mBART và M2M-100 sử dụng các quy ước riêng của họ và chúng không thể thay thế.

### Bước 2: BLEU và chrF

BLEU đo n-gram chồng chéo giữa đầu ra và tham chiếu. Bốn kích thước n-gram tham chiếu (1-4), trung bình hình học của độ chính xác, phạt ngắn gọn cho đầu ra quá ngắn. Điểm số là trong [0, 100].

chrF đo điểm F ở cấp độ ký tự. Thậm chí nhạy cảm hơn với các ngôn ngữ giàu định hình học khi số lượng BLEU thấp phù hợp.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

Luôn sử dụng `sacrebleu`Nó làm bình thường hóa token hóa để điểm số được so sánh trên các bài báo.

### Các cấp bậc đánh giá ba cấp (2026)

Phân tích MT hiện đại sử dụng ba gia đình métric bổ sung.

- **Heuristic**(BLEU, chrF) nhanh, dựa trên tham chiếu, giải thích, không nhạy cảm với các câu.
- **Learned**(COMET, BLEURT, BERTScore). mô hình thần kinh được đào tạo dựa trên phán đoán của con người; so sánh sự tương đồng ngữ nghĩa của dịch thuật với nguồn và tham chiếu. COMET có mối liên hệ cao nhất với nghiên cứu MT kể từ năm 2023 và là sản xuất mặc định năm 2026 khi chất lượng quan trọng.
- **LLM-as-judge**(không tham chiếu). Tạo một mô hình lớn để ghi điểm dịch về độ thông thạo, thích hợp, giọng nói, thích hợp văn hóa. GPT-4 như thẩm phán phù hợp với sự đồng ý của con người ~ 80% thời gian khi rubric được thiết kế tốt. Sử dụng cho nội dung mở khi không có tham chiếu.

Lưu trữ thực tế năm 2026: `sacrebleu`cho BLEU và chrF, `unbabel-comet`Các phương pháp đo lường được đánh giá bằng 50-100 ví dụ được gắn nhãn con người trước khi tin tưởng vào dữ liệu sản xuất.

Các số liệu không tham chiếu (COMET-QE, BLEURT-QE, LLM-as-judge) cho phép bạn đánh giá các bản dịch mà không có tham chiếu, điều này quan trọng đối với các cặp ngôn ngữ đuôi dài nơi không có bản dịch tham chiếu.

### Bước 3: những gì phá vỡ trong sản xuất

Các đường ống làm việc trên sẽ dịch dịch bằng cách lưu động 80% thời gian và im lặng thất bại 20% còn lại.

- **Hallucination.**Mô hình phát minh ra nội dung không có trong nguồn. phổ biến trong từ vựng miền không quen thuộc. triệu chứng: đầu ra là chảy nhưng tuyên bố thực tế nguồn không nêu. Giảm thiểu: mã hóa hạn chế trên các thuật ngữ miền, đánh giá của con người về nội dung được quy định, giám sát cho đầu ra lâu hơn nhiều so với đầu vào.
- **Off-target generation.**Mô hình dịch sang ngôn ngữ sai. NLLB là đáng ngạc nhiên dễ bị điều này trên các cặp ngôn ngữ hiếm.`forced_bos_token_id`và luôn luôn giải mã bằng một kiểm tra mô hình ID ngôn ngữ trên đầu ra.
- **Terminology drift.**"Sign up" trở thành "s'inscribe" trong doc 1 và "creer un compte" trong doc 2. Đối với văn bản UI và chuỗi đối diện người dùng, sự nhất quán quan trọng hơn chất lượng thô.
- **Formality mismatch.**Tiêu chuẩn "tu" vs "vous" của tiếng Pháp, mức độ lịch sự của Nhật Bản. Mô hình chọn hình thức nào phổ biến hơn trong đào tạo. Đối với nội dung đối mặt với khách hàng, điều này thường sai.
- **Length explosion on short input.**Các câu nhập rất ngắn thường tạo ra các bản dịch quá dài vì hình phạt chiều dài rơi xuống dốc dưới ~ 5 mã thông báo nguồn.

### Bước 4: Định chỉnh cho một tên miền

Các mô hình được đào tạo trước là người nói chung. Dịch pháp lý, y tế hoặc trò chơi đối thoại có lợi ích đáng kể từ việc điều chỉnh tinh tế trên dữ liệu song song miền.

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

Một vài ngàn ví dụ song song chất lượng cao vượt qua vài trăm ngàn ví dụ lướt web có tiếng ồn.

## Sử dụng nó

Lớp sản xuất 2026 cho MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

LLM hiện đang vượt trội hơn các mô hình MT chuyên ngành trên một số cặp ngôn ngữ từ năm 2026, đặc biệt là về nội dung ngữ pháp và ngữ cảnh dài. Sự thỏa hiệp là chi phí và độ trễ mỗi token. Chọn LLM khi chiều dài ngữ cảnh, tính nhất quán phong cách hoặc thích ứng miền thông qua việc thúc đẩy các vấn đề hơn là thông qua.

## Chuyển nó

Cứ như `outputs/skill-mt-evaluator.md`- Có thể là:

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

## Các bài tập

1. **Easy.**Dịch một đoạn văn tiếng Anh 5 câu sang tiếng Pháp và trở lại tiếng Anh bằng cách sử dụng `nllb-200-distilled-600M`- Hãy đo mức độ đi lại gần với bản gốc.
2. **Medium.**Thực hiện kiểm tra ID ngôn ngữ trên các kết quả dịch thuật bằng cách sử dụng `fasttext lid.176`hoặc `langdetect`Tham gia vào cuộc gọi MT để các thế hệ ngoài mục tiêu được bắt trước khi quay trở lại.
3. **Hard.**- Đúng rồi.`nllb-200-distilled-600M`trên một bộ phận miền 5000 cặp tùy chọn của bạn. đo BLEU trên một bộ kéo dài trước và sau khi điều chỉnh tinh tế. báo cáo các loại câu nào đã cải thiện và những câu nào đã giảm.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## Đọc thêm

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) bài báo của NLLB.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) tại sao `sacrebleu`là cách duy nhất chính xác để báo cáo BLEU.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) giấy chrF.
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) thực tế điều chỉnh tinh tế qua đường đi.
