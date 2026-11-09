# Tưởng nhớ lai: Vector + Graph + KV

> Bộ nhớ lai chạy ba cửa hàng song song  vector cho sự tương đồng ngữ nghĩa, KV cho tìm kiếm thực tế nhanh, biểu đồ cho lý luận mối quan hệ thực thể  với một lớp điểm số kết hợp chúng khi lấy lại. Đây là một mô hình sản xuất được sử dụng rộng rãi cho bộ nhớ bên ngoài; Mem0 (Chhikara et al., 2025) là một thực hiện tham chiếu.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao một kho lưu trữ duy nhất (chỉ vector, chỉ biểu đồ, chỉ KV) là không đủ cho bộ nhớ đại lý.
- Hãy cho tên 3 cửa hàng song song của Mem0 và mỗi cửa hàng tối ưu hóa cho những gì.
- Mô tả điểm kết hợp của Mem0  liên quan, quan trọng, gần đây  và lý do tại sao nó là một tổng hợp cân nhắc, chứ không phải là một hệ thống phân cấp.
- Thực hiện một bộ nhớ đồ chơi ba tầng trong stdlib với một `add()`- Nó viết cho cả ba và một.`search()`kết quả kết hợp.

## Vấn đề

Mỗi cửa hàng chỉ phù hợp với một trong ba lớp truy vấn:

- **Semantic similarity**"Chúng ta đã thảo luận về sự trôi dạt của đại lý tuần trước?" Vector thắng; KV và biểu đồ thất bại.
- **Fact lookup** "nọm điện thoại của người dùng là gì?" KV thắng; vector là lãng phí, biểu đồ là quá chết.
- **Relationship reasoning** "customers share the same billing entity?" Graph thắng; vector và KV không thể trả lời.

Các đại lý sản xuất phát hành cả ba trong một phiên.`add`- Không.`search`bề mặt với một chức năng ghi điểm mà hợp nhất chúng.

## Khái niệm

### Ba cửa hàng song song

Mem0 (arXiv:2504.19413, tháng 4 năm 2025) ngày `add(text, user_id, metadata)`- Có thể là:

1. Thu thập các sự kiện ứng cử viên từ văn bản (một bước được thúc đẩy bởi LLM).
2. Viết từng sự thật vào kho vector (trình tích hợp) để tìm kiếm ngữ nghĩa.
3. Viết từng sự kiện vào kho KV được khóa vào (user_id, fact_type, entity) cho $O(1)$Tìm kiếm.
4. Viết từng sự kiện vào kho đồ họa (Mem0g) như các cạnh được gõ cho các truy vấn mối quan hệ.

- Đưa ra`search(query, user_id)`- Có thể là:

1. Vektor store trả lại top-k bằng cách nhúng cosine.
2. KV store trả về các truy cập trực tiếp được khóa trên truy vấn (user_id, type, entity).
3. Graph store trả lại subgraph có thể truy cập từ các thực thể truy vấn.
4. Một lớp điểm kết hợp ba.

### Điểm số hợp nhất

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** vector cosine, KV chính xác phù hợp, trọng lượng đường biểu đồ.
- **Importance** được gắn vào thời điểm viết hoặc được học (một số sự kiện quan trọng hơn: tên, ID, chính sách).
- **Recency** suy giảm theo thời gian kể từ lần viết hoặc đọc cuối cùng.

Các trọng lượng được điều chỉnh theo sản phẩm.`w_recency`cho các đại lý trò chuyện; cao hơn `w_importance`cho các nhân viên tuân thủ; cao hơn `w_relevance`cho các nhân viên tìm kiếm.

### Mem0g và lý luận thời gian

Mem0g thêm một máy dò xung đột. Khi một sự kiện mới mâu thuẫn với một cạnh hiện có, cạnh hiện có được đánh dấu là không hợp lệ nhưng không bị xóa. Các truy vấn thời gian ("thành phố của người dùng vào tháng 3 là gì?") xuyên qua tiểu biểu hợp lệ tại thời gian.

Đây là hành vi cấp độ tuân thủ mô hình vô hiệu hóa của Letta nói chung.

### Số điểm chuẩn

Báo cáo của Mem0 (2025):

- **LoCoMo**(khúc lưu dạng trò chuyện dài): 91.6
- **LongMemEval**(Tưởng thức tập thể dài chân trời): 93.4
- **BEAM 1M**(1M-token memory benchmark): 64.1

Các đường cơ sở so sánh (LLC đầy đủ ngữ cảnh 128k, kho vector phẳng, KV phẳng) đều mất hơn 10 điểm. Chỉ số chỉ đơn thuần không biện minh cho sự lựa chọn  hình dạng hoạt động  nhưng các số cho thấy thiết kế hợp nhất không phải là một lỗi tròn.

### Định dạng phân loại phạm vi

Mem0 chia trí nhớ theo phạm vi:

- **User memory** kéo dài qua các phiên, được khóa vào `user_id`- Tôi không biết.
- **Session memory** tồn tại trong một chuỗi.
- **Agent memory** trạng thái trường hợp mỗi đại lý.

Mỗi bài viết chọn một phạm vi. Phục hồi có thể truy vấn qua phạm vi với trọng lượng mỗi phạm vi. Trộn phạm vi mà không suy nghĩ là cách bạn nhận được "hỗ trợ nói với Alice về dự án Bob" sự cố.

### Khi mô hình này đi sai

- **Embedding drift.**Kết quả vector trông đúng trên hàng trăm truy vấn đầu tiên giảm khi corpus phát triển. Thêm tái nhúng định kỳ các hồ sơ được sử dụng trên cùng.
- **KV schema creep.** `(user_id, type, entity)`trông đơn giản cho đến khi mỗi đội thêm một đội của riêng mình `type`- kiểm tra các loại thiết lập hàng quý.
- **Graph explosion.**Một máy thu hút tiếng ồn sẽ thêm 50 cạnh cho mỗi tin nhắn.`add`gọi; bỏ các cạnh thấp tự tin.

```figure
ae-memory-fusion
```

## Hãy xây dựng nó

`code/main.py`thực hiện mô hình ba tầng trong stdlib:

- `VectorStore` sự tương đồng ngây thơ của token-overlap như một embedding stand-in.
- `KVStore` dict được khóa vào `(user_id, fact_type, entity)`- Tôi không biết.
- `GraphStore` các cạnh được đánh vào (chủ đề, mối quan hệ, đối tượng, hợp lệ).
- `Mem0` mặt tiền cấp cao với `add()`- `search()`, điểm kết hợp, và thu thập tầm nhìn.
- Một dấu vết đã hoạt động trên một cuộc trò chuyện đa người dùng, đa phiên.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả phát xuất cho thấy ba đường gọi riêng biệt cộng với top-k hợp nhất. Chuyển các trọng lượng ghi điểm ở đầu của `main()`và xem xếp hạng thay đổi.

## Sử dụng nó

- **Mem0 (Apache 2.0)** sẵn sàng sản xuất. tự lưu trữ với Postgres + Qdrant + Neo4j, hoặc sử dụng đám mây quản lý.
- **Letta** lõi/tái nhớ/bưu trữ ba cấp; mang lại các nền vector và biểu đồ của riêng bạn.
- **Zep** thay thế thương mại với KG thời gian và khai thác thực tế.
- **Custom builds** khi bạn cần kiểm soát chính xác về chất thu hút (sự tuân thủ) hoặc trọng lượng hợp nhất (những chất gây âm thanh nơi sự gần đây chiếm ưu thế).

## Chuyển nó

`outputs/skill-hybrid-memory.md`tạo ra một cái bàn trí trí nhớ ba tầng với một điểm số kết hợp, phân loại phạm vi, và vô hiệu hóa thời gian được cáp vào.

## Các bài tập

1. Thay thế sự tương đồng vector đồ chơi bằng một mô hình nhúng thực (những biến đổi câu, Ollama, nhúng OpenAI). đo recall@10 trên một cuộc trò chuyện dài tổng hợp.
2. Thêm truy vấn thời gian: `search(query, as_of=timestamp)`- Chỉ trả lại những hồ sơ hợp lệ vào thời điểm đó hoặc trước đó.
3. Thực hiện một máy dò xung đột: nếu một sự kiện đến trái ngược với một cạnh biểu đồ, vô hiệu hóa cạnh cũ và ghi cả hai.
4. Port điểm kết hợp để bao gồm một `user_feedback`kích thước (đánh tay lên trên các hồ sơ được lấy lại). Làm thế nào để ngăn chặn trò chơi (nhà chỉ trả lại các hồ sơ mà họ đã thích)?
5. Đọc các tài liệu Mem0 (`docs.mem0.ai` ). Đưa đồ chơi vào `mem0`So sánh chất lượng thu hồi trên cùng 20 truy vấn thử nghiệm.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## Đọc thêm

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) giấy gốc
- [Mem0 docs](https://docs.mem0.ai/platform/overview) API sản xuất, SDK, đám mây quản lý
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) người tiền nhiệm của ngữ cảnh ảo
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) thiết kế ba cấp
