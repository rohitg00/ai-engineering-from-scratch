# Các tiêu chuẩn: WebArena và OSWorld

> WebArena kiểm tra khả năng đại lý web trên bốn ứng dụng tự lưu trữ. OSWorld kiểm tra khả năng đại lý máy tính để bàn trên Ubuntu, Windows, macOS. Khi phát hành (20232024) cả hai đều cho thấy khoảng cách lớn giữa các đại lý tốt nhất trong lớp và con người.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả bốn ứng dụng tự lưu trữ của WebArena và lý do tại sao đánh giá dựa trên thực hiện quan trọng.
- Giải thích tại sao OSWorld sử dụng ảnh chụp màn hình thực của hệ điều hành thay vì API truy cập.
- Hãy nêu tên hai chế độ thất bại chính của OSWorld: GUI và kiến thức hoạt động.
- Tóm lại những gì OSWorld-G và OSWorld-Human thêm vào điểm tham khảo cơ bản.

## Vấn đề

Các đại lý tổng quát có thể gọi công cụ. Họ có thể điều khiển trình duyệt qua 20 nhấp chuột để hoàn thành thanh toán mua sắm? Họ có thể cấu hình một hộp Linux chỉ sử dụng bàn phím và chuột? Đây là câu hỏi WebArena và OSWorld trả lời.

## Khái niệm

### WebArena (Zhou et al., ICLR 2024)

- 812 nhiệm vụ dài đường dài trên bốn ứng dụng web tự lưu trữ: một trang web mua sắm, một diễn đàn, một công cụ phát triển giống như GitLab, một CMS kinh doanh.
- Thêm các tiện ích: bản đồ, máy tính, scratchpad.
- Đánh giá dựa trên việc thực hiện thông qua APIs phòng tập thể dục  đã đặt hàng, vấn đề đã bị đóng, trang CMS đã được cập nhật?
- Khi phát hành: chất độc GPT-4 tốt nhất đạt thành công 14,41% so với con người 78,24%.

Các bản khung tự lưu trữ quan trọng  điểm chuẩn không nhét bởi vì các ứng dụng mục tiêu được gắn và có thể tái tạo.

### Các mở rộng

- **VisualWebArena** các nhiệm vụ dựa trên hình ảnh nơi thành công phụ thuộc vào việc giải thích hình ảnh (các bức ảnh màn hình như quan sát hạng nhất).
- **TheAgentCompany**(Dec 2024)  thêm terminal + mã hóa; giống như một môi trường làm việc từ xa thực sự.

### OSWorld (Xie et al., NeurIPS 2024)

- 369 nhiệm vụ máy tính thực sự trên Ubuntu, Windows, macOS.
- Kiểm soát bàn phím và chuột dạng tự do của các ứng dụng thực.
- 1920×1080 ảnh chụp màn hình như quan sát.
- Khi phát hành: mô hình tốt nhất 12,24% so với con người 72,36%.

### Các chế độ thất bại chính

1. **GUI grounding.**Phép đồ thị phần tử Pixel →. Các mô hình vật lộn để định vị các phần tử UI một cách đáng tin cậy trong 1920 × 1080.
2. **Operational knowledge.**Menu nào có cài đặt, cách tắt bàn phím nào, bảng ưu tiên nào.

### Tiếp tục

- **OSWorld-G** 564 mẫu bộ ghép đất + bộ huấn luyện Jedi.
- **OSWorld-Human** các quỹ đạo hành động vàng được chọn bằng tay.

### Tại sao điều này quan trọng

Claude sử dụng máy tính, OpenAI CUA, Gemini 2.5 sử dụng máy tính (Dạy học 21) tất cả đào tạo trên khối lượng công việc được định hình bởi WebArena và OSWorld.

### Khi đánh giá so sánh đi sai

- **Screenshot-only evals.**OSWorld được điều khiển bằng ảnh chụp màn hình; đánh giá một đại lý sử dụng DOM hoặc API truy cập trên OSWorld bỏ lỡ thách thức đặt đất.
- **Ignoring trajectory length.**Chỉ đạt tỷ lệ thành công bỏ lỡ 1.4-2.7x không hiệu quả bước OSWorld-Human bề mặt.
- **Stale self-hosted apps.**Các ứng dụng của WebArena pin các phiên bản cụ thể; cập nhật mà không cần tái điều chỉnh phá vỡ khả năng so sánh.

```figure
ae-agent-human-gap
```

## Hãy xây dựng nó

`code/main.py`thực hiện một dây thắt máy web đồ chơi:

- Một máy trạng thái "app mua sắm" tối thiểu: list_items, add_to_cart, checkout.
- Các quỹ đạo vàng cho 3 nhiệm vụ.
- Một nhân viên có kịch bản cố gắng mỗi nhiệm vụ.
- Đánh giá dựa trên thực hiện (điểm tra trạng thái) và chỉ số hiệu quả quỹ đạo (giải pháp so với vàng).

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: tỷ lệ thành công và hiệu quả đường mòn mỗi nhiệm vụ, phản ánh phương pháp của OSWorld-Human.

## Sử dụng nó

- **WebArena Verified**tự lưu trữ trên một cluster nội bộ để đánh giá liên tục.
- **OSWorld**trong một đội máy tính ảo cho các đại lý máy tính để bàn.
- **Computer-use agents**(Dân học 21) Claude, OpenAI CUA, Gemini đều được đào tạo về những khối lượng công việc như thế này.
- **Your own product flows** bắt được quỹ đạo vàng cho 20 nhiệm vụ hàng đầu của bạn; chạy các đại lý chống lại chúng hàng tuần.

## Chuyển nó

`outputs/skill-web-desktop-harness.md`xây dựng một hệ thống web/desktop với các metric evalu và trajectory efficiency dựa trên thực hiện.

## Các bài tập

1. Cải đệm đồ chơi với một ứng dụng thứ hai (một diễn đàn).
2. Thêm báo cáo hiệu quả quỹ đạo cho mỗi nhiệm vụ.
3. Thực hiện một công cụ "đánh nhiễu"  một quỹ đạo vàng không bao giờ sử dụng.
4. Đọc OSWorld-G. Làm thế nào bạn phân biệt thất bại về việc đặt đất với thất bại về kế hoạch trong các đánh giá của riêng bạn?
5. Đọc các ứng dụng của WebArena README. Khi bạn nâng cấp một trong các phiên bản ứng dụng gắn kết, bạn sẽ bị hỏng gì?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## Đọc thêm

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) Định nghĩa web bốn ứng dụng
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) Định nghĩa bảng điều khiển trên máy tính để bàn
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) Khả năng hình dạng chuẩn của Claude
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) Số OSWorld và WebArena
