# Cuộc tranh luận và hợp tác giữa nhiều đại lý

> Du et al. (ICML 2024, "Society of Minds") chạy các trường hợp mô hình N độc lập đề xuất câu trả lời, sau đó lặp đi lặp lại chỉ trích lẫn nhau trên các vòng R để hội tụ.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích giao thức thảo luận: N đề xuất, R vòng, hội tụ trên một câu trả lời chung.
- Hãy mô tả tại sao tranh luận giúp cải thiện tính thực tế, tuân thủ quy tắc và lý luận.
- Giải thích topology hiếm: không phải mọi người tranh luận cần phải nhìn thấy nhau.
- Thực hiện một cuộc tranh luận về một LLM kịch bản với các biến thể đầy đủ và hiếm; đo chi phí token so với độ chính xác.

## Vấn đề

Tự tinh chỉnh (Dạy 05) là một mô hình tự phê bình bản thân  rủi ro tư duy nhóm. CRITIC (Dạy 05) căn cứ phê bình trong các công cụ bên ngoài  không luôn có sẵn.

## Khái niệm

### Hiệp hội tâm trí (Du et al., ICML 2024)

- N các trường hợp mô hình độc lập đề xuất câu trả lời cho cùng một câu hỏi.
- Trong vòng R, mỗi mô hình đọc và chỉ trích các đề xuất của những người khác.
- Các mô hình cập nhật câu trả lời của họ dựa trên các lời chỉ trích.
- Sau vòng R, trả lại câu trả lời hội tụ.

Các thí nghiệm ban đầu sử dụng N=3, R=2 do chi phí. Độ chính xác được cải thiện với nhiều đại lý và nhiều vòng hơn trên các vấn đề khó khăn (MMLU, GSM8K, Chess Move Validity, sinh nhật).

Các kết hợp giữa các mô hình vượt qua các cuộc tranh luận mô hình đơn: ChatGPT + Bard cùng > hoặc một mình.

### Topology Sparse

"Cải thiện cuộc tranh luận đa đại lý với Topology truyền thông Sparse" (arXiv:2406.11776, 2024-2025) cho thấy cuộc tranh luận toàn lưới không phải lúc nào cũng tối ưu. Các topology Sparse (những ngôi sao, vòng, trung tâm và đầu mối) có thể phù hợp với độ chính xác với chi phí token thấp hơn. Mỗi người tranh luận chỉ thấy một nhóm nhỏ các đồng nghiệp.

Những tác động:

- Mạng lưới đầy đủ N=5, R=3 = 5 × 3 = 15 đề xuất, mỗi đọc 4 đồng nghiệp = 60 phê bình.
- Star N=5, R=3 (một hub + 4 phát âm) = 15 đề xuất, phát âm chỉ đọc hub = 12 hoạt động phê bình.

### Khi tranh luận giúp ích

- **Factuality.**Trong các đề xuất độc lập, kiểm tra chéo làm giảm ảo giác.
- **Rule-following.**Chess move validity  một mô hình bỏ lỡ một quy tắc, những người khác bắt được nó.
- **Open-ended reasoning.**Nhiều khung hình hạn chế về câu trả lời đúng.

### Khi tranh luận đau đớn

- **Latency-sensitive UX.**N × R vòng hàng loạt là độ trễ mà bạn có thể không có.
- **Cost-sensitive scale.**N × R token cho mỗi câu hỏi.
- **Simple factual lookups.**Một lần tìm kiếm rẻ hơn năm cuộc tranh luận.

### 2026 các trường hợp thực tế

- **Anthropic orchestrator-workers**(Dân học 12)  một biến thể của cuộc tranh luận với một bước tổng hợp.
- **LangGraph supervisor**(Dạy 13)  router trung tâm + các đại lý chuyên môn có thể thực hiện tranh luận như một nút.
- **OpenAI Agents SDK**(Dạy 16)  các đại lý chuyển về phía trước và về phía sau để phê bình lặp lại.
- **Multi-agent evals** cuộc tranh luận đôi + đánh giá-optimizer cho tín hiệu đánh giá.

### Khi mô hình này đi sai

- **Convergence collapse.**Tất cả các nhân viên đều tụ tập với câu trả lời sai đầu tiên.
- **Hub failure.**Trong một topology sao, một trung tâm xấu làm hỏng tất cả mọi người.
- **Prompt homogenization.**Tất cả các đại lý đều sử dụng cùng một lời nhắc; họ tạo ra những câu trả lời tương tự.

```figure
debate-converge
```

## Hãy xây dựng nó

`code/main.py`thực hiện cuộc tranh luận STDlib:

- `Debater`lớp (được viết LLM với mỗi người tranh luận suy nghĩ).
- `FullMeshDebate`và `SparseDebate`Những người chạy.
- Ba câu hỏi: một câu hỏi thực tế, một câu hỏi dựa trên quy tắc, một câu hỏi lý luận.
- Các số liệu: đáp ứng hội tụ, vòng để hội tụ, tổng quan điểm.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: độ chính xác và chi phí cho mỗi giao thức; các trận đấu ít kết hợp đầy đủ trên 2/3 câu hỏi với chi phí thấp hơn.

## Sử dụng nó

- **Anthropic orchestrator-workers**cho các cuộc tranh luận đơn giản của 2-3 công nhân.
- **LangGraph**cho cuộc tranh luận đa vòng với kiểm soát.
- **Custom**cho nghiên cứu hoặc đảm bảo chính xác chuyên môn.

## Chuyển nó

`outputs/skill-debate.md`Đặt một cuộc tranh luận đa đại lý với topology có thể cấu hình, N, R, và một quy tắc hội tụ.

## Các bài tập

1. Thực hiện quy tắc "sự bất đồng buộc": trong vòng 1, mỗi người tranh luận phải đưa ra một đề xuất riêng biệt.
2. Thêm một tổng hợp cân bằng sự tin tưởng: những người tranh luận trả lại (câu trả lời, tin tưởng); tổng hợp cân bằng sự tin tưởng.
3. Thay đổi một "hợp tác viên" cho một LLM khác với kịch bản khác với ý kiến khác nhau.
4. Đánh giá giá mã thông báo cho toàn bộ lưới so với thưa thớt trên 3 câu hỏi của bạn.
5. Đọc bài báo của Hội tâm trí. Đưa đồ chơi của bạn đến N=5, R=3.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## Đọc thêm

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) tranh luận đa tác nhân
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) Kết quả topology hiếm
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) người tổ chức nhạc công như một biến thể tranh luận
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) Phụng đồng minh tự phê bình mô hình đơn
