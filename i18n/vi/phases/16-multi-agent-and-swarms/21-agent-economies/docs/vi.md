# Tiền kinh tế đại lý, khuyến khích token, danh tiếng

> Các đại lý tự trị theo đường chân trời dài (nguyên tắc làm việc 1 giờ đến 8 giờ của METR) cần đại lý kinh tế.**5-layer stack**là: **DePIN**(phí-si-c tính) → **Identity**(W3C DID + vốn danh tiếng) → **Cognition**(RAG + MCP) → **Settlement**(trước ghi tài khoản) → **Governance**Các mạng lưới khuyến khích các đại lý sản xuất bao gồm:**Bittensor**(Các mạng phụ TAO thưởng cho các mô hình cụ thể về nhiệm vụ), **Fetch.ai / ASI Alliance**(ASI-1 Mini LLM + FET token), và **Gonka**(PoW dựa trên biến thể tái phân bổ máy tính cho các nhiệm vụ AI sản xuất). Công việc học thuật: AAMAS 2025 sử dụng LaMAS phi tập trung **Shapley-value credit attribution**để thưởng công bằng cho các đại lý đóng góp; Google Research đề xuất "Phục thiết kế cơ chế cho các mô hình ngôn ngữ lớn" **token auctions**Bài học này xây dựng một thị trường đại lý tối thiểu, áp dụng tính chất tín dụng Shapley cho một đường ống dẫn đa đại lý, và chạy một cuộc đấu giá mã thông báo giá thứ hai để máy móc lý thuyết trò chơi đổ bộ cụ thể.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Vấn đề

Hệ thống đa đại lý trở nên phức tạp khi các đại lý tạo ra giá trị chung nhưng cần được khen thưởng riêng lẻ. Cơ chế cổ điển  chia bằng, người đóng góp cuối cùng lấy tất cả  là không công bằng hoặc có thể chơi game. Việc thưởng dựa trên liên minh thông qua giá trị Shapley là công bằng theo xây dựng nhưng tốn kém để tính toán. Các tài liệu 2025-2026 thúc đẩy các ước tính hữu ích: lấy mẫu Shapley, đấu giá tổng hợp đơn giản và danh tiếng trên chuỗi phát sinh từ đóng góp được xác nhận.

Ngoài việc gán tín dụng, lĩnh vực này đã chuyển sang các đại lý kinh tế thực tế: Bittensor TAO thưởng cho tính toán khai thác để điều chỉnh các mô hình cụ thể của các mạng phụ, Fetch.ai/ASI thưởng cho việc sử dụng ASI-1 Mini LLM với các token FET, Gonka phân bổ lại chứng minh công việc biến đổi cho các nhiệm vụ AI sản xuất.

Bài học này xử lý các nền kinh tế đại lý như một vấn đề cụ thể gia đình  tín dụng, thiết kế cơ chế và danh tiếng  và xây dựng mỗi với toán học tối thiểu để các ý tưởng gắn bó.

## Khái niệm

### Bộ đống 5 tầng đại lý-nền kinh tế

1. **DePIN (physical compute).**Cơ sở hạ tầng phân cấp cho thuê GPU, lưu trữ, băng thông, các mạng phụ của Bittensor, Render Network, Akash.
2. **Identity.**W3C Decentralized Identifiers (DID) cung cấp cho mỗi đại lý một ID bền vững độc lập với bất kỳ nền tảng nào.
3. **Cognition.**Chuyện lý luận của đại lý: LLM + RAG + MCP. Đây là những gì các giai đoạn khác xây dựng.
4. **Settlement.**Quá trình trừu tượng tài khoản (ERC-4337) cho phép các đại lý trả khí từ số dư của riêng họ mà không giữ ETH.
5. **Governance.**Các DAO đại lý: cấu trúc quản lý nơi con người * và * đại lý bỏ phiếu về thay đổi giao thức, với quyền bỏ phiếu liên quan đến danh tiếng.

Không phải tất cả các hệ thống sản xuất đều sử dụng tất cả năm. Bittensor sử dụng 1, 2, một phần 3, một phần 4, không sử dụng bất kỳ 5. Các đại lý OpenAI không sử dụng bất kỳ ngoại trừ 3.

### Bittensor, Fetch.ai, Gonka  điều gì chạy

**Bittensor (TAO).**Các mạng phụ là các nhiệm vụ chuyên môn (tâm lý ngôn ngữ, tạo hình ảnh, dự báo). Các thợ mỏ gửi các sản phẩm mô hình. Các chất chứng minh xếp hạng chúng; điểm số cân bằng cổ phần phân phối các phần thưởng TAO. Mỗi mạng phụ có đánh giá riêng của nó. Bài học kinh tế: trả tiền cho chất lượng sản phẩm cụ thể cho nhiệm vụ, không phải tính toán được sử dụng.

**Fetch.ai / ASI Alliance.**ASI-1 Mini LLM chạy trên mạng của Fetch.ai; người dùng trả FET token để suy luận.

**Gonka.**Transformer proof-of-work: "công việc" là các bài đi trước của một bộ biến đổi. Các thợ mỏ kiếm được bằng cách chạy các nhiệm vụ suy luận có kết quả chính xác (từ dữ liệu đào tạo).

Cả ba đều là cấp sản xuất từ tháng 4 năm 2026. Phân phối thanh toán khác nhau. Bittensor thưởng chất lượng tương đối với các xác minh viên mạng phụ; Fetch thưởng tiện ích được đo bằng người dùng trả tiền; Gonka thưởng xác minh kết luận công việc.

### Thu nhập tín dụng giá trị Shapley

Ba đại lý hợp tác trong một nhiệm vụ.

Giá trị Shapley: chỉ số tín dụng duy nhất đáp ứng bốn nguyên tắc (hiệu quả, đối xứng, tuyến tính, không).`i`- Có thể là:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

nơi `S_i_O`là tập hợp các đại lý trước `i`theo thứ tự `O`- Trong thực tế: liệt kê tất cả các permutation, ghi lại đóng góp biên của mỗi đại lý trong mỗi permutation, trung bình.

Đối với các đại lý N=3, có 6 biến đổi. Đối với N=10, 3.6M  do đó trong thực tế bạn lấy mẫu thứ tự thay vì đếm.

### Đăng khăng giá thứ hai cho việc tổng hợp

Google Research ("Mỹ thuật thiết kế cho các mô hình ngôn ngữ lớn") đề xuất đấu giá mã thông báo giá thứ hai để tổng hợp các sản phẩm LLM. Thiết lập: N đại lý mỗi đề xuất một hoàn thành; mỗi có một giá trị riêng để được chọn. Người đấu giá chọn đề xuất có giá trị cao nhất và trả giá trị cao nhất thứ hai. Dưới sự tổng hợp đơn giản (lượng phụ thuộc vào đề xuất nào được chọn, không phải số lượng người được đề nghị), đây là sự thật  đại lý đề nghị giá trị thực sự của họ.

Tại sao điều này quan trọng đối với các hệ thống LLM: bạn có thể thuê ngoài các nhiệm vụ hoàn thành cho nhiều đại lý với giá khác nhau; đấu giá chọn tốt nhất + trả lương công bằng, và đại lý không có động lực để báo cáo sai.

### Tương tự danh tiếng

Một điểm danh tiếng DID gắn kết tích lũy từ những đóng góp được xác nhận.

```math
\text{rep}(i, t+1) = \alpha \cdot \text{rep}(i, t) + (1 - \alpha) \cdot \text{contribution\_quality}(i, t)
```

Với yếu tố phân rã`alpha`gần 1. danh tiếng:

- Đọc rẻ để đưa ra quyết định định hướng ("đưa nhiệm vụ khó khăn cho các đại lý đại diện cao").
- Là đắt tiền để giả mạo (tăng lên theo thời gian, liên kết đến DID).
- Có thể cắt giảm: đóng góp không xác minh trừ.

### AAMAS 2025 LAMAS phi tập trung

Đề xuất LaMAS (AAMAS 2025) kết hợp: DID danh tính, Shapley-đối giá tín dụng, và một cơ chế đấu giá đơn giản.

### Khi kinh tế bị phá vỡ

- **Price oracle manipulation.**Nếu chức năng tín dụng có thể được chơi game, các đại lý sẽ chơi game nó.
- **Sybil attacks.**Một nhà khai thác quay lên N nhân viên giả để tăng cường đóng góp của riêng họ. DID chậm nhưng không ngăn chặn điều này; danh tiếng chi phí để giả là giảm thiểu.
- **Verification cost.**Việc gán tín dụng chỉ là công bằng như người xác minh. Nếu xác minh rẻ (LLC nhỏ), nó có thể được chơi game; nếu tốn kém (các bảng nhân), hệ thống không có quy mô.
- **Regulatory overhang.**Các nền kinh tế đại lý giao nhau với quy định tài chính. Bittensor, Fetch và Gonka đều hoạt động trong các khu vực màu xám hợp pháp trong một số khu vực pháp lý từ năm 2026.

### Khi các nền kinh tế đại lý có ý nghĩa

- **Open networks with heterogeneous operators.**Không có một đội nào kiểm soát tất cả các điệp viên.
- **Verifiable outputs.**Nếu không xác minh, tín dụng là một dự đoán.
- **Long-horizon workflows.**Các nhiệm vụ đơn giản không được hưởng lợi từ sự tích lũy danh tiếng.
- **Tokenized payments are legally viable**trong thẩm quyền của bạn.

Trong các hệ thống doanh nghiệp đóng cửa, kinh tế học thay thế cho việc phân bổ đơn giản hơn (những nhà quản lý phân bổ công việc, các số liệu là nội bộ).

```figure
swarm-auction
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `shapley(value_fn, agents)` tính toán chính xác của Shapley bằng cách đếm số cho N nhỏ.
- `second_price_auction(bids)` cơ chế thực sự; người chiến thắng trả tiền thứ hai cao nhất.
- `Reputation` Huyền danh tiếng bị DID ràng buộc với sự suy giảm và cắt giảm theo cấp số.
- Demo 1: ba đại lý hợp tác, chính xác là Shapley thuộc về tín dụng.
- Demo 2: năm đại lý đấu giá cho một khe công việc; đấu giá giá thứ hai chọn người chiến thắng + thanh toán.
- Demo 3: 100 vòng giao nhiệm vụ cho các đại lý với đại diện khác nhau; định tuyến có trọng lượng đại diện đánh ngẫu nhiên.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Tạo ra dự kiến: Giá trị Shapley cho mỗi đại lý; kết quả đấu giá cho thấy sự cân bằng giá giá hợp lý; định tuyến có trọng lượng đại diện cho thấy 10-20% tăng chất lượng so với ngẫu nhiên sau khi nóng lên.

## Sử dụng nó

`outputs/skill-economy-designer.md`thiết kế một nền kinh tế trung gian tối thiểu: lựa chọn lớp danh tính, cơ chế quy định tín dụng, cơ chế thanh toán, quy tắc danh tiếng.

## Chuyển nó

Quản lý một nền kinh tế đại lý vào năm 2026:

- **Start with reputation, not tokens.**Nhãn tiếng rẻ để thực hiện và có giá trị một mình; token thêm phức tạp pháp lý và kinh tế.
- **Verify before you reward.**Không bao giờ phân phối tín dụng mà không có một bước xác minh độc lập.
- **Shapley-sample, not Shapley-exact.**Mô hình 100-1000 đơn đặt hàng; đếm chính xác không quy mô.
- **Cap decay factor and floor reputation.**Sự phân hủy không giới hạn xóa sạch những người đóng góp hợp pháp; sự phân hủy quá chậm phần thưởng các chất gây phản ứng cao cũ.
- **Audit mechanisms adversarially.**Hãy chạy các kịch bản nhóm đỏ trước khi mở mạng.

## Các bài tập

1. Đi chạy`code/main.py`. xác nhận tổng giá trị Shapley với tổng giá trị (tầm giá hiệu quả). Thay đổi hàm giá trị; các phân bổ Shapley thay đổi theo hướng mong đợi?
2. Thực hiện Shapley * sampling* (Monte Carlo trên K thứ tự). K ảnh hưởng như thế nào đến độ chính xác gần gũi? so sánh với chính xác cho N = 4.
3. Thực hiện một bước hình thành liên minh trước khi đấu giá: các đại lý có thể hợp nhất thành đội và đấu giá như một đơn vị.
4. Đọc bài viết về thiết kế cơ chế của Google Research. Hãy xác định một giả định mà nếu bị vi phạm, sẽ phá vỡ sự thật.
5. Đọc bài báo LaMAS phi tập trung AAMAS 2025 thực hiện bước Shapley của họ trên 10 đại lý trên một nhiệm vụ tổng hợp.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Đọc thêm

- [The Agent Economy](https://arxiv.org/abs/2602.14219) Cuộc khảo sát năm 2026 về 5 tầng đại lý- kinh tế
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) Trợ đấu giá mã hóa với tổng hợp đơn giản
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) Nhận tín dụng giá trị Shapley
- [Bittensor TAO documentation](https://docs.bittensor.com/) cấu trúc của các mạng phụ và phân phối phần thưởng
- [Fetch.ai / ASI Alliance](https://fetch.ai/) ASI-1 Mini LLM và FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) Cơ sở nhận dạng
