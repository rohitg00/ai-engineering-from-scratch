# Capstone 04  Multimodal Belge QA (Vision-First PDF, Tablolar, Çarşılar)

> 2026 belgesi-QA sınırı OCR-den sonra metinden uzaklaşıp görme-başlangıçta geç etkileşime doğru ilerledi. ColPali, ColQwen2.5 ve ColQwen3-omni her PDF sayfasını bir görüntü olarak ele alır, multi-vektor geç etkileşimi ile gömür ve sorguyu doğrudan yamalara katır. Finansal 10K'larda, bilimsel makalelerde ve el yazılı notlarda bu model OCR'yi büyük bir farkla yener. 10 bin sayfada bir boru hattı bitir ve OCR-den sonra metin ile birbiriyle yayınla.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Sorun

Şirketler OCR boru hattlarının bozulduğu PDF'lere otururlar: 10K'lık taramalar döndürülen tablolarla, denklemlerle yoğun bilimsel makaleler, sadece görüntüler olarak mantıklı olan tablolar, el yazılı notlar. Bunlara ilk mesaj göndermek, sinyalin yarısını kaybetmek anlamına gelir. 2026'da cevap, çiğ sayfa görüntülerinde geç etkileşim çok vektörlü geri alımıdır. ColPali (Illuin Tech) onu tanıttı; ColQwen2.5-v0.2 ve ColQwen3-omni doğruluğu itti. ViDoRe v3'de, görme-birincil geri alım puanları anlamlı kenarlarla OCR-den sonra metin 'den üstündür ve tablolarda, tablolarda ve el yazısında boşluk genişler.

Bu işlemin karşılaştırması depolama ve gecikme. ColQwen gömülü bir sayfa başına ~2048 patch vektörü, tek bir 1024 boyutlu vektör değil. Çiğ depolama balonları. DocPruner (2026) ölçülebilir doğruluk kaybı olmadan %50 kesim getirir. 10k sayfaları indeksleyeceksiniz, ViDoRe v3 nDCG@5, 2 saniye altında cevaplar sunacaksınız ve doğrudan bir OCR-den sonra metin temel çizgisi ile karşılaştırırsınız.

## Anlam

Geç etkileşim, her sorgu jetonu'nun her patch jetonu ile puanlaması anlamına gelir ve her sorgu jetonu'nun maksimum puanı toplamlanır. Tek bir birleşik vektörün gereksiz olarak ince tohumlu eşleşme elde edersiniz. Bir çok vektör endeksi (Vespa, Qdrant multi-vector veya AstraDB) her patch yerleşimlerini saklar ve MaxSim'i kurtarma zamanında çalıştırır.

Cevaplayıcı, soruyu artı üst-k alınmış sayfaları görüntü olarak alan ve kanıt bölgeleri (bounding box veya sayfa referansları) ile bir cevap yazılan bir görsel dil modelidir. Qwen3-VL-30B, Gemini 2.5 Pro ve InternVL3 2026 sınır seçimidir.

Değerlendirme iki boyutlu bir matrisdir. Bir eks: içerik türü (seder metin paragrafları, yoğun tablolar, çubuğa/satır çizelgeleri, el yazılı notlar, denklemler). Diğer eks: geri alım yaklaşımı (görünme ilk geç etkileşim vs OCR-den sonra metin vs hibrid). Her hücre nDCG@5 ve cevap doğruluğu alır. Rapor teslim edilebilir.

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

## Yüküm

- Sayfa gösterimi: PyMuPDF (fitz) 180 DPI, portresi normalleştirilmiş
- Geç etkileşim modeli: ColQwen2.5-v0.2 veya ColQwen3-omni (Kömeş Yüzü'nde vidore ekibi)
- Endeks: Çok vektörlü alanlı Vespa veya çok vektörlü Qdrant veya MaxSim ile AstraDB
- Kesim: DocPruner 2026 politikası (yüksek varyasyonlu yamalar, %50'lik sıkıştırma, < 0,5%'lik doğruluk kaybı)
- OCR geri dönüşü (eşitlikler / yoğun tablolar): dots.ocr veya Nougat
- VLM cevaplayıcı: Qwen3-VL-30B kendi kendine barındırılmış veya Gemini 2.5 Pro barındırılmış; InternVL3 geri dönüş olarak
- Değerlendirme: ViDoRe v3 referans göstergesi, çok sayfalık mantık için M3DocVQA
- Görüntüleyici UI: Next.js 15 kanıt bölgelerinin kanvas üstlenmesi ile

```figure
ce-late-interaction
```

## Yapın

1. **Ingest.**10 bin PDF sayfasını 10 bin sayfa, bilimsel makale ve tarama belgelerle dolaşın. Her sayfayı 1536x2048 PNG'ye gönderin.`{doc_id, page_num, image_path}`- Evet .

2. **Embed.**Her sayfa görüntüsünde ColQwen2.5-v0.2 çalıştırın. Çıktı biçimi ~2048 parşömen gömüleri dim 128. En yüksek sinyal yarısını tutmak için DocPruner uygulayın. Vespa çok vektör alanına veya Qdrant çok vektörüne yazın.

3. **Query.**Her gelen sorgu için sorgu kulesine (token seviyesindeki yerleştirmeler) yerleştirin. MaxSim'i indeksle çalıştırın: her sorgu jetonu için, sayfa yama yerleştirmelerinin üzerinde maksimum nokta ürünü alın, toplam. Top-k sayfaları geri verin.

4. **Synthesize.**Sorgu ve en üst 5 sayfa resmini kullanarak Qwen3-VL-30B'yi arayın. İndir: "Sadece sağlanan sayfaları kullanarak cevap verin. Her iddiayı (doc_id, sayfa) ile belirtin ve bölgeyi (resim, tablo, paragraf) adlandırın".

5. **Evidence regions.**VLM sınırlama kutularını yayarsa (Qwen3-VL yapar), izleyiciye üst katılanlar olarak gösterin.

6. **OCR fallback.**Eklenti yoğunluğu (resim varyansında heuristik) olarak tanımlanan sayfalar için Nougat veya dots.ocr çalıştırın ve OCR metnini resmin yanında ekstra bir kanal olarak geçirin.

7. **Eval.**ViDoRe v3 (nDCG@5) ve M3DocVQA (çok sayfalık QA doğruluğu) çalıştırın. Aynı sentezörle aynı korpusta OCR-den sonra metin borusunu çalıştırın. İçerik tipi × yaklaşım matrisi üretin.

8. **UI.**İlk olarak Streamlit prototipi; Next.js 15 üretim izleyicisi sayfa sayfa kanıt bölgesi örtüsü ile.

## Kullan

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

## Gönder

`outputs/skill-doc-qa.md`teslim edilebilirliği tanımlar: belirli bir korpusla ayarlanmış ve ViDoRe v3 üzerinde OCR-den sonra metin bir temel çizgi ile değerlendirilmiş bir görme öncelikleri ile multimodal belge kalitesi sistemi.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## Egzersizler

1. ColQwen2.5-v0.2 vs ColQwen3-omni'yi aynı korpus üzerinde ölçün. Hangi sayfalar doğru ve diğerini kaçırır?

2. Sıkıştırma uçurumu bulun: ViDoRe nDCG@5'in OCR başlangıç hattının altında düştüğü nokta.

3. Bir hibrit oluşturun: OCR-den sonra-metin ve ColQwen paralel olarak çalıştırın, RRF ile birleşin, çapraz kodlayıcı ile yeniden sıralayın.

4. Daha küçük bir VLM (Qwen2.5-VL-7B) için Qwen3-VL-30B'yi değiştirin.

5. El yazılı not desteklerini ekleyin. El yazılı corpusunu ver, ColQwen ile gömülün, ölçüm geri alınması. El yazılı OCR borusuna karşı karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## Daha Fazla Okumak

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) referans geç etkileşim belgesi alımı
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) Temel yöntem kağıdı
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) Üretime hazır kontrol noktaları
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) Çok sayfalık multimodal RAG tabanı
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) Referans servis yığın
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) alternatif indeks
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) alternatif yönetilen indeks
- [Nougat OCR](https://github.com/facebookresearch/nougat) Eşitliklere sahip OCR geri dönüşü
