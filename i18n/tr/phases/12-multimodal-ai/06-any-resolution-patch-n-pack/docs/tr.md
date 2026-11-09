# Herhangi bir çözünürlükle görme: Patch-n'-Pack ve NaFlex

> Gerçek görüntüler 224x224 kare değil. Bir makbuz 1: 3, bir tablo 16: 9, bir tıbbi tarama 4096x4096, bir mobil ekran görüntüsü 9:19.5. 2024'ten önceki VLM cevabı  her şeyi sabit bir kareye boyutlandır  OCR, belge anlayışı ve yüksek çözünürlüklü sahne analizini yapan sinyali atıyor. NaViT (Google, 2023) değişken çözünürlüklü yamaları blok diyagonal maske ile tek bir transformatör partiye paketleyebileceğinizi gösterdi. Qwen2-VL'nin M-RoPE (2024) mutlak pozisyon tablolarını tamamen düşürdü. LLaVA-NeXT'in AnyRes yüksek çözünürlüklü görüntülerini bir taban + alt görüntülere kaydırdı. SigLIP 2'nin NaFlex variansı (2025) artık her yön oranına hizmet vermek için tek bir kontrol noktası isteyen açık VLM'ler için varsayılan kodlayıcıdır. Bu ders, bir parça parça yaptırır.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Değişken çözünürlüklü görüntüler bir seriye paketle ve blok diyagonal dikkat maskesini oluştur.
- Verilmiş bir görev için AnyRes kapaklama (LLaVA-NeXT), NaFlex (SigLIP 2) ve M-RoPE (Qwen2-VL) arasında seçim yapın.
- OCR, tablolar ve fotoğraflar için token bütçelerini boyutlarını değiştirmeden hesaplayın.
- Çekirde boyutlandırmanın üç başarısız modunun adını verin: sıkıştırılmış metin, kesilmiş içerik, dolguda harcadığı jetonlar.

## Sorun

Transformatörler bir dizi bekler. Bir parti aynı uzunlukta bir dizi yığınıdır. Eğer resimleriniz 224x224 ise, her seferinde 196 patch tokeni alırsınız, doldurma gerekmez, iş tamamlanmıştır. 224'e tren, 224'e çıkar, çözünürlüğü asla düşünmeyin.

Dünya işbirliği yapmaz. Belgeler portredir (8.5x11 inç, 2:3-ish). Çart ekran görüntüleri manzara (16:9). Kitseler uzun ve ince (1:3). 2048x2048 veya daha büyük tıbbi görüntüleme gemileri. Mobil cihaz ekran görüntüleri 1170x2532 (0.46:1).

2024'e kadar üç seçenek ve bunların her birinin neden başarısız olduğu:

1. Sıkıntılı bir düzene göre şekil değiştirmek için, bir düzene göre şekil değiştirmek gerekir.
2. Resimlerin çoğunu atarsın ve biçim yeri seçmek kendi görüş sorunu.
3. En uzun tarafına kapatır. Bozukluğu düzeltir ama portre görüntülerine kapatmak için tokenlerin %50'ini harcıyor.

2024-2025'te cevap: transformatörün resmin doğuştan çözünürlüğünde parşömenler yemeye izin vermesi ve heterogen bir partiyi bir diziye nasıl paketleyeceğini bulması gerek.

## Anlaşım

### NaViT ve patch-n'-pack

NaViT (Dehghani et al., 2023) bu çalışmaları ölçekte gösteren makaledir.

1. Parçadaki her görüntü için, kendi yerel parçet çubuğunu seçilen bir parçet boyutunda hesaplayın (deyelim ki 14).
2. Her resmin yamalarını kendi değişken uzunluklı dizisine düzelt.
3. Tüm resimlerin parşlarını seri için uzun bir dizide birleştirin.
4. Bir blok diyagonal dikkat maskası yapın böylece A resminin yamaları sadece A resmin içinde yer alır.
5. Her patç için konum bilgileri taşın (2D RoPE veya bölümlü konum yerleşimleri).

336x336 (576 jeton), 224x224 (256 jeton) ve 448x336 (768 jeton) ile üç görüntüden oluşan bir parti, 1600x1600 blok-diyagonal maskesi ile 1600 jeton dizisi haline gelir.

NaViT ayrıca eğitim sırasında bölümsel yama düşüşünü de tanıttı.  İşi düzenleyen ve hızlandırıcı eğitim yapan parti boyunca %50'lik yama rastgele düşüş. SigLIP 2 buna mirasçı oldu.

### AnyRes (LLaVA-NeXT)

LLaVA-NeXT'in AnyRes pragmatik bir alternatiftir. Yüksek çözünürlüklü bir görüntü ve sabit bir kodlayıcı (CLIP veya SigLIP 336) verildiği için, görüntüyi çiz:

1. Önceden tanımlanmış bir setten  (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), vb. 'yi seçin.
2. Tüm görüntüyü şebekeye kaydırın; her kaydırma 336x336 biçim haline gelir.
3. Ayrıca küçük bir resim oluşturun: tüm görüntü küresel bağlamlı bir simge olarak 336x336'ya yeniden boyutlandırıldı.
4. Her tekelyi donmuş 336 kodlayıcısı ile kodlayın.

2x2 grid ve miniatürde 672x672 görüntü için: 4 * 576 + 576 = 2880 görsel jeton. Pahalı ama etkili  LLM hem yerel ayrıntıları hem de küresel bağlamı görür.

AnyRes, kodlamanız dondurulduğunda ve yalnızca bir çözünürlüğü desteklediğinde seçilen yoldur. Büyük görüntüler için token sayısını patlatır (4x4 şeritte bir 1344x1344 görüntü 9216 + 576 ≈ 9800 token, herhangi bir metin gelmeden önce 8k LLM bağlamını aşar).

### M-RoPE (Qwen2-VL)

Qwen2-VL, Multimodal Rotary Position Embedding'i tanıttı. NaViT'in kıramlı pozisyonları veya AnyRes'in kapak ve miniatür yerine, her yama 3 boyutlu bir konum (zamanlı, yükseklik, genişlik) taşıyor. Sorgu / anahtar dönümleri keyfi H, W ve zamanlı uzunluğu ele alıyor.

M-RoPE, yeniden eğitim almadan yerel dinamik çözünürlük gönderir. Herhangi bir HxW görüntüsünü beslediğinizde, yama ekleyici H/14 x W/14 jetonları üretir, her jeton (t=0, r=sır, c=col) konumunu alır, RoPE dikkatini doğru frekanslarla döndürür, yapılır. Qwen2.5-VL ve Qwen3-VL bunu sürdürür. InternVL3'in V2PE'si değişken kodlama ile aynı fikirdir.

AnyRes' den farklı olarak, M-RoPE $O(H \times W / P^2)$Bu, NaViT'in diğer tüm teknolojilerden farklı olarak, önüme bir görüntü bekliyor.

### NaFlex (SigLIP 2)

NaFlex, SigLIP 2 kontrol noktasının doğuştan hareket eden modudur. Tek bir model, sonuçta birden fazla dizi uzunluğu (256, 729, 1024 token) hizmet eder. İçeriden eğitim sırasında NaViT tarzı patch-n'-pack ve her patch için mutlak bölümsel pozisyonlar kullanır. Satış noktası: bir kontrol noktası, görev temelinde sonuçta token bütçenizi seçin.

Bir semantik görev için (sınıflama, geri alım), 256 token. OCR veya tablo anlayışı için, 1024 token.

### - Paket maskası .

Bir blok diyagonal maskası, çoğu uygulamanın çarpışmasıdır.`N_total`Görüntüleri kapsar `i=0..B-1`uzunlukları ile `n_i`, maskeyi`M`şekli ile`(N_total, N_total)`Eğer her iki indeks aynı görüntü blokuna düşerse, 0'dur.

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

Bu PyTorch'de bir satır.`torch.block_diag`FlashAttention'un değişken uzunluklu yolu (`cu_seqlens`) maskeyi tamamen atlar ve kumülatîf uzunluk tenzorunu kullanarak sırada bir şekilde düzenler.

### Token bütçeleri

Görevlere göre stratejinizi seçin:

- OCR / belgeler: 1024-4096 jeton. SigLIP 2 NaFlex 1024, veya AnyRes 3x3 + miniatür.
- Çarşemalar ve kullanıcı arazi: 729-1024 token 384-448 doğuştan.
- Doğal fotoğraflar: 256-576 token iyi. Aşağıdaki LLM yeterince görür. İçeriğin yoğunluğu yüksek olan tokenler için ödeme.
- Video: Yerel birleştirme sonrası, her çerçeveye 64-128 token, 2-8 FPS. 12.17 ders bunu kapsar.

2026 üretim kuralı: her göreve maksimum piksel kapalı bir şey seçin, bu kapalı doğal boyut oranında kodlayın, partiyi paketleyin ve doldurmayı atlayın.`min_pixels`ve `max_pixels`Tam olarak bu düğmeye.

```figure
mm-patch-n-pack
```

## Kullan

`code/main.py`tam pixel koordinatları olan heterogen bir görüntü parti için patch-n'-pack uygulamaktadır.

- (H, W) görüntü boyutlarının bir listesini alır.
- Her resmin patch dizisi uzunluğunu patch boyutu 14'te hesaplar.
- Toplam uzunluğunda bir diziye paketler .`sum(n_i)`- Evet .
- Blok diyagonal dikkat maskesini (yaklaşıklık için yoğun) oluşturur.
- Paketlenmiş maliyet ile kare boyut ve AnyRes kapak karşılaştırır.
- Karışık bir parti için bir belirti bütçe tablosunu basar (girdi, tablo, ekran görüntüsü, fotoğraf).

Çıkış sayıları 2026'da açılan her VLM'nin patch-n'-pack'i kullanmasının nedeni.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-resolution-budget-planner.md`. Karışık bir yön oranlı iş yükü (OCR, tablolar, fotoğraflar, video çerçeveleri) ve toplam bir token bütçesi göz önüne alındığında, doğru stratejiyi (NaFlex, AnyRes, M-RoPE veya sabit kare) seçer ve istek başına bir yapılandırma yayar.

## Egzersizler

1. Bir makbuz 600x1500 (1:2.5) olarak 14 boyutlu bir yama ile, kaç tane yerel çözünürlüklü token? 336'ya kare boyutundan sonra kaç tane?

2. 256, 576, 729, 1024 uzunlukları olan dört görüntü için blok diyagonal maskesini yapın. dikkat matrisinin 2585x2585 olduğunu ve tam olarak `256^2 + 576^2 + 729^2 + 1024^2`sıfır dışı girişler.

3. Patch 14'te 1792x896 görüntü için: (a) kare boyutunu 336'a çevirin ve sonra kodlayın, (b) AnyRes 2x1 + miniatür, (c) M-RoPE'de yerel olarak. Hangi token en az kullanılır?

4. Fraksiyonel patch düşüşü uygulayın: paketlenmiş bir dizi verildiğinde, simgelerin %50'ini rastgele olarak düşürün ve blok-diyagonal maskanı buna göre güncelleyin. Maskenin kısıtlılık değişikliğini ölçün.

5. Qwen2-VL makalesinin 3.2 bölümünü okuyun (arXiv:2409.12191).`min_pixels`ve `max_pixels`kontrol ve neden her iki sınır da önemli.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## Daha Fazla Okumak

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
