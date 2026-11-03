# KV Cache, Flash Attention & Inference Optimization

> Trình luyện là song song và liên kết với FLOP. Thuyết định là liên kết với bộ nhớ.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## Vấn đề

Một máy giải mã tự động thâm nhập ngu ngốc có thể làm được $O(N^2)$làm việc để tạo ra $N$token: ở mỗi bước nó tính lại sự chú ý trên tiền đề đầy đủ. Đối với một phản ứng 4K-token là 16M các hoạt động chú ý, hầu hết chúng là dư thừa. Mỗi trạng thái ẩn của một tiền đề token là xác định khi được tính toán.

Ngoài ra, sự chú ý tự động di chuyển rất nhiều dữ liệu. Sự chú ý tiêu chuẩn hiện thực hóa một matrix điểm số N×N, đầu ra mềm dẻo N×d, đầu ra cuối cùng N×d đọc và viết quá nhiều cho HBM. Đối với N≥2K, sự chú ý bị ràng buộc trong bộ nhớ trước khi nó trở thành FLOP. Các hạt nhân chú ý cổ điển sử dụng GPU hiện đại ít hơn 410×.

Hai cách tối ưu hóa, cả hai từ Dao et al., đã đẩy suy luận biên giới từ "nước từ" sang "nhanh":

1. **KV cache.**lưu trữ các vector K và V của mỗi token tiền tố. sự chú ý của mỗi token mới là một truy vấn so với các khóa được lưu trữ trong cache.$O(N^2)$đến$O(N)$mỗi bước thế hệ.
2. **Flash Attention.**Đặt máy tính chú ý để các n×N matrix đầy đủ không bao giờ chạm vào HBM. Tất cả các softmax + matmul xảy ra trong SRAM. 24× tốc độ đồng hồ tường trên A100; 510× trên H100 với FP8.

Đến năm 2026, cả hai đều phổ biến. Mỗi đống suy luận sản xuất (vLLM, TensorRT-LLM, SGLang, llama.cpp) giả định chúng.

## Khái niệm

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV cache toán học

Mỗi lớp giải mã, mỗi token, trên tất cả các đầu KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

Đối với mô hình 7B với 32 lớp, 32 đầu (tất cả được sử dụng cho K và V), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Đối với Llama 3 70B (80 lớp, d_head=128, GQA với 8 đầu KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

10 GiB ở 32K tăng lên 40 GiB ở 128K, đó là toàn bộ 40 GB A100 chỉ cho bộ nhớ cache KV ở kích thước lô 1.

**GQA is the KV-cache win.**MHA với 64 đầu KV sẽ lớn hơn 8 lần, khoảng 80 GiB ở 32K. MLA nén hơn nữa.

Nhổ kích thước và xem kích thước cache di chuyển. Nhấn chiều dài chuỗi hoặc hàng lên và xem nó thổi nhanh như thế nào qua một GPU duy nhất:

```figure
kv-cache-sizer
```

### Flash Attention  thủ thuật làm gạch

Sự chú ý tiêu chuẩn:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Ba chuyến đi về và về của HBM. trên H100, băng thông HBM là 3 TB / s; SRAM là 30 TB / s. Mỗi chuyến đi của HBM là một sự chậm lại nhân tố 10 so với giữ mọi thứ trên chip.

Lưu ý:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

Một chuyến HBM mỗi tấm.$O(N^2)$đến$O(N)$. Pass ngược tính lại một số giá trị từ pass phía trước thay vì lưu trữ chúng  một bộ nhớ khác giành chiến thắng.

**Numerical trick.**Tăng tốc độ hoạt động của softmax`(max, sum)`Phân tích không phải là một cách gần gũi  Flash Attention tính toán đầu ra bit giống hệt với sự chú ý tiêu chuẩn (modulo fp16 không liên quan).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 chỉ được tiến hành khi ra mắt. Đào tạo vẫn sử dụng Flash 3. GQA và varlen hỗ trợ cho Flash 4 đang chờ đợi (trung năm 2026).

### Việc giải mã giả định  chiến thắng độ trễ khác

Mô hình rẻ tiền đề xuất N token. Mô hình lớn xác minh tất cả N song song. Nếu xác minh chấp nhận k token, bạn đã trả 1 thẻ chuyển tiếp mô hình lớn cho k thế hệ.

2026 không phát hành:
- **EAGLE 2 / Medusa.**Bộ trưởng dự thảo tích hợp chia sẻ trạng thái ẩn của người xác minh. 23x tăng tốc mà không mất chất lượng.
- **Speculative decoding with draft model.**2×4 tăng tốc trên phần cứng tiêu dùng.
- **Lookahead decoding.**- Không cần mô hình dự thảo, nhưng miễn phí.

### Lượng hàng liên tục

Kết luận đợt cổ điển: chờ đợi chuỗi chậm nhất kết thúc, sau đó bắt đầu một đợt mới.

Lưu lượng liên tục (lưu lượng đầu tiên tại Orca, bây giờ tại vLLM, TensorRT-LLM, SGLang): trao đổi các yêu cầu mới vào lô ngay khi các yêu cầu cũ kết thúc.

### PagedAttention  KV cache như bộ nhớ ảo

Tính năng tiêu đề của vLLM. KV cache được phân bổ trong 16 khối mã thông báo; một bảng trang lập bản đồ vị trí logic cho các khối vật lý. Cho phép bạn chia sẻ KV trên các mẫu song song (hướng tìm kiếm, lấy mẫu song song), tiền đề hot-swap cho lưu trữ nhanh chóng, và bộ nhớ phân mảnh.

```figure
flash-attention-memory
```

## Hãy xây dựng nó

```figure
iso-machine {"machine":"kv-cache"}
```

Nhìn xem`code/main.py`Chúng tôi thực hiện:

1. Một kẻ ngây thơ .$O(N^2)$decoder tăng trưởng.
2. A $O(N)$KV-cache decoder.
3. Một Softmax được làm bằng gạch mô phỏng thuật toán chạy tối đa của Flash Attention.

### Bước 1: KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

Rất đơn giản: tiếp tục tăng trưởng các vector per token K, V trong các danh sách per layer, per head.

### Bước 2: Softmax được làm phay

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Khả năng phát ra bit giống nhau với `softmax(qK) V`trong một lần chụp, nhưng bất cứ lúc nào bộ làm việc là một `tile × d_head`khối, không phải toàn bộ `N × d_head`- Tôi không biết.

### Bước 3: So sánh mã hóa ngây thơ với mã hóa cache

Biết tính các hoạt động chú ý. Cả hai máy giải mã đều so sánh khóa truy vấn tương tự: bước `t`tham dự hơn `t`token, do đó tổng số là 1 + 2 + ... + N = N(N+1)/2. Mã sử dụng N = 10 và in 55 cho mỗi decoder. Đối với thế hệ 100 token, cả hai đều so sánh 5050. Cache lưu lại các dự đoán K và V. Không có cache, mỗi bước tính lại K và V cho tiền tố đầy đủ, vì vậy một thế hệ 100 token tính toán 5050 trạng thái token. Với bộ nhớ cache, K và V của mỗi token được tính một lần, vì vậy cùng một thế hệ tính toán 100 trạng thái token.

## Sử dụng nó

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

sản xuất vLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

Caching tiền đề trên các yêu cầu là một chiến thắng lớn 2026  cùng một hệ thống nhắc, vài lần chụp ví dụ, hoặc tài liệu ngữ cảnh dài sử dụng lại KV trên các cuộc gọi. Đối với tải trọng công việc của đại lý với nhắc lại các yêu cầu công cụ, Caching tiền đề thường là tăng thông qua 5x.

## Chuyển nó

Nhìn xem`outputs/skill-inference-optimizer.md`. Khả năng chọn sự thực hiện chú ý, chiến lược cache KV, định lượng và giải mã suy đoán cho việc triển khai suy luận mới.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Đảm bảo các máy giải mã ngây thơ và được lưu trữ trong cache tạo ra cùng một đầu ra; lưu ý sự khác biệt trong số op.
2. **Medium.**Thực hiện bộ nhớ cache tiền tố: với một prompt P và một số hoàn thành, chạy một lần đi trước trên P để lấp đầy bộ nhớ cache KV, sau đó nhánh cho mỗi hoàn thành.
3. **Hard.**Thực hiện một đồ chơi PagedAttention: KV cache trong các khối 16 token cố định với một danh sách miễn phí. Khi một chuỗi kết thúc, trả lại các khối của nó cho hồ bơi. Mô phỏng 1.000 kết thúc trò chuyện với chiều dài khác nhau. So sánh phân mảnh bộ nhớ so với phân bổ liền kề.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## Đọc thêm

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) Blackwell 5 giai đoạn đường ống và trò chơi phần mềm-exp2; đọc repo README cho các cảnh báo phóng chỉ đi trước bài học này đề cập.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) giấy vLLM.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Tự giải mã thông số.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) Bài báo EAGLE-1/2 cho phương pháp tiếp cận dự thảo tích hợp bài học đề cập.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) phương pháp Medusa được tham khảo cùng với Eagle.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) canonical deep dive trên 16 token block và trang-table thiết kế.
