# Bitirme Taşı 04 — Çok Modlu Belge Kalite Güvencesi (İlk Vizyon PDF, Tablolar, Grafikler)

> 2026 belge-KG sınırı, OCR-sonra metinden uzaklaşarak önce vizyon-sonraki etkileşime doğru ilerledi. ColPali, ColQwen2.5 ve ColQwen3-omni, her PDF sayfasını bir görüntü olarak ele alır, bunu çok vektörlü geç etkileşimle gömer ve sorgunun yamalara doğrudan katılmasına izin verir. Finansal 10-K'larda, bilimsel makalelerde ve el yazısıyla yazılmış notlarda bu model, OCR'yi büyük bir farkla birincilikle geçiyor. 10.000 sayfada ardışık düzeni uçtan uca oluşturun ve OCR-ardından metinle yan yana yayınlayın.

**Tür:** Kapak taşı
**Diller:** Python (boru hattı), TypeScript (görüntüleyici kullanıcı arayüzü)
**Önkoşullar:** Aşama 4 (bilgisayarlı görme), Aşama 5 (NLP), Aşama 7 (transformers), Aşama 11 (LLM mühendisliği), Aşama 12 (çok modlu), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P4 · P5 · P7 · P11 · P12 · P17
**Süre:** 30 saat

## Sorun

Şirketler, OCR boru hatlarının karıştırdığı PDF'ler üzerinde oturuyor: döndürülmüş tablolarla taranmış 10-K'ler, denklemlerle dolu bilimsel makaleler, yalnızca görüntü olarak anlamlı olan grafikler, el yazısıyla yazılmış açıklamalar. Bunları önce metin olarak ele almak, sinyalin yarısını kaybetmek anlamına gelir. 2026'nın yanıtı, ham sayfa görüntülerinde geç etkileşimli çoklu vektör alımıdır. ColPali (Illuin Tech) bunu tanıttı; ColQwen2.5-v0.2 ve ColQwen3-omni doğruluğu artırdı. ViDoRe v3'te, önce vizyona erişim, OCR'nin ardından metnin üzerinde anlamlı farklarla puan alıyor ve grafiklerde, tablolarda ve el yazısında aradaki fark daha da açılıyor.

Takas, depolama ve gecikmedir. Bir ColQwen embedding, tek bir 1024-dim vektörü değil, sayfa başına ~2048 yama vektörüdür. Ham depolama balonları. DocPruner (2026), ölçülebilir doğruluk kaybı olmadan %50 budama sağlar. 10.000 sayfayı indeksleyecek, ViDoRe v3 nDCG@5'i ölçecek, yanıtları 2 saniyenin altında sunacak ve doğrudan OCR ve ardından metin temel çizgisiyle karşılaştıracaksınız.

## Konsept

Geç etkileşim, her token sorgusunun her token yamasına karşı puan alması ve sorgu başına maksimum puanın token toplanması anlamına gelir. Tek bir havuzlanmış vektöre ihtiyaç duymadan ince taneli eşleştirme elde edersiniz. Çok vektörlü bir dizin (Vespa, Qdrant çoklu vektör veya AstraDB), yama başına embedding'leri saklar ve alma zamanında MaxSim'i çalıştırır.

Yanıtlayıcı, sorguyu artı alınan en üstteki sayfaları görüntü olarak alan ve kanıt bölgeleriyle (sınırlayıcı kutular veya sayfa referansları) bir yanıt yazan bir vizyon dili modelidir. Qwen3-VL-30B, Gemini 2.5 Pro ve InternVL3, 2026 sınır seçenekleridir. Denklemler ve bilimsel gösterim için, isteğe bağlı bir metin kanalı olarak bir OCR geri dönüşü (Nougat, dots.ocr) eklenir.

Değerlendirme iki boyutlu bir matristir. Tek eksen: içerik türü (düz metin paragrafları, yoğun tablolar, çubuk/çizgi grafikler, el yazısı notlar, denklemler). Diğer eksen: erişim yaklaşımı (önce görme, geç etkileşim, OCR, ardından metin ve hibrit). Her hücre nDCG@5 alır ve doğruluğu yanıtlar. Rapor teslim edilebilir niteliktedir.

## Mimarlık

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## Yığın

- Sayfa oluşturma: 180 DPI'da PyMuPDF (fitz), portre normalleştirilmiş
- Geç etkileşim modeli: ColQwen2.5-v0.2 veya ColQwen3-omni (Hugging Face'teki video ekibi)
- Dizin: Çoklu vektör alanına sahip Vespa veya Qdrant çoklu vektör veya MaxSim'li AstraDB
- Budama: DocPruner 2026 politikası (yüksek varyanslı yamaları koruyun, < %0,5 doğruluk kaybıyla %50 sıkıştırma)
- OCR geri dönüşü (denklemler / yoğun tablolar): dots.ocr veya Nougat
- VLM yanıtlayıcı: Qwen3-VL-30B kendi kendine barındırılan veya Gemini 2.5 Pro barındırılan; Geri dönüş olarak InternVL3
- Değerlendirme: ViDoRe v3 benchmark, çok sayfalı akıl yürütme için M3DocVQA
- Görüntüleyici Kullanıcı Arayüzü: Kanıt bölgeleri için tuval kaplamasıyla Next.js 15

## Build It — Kendin Geliştir

1. **İçerme.** 10-K'lik 10.000 PDF sayfası, bilimsel makaleler ve taranmış belgelerden oluşan bir derlemeyi yürütün. Her sayfayı 1536x2048 PNG'ye dönüştürün. Devam et `{doc_id, page_num, image_path}`.

2. **Göm.** Her sayfa görüntüsünde ColQwen2.5-v0.2 komutunu çalıştırın. Çıkış şekli ~2048 yama embeddings of dim 128. En yüksek sinyal yarısını korumak için DocPruner'ı uygulayın. Vespa çoklu vektör alanına veya Qdrant çoklu vektöre yazın.

3. **Sorgu.** Gelen her sorgu için sorgu kulesini (token-seviye embeddings) ekleyin. MaxSim'i dizine karşı çalıştırın: her token sorgusu için, sayfa yaması üzerindeki maksimum nokta çarpımını embedding toplayın. İlk k sayfalarını döndür.

4. **Sentezleyin.** Sorgu ve ilk 5 sayfa görseliyle birlikte Qwen3-VL-30B'yi arayın. Prompt: "Yalnızca sağlanan sayfaları kullanarak cevap verin. Her iddiayı (doc_id, sayfa) ile belirtin ve bölgeyi adlandırın (şekil, tablo, paragraf)."

5. **Kanıt bölgeleri.** Alıntı yapılan bölgeleri çıkarmak için yanıtı sonradan işleyin. VLM sınırlayıcı kutular yayınlıyorsa (Qwen3-VL yapar), bunları görüntüleyicide kaplamalar olarak işleyin.

6. **OCR geri dönüşü.** Denklem yoğun olarak tanımlanan sayfalar için (görüntü varyansında sezgisel), Nougat veya dots.ocr çalıştırın ve OCR metnini görüntünün yanında ekstra bir kanal olarak iletin.

7. **Değerlendirme** ViDoRe v3'ü (nDCG@5 alma) ve M3DocVQA'yı (çok sayfalı QA doğruluğu) çalıştırın. Aynı sentezleyiciyle aynı derlem üzerinde OCR-sonra-metin ardışık düzenini de çalıştırın. İçerik türü × yaklaşım matrisi oluşturun.

8. **UI.** Önce basitleştirilmiş prototip; Next.js Sayfa sayfa kanıt bölgesi katmanı içeren 15 üretim görüntüleyici.

## Use It — Hazır Araçla Uygula

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Ship It — Kullanıma Sun

`outputs/skill-doc-qa.md` teslimatı açıklıyor: belirli bir derlem için ayarlanmış ve ViDoRe v3'teki OCR-ardından metin temeline göre değerlendirilen, vizyon odaklı, çok modlu bir belge QA sistemi.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA doğruluğu | Benchmark sayıların OCR metni temel çizgisi ve yayınlanan sıralama tablosuyla karşılaştırması |
| 20 | Kanıt bölgesinin temellendirilmesi | Cevap aralığını gerçekten içeren alıntı yapılan bölgelerin oranı |
| 20 | Depolama ve gecikme mühendisliği | DocPruner sıkıştırma oranı, dizin s.95, yanıt s.95 |
| 20 | Çok sayfalı akıl yürütme | Elle etiketlenmiş 100 soruluk çok sayfalı sette doğruluk |
| 15 | Kaynak denetimi UX | Görüntüleyici netliği, katman aslına uygunluğu, yan yana karşılaştırma araçları |
| **100** | | |

## Egzersizler

1. Aynı derlem üzerinde ColQwen2.5-v0.2 ve ColQwen3-omni'yi ölçün. Hangi sayfalardan biri doğru, diğeri kaçırıyor? Türe göre yönlendirmek için dizine bir "içerik sınıfı" etiketi ekleyin.

2. embedding'ları agresif bir şekilde budayın (%75, %90). Sıkıştırma uçurumunu bulun: ViDoRe nDCG@5'in OCR taban çizgisinin altına düştüğü nokta.

3. Bir karma oluşturun: OCR-then-text ve ColQwen'i paralel olarak çalıştırın, RRF ile birleştirin, bir çapraz kodlayıcıyla yeniden sıralayın. Hibrit ikisini de tek başına yenebilir mi? En çok nerede yardımcı olur?

4. Qwen3-VL-30B'yi daha küçük bir VLM (Qwen2.5-VL-7B) ile değiştirin. Dolar başına doğruluk eğrisini ölçün.

5. El yazısı notu desteği ekleyin. ColQwen'e yerleştirilmiş el yazısı külliyatını işleyin, geri almayı ölçün. El yazısı OCR işlem hattıyla karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Geç etkileşim | "ColPali tarzı erişim" | token'ın sayfa yamalarına karşı puanını bağımsız olarak sorgulayın; MaxSim kümeleri |
| Çoklu vektör | "Yama başına embedding" | Her belgede tek bir havuzlanmış vektör değil, çok sayıda vektör vardır |
| MaxSim | "Geç etkileşim puanlaması" | Her token sorgusu için belge vektörleri üzerinden maksimum benzerliği alın; toplam |
| BelgePruner | "Yama sıkıştırması" | İhmal edilebilir doğruluk kaybıyla yamaların %50'sini koruyan 2026 budama |
| ViDoRe v3 | "Belge alma benchmark" | Görsel belge alımını ölçmek için 2026 standardı |
| Kanıt bölgesi | "Atıf yapılan sınırlayıcı kutu" | Kaynak sayfada yanıt aralığını yerelleştiren bir bbox |
| OCR geri dönüşü | "Denklem kanalı" | Denklem veya tablo ağırlıklı sayfalar için görselliğin yanında kullanılan metin ardışık düzeni |

## Daha Fazla Okuma

- [ColPali (Illuin Tech) deposu](https://github.com/illuin-tech/colpali) — geç etkileşimli belge alımına referans
- [ColPali makalesi (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — temel yöntem makalesi
- [Sarılma Yüzündeki ColQwen ailesi](https://huggingface.co/vidore) — üretime hazır kontrol noktaları
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — çok sayfalı çok modlu RAG taban çizgisi
- [Vespa çoklu vektör eğitimi](https://docs.vespa.ai/en/colpali.html) — referans sunma yığını
- [Qdrant çoklu vektör desteği](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — alternatif dizin
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — alternatif yönetilen dizin
- [Nougat OCR](https://github.com/facebookresearch/nougat) — denklem özellikli OCR geri dönüşü
