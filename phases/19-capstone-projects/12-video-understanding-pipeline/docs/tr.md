# Bitirme Taşı 12 — Ardışık Düzeni Anlama Videosu (Sahne, Kalite Güvencesi, Arama)

> Twelve Labs, Marengo + Pegasus'u üretti. VideoDB, video için CRUD API'sini gönderdi. AI2'nin Molmo 2'si açık VLM kontrol noktalarını yayınladı. Gemini uzun bağlamı saatlerce videoyu yerel olarak işler. TimeLens-100K, belirli ölçekte zamansal topraklamayı tanımladı. 2026 hattı belirlendi: sahne segmentasyonu, sahne başına başlık + embedding, transkript hizalaması, çoklu vektör dizini ve (başlangıç, bitiş) zaman damgaları artı çerçeve önizlemeleriyle yanıt veren bir sorgu. Bitirme taşı 100 saat tüketiyor, halka açık benchmark'lara çarpıyor ve sayma ve eylem sorularında halüsinasyonu ölçüyor.

**Tür:** Kapak taşı
**Diller:** Python (boru hattı), TypeScript (UI)
**Önkoşullar:** Aşama 4 (CV), Aşama 6 (konuşma), Aşama 7 (transformers), Aşama 11 (LLM mühendisliği), Aşama 12 (multimodal), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P4 · P6 · P7 · P11 · P12 · P17
**Süre:** 30 saat

## Sorun

Uzun biçimli video QA, 2026 ölçeğinde bant genişliğine en fazla ihtiyaç duyan çok modlu sorundur. Gemini 2.5 Pro, 2 saatlik bir videoyu yerel olarak okuyabilir, ancak 100 saatlik videoyu sorgulanabilir bir derlemin içine almak yine de sahne düzeyinde bir dizin gerektirir. Prodüksiyon şekli, sahne segmentasyonunu (TransNetV2 veya PySceneDetect), bir VLM ile sahne başına altyazı eklemeyi (Gemini 2.5, Qwen3-VL-Max veya Molmo 2), transkript hizalamayı (kelime zaman damgalarıyla Whisper-v3-turbo) ve altyazıyı, çerçeveyi embedding ve transkripti yan yana saklayan bir çoklu vektör dizini birleştirir. Sorgu ardışık düzeni (başlangıç, bitiş) zaman damgalarına ve çerçeve önizlemelerine yanıt verir.

Benchmark'ler herkese açıktır (ActivityNet-QA, NeXT-GQA) artı kendi 100 sorguluk özel kümenizdir. Sayma ve eylem türü sorulardaki halüsinasyon, bilinen zor başarısızlık sınıfıdır; kapak taşı bunu açıkça ölçer.

## Konsept

Üç ardışık düzen, alım sırasında paralel olarak çalışır. **Sahne bölümlendirme** videoyu sahnelere böler. **VLM altyazısı**, sahne başına bir altyazı ve bir ana kareden bir kare embedding oluşturur. **ASR hizalaması** kelime düzeyinde zaman damgaları üretir. Üç akış (scene_id, time range) ile birleştirilir. Her sahne, çoklu vektör dizininde (Qdrant) üç vektör türü alır: başlık embedding, ana kare embedding, transkript embedding.

Sorgu zamanında, doğal dil sorusu her üç vektöre de ateşlenir; sonuçlar RRF ile birleştirilir; zamansal topraklama adaptörü (TimeLens tarzı), üst sahnedeki (başlangıç, bitiş) penceresini iyileştirir. VLM sentezleyici (Gemini 2.5 Pro veya Qwen3-VL-Max), sorgu + en iyi sahneler + kırpılmış kareleri alır ve belirtilen zaman damgaları ve bir kare önizlemesiyle yanıtları alır.

Halüsinasyon ölçümü önemlidir. Sayma ("odaya kaç kişi giriyor?") ve aksiyon türü ("şef karıştırmadan önce döküyor mu?") soruları herkesin bildiği gibi güvenilmezdir. Doğruluğu açıklayıcı sorulardan ayrı olarak bildirin.

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

## Yığın

- Sahne segmentasyonu: TransNetV2 (son teknoloji 2024-26) veya PySceneDetect
- ASR: Kelime zaman damgalarıyla daha hızlı fısıltı aracılığıyla Whisper-v3-turbo
- VLM altyazı oluşturucu + yanıtlayıcı: Gemini 2.5 Pro veya Qwen3-VL-Max veya Molmo 2
- Geçici topraklama: TimeLens-100K ile eğitilmiş adaptör veya VideoITG
- Dizin: Çoklu vektör desteğine sahip Qdrant (altyazı / çerçeve / transkript)
- Kullanıcı arayüzü: Next.js 15, HTML5 video oynatıcı ve sahne küçük resimleriyle
- Eval: ActivityNet-QA, NeXT-GQA, özel 100 soruluk elle etiketlenmiş set
- Halüsinasyon benchmark: el etiketleriyle birlikte sayma ve eylem türü alt kümeleri

## Build It — Kendin Geliştir

1. **Walker'ı kullanın.** YouTube URL'lerini veya yerel MP4'leri kabul edin. Gerekirse 720p'ye küçültün. Devam et `{video_id, file_path}`.

2. **Sahne bölümlendirme.** `[{scene_id, start_ms, end_ms, keyframe_path}]`'yi oluşturmak için TransNetV2 veya PySceneDetect'i çalıştırın. Hedef 100 saat: ~6k-8k sahne.

3. **ASR geçişi.** Seste Whisper-v3-turbo'yu çalıştırın; kelime düzeyinde zaman damgalarını dışa aktarın; sahne başına transkript dilimlerine bölünür.

4. **VLM altyazısı.** Sahne başına, ana kare ve kısa bir altyazı şablonuyla Gemini 2.5 Pro'yu (veya Qwen3-VL-Max) arayın. Başlık + çerçeve embedding üret.

5. **Çoklu vektör dizini.** Üç adlandırılmış vektör içeren Qdrant koleksiyonu. Yük: `{video_id, scene_id, start_ms, end_ms, keyframe_url}`.

6. **Sorgu.** Doğal dil sorusu üç yoğun sorguyu tetikler; karşılıklı derece füzyonu ile birleştirme; top-k=5 sahne.

7. **Geçici topraklama.** Sahne içindeki (başlangıç, bitiş) penceresini iyileştirmek için TimeLens stili adaptörünü üst sahnede çalıştırın.

8. **VLM sentezi** Sorgu + en iyi 3 sahne klibi (görüntü veya kısa klip olarak) + transkriptlerle Gemini 2.5 Pro'yu arayın. `(video_id, start_ms, end_ms)` alıntı gerektir.

9. **Eval.** ActivityNet-QA ve NeXT-GQA'yı çalıştırın. 100 sorguluk özel bir küme oluşturun. Genel doğruluğu + sınıf bazında dökümü (sayma, eylem, açıklayıcı) bildirin.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-video-qa.md` teslim edilebilirdir. Bir YouTube URL'si veya yüklenen bir video verildiğinde, işlem hattı sahneleri dizine ekler ve soruları zaman damgalı alıntılarla yanıtlar.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Geçici topraklama IoU | Uzatılmış topraklama setinde kesişme-birleşimi |
| 20 | Kalite Güvencesi doğruluğu | NeXT-GQA ve özel 100 sorgu |
| 20 | Alma aktarım hızı | Harcanan dolar başına video saati |
| 20 | Kullanıcı Arayüzü ve Alıntı UX | Zaman damgası bağlantıları, küçük resim şeridi, çerçeveye atlama |
| 15 | Halüsinasyon oranı | Sayma ve eylem tipi doğruluğu ayrı ayrı |
| **100** | | |

## Egzersizler

1. Altyazı geçişinde Gemini 2.5 Pro'yu Qwen3-VL-Max ile değiştirin. İnsanların derecelendirdiği 50 sahnelik bir örnekte altyazı kalitesi deltasını bildirin.

2. Sahne başına kareyi embedding çoklu vektör yerine havuzlanmış bir vektöre düşürün. Geri alma regresyonunu ölçün.

3. Bir "sayma katı" modu oluşturun: sentezleyici, sayılan her örneği bir zaman damgasıyla çıkarır ve kullanıcı doğrulamak için tıklar. Kullanıcı doğrulamanın halüsinasyonu azaltıp azaltmadığını ölçün.

4. Benchmark alım maliyeti: üç VLM seçeneğinde dolar başına video saati. En tatlı noktayı seçin.

5. Konuşmacı günlüğüne yazılan transkript ekleyin: ses üzerinde pyannote konuşmacı günlüğü oluşturmayı çalıştırın ve her konuşmacı için transkriptleri ekleyin. "Alice X hakkında ne söyledi?" sorgular.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Sahne segmentasyonu | "Atış algılama" | Videoyu çekim sınırlarında sahnelere ayırma |
| Çoklu vektör indeksi | "Altyazı + çerçeve + transkript" | Gösterim başına adlandırılmış vektörlerle Qdrant koleksiyonu |
| Geçici topraklama | "Bu tam olarak ne zaman oldu" | Sorgu yanıtı için (başlangıç, bitiş) penceresini hassaslaştırma |
| Çerçeve embedding | "Görsel temsil" | Bir ana karenin bir vektörü embedding; sahne-görsel benzerlik için kullanılır |
| RRF füzyonu | "Karşılıklı sıralama füzyonu" | Birden çok sıralı listede stratejiyi birleştirin; klasik bir melez geri alma numarası |
| Halüsinasyon sayma | "Yanlış hesap" | "Kaç X" sorusuyla ilgili VLM'lerin bilinen hata modu |
| ActivityNet-QA | "Video-KG benchmark" | Uzun biçimli video QA doğruluğu benchmark |

## Daha Fazla Okuma

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — VLM kontrol noktalarını aç
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — ölçekte zamansal topraklama
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) — barındırılan referans
- [VideoDB](https://videodb.io) — Video için CRUD API referansı
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — ticari referans
- [TransNetV2](https://github.com/soCzech/TransNetV2) — sahne bölümleme modeli
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — klasik açık alternatif
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — referans değerlendirmesi benchmark
