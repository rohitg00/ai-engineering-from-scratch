# Capstone 12  Video Anlama Boru hattı (Scen, QA, Search)

> 12 Laboratuvar Marengo + Pegasus üretti. VideoDB CRUD-for-video API'si gönderdi. AI2'nin Molmo 2'si açık VLM kontrol noktalarını yayınladı. Gemini uzun bağlamlı saatlerce videoyu yerli olarak ele alıyor. TimeLens-100K, zamanlı yerleşimleri ölçekte tanımladı. 2026 boru hattı çözülmüştür: sahne segmentasyonu, sahne başına başlık + yerleştirme, transkript ayarlaması, çok vektörlü indeks ve (başlangıç, son) zaman damgaları ve çerçeve ön izleri ile cevap veren bir sorgu. Son taş 100 saatlik bir işlev alıyor, kamu standartlarına ulaşıyor ve sayım ve eylem sorularındaki halüsinasyonları ölçüyor.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Sorun

Uzun format video kaliteli 2026 ölçeğinde en çok bant genişliği aç multimodal sorun. Gemini 2.5 Pro 2 saatlik bir videoyu doğuştan okuyabilir, ama 100 saatlik bir videoyu sorulabilir bir korpus içine yerleştirmek hala sahne seviyesinde bir indeks gerektirir. Üretim şekli sahne segmentasyonunu (TransNetV2 veya PySceneDetect), sahne başına başlık yazmayı (Gemini 2.5, Qwen3-VL-Max veya Molmo 2), transkript ayarlamasını (Whisper-v3-turbo kelimenin zaman damgaları ile) ve başlık, çerçeve yerleştirme ve transkripti yan yana saklayan bir çok vektör endeksi birleştiriyor. Sorgu hattı, (başlangıç, son) zaman damgaları ve çerçeve ön izleri ile cevaplar verir.

Benchmarks kamuoyundadır (ActivityNet-QA, NeXT-GQA) ve kendi 100 sorgu özel seti. Sayım ve eylem türü sorulardaki halüsinasyon bilinen-karar başarısızlık sınıfıdır; kap taşı açıkça ölçer.

## Anlam

Üç boru hattı, yediklerinde paralel olarak çalışır.**Scene segmentation**Videoyu sahneye ayırır.**VLM captioning**Bir sahne başına bir başlık ve bir anahtar çerçevesinden yerleştirilen bir çerçeve oluşturur. **ASR alignment**Bu üç akış (scene_id, zaman aralığı) ile birleşti. Her sahne bir çok vektör endeksinde (Qdrant) üç vektör türü elde eder: başlık yerleştirme, anahtar çerçeve yerleştirme, transkript yerleştirme.

Sorgu zamanında, doğal dil sorusu üç vektöre karşı ateş eder; sonuçlar RRF ile birleşir; bir zamanlı yerleşim adaptörü (TimeLens tarzı) üst sahne içindeki (başlangıç, son) penceresini inceler. VLM sentezörü (Gemini 2.5 Pro veya Qwen3-VL-Max) sorgu + üst sahne + alıntılanan zaman damgaları ve çerçeve ön görünümü ile çerçeve + kırılmış çerçeveler ve cevaplar alır.

Halüsinasyon ölçümü önemlidir. Sayım ("Hangi kişi odaya giriyor?") ve eylem tipi ("şef karıştırmadan önce döküyor mu?") sorular bilinirken güvenilir değildir.

## Mimarlık

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

## Yüküm

- Sahne segmentasyonu: TransNetV2 (yağnalı 2024-26) veya PySceneDetect
- ASR: Sözlü zaman damgaları ile daha hızlı damgalama yoluyla Whisper-v3-turbo
- VLM kablosu + cevaplayıcı: Gemini 2.5 Pro veya Qwen3-VL-Max veya Molmo 2
- Zamanlı yerleştirme: TimeLens-100K'li egzersizli adaptör veya VideoITG
- Endeks: Çok vektörlü destekleyici Qdrant (başlık / çerçeve / transkript)
- Kullanıcı Aracı: HTML5 video oynatıcısı ve sahne miniatürleri ile Next.js 15
- Eval: ActivityNet-QA, NeXT-GQA, özel 100 sorunun el etiketleme seti
- Halüsinasyon referans göstergesi: el etiketleri ile sayım ve eylem tipi alt kümeleri

```figure
cf-scene-index
```

## Yapın

1. **Ingest walker.**YouTube URL'lerini veya yerel MP4'leri kabul edin. Gerekirse 720p'ye indir.`{video_id, file_path}`- Evet .

2. **Scene segmentation.**TransNetV2 veya PySceneDetect çalıştırmak için `[{scene_id, start_ms, end_ms, keyframe_path}]`Hedef 100 saat: 6k-8k sahne.

3. **ASR pass.**Sesle Whisper-v3-turbo çalıştırın; kelime seviyesindeki zaman damgasını ihraç edin; sahne başına transkript parçalarına bölün.

4. **VLM captioning.**Her sahne için, anahtar çerçeve ve kısa bir başlık şablonu ile Gemini 2.5 Pro (veya Qwen3-VL-Max) arayın. Başlık + çerçeve gömülmesini üretin.

5. **Multi-vector index.**Üç isimli vektörlü Qdrant koleksiyonu.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`- Evet .

6. **Query.**Doğal dil sorusu üç yoğun soruyu ateşler; karşılıklı sıra birleşimi ile birleşir; üst-k=5 sahne.

7. **Temporal grounding.**Olay içindeki (başlangıç, son) pencereni düzeltmek için üst sahneye TimeLens tarzında adaptör çalıştırın.

8. **VLM synth.**Gemini 2.5 Pro'yu sorgu + üst 3 sahne klipi (resimler veya kısa klipleri olarak) + transkript ile arayın.`(video_id, start_ms, end_ms)`İpuçlar.

9. **Eval.**ActivityNet-QA ve NeXT-GQA çalıştırın. 100 sorgu özel bir set oluşturun. Toplam doğruluk + sınıf başına ayrıntı (sayım, eylem, açıklama) rapor edin.

## Kullan

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

## Gönder

`outputs/skill-video-qa.md`YouTube URL'si veya yüklenen videoları verildiğinde, boru hattı sahneleri indeksiyor ve zaman işaretli alıntılarla soruları yanıtlıyor.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Egzersizler

1. Başlık geçitinde Gemini 2.5 Pro'yu Qwen3-VL-Max'a değiştir.

2. Sahne başına çerçeve yerleştirmeyi çok vektör yerine bir toplam vektör olarak azaltın.

3. "Sıfır sayım" modunu oluşturun: sentesizer sayılan her örnekten bir zaman damgası ile çıkarır ve kullanıcı doğrulama için tıklar. Kullanıcı doğrulama halüsinasyonları azaltır mı ölçün.

4. Benchmark enfet maliyeti: 3 VLM seçeneği arasında saatlerce video dolar başına.

5. Konuşmacıya günlük yazılmış transkripti ekleyin: sesle pyannote konuşmacı günlüğünü çalıştırın ve konuşmacıya ait transkriptleri yerleştirin. "Alice X hakkında ne dedi?" sorularını gösterin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Daha Fazla Okumak

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) VLM kontrol noktaları açıldı
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) Zamanlı yerleşim ölçeğinde
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) ev sahipliği yapan referans
- [VideoDB](https://videodb.io) CRUD-for-video API referansı
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) Ticari referans
- [TransNetV2](https://github.com/soCzech/TransNetV2) Sahne segmentasyonu modeli
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) Klasik açık alternatif
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) Referans değerlendirme referans değerlendirme
