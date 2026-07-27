# Herhangi Bir Çözünürlük Vizyonu: Patch-n'-Pack ve NaFlex

> Gerçek görüntüler 224x224 kare değildir. Makbuz 9:16, grafik 16:9, tıbbi tarama 4096x4096, mobil ekran görüntüsü 9:19.5 olabilir. 2024 öncesi VLM yanıtı (her şeyi sabit bir kareye yeniden boyutlandırmak), OCR, belge anlama ve yüksek çözünürlüklü sahne ayrıştırmayı çalıştıran sinyali ortadan kaldırdı. NaViT (Google, 2023), değişken çözünürlüklü yamaları blok çapraz maskeleme ile tek bir transformer grubuna paketleyebileceğinizi gösterdi. Qwen2-VL'nin M-RoPE'si (2024), mutlak konumsal tabloları tamamen kaldırdı. LLaVA-NeXT'in AnyRes'i, yüksek çözünürlüklü görüntüleri bir temel + alt görüntülere döşedi. SigLIP 2'nin NaFlex çeşidi (2025), artık her en boy oranına hizmet edecek tek bir kontrol noktası isteyen açık VLM'ler için varsayılan kodlayıcıdır. Bu ders yama ve paketi uçtan uca uygular.

**Tür:** Yapım
**Diller:** Python (stdlib, yama paketleyici + blok çapraz maske)
**Önkoşullar:** Aşama 12 · 01 (ViT yamaları), Aşama 12 · 05 (LLaVA)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Bir dizi değişken çözünürlüklü görüntüdeki yamaları tek bir sıraya paketleyin ve blok çapraz dikkat maskesini oluşturun.
- Belirli bir görev için AnyRes döşeme (LLaVA-NeXT), NaFlex (SigLIP 2) ve M-RoPE (Qwen2-VL) arasından seçim yapın.
- Yeniden boyutlandırmaya gerek kalmadan OCR, grafikler ve fotoğrafçılık için token bütçelerini hesaplayın.
- Kare yeniden boyutlandırmanın üç başarısızlık modunu adlandırın: sıkıştırılmış metin, kırpılmış içerik, dolguda boşa harcanan token.

## Sorun

Transformer'ler bir dizi bekler. Bir parti, aynı uzunluktaki dizilerin bir yığınıdır. Resimleriniz 224x224 ise her seferinde 196 yama token alırsınız, dolgu gerekmez, iş tamamdır. 224'ten eğitim alın, 224'ten çıkarım yapın, bir daha asla çözümü düşünmeyin.

Dünya işbirliği yapmıyor. Belgeler dikeydir (8,5x11 inç, 2:3 benzeri). Grafik ekran görüntüleri yataydır (16:9). Makbuzlar uzun ve incedir (1:3). Tıbbi görüntüleme 2048x2048 veya daha büyük boyutta gönderilir. Mobil cihaz ekran görüntüleri 1170x2532 (0,46:1) boyutundadır.

2024 öncesi üç seçenek ve her birinin neden başarısız olduğu:

1. Sabit bir kareye (224x224 veya 336x336) yeniden boyutlandırın. Ezilme metni ve yüzleri bozar. Ölçeğin küçültülmesi grafik etiketlerini ve OCR içeriğini yok eder. LLaVA-1.5'e kadar standart uygulama.
2. Sabit bir en boy oranına göre kırpın. Görüntünün çoğunu çöpe atıyorsunuz ve kırpma konumunu seçmek başlı başına bir görme sorunudur.
3. En uzun tarafa doğru bastırın. Bozulmayı düzeltir ancak portre görüntüleri için dolguda %50'den fazla token israfına neden olur. Tüm bu pad token'lerde ikinci dereceden dikkat maliyeti.

2024-2025'in yanıtı: transformer'nin yamaları görüntünün yerel çözünürlüğünde yemesine izin verin ve heterojen bir toplu işlemin, bilgi israfı olmadan tek bir sıraya nasıl paketleneceğini öğrenin.

## Konsept

### NaViT ve yama paketi

NaViT (Dehghani ve diğerleri, 2023), bu çalışmaları geniş ölçekte gösteren makaleydi. Fikir mekaniktir:

1. Gruptaki her görüntü için, yerel yama ızgarasını seçilen yama boyutunda (örneğin 14) hesaplayın.
2. Her görüntünün yamalarını kendi değişken uzunluklu dizisine göre düzleştirin.
3. Toplu iş için tüm görüntülerin yamalarını tek bir uzun dizide birleştirin.
4. A görüntüsündeki yamaların yalnızca A görüntüsüne dikkat etmesi için blok çapraz bir dikkat maskesi oluşturun.
5. Yama başına konum bilgisini taşıyın (2D RoPE veya kesirli konum embedding'ler).

336x336 (576 token), 224x224 (256 token) ve 448x336 (768 token) boyutunda üç görüntüden oluşan bir grup, 1600x1600 blok çapraz maskeli bir 1600-token dizisi haline gelir. Dolgu yok. Boşa işlem yok. transformer isteğe bağlı en boy oranlarını yönetir.

NaViT ayrıca, eğitimi hem düzenli hale getiren hem de hızlandıran, eğitim sırasında kesirli yama bırakmayı (toplamada yamaların %50'sini rastgele bırakma) tanıttı. SigLIP 2 bunu miras aldı.

### AnyRes (LLaVA-NeXT)

LLaVA-NeXT'in AnyRes'i pragmatik bir alternatiftir. Yüksek çözünürlüklü bir görüntü ve sabit bir kodlayıcı (336'da CLIP veya SigLIP) verildiğinde, görüntüyü döşeyin:

1. Önceden tanımlanmış bir kümeden (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), vb. — görüntünün en boy oranına en iyi uyan bir ızgara düzeni seçin.
2. Tam görüntüyü ızgaraya döşeyin; her döşeme 336x336 boyutunda bir ürün haline gelir.
3. Ayrıca bir küçük resim de oluşturun: resmin tamamı token genel bağlamı olarak 336x336 olarak yeniden boyutlandırıldı.
4. Dondurulmuş 336 kodlayıcı aracılığıyla her döşemeyi kodlayın. token'ler + küçük resim token'leri birleştirin.

2x2 ızgara artı küçük resimde 672x672 görüntü için: 4 * 576 + 576 = 2880 görsel token. Pahalı ama etkili - LLM hem yerel ayrıntıları hem de küresel bağlamı görür.

AnyRes, kodlayıcınız dondurulduğunda ve yalnızca tek bir çözünürlüğü desteklediğinde tercih edilen yoldur. Büyük görüntüler için token sayımını patlatır (4x4 ızgarada 1344x1344 görüntü 9216 + 576 ≈ 9800 token'dir, bu da 8k LLM bağlamının çoğunu doldurur).

### M-Halat (Qwen2-VL)

Qwen2-VL, Multimodal Döner Pozisyon Embedding'yi tanıttı. NaViT'in kesirli konumları veya AnyRes'in döşemesi ve küçük resmi yerine, her yama bir 3 boyutlu konum (zamansal, yükseklik, genişlik) taşır. Sorgu/anahtar rotasyonları isteğe bağlı H, W ve zamansal uzunluğu yönetir.

M-RoPE, yeniden eğitim gerektirmeden doğal dinamik çözünürlük sunar. inference'de herhangi bir HxW görüntüyü beslersiniz, yama yerleştirici H/14 x W/14 token'ler üretir, her token kendi (t=0, r=satır, c=sütun) konumunu alır, RoPE dikkati doğru frekanslarla döndürür ve tamamdır. Qwen2.5-VL ve Qwen3-VL buna devam ediyor. InternVL3'ün V2PE'si, modalite başına değişken kodlamayla aynı fikirdir.

AnyRes'in aksine M-RoPE, yerel çözünürlükte O(H x W / P^2) token'dir; çarpımsal döşeme ek yükü yoktur. NaViT'in aksine, yine de iletim başına tek bir görüntü bekler. Çözünürlükler arasında toplu işlem yapmak hâlâ yama ve pakete ihtiyaç duyuyor.

### NaFlex (SigLIP 2)

NaFlex, SigLIP 2 kontrol noktasının yerel esnek modudur. Tek bir model, inference'de birden fazla dizi uzunluğuna (256, 729, 1024 token) hizmet eder. Dahili olarak, eğitim sırasında NaViT tarzı yama ve paket ve yama başına mutlak kesirli konumlar kullanır. Satış noktası: bir kontrol noktası, göreve göre token bütçenizi inference'de seçin.

Anlamsal bir görev için (sınıflandırma, erişim), 256 token. OCR veya grafiği anlamak için 1024 token. Yeniden eğitim yok.

### Paketleme maskesi

Blok-çapraz maske çoğu uygulamanın tökezlediği yerdir. `n_i` uzunluklarına sahip `i=0..B-1` görüntülerini kapsayan `N_total` uzunluğundaki paketlenmiş bir dizi için, `(N_total, N_total)` şeklindeki `M` maskesi, her iki indeks de aynı görüntünün bloğuna düşüyorsa 1'dir, aksi halde 0'dır. Bunu kümülatif bir uzunluk listesinden oluşturabilirsiniz:

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

Bu, PyTorch'ta `torch.block_diag` veya açık bir toplama içeren bir satırdır. FlashAttention'ın değişken uzunluklu yolu (`cu_seqlens`), maskeyi tamamen atlar ve kümülatif uzunluk tensörünü kullanarak doğrudan dizilere katılır; tipik gruplar için yoğun bir maskeden ~10 kat daha hızlıdır.

### Token bütçeler

Stratejinizi göreve göre seçin:

- OCR / belgeler: 1024-4096 token'ler. 1024'te SigLIP 2 NaFlex veya AnyRes 3x3 + küçük resim.
- Grafikler ve kullanıcı arayüzü: 384-448 yerelde 729-1024 tokens. Maksimum piksel sınırıyla Qwen2.5-VL dinamik çözünürlük.
- Doğal fotoğraflar: 256-576 tokens iyidir. Aşağı yöndeki LLM yeterince görüyor. İçerik yoğunluğunun yüksek olduğu token'ler için ödeme yapın.
- Video: Uzamsal havuzlamadan sonra kare başına 64-128 token, 2-8 FPS. Ders 12.17 bunu kapsamaktadır.

2026 üretim kuralı: Görev başına maksimum piksel sınırı seçin, bu sınıra kadar yerel en boy oranında kodlayın, toplu paketi paketleyin ve doldurmayı atlayın. Qwen2.5-VL, tam olarak bu düğme için `min_pixels` ve `max_pixels`'yi ortaya çıkarır.

## Kullan onu

`code/main.py`, tamsayı piksel koordinatlarına sahip heterojen bir görüntü kümesi için yama paketi uygular. Bu:

- (H, W) görüntü boyutlarının bir listesini alır.
- Her görüntünün yama dizisi uzunluğunu yama boyutu 14'te hesaplar.
- Bunları toplam uzunluktaki `sum(n_i)` tek bir dizi halinde paketler.
- Blok-çapraz dikkat maskesini oluşturur (netlik için yoğun).
- Paketlenmiş maliyeti kare yeniden boyutlandırma ve AnyRes döşemeyle karşılaştırır.
- Karışık bir parti için (makbuz, grafik, ekran görüntüsü, fotoğraf) bir token bütçe tablosu yazdırır.

Çalıştır. Düşen sayılar, her 2026 açık VLM'nin patch-n'-pack kullanmasının nedenidir.

## Gönderin

Bu ders `outputs/skill-resolution-budget-planner.md`'yi üretir. Karışık en boy oranlı bir iş yükü (OCR, grafikler, fotoğraflar, video çerçeveleri) ve toplam token bütçe göz önüne alındığında, doğru stratejiyi (NaFlex, AnyRes, M-RoPE veya sabit kare) seçer ve istek başına bir yapılandırma yayar. Bir ürün için VLM'yi boyutlandırırken bu beceriyi kullanın; gecikme bütçelerini ortadan kaldıran sessiz 10x token patlamasını önler.

## Egzersizler

1. Makbuz 600x1500 (1:2,5) boyutundadır. 14 yama boyutunda kaç tane yerel çözünürlüklü token var? Kare yeniden boyutlandırıldıktan sonra 336'ya kaç tane var? Hangisi pratikte OCR doğruluğunu daha fazla kaybeder?

2. Uzunlukları 256, 576, 729, 1024 olan dört görüntüden oluşan bir grup için blok çapraz maskeyi oluşturun. Dikkat matrisinin 2585x2585 olduğunu ve tam olarak `256^2 + 576^2 + 729^2 + 1024^2` sıfır olmayan girişlere sahip olduğunu doğrulayın.

3. Yama 14'teki 1792x896 görüntü için şunları karşılaştırın: (a) 336'ya kare yeniden boyutlandırın ve ardından kodlayın, (b) AnyRes 2x1 + küçük resim, (c) yerel olarak M-RoPE. Hangisi en az token kullanıyor? Hangisi en fazla ayrıntıyı korur?

4. Kesirli yama bırakma işlemini uygulayın: paketlenmiş bir sıra verildiğinde, token'lerin %50'sini eşit şekilde rastgele bırakın ve blok-çapraz maskeyi buna göre güncelleyin. Maskenin seyreklik değişimini ölçün.

5. Qwen2-VL makalesinin (arXiv:2409.12191) Bölüm 3.2'sini okuyun. `min_pixels` ve `max_pixels`'nin neyi kontrol ettiğini ve her iki sınırın neden önemli olduğunu iki cümleyle açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Yama ve Paket | "NaViT tarzı paketleme" | Farklı görüntülerdeki değişken uzunluktaki yama dizilerini tek bir toplu boyutta birleştirin |
| Blok çapraz maske | "Ambalaj maskesi" | Her görüntünün yamalarını paketteki komşularla değil, yalnızca kendileriyle ilgilenecek şekilde sınırlayan dikkat maskesi |
| Herhangi Bir Res | "LLaVA-NeXT döşeme" | Yüksek çözünürlüklü bir görüntüyü sabit boyutlu döşemelerden oluşan bir ızgaraya ve genel bir küçük resme bölün; her parçayı sabit bir kodlayıcıyla kodlayın |
| NaFlex | "SigLIP 2 yerel esnek" | Yeniden eğitim gerektirmeden inference'de 256/729/1024-token bütçelerine hizmet eden tek SigLIP 2 kontrol noktası |
| M-HALAT | "Multimodal Halat" | Konum tabloları olmadan keyfi H, W, T işlemlerini gerçekleştiren 3 boyutlu döner konum kodlaması (zaman, satır, sütun) |
| cu_seqlens | "FlashAttention paketleme" | FlashAttention varlen yolunun yoğun blok çapraz maske yerine kullandığı kümülatif uzunluk tensörü |
| min_pixels / max_pixels | "Çözünürlük sınırları" | token sınırını belirleyen Qwen2.5-VL istek başına düğmeler, çok küçük veya çok büyük girişlere güvenir |
| Görsel token bütçesi | "Resim başına kaç token" | Görüntü başına yayılan token yamalarının kaba sayısı; Yüksek Lisans'ın prompt bütçesini ve dikkat maliyetini belirliyor |

## Daha Fazla Okuma

- [Dehghani ve ark. — Yama ve Paket: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang ve ark. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon ve ark. — Vizyon dili modelleri oluştururken neler önemlidir? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen ve ark. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Ekibi — Qwen2.5-VL Teknik Raporu (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
