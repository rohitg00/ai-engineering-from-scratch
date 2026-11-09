# Xây dựng biểu đồ kiến thức

> NER tìm thấy các thực thể. thực thể liên kết được neo chúng. Khóa kết nối tìm thấy các cạnh giữa chúng. Hình đồ kiến thức là tổng số các nút, cạnh và nguồn gốc của chúng.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## Vấn đề

Một nhà phân tích đọc: "Tim Cook trở thành CEO của Apple vào năm 2011".

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Relation Extraction (RE) biến văn bản tự do thành cấu trúc ba `(subject, relation, object)`- Tóm lại trên một tập hợp và bạn có một biểu đồ kiến thức. Tóm lại và truy vấn và bạn có một nền luận điểm cho RAG, phân tích, hoặc kiểm toán tuân thủ.

Vấn đề năm 2026: LLM rút ra các mối quan hệ nhiệt tình. quá nhiệt tình. Họ ảo giác về ba lần mà văn bản nguồn không hỗ trợ. Nếu không có nguồn gốc, bạn không thể phân biệt ba lần thực sự từ tiểu thuyết có thể tin được. Câu trả lời năm 2026 là đường ống dẫn neo và xác minh theo kiểu AEVS.

## Khái niệm

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`. Các mối quan hệ đến từ một ontology đóng (chất tính của Wikidata, FIBO, UMLS) hoặc một tập mở (tương tự OpenIE, bất cứ điều gì có thể).

**Three extraction approaches.**

1. **Rule / pattern-based.**Các mẫu Hearst: "X như Y" → `(Y, isA, X)`Thêm Regex thủ công, thô lỗ, chính xác, có thể giải thích được.
2. **Supervised classifier.**Với hai sự đề cập của thực thể trong một câu, dự đoán mối quan hệ từ một tập cố định.
3. **Generative LLM.**Hãy yêu cầu mô hình phát ra 3 lần, hoạt động ngoài hộp, cần nguồn gốc, hoặc ảo giác những thứ có vẻ hợp lý.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**Quadro giảm ảo giác hiện tại:

- **Anchor.**Xác định từng khoảng thời gian thực thể và khoảng thời gian từ ngữ liên quan với vị trí chính xác.
- **Extract.**Tạo ba liên kết với các vòng neo.
- **Verify.**Đáp lại từng phần tử ba trở lại với văn bản nguồn; từ chối bất cứ điều gì không được hỗ trợ.
- **Supplement.**Một thẻ bảo hiểm đảm bảo không có khoảng cách neo được giảm.

Tâm giác giảm mạnh, đòi hỏi tính toán nhiều hơn nhưng có thể kiểm tra được.

**The open-vs-closed tradeoff.**

- **Closed ontology.**Danh sách các tính năng cố định (ví dụ, 11,000+ tính năng của Wikidata). Có thể dự đoán được. Có thể tìm kiếm được. Khó để phát minh.
- **Open IE.**Bất kỳ câu nào cũng trở thành mối quan hệ, nhớ lại cao, độ chính xác thấp, rối loạn để hỏi.

KG sản xuất thường trộn lẫn: mở IE cho khám phá, sau đó hợp nhất các mối quan hệ vào một ontology đóng trước khi hợp nhất vào biểu đồ chính.

```figure
relation-triples
```

## Hãy xây dựng nó

### Bước 1: Lấy lấy dựa trên mẫu

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

Nhìn xem`code/main.py`Các mẫu Hearst vẫn được chuyển vào các đường ống cụ thể vì chúng có thể gỡ lỗi.

### Bước 2: khai thác quan hệ tiếp theo theo theo dõi

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL là một bộ trích dẫn mối quan hệ seq2seq dựa trên BART: nó tạo ra ba lần thay vì phân loại các cặp thực thể. Text in, triple out, với tên mối quan hệ lấy từ các thuộc tính Wikidata. Các chuỗi được giải mã vẫn mang theo các chuỗi của REBEL `<triplet>`- `<subj>`và `<obj>`các dấu hiệu, do đó chia trên chúng (như bộ phân tích thẻ mô hình làm) để có được `(subject, relation, object)`ghi chép, điều chỉnh tốt trên dữ liệu giám sát từ xa, chuẩn cơ sở trọng lượng mở.

### Bước 3: Phân xuất bằng LLM với việc neo

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

Hãy kiểm tra mọi lần quay lại với nguồn.`text[start:end] != triple_entity`Đây là bước "thêm nhận" AEVS dưới dạng tối thiểu.

### Bước 4: canonicalize vào một ontology đóng

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

Việc thi công thường chiếm 60-80% công việc kỹ thuật.

### Bước 5: xây dựng một biểu đồ nhỏ và truy vấn

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Đây là nguyên tử của mỗi hệ thống RAG-over-KG. Skala nó bằng các cửa hàng ba RDF (Blazegraph, Virtuoso), đồ thị thuộc tính (Neo4j), hoặc các cửa hàng đồ thị tăng vector.

## Những bẫy

- **Coreference before RE.**"Ông ấy đã thành lập Apple"  RE cần biết "Ông ấy" là ai.
- **Entity canonicalization.**"Apple Inc" và "Apple" phải giải quyết cho cùng một nút.
- **Hallucinated triples.**LLM phát ra ba lần văn bản không hỗ trợ.
- **Relation canonicalization drift.**Các mối quan hệ IE mở không nhất quán ("được sinh ra, " "từ, " " là người bản địa của").
- **Temporal errors.**"Tim Cook là CEO của Apple"  đúng bây giờ, sai trong năm 2005.`P580`giờ bắt đầu, `P582`thời gian kết thúc trong Wikidata).
- **Domain mismatch.**REBEL được đào tạo trên Wikipedia. Các văn bản pháp lý, y học và khoa học thường cần mô hình RE được điều chỉnh tốt.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

Mô hình tích hợp: NER → coref → thực thể liên kết → khai thác mối quan hệ → bản đồ ontology → tải đồ thị. Mỗi giai đoạn là một cổng chất lượng tiềm năng.

## Chuyển nó

Cứ như `outputs/skill-re-designer.md`- Có thể là:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Các bài tập

1. **Easy.**Đưa máy lấy mẫu vào `code/main.py`5 câu trong một bài báo.
2. **Medium.**Sử dụng REBEL (hoặc một LLM nhỏ) trên cùng một câu. So sánh ba lần. Phân tích nào có độ chính xác cao hơn? nhớ lại cao hơn?
3. **Hard.**Xây dựng đường ống AEVS: trích xuất bằng LLM + xác minh khoảng thời gian so với nguồn. đo tỷ lệ ảo giác trước so với sau bước xác minh trên 50 câu kiểu Wikipedia.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## Đọc thêm

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) giấy giám sát từ xa.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) SEQ2SEQ RE ngựa lao động.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) chung IE.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) Thiết kế giảm ảo giác năm 2026.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) truy vấn đồ thị kinh điển.
