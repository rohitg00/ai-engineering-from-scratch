# Hoàn thành và hợp đồng

> Các đại lý đàm phán tài nguyên, giá cả, phân bổ nhiệm vụ và các điều khoản. Mức chuẩn 2026 rõ ràng: NegotiationArena (arXiv:2402.05863) cho thấy LLM có thể cải thiện lợi nhuận ~ 20% thông qua thao túng cá nhân ("sự tuyệt vọng"); "Mắt khả năng đàm phán" (arXiv:2402.15813) cho thấy người mua khó hơn người bán và quy mô không giúp  họ **OG-Narrator**(tạo sản xuất đề nghị quyết định + người kể về LLM) đẩy tỷ lệ giao dịch từ 26,67% lên 88.88%; Cuộc thi đàm phán tự trị quy mô lớn (arXiv:2503.06416) đã tiến hành khoảng 180k đàm phán và phát hiện ra rằng**chain-of-thought-concealing**Bhattacharya et al. 2025 trên Harvard Negotiation Project metrics xếp hạng Llama-3 hiệu quả nhất, Claude-3 hung hăng nhất, GPT-4 công bằng nhất. Bài học này thực hiện Công ước Net Protocol (đạo của FIPA, Bài học 02), dây một người mua / bán theo kiểu LLM, chạy phân hủy theo kiểu OG-Narrator, và đo lường tỷ lệ giao dịch thay đổi như thế nào với mỗi lựa chọn cấu trúc.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Vấn đề

Hai đại lý cần phải đồng ý về một mức giá. Được để lại cho chính họ với các lời khuyên ngôn ngữ thuần túy, LLM 2024-2026 sẽ kết thúc các giao dịch với tỷ lệ đáng ngạc nhiên thấp (~ 27% trên các giao dịch có tham số chặt chẽ trong arXiv:2402.15813).

Vấn đề gốc là LLM kết hợp hai công việc  quyết định đề nghị và kể lại đề nghị. OG-Narrator tách ra những điều này: một nhà sản xuất đề nghị xác định tính toán các chuyển động số; LLM chỉ kể lại. tỷ lệ giao dịch nhảy lên ~ 89%.

Điều này phản ánh một phát hiện đa đại lý cổ điển: giải quyết cơ chế từ lớp truyền thông thắng. Phương pháp giao dịch mạng (FIPA, 1996; Smith, 1980) là cơ chế thị trường nhiệm vụ tham chiếu.

## Khái niệm

### Hợp đồng Net, trong một đoạn

Nghị định thư lưới hợp đồng năm 1980 của Smith: a **manager**phát sóng một **call for proposals (cfp)****bidders**trả lời với **propose**tin nhắn chứa các đề nghị của họ; người quản lý chọn một người chiến thắng và gửi **accept-proposal**cho người chiến thắng và **reject-proposal**Người thắng sẽ làm công việc.**refuse**FIPA đã hợp pháp hóa điều này như:`fipa-contract-net`giao thức tương tác.

### Tại sao OG-Narrator thắng

"Thử nghiệm khả năng thương lượng của các mô hình ngôn ngữ" (arXiv:2402.15813) lưu ý rằng:

- LLM thường vi phạm các quy tắc thương lượng (sự cung cấp với giá vô nghĩa, phớt lờ ZOPA của bên kia).
- Họ được neo kém (tự chấp nhận các đề nghị đầu tiên xấu; phản đề nghị với số tiền biểu tượng thay vì chiến lược).
- Chỉ riêng quy mô không khắc phục được những điều này. Các mô hình lớn hơn làm cho ngôn ngữ có khả năng tin cậy hơn với sai lầm chiến lược tương tự.

Sự phân hủy của OG-Narrator:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

Các nhà sản xuất giá cả là một chiến lược đàm phán cổ điển: một mô hình thương lượng Rubinstein, một chiến lược Zeuthen, hoặc một cái nhìn đơn giản về giá. LLM kể lại. Thông điệp chứa giá xác định và khung ngôn ngữ tự nhiên.

Giá giao dịch tăng vì:
- Giá vẫn ở trong khu vực thương lượng.
- Cây neo là chiến lược, không phải cảm xúc.
- LLM làm những gì nó giỏi: viết.

### Các kết quả đàm phán

ArXiv:2402.05863 cung cấp điểm chuẩn theo luật.

- LLM có thể cải thiện lợi nhuận ~ 20% bằng cách áp dụng personas ("Tôi tuyệt vọng bán điều này vào thứ Sáu")  thao túng cá nhân là một chiến thuật thực sự.
- Các nhân viên công bằng/ hợp tác được khai thác bởi những người đối kháng; quốc phòng đòi hỏi phải có sự phản đối rõ ràng.
- Các cặp đối xứng hội tụ với kết quả không công bằng trên khoảng 40% các kịch bản chuẩn.

Đây không phải là "LLC là những người đàm phán xấu". Đó là "LLC đàm phán quá nhiều như con người, bao gồm cả các phần khai thác".

### Sự che giấu chuỗi suy nghĩ

Cuộc thi đàm phán tự trị quy mô lớn (arXiv:2503.06416) đã tiến hành khoảng 180k đàm phán trên nhiều chiến lược LLM. Những người chiến thắng che giấu lý luận của họ từ đối tác:

- Nếu một đại lý in "Tôi chỉ đi đến$75; my reservation price is $70" vào một tấm cọp được nhìn thấy công khai, đối thủ đọc nó.
- Người chiến thắng tính toán chiến lược riêng tư; kênh xuất phát chỉ chứa lời đề nghị và câu chuyện tối thiểu cần thiết.

Đây là một hồi âm 2026 của lý thuyết trò chơi cổ điển (Aumann 1976 về tính hợp lý và thông tin): tiết lộ chi phí định giá cá nhân của bạn trả tiền. LLM không trực giác điều này và vui vẻ gõ những dự bị của họ trong các dấu vết lý luận trở nên hiển thị cho đối tác.

Công nghệ lấy đi: tách ngữ cảnh riêng của scratchpad từ ngữ cảnh thông điệp công cộng. Không tùy chọn.

### Bhattacharya et al. 2025  bảng xếp hạng mô hình

Về các chỉ số của Dự án đàm phán Harvard (chủ nghĩa đàm phán, tôn trọng BATNA, tương ứng lợi ích):

- **Llama-3**là hiệu quả nhất trong việc đánh giá thương mại (transaction rate + payoff).
- **Claude-3**là nhà đàm phán hung hăng nhất (những chiếc neo cao, những nhượng bộ muộn).
- **GPT-4**là công bằng nhất (sự khác biệt nhỏ nhất trong thanh toán giữa các cặp).

Đây là một bức ảnh chụp năm 2025. Điểm không phải là mô hình nào thắng trong tháng 4 năm 2026  đó là các mô hình cơ sở khác nhau có phong cách đàm phán bền vững.

### Việc phân bổ nhiệm vụ thông qua hợp đồng Net + LLM

Việc tái sử dụng hợp đồng hiện đại cho LLM đa đại lý:

1. Trưởng phòng phân hủy nhiệm vụ thành đơn vị.
2. Truyền hình `cfp`Với mô tả nhiệm vụ cho nhân viên.
3. Mỗi công nhân trả lại một đề nghị: `(price, eta, confidence)`Giá có thể là token, đơn vị tính toán, hoặc đô la.
4. Người quản lý chọn người chiến thắng (một hoặc nhiều, tùy thuộc vào nhiệm vụ) và giải thưởng.
5. Những công nhân bị từ chối có thể tự do thầu cho các nhiệm vụ khác.

Điều này vượt quá 100 nhân viên bởi vì sự phối hợp là phát sóng và trả lời, không phải trò chuyện đồng bộ. được sử dụng trong sản xuất: mô hình dàn xếp của Microsoft Agent Framework, một số triển khai LangGraph.

### Các bên liên quan của LLM

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) giới thiệu các trò chơi có thể ghi bàn nhiều bên với **secret scores**và **minimum-acceptance thresholds**. Mỗi bên liên quan có các công ty tiện ích tư nhân; LLM phải suy luận chúng từ các thông điệp. Đây là sự phổ biến của thương lượng hai bên đến hình thành liên minh N-party.

### Quy tắc kể chuyện chống lại cơ chế

Trong tất cả các tiêu chuẩn đàm phán 2024-2026, quy tắc kỹ thuật nhất quán là:

> Hãy để LLM kể lại. Đừng để LLM tính toán đề nghị.

Nếu đề nghị cần phải là một số (giá, ETA, số lượng), tạo ra nó theo cách xác định từ trạng thái đàm phán và có LLM sản xuất khung. Nếu đề nghị cần phải là một cấu trúc đề xuất (phân giải nhiệm vụ, giao vai trò), hãy để LLM biên soạn nó, nhưng xác nhận nó dựa trên một sơ đồ và kiểm tra hạn chế trước khi gửi.

```figure
a5-og-narrator
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `ContractNetManager`- `ContractNetTask`- `Bid` quản lý + người đề nghị, phát sóng cfp, thu thập đề xuất, trao giải.
- `og_narrator_bargain(state, rng)` OG-Nau người mua: quyết định phong cách Zeuthen nhượng bộ về điểm trung.
- `seller_response(state, rng)` chính sách đối phó của người bán xác định (sự thật cơ bản cấu trúc cho cả hai phong cách).
- `naive_llm_bargain(state, rng)` mô phỏng một thương lượng toàn LLM: chọn giá với sự khác biệt cao, thường là bên ngoài ZOPA.
- Đo: tỷ lệ giao dịch trên 1000 thử nghiệm với giá đặt phòng mới được lấy mẫu cho mỗi thử nghiệm.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Tạo ra dự kiến: tỷ lệ giao dịch LLM ngây thơ ~ 65-75%; tỷ lệ giao dịch OG-Narrator ~ 85-95%; khoảng cách 15-25 điểm là lợi thế cấu trúc của việc phân hủy sản xuất đề xuất từ câu chuyện.

## Sử dụng nó

`outputs/skill-bargainer-designer.md`thiết kế một giao thức thương lượng: ai tạo ra các đề nghị (định nghĩa hoặc LLM), ai kể lại, cách các scratchpad riêng biệt tách biệt với các thông điệp công cộng, và cách theo dõi tỷ lệ giao dịch.

## Chuyển nó

Danh sách kiểm tra thương lượng sản xuất:

- **Separate scratchpad.**Nhà nước tư nhân không bao giờ đạt đến ngữ cảnh của đối tác.
- **Deterministic offer generation.**Giá, số lượng, thời gian đến: tính toán, không yêu cầu.
- **Validate all incoming offers**Thử từ chối các đề nghị ngoài của Zopa ở biên giới giao thức.
- **Bound rounds.**3-5 lần bắn tối đa; tăng lên trung gian khi bị tắc nghẽn.
- **Measure deal rate and payoff variance**Một tỷ lệ giao dịch giảm là một triệu chứng  thường là một sự lở hở nhanh chóng hoặc một cuộc tấn công bên đối tác.
- **Log all rejected proposals**Đối với các nhà quản lý mạng hợp đồng, những người đấu thầu thua cuộc cần hiểu lý do tại sao.

## Các bài tập

1. Đi chạy`code/main.py`- Confirm OG-Narrator vượt qua naive-LLM với tỷ lệ giao dịch.
2. Thực hiện**persona-based payoff improvement**(arXiv:2402.05863)  người mua chỉ chấp nhận một "sự tuyệt vọng mua tuần này" nhân vật trong câu chuyện, cung cấp máy phát động không thay đổi.
3. Thực hiện chuỗi suy nghĩ **concealment**: giữ một chuỗi scratchpad riêng mà không được chuyển đến đối tác.
4. Có thể mở rộng hợp đồng Net cho đấu giá N-thầu với giá dự trữ. Khi tất cả các giá thầu vượt quá dự trữ, làm thế nào người quản lý quyết định giữa giá thấp nhất và chất lượng cao nhất?
5. Đọc Bhattacharya et al. 2025 trên Harvard Negotiation Project metrics. Thực hiện hai thương lượng với các phong cách khác nhau (cực kỳ hung hăng vs. công bằng). đo sự khác biệt thanh toán dưới sự đối xứng và không đối xứng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Đọc thêm

- [NegotiationArena](https://arxiv.org/abs/2402.05863) chỉ số chuẩn; kết quả thao túng cá nhân và khai thác
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrator và kết quả người mua khó hơn người bán
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180k đàm phán; chuỗi của suy nghĩ che giấu thắng
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) trò chơi có thể ghi bàn nhiều bên với các tiện ích bí mật
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) Cơ chế cổ điển, IEEE Transactions on Computers
