# Capstone 12  Video hiểu đường ống (Scene, QA, Tìm kiếm)

> 12 phòng thí nghiệm sản xuất Marengo + Pegasus. VideoDB đã gửi CRUD-for-video API. Molmo 2 của AI2 đã công bố các trạm kiểm soát VLM mở. Gemini xử lý nhiều giờ video theo bản địa. TimeLens-100K xác định định định kỳ đất ở quy mô. Các đường ống 2026 đã được giải quyết: phân đoạn cảnh, tiêu đề mỗi cảnh + nhúng, sắp xếp bản sao, chỉ số đa vector, và một truy vấn trả lời với (bắt đầu, kết thúc) dấu thời gian cộng với khung cảnh xem trước. Ngọc cuối đang tiêu thụ 100 giờ, đạt được các điểm chuẩn công cộng, và đo ảo giác về việc đếm và hành động.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Vấn đề

QA video hình thức dài là vấn đề đa phương thức hung hát băng thông nhất ở quy mô 2026. Gemini 2.5 Pro có thể đọc một video 2 giờ bằng bản địa, nhưng tiêu thụ 100 giờ video vào một tập hợp truy vấn vẫn đòi hỏi một chỉ số cấp độ cảnh. Hình dạng sản xuất kết hợp phân đoạn cảnh (TransNetV2 hoặc PySceneDetect), ghi chú mỗi cảnh với VLM (Gemini 2.5, Qwen3-VL-Max, hoặc Molmo 2), sắp xếp bản ghi chép (Whisper-v3-turbo với dấu thời gian từ), và chỉ số đa vector lưu trữ bản ghi chú, nhúng khung và bản ghi chép bên cạnh. Các câu trả lời của đường ống truy vấn với dấu thời gian (bắt đầu, kết thúc) cộng với khung xem trước.

Các điểm chuẩn là công cộng (ActivityNet-QA, NeXT-GQA) cộng với bộ tùy chỉnh 100 truy vấn của riêng bạn.

## Khái niệm

Ba đường ống chạy song song khi hấp thụ. **Scene segmentation**cắt đoạn video thành cảnh. **VLM captioning**tạo ra một caption cho mỗi cảnh và một khung hình nhúng từ một khung hình phím. **ASR alignment**tạo ra dấu thời gian cấp từ. Ba dòng được kết hợp bởi (scene_id, phạm vi thời gian). Mỗi cảnh nhận được ba loại vector trong một chỉ số đa vector (Qdrant): nhúng tiêu đề, nhúng khung phím, nhúng bản sao.

Vào thời điểm truy vấn, câu hỏi ngôn ngữ tự nhiên bắn vào cả ba vector; kết quả hợp với RRF; một bộ điều chỉnh thời gian (tương tự TimeLens) tinh chỉnh cửa sổ (bắt đầu, kết thúc) trong cảnh trên. Máy tổng hợp VLM (Gemini 2.5 Pro hoặc Qwen3-VL-Max) lấy truy vấn + cảnh trên + khung hình cắt và trả lời với dấu thời gian được trích dẫn và xem trước khung hình.

Các phép đo ảo giác quan trọng. Các câu hỏi đếm ("các người vào phòng?") và loại hành động ("nước đầu bếp đổ trước khi xộn?") là không đáng tin cậy.

## Kiến trúc

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## Thống

- Phân khu vực cảnh: TransNetV2 (các hiện đại nhất 2024-26) hoặc PySceneDetect
- ASR: Whisper-v3-turbo thông qua faster-whisper với dấu thời gian từ
- VLM captioner + answerer: Gemini 2.5 Pro hoặc Qwen3-VL-Max hoặc Molmo 2
- Địa điểm thời gian: bộ điều chỉnh TimeLens-100K hoặc VideoITG
- Chỉ số: Qdrant với hỗ trợ đa vector (chốt đề / khung / bản sao)
- UI: Next.js 15 với trình phát video HTML5 và hình ảnh nhỏ cảnh
- Eval: ActivityNet-QA, NeXT-GQA, bộ dán nhãn tay tùy chỉnh 100 câu hỏi
- Chỉ số chuẩn ảo giác: đếm và loại hành động phụ với nhãn tay

```figure
cf-scene-index
```

## Hãy xây dựng nó

1. **Ingest walker.**Tự chấp nhận URL YouTube hoặc MP4 địa phương. Tới mức 720p nếu cần thiết.`{video_id, file_path}`- Tôi không biết.

2. **Scene segmentation.**Tiếp tục TransNetV2 hoặc PySceneDetect để tạo `[{scene_id, start_ms, end_ms, keyframe_path}]`Mục tiêu 100 giờ: khoảng 6k-8k cảnh.

3. **ASR pass.**Chạy Whisper-v3-turbo trên âm thanh; xuất dấu thời gian ở mức từ; chia thành các đoạn văn bản mỗi cảnh.

4. **VLM captioning.**Theo mỗi cảnh, gọi Gemini 2.5 Pro (hoặc Qwen3-VL-Max) với khung khóa và một mẫu caption ngắn.

5. **Multi-vector index.**Thu thập Qdrant với ba vector được đặt tên.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`- Tôi không biết.

6. **Query.**Câu hỏi ngôn ngữ tự nhiên phát ra ba câu hỏi dày đặc; hợp nhất với sự hợp nhất cấp bậc tương đối; top-k=5 cảnh.

7. **Temporal grounding.**Dạy bộ chuyển đổi kiểu TimeLens trên cảnh trên để tinh chỉnh cửa sổ (bắt đầu, kết thúc) trong cảnh.

8. **VLM synth.**Gọi Gemini 2.5 Pro với truy vấn + 3 clip cảnh đầu (như hình ảnh hoặc clip ngắn) + bản ghi.`(video_id, start_ms, end_ms)`Các trích dẫn.

9. **Eval.**Thực hiện ActivityNet-QA và NeXT-GQA. Xây dựng một bộ tùy chỉnh 100 truy vấn. báo cáo độ chính xác tổng thể + phân chia từng lớp (số, hành động, mô tả).

## Sử dụng nó

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Chuyển nó

`outputs/skill-video-qa.md`Được cung cấp một URL YouTube hoặc video tải lên, đường ống chỉ mục cảnh và trả lời các câu hỏi với trích dẫn thời gian.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Các bài tập

1. Thay đổi Gemini 2.5 Pro với Qwen3-VL-Max trên thẻ ghi chú.

2. Giảm tích hợp khung hình mỗi cảnh thành một vector tập hợp thay vì nhiều vector. đo sự lùi hồi phục.

3. Xây dựng chế độ "đếm chặt chẽ": máy tổng hợp lấy mỗi phiên bản được đếm bằng một dấu thời gian và người dùng nhấp để xác minh.

4. Giá trị tiêu chuẩn: giờ xem video/đô trong ba lựa chọn VLM.

5. Thêm bản ghi chép ghi âm của loa: chạy bản ghi chép ghi âm của loa trên âm thanh và nhúng bản ghi âm cho mỗi loa.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Đọc thêm

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) mở các trạm kiểm soát VLM
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) Địa ngục thời gian ở quy mô
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) tài liệu tham chiếu được lưu trữ
- [VideoDB](https://videodb.io) CRUD-for-video API tham chiếu
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) Khán giả thương mại
- [TransNetV2](https://github.com/soCzech/TransNetV2) Mô hình phân đoạn cảnh
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) thay thế mở cổ điển
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) Định nghĩa đánh giá tham chiếu
