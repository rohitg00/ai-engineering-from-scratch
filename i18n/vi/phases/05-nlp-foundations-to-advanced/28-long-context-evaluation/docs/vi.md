# Đánh giá trong bối cảnh dài  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro quảng cáo 10M token của ngữ cảnh. với 1M token, 8-nháp MRCR giảm xuống còn 26,3%. quảng cáo ≠ sử dụng. đánh giá ngữ cảnh dài cho bạn biết khả năng thực tế của mô hình bạn đang vận chuyển trên.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## Vấn đề

Bạn có một hợp đồng 200 trang. Mô hình tuyên bố một ngữ cảnh 1M token. Bạn dán hợp đồng vào và hỏi: "Điều khoản chấm dứt là gì?" Mô hình trả lời  nhưng trả lời từ trang bìa bởi vì điều khoản chấm dứt nằm ở độ sâu 120k token, sau khi mô hình thực sự tham dự.

Đây là khoảng cách trong khả năng ngữ cảnh năm 2026. Các bảng tính mô tả là 1M hoặc 10M. Thực tế nói 60-70% là có thể sử dụng, và "có thể sử dụng" phụ thuộc vào nhiệm vụ.

- **Retrieval (single needle in haystack):**gần hoàn hảo lên đến mức tối đa được quảng cáo trên các mô hình biên giới.
- **Multi-hop / aggregation:**Tệ dần hơn ~ 128k trên hầu hết các mô hình.
- **Reasoning over dispersed facts:**nhiệm vụ đầu tiên thất bại.

Đánh giá ngữ cảnh dài đo lường các trục này. Bài học này nêu tên các điểm chuẩn, mỗi điểm đo thực sự, và cách xây dựng một bài kiểm tra kim cáp tùy chỉnh cho miền của bạn.

## Khái niệm

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**Đặt một sự kiện ("từ phép thuật là dứa") ở độ sâu được kiểm soát trong một ngữ cảnh dài. Hãy yêu cầu mô hình lấy lại nó.

**RULER (Nvidia, 2024).**13 loại nhiệm vụ trong 4 loại: lấy (một / nhiều chìa khóa / nhiều giá trị), theo dõi đa hop (bước theo dõi biến), tổng hợp (tần số từ chung), QA. Độ dài ngữ cảnh có thể cấu hình được (4k đến 128k +).

**LongBench v2 (2024).**503 câu hỏi nhiều lựa chọn, ngữ cảnh từ 8k-2M, sáu loại nhiệm vụ: QA đơn tài liệu, QA đa tài liệu, học tập trong ngữ cảnh dài, đối thoại dài, mã repo, dữ liệu có cấu trúc dài.

**MRCR (Multi-Round Coreference Resolution).**Các biến thể 8 con, 24 con, 100 con, cho thấy một mô hình có thể làm trò chuyện với bao nhiêu sự thật trước khi sự chú ý suy giảm.

**NoLiMa.**"Tháp không phải là từ ngữ". Tháp và câu hỏi không chia sẻ sự chồng chéo theo nghĩa đen; tìm kiếm đòi hỏi một bước của lý luận ngữ nghĩa.

**HELMET.**Chuẩn bị nhiều tài liệu, hỏi bất cứ ai, kiểm tra sự chú ý chọn lọc.

**BABILong.**Chuyển vào các chuỗi lý luận của ABI trong những đống lúa mì không liên quan.

### Điều gì thực sự phải báo cáo

- **Advertised context window.**Số mẫu giấy.
- **Effective retrieval length.**NIAH vượt qua một số ngưỡng (ví dụ, 90%).
- **Effective reasoning length.**Multi-hop hoặc tổng hợp vượt qua ngưỡng đó.
- **Degradation curve.**Độ chính xác so với chiều dài ngữ cảnh, được vẽ theo loại nhiệm vụ.

Hai số cho trang thông số của bạn: có hiệu quả thu thập và có hiệu quả lý luận.

```figure
gx-niah-decay
```

## Hãy xây dựng nó

### Bước 1: một NIAH tùy chỉnh cho tên miền của bạn

Nhìn xem`code/main.py`- Hàm xương:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

Tháo `depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`Hình ảnh nhiệt bản đồ là thẻ NIAH cho mô hình mục tiêu của bạn.

### Bước 2: một biến thể đa kim

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

Những câu hỏi như "Ba từ phép thuật là gì?" đòi hỏi phải tìm lại cả ba từ.

### Bước 3: Chịu định vị biến đa hop (tương tự RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

Câu trả lời đòi hỏi phải liên kết ba nhiệm vụ. mô hình biên ở 128k thường giảm đến độ chính xác 50-70% ở đây.

### Bước 4: LongBench v2 trên đống của bạn

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

Báo cáo chính xác theo từng loại điểm tổng hợp che giấu sự khác biệt lớn về cấp độ nhiệm vụ.

## Những bẫy

- **NIAH-only evaluation.**Đi qua NIAH với 1M token không nói gì về multi-hop.
- **Uniform depth sampling.**Nhiều thực hiện chỉ kiểm tra độ sâu = 0,5. Độ sâu kiểm tra = 0, 0, 25, 0,5, 0,75, 1.0  hiệu ứng "lạc trong giữa" là thực.
- **Lexical overlap with filler.**Nếu kim chia sẻ các từ khóa với bộ lấp đầy, việc lấy lại trở nên tầm thường. Sử dụng kim loại NoLiMa không chồng chéo.
- **Ignoring latency.**Các lệnh mã thông báo 1M mất 30-120 giây để điền trước. đo thời gian đến mã thông báo đầu tiên cùng với độ chính xác.
- **Vendor-self-reported numbers.**OpenAI, Google, Anthropic đều xuất bản điểm số của riêng mình. Luôn chạy lại độc lập trên trường hợp sử dụng của bạn.

## Sử dụng nó

Số 2026:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

Quy tắc ngón tay cho sản xuất: không bao giờ tin vào một cửa sổ ngữ cảnh cho đến khi bạn có nhiệm vụ lý luận NIAH + 1 ở chiều dài dự định của bạn.

## Chuyển nó

Cứ như `outputs/skill-long-context-eval.md`- Có thể là:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## Các bài tập

1. **Easy.**Xây dựng một NIAH với 3 độ sâu (0.25, 0.5, 0.75) × 3 chiều dài (1k, 4k, 16k).
2. **Medium.**Thêm một biến thể 3 kim. đo lấy tất cả 3 ở mỗi chiều dài. So sánh với tỷ lệ vượt qua kim đơn ở cùng một chiều dài.
3. **Hard.**X1 → X2 → X3, với 3 hops) được nhúng vào 64k của bộ sạc. đo độ chính xác trên 3 mô hình biên giới. báo cáo độ dài lý luận hiệu quả cho mỗi mô hình.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## Đọc thêm

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) NIAH repo ban đầu.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) chỉ số chuẩn đa nhiệm.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) đánh giá ngữ cảnh dài trong thế giới thực.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) kim cứng hơn.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) lý luận trong đống cỏ.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) giấy phân biệt độ sâu.
