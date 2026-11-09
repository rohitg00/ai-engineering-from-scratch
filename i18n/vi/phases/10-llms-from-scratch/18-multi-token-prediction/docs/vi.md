# Dự đoán đa token (MTP)

> Mỗi LLM tự do từ GPT-2 đến Llama 3 đều có một lỗ mỗi vị trí: dự đoán token tiếp theo. DeepSeek-V3 đã thêm một lỗ thứ hai cho mỗi vị trí: dự đoán token sau đó. Các tham số 14B bổ sung (tại một mô hình 671B) được chưng cất trở lại mô hình chính thông qua dòng chảy gradient, và các đầu MTP được đào tạo được sử dụng lại khi suy luận như các trình soạn thảo giải mã phỏng đoán với chấp nhận 80% +. Tiền suất 1,8x thế hệ được miễn phí. Bài học này xây dựng mô-đun MTP theo trình tự từ báo cáo kỹ thuật DeepSeek, tính toán tổn thất và bố cục tham số đầu chia sẻ, và giải thích tại sao MTP giữ chuỗi nguyên nhân trong khi MTP song song ban đầu của Gloeckle et al. đã phá vỡ nó.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Mục tiêu học tập

- Cụ thể mục tiêu đào tạo MTP và rút ra sự mất mát chung qua độ sâu dự đoán.
- Giải thích sự khác biệt giữa các đầu MTP song song (2024) của Gloeckle et al. và các mô-đun MTP theo trình tự của DeepSeek-V3 và lý do tại sao thiết kế theo trình tự bảo tồn chuỗi nguyên nhân.
- Xét các tham số và bộ nhớ trên của việc thêm các mô-đun MTP vào một cuộc chạy trước khi tập luyện.
- Thực hiện một mô-đun MTP từ đầu: nhúng chung, khối biến đổi độ sâu, chiếu và đầu đầu ra chung.

## Vấn đề

Dự đoán token tiếp theo là mục tiêu đào tạo LLM tiêu chuẩn. Mỗi trạng thái ẩn được giám sát để dự đoán chính xác một điều: token ngay sau đó. Đó là một tín hiệu đáng ngạc nhiên yếu. Hầu hết thông tin trong một chuỗi mở rộng vượt ra ngoài một biểu tượng cấu trúc, liên tục, thực tế, dòng chảy toán học. Mô hình phải học được những thứ đó bằng cách tích lũy nhiều tín hiệu một mã trên hàng nghìn tỷ mã.

MTP hỏi: nếu mỗi trạng thái ẩn được giám sát để dự đoán nhiều token tương lai cùng một lúc thì sao? Gloeckle et al. (Meta, 2024) cho thấy điều này giúp đỡ. Việc thực hiện của họ đặt một số đầu đầu ra độc lập trên đỉnh xương sống, mỗi dự đoán một sự bù đắp khác nhau. Đồng thời, đơn giản, nhưng các đầu nhìn thấy cùng một trạng thái ẩn mà không cần bất kỳ tinh tế hàng bậc nào và các dự đoán không liên kết nguyên nhân, vì vậy chúng không thể được sử dụng cho việc giải mã giả định.

DeepSeek-V3 (Thi 12 2024) đã thiết kế lại MTP như là các mô-đun theo trình tự giữ chuỗi nguyên nhân ở mỗi độ sâu dự đoán.`t+1`từ `h_i^(0)`, sau đó dự đoán`t+2`từ một trạng thái ẩn mới `h_i^(1)`kết hợp`h_i^(0)`với `E(t+1)`mỗi chiều sâu là khối biến đổi nhỏ của riêng mình. đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu đầu

Bài học này xây dựng một mô-đun MTP duy nhất và mất độ sâu D từ đầu.

## Khái niệm

### Công thức MTP theo trình tự

DeepSeek-V3 thêm `D`Các mô-đun MTP trên đầu mô hình chính. mô hình chính dự đoán `t_{i+1}`Mỗi mô-đun`k`(để `k = 1..D`) dự đoán token `k`bước ra ngoài hơn, `t_{i+k+1}`, được cho một dấu tiền qua vị trí `i`- Tôi không biết.

Module `k`bao gồm:

- Một khối biến đổi `T_k`với sự chú ý của riêng nó và MLP.
- Một matrix chiếu `M_k`kết hợp tình trạng ẩn sâu trước đó với sự nhúng vào của biểu tượng chân lý căn bản sâu tiếp theo.
- Sự kết hợp chung `E`(Tương tự như mô hình chính).
- Đầu đầu ra chung `Out`(Tương tự như mô hình chính).

Trong buổi tập, cho một dấu tiền từ vị trí qua vị trí `i`, trạng thái ẩn sâu là:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

Dự đoán sâu sắc là:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

Sự mất mát sâu sắc là sự thấu hiểu giữa sự thật và sự thật cơ bản .`t_{i+k+1}`- Có thể là:

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

Sự mất khớp qua độ sâu:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`là một yếu tố trọng lượng nhỏ  DeepSeek-V3 sử dụng 0,3 cho 10% đầu tiên của đào tạo và 0,1 sau đó.`L_main + L_MTP`- Tôi không biết.

### Tại sao liên tục, không song song

MTP song song ban đầu của Gloeckle có đầu đầu phát D, mỗi đầu được áp dụng trực tiếp cho `h_i^(0)`Mỗi đầu tiên tiên đoán`t_{i+k}`Điều đó tập hợp tốt, nhưng các dự đoán không được điều kiện với nhau.`head_1`- Tạo ra để giúp đỡ`head_2` đầu bắn song song.

Thiết kế liên tục của DeepSeek-V3 xây dựng `h_i^(k)`từ `h_i^(k-1)`cộng với thực tế next-token nhúng `E(t_{i+k})`Điều đó giữ nguyên chuỗi nguyên nhân: dự đoán`t_{i+k+1}`, mô-đun ở độ sâu `k`thấy cái gì đang xảy ra `t_{i+k}`. Điều này có cấu trúc giống hệt với cách một máy giải mã tự động tiêu thụ đầu ra của riêng nó, làm cho các mô-đun MTP trực tiếp có thể sử dụng như các trình soạn thảo giải mã đầu cơ.

Khi kết luận: thức ăn `h_i^(k-1)`và các bản thảo `t_{i+k}`vào mô-đun `k`, có được một dự đoán cho `t_{i+k+1}`. Lặp lại. Đó chính xác là một bản thảo kiểu EAGLE, sử dụng mô-đun MTP được đào tạo như là bản thảo mạng. DeepSeek-V3 báo cáo chấp nhận 80% + trên mô-đun MTP đầu tiên và tăng tốc ~ 1.8x.

### Tài khoản tham số

Để làm mẫu với ẩn `h`và từ vựng `V`- Có thể là:

- Mô hình chính: hàng tỷ tham số, cộng với một đầu đầu ra kích thước `V * h`- Tôi không biết.
- Đầu đầu ra chung: sử dụng lại đầu của mô hình chính. Không có param thêm.
- Chia sẻ nhúng: tái sử dụng nhúng của mô hình chính. Không thêm param.
- Phương tiện:
  - Dự án `M_k``(2h) * h = 2h^2`- Tôi không biết.
  - Phòng biến đổi `T_k`: chú ý (`4h^2`cho MHA) cộng với MLP (thường là `8h^2`cho SwiGLU với tỷ lệ 8/3).`12h^2`mỗi khối.

Tổng số phụ phí cho mỗi mô-đun: `~14h^2`. cho DeepSeek-V3 `h = 7168`, D = 1 mô-đun: `~14 * 7168^2 = ~720M`DeepSeek-V3 báo cáo 14B  sự khác biệt là hầu hết các lớp chuyên gia là MoE trong mô-đun MTP.

### Sự trả tiền của việc giải mã đầu cơ

Trong quá trình đào tạo trước, các mô-đun MTP làm chậm đào tạo khoảng 10% (điều toán tiến hơn, mất mát thêm).

1. Denser tín hiệu đào tạo. Mỗi trạng thái ẩn thấy các mục tiêu giám sát D + 1. ảnh hưởng được đo trên MMLU, GSM8K, MATH, HumanEval: cải thiện liên tục vài điểm phần trăm trong các sự trừu tượng của DeepSeek-V3.

2. MTP đã được đào tạo để dự đoán vài token tiếp theo. Được tái sử dụng như một mạng dự thảo, nó cung cấp tỷ lệ chấp nhận 80% +. Ở mức đó, N = 3 hoặc N = 5 mã hóa spec cung cấp 1,8x thông qua. Chi phí thời gian đào tạo 10% trả lại khi bạn chạy đầu tiên.

### Mối quan hệ với Eagle

Eagle đào tạo mô hình dự thảo nhỏ KẾT KẾT KẾT sau khi đào tạo trước. MTP nướng dự thảo vào dự thảo trước đào tạo.

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## Hãy xây dựng nó

`code/main.py`xây dựng một mô-đun MTP kết thúc kết thúc: nhúng chung, chiếu, khối biến thể, đầu đầu ra chung. Sau đó nó tính toán mất tích chéo-entropy theo độ sâu trên một chuỗi tổng hợp ngắn và in số lượng tham số theo thành phần.

### Bước 1: bàn nhúng chung

Một người đơn `vocab_size x hidden`bảng được sử dụng bởi mô hình chính và bởi mỗi mô-đun MTP ở mọi độ sâu. Không có bản sao thứ hai  theo nghĩa đen cùng một tensor.

### Bước 2: sự kết hợp theo độ sâu

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

DeepSeek-V3 thực sự kết nối hai vector RMSNormed với `[2h]`và các dự án với một`h x 2h`Trò chơi sử dụng sự cộng vector cho độ ngắn của stdlib.

### Bước 3: khối biến đổi ở độ sâu k

Trong đồ chơi, một khối chú ý tuyến tính một lớp và một SwiGLU MLP giữ cho cấu trúc có thể nhìn thấy mà không bị numpy.

### Bước 4: đầu đầu ra chung

Sử dụng lại dự đoán đầu ra của mô hình chính.

### Bước 5: Thiệt độ mất

Cross-entropy của softmax (đơn vị) đối với token thực tại mặt đất khi bù đắp `k+1`- Tối đa độ sâu với `lambda / D`yếu tố quy mô.

### Bước 6: Tài khoản tham số

Bác ấn tổng số tham số, số chia sẻ (đã nhúng, đầu) và số phụ thêm mỗi mô-đun.

## Sử dụng nó

MTP được tích hợp vào DeepSeek-V3 (Táng 12 năm 2024) và loạt DeepSeek-R1.

- Dòng dịch vụ của DeepSeek sử dụng các mô-đun MTP như các bộ giải mã giả định ra khỏi hộp.
- vLLM và SGLang có các con đường tích hợp cho DeepSeek-V3 MTP từ tháng 4 năm 2026.
- Bài hướng dẫn ROCm SGLang của AMD cho thấy cấu hình giải mã đầu cơ MTP cụ thể với tốc độ đo 1,8x trên điểm kiểm soát V3.

Khi nào sử dụng MTP trong một cuộc chạy trước khi đào tạo mới:

- Bạn kiểm soát toàn bộ đường ống dẫn trước đào tạo và muốn phát tín hiệu đào tạo dày đặc hơn.
- Bạn biết rằng bạn sẽ phục vụ mô hình trên quy mô và muốn giải mã giả định miễn phí.
- Kích thước ẩn của bạn là ít nhất 4096.

Khi nào không nên:

- Định chỉnh một mô hình dày đặc được đào tạo trước.
- Các mô hình nghiên cứu mà bạn muốn một đường cơ sở sạch để so sánh. MTP thay đổi kiến trúc.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-mtp-planner.md`. Với một đặc điểm trước khi chạy đào tạo (kích thước mô hình, dữ liệu, tính toán), nó trả lại một kế hoạch để tích hợp MTP: số độ sâu D, `lambda`lịch trình, bộ nhớ trên, và thời gian suy luận-sử lý đầu cơ dây.

## Các bài tập

1. Đi chạy`code/main.py`. Cho thấy mất độ sâu giảm một cách đơn giản khi tín hiệu tổng hợp tăng cường.

2. Xét số lượng trên của một mô hình 70B dày đặc (bỏ 8192, 80 lớp) với mô-đun D=1 MTP. So sánh với số lượng trên 14B được báo cáo của DeepSeek-V3. Giải thích lý do tại sao số lượng của DeepSeek cao hơn: khối biến đổi MTP thừa hưởng cấu trúc MoE tương tự, làm tăng số lượng các tham số mỗi mô-đun.

3. Thực hiện D=2 trong đồ chơi: thêm một mô-đun MTP thứ hai$h^{(1)}$và dự đoán`t_{i+3}`- Kiểm tra sự mất mát chung và tính toán các tham số phù hợp với phương trình 19-21 của bài DeepSeek.

4. Chuyển đồ chơi sang MTP song song (Gloeckle-style): thêm đầu đầu ra D trên đỉnh trạng thái ẩn chính, mỗi dự đoán một sự bù đắp khác nhau. đo cách các tổn thất theo độ sâu so sánh với phiên bản theo trình trên cùng một tín hiệu tổng hợp. phiên bản theo trình nên tạo ra tổn thất độ sâu k thấp hơn cho k > 1 vì nó điều kiện trên các dự đoán trung gian.

5. Sử dụng mô-đun MTP được đào tạo như một bản thảo kiểu EAGLE: gọi mô-đun k để đề xuất `t_{i+k+1}`đo tỷ lệ chấp nhận của các mã thông báo dự thảo này so với dự đoán của mô hình chính trên một chuỗi được giữ. Nếu bạn đạt 50% + trên đồ chơi, bạn đã tái tạo thuộc tính MTP-as-draft thực nghiệm.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## Đọc thêm

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) mô tả MTP theo trình tự đầy đủ (Bộ 2.2), bao gồm các phương trình mất liên kết và tăng tốc 1,8x khi suy luận
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) đường cơ sở MTP song song thiết kế của DeepSeek cải thiện trên
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) Tổng số 685B (671B chính + 14B MTP), ghi chú triển khai
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) khung giải mã đầu cơ MTP phù hợp với
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) Dự thảo kiến trúc 2025 của EAGLE, đối tác MTP cạnh tranh với
