# Açık Ağırlıklı VLM Reçepleri: Aslında Önemli olan Ne?

> 2024-2026 açık ağırlıklı VLM literatürü, bir orman olarak kalır. Apple'ın MM1'i 13 görüntü kodlayıcı, bağlantı ve veri karışımı kombinasyonunu test etti. Allen AI'nin Molmo'su, detaylı insan başlıklarını GPT-4V destillasyonunu yendiğini kanıtladı. Cambrian-1 20+ kodlayıcı karşılaştırmasını yaptı. Idefics2 beş eksel tasarım alanını resmileştirdi. Prismatic VLM'ler kontrol edilen bir referans değerinde 27 eğitim tarifini karşılaştırdı. Tüm bu gürültüden, küçük bir dizi sonuç kağıt üzerinde geçerlidir: görüntü kodlayıcı bağlantı mimarisinden daha önemlidir, veri karışımı ikisinden de daha önemlidir ve ayrıntılı insan başlıkları destil edilmiş sentetik verileri yener. Bu ders bu tabloları okuyor, bu yüzden okumak zorunda değilsin.

**Type:** Learn + lab
**Languages:** Python, TypeScript (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Beş eksel VLM tasarım alanının adını verin: görüntü kodlayıcı, bağlayıcı, LLM, veri karışımı, çözünürlük programı.
- MM1 / Idefics2 / Cambrian-1 ablation tablosunu okuyun ve hangi düğmenin belirli bir referans değerini hareket ettirdiğini tahmin edin.
- Hesaplama bütçesi ve görev karışımı verildiğinde yeni bir VLM için bir tarif (kodlayıcı, bağlantı, veri, çözünürlük) seçin.
- İnsan başlıklarının neden GPT-4V destillasyonunu aynı simge sayısında yendiğini açıklayın.

## Sorun

Yüzlerce açık ağırlıklı VLM var. "iyi" ve "yağnalı" arasındaki boşlukların çoğu mimarlık değil. Veriler, çözünürlük programı ve kodlama seçeneği.

2023 dalgası (LLaVA-1.5, InstructBLIP, MiniGPT-4) başlık çift öncesi eğitim + LLaVA-Instruct-150k üzerinde çalıştı. İyi başlangıç çizgisi. MMMU'nun% 35 civarında zirve aldı.

2024 dalgası (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) son derece kapsamlı bir şekilde sonuçlandı.

## Anlaşım

### Beş eksel tasarım alanı

Idefics2 (Laurençon et al., 2024) ekselerin adını verdi:

1. Görüntü kodlayıcı. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Kodlayıcılar yama boyutu, çözünürlük ve eğitim öncesi hedefleri ile farklıdır.
2. Bağlantı: MLP (2-4 katman), Q-Former (32 sorgu + çapraz atn), Perceiver Resampler (64 sorgu), C-Abstraktor (konvolyüsyonal + bilineer birleştirme).
3. Dil modeli. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5. LLM boyutu baskın param maliyetidir.
4. Eğitim verileri: Başlık çiftleri (CC3M, LAION), birbirine karışık (OBELICS, MMC4), talimat (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Çözüm programı, sabit 224/336/448, AnyRes, yerli dinamik, eğitim sırasında veya sabit.

Her üretim VLM'si her eksede bir seçim yapar. MMMU puanlarının çoğu farkı hangi bağlayıcıyı seçtiğiniz değil 1, 4 ve 5  ekselerle açıklanır.

### Axis 1: kodlayıcı > bağlantı

MM1 Bölüm 3.2 gösterdi: CLIP ViT-L/14'den SigLIP SO400m/14'e değişmek 3+ MMMU puanı ekledi. MLP'den İhtiyaçlı Kaynaklayıcı Yeniden Örnekleyici'ye bağlantı değiştirmek 1 puandan az ekledi. Idefics2 aynı token sayısında tekrarlandı: SigLIP > CLIP, Q-Former ≈ MLP ≈ İhtiyaçlı Kaynaklayıcı.

Cambrian-1'in "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) 20+ kodlayıcıyı görme merkezli bir referans (CV-Bench) üzerinde çalıştı. Lider tablosunun en üst kısmı DINOv2 ve SigLIP'in bir karışımıdır; CLIP paketin ortasındadır; ImageBind ve ViT-MAE daha düşüktür. CLIP ViT-L'den DINOv2 ViT-g/14'e arasındaki fark CV-Bench'de ~ 5-7 puandır.

Açık VLM'ler için 2026'da varsayılan kodlayıcı, semantik + yoğun özellikler için SigLIP 2 SO400m/14'dir, bazen DINOv2 ViT-g/14 özellikleriyle bağlanır (Cambrian'ın "Spatial Vision Aggregator" bunu yapar).

### Axis 2: Bağlantı tasarımı bir yıkama

MM1, Idefics2, Prismatic ve MM-Interleaved hepsi aynı sonuca vardı: sabit bir görsel-token sayısında, bağlayıcı mimarisi neredeyse önemli değildir. Ortalama birleştirilmiş yamalardaki iki katlı MLP, aynı token bütçesinde 32 sorgu Q-Former'ın 1 puan içinde çalışır.

Önemli olan, simgelerin sayısıdır. Daha fazla görsel simgeler = daha fazla LLM hesaplama = bir noktaya kadar daha iyi performans, sonra da azalır. Resim başına 64 simgeler OCR için çok azdır. 576-1024 simgeler çoğu açık VLM için tatlı noktadır. 2048+ yalnızca belgelere ve grafiklere yardımcı olur.

Q-Former vs. MLP, bir kalite sorusu değil, bir maliyet sorusu: Q-Former, görüntü çözünürlüğüne bakılmaksızın jetonları 32-64'e kapatır; MLP tüm patch jetonlarını yayar. Yüksek çözünürlüklü girişler için, Q-Former LLM bağlamını korur; düşük çözünürlükler için, fark gürültüdür.

### Axis 3: LLM boyutu tavanı belirler

LLM'yi 7B'den 13B'ye iki katlamak, her VLM kağıdı boyunca MMMU'da güvenilir bir şekilde 2-4 puan ekler. 70B'de çoğu referans değerini doymuş olursunuz. VLM'nin multimodal akıl yürütme tavanı LLM'nin metin akıl yürütme tavanıdır.

Bu nedenle Qwen2.5VL-72B ve Claude Opus 4.7 MMMU-Pro ve ScreenSpot-Pro'yu ezdi: dil beyni büyüktür. 7B VLM akıllı bağlantı tasarımıyla 70B VLM'yi değiştiremez.

### Axis 4: veriler  ayrıntılı insan başlıkları destillasyonu yendi

Molmo + PixMo (Deitke et al., 2024) herkesin okuması gereken 2024 sonucu. Allen AI'nin insan notatörleri, görüntüleri 1-3 dakikalık yoğun konuşma metin geçişlerinde tanımladı ve 712K yoğun başlıklı görüntüler verdi. Eğitim verilerinde hiçbir yerde GPT-4V destilasyonu yoktu.

Molmo-72B, 11 değerden 11'ünde Llama-3.2-90B-Vision'ı yendi. Delta mimarlık değil  başlık kalitesi. Detaylı insan başlıkları kısa web başlıklarından 5-10 kat daha fazla bilgi içerir ve GPT-4V destillasyon halüsinasyonları olan gerçekleri yerleştirir.

ShareGPT4V (Chen et al., 2023) ve Cauldron (Idefics2) aynı oyun kitabı ile karışık insan + GPT-4V başlıkları ile takip etti.

### Axis 5: çözümü ve programı

Idefics2'in ablations: 384 -> 448 1-2 puan ekler. 448 -> 980 görüntü bölüşümü (AnyRes) ile OCR referans değerlerinde 3-5 daha ekler. Orta doğrulukta düz çözünürlüklü eğitim platoları; çözünürlük ramping (başlamak 224, bitirmek 448 veya yerli) trenleri daha hızlı ve daha yüksek sonuçlar.

Cambrian-1 çözünürlük karşı tokenler arasında bir ticaret gerçekleştirdi: sabit hesaplamalarda daha düşük çözünürlükte daha fazla token veya daha yüksek çözünürlükte daha az token olabilir.

2026 üretim tarifi: OCR ağır görevler için 1. aşama 384 sabit, 2. aşama 1280'e kadar dinamik çözünürlükle tren.

### Prismatic kontrol edilen karşılaştırma

Prismatic VLMs (Karamcheti et al., 2024) tüm ekseleri kontrol eden makaledir. Aynı 13B LLM, aynı talimat verileri, aynı değerlendirme  bir seferde sadece bir eksel değişir. Sonuçlar:

- Görüntü başına görsel-token sayısı, ~60%'lık değişikliği açıklar.
- Kodlayıcı seçimi %20'i açıklıyor.
- Bağlantı mimarisi %5'i açıklıyor.
- Diğer her şey (veriler karışımı, programlayıcı, LR) kalan %15'i.

Bu kaba bir parçalanma, ama edebiyatta "neyi öncelikle temizlemem gerekiyor" diye sorulan en temiz cevap.

### 2026 için bir seçiciler

Kanıtlara göre, 2026'da yeni bir proje için standart açık VLM tarifi:

- Kodlayıcı: NaFlex ile siglip 2 SO400m/14 yerel çözünürlükte, segmentasyon/yerleşme ihtiyacınız varsa yoğun özellikler için DINOv2 ViT-g/14 ile bağlanmıştır.
- Bağlantı: 2 katlı MLP, tokenler üzerinde.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, maliyet için 7B, kalitesi için 70B, hedef gecikme ile seçilir.
- Veriler: PixMo + ShareGPT4V + Kağız, görev-özel talimat verileri ile tamamlanmıştır.
- Çözüm: dinamik (bölüm başına 256, maksimum 1280 piksel).
- Program: 1. aşama (sadece projektor için), 2. aşama tam ince ayarlama, 3. aşama görev-sözlü ince ayarlama.

Bu standartların her biri bu ders sonunda alıntılanan makalelerde ölçülen bir ablation'a kadar uzanır.

```figure
l5-vlm-recipe-knobs
```

## Kullan

`code/main.py`MM1 ve Idefics2 ablation tablolarını kodlar ve sorguya izin verir:

- "Büjet X ve görev Y'yi göz önüne alırsak, hangi tarif kazanır?"
- "7B Llama'da SigLIP'i CLIP'e değiştirirsem, beklenen MMMU delta ne olacak?"
- "% 80 güvenli bir cevap için önce hangi ekseni kapatmalıyım?"

Çıkış, beklenen referans değerleri ve "ablate first" tavsiyesi ile sıralanmış bir tarif listesidir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-vlm-recipe-picker.md`. Hedef görev karışımı, hesaplama bütçesi ve gecikme hedefi göz önüne alındığında, her seçimi haklı çıkaran ablasyonu alıntılayan bir tüm reçete (kodlayıcı, bağlayıcı, LLM, veri karışımı, çözünürlük programı) yayınlar. Mühendislerin yeni bir VLM projesi başladığında Idefics2 ablasyon tablosunu yeniden icat etmesini engeller.

## Egzersizler

1. MM1 Bölüm 3.2. 50 milyon görüntü bütçesi ile sabit bir 2B LLM için hangi kodlayıcı kazanır?

2. Cambrian-1, DINOv2 + SigLIP'i birleştirmenin görme odaklı referans değerlerinde tek başına üstün olduğunu, ancak MMMU'da herhangi bir sinyal eklemediğini buldu.

3. Hedefiniz 2B LLM'de mobil bir UI ajanı. Kodlayıcı, bağlantı, çözünürlük ve veri karışımı seçin. Her seçeneği belirli bir ablation tablosu ile haklı çıkarın.

4. Molmo 4B ve 72B modellerini üretir. 4B kapalı 7B VLM ile rekabetçi; 72B 11/11 referans değerlerinde Llama-3.2-90B-Vision'ı yenir.

5. 7B VLM'deki veri karışımı kalitesini kodlayıcı kalitesinden ayırmak için bir ablation tablosu tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Daha Fazla Okumak

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
