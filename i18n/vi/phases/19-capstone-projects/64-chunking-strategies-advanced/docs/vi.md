# Các chiến lược làm cho các mảnh vỡ nhỏ, so sánh

> Chunking quyết định cái gì máy quay của bạn có thể xuất hiện, sai giới hạn và không có mô hình nhúng, không có re-ranker, không có LLM có thể sửa chữa thiệt hại xuống dòng.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## Mục tiêu học tập
- Thực hiện năm chiến lược chia nhỏ từ đầu: cửa sổ cố định, câu, chia nối, nhóm ngữ nghĩa và tiêu đề đánh dấu cấu trúc.
- Đánh giá recall@k trên một bộ phận cố định với các câu trả lời có nhãn vàng và giải thích tại sao một chiến lược thắng trên văn bản và một chiến lược khác thắng trên tài liệu kỹ thuật.
- Đọc phân phối dài các mảnh và nhận ra các chế độ thất bại mỗi chiến lược tiêm: câu mồ côi, cắt giữa các biểu tượng, các mảnh chỉ có tiêu đề, trôi dạt ngữ học.
- Chọn một mặc định cho một tập hợp mới mà không chạy điểm chuẩn bằng cách kiểm tra ba tính chất: loại tài liệu, chiều dài đoạn trung bình và liệu định dạng có cấu trúc rõ ràng hay không.

## Vấn đề

Mỗi đường ống RAG bắt đầu bằng cách cắt các tài liệu nguồn thành các mảnh nhỏ đủ để mô hình nhúng phù hợp với chúng và đủ lớn để mỗi mảnh mang lại một ý tưởng tự chủ.

Một câu hỏi hỏi "nước thềm bỏ phiếu ngân sách trông như thế nào" chỉ có thể thành công nếu phần giữ ngưỡng bỏ phiếu có thể đạt được. Nếu phân chia cửa sổ cố định cắt giá trị ngưỡng từ ngữ cảnh xung quanh, việc nhúng chuyển sang một cụm khác, điểm BM25 giảm, các nhà xếp hạng lại thấy tiếng ồn, và câu trả lời LLM tạo ra là sai. Bài báo năm 2024 "LongRAG: Tăng thế hệ thu hồi tăng cường với LLM ngữ cảnh dài" đo lường sự thay đổi tuyệt đối 35% trong việc thu hồi chỉ từ sự lựa chọn chunking. Công việc tiếp theo vào năm 2025 về tiêu đề phần ngữ cảnh đã thu hẹp khoảng cách nhưng không đóng cửa nó.

Bài học này xây dựng 5 chiến lược bên cạnh nhau, chạy chúng chống lại một bộ đồ cố định với các khoảng trả lời được dán nhãn vàng, và cho phép bạn tự đọc số gọi lại.

## Khái niệm

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Chiếc cửa sổ cố định

Hình ảnh của một câu được cắt ở vị trí N xuất hiện toàn bộ bên trong phần bắt đầu ở vị trí N - chồng chéo.

### Câu án

Chia biên giới câu bằng regex hoặc máy trạng thái đơn giản. Lắp một hoặc nhiều câu vào một phần lên đến ngân sách ký tự mục tiêu. Ngừng cắt giữa từ. vẫn cắt giữa đoạn văn và giữa phần.

### Phân chia tái phát

Chiến lược phân cấp được phổ biến bởi các thư viện thời kỳ 2023. Hãy cố gắng phân chia trên phân chia mạnh nhất trước tiên (trường mới hai lần, đoạn), quay lại với thứ tiếp theo (trường mới duy nhất), sau đó đến các câu, sau đó đến các ký tự. Sự tái lặp đi lặp lại kết thúc khi phần phù hợp với ngân sách.

### Nhóm phân tích ngữ nghĩa

Nhúng vào mỗi câu. Nhóm các câu liền kề mà chia sẻ một tâm điểm chủ đề. Cắt bất cứ khi nào sự tương đồng chạy với tâm điểm giảm xuống dưới ngưỡng. Biên giới phản ánh ý nghĩa, không phải ký tự. chậm hơn để xây dựng và phụ thuộc vào mô hình nhúng, nhưng kiên cường chống lại các tài liệu thay đổi chủ đề trong một đoạn.

### Các tiêu đề định nghĩa cấu trúc

Đối với các tài liệu có cấu trúc rõ ràng (đánh dấu, văn bản tái cấu trúc, các phần có số theo kiểu RFC), cắt ở ranh giới tiêu đề. Mỗi phần trở thành tiêu đề cộng với mọi thứ bên dưới nó xuống tiêu đề tiếp theo ở cùng một cấp độ hoặc cao hơn. Các phần nhỏ nhất cho mỗi chủ đề, nhưng chỉ có sẵn khi cơ thể được hình thành tốt.

### Làm thế nào recall@k đo lường lựa chọn biên giới

Một truy vấn có nhãn vàng mang theo các tính toán chính xác của khoảng thời gian trả lời bên trong tài liệu nguồn. Sau khi làm mảnh, bạn hỏi: liệu bất kỳ mảnh nào trên top-k mà máy quay trở lại có chồng chéo với khoảng thời gian vàng không? Nếu có, recall@k cho truy vấn đó là 1. Nếu không, nó là 0. Tỷ lệ trung bình trên bộ truy vấn. Thực hiện đánh giá tương tự cho mỗi chiến lược và sự phân bố cho bạn thấy chính sách ranh giới nào tồn tại trong corpus bạn có.

```figure
ci-chunk-boundaries
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `fixed_window(text, size, overlap)`- cơ sở.
- `sentence_chunks(text, target)`- một câu đơn giản.
- `recursive_split(text, separators, target)`- sự tái diễn hàng bậc.
- `semantic_chunks(text, similarity_threshold)`- tập hợp dựa trên trung tâm trên một việc nhúng xác định giả mạo.
- `structural_markdown(text)`- Bộ phân chia có ý thức về tiêu đề.
- `mock_embed(text, dim)`- một bản nhúng dựa trên hash để vòng chạy offline.
- `DenseIndex`- cùng một hình dạng được sử dụng trong bài học thu hồi hybrid của Phase 19 Track B.
- `eval_recall(strategy, corpus, queries, k)`- vòng so sánh.
- A `main()`chạy mọi chiến lược trên bộ phận thiết bị và in một bảng recall@k.

Đi đi.

```bash
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một bảng nhỏ với một hàng cho mỗi chiến lược và một cột cho mỗi k. Câu thua trên bộ phận cấu trúc. Đánh dấu cấu trúc thắng trên bộ phận đánh dấu. Đánh dấu lặp giữ riêng của mình trên bộ phận hỗn hợp bởi vì sự lặp lại thích nghi.

## Các chế độ thất bại bảng sẽ không ẩn

**Orphan sentences.**Việc đóng gói câu tạo ra các đoạn mà bỏ lỡ câu chủ đề.

**Mid-symbol cuts.**Hình ảnh bên trong của một cửa sổ cố định hoặc YAML sẽ chia một nhận dạng thành hai nửa.

**Header-only chunks.**Đánh dấu cấu trúc phát ra một phần không chứa gì ngoài `## Title`Trình ra những thứ đó hoặc đính kèm đoạn đầu tiên của phần tiếp theo.

**Semantic drift.**Các phân tích phân tích ngữ nghĩa được cắt giảm khi các tập hợp đều về chủ đề. Một phần 5000 ký tự đóng gói nhiều câu trả lời cụ thể vào một nhúng phân tán. Kết hợp ngữ nghĩa với một nắp ký tự cứng.

**Stale embeddings.**Cluster ngữ nghĩa sử dụng mô hình nhúng. Nếu bạn thay đổi mô hình, bạn cũng thay đổi các mảnh. Pin mô hình mảnh tách biệt với mô hình tìm kiếm hoặc xây dựng lại chỉ mục cùng nhau.

## Chọn một mặc định mà không chạy điểm tham chiếu

Ba tính chất quyết định các chunker mặc định cho một cơ thể mới.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

Khi nghi ngờ, chọn chia nối lại. Đó là cơ sở mạnh nhất của một chiến lược.

## Sử dụng nó

Các mô hình sản xuất:

- Thực hiện đánh giá trước khi bạn gửi một đường ống mới; đừng tin vào chiến lược thư viện của bạn mặc định.
- Lặp lại đánh giá bất cứ khi nào bạn thay đổi mô hình nhúng hoặc hỗn hợp corpus; người chiến thắng phụ thuộc vào corpus.
- Giữ tên chiến lược trong metadata của mỗi phần để bạn có thể gán lại hồi quy sau đó.

## Chuyển nó

Hệ thống RAG đầu đến cuối Track F trong bài học 69 sử dụng chunker được chọn ở đây như là giai đoạn đầu tiên của nó.`eval_recall`chọn chiến lược thắng trên cơ thể của bạn và cung cấp nó cho trước.

## Các bài tập

1. Thêm một chiến lược thứ sáu: token-window sử dụng `tiktoken`So sánh với cửa sổ cố định trên cùng một thiết bị.
2. Đưa một phần nhỏ 30% khối mã vào bộ phận văn bản, chạy lại bảng, giải thích tại sao mọi chiến lược ngoại trừ dấu chấm cấu trúc đều mất nhớ.
3. Thay thế việc nhúng xác định bằng một từ nhà cung cấp thực tế của dự án của bạn. đo delta thu hồi cụm từ. báo cáo liệu sự phân tán giữa các chiến lược có mở rộng hay thu hẹp hay không.
4. Thêm một `summary`trường mỗi phần: mô tả trung tâm một câu. Lại chạy đánh giá với bản tóm tắt được gắn vào cơ thể phần. đo nâng hồi tưởng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## Đọc thêm

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- Giai đoạn 11 Bài học 06 - Các cơ bản RAG
- Giai đoạn 11 bài học 07 - RAG nâng cao
- Giai đoạn 19 bài học 65 - thu thập lai tạo xếp hạng các mảnh sản xuất ở đây
- Giai đoạn 19 bài học 68 - đánh giá đánh giá lựa chọn chiến lược trong sản xuất
