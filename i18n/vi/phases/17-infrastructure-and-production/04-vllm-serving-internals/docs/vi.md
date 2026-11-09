# Dịch vụ động cơ nội bộ  PagedAttention, liên tục batching, Chunked Prefill

> Công cụ phục vụ hiện đại dựa trên ba sự cố định hợp nhất, không phải một thủ thuật duy nhất. PagedAttention luôn bật. Các lần phát tập liên tục cho phép các yêu cầu mới vào các lần phát tập hoạt động giữa các lần lặp mã hóa. Các mảnh prefill slic dài để giải mã token không bao giờ chết đói. Động tất cả ba và một Llama 3.3 70B FP8 trên một H100 SXM5 đẩy 2.200-2.400 tok / s ở 128 đồng thời  khoảng 25% trên vLLM tự mặc định và 3-4x một vòng PyTorch ngây thơ. Bài học này đọc lập trình và hạt nhân chú ý của vLLM  động cơ tham chiếu cho cả ba kỹ thuật  ở một mức độ bạn có thể vẽ, và kết thúc với một bộ đúc đồ chơi liên tục trong `code/main.py`những lịch trình prefill và decode như vLLM làm.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích PagedAttention như một bộ phân bổ cache KV: khối, bảng khối, và tại sao phân mảnh vẫn dưới 4% khi tải sản xuất.
- Chụp đồ họa liên tục đợt đợt đợt lặp ở cấp độ lặp: các chuỗi hoàn thành rời khỏi đợt và các chuỗi mới kết hợp mà không bị khử.
- Mô tả prefill cục cục trong một câu và tên là métrics độ trễ mà nó bảo vệ (khung: nó là đuôi ITL của các mã giải mã đồng thời, không phải là thông qua trung bình).
- Kiểm tra kết hợp tính năng vLLM so với matrix tương thích cho phiên bản của bạn trước khi kích hoạt mọi tối ưu hóa cùng một lúc.

## Vấn đề

Một vòng phục vụ PyTorch ngây thơ chạy một yêu cầu một lần: token, prefill, decode cho đến EOS, trả lại. Với một người dùng, điều này hoạt động. Ở một trăm, đó là một hàng người kiên nhẫn. Việc sửa chữa rõ ràng  đóng gói tĩnh  pads mỗi yêu cầu đến prompt dài nhất trong cửa sổ, pads mỗi decode đến đầu ra dài nhất mong đợi, và trì hoãn toàn bộ lô trên chuỗi chậm nhất. Bạn trả tiền cho chất đệm mà bạn không bao giờ sử dụng, và yêu cầu nhanh chờ đợi những yêu cầu chậm.

vLLM giải quyết ba vấn đề cùng một lúc. PagedAttention ngăn chặn phân mảnh cache KV ăn 60-80% bộ nhớ GPU theo cách phân bổ liên tục cổ điển. Lập liên tục cho phép các yêu cầu kết nối và rời khỏi lô giữa mỗi lần lặp lại mã hóa, vì vậy lô luôn đầy đủ công việc thực sự. Chunked prefill phá vỡ một token 32k-token thành ~512 token slices mà liên kết với decode, vì vậy một prompt dài không đóng băng mọi token decode trên GPU.

Các sản phẩm 2026 mặc định là tất cả ba vào. Bạn cần phải hiểu mỗi người làm gì bởi vì các chế độ thất bại tất cả trên lịch trình, không phải mô hình.

## Khái niệm

### PagedAttention như một hệ thống bộ nhớ ảo

Một bộ nhớ cache KV là `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`Đối với Llama 3.3 70B với 8192 token, đó là khoảng 1,25 GB mỗi chuỗi trong BF16. Nếu bạn dự trữ trước 8192 khe cho mỗi yêu cầu nhưng yêu cầu trung bình chỉ sử dụng 1500 token, bạn lãng phí khoảng 82% HBM bạn đã dự trữ.

PagedAttention vay ra ý tưởng từ bộ nhớ ảo của hệ điều hành. KV cache không liên kết cho từng chuỗi. Nó được phân bổ trong các khối kích thước cố định (tầm 16 token). Mỗi chuỗi có một bảng khối mà lập bản đồ vị trí mã thông báo logic của nó cho ID khối vật lý. Khi một chuỗi phát triển vượt qua các khối được phân bổ, một khối nữa được thêm vào. Khi nó hoàn thành, các khối của nó trở lại hồ bơi.

Phân tích giảm từ 60-80% (classic) xuống dưới 4% (PagedAttention). Bạn không kích hoạt PagedAttention với cờ  nó là tàu phân bổ vLLM duy nhất. nút là `--gpu-memory-utilization`(trọng lượng mặc định 0.9), cho biết vLLM phải lưu lượng HBM cho các khối KV sau khi tải trọng và kích hoạt.

### Lượng hàng liên tục ở cấp độ lặp lại

"Dynamic batching" cũ chờ đợi một cửa sổ (chẳng hạn là 10 ms) để lấp đầy một lô, sau đó chạy prefill + decode + decode + decode cho đến khi mỗi chuỗi kết thúc.

Lần phát tập liên tục hoạt động giữa mỗi bước giải mã.`RUNNING`danh sách. Tại mỗi lần lặp lại:

1. Bất kỳ chuỗi nào trong `RUNNING`chỉ cần nhấn EOS hoặc max_tokens được xóa.
2. Người lập trình nhìn vào hàng chờ. Nếu có các khối KV miễn phí, nó sẽ chấp nhận các chuỗi mới (số trước hoặc tiếp tục).
3. Lệnh đi trước sẽ chạy trên bất cứ thứ gì đang ở trong.`RUNNING`, phát ra một token mới cho mỗi chuỗi.

Kích thước lô không bao giờ được đệm đến một số cố định.`V1 scheduler`. Key invariant: Scheduler chạy một lần mỗi lần lặp lại mã hóa, không phải một lần mỗi yêu cầu.

### Việc làm trước bằng mảnh bảo vệ đuôi ITL

Prefill được tính toán. Một lệnh 32k-token trên Llama 3.3 70B mất ~ 800 ms prefill tinh khiết trên một H100. Trong khi prefill chạy, giải mã token cho mọi chuỗi khác trong vòng chờ. Trong vòng bán hàng, latency token đầu tiên (TTFT) của một lệnh dài trở thành điểm trôi giữa token (ITL) cho hàng chục người dùng khác.

Chunked prefill chia prefill thành các khối kích thước cố định (tầm 512 token) và lập lịch từng phần như một đơn vị. Giữa các khối người lập lịch có thể tiến bộ các chuỗi giải mã bằng một token. Bạn trao đổi một lần trúng trúng thời gian trúng trúng tuyệt đối nhỏ (một vài ms mỗi phần) cho thời gian giải mã thấp hơn nhiều. P99 ITL dưới tải hỗn hợp giảm từ ~ 50 ms đến ~ 15 ms trong các tiêu chuẩn được xuất bản.

### Ba mặc định tương tác

Tất cả ba tính năng đều giả định nhau. PagedAttention cung cấp cho lập trình viên một nguồn KV hạt mỏng để giao dịch với.`RUNNING`danh sách  đó là một chính sách lập lịch hơn, không phải một hệ thống riêng biệt.

Bạn không cần phải biết mọi cờ, bạn cần phải biết những gì lập trình viên tối ưu hóa: tốt trong ngân sách khối KV, tùy thuộc vào cắt prefill mảnh.

### Kiểm tra các matrix tương thích

Kiểm tra mọi kết hợp tính năng với matrix tương thích cho phiên bản vLLM chính xác của bạn trước khi bật tất cả chúng cùng một lúc, bởi vì những gì tạo thành thay đổi giữa các bản phát hành. Trong v0.18.0 các tính năng tử liệu đánh dấu giải mã phỏng đoán tương thích với prefill và prefix cache phân mảnh, và trang giải mã phỏng đoán liệt kê hai sự không tương thích được biết đến: đường ống song song thông qua v0.15.0, và dự đoán mô hình dự thảo thông qua v0.10.0. Đối với bản thảo phương pháp, mặc định 2026 thường là EAGLE-3 (`"method": "eagle3"`), được bao gồm trong giai đoạn 17 · 05.

### Những con số mà bạn nên nhớ

- Llama 3.3 70B FP8, H100 SXM5, 128 đồng thời, cả ba trên: 2.200-2.400 tok / s.
- Mô hình tương tự, vLLM mặc định (không có prefill cục bộ): ~ 1,800 tok/s.
- Tương tự mô hình, PyTorch forward loop ngây thơ: ~600 tok/s.
- Lưu thải phân mảnh KV dưới PagedAttention khi tải sản xuất: < 4%.
- P99 ITL dưới tải hỗn hợp: ~ 15 ms với prefill mảnh, ~ 50 ms mà không có.

### Định trình lịch trình trông như thế nào

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py`là chính xác vòng lặp này trong stdlib Python với số lượng token giả và độ trễ về phía trước giả.

```figure
tensor-parallel
```

## Sử dụng nó

`code/main.py`mô phỏng một trình lập lịch kiểu vLLM với các tính năng có thể chuyển đổi.

- `NAIVE`chế độ: một yêu cầu một lần, không có hàng.
- `STATIC`chế độ: pad và chờ, batching cổ điển.
- `CONTINUOUS`chế độ: nhập và phát hành ở cấp lặp.
- `CONTINUOUS + CHUNKED`chế độ: Prefill slices được trộn với decode.

Kết quả xuất hiện cho thấy tổng thông qua (tốc hiệu mỗi giây ảo), trung bình TTFT và P99 ITL.`CONTINUOUS + CHUNKED`hàng nên thống trị giao thông hỗn hợp.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-vllm-scheduler-reader.md`Với cấu hình phân phối (kích thước lô, sử dụng bộ nhớ KV, kích thước prefill chia nhỏ, cấu hình đầu cơ), nó tạo ra một chẩn đoán lập trình cho tên là ba mặc định là nút thắt chai và điều gì để điều chỉnh.

## Các bài tập

1. Đi chạy`code/main.py`- So sánh`STATIC`đến`CONTINUOUS`khi tải trọng công việc với các yêu cầu ngắn và dài hỗn hợp.
2. Thay đổi lập trình đồ chơi để thêm `--max-num-batched-tokens`. Giá trị chính xác của H100 chạy Llama 3.3 70B FP8 là gì? (Đề nghị: nó là một hàm của kích thước khối KV và số lượng khối tự do, không phải là HBM thô.)
3. Đọc lại các ghi chú phát hành vLLM v0.18.0.
4. Xét lượng lãng phí phân mảnh cache KV cho một số 1000 yêu cầu với trung bình 1.500 token đầu ra, std 600 token, dưới (a) phân bổ liên tiếp mỗi yêu cầu ở mức 8192 tối đa, (b) PagedAttention với 16 block token.
5. Giải thích trong một đoạn tại sao việc sơn trước bằng mảnh giúp P99 ITL nhưng không giúp tính năng thông qua một cách riêng biệt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Đọc thêm

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) nguồn chính thức về tính tương thích của prefill và decoding đầu cơ.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026 phát hành chuỗi và hành vi cụ thể cho phiên bản.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) bản viết ban đầu vẫn xác định cách suy nghĩ về người phân bổ.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) Phân tích phân mảnh và thiết kế lập lịch trình.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) trình lập lịch V1 chi tiết đi qua với biểu đồ lửa.
