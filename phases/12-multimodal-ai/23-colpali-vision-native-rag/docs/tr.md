# ColPali ve Vision-Native Belgesi RAG

> Geleneksel RAG, PDF'leri metne ayrıştırır, parçalara ayırır, parçaları gömer, vektörleri saklar. Her adımda sinyal kaybedilir: OCR grafik verilerini düşürür, parçalama tablo satırlarını kırar, metin embedding rakamları göz ardı eder. ColPali (Faysse ve diğerleri, Temmuz 2024) daha basit bir soruyu sordu: Neden metin çıkarılsın ki? Sayfa görüntüsünü doğrudan PaliGemma aracılığıyla gömün, erişim için ColBERT tarzı geç etkileşimi kullanın ve belgenin taşıdığı tüm düzeni, şekilleri, yazı tiplerini ve biçimlendirme sinyallerini koruyun. Yayınlanan benchmark'ler: Görsel açıdan zengin belgelerde text-RAG'a göre %20-40 daha iyi uçtan uca doğruluk. ColQwen2, ColSmol ve VisRAG modeli genişletti. Bu derste vizyona özgü RAG tezi okunur ve ColPali benzeri küçük bir dizin oluşturucu oluşturulur.

**Tür:** Yapım
**Diller:** Python (stdlib, çoklu vektör indeksleyici + MaxSim puanlayıcı)
**Önkoşullar:** Aşama 11 (LLM Mühendislik - RAG temelleri), Aşama 12 · 05 (LLaVA)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- İki kodlayıcılı erişim (belge başına bir vektör) ile geç etkileşimli erişim (belge başına birçok vektör) arasındaki farkı açıklayın.
- ColBERT'in MaxSim işlemini ve ColPali'nin bunu metin token'lardan görüntü yamalarına nasıl genelleştirdiğini açıklayın.
- ColPali benzeri küçük bir dizin oluşturucu oluşturun: sayfa → embeddings'yi yamalayın → MaxSim'i sorgu terimi embeddings'ye → en iyi k sayfalara ekleyin.
- Faturalar/finansal raporlar kullanım örneğinde ColPali + Qwen2.5-VL oluşturucu ile text-RAG + GPT-4'ü karşılaştırın.

## Sorun

PDF'lerdeki Text-RAG belgenin çoğunu atar. Bir mali raporun 3. çeyrek gelir artışı genellikle bir grafikte gösterilir; bir tıbbi raporun bulguları açıklamalı görsellerde yer almaktadır; yasal bir sözleşmenin imza bloğu bir metin olgusu değil, bir düzen olgusudur.

Metin-RAG boru hattı:

1. PDF → OCR / pdftotext yoluyla metin.
2. Metin → 300-500 token parça.
3. Parça → çift kodlayıcı embedding (bir vektör).
4. Kullanıcı sorgusu → embedding → kosinüs benzerliği → en iyi k parçaları.
5. Parçalar + sorgu → Yüksek Lisans.

Beş kayıplı adım. Grafikler yakalanmadı. Tablolar parçalar halinde kırılmış. Çok sütunlu düzen düzleşir. Şekil açıklamaları kaybolur.

ColPali'nin düzeltmesi: OCR'yi atlayın, sayfa resmini doğrudan gömün. Modelin sorgu zamanında ince taneli yamalara katılabilmesi için alma için ColBERT tarzı geç etkileşimi kullanın.

## Konsept

### ColBERT (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) bir metin alma yöntemidir. Belge başına bir vektör yerine, token başına bir vektör üretir. Sorgu zamanında:

- Sorgu token'lar kendi embedding'lerini (N_q vektörleri) alır.
- Belge token'ler embedding'ları alır (N_d vektörler, genellikle önbelleğe alınır).
- Puan = kosinüs benzerliğinin sorgu üzerinden maksimum tokens belge üzerinden tokens toplamı: Σ_i max_j cos(q_i, d_j).

Bu MaxSim operasyonudur. Her sorgu token, en iyi eşleşen belgeyi token "seçer". Nihai puan toplamdır.

Artıları: güçlü hatırlama, terim düzeyinde anlambilimi yönetir. Eksileri: Belge başına N_d vektör, depolama pahalıdır.

### ColPali

ColPali (Faysse ve diğerleri, arXiv:2407.01449), ColBERT modelini görüntülere uygular.

- Her sayfa PaliGemma (ViT + dil) tarafından yama embeddings: sayfa başına N_p vektörleri halinde kodlanır.
- Her kullanıcı sorgusu (metin), query-token embeddings: N_q vektörlerine kodlanır.
- Puan = Σ_i max_j cos(q_i, p_j), i.e., query-text-token'ler ve sayfa görüntüsü yamaları üzerinden MaxSim.
- Toplam puana göre en iyi k sayfaları alın.

Belge alımı sırasında: her sayfayı PaliGemma'ya yerleştirin, tüm yamaları embedding saklayın. Sorgu zamanında: token sorgusunu gömün, MaxSim'i depolanan tüm embedding sayfalarına göre hesaplayın, en üstteki k sayfaları döndürün.

Artıları: uçtan uca, görsel olarak zengin belgelerde text-RAG'ı %20-40 oranında yener. Her yama vektörü yerel düzeni ve içeriği yakalar.

Eksileri: N_p yamaları × 4 baytlık kayan noktalar × sayfa başına D-dim vektörleri = depolama alanı hızla büyüyor. PQ / OPQ nicemlemesi ile azaltılmıştır.

### ColQwen2 ve ColSmol

ColQwen2 (illuin-tech, 2024-2025), PaliGemma'yı Qwen2-VL ile değiştirdi. Daha iyi temel kodlayıcı, daha iyi erişim.

ColSmol, yerel/uç kullanım için daha küçük ölçekli bir varyanttır. ~1B parametrelerindeki bir ColSmol alıcısı tüketici GPU'sunda çalışır.

### VisRAG

VisRAG (Yu ve diğerleri, arXiv:2410.10594) farklı bir varyanttır: yamalardaki MaxSim yerine, her sayfayı bir VLM ile tek bir vektörde havuzlayın ve ardından iki kodlayıcıyla alın. Daha hızlı indeksleme + daha küçük depolama, daha zayıf hatırlama.

Kalite ve maliyet dengesi: Kalite için ColPali, ölçek için VisRAG.

### M3DocRAG

M3DocRAG (Cho ve diğerleri, arXiv:2411.04952), çok modlu erişimi çok sayfalı çok belgeli akıl yürütmeye kadar genişletir. Belgelerdeki sayfaları alır, VLM için çok sayfalı bir bağlam oluşturur.

### ViDoRe — benchmark

ColPali'nin arkadaşı benchmark. Görsel Belge Alma Değerlendirmesi. Görevler arasında mali raporlar, bilimsel makaleler, idari belgeler, tıbbi kayıtlar ve kılavuzlar yer alır. Metrik: nDCG@5.

ColPali-v1, ViDoRe'de ~%80 nDCG@5 puanı aldı; Aynı belgelerdeki text-RAG'nin puanı ~%50-60'tır.

### Uçtan uca RAG hattı

Vizyon yerlisi bir RAG için:

1. Alma: PDF → sayfa görüntüleri → PaliGemma kodlaması → tüm yama embedding'ları depolayın.
2. Sorgu: kullanıcı metni → sorgu-token embeddings → dizine eklenen tüm sayfalara karşı MaxSim → en üstteki sayfalar.
3. Oluşturun: en üstteki sayfa görselleri + sorgu → VLM (Qwen2.5-VL veya Claude) → yanıt.

Hiçbir yerde OCR yok. Şekiller, çizelgeler, yazı tipleri, düzen, hepsi cevaba akıyor.

### Depolama matematiği

Sayfa başına 729 yama ve 128 sönük embeddings içeren 50 sayfalık bir mali rapor:

- ColPali: 50 * 729 * 128 * 4 bayt = ~18 MB ham, ~4 MB PQ'dan sonra.
- Text-RAG: 50 parça * 768-dim * 4 bayt = ~150 kB.

ColPali belge başına ~30 kat daha fazla depolama alanı sağlar. OPQ / PQ, ölçekte bunu genellikle tolere edilebilir olan ~5-10x'e düşürür.

### Text-RAG hala kazandığında

- Düzen sinyali olmayan saf metinli belgeler (wiki makaleleri, sohbet günlükleri). Text-RAG daha basittir ve depolama açısından daha ucuzdur.
- Depolamanın maliyete ağır bastığı milyonlarca sayfalık arşivler.
- Geri almanın yanı sıra çıkarılabilir OCR metni talep eden katı düzenleyici gereksinimler.

2026'daki diğer her şeyde (finansal raporlar, bilimsel makaleler, yasal sözleşmeler, tıbbi kayıtlar, UX belgeleri) vizyona özgü RAG kazanır.

## Kullan onu

`code/main.py`:

- Oyuncak yama kodlayıcı: bir "sayfayı" (özellik vektörlerinin küçük ızgarası) bir dizi yama embedding ile eşler.
- MaxSim puanlayıcı: bir sorgu token embedding kümesi ile bir sayfa yaması kümesi arasındaki ColBERT tarzı puanı hesaplar.
- 5 oyuncak sayfasını indeksler, 3 sorgu çalıştırır, puanlarla birlikte en üstteki k'yi döndürür.

## Gönderin

Bu ders `outputs/skill-vision-rag-designer.md` üretir. Bir document-RAG projesi verildiğinde ColPali / ColQwen2 / VisRAG / text-RAG'ı seçer ve depolamayı boyutlandırır.

## Egzersizler

1. Sayfa başına 729 yama, 128 sönük yerleştirme, 4 bayt kayan nokta içeren 200 sayfalık yıllık rapor. Ham depolamayı ve PQ sıkıştırılmış (8x) depolamayı hesaplayın.

2. MaxSim, Σ_i max_j cos(q_i, p_j)'dir. Bu toplam, basit ortalama benzerliğinin sağlayamadığı neyi ifade ediyor?

3. ColPali sayfaları yama setleri olarak indeksler. Bunun yerine kelime düzeyinde indekslersek (ColBERT'in yaptığı gibi) ne değişir? Takaslar mı?

4. Sorgu başına 500 ms gecikme bütçesine sahip 1 milyon sayfalık bir derleme için uçtan uca işlem hattını tasarlayın. ColQwen2 / VisRAG'ı seçin ve gerekçelendirin.

5. M3DocRAG'ı (arXiv:2411.04952) okuyun. Çok sayfalı dikkat modelini ve bunun tek sayfalık ColPali erişiminden nasıl farklı olduğunu açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Geç etkileşim | "ColBERT tarzı" | Tek bir belge vektörü değil, her-token veya yama başına embeddings + MaxSim kullanılarak alma |
| MaxSim | "Maksimum yamalar" | Her token sorgusu için, en yüksek benzerliğe sahip belgeyi token seçin; sorgu genelinde toplam |
| Çift kodlayıcı | "Tek vektör" | Belge başına bir vektör; daha hızlıdır ancak ayrıntı düzeyini kaybeder |
| Çoklu vektör | "Belge başına birçok vektör" | Belge / sayfa başına N_p vektörlerini saklayın; depolama maliyeti artıyor ancak geri çağırma artıyor |
| Yama embedding | "Sayfa özelliği" | VLM kodlayıcıdan görüntü yaması başına bir vektör, sayfa başına önbelleğe alınır |
| ViDoRe | "Vizyon belge tezgahı" | Görsel belge alımı için ColPali'nin benchmark paketi |
| PQ nicemleme | "Ürün nicelemesi" | Depolamayı daraltırken vektör benzerliğini koruyan sıkıştırma ~8x |

## Daha Fazla Okuma

- [Faysse ve ark. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab ve Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu ve ark. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho ve ark. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
