# Tiếng bỏ phiếu, tự nhất quán và Topology tranh luận

> Sự tổng hợp rẻ nhất: mẫu N các đại lý độc lập, đa số phiếu. Wang et al. 2022 tự nhất quán đã làm điều này với một mô hình được lấy mẫu N lần.**heterogeneous**Các tác nhân để thoát khỏi monoculture  các mô hình khác nhau, các cúm thanh khác nhau, nhiệt độ khác nhau, bối cảnh khác nhau. Ngoài phiếu bầu đa số, tranh luận về vấn đề topology: MultiAgentBench (arXiv:2503.01935, ACL 2025) đánh giá sự phối hợp sao / chuỗi / cây / biểu đồ và tìm thấy **graph best for research**AgentVerse (ICLR 2024) ghi lại hai mô hình mới nổi  hành vi tình nguyện và hành vi tuân thủ  và sự tuân thủ là cả một tính năng (khám phá sự đồng thuận) và một rủi ro (thân trí nhóm, Bài 24). Bài học này lập bản đồ không gian topology, xây dựng mỗi biến thể, và đo lường thuế phối hợp.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Vấn đề

Cuộc tranh luận có thể cải thiện độ chính xác (Du et al., arXiv:2305.14325). Nó cũng có thể làm suy giảm nó.

1. Ai nói chuyện với ai (topology).
2. Bao nhiêu vòng (Du 2023: cả hai vòng và các đại lý đều có ý nghĩa độc lập).
3. Liệu các chất có phân loại (những mô hình cơ sở khác nhau phá vỡ monoculture).
4. Nếu có một giọng nói đối lập (nhựa-manning vs. straw-manning).

Các nhóm "đánh 5 đại lý và bỏ phiếu" cho một nhiệm vụ thường trở lại so với một đại lý duy nhất. Các thất bại không ngẫu nhiên. Họ theo dõi topology và tính khác nhau. Bài học này là bản đồ topology.

## Khái niệm

### Sự nhất quán của bản thân, cơ sở mô hình đơn

Wang et al. 2022 ("Tự nhất quán cải thiện chuỗi suy nghĩ") đã lấy mẫu cùng một mô hình N lần ở nhiệt độ > 0 và được bỏ phiếu đa số trên các câu trả lời đường lý luận. Kết quả trên GSM8K: tăng đáng kể với các mẫu N = 40 trên một mã hóa tham lam.

Biên giới: tự nhất quán sử dụng một mô hình cơ sở. sai lầm liên quan đến cấu trúc. Nếu mô hình có một thiên vị hệ thống, tất cả các mẫu N chia sẻ nó.

### Tiếng bỏ đa đại diện, sự mở rộng đa dạng

Thay thế các mẫu N bằng các đại lý khác nhau. Các mô hình cơ sở khác nhau (Claude, GPT, Llama), các lời nhắc khác nhau, truy cập công cụ khác nhau. Lợi ích: sai lầm không liên quan. Chi phí: các đại lý khác nhau chi phí khác nhau; phối hợp chúng thêm chi phí chung.

Tên thức của năm 2026 cho cuộc tranh luận đa dạng là **A-HMAD** Cuộc tranh luận đa tác nhân đa nguyên. Không được phổ biến, nhưng các báo cáo sử dụng thuật ngữ này cho "chương luận về các mô hình khác nhau, làm giảm các lỗi tương quan từ sự sụp đổ của đơn văn hóa".

### Bốn topology

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Một trung tâm, tất cả các trung tâm khác chỉ nói chuyện với trung tâm. tương đương với người giám sát không có kênh quay lại.
Dòng: tuyến tính, mỗi đại lý nhìn thấy đầu ra của người trước đó.
Cây: phân cấp, được sử dụng bởi các hệ thống đại lý phân cấp (Dạy 06).
Hình: bất cứ ai. Bao gồm các nhóm liên kết hoàn toàn và DAG tùy ý.

### Thuế phối hợp (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) đánh giá sao, chuỗi, cây, biểu đồ trên một bộ nhiệm vụ bao gồm nghiên cứu, lập trình và lập kế hoạch. Kết quả đo chính:

- **Graph**Topology thắng trong các nhiệm vụ nghiên cứu thông tin chảy bất cứ ai; các đại lý có thể chỉ trích lẫn nhau.
- **Star**Trận đấu với các nhiệm vụ thực tế nhanh chóng. Hub lọc và hợp nhất.
- **Chain**thắng lợi trên đường ống từng bước (phong lọc từng bước).
- **Coordination tax**xuất hiện qua ~ 4 đại lý trong topology đồ thị. Wall-clock và giá token tăng nhanh hơn chất lượng.

Mức giới hạn 4 đại lý là kinh nghiệm, không phải cơ bản. Nó phản ánh khả năng bối cảnh LLM 2026: bối cảnh của mỗi đại lý chứa đầy các sản phẩm của các đồng nghiệp, và giá trị biên của cộng đại lý N + 1 giảm khi mọi người có thể thấy mọi người.

### Chiến lược tranh luận đa đại lý ("Chúng ta nên điên lên?")

ArXiv:2311.17371 là cuộc khảo sát năm 2023 về các chiến lược MAD. Kết quả chính được lặp lại bởi những người khác: Các biến thể MAD có cấu trúc tương tự với sự nhất quán (tự chọn mẫu + tổng hợp) thường kém nhất quán khi sử dụng cùng một ngân sách. MAD giúp nhiều nhất khi các đại lý thực sự đa dạng và cuộc tranh luận có cấu trúc đối kháng (một đại lý tranh luận chống lại).

### AgentVerse các mô hình mới nổi

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) ghi lại hai hành vi xuất hiện từ cuộc tranh luận đa tác nhân ngay cả khi không có thiết kế rõ ràng:

- **Volunteer.**Một đại lý cung cấp sự giúp đỡ ("Tôi có thể thực hiện bước tiếp theo") không được nhắc nhở. hữu ích: nó phân bổ công việc cho đại lý có khả năng nhất cho một nhiệm vụ phụ.
- **Conformity.**Một đại lý điều chỉnh lập trường của mình để phù hợp với một nhà phê bình, ngay cả khi nhà phê bình sai.

Sự phù hợp là lý do tại sao cuộc tranh luận cho đến khi thỏa thuận sẽ thưởng cho những kẻ bắt nạt.

### Sự khác biệt: nút thực tế di chuyển chính xác

Một mô hình 2024-2026 trong văn học thực tế: trao đổi một trong các đại lý N của bạn cho một mô hình cơ sở khác tạo ra một đợt tăng độ chính xác lớn hơn so với tăng N bằng 1. Nhận thức là monoculture  mỗi nguồn lỗi độc lập mới có giá trị hơn một mẫu tương quan bổ sung.

Trong giới hạn, sự đa dạng vượt qua sự đa dạng. Ba mô hình khác nhau đánh bại năm bản sao của một mô hình trong hầu hết các nhiệm vụ có thực tại sạch.

### Phương pháp của bồi thẩm đoàn

Các cơ sở của Sibyl (được trích dẫn trong văn học Minsky-LLM) chính thức hóa một "đội thẩm phán" một tập hợp nhỏ các đại lý chuyên môn tinh chỉnh câu trả lời bằng cách bỏ phiếu tại mỗi giai đoạn. Không giống như bỏ phiếu đa số đơn giản, một ban giám khảo có vai trò: một đại lý kiểm tra chéo, một cung cấp bối cảnh, một điểm xác thực. Các phương pháp của ban giám khảo là điểm trung giữa bỏ phiếu đơn giản (cô rẻ, dễ bị đơn văn hóa) và MAD đầy đủ (cô đắt, dễ tuân thủ).

### Khi cuộc bầu cử với cuộc tranh luận chiếm ưu thế

- Câu hỏi có sự thật cơ bản (thực tế, toán học, hành vi mã).
- Các đại lý có thể truy cập vào các nguồn hoặc công cụ khác nhau (có sự khác biệt).
- Các vòng được giới hạn (2-3 điển hình) và có một thẩm phán hoặc kiểm chứng riêng biệt.
- Ngân sách cho phép 3-5 đại lý.

### Khi bỏ phiếu với cuộc tranh luận đau đớn

- Câu hỏi này có hình dạng ý kiến, các đại lý tụ tụ tập với câu trả lời nào có vẻ chắc chắn nhất, không phải chính xác nhất.
- Tất cả các đại lý đều có một mô hình cơ bản.
- Các vòng không giới hạn, sự phù hợp luôn thắng.
- Nhiệm vụ đơn giản. Một đại lý đơn với tính nhất quán ở N = 5 rẻ hơn và chính xác như vậy.

```figure
sw-debate-topology
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `run_star(agents, hub, question)` Các cuộc thăm dò trung tâm cho mỗi công nhân, tổng số.
- `run_chain(agents, question)` tinh chế theo trình tự.
- `run_tree(root, children, question)` phân cấp với tổng hợp độ sâu-2.
- `run_graph(agents, question, rounds)`- Vấn đề toàn diện, vòng giới hạn.
- Một số tính khác nhau được viết: mỗi đại lý có một `error_bias`cho thấy sai lầm hệ thống của nó.
- Một dây đo chạy mỗi topology ở N=3, 5, 7 và báo cáo (sự chính xác, total_tokens, wallclock_simulated).

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả dự kiến: một bảng topology × N → (sự chính xác, token, độ trễ). Hình thắng ở N=3-5 trên các nhiệm vụ theo kiểu nghiên cứu; sao thắng trên các nhiệm vụ thực tế nhanh; biểu đồ ở N=7 cho thấy thuế phối hợp (sự trễ tăng nhanh hơn độ chính xác).

## Sử dụng nó

`outputs/skill-topology-picker.md`là một kỹ năng đọc mô tả nhiệm vụ và đề nghị một topology (những ngôi sao / chuỗi / cây / biểu đồ), một N (nhiều đại viên), một hồ sơ tính khác nhau (chương trình cơ bản để sử dụng), và một đường tròn.

## Chuyển nó

Đối với bất kỳ bộ phận nào:

- Bắt đầu với **self-consistency at N=5**sử dụng một mô hình cơ sở mạnh mẽ. Đó là cơ sở giá rẻ.
- Tăng lên **heterogeneous voting at N=3**Nếu chính xác là quan trọng, hãy đo đợt delta.
- Chỉ nâng cấp lên **debate topology**nếu nhiệm vụ có cấu trúc (sự nghiên cứu, nhiều bước) và các vòng giới hạn là khả thi.
- Luôn ghi lại nhóm thiểu số. Khi một nhóm thiểu số luôn đúng, bạn có tín hiệu đa dạng.
- Đánh giá đồng hồ tường và mã thông báo cùng với độ chính xác. "Tương tự chính xác tốt hơn với chi phí 10 lần" là một quyết định kinh doanh.

## Các bài tập

1. Đi chạy`code/main.py`. Chụp đường cong thuế phối hợp cho topology đồ thị: độ chính xác so với N, token so với N. Ở n nào đường cong cong cong cong cong?
2. Thực hiện A-HMAD: ba tác nhân có thiên vị khác nhau.
3. Thêm một vai trò "đánh án" vào topology đồ thị không bỏ phiếu, chỉ ghi điểm đồng thuận cuối cùng.
4. Đọc bài báo AgentVerse (ICLR 2024). Xác định hành vi mới nổi nào mà thực hiện của bạn thể hiện mạnh nhất. Bạn có thể tạo ra hành vi ngược lại bằng cách thay đổi nhanh chóng không?
5. Đọc MultiAgentBench (arXiv:2503.01935) Phần 4 (các thí nghiệm topology).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Đọc thêm

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) Tỷ lệ cơ sở mô hình đơn
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) cả hai đại lý và vòng liên quan độc lập
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) chỉ số chuẩn topology cho thấy biểu đồ tốt nhất cho nghiên cứu, chuỗi cho đường ống
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) Nghiên cứu chiến lược MAD; phát hiện ra MAD thường mất tính nhất quán với ngân sách bình đẳng
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) Tự nguyện và các mô hình tuân thủ mới nổi
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) Thực hiện tham chiếu
