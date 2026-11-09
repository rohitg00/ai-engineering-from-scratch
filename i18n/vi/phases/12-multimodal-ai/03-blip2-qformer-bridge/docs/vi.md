# Từ CLIP đến BLIP-2  Q-Former như cầu Modality

> CLIP sắp xếp hình ảnh và văn bản nhưng không thể tạo tiêu đề, trả lời câu hỏi hoặc tổ chức cuộc trò chuyện. BLIP-2 (Salesforce, 2023) giải quyết điều đó với một cây cầu có thể đào tạo nhỏ: 32 vector truy vấn có thể học được tham gia qua các tính năng của ViT đóng băng thông qua sự chú ý chéo, sau đó slot trực tiếp vào dòng đầu vào của LLM đóng băng. 188M tham số cầu kết nối một ViT-g/14 với LLM đóng băng lớn như 11B Flan-T5-XXL. Mỗi VLM dựa trên bộ điều chỉnh thông qua năm 2026  MiniGPT-4, InstructBLIP, anh em họ của LLaVA  là một hậu duệ. Bài học này đọc kiến trúc của Q-Former, giải thích đào tạo hai giai đoạn của nó, và xây dựng một phiên bản đồ chơi cung cấp các token hình ảnh vào một bộ giải mã văn bản đóng băng.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Mục tiêu học tập

- Giải thích tại sao một nút thắt có thể đào tạo giữa một bộ mã hóa thị giác đóng băng và LLM đóng băng vượt qua việc điều chỉnh chi phí và ổn định từ đầu đến cuối.
- Thực hiện một khối chú ý qua nhau nơi một bộ truy vấn học tập cố định chăm sóc các tính năng hình ảnh bên ngoài.
- Đi qua quá trình huấn luyện trước hai giai đoạn của BLIP-2: đại diện (ITC + ITM + ITG) sau đó tạo ra (sự mất mát LM với máy giải mã đóng băng).
- So sánh Q-Former với máy chiếu MLP đơn giản hơn được sử dụng trong LLaVA và tranh luận khi mỗi lựa chọn thắng.

## Vấn đề

Bạn có ViT đóng băng sản xuất 256 mã thông báo váy của dim 1408 mỗi hình ảnh. Bạn có một mã thông báo váy 7B đóng băng dự kiến nhúng mã thông báo của dim 4096. Cầu rõ ràng  một lớp tuyến tính từ 1408 đến 4096  hoạt động, nhưng cung cấp tất cả 256 mã thông báo váy vào bối cảnh của LLM chi phí 256 mã thông báo thêm mỗi hình ảnh.

Câu hỏi BLIP-2: bạn có thể nén đại diện hình ảnh 256 token thành ít hơn nhiều token (chẳng hạn là 32) trong khi vẫn giữ đủ thông tin cho LLM để ghi chú, trả lời các câu hỏi và lý luận về hình ảnh? Và bạn có thể đào tạo cây cầu này mà không chạm vào xương sống đóng băng, giữ chi phí đào tạo chỉ ở các tham số của cây cầu?

Câu trả lời: một Q-Former. 32 vector "query" có thể học được, liên kết với các mã hóa patch của ViT, tạo ra một bản tóm tắt trực quan 32 mã hóa mà LLM tiêu thụ.

## Khái niệm

### Các câu hỏi có thể học được

Trù cốt lõi của Q-Former: thay vì để các mã thông báo văn bản của LLM tham gia vào các bản vá hình ảnh, giới thiệu một bộ mới của 32 vector truy vấn có thể học `Q`Các truy vấn là các tham số của mô hình  chúng được học trong quá trình đào tạo và cùng 32 truy vấn được sử dụng cho mỗi hình ảnh.

Sau khi chú ý qua nhau, mỗi truy vấn chứa một bản tóm tắt nén của hình ảnh  "xác định đối tượng chính", "xác định nền", "đếm các đối tượng", vv Các truy vấn không chuyên về nhãn ngữ nghĩa; họ học bất cứ điều gì mã hóa làm giảm tổn thất dòng chảy.

### Kiến trúc

Q-Former là một bộ biến đổi nhỏ (12 lớp, ~ 100M params) với hai con đường:

1. Chặng đường truy vấn: 32 vector truy vấn chảy qua sự chú ý tự (tạm dịch: tự chú ý), sau đó là sự chú ý chéo qua các mã thông báo vá của ViT đóng băng, sau đó là FFN.
2. Hướng dẫn văn bản: một bộ mã hóa văn bản giống BERT chia sẻ sự chú ý tự và trọng lượng FFN với đường truy vấn.

Trong thời gian đào tạo, cả hai con đường đều chạy. Các truy vấn và văn bản tương tác thông qua sự tập trung chung, có nghĩa là các truy vấn có thể điều chỉnh văn bản cho các nhiệm vụ cần thiết (ITM, ITG).

### Việc đào tạo hai giai đoạn

BLIP-2 tập luyện trước trong hai giai đoạn:

Giai đoạn 1: học đại diện (không có LLM). Ba lỗ:
- ITC (phản ứng tương phản hình ảnh-tinh văn): Tương ứng tương phản CLIP giữa các mã thông báo truy vấn tập hợp và mã thông báo CLS văn bản.
- ITM (phản ứng hình ảnh- văn bản): phân loại nhị phân  cặp hình ảnh- văn bản này là một sự phù hợp? Hard-negative-mined.
- ITG (tạo văn bản dựa trên hình ảnh): LM nguyên nhân đầu trên văn bản, tùy thuộc vào các truy vấn.

Chỉ có tàu Q-Former, ViT bị đóng băng, không có LLM.

Giai đoạn 2: học sinh sinh. Thêm một LLM đóng băng (OPT-2.7B hoặc Flan-T5-XL, vv). Dự án 32 đầu ra truy vấn vào các LLM nhúng thấp hơn thông qua một lớp tuyến tính nhỏ. Chuẩn bị chúng cho văn bản prompt. Chỉ tập chiếu tuyến tính và Q-Former trên LM mất trên chuỗi liên kết prompt + hình ảnh + tiêu đề.

Sau giai đoạn 2, dự án Q-Former + là bộ điều chỉnh trực quan đầy đủ. Khi suy luận: hình ảnh → ViT → Q-Former → dự án tuyến tính → trước văn bản → LLM đóng băng phát ra.

### Kinh tế tham số

BLIP-2 với ViT-g/14 (1.1B, đông lạnh) + OPT-6.7B (6.7B, đông lạnh) + Q-Former (188M, được đào tạo) = tổng cộng 8B, 188M được đào tạo.

Chất lượng: BLIP-2 tương thích hoặc đánh bại Flamingo-80B trên VQA bắn không nhưng nhỏ hơn 50 lần.

### InstructBLIP và Q-Former có ý thức về hướng dẫn

InstructBLIP (2023) mở rộng Q-Former với một đầu vào bổ sung: bản văn hướng dẫn. Trong thời gian chú ý chéo, các truy vấn bây giờ có quyền truy cập cả vào các bản vá hình ảnh và hướng dẫn. Các truy vấn có thể chuyên về từng hướng dẫn ("đếm xe", "xác định tâm trạng") thay vì học một bản tóm tắt cố định duy nhất. Điểm chuẩn tăng lên trên các nhiệm vụ đã được tổ chức.

### MiniGPT-4 và phương pháp tiếp cận chỉ dùng máy chiếu

MiniGPT-4 giữ Q-Former nhưng chỉ đào tạo các dự đoán đường thẳng đầu ra trong khi đóng băng tất cả mọi thứ khác. rẻ, nhưng chi phí là chất lượng  các truy vấn là BLIP-2, không phải của bạn.

### Tại sao LLaVA trở nên đơn giản hơn

LLaVA (2023, Bài học 12.05) thay thế Q-Former bằng một MLP 2 tầng đơn giản chiếu mỗi token ViT patch vào không gian LLM  576 token mỗi hình ảnh cho một lưới 24x24, tất cả được cung cấp cho LLM. Khử trùng tồi tệ hơn nhưng cho phép LLM tham gia hơn các vết tháo nguyên liệu. Vào thời điểm đó điều này gây tranh cãi; vào cuối năm 2023 nó đã thống trị bởi vì dữ liệu hướng dẫn thị giác (LLaVA-Instruct-150k) chứng minh rằng MLP có thể được đào tạo để bảo tồn đủ tín hiệu. Sự thỏa hiệp: ngữ cảnh của LLaVA điền nhanh hơn, nhưng nó tự nhiên mở rộng sang nhiều hình ảnh và video.

Đến năm 2026, phân chia lĩnh vực: Q-Former tồn tại ở nơi ngân sách token quan trọng (video dài, nhiều hình ảnh); máy chiếu MLP thống trị nơi chất lượng thô mỗi token là ưu tiên.

### Sự chú ý qua cửa: Flamingo, tổ tiên

Flamingo (Dạy 12.04) trước BLIP-2 và sử dụng cùng một ý tưởng chú ý chéo nhưng ở mỗi lớp LLM đóng băng, không phải là một cầu duy nhất. BLIP-2 cho thấy bạn có thể nén đến lớp đầu vào chỉ và vẫn hoạt động. Gemini và Idefics kết hợp cả hai: mã thông báo đầu vào được giao tiếp cộng với sự chú ý chéo được đóng cửa tùy chọn cho vài cú chụp trong bối cảnh.

### Những người kế thừa năm 2026

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4, và hầu hết các mô hình ngôn ngữ video vì lý do ngân sách token.
- Các thiết bị nhận dạng: biến thể Flamingo (Dạy 12.04); Gia đình Idefics, Eagle, OmniMAE.
- Máy chiếu MLP: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- Đội Vị VILA, PaliGemma.

Tất cả bốn đều hợp lệ. Câu hỏi quyết định là liệu bạn có bị hạn chế về ngân sách token hay về chất lượng mỗi token.

```figure
modality-projection
```

## Sử dụng nó

`code/main.py`xây dựng một sự chú ý qua nhau theo kiểu Stdlib Q-Former:

1. Mô phỏng 256 mã hóa vá hình ảnh (dim 128).
2. Tự nhiên 32 truy vấn có thể học được (vùng 128).
3. Tiếp tục quy mô điểm- sản phẩm sự chú ý chéo (Q từ truy vấn, K/V từ các bản vá).
4. Dự án LLM-dim (512) thông qua một lớp tuyến tính.
5. Tạo ra 32 mã thị giác sẵn sàng cho LLM.

Tất cả toán học trong Python tinh khiết (đường vòng tròn trên các vector). Toy nhưng hình dạng chính xác.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-modality-bridge-picker.md`. Với cấu hình VLM mục tiêu (số mã hóa hình ảnh, ngân sách bối cảnh LLM, hạn chế triển khai, mục tiêu chất lượng), nó khuyên Q-Former vs MLP vs Perceiver resampler với một lý do ngắn và ước tính số parameter cho mỗi cầu.

## Các bài tập

1. Thực hiện khối chú ý chéo trong PyTorch. Kiểm tra rằng với 32 truy vấn và 256 phím / giá trị, các khối lượng chú ý là 32 x 256 và mỗi hàng tổng cộng đến 1 sau softmax.

2. Trong BLIP-2 giai đoạn 1, Q-Former chạy ba lỗ đồng thời: ITC, ITM, ITG. Viết chữ ký về phía trước cho mỗi trong mã giả.

3. So sánh số lượng tham số: Q-Former (12 lớp, 768 ẩn) so với một máy chiếu MLP 2 lớp (1408 → 4096, hai lớp).

4. Đọc Phần 3.2 của bài báo BLIP-2 (arXiv:2301.12597) về cách khởi tạo Q-Former. Giải thích tại sao khởi tạo từ cơ sở BERT (không ngẫu nhiên) tăng tốc sự hội tụ.

5. Đối với một video 10 phút với 1 FPS lấy mẫu đến 60 khung hình, tính toán chi phí mã thông báo mỗi khung hình tại (Q-Former → 32 mã thông báo / khung hình) so với (MLP dự đoán → 576 mã thông báo / khung hình).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## Đọc thêm

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) giấy cốt lõi.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) người tiền nhiệm với bộ ba ITC/ITM/ITG.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) "định hướng trước khi hợp nhất"  tổ tiên khái niệm của giai đoạn 1 đào tạo.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) Q-Former biết hướng dẫn.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) Phương pháp chỉ sử dụng máy chiếu.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) kiến trúc chung cho sự chú ý chéo của những người có thể học hỏi.
