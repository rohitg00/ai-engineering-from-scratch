# Capstone 02  RAG trên Codebase (Cross-Repo tìm kiếm ngữ nghĩa)

> Mỗi tổ chức kỹ thuật nghiêm túc vào năm 2026 sẽ thực hiện một tìm kiếm mã nội bộ hiểu ý nghĩa, không chỉ là chuỗi. Sourcegraph Amp, câu trả lời mã cơ sở của Cursor, biểu đồ doanh nghiệp của Augment, bản đồ lại của Aider, MCP nội bộ của Pinterest  cùng một hình dạng. Thử nhiều repos, phân tích với tree-sitter, nhúng các hàm và lớp cấp khối, tìm kiếm lai, xếp hạng lại, trả lời với trích dẫn. Bạch đá cuối này yêu cầu bạn xây dựng một cái xử lý 2M dòng mã trên 10 repos và tồn tại tăng thêm tái chỉ mục trên mỗi cú đẩy git.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## Vấn đề

Đến năm 2026, mọi đại lý mã hóa biên giới sẽ được đưa ra với một lớp lấy lại mã dựa trên vì các cửa sổ ngữ cảnh không giải quyết các câu hỏi liên quan. Môi trường 1M-token của Claude giúp; nó không loại bỏ sự cần thiết cho việc lấy lại xếp hạng. Tìm kiếm ngây thơ về các hạt độc có kết quả về mã được tạo ra, về bản sao monorepo và về đuôi dài của các biểu tượng hiếm khi nhập khẩu. Câu trả lời sản xuất là tìm kiếm lai (thịt + BM25) trên các mảnh có ý thức AST với một thứ hạng lại, được hỗ trợ bởi biểu đồ tham chiếu biểu tượng.

Bạn học được điều này bằng cách lập chỉ mục một hạm đội thực sự không phải một repo hướng dẫn và đo MRR@10, độ trung thành trích dẫn và độ tươi mới tăng. Các chế độ thất bại là cơ sở hạ tầng: một monorepo tệp 100k, một cú đẩy làm lại một nửa các tệp, một truy vấn cần vượt qua bốn repos để trả lời đúng.

## Khái niệm

Một đường ống hấp thụ nhận thức AST phân tích từng tệp bằng tree-sitter, trích xuất hàm và nút lớp, và các khối ở ranh giới nút thay vì cửa sổ token cố định. Mỗi phần có ba đại diện: một bản ghi mật (Voyage-code-3 hoặc nomic-embed-code), các thuật ngữ BM25 hiếm và một bản tóm tắt ngôn ngữ tự nhiên ngắn. Kết luận thêm một phương thức thu hồi thứ ba  người dùng hỏi "như thế nào là X được phép" và kết luận đề cập đến "authz", ngay cả khi mã chỉ có `check_permission`- Tôi không biết.

Việc lấy lại là hợp chất. Một truy vấn phát nổ cả tìm kiếm dày đặc và BM25, hợp nhất top-k, và trao liên minh cho một mã hóa chéo xếp hạng lại (Cohere rerank-3 hoặc bge-reranker-v2-gemma-2b). Danh sách xếp hạng lại đi đến bộ tổng hợp ngữ cảnh dài (Claude Sonnet 4.7 với cache nhanh, hoặc Llama 3.3 70B tự lưu trữ) với hướng dẫn trích dẫn từng yêu cầu theo tập tin và phạm vi dòng. Những câu trả lời không có trích dẫn được từ chối bằng một bộ lọc sau.

Sự tươi mới tăng lên là vấn đề cơ sở hạ tầng. Git push kích hoạt một sự khác biệt: những tệp nào đã thay đổi, những ký hiệu nào đã thay đổi. Chỉ có các khối bị ảnh hưởng được nhúng lại. Biên cạnh ký hiệu chéo tệp bị ảnh hưởng (tài nhập, gọi phương pháp) được tính lại. Chỉ số vẫn phù hợp mà không cần xử lý lại 2M dòng mỗi commit.

## Kiến trúc

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## Thống

- Phân tích: người giữ cây với 17 ngữ pháp ngôn ngữ (Python, TS, Rust, Go, Java, C++, vv)
- Thiết lập mật: Voyage-code-3 (được lưu trữ) hoặc nomic-embed-code-v1.5 (self-host), bge-code-v1 fallback
- Chỉ số Sparse: Tantivy (Rust) với BM25F, cân bằng trường trên tên biểu tượng so với thân thể
- Vector DB: Qdrant 1.12 với tìm kiếm lai, hoặc pgvector + pgvector scale cho các nhóm dưới 50M vector
- Mô hình tổng kết mảnh: Claude Haiku 4.5 hoặc Gemini 2.5 Flash, được lưu trữ trong cache nhanh
- Tỷ lệ xếp hạng lại: Cohere renank-3 hoặc bge-renanker-v2-gemma-2b tự lưu trữ
- Phân phối: LlamaIndex Workflows cho ăn, LangGraph cho trình điều tra
- Bộ tổng hợp: Claude Sonnet 4.7 (1M context) với bộ nhớ cache nhanh chóng
- Hình biểu tượng: Neo4j (được quản lý) hoặc kuzu (đã nhúng) cho các cạnh nhập khẩu và gọi
- Khả năng quan sát: Làn dài của ống nhòm mỗi bước thu thập + tổng hợp

```figure
ce-hybrid-retrieval
```

## Hãy xây dựng nó

1. **Ingestion walker.**Lặp lại lịch sử git trên mỗi nút bấm. Thu thập các tệp đã thay đổi. Đối với mỗi tệp, phân tích với tree-sitter, hàm chiết xuất và các nút lớp với khoảng nguồn đầy đủ của chúng. Giả các tệp chunk `{repo, path, start_line, end_line, symbol, body}`- Tôi không biết.

2. **Chunk summarizer.**Các bộ phận hàng trong Haiku 4.5 gọi với nhanh chóng lưu trữ trong bộ nhớ nhớ trước của hệ thống.

3. **Embedding pool.**Hai hàng song song: mật (Voyage-code-3 batch 128) và tóm tắt (những mô hình tương tự, nhưng trên chuỗi tóm tắt).`{repo, path, start_line, end_line, symbol, kind}`- Tôi không biết.

4. **BM25 index.**Chỉ số Tantivy có trọng lượng trường: trọng lượng tên biểu tượng 4, trọng lượng cơ thể biểu tượng 1, trọng lượng tổng hợp 2. Cho phép truy vấn "đ tìm hàm có tên X" bên cạnh "đ tìm hàm làm X".

5. **Symbol graph.**Đối với mỗi phần, ghi biên: nhập khẩu (tệp này sử dụng biểu tượng Y từ repo Z), gọi (tức năng này gọi phương pháp M trên lớp C), di sản. Cung cấp trong kuzu. Được sử dụng tại thời điểm truy vấn để mở rộng truy xuất qua ranh giới repo.

6. **Query agent.**LangGraph với ba nút.`retrieve`lửa dày đặc + BM25 song song, giảm gấp đôi bằng (repo, đường đi, biểu tượng). `rerank`chạy cross-encoder trên top-50 và giữ top-10. `synth`gọi Claude Sonnet 4.7 với các phần xếp hạng lại trong ngữ cảnh, lưu trữ hệ thống prompt, yêu cầu file:line trích dẫn.

7. **Citation enforcement.**Phân tích sản xuất mô hình; bất kỳ yêu cầu nào mà không có một `(repo/path:start-end)`Anchor được đánh dấu để hỏi lại hoặc bỏ rơi. trả lời chỉ trích trả lời cho người dùng.

8. **Incremental re-index.**Trên mỗi webhook, tính toán sự khác biệt cấp độ biểu tượng. Chỉ nhập lại các khối mà văn bản đã thay đổi. tính lại các cạnh biểu tượng cho các khối mà nhập khẩu đã thay đổi. đo: một cú đẩy 50 tập tin tái lập chỉ mục trong dưới 60 giây cho một hạm đội 2M-LOC.

9. **Eval.**Đánh dấu 100 câu hỏi qua hồ sơ với hồ sơ vàng: câu trả lời dòng. đo MRR@10, nDCG@10, độ trung thành trích dẫn (phần nhỏ các tuyên bố với các neo xác minh) và độ trễ p50/p99.

## Sử dụng nó

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## Chuyển nó

Kỹ năng được giao `outputs/skill-codebase-rag.md`. Với một tập hợp các repos, nó sẽ đưa ra đường ống tiêu thụ, chỉ số lai và đại lý truy vấn, và trả lại câu trả lời được trích dẫn cho bất kỳ câu hỏi qua repo nào.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## Các bài tập

1. Thay đổi Voyage-code-3 cho code tự lưu trữ tên đính kèm. đo delta MRR@10. báo cáo xem khoảng cách đã đóng với việc xếp hạng lại được bật hay không.

2. Nhổ 20% mã tạo (bảng sưởi sản xuất bằng LLM) vào khoang và đánh giá lại. Quan sát độc tính thu hồi. Thêm một cờ "được tạo" vào tải trọng hữu ích và giảm trọng lượng các lần đánh.

3. Đánh giá tìm kiếm lai Qdrant so với pgvector + pgvector scale ở kích thước cơ thể của bạn.

4. Thêm một kiểm tra dẫn dắt dựa trên lấy mẫu: hàng tuần, lặp lại đánh giá 100 câu hỏi.

5. Tăng đến độ phân giải biểu tượng đa ngôn ngữ: một hàm Python gọi dịch vụ Go qua gRPC. Sử dụng biểu đồ biểu tượng để liên kết chúng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## Đọc thêm

- [Sourcegraph Amp](https://ampcode.com) Thông tin về mã liên quan đến sản xuất
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) đá đá đá đá này
- [Aider repo-map](https://aider.chat/docs/repomap.html) Tree-sitter xếp hạng repo view
- [Augment Code enterprise graph](https://www.augmentcode.com) biểu tượng thương mại-graph RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) Thực hiện tham chiếu
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) Chi tiết về mã hành trình-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) Quý vị liên kết mã hóa chéo
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) Khán giả liên quan đến nền tảng nội bộ
