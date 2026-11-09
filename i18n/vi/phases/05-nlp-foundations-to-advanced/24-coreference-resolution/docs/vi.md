# Nghị quyết về sự liên kết

> "Bà gọi cho anh ta, anh ta không trả lời, bác sĩ đang ăn trưa". Ba lần nhắc đến hai người và không ai được đặt tên.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## Vấn đề

Cổ xuất mọi đề cập đến Apple Inc. từ một bài viết 300 từ. Mời khi bài viết nói "Apple". Mất khi nó nói "công ty", "những người", "công ty công nghệ khổng lồ của Cupertino", hoặc "công ty Jobs".

Xác định Coreference kết nối mọi biểu thức liên quan đến cùng một thực thể trong thế giới thực vào một cluster. Nó là chất dán giữa NLP cấp độ bề mặt (NER, phân tích) và ngữ nghĩa dòng chảy (IE, QA, tóm tắt, KG).

Tại sao nó quan trọng vào năm 2026:

- Kết luận: "Chủ tịch đã thông báo... " vs "Tim Cook đã thông báo... "  bản tóm tắt nên nêu tên CEO.
- Để trả lời câu hỏi: "Cô ấy gọi ai?" cần phải giải quyết "cô ấy".
- Thu thập thông tin: một biểu đồ kiến thức với "PER1 thành lập Apple" và "Jobs thành lập Apple" như các mục riêng biệt là sai.
- Multi-document IE: kết hợp các đề cập qua các bài viết về cùng một sự kiện là coreference chéo tài liệu.

## Khái niệm

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**Input: một tài liệu. Output: một nhóm các đề cập (span) trong đó mỗi nhóm đề cập đến một thực thể.

**Mention types.**

- **Named entity.**"Tim Cook"
- **Nominal.**"Chủ tịch", "công ty"
- **Pronominal.**"Anh ấy", "cô ấy", "cô ấy", "cô ấy"
- **Appositive.**"Tim Cook, CEO của Apple,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**- Định nghĩa từ ngữ dựa trên cây hợp pháp, sử dụng quy tắc ngữ pháp, cơ sở tốt, khó đánh bại từ ngữ.
2. **Mention-pair classifier.**Đối với mỗi cặp đề cập $(m_i, m_j)$, dự đoán liệu chúng có được hợp tác hơn hay không.
3. **Mention-ranking.**Đối với mỗi đề cập, xếp hạng trước tiên ứng cử viên (bao gồm cả "không có tiền nhiệm").
4. **Span-based end-to-end (Lee et al., 2017).**Các bộ mã hóa biến đổi. Đếm tất cả các ứng cử viên trải dài lên đến một giới hạn chiều dài. Dự đoán điểm số đề cập. Dự đoán xác suất tiền sử cho mỗi khoảng thời gian. Nhóm tham lam.
5. **Generative (2024+).**Đưa ra một LLM: "Dài danh nghĩa mỗi từ trong văn bản này và tiền thân của nó".

**The evaluation metrics.**Năm số liệu tiêu chuẩn (MUC, B3, CEAF, BLANC, LEA) vì không có số liệu nào nắm bắt chất lượng cluster. báo cáo trung bình ba số đầu tiên như CoNLL F1. State of the art vào năm 2026 trên CoNLL-2012: ~83 F1.

**Known hard cases.**

- Mô tả xác định liên quan đến các thực thể giới thiệu các trang trước đó.
- Đường nối anaphora ("cây" → một chiếc xe đã đề cập trước đó).
- Zero anaphora trong các ngôn ngữ như tiếng Trung và tiếng Nhật.
- Cataphora (nghĩa từ trước người tham khảo): "Khi **she**bước vào, Mary mỉm cười".

```figure
coref-links
```

## Hãy xây dựng nó

### Bước 1: Coreference thần kinh được đào tạo trước (AllenNLP / spaCy-xử nghiệm)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

Trong một tài liệu dài hơn, bạn có được một cái gì đó như:
- Nhóm 1: [Apple, Công ty, nó]
- Nhóm 2: [Sản phẩm mới, chúng]

### Bước 2: giải quyết nhân từ dựa trên quy tắc (lạy)

Nhìn xem`code/main.py`cho một thực hiện chỉ có quy định:

1. Các đề cập trích dẫn: các thực thể có tên (vùng lớn), ngụ ngôn (hướng tìm), mô tả xác định ("X").
2. Đối với mỗi đại từ, hãy xem các đề cập trước K và ghi điểm chúng bằng:
   - Thỏa thuận giới tính/ số (thông thức)
   - gần đây (đang gần nhất)
   - vai trò tổng hợp (những chủ đề được ưu tiên)
3. Kết nối tiền sử ghi điểm cao nhất.

Không cạnh tranh với các mô hình thần kinh, nhưng nó cho thấy không gian tìm kiếm và các quyết định mà mô hình phải đưa ra.

### Bước 3: sử dụng LLM cho coreference

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

Hai chế độ thất bại để xem. Thứ nhất, LLM quá hợp nhất ("anh ấy" và "anh ấy" đề cập đến hai người khác nhau). thứ hai, LLM lặng lẽ thả đề cập trong tài liệu dài.

### Bước 4: đánh giá

Các kịch bản conll-2012 tiêu chuẩn tính toán MUC, B3, CEAF-φ4 và báo cáo trung bình. Đối với một đánh giá nội bộ, bắt đầu với độ chính xác ở mức độ trải nghiệm và thu hồi lại bộ thử nghiệm ghi chú của bạn, sau đó thêm liên kết đề cập F1.

## Những bẫy

- **Singleton explosion.**Một số hệ thống báo cáo mỗi đề cập như một cụm riêng B3 là nhẹ nhàng MUC trừng phạt điều này luôn kiểm tra cả ba métrics
- **Pronouns in long context.**Hiệu suất giảm khoảng 15 F1 trên tài liệu trên 2.000 token.
- **Gender assumptions.**Các quy tắc giới tính được mã hóa cứng phá vỡ đối với các giới tham khảo, tổ chức, động vật không nhị phân. Sử dụng các mô hình học tập hoặc điểm trung lập.
- **LLM drift on long docs.**Một cuộc gọi API duy nhất không thể được nhắc đến một cách đáng tin cậy trong 50 đoạn văn. Sử dụng cửa sổ trượt + hợp nhất.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

Mô hình tích hợp sẽ được đưa ra vào năm 2026: chạy NER trước, chạy coref, hợp nhất các cluster cluster thành các đơn vị NER.

## Chuyển nó

Cứ như `outputs/skill-coref-picker.md`- Có thể là:

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Các bài tập

1. **Easy.**Động cơ giải pháp dựa trên quy tắc vào `code/main.py`Đánh giá độ chính xác của liên kết đề cập với sự thật cơ bản.
2. **Medium.**Sử dụng mô hình lõi thần kinh được đào tạo trước trong một bài báo. So sánh các nhóm với các chú thích thủ công của riêng bạn.
3. **Hard.**Xây dựng một đường ống NER được cải thiện: NER đầu tiên, sau đó sáp nhập thông qua các cluster cốt lõi.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## Đọc thêm

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) chương sách giáo khoa kinh điển.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) dựa trên thời gian kết thúc đến kết thúc.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) Chuyên luyện trước đó giúp cải thiện tâm hồn.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) chỉ số chuẩn.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) những câu chuyện cổ điển dựa trên quy tắc.
