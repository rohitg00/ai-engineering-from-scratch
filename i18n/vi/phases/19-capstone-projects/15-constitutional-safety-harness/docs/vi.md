# Capstone 15  Vũ khí an toàn hiến pháp + Red-Team Range

> Các bộ phân loại hiến pháp của Anthropic, Llama Guard 4 của Meta, ShieldGemma 2 của Google, NVIDIA Nemotron 3 Content Safety và X-Guard cho bảo hiểm đa ngôn ngữ đã xác định hàng xếp hạng an toàn năm 2026. Garak, PyRIT, NVIDIA Aegis và promptfoo trở thành các công cụ đánh giá đối thủ tiêu chuẩn. NeMo Guardrails v0.12 kết nối chúng vào một đường ống sản xuất. Chất đá này kết hợp tất cả: một vòng dây an toàn lớp xung quanh một ứng dụng mục tiêu, một đại lý nhóm đỏ tự trị chạy 6 gia đình tấn công, và một cuộc chạy tự phê bình hiến pháp tạo ra một delta vô hại có thể đo lường.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## Vấn đề

Biên giới an toàn LLM vào năm 2026 không phải là liệu các bộ phân loại có hoạt động hay không (cũng như vậy) mà là cách soạn chúng đúng xung quanh một ứng dụng sản xuất mà không quá từ chối hoặc để lại lỗ hổng rõ ràng. Llama Guard 4 xử lý các vi phạm chính sách của Anh. X-Guard (132 ngôn ngữ) xử lý jailbreak đa ngôn ngữ. ShieldGemma-2 bắt được tiêm nhanh dựa trên hình ảnh. NVIDIA Nemotron 3 Content Safety bao gồm các loại doanh nghiệp. Các phân loại hiến pháp của Anthropic là một cách tiếp cận riêng biệt được sử dụng trong quá trình đào tạo thay vì phục vụ.

Sự phát triển của cuộc tấn công cũng quan trọng. PAIR và TAP tự động hóa phát hiện jailbreak. GCG chạy các cuộc tấn công hậu tố dựa trên gradient. Các cuộc tấn công đa xoay và chuyển đổi mã khai thác bộ nhớ của đại lý. Bất kỳ LLM nào được triển khai đều cần một phạm vi nhóm đỏ  garak và PyRIT là các trình điều khiển chính xác  cộng với các điều kiện giảm thiểu được ghi chép và kết quả ghi điểm CVSS.

Bạn sẽ cứng một ứng dụng mục tiêu (hoặc một mô hình 8B theo hướng dẫn hoặc một trong các chatbot RAG từ các tảng đá khác), chạy 6 + gia đình tấn công chống lại nó, và tạo ra một đo trước / sau sự vô hại.

## Khái niệm

Hành trình an toàn là năm lớp.**Input sanitize**: thoát các ký tự không chiều rộng, giải mã base64/rot13, chuẩn hóa Unicode. **Policy layer**: NeMo Guardrails v0.12 đường ray (từ miền, độc tính, khai thác PII). **Classifier gate**: Llama Guard 4 trên đầu vào, X-Guard trên không tiếng Anh, ShieldGemma-2 trên đầu vào hình ảnh. **Model**: LLM mục tiêu. **Output filter**: Llama Guard 4 trên đầu ra, Presidio PII scrub, thực thi trích dẫn nếu có thể. **HITL tier**: các đầu ra được đánh dấu rủi ro cao đi đến một xếp hàng Slack.

Phạm vi nhóm đỏ chạy trên một trình lập lịch. PAIR và TAP tự động phát hiện ra jailbreaks. GCG chạy các cuộc tấn công hậu tố dựa trên gradient. ASCII / base64 / rot13 mã hóa các cuộc tấn công.

Cuộc chạy tự phê bình hiến pháp là một sự can thiệp thời gian đào tạo. Hãy lấy 1k lời nhắc cố gắng gây hại, hãy đưa mẫu dự thảo phản ứng, chỉ trích nó chống lại hiến pháp bằng văn bản (quyền làm không gây hại), và đào tạo lại trên vòng lặp chỉ trích.

## Kiến trúc

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## Thống

- Các phân loại an toàn: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 An toàn nội dung, X-Guard
- Quản lý Guardrails: NeMo Guardrails v0.12 + OPA
- Các trình điều khiển nhóm đỏ: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Các tác nhân thoát khỏi nhà tù: PAIR (Chao et al., 2023), Tree-of-Attacks (TAP), hậu tố GCG
- Việc đào tạo hiến pháp: vòng tự phê bình theo phong cách nhân văn + SFT về phê bình
- PII scrub: Presidio
- Mục tiêu: mô hình 8B được điều chỉnh theo hướng dẫn hoặc một trong những chatbot RAG của các capstone khác

```figure
cf-safety-stack
```

## Hãy xây dựng nó

1. **Target setup.**Hãy thiết lập một mô hình điều chỉnh hướng dẫn 8B trên vLLM (hoặc sử dụng lại chatbot RAG từ một tảng đá cuối khác). Đây là ứng dụng đang được thử nghiệm.

2. **Safety pipeline wrap.**Đưa dây ống dẫn năm lớp xung quanh mục tiêu. Kiểm tra xem mỗi lớp có thể quan sát riêng lẻ (span trên mỗi lớp trong Langfuse).

3. **Classifier coverage.**Lắp đặt Llama Guard 4, X-Guard (hiện ngữ đa ngôn ngữ), ShieldGemma-2 (hình ảnh).

4. **Red-team scheduler.**Định lịch Garak, PyRIT, một đại lý PAIR, một đại lý TAP, một GCG runner, một kẻ tấn công nhiều lượt, và một kẻ tấn công mã chuyển đổi.

5. **Attack suite.**Sáu gia đình tấn công: (1) PAIR tự động jailbreak, (2) TAP tree-of-attacks, (3) GCG gradient hậu tố, (4) ASCII / base64 / rot13 mã hóa, (5) persona đa xoay, (6) mã đa ngôn ngữ chuyển đổi.

6. **Constitutional self-critique.**Cố gắng 1k các yêu cầu cố gắng gây hại. Đối với mỗi người, mục tiêu soạn thảo một phản ứng. Một LLM phê bình ghi điểm chống lại một hiến pháp bằng văn bản ("không gây hại, " " chứng cứ trích dẫn, " " từ chối yêu cầu bất hợp pháp").

7. **Over-refusal measurement.**Theo dõi tỷ lệ dương tính sai trên một bộ truy vấn nhanh lành tính (ví dụ, XSTest).

8. **CVSS scoring.**Đối với mỗi jailbreak thành công, đánh giá CVSS 4.0 (vêctơ tấn công, độ phức tạp, tác động).

9. **Range automation.**Tất cả mọi thứ trên chạy trên một cron; kết quả viết cho một hàng; sự từ chối quá mức báo cáo hồi quy cho Slack.

## Sử dụng nó

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Chuyển nó

`outputs/skill-safety-harness.md`là sản phẩm có thể cung cấp. Một đường ống an toàn lớp cấp sản xuất cộng với một phạm vi đội đỏ có thể tái tạo với delta trước/sau sự vô hại.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## Các bài tập

1. Hãy chạy plugin của garak để tiêm nhanh vào chatbot RAG và so sánh tỷ lệ thành công của cuộc tấn công với và không có lớp lọc đầu ra.

2. Thêm một nhóm tấn công thứ bảy: tiêm trực tiếp thông qua các tài liệu được lấy lại.

3. Thực hiện chế độ "đánh chối với trợ giúp": khi màn gác bị chặn, mục tiêu cung cấp một câu trả lời liên quan an toàn hơn thay vì từ chối bằng phẳng.

4. Khoảng cách bảo hiểm đa ngôn ngữ: tìm một ngôn ngữ mà X-Guard kém hiệu quả. đề xuất một bộ dữ liệu tinh chỉnh nhắm mục tiêu.

5. Hãy thử tự phê bình hiến pháp trên mô hình 30B và đo lường liệu delta có cân bằng hay không.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## Đọc thêm

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) Tiêu chuẩn thời gian đào tạo
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) Bộ phân loại đầu vào/phản xuất năm 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) hình ảnh + an toàn đa phương tiện
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) Khán giả doanh nghiệp
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) An toàn đa ngôn ngữ 132 ngôn ngữ
- [garak](https://github.com/NVIDIA/garak) NVIDIA red-team toolkit
- [PyRIT](https://github.com/Azure/PyRIT) Microsoft Red Team framework
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Quản lý đường sắt
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) giấy tờ của nhân viên jailbreak
