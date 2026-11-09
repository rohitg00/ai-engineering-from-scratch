# Liên kết và không rõ ràng về thực thể

> NER tìm thấy "Paris". Cơ quan liên kết quyết định: Paris, Pháp? Paris Hilton? Paris, Texas? Paris (tổng hoàng tử Trojan)?

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## Vấn đề

Một câu nói: "Jordan đánh bại báo chí". NER của bạn gắn thẻ "Jordan" là PERSON.

- Michael Jordan (quả bóng rổ)?
- Michael B. Jordan (đấu kịch)?
- Michael I. Jordan (chuyên gia ML Berkeley   vâng, sự nhầm lẫn này là thực sự trong các bài báo ML)?
- Jordan (thị nước)?
- Jordan (tên đầu tiên tiếng Hy Lạp)?

Liên kết Entity (EL) giải quyết mỗi đề cập đến một mục duy nhất trong cơ sở kiến thức: Wikidata, Wikipedia, DBpedia hoặc miền KB của bạn. Hai nhiệm vụ phụ:

1. **Candidate generation.**Với "Jordan", những mục KB nào có thể tin được?
2. **Disambiguation.**Với bối cảnh, ứng cử viên nào là người phù hợp?

Cả hai bước đều có thể học được. Cả hai đều được đánh giá. Hãng đường ống kết hợp đã ổn định trong một thập kỷ  những thay đổi là chất lượng của sự phân biệt.

## Khái niệm

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**Với hình thức đề cập bề mặt ("Jordan"), tìm kiếm các ứng cử viên trong một chỉ số biệt danh. Từ điển biệt danh Wikipedia bao gồm hầu hết các thực thể có tên: "JFK" → John F. Kennedy, Jacqueline Kennedy, sân bay JFK, JFK (phần phim). Chỉ số điển hình trả về 10-30 ứng cử viên cho mỗi đề cập.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`- Nó hoạt động tốt, nhanh, không có huấn luyện.
2. **Embedding-based (ESS / REL / Blink).**Mã hóa đề cập + ngữ cảnh. Mã hóa mô tả của mỗi ứng cử viên. Chọn max cosine. Tiêu chuẩn 2020-2024.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**Khóa mã tên công thức của thực thể, mã thông báo theo mã thông báo. Được hạn chế cho một bộ tên thực thể hợp lệ để đầu ra được đảm bảo là một ID KB hợp lệ.

**End-to-end vs pipeline.**Các mô hình hiện đại (ELQ, BLINK, ExtEnD, GENRE) chạy NER + thế hệ ứng cử viên + sự phân biệt đối xử trong một lần đi.

### Hai phép đo

- **Mention recall (candidate gen).**Phần vàng được đề cập khi mục KB chính xác xuất hiện trong danh sách ứng cử viên.
- **Disambiguation accuracy / F1.**Với những ứng cử viên đúng, số 1 hàng đầu sẽ đúng bao nhiêu lần.

Một hệ thống với 99% sự không rõ ràng về 80% ứng cử viên sẽ là một đường ống 80%

```figure
gx-entity-linking
```

## Hãy xây dựng nó

### Bước 1: tạo một danh mục từ các chuyển hướng Wikipedia

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Dữ liệu từ Wikipedia: ~ 18M (tên gọi, thực thể) cặp. Tải từ các bãi rác Wikidata. Cung cấp như chỉ mục đảo ngược.

### Bước 2: Sự phân biệt rõ ràng dựa trên bối cảnh

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

Sự chồng chéo Jaccard là một đồ chơi.`code/main.py`bước 2 cho phiên bản biến thể).

### Bước 3: dựa trên nhúng (như BLINK)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

Tại thời gian chỉ mục, nhúng mỗi thực thể KB một lần. Tại thời gian truy vấn, nhúng đề cập + ngữ cảnh một lần, điểm-sản phẩm đối với nhóm ứng cử viên, chọn tối đa.

### Bước 4: liên kết thực thể tạo (tầm niệm)

GENRE giải mã tựa đề Wikipedia của thực thể theo ký tự. Việc giải mã hạn chế (xem bài học 20) đảm bảo chỉ có các tựa đề hợp lệ có thể được xuất phát. Sự tích hợp chặt chẽ với một bộ thử KB hỗ trợ. Người hậu duệ hiện đại là REL-GEN và LLM-prompted EL với đầu ra cấu trúc.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Kết hợp với danh sách trắng (Tình lược `choice`), đây là đường ống EL đơn giản nhất để vận chuyển vào năm 2026.

### Bước 5: đánh giá về AIDA-CoNLL

AIDA-CoNLL là chuẩn EL chuẩn: 1.393 bài báo Reuters, 34k đề cập, các đơn vị Wikipedia.`P@1`) và tỷ lệ phát hiện NIL ngoài KB.

## Những bẫy

- **NIL handling.**Một số đề cập không có trong KB (những thực thể mới nổi, những người mơ hồ). Hệ thống phải dự đoán NIL thay vì đoán được thực thể sai.
- **Mention boundary errors.**NER phía trên nước bỏ lỡ khoảng thời gian bán phần ("Bank of America" chỉ được đánh dấu là "Bank"). EL gọi lại giảm.
- **Popularity bias.**Một đề cập đến "Michael I. Jordan" trên một bài báo ML thường liên kết đến bóng rổ Jordan.
- **Cross-lingual EL.**Bản đồ đề cập trong văn bản Trung Quốc cho các thực thể Wikipedia tiếng Anh.
- **KB staleness.**Các công ty mới, các sự kiện, mọi người không có trong Wikipedia năm ngoái. Các đường ống sản xuất cần một vòng lặp làm mới.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

Mô hình sản xuất xuất vào năm 2026: NER → coref → EL trên mỗi đề cập → sụp đổ các cụm thành một thực thể theo quy luật mỗi cụm.

## Chuyển nó

Cứ như `outputs/skill-entity-linker.md`- Có thể là:

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## Các bài tập

1. **Easy.**Thực hiện các sự phân biệt rõ ràng trước + ngữ cảnh trong `code/main.py`10 đề cập mơ hồ (Paris, Jordan, Apple).
2. **Medium.**Mã hóa 50 đề cập mơ hồ với một bộ biến đổi câu. Nhập vào mô tả của mỗi ứng viên. So sánh sự phân biệt rõ ràng dựa trên nhúng với bối cảnh Jaccard chồng chéo.
3. **Hard.**Xây dựng một KB tên miền 1k-entity (ví dụ: nhân viên + sản phẩm trong công ty của bạn). Thực hiện NER + EL từ đầu đến cuối. đo độ chính xác và thu hồi trên 100 câu được giữ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## Đọc thêm

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) phương pháp tiếp cận trước + ngữ cảnh cơ bản.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) ngựa làm việc dựa trên nhúng.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) tạo EL với mã hóa hạn chế.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) giấy chuẩn.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) đống sản xuất mở.
