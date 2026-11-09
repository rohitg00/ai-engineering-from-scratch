# Hệ thống trả lời câu hỏi

> Ba hệ thống hình thành QA hiện đại. Extractive tìm thấy khoảng thời gian. lấy lại tăng cường chúng đất trong tài liệu. Generative sản xuất câu trả lời. Mỗi trợ lý AI hiện đại là một hỗn hợp của ba.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## Vấn đề

Người dùng gõ "Lần đầu tiên iPhone ra mắt khi nào?" và mong đợi "Ngày 29 tháng 6 năm 2007". Không phải "lịch sử của Apple dài và đa dạng". Không phải "2007" ngồi cách ly mà không có câu. Một câu trả lời trực tiếp, có nền tảng, chính xác.

Ba kiến trúc đã thống trị QA trong thập kỷ qua.

- **Extractive QA.**Với một câu hỏi và một đoạn văn được biết có chứa câu trả lời, tìm các chỉ số bắt đầu và kết thúc của khoảng thời gian trả lời trong đoạn văn.
- **Open-domain QA.**Không có đoạn văn được đưa ra. Nhận đoạn văn liên quan trước, sau đó lấy hoặc tạo ra một câu trả lời. Đây là nền tảng của mọi đường ống dẫn RAG ngày nay.
- **Generative / Closed-book QA.**Một mô hình ngôn ngữ lớn trả lời từ bộ nhớ thông số của nó không có truy xuất nhanh nhất trong suy luận, ít nhất đáng tin cậy trên các sự kiện.

Xu hướng năm 2026 là lai: lấy lại một vài đoạn tốt nhất, sau đó yêu cầu một mô hình tạo ra câu trả lời dựa trên những đoạn đó. Đó là RAG, và bài học 14 bao gồm một nửa chiều sâu về việc lấy lại. Bài học này xây dựng một nửa QA.

## Khái niệm

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**Câu hỏi mã hóa và đoạn đường cùng với một biến thể (các bộ phận của BERT). Đào tạo hai đầu tiên dự đoán các chỉ số bắt đầu và kết thúc của câu trả lời.

**Retrieval-augmented (RAG).**Hai giai đoạn, đầu tiên, một chiếc Retriever tìm thấy đỉnh...`k`Các đoạn văn từ một tập thể. Thứ hai, một người đọc (từ hoặc tạo) tạo ra câu trả lời bằng cách sử dụng những đoạn văn đó.

**Generative.**Một LLM chỉ có trình giải mã (GPT, Claude, Llama) trả lời từ các trọng lượng học. Không có bước lấy lại. xuất sắc về kiến thức chung, thảm họa về các sự kiện hiếm hoặc gần đây. Tỷ lệ ảo giác tương phản với tần số thực tế trong dữ liệu trước khi tập luyện.

```figure
qa-span
```

## Hãy xây dựng nó

### Bước 1: QA khai thác với mô hình được đào tạo trước

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`được đào tạo trên SQuAD 2.0, bao gồm các câu hỏi không có câu trả lời.`question-answering`pipeline trả lại khoảng thời gian ghi điểm cao nhất ngay cả khi điểm số null của mô hình thắng  nó không * không * tự động trả lại câu trả lời trống. Để có được hành vi "không trả lời" rõ ràng, vượt qua `handle_impossible_answer=True`cho cuộc gọi đường ống: đường ống sau đó trả lời trống chỉ khi điểm không vượt quá mỗi điểm span.`score`trường dù sao.

### Bước 2: một đường ống tăng cường thu hồi (phác thảo)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

Các đoạn đường ống dẫn hai giai đoạn. Density retriever (Sentence-BERT) tìm thấy các đoạn văn liên quan theo sự tương đồng ngữ nghĩa. Extractive reader (RoBERTa-SquAD) kéo khoảng câu trả lời từ các đoạn văn trên kết hợp.

### Bước 3: tạo ra với RAG

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

Mô hình prompt là quan trọng. Nói rõ ràng cho mô hình để đặt nền trong bối cảnh và trả lời "Tôi không biết" khi bối cảnh không đủ làm giảm tỷ lệ ảo giác 40-60% so với việc nhắc nhở ngây thơ. Mô hình phức tạp hơn thêm trích dẫn, điểm độ tin cậy và thu hoạch cấu trúc.

### Bước 4: đánh giá phản ánh thế giới thực

SQUAD sử dụng **Exact Match (EM)**và **token-level F1**- Tôi không biết. EM là một sự phù hợp nghiêm ngặt sau khi bình thường hóa (bản chữ dưới, dấu chấm thoát, loại bỏ các mục)  hoặc dự đoán phù hợp chính xác hoặc nó ghi điểm 0. F1 được tính toán qua sự chồng chéo giữa dự đoán và tham chiếu và cung cấp tín dụng một phần. Cả hai đoạn phần tín dụng thấp: "Ngày 29 tháng 6 năm 2007" so với "Ngày 29 tháng 6 năm 2007" thường nhận được 0 EM (sự bình thường hóa của sự phá vỡ trật tự) nhưng vẫn kiếm được F1 đáng kể từ các token chồng chéo.

Đối với sản xuất QA:

- **Answer accuracy**(Điều trị của LLM hoặc đánh giá của con người, vì các số liệu không nắm bắt sự tương đương ngữ nghĩa).
- **Citation accuracy.**Bài trích dẫn có thực sự hỗ trợ câu trả lời không? Không có gì khác để tự động kiểm tra với chuỗi phù hợp giữa các trích dẫn được tạo và các đoạn trích dẫn được lấy lại.
- **Refusal calibration.**Khi câu trả lời không nằm trong các đoạn trích được tìm thấy, hệ thống có nói đúng "Tôi không biết" không?
- **Retrieval recall.**Trước khi đánh giá người đọc, hãy đo lường xem người tìm kiếm có được lối đi đúng vào phía trên không.`k`Một người đọc không thể sửa chữa một đoạn văn bị mất.

### RAGAS: khung đánh giá sản xuất năm 2026

`RAGAS`được xây dựng đặc biệt cho các hệ thống RAG và là mặc định vận chuyển vào năm 2026. Nó có bốn chiều mà không cần tham chiếu vàng:

- **Faithfulness.**Mỗi câu hỏi trong câu trả lời có xuất phát từ bối cảnh được lấy lại không?
- **Answer relevance.**Câu trả lời có giải quyết câu hỏi không? được đo bằng cách tạo ra các câu hỏi giả thuyết từ câu trả lời và so sánh với câu hỏi thực.
- **Context precision.**Trong số các mảnh thu hồi, phần nào thực sự có liên quan?
- **Context recall.**Bộ thu hồi có chứa tất cả thông tin cần thiết không?

Đánh giá không tham khảo cho phép bạn đánh giá lưu lượng sản xuất trực tiếp mà không có câu trả lời vàng được chọn. Layer LLM-as-judge trên cùng cho các câu hỏi mở khi métrics phù hợp chính xác là vô dụng.

`pip install ragas`Đưa máy thu hồi + đọc, lấy 4 scalar cho mỗi truy vấn, cảnh báo về sự lùi lại.

## Sử dụng nó

- Cổ hàng năm 2026.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

Quản lý chất lượng trích xuất đã trở nên không hiện đại vào năm 2026 bởi vì RAG với LLM xử lý nhiều trường hợp hơn. Nó vẫn được đưa ra trong các bối cảnh mà cần trích dẫn theo nghĩa đen: nghiên cứu pháp lý, tuân thủ quy định, công cụ kiểm toán.

## Chuyển nó

Cứ như `outputs/skill-qa-architect.md`- Có thể là:

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## Các bài tập

1. **Easy.**Thiết lập đường ống khai thác SQuAD trên 10 đoạn Wikipedia. Làm thủ công 10 câu hỏi. đo số câu trả lời đúng bao nhiêu lần. Bạn nên thấy 7-9 đúng nếu các đoạn và câu hỏi sạch sẽ.
2. **Medium.**Thêm một phân loại từ chối. Khi điểm thu hồi cao nhất dưới ngưỡng (chẳng hạn là 0,3 cosine), trả lại "Tôi không biết" thay vì gọi cho người đọc.
3. **Hard.**Xây dựng một đường ống RAG trên một tập hợp tài liệu 10.000 tùy chọn của bạn. Thực hiện thu thập lai (BM25 + dày) bằng sự hợp nhất RRF (xem bài học 14). đo độ chính xác trả lời với và không có bước lai. Tài liệu loại câu hỏi nào có lợi nhiều nhất.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## Đọc thêm

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) giấy chuẩn.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR, máy thu hồi mật độ của QA.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) tờ báo đặt tên RAG.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) khảo sát toàn diện RAG.
