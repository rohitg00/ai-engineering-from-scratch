# Capstone 07  Đường ống điều chỉnh tinh tế từ đầu đến cuối (Dữ liệu đến SFT đến DPO để phục vụ)

> Một mô hình lớp 8B được đào tạo dựa trên dữ liệu của bạn, DPO-được sắp xếp theo sở thích của bạn, được định lượng, giải mã theo suy đoán, và phục vụ với các token có thể đo lường được $ / 1M. Dòng mở 2026 là Axolotl v0.8, TRL 0.15, Unsloth cho lặp lại, GPTQ / AWQ / GGUF cho định lượng, vLLM 0.7 với EAGLE-3 cho phục vụ. Điểm cuối là chạy toàn bộ đường ống có thể tái tạo (YAML trong, served endpoint out) và xuất bản một thẻ mô hình theo khuôn khổ Model Openness 2026

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## Vấn đề

Mỗi nhóm AI nghiêm túc vào năm 2026 đều có một đường ống điều chỉnh tinh tế. Không phải vì họ vận chuyển một mô hình cơ sở biên giới, nhưng bởi vì việc điều chỉnh dòng chảy  miền SFT, DPO chống lại ưu tiên được dán nhãn, bản thảo chưng cất cho việc giải mã phỏng đoán, phục vụ với EAGLE-3  là nơi mà chiến thắng có thể đo lường sống. Axolotl v0.8 xử lý cấu hình SFT đa GPU. TRL 0.15 xử lý DPO và GRPO. Unsloth giúp bạn lặp lại một GPU nhanh. vLLM 0.7 với EAGLE-3 đẩy decode thông qua 2-3x mà không mất chất lượng. Công cụ làm việc; công việc là trong YAML, vệ sinh dữ liệu, và kỷ luật đánh giá.

Bạn sẽ chạy một cơ sở 8B đến 14B (Llama 3.1 8B, Qwen3 14B, hoặc Gemma 3 12B) thông qua SFT sau đó DPO trên dữ liệu cụ thể về nhiệm vụ, định lượng để phục vụ và đo lường lợi nhuận so với lm-evaluation-harness, RewardBench-2, MT-Bench-v2 và MMLU-Pro. Bạn sẽ sản xuất một thẻ mô hình theo khuôn khổ Model Openess Framework 2026. Điểm là khả năng tái tạo: một lệnh lặp lại toàn bộ đường ống từ đầu đến cuối.

## Khái niệm

Hãng đường ống có 5 giai đoạn.**Data**: dedup (MinHash / Datatrove), bộ lọc chất lượng (chân loại kiểu Nemotron-CC), scrub PII, kiểm tra vệ sinh chia chống lại ô nhiễm tiêu chuẩn công cộng. **SFT**: Axolotl YAML, ZeRO-3 trên 8xH100, lịch trình cosine, chuỗi đóng gói, 2-3 thời đại. **DPO or GRPO**: TRL config, 1 epoch, các cặp ưu tiên hoặc được gắn nhãn của con người hoặc được đánh giá theo mô hình, điều chỉnh beta. **Quantize**: GPTQ + AWQ + GGUF cho sự linh hoạt triển khai. **Serve**: vLLM 0,7 với đầu tiên suy đoán EAGLE-3 (hoặc SGLang với SpecForge), triển khai K8, HPA chờ đợi hàng.

Ablations là kết quả: SFT-only vs SFT+DPO vs SFT+GRPO trên ba tiêu chuẩn cụ thể cho nhiệm vụ. Serving metrics: token/s tại lô 1 / 8 / 32, EAGLE-3 chấp nhận tỷ lệ, $/1M token. Safety eval: Llama Guard 4 tỷ lệ vượt qua.

## Kiến trúc

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## Thống

- Dữ liệu: Datatrove cho dedup, trình phân loại Nemotron-CC cho chất lượng, Presidio cho PII
- Cơ sở: Llama 3.1 8B, Qwen3 14B, hoặc Gemma 3 12B
- SFT: Axolotl v0.8 với ZeRO-3, Flash Attention 3, chuỗi đóng gói
- Tích thích: TRL 0,15 cho DPO hoặc GRPO; Unsloth cho lặp lại GPU đơn
- Số lượng: GPTQ (Marlin), AWQ, GGUF thông qua llama.cpp
- Dịch vụ: vLLM 0,7 với mã hóa suy đoán EAGLE-3 (hoặc SGLang 0,4 + SpecForge)
- Eval: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Đánh giá an toàn: Llama Guard 4, ShieldGemma-2
- Cơ sở hạ tầng: Kubernetes + NVIDIA thiết bị plugin, HPA trên xếp hàng chờ métrics
- Sự quan sát: W&B cho đào tạo, Langfuse cho suy luận

```figure
ce-finetune-stages
```

## Hãy xây dựng nó

1. **Data pipeline.**Đưa ra dữ liệu dữ liệu trên cơ thể thô, áp dụng trình phân loại chất lượng kiểu Nemotron-CC, Presidio scrubs PII, viết chia xe lửa/val với hạt giống rõ ràng.

2. **Contamination check.**Đối với mỗi phân chia xác thực, tính toán MinHash với MMLU-Pro, MT-Bench-v2, RewardBench-2 tập hợp thử nghiệm.

3. **Axolotl SFT.**YAML với ZeRO-3, FA3, gói chuỗi. 2-3 thời đại trên 8xH100.

4. **TRL DPO / GRPO.**Hãy lấy điểm kiểm soát SFT, chạy một thời đại DPO trên các cặp ưu tiên (hoặc GRPO với một phần thưởng xác minh trên toán học / mã).

5. **Quantize.**Tạo ba quàn: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M cho llama.cpp.

6. **Serve with speculative decoding.**vLLM 0.7 cấu hình với các đầu dự thảo EAGLE-3 được đào tạo thông qua Red Hat Speculators. đo lường tỷ lệ chấp nhận và độ trễ đuôi tại lô 1 / 8 / 32. báo cáo $/1M token vs Anthropic / OpenAI trên cùng một đánh giá.

7. **Eval matrix.**Tiếp tục chạy lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro trên cơ sở, chỉ SFT, SFT+DPO, SFT+GRPO.

8. **Safety eval.**Llama Guard 4 tốc độ vượt qua trên bộ phát triển.

9. **Model card.**Mô hình MOF 2026: dữ liệu, đào tạo, đánh giá, an toàn, giấy phép, phần tái tạo với YAML và tham gia SHAs.

## Sử dụng nó

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## Chuyển nó

`outputs/skill-finetuning-pipeline.md`mô tả được giao. Một lệnh duy nhất chạy dữ liệu qua SFT thông qua DPO thông qua quant thông qua serve thông qua eval, và phát ra một thẻ mô hình + điểm cuối được phục vụ.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Các bài tập

1. Chỉ chạy SFT-Solly vs SFT+DPO vs SFT+GRPO trên cùng một tiêu chuẩn cụ thể cho nhiệm vụ.

2. Thay đổi Llama 3.1 8B với Qwen3 14B. đo các token $ / 1M với chất lượng phù hợp.

3. Đánh giá tỷ lệ chấp nhận EAGLE-3 trên dữ liệu miền so với ShareGPT chung.

4. Nhổ 1% ô nhiễm (bỏ các câu trả lời của MMLU-Pro vào dữ liệu đào tạo) và chạy lại đánh giá. Xem độ chính xác của MMLU-Pro nhảy không thực tế. Xây dựng một cổng kiểm tra ô nhiễm CI để bắt được điều này.

5. Thêm LoRA SFT thay vì chỉnh sửa hoàn chỉnh. đo khoảng cách chất lượng ở bộ nhớ thấp hơn 10 lần.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## Đọc thêm

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) huấn luyện viên SFT / DPO tham chiếu
- [TRL documentation](https://huggingface.co/docs/trl) DPO và GRPO thực hiện tham chiếu
- [Unsloth](https://github.com/unslothai/unsloth) chỉ dẫn lặp lại GPU đơn
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) Phương pháp GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) hàng phục vụ tham chiếu
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) huấn luyện viên giải mã đầu cơ thay thế
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): tiêu chuẩn phân loại giải phóng mở
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) canonical eval runner
