# Kết luận về văn bản

> Hệ thống thu thập thông tin cho bạn biết tài liệu nói gì hệ thống trừu tượng cho bạn biết tác giả có ý gì các nhiệm vụ khác nhau, các bẫy khác nhau

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## Vấn đề

Một bài báo 2,000 từ sẽ được đưa vào nguồn cấp dữ liệu của bạn. Bạn cần 120 từ để nắm bắt nó. Bạn có thể chọn ba câu quan trọng nhất từ bài viết (từ) hoặc viết lại nội dung bằng những từ của riêng bạn (từ). Cả hai đều được gọi là tổng kết.

Lưu ý tổng kết trừu tượng là một vấn đề xếp hạng.`k`. Kết quả luôn là ngữ pháp bởi vì nó được nâng lên theo nghĩa đen.

Kết luận trừu tượng là một vấn đề phát triển. Một bộ biến đổi tạo ra văn bản mới được điều chỉnh theo đầu vào.

Bài học này xây dựng cả hai, với chế độ thất bại mỗi người sở hữu.

## Khái niệm

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**Hãy xem bài viết như một biểu đồ mà các nút là câu và cạnh là sự tương đồng.**TextRank**(Mihalcea và Tarau, 2004).

**Abstractive.**Định chỉnh kỹ thuật mã hóa-định dạng hóa biến đổi (BART, T5, Pegasus) trên cặp tài liệu-số tổng kết. Khi suy luận, mô hình đọc tài liệu và tạo ra tổng kết token-by-token thông qua sự chú ý qua chéo. Pegasus đặc biệt sử dụng mục tiêu trước tập lệnh khoảng cách làm cho nó xuất sắc trong việc tóm tắt mà không cần phải điều chỉnh kỹ lưỡng.

Đánh giá với **ROUGE**(Recall-Oriented Understudy for Gisting Evaluation). ROUGE-1 và ROUGE-2 điểm số đơn và lớn chồng chéo. ROUGE-L điểm số dài nhất phổ biến hậu theo dõi. cao hơn là tốt hơn nhưng 40 ROUGE-L là "tốt" và 50 là "đặc biệt".`rouge-score`gói.

```figure
summarize-collapse
```

## Hãy xây dựng nó

### Bước 1: TextRank (tài trừu tượng)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

Hai điều đáng đặt tên. chức năng tương đồng sử dụng log-normalized word overlap, đó là biến thể TextRank gốc. Cosine của các vector TF-IDF cũng hoạt động.

### Bước 2: trừu tượng với BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-big-CNN được điều chỉnh tốt trên CNN / DailyMail corpus. Nó tạo ra các bản tóm tắt theo kiểu tin tức ra khỏi hộp. Đối với các lĩnh vực khác (biện luận khoa học, đối thoại, pháp lý), sử dụng điểm kiểm soát Pegasus tương ứng hoặc điều chỉnh tốt dữ liệu mục tiêu của bạn.

### Bước 3: Đánh giá ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Không có nó, "running" và "run" được tính là từ khác nhau và ROUGE được tính dưới.

### Beyond ROUGE (2026 tổng kết eval)

ROUGE đã là chỉ số tổng hợp thống trị trong hai mươi năm và nó không đủ riêng vào năm 2026. Một phân tích meta quy mô lớn của các bài báo NLG cho thấy:

- **BERTScore**(sự tương đồng nhúng ngữ cảnh) đã có được sự nổi bật đến năm 2023 và hiện được báo cáo cùng với ROUGE trong hầu hết các bài báo tóm tắt.
- **BARTScore**xử lý đánh giá như thế hệ: đánh giá tổng kết bằng cách xác định khả năng một BART được đào tạo trước đã phân bổ nó với nguồn gốc.
- **MoverScore**(Earth Mover's Distance over contextual embeddings) đạt vị trí hàng đầu trong điểm tham khảo tổng hợp năm 2025 vì nó nắm bắt sự chồng chéo ngữ học tốt hơn ROUGE.
- **FactCC**và **QA-based faithfulness**được phổ biến từ năm 2021 đến 2023, bây giờ thường được thay thế bởi **G-Eval**(một chuỗi GPT-4 báo động đánh giá sự liên kết, nhất quán, thông suốt, liên quan đến lý luận chuỗi suy nghĩ).
- **G-Eval**và các cách tiếp cận LLM- thẩm phán tương tự với phán đoán của con người ~ 80% thời gian khi các rubric được thiết kế tốt.

Lời khuyên sản xuất: báo cáo ROUGE-L để so sánh truyền thống, BERTScore để chồng chéo ngữ nghĩa, G-Eval để phù hợp và tính thực tế.

### Bước 4: vấn đề thực tế

Các bản tóm tắt trừu tượng có xu hướng ảo giác. Các bản tóm tắt trừu tượng có nguy cơ ảo giác thấp hơn nhiều vì sản phẩm được gỡ bỏ từ nguồn, mặc dù chúng vẫn có thể gây hiểu lầm nếu các câu nguồn bị giải ngữ cảnh, lỗi thời hoặc trích dẫn không phù hợp. Đây là lý do duy nhất khiến các hệ thống sản xuất vẫn thích các phương pháp trừu tượng cho nội dung phù hợp.

Các loại ảo giác để đặt tên:

- **Entity swap.**Nguồn nói "John Smith". Tổng kết nói "John Brown".
- **Number drift.**Nguồn nói "25,000". Tổng kết nói "25 triệu".
- **Polarity flip.**Nguồn tin nói "đã từ chối lời đề nghị".
- **Fact invention.**Nguồn không đề cập đến CEO.

Các phương pháp đánh giá cho công việc này:

- **FactCC.**Một phân loại nhị phân được đào tạo về liên quan giữa câu nguồn và câu tóm tắt.
- **QA-based factuality.**Hãy hỏi một câu hỏi mô hình QA có câu trả lời trong nguồn. Nếu bản tóm tắt hỗ trợ các câu trả lời khác nhau, hãy đánh dấu.
- **Entity-level F1.**So sánh các thực thể được đặt tên trong nguồn và tổng kết.

Đối với bất cứ thứ gì đối mặt với người dùng mà thực tế là quan trọng (tin tức, y tế, pháp lý, tài chính), trích xuất là mặc định an toàn hơn.

## Sử dụng nó

Số 2026:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

LLM có bối cảnh dài thường đánh bại các mô hình chuyên môn vào năm 2026 khi tính toán không phải là một hạn chế.

## Chuyển nó

Cứ như `outputs/skill-summary-picker.md`- Có thể là:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Các bài tập

1. **Easy.**Đánh giá TextRank trên 5 bài báo tin tức. So sánh 3 câu đầu với một bản tóm tắt tham khảo. đo ROUGE-L. Bạn nên thấy 30-45 ROUGE-L trên các bài báo kiểu CNN / DailyMail.
2. **Medium.**Thực hiện thực tế cấp thực thể: trích xuất các thực thể được đặt tên từ nguồn và tổng kết (spaCy), thu hồi tính toán các thực thể nguồn trong tổng kết và độ chính xác của các thực thể tổng kết so với nguồn. Độ chính xác cao và độ thu hồi thấp có nghĩa là an toàn nhưng ngắn gọn; độ chính xác thấp có nghĩa là các thực thể ảo giác.
3. **Hard.**So sánh BART-chủ-CNN với LLM (Claude hoặc GPT-4) trên 50 bài báo CNN/DailyMail. báo cáo ROUGE-L, tính thực tế (bằng tổ chức F1), và chi phí cho mỗi bản tóm tắt. Tài liệu nơi mỗi người thắng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Đọc thêm

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) giấy khai thác kinh điển.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) BART giấy.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) Pegasus và mục tiêu câu không có dấu hiệu.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) BÁC HN ĐH.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) giấy thực tế cảnh quan.
