# Các tác nhân tạo và mô phỏng mới nổi

> Park et al. 2023 (UIST '23, arXiv:2304.03442) dân cư **Smallville**, một hộp cát gồm 25 đại lý, với cấu trúc ba phần: **memory stream**(Lập nhật ngôn ngữ tự nhiên),**reflection**(sự tổng hợp cấp cao hơn mà chất gây ra về dòng chảy của nó) và**plan**(các hành vi ở mức độ ngày, sau đó là kế hoạch phụ). Kết quả là sự xuất hiện của bữa tiệc Ngày Valentine: một đại lý đã gieo giống với "cần tổ chức một bữa tiệc Ngày Valentine", mà không cần viết kịch bản thêm, sản xuất các lời mời lan rộng khắp dân số, ngày phối hợp, và bữa tiệc xảy ra từ 24 đại lý không biết gì về nó. Các Ablation cho thấy cả ba thành phần đều cần thiết để có thể tin tưởng. Các lỗi được ghi nhận là lỗi về quy tắc không gian (trong cửa hàng đóng cửa, chia sẻ phòng tắm một người). Đây là kiến trúc tham chiếu cho mô phỏng đại lý và đánh giá xã hội đa đại lý vào năm 2026.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Vấn đề

Hầu hết các hệ thống đa đại lý là các nhóm được viết chặt chẽ: kế hoạch lập kế hoạch, mã lập trình, đánh giá của nhà đánh giá. Điều đó hoạt động cho các nhiệm vụ được xác định rõ ràng. Nó không nắm bắt hành vi nổi lên, không được viết ra khi các đại lý có bộ nhớ, ưu tiên và một thế giới mở. Nghiên cứu, mô phỏng xã hội và ngày càng nhiều AI trò chơi cần loại thứ hai này.

Thiết kế Smallville là điểm chuẩn cho nó. Cho đến Park 2023, các mô phỏng đại lý tốt nhất là người theo kịch bản nông; sau đó, mô hình là mặc định cho các đại lý tạo trong thế giới mở. Nếu bạn xây dựng mô phỏng đại lý vào năm 2026, bạn hoặc sử dụng ba thành phần của Smallville hoặc biện minh rõ ràng tại sao bạn không.

## Khái niệm

### Ba thành phần

**Memory stream.**Một nhật ký chỉ có phụ lục về quan sát, hành động, suy nghĩ và kế hoạch. Mỗi mục có dấu thời gian, loại, mô tả (ngôn ngữ tự nhiên) và siêu dữ liệu bắt nguồn:**recency**- **importance**(đánh giá 1-10 của đại lý), và **relevance**(có sự tương đồng với truy vấn hiện tại).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

Tận dụng trí nhớ kết hợp ba điểm:`score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`. mục đầu k nhập vào lệnh hiện tại.

**Reflection.**Chuẩn bị (mỗi N ký ức hoặc trên các sự kiện quan trọng), đại lý tạo ra tổng hợp thứ tự cao hơn từ ký ức gần đây. Các mục phản ánh trở lại dòng chảy và có thể lấy lại như bất kỳ ký ức nào khác. Đây là cách đại lý xây dựng "sự hiểu biết"

**Plan.**Sự phân hủy từ trên xuống. Đầu tiên, một kế hoạch cấp ngày trong các đoạn rộng ("đi làm việc, ăn tối với Klaus"). Sau đó là kế hoạch cấp giờ. Sau đó là kế hoạch cấp hành động.

### Tại sao cả ba đều quan trọng (bỏ)

Park et al. chạy các ablation giảm từng quan sát, suy nghĩ và kế hoạch.

- Không có**observation**Đại lý bỏ qua bối cảnh và hành động dựa trên niềm tin cũ.
- Không có**reflection**người đại lý không thể hình thành niềm tin cấp cao; sự tương tác vẫn nông cạn.
- Không có**plan**hành vi trở thành tiếng ồn phản ứng; mục tiêu bị phân tán.

Điểm tin cậy từ các điểm đánh giá của con người là cao nhất với cả ba; giảm bất kỳ một sản xuất một sự lùi đo lường.

### Sự xuất hiện của Ngày Valentine

Một đại lý, Isabella Rodriguez, được gieo với mục tiêu "cần tổ chức một bữa tiệc ngày Valentine tại Hobbs Cafe vào ngày 14 tháng 2 lúc 5 giờ chiều".

1. Kế hoạch của Isabella bao gồm mời mọi người.
2. Mỗi lời mời trở thành một quan sát trong dòng nhớ của người hàng xóm.
3. Nhìn lại của người hàng xóm đó tạo ra niềm tin: "Isabella đang tổ chức một bữa tiệc".
4. Kế hoạch của hàng xóm bao gồm "đang tham dự bữa tiệc vào ngày 14 tháng 2".
5. Hàng xóm nói với hàng xóm khác.
6. Vào lúc 5 giờ tối ngày 14 tháng 2, một số nhân viên tụ họp tại quán cà phê Hobbs.

Đây là sự xuất hiện theo nghĩa kỹ thuật: hành vi cấp hệ thống (một đảng) phát sinh từ các tương tác địa phương (cý nghị song phương + lập kế hoạch cá nhân) mà không có một dàn nhạc trung tâm.

### Các chế độ thất bại được ghi nhận

Park et al. ghi rõ ràng:

- **Spatial norm errors.**Các đại lý đi vào các cửa hàng đóng cửa. Các đại lý cố gắng sử dụng cùng một phòng tắm một người. Các đại lý ăn trong các phòng không dành cho ăn. Mô hình không suy luận các quy tắc xã hội-physical chỉ từ môi trường.
- **Memory overflow.**Các hoạt động mô phỏng sâu gây ra chi phí thu hồi bộ nhớ tăng lên.
- **Reflection hallucination.**Nhận phản xạ có thể phát minh ra các mối quan hệ không tồn tại trong dòng lưu trữ.

Đây là các chế độ thất bại liên quan đến sản xuất: bất kỳ mô phỏng đại lý nào năm 2026 thừa kế chúng.

### Quy tắc thực hiện ba thành phần

1. **Memory is append-only.**Đừng bao giờ biến đổi một mục trong bộ nhớ.
2. **Importance scores are cheap.**Hãy gọi cho trường đại học để đánh giá tầm quan trọng 1-10 vào thời điểm viết.
3. **Retrieval is ranked, not filtered.**Top-k theo điểm kết hợp; không sử dụng bộ lọc cứng (mà mất ngữ cảnh).
4. **Reflection runs periodically.**Trigger khi tổng số trọng lượng của các ký ức chưa được xử lý vượt quá ngưỡng (ví dụ: 150).
5. **Plans are revisable.**Khi một quan sát mới mẻ mâu thuẫn với một kế hoạch, chỉ tái tạo phần bị ảnh hưởng, không phải toàn bộ kế hoạch.

### Các đại lý tạo ra ngoài Smallville

Văn học tiếp theo 2024-2026 mở rộng kiến trúc:

- **Multi-agent social simulation for policy / market research.**Các nhóm người giống như Smallville mô phỏng hành vi của người dùng để đáp ứng các tính năng.
- **NPC AI for games.**Các trò chơi RPG với các đại lý Smallville tạo ra các câu chuyện mới nổi thay vì các nhiệm vụ kịch bản.
- **Generative-agent evaluation benchmarks.**Thay vì chính xác nhiệm vụ, số liệu trở thành khả năng tin cậy + sự liên kết của hành vi trong các thời gian dài.

Kiến trúc là tham chiếu. Các phần mở rộng thay đổi thành phần (khám vector lưu trữ cho bộ nhớ, phản xạ tăng cường lấy, kế hoạch thần kinh) nhưng giữ lại cấu trúc ba phần.

### Tại sao điều này quan trọng đối với kỹ thuật đa đại lý

Smallville là bằng chứng về khái niệm rằng sự xuất hiện của nhiều đại lý rẻ khi các thành phần đúng. Kiến trúc đã được sao chép trên các mô hình nguồn mở (LLC nhỏ hơn mất tính đáng tin cậy một cách đẹp trai, không phải sắc bén). Bất kỳ hệ thống sản xuất nào cần **emergent social behavior**sử dụng hình dạng này.**tight task execution**sử dụng các mô hình giám sát viên / vai trò / nguyên thủy từ trước trong giai đoạn này.

```figure
a5-memory-reflection
```

## Hãy xây dựng nó

`code/main.py`thực hiện ba thành phần trong stdlib Python với chính sách đại lý kịch bản (không có LLM thực sự).

- `MemoryStream` chỉ thêm log với tính gần đây/sự quan trọng/sự liên quan.
- `reflect(stream)` Nhận xét kịch bản về những kỷ niệm quan trọng gần đây.
- `plan(agent_state)` kế hoạch cấp ngày và cấp giờ dựa trên niềm tin hiện tại.
- Kịch bản: 5 nhân viên, nhân viên 1 bắt đầu với "thay bữa tiệc vào 5 giờ chiều".

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả dự kiến: dấu vết tick-by-tick. Khi tick cuối cùng, ít nhất 3 trong số 5 đại lý cho thấy đảng trong kế hoạch của họ, và họ hội tụ tại địa điểm của đảng.

## Sử dụng nó

`outputs/skill-simulation-designer.md`thiết kế mô phỏng đại lý tạo: số lượng đại lý, sơ đồ bộ nhớ, độ phản xạ, chân trời kế hoạch và métrics đánh giá.

## Chuyển nó

Quy tắc đối với mô phỏng sản xuất:

- **Memory is the database.**Chọn một cửa hàng thực sự (vector DB, Postgres) trên quy mô.
- **Log the retrieval trace.**Với mỗi hành động, ghi lại những ký ức dẫn đến nó.
- **Budget per-agent tokens.**Các đại lý lấy + phản xạ + kế hoạch cho mỗi tick là $O(k)$N đại lý x T ticks x gọi-per-tick có thể làm nhỏ hơn ngân sách của bạn.
- **Compact memory periodically.**Kết luận và cắt giảm các mục có tầm quan trọng thấp. Chính sách giữ lại là một quyết định thiết kế, không phải là chi tiết.
- **Detect spatial / social norm violations**kiến trúc không học được chúng.

## Các bài tập

1. Đi chạy`code/main.py`- Đảm bảo 3 nhân viên hợp nhất tại bữa tiệc.
2. Làm thế nào để hành vi trông giống như? Bản đồ đến phát hiện của ablation trong Park 2023.
3. Hãy giới thiệu một mục tiêu được gieo giống cạnh tranh ("Klaus muốn nói chuyện nghiên cứu vào 5 giờ chiều").
4. Thêm những hạn chế không gian: Hobbs Cafe có tối đa 4 đại lý. Máy cầm mô phỏng tràn đầy sự hào nhoáng, hoặc nó chạm vào mô hình thất bại "tắm một người"?
5. Đọc Park et al. (arXiv:2304.03442) Phần 6 (Các thí nghiệm hành vi mới nổi).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Đọc thêm

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) kiến trúc tham chiếu
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) địa điểm xuất bản
- [Smallville code release](https://github.com/joonspk-research/generative_agents) thực hiện Python tham chiếu
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) nghệ thuật trước đây cho các đại lý bộ nhớ có cấu trúc
