# ColPali ve Vision-Native Doküman RAG

> Geleneksel RAG PDF'leri metneye ayırır, parçalara ayırır, parçaları yerleştirir, vektörleri saklar. Her adım sinyal kaybeder: OCR tablo verilerini düşürür, parçalanma tablo satırlarını kırar, metin yerleştirmeleri rakamları görmezden gelir. ColPali (Faysse et al., Temmuz 2024) daha basit bir soru sordu: Neden metni çıkarmak? Sayfa resmini doğrudan PaliGemma üzerinden yerleştirin, arama için ColBERT tarzı geç etkileşimi kullanın ve belgenin taşıdığı tüm düzen, rakamlar, şifre ve biçimlendirme sinyalini koruyun. Yayınlanan referans değerleri: Görsel açıdan zengin belgelerdeki metin-RAG'den yüzde 20-40 daha iyi bir son-son doğruluk. ColQwen2, ColSmol ve VisRAG bu kalıpı genişletti. Bu ders, görme doğası RAG tezini okuyor ve küçük bir ColPali benzeri bir indeks oluşturur.

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- İki kodlayıcı çekim (her belgeye bir vektör) ve geç etkileşim çekim (her belgeye birçok vektör) arasındaki farkı açıklayın.
- ColBERT'in MaxSim işlevi ve ColPali'nin onu metin jetonlarından görüntü yamalarına nasıl genelleştirdiğini açıklayın.
- Küçük bir ColPali benzeri indeksi oluşturun: sayfa → patch yerleştirmeler → MaxSim sorgu terimi yerleştirmeler → top-k sayfalar.
- Faturayı / finansal raporları kullanma durumunda ColPali + Qwen2.5 VL jeneratörü vs. metin-RAG + GPT-4 ile karşılaştırın.

## Sorun

PDF'lerde metin-RAG, belgenin büyük kısmını atıyor. Mali raporun üçüncü çeyreklik gelir artışı genellikle bir tabloda bulunur; bir tıbbi raporun bulguları notlı görüntülerde bulunur; yasal sözleşmenin imza bloğu bir metin faktörü değil, bir düzen faktörüdür.

Metin-RAG boru hattı:

1. PDF → OCR / pdftotext yoluyla metin.
2. Metin → 300-500 token parçası.
3. Chunk → bi-encoder yerleştirme (bir vektör).
4. Kullanıcı sorusu → yerleştirme → cosine benzerliği → üst-k parçalar.
5. Çünks + sorgu → LLM.

Beş kayıp adım, grafiği yakalamamış, tablolar parçalara ayrılmış, sütun düzeni düzeni, resim notları kaybolmuş.

ColPali'nin düzeni: OCR'yi atlayın, sayfa resmini doğrudan yerleştirin. Arama sırasında model ince tanelerli yamalara bakabilmesi için ColBERT tarzı geç etkileşimi kullanın.

## Anlaşım

### Colbert (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) bir metin kurtarma yöntemi.

- Sorgulama simgelerinin kendi yerleşimleri vardır ($N_q$(vector)
- Belge tokenleri yerleştirilmiştir ($N_d$vectörler, genellikle önbelleğe alınmıştır).
- Skor = dosya tokenlerinin üstündeki maksimum sorgu tokenlerinin toplamı: $\sum_i \max_j \cos(q_i, d_j)$- Evet .

Bu MaxSim işlevi. Her sorgu simgesi en uygun belge simgesini "seçiyor". Son puan toplamdır.

Avantajlar: güçlü hatırlama, terim seviyesindeki semantikleri ele alır.$N_d$Doküman başına vektörler, depolama pahalı.

### KolPali

ColPali (Faysse et al., arXiv:2407.01449) ColBERT örneğini görüntülere uyguluyor.

- Her sayfa PaliGemma (ViT + dili) tarafından patch yerleştirmelerine kodlanır: $N_p$sayfa başına vektörler.
- Her kullanıcı sorgu (metin) sorgu-token gömülmelerinde kodlanır: $N_q$vektörler.
- Not = $\sum_i \max_j \cos(q_i, p_j)$Bu, MaxSim'in sorgu metni-token ve sayfa-resim-patch'leri üzerine.
- Top-k sayfaları toplam puanla alın.

Belgeyi yedikten sonra: her sayfayı PaliGemma ile yerleştirin, tüm patch yerleştirmelerini saklayın. Sorgu zamanı: sorgu simgelerini yerleştirin, MaxSim'i tüm kaydedilen sayfa yerleştirmelerine karşı hesaplayın, üst-k sayfaları geri gönderin.

Avantajlar: görsel açıdan zengin belgelerde son-sonun RAK metnini %20-40'a geçiyor. Her patch-vector yerel düzen ve içeriği yakalar.

Eksiler: $N_p$Çizgiçeler × 4 baytlı yüzenler × $D$-dim vektörleri sayfaya = depolama hızla büyüyor.

### ColQwen2 ve ColSmol

ColQwen2 (illuin-tech, 2024-2025) PaliGemma'yı Qwen2-VL'ye değiştirir. Daha iyi temel kodlayıcı, daha iyi geri alınma.

ColSmol, yerel / kenar kullanım için daha küçük ölçekli bir varyandır. ~ 1B parametreleri olan bir ColSmol retriever tüketici GPU'da çalışır.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) farklı bir variandır: MaxSim yerine, her sayfayı VLM ile tek bir vektöre birleştirin ve sonra iki kodlayıcıyı geri alın.

Kalite karşı maliyet karşılığı: Kalite için ColPali, ölçek için VisRAG.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) çok sayfalık çok belge akıl yürütmesine çok modal geri almayı genişletiyor.

### ViDoRe  referans değer

ColPali'nin eş göstergesi. Görsel Belge İzleme Değerlendirme. Görevler finansal raporlar, bilimsel makaleler, idari belgeler, tıbbi kayıtlar, el kitabları içerir.

ColPali-v1 ViDoRe'de %80 nDCG@5 puanı verir; aynı belgelerdeki metin-RAG %50-60 puanı verir.

### Sonundan sonuna kadar olan RAG boru hattı

Görme doğası olan bir RAG için:

1. İçecek: PDF → sayfa görüntüleri → PaliGemma kodlama → tüm yama gömülmeleri saklamak.
2. Sorgu: Kullanıcı metni → sorgu-token yerleştirmeleri → Tüm indekslenmiş sayfalara karşı MaxSim → üst-k sayfalar.
3. Yarat: üst-k sayfa görüntüleri + sorgu → VLM (Qwen2.5-VL veya Claude) → cevap.

Şekiller, tablolar, şifre, düzen tümü cevapta akıyor.

### Kaydetme matematikleri

Sayfa başına 729 patch ve 128 boyutlu yerleştirmeler ile 50 sayfalık bir finansal rapor:

- ColPali: 50 * 729 * 128 * 4 byte = ~18 MB çiğ, ~2.3 MB 8x PQ'dan sonra.
- Metin-RAG: 50 parça * 768-dim * 4 byte = ~ 150 kB.

ColPali, çiğ belge başına ~ 120 kat daha fazla depolama alanı sağlar. Ölçüsünde 8x OPQ / PQ genellikle tolere edilebilir olan ~ 15x'e düşürür.

### SMS-RAG hala kazanırken

- Çatlama sinyali olmayan saf metin belgeler (wiki makaleler, sohbet güncellemeleri).
- Milyonlarca sayfalık arşivler, depolama maliyetleri üzerinde baskın.
- Çıkarılabilir OCR metnini geri almakla birlikte talep eden sıkı düzenlemel gereksinimler.

2026'da her şey için  finansal raporlar, bilimsel makaleler, yasal sözleşmeler, tıbbi kayıtlar, UX belgeleri  vizyon doğası RAG kazanır.

```figure
mm-maxsim
```

## Kullan

`code/main.py`- ...

- Oyuncak yama kodlayıcı: bir "sayfa" (karakter vektörlerinin küçük bir şebekesi) bir dizi yama gömülmesine haritası yapar.
- MaxSim puanlayıcı: sorgu simgesi yerleştirme seti ile bir sayfa yama seti arasında ColBERT tarzı puanı hesaplar.
- 5 oyuncak sayfasını indeksiyor, 3 sorgu yapıyor, puanlarla en üst düzeyde.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-vision-rag-designer.md`. Bir belge-RAG projesini göz önüne alarak ColPali / ColQwen2 / VisRAG / text-RAG'i seçer ve depolama alanını boyutlandırır.

## Egzersizler

1. 200 sayfalık yıllık rapor, sayfaya 729 patch, 128 boyutlu emb, 4 baytlı yüzen.

2. MaxSim ' in adı $\sum_i \max_j \cos(q_i, p_j)$Bu toplamda basit bir benzerlik anlamı bulunmadığı neyi bulmuştur?

3. ColPali sayfaları birleştirme seti olarak indeksiyor.

4. 1M sayfalık bir corpus için son-son boru hattını, her sorgu için 500 ms gecikme bütçesi ile tasarlayın. ColQwen2 / VisRAG'i seçin ve haklı çıkarın.

5. M3DocRAG'ı okuyun (arXiv:2411.04952). Çok sayfalık dikkat kalıbını ve tek sayfalık ColPali geri alımından nasıl farklı olduğunu açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## Daha Fazla Okumak

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
