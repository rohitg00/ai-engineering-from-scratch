# CLIP ve Karşılaştırmalı Görme-Dil Ön Eğitimi

> OpenAI'nin CLIP'i (2021), önümüzdeki beş yıla güç verecek kadar büyük tek bir fikri kanıtladı: yalnızca gürültülü web görüntüsü-altyazı çiftleri ve kontrast kaybı kullanarak bir görüntü kodlayıcıyı ve bir metin kodlayıcıyı aynı vektör uzayında hizalamak. Sıfır denetlenen etiket. 400 milyon çift. Ortaya çıkan embedding alanı, sıfır atış sınıflandırması, görüntü metni alımı yapar ve her 2026 VLM'ye görüş kulesi olarak bağlanır. SigLIP 2 (2025), softmax'ı sigmoid ile değiştirdi ve daha düşük maliyetle CLIP'i geride bıraktı. Bu ders InfoNCE'den sigmoid ikili kaybına kadar matematiği anlatır ve stdlib Python'da eğitim adımını oluşturur.

**Tür:** Yapım
**Diller:** Python (stdlib, InfoNCE + sigmoid kaybı uygulamaları)
**Önkoşullar:** Aşama 12 · 01 (ViT yamaları), Aşama 7 (Transformer'ler)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- InfoNCE kaybını karşılıklı bilgiden türetin ve sayısal olarak kararlı bir vektörleştirilmiş versiyonu uygulayın.
- Sigmoid çift yönlü kaybın (SigLIP) neden toplam genel gider softmax talepleri olmadan 32768+ grubuna ölçeklendiğini açıklayın.
- Metin şablonları (`a photo of a {class}`) oluşturarak ve kosinüs benzerliği üzerinden argmax'ı alarak sıfır atışlı ImageNet sınıflandırmasını çalıştırın.
- CLIP / SigLIP ön eğitiminin size sağladığı dört kolu adlandırın: parti boyutu, sıcaklık, prompt şablonu, veri kalitesi.

## Sorun

CLIP öncesi görüş denetlendi. Etiketli dataset'leri toplayın (ImageNet: 1,2 milyon görüntü, 1000 sınıf), bir CNN'yi eğitin ve gönderin. Etiketler pahalıdır, etiketler etiketleyicilerin üzerinde anlaşabileceği konularda önyargılıdır ve etiketler, ince ayar yapılmadan yeni görevlere aktarılmaz.

Resim yazısı webinde ücretsiz olarak bir milyardan fazla gevşek etiketli çift bulunur. "Köpeğim Max parkta" alternatif metnine sahip bir Golden Retriever resmi, denetleyici bir sinyal taşıyor; metin, görüntüyü tanımlıyor. Soru şu: Bunu yararlı bir eğitime dönüştürebilir misiniz?

CLIP'in cevabı: resim yazısı çiftlerini eşleştirme görevi olarak ele alın. Bir grup N resim ve N başlık verildiğinde, N-1 çeldiriciye karşı her görüntüyü kendi başlığıyla eşleştirmeyi öğrenin. Denetim "bu iki şey birbirine ait; bu N-1 değil." şeklindedir. Sınıf etiketi yok. İnsan açıklaması yok. Sadece karşılaştırmalı bir kayıp.

Ortaya çıkan embedding alanı, CLIP'in eğitildiğinden daha fazlasını yapar. ImageNet sıfır çekim işe yarıyor çünkü "bir kedi fotoğrafı" hiçbir zaman açıkça kedi olarak etiketlenmeyen kedi resimlerinin yanına yerleştiriliyor. Bu, her 2026 VLM'de ortaya çıkan bahistir.

## Konsept

### Çift kodlayıcı

CLIP'in iki kulesi vardır:

- Görüntü kodlayıcı `f`: ViT veya ResNet, görüntü başına bir D-dim vektörü çıkışı sağlar.
- Metin kodlayıcı `g`: küçük transformer, başlık başına bir D-dim vektörü üretir.

Her iki kule de çıktılarını birim uzunluğa göre normalleştirir. Her ikisi de birim norm olduğundan benzerlik `cos(f(x), g(y)) = f(x)^T g(y)`'dir.

N (resim, başlık) çiftten oluşan bir grup için, `(N, N)` şeklindeki `S` benzerlik matrisini oluşturun:

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

burada `tau` öğrenilmiş bir sıcaklıktır (CLIP 0,07'ye başlar; günlük alanında öğrenilir).

### InfoNCE kaybı

CLIP, satırlar ve sütunlar üzerinde simetrik bir çapraz entropi kullanır:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Burası InfoNCE. CE'deki softmax, her görselin, gruptaki diğer tüm altyazılardan daha fazla kendi başlığıyla eşleşmesini zorlar. "Negatifler" diğer tüm toplu öğelerdir. Daha büyük gruplar = daha fazla negatif = daha güçlü sinyal. CLIP 32k partisinde eğitilmiştir; ölçek önemlidir.

### Sıcaklık

`tau` softmax'ın keskinliğini kontrol eder. Düşük tau → keskin dağılım, sert negatif madencilik etkisi. Yüksek tau → yumuşak, tüm örnekler katkıda bulunur. CLIP, çöküşü önlemek için kırpılan log(1/tau)'yu öğrenir. SigLIP 2 başlangıçtaki tau'yu düzeltir ve bunun yerine öğrenilmiş bir önyargı kullanır.

### Sigmoid neden daha iyi ölçeklenir (SigLIP)

Softmax'ın tüm benzerlik matrisinin senkronize olmasına ihtiyacı var. Dağıtılmış eğitimde, her embedding'yi her kopyaya toplamanız, ardından softmax'ı yapmanız gerekir. Bu, iletişim için dünya boyutunda ikinci dereceden bir değerdir.

SigLIP, softmax'ı öğe bazında sigmoid ile değiştirir: her `(i, j)` çifti için kayıp, "bunlar eşleşen çift mi?" şeklinde ikili bir sınıflandırmadır. pozitif sınıf etiketleri köşegendir, geri kalan her şey negatiftir. Kayıp şu:

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` ise `i == j`, değilse 0. Her çiftin kaybı bağımsızdır. Hepsinin toplanmasına gerek yok. Her GPU kendi yerel bloğunu ve toplamlarını hesaplar. SigLIP 2, CLIP'in orantılı olarak daha fazla iletişime ihtiyaç duyacağı 32k-512k'yi toplu olarak ucuza ölçeklendirir.

### Sıfır atış sınıflandırması

N sınıf adı verildiğinde, her sınıf için bir metin şablonu oluşturun:

```
"a photo of a {class}"
```

Her şablonu metin kodlayıcıya ekleyin. Görüntünüzü görüntü kodlayıcıyla gömün. Argmax kosinüs benzerliği = tahmin edilen sınıf. Hedef sınıflara yönelik eğitim yok.

Prompt şablonları önemlidir. CLIP'in orijinal makalesinde sınıf başına 80 şablon kullanıldı (sade, sanatsal, fotoğraf, resim vb.) ve embedding'lerin ortalaması alındı. +3 ImageNet puanı. Modern kullanım genellikle bir veya iki şablonu seçer.

### Doğrusal problar ve ince ayar

Sıfır atış bir temeldir. Doğrusal bir araştırma (hedef sınıflarınız için donmuş CLIP özelliklerinin üstüne bir doğrusal katman eğitin), etki alanı içi görevlerde sıfır atıştan üstündür. Tam ince ayar, alan içi doğrusal probu yener ancak sıfır atış aktarımına zarar verebilir. Üç değiş-tokuşu olan üç rejim.

### SigLIP 2: NaFlex ve yoğun özellikler

SigLIP 2 (2025) şunu ekliyor:
- NaFlex: tek model, değişken en boy oranlarını ve çözünürlükleri yönetir.
- Segmentasyon ve derinlik tahmini için daha iyi yoğun özellikler, VLM'lerde donmuş bir omurga olarak kullanılması hedefleniyor.
- Çok dilli: CLIP'in yalnızca İngilizce olduğu 100'den fazla dilde eğitim verilmiştir.
- CLIP'in 400M'de zirveye çıktığı 1B param ölçeği.

2026 açık VLM'lerde SigLIP 2 SO400m/14 varsayılan görüş kulesidir. CLIP, belirli LAION-2B eğitim dağıtımının sorgu modelinizle eşleştiği durumlarda saf görüntü metni alımı için varsayılan olarak kalır.

### HİZALAMA, TEMEL, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): CLIP ile aynı fikir, 1,8B çift ölçek, %90 gürültülü. Kanıtlanmış gürültülü veri ölçekleri. OpenCLIP (LAION): LAION-400M / 2B'de CLIP'in açık kopyası, çoklu ölçekler, açık kontrol noktası. EVA-CLIP: maskelenmiş görüntü modellemesinden başlatır; VLM'ler için güçlü bir omurga. BASIC: Google'ın CLIP+ALIGN hibriti. Hepsi aynı aile, farklı veriler ve ayarlar.

### Sıfır atış tavanı

CLIP sınıfı modeller yaklaşık %76 ImageNet sıfır çekimini (CLIP-G, OpenCLIP-G) sınırlar. Ötesi ya çok daha büyük veriler (SigLIP 2 %80+ alır) ya da mimari değişiklikler (denetlenen kafalar, daha fazla parametre) gerektirir. benchmark doyurucu; gerçek değer, aşağı akış VLM'lerinin tükettiği embedding alanıdır.

```figure
multimodal-fusion
```

## Kullan onu

`code/main.py` şunu uygular:

1. InfoNCE şeklini numpy olmadan görebilmeniz için oyuncak ikili kodlayıcı (karma tabanlı görüntü özellikleri, metin karakteri özellikleri).
2. Saf Python'da InfoNCE kaybı (log-sum-exp yoluyla sayısal kararlılık).
3. Karşılaştırma için sigmoid ikili kaybı.
4. Sıfır atışlı bir sınıflandırma rutini: tahmin için argmax, prompt metin kümesine karşı kosinüs benzerliğini hesaplayın.

Çalıştırın ve kayıp eğrisini izleyin. Mutlak sayılar oyuncaktır; şekli gerçek bir CLIP antrenörünün yaydığı şekle uyuyor.

## Gönderin

Bu ders `outputs/skill-clip-zero-shot.md`'yi üretir. Bir dizi görüntü (yol yoluyla) ve bir hedef sınıf listesi verildiğinde, CLIP şablonuyla prompt metinleri oluşturur, her iki tarafı da belirtilen bir kontrol noktasıyla (e.g., `openai/clip-vit-large-patch14`) yerleştirir ve benzerlik puanlarıyla ilk 1 / ilk 5 tahminleri döndürür. Beceri, prompt listesinde olmayan sınıflar hakkında iddiada bulunmayı reddeder.

## Egzersizler

1. InfoNCE'yi 4 çiftlik bir grup için elle uygulayın. 4x4 benzerlik matrisini oluşturun, softmax'ı çalıştırın, köşegeni seçin, çapraz entropiyi hesaplayın. Python uygulamanızı bu el hesaplamasına göre doğrulayın.

2. SigLIP, sıcaklığa ek olarak `b` öngerilim parametresini kullanır: `S'[i,j] = S[i,j]/tau + b`. Grupta büyük bir sınıf dengesizliği (satır başına pozitiflerden çok daha fazla negatif) olduğunda `b` hangi rolü oynar? SigLIP Bölüm 3'ü okuyun (arXiv:2303.15343).

3. Kediler ve köpekler için sıfır atışlı bir sınıflandırıcı oluşturun. İki prompt şablonunu deneyin: `a photo of a {class}` ve `a picture of a {class}`. 100 test görüntüsünde doğruluğu ölçün. Şablonlar topluluğu single'ı yener mi?

4. Toplu 32k'de 512 GPU çalıştırması için softmax InfoNCE ile sigmoid arasındaki iletişim maliyetini ikili olarak hesaplayın. Hangisi O(N), hangisi O(N^2) olarak ölçeklenir? SigLIP Bölüm 4'ten alıntı yapın.

5. OpenCLIP ölçeklendirme yasaları makalesini okuyun (arXiv:2212.07143, Cherti ve diğerleri). Şekillerden veri ölçeklendirmeye ilişkin sonuçları yeniden üretin: sabit model boyutunda, ImageNet sıfır atış doğruluğu ile eğitim veri boyutu arasındaki log-doğrusal ilişki nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| BilgiNCE | "Karşılaştırmalı kayıp" | Bir partinin benzerlik matrisi üzerinden çapraz entropi; her öğenin olumlu tarafı eşleştirilmiş öğedir, olumsuz öğeler ise diğer her şeydir |
| Sigmoid kaybı | "SigLIP kaybı" | Çift başına ikili çapraz entropi; softmax yok, hepsi bir arada değil, dağıtılmış eğitimde ucuza ölçekleniyor |
| Sıcaklık | "tau" | Softmax/sigmoid'den önce logitleri ölçeklendiren skaler; dağıtımın keskinliğini kontrol eder |
| Sıfır atış | "ince ayarsız sınıflandırma" | embedding sınıfını oluşturmak ve kosinüs benzerliğine göre sınıflandırmak için prompt metinlerini kullanın; hedef sınıflara ilişkin eğitim yok |
| Prompt şablonu | "bir fotoğraf ..." | Bir sınıf adının etrafındaki metin iskelesi; sıfır atış doğruluğunu 1-5 puan etkiler |
| Çift kodlayıcı | "İki kule" | Bir görüntü kodlayıcı + bir metin kodlayıcı, paylaşılan D-dim alanında çıktılar |
| Sert negatif | "Zor dikkat dağıtıcı" | Olumluya yeterince benzeyen bir olumsuzluk, modelin bunları ayırmak için çalışması gerekiyor |
| Doğrusal prob | "Dondurulmuş + bir katman" | Dondurulmuş özelliklerin üzerinde yalnızca doğrusal bir sınıflandırıcı eğitin; özellik kalitesini ölçer |
| NaFlex | "Yerel esnek çözünürlük" | SigLIP 2'nin yeniden boyutlandırmaya gerek kalmadan herhangi bir en boy oranı ve çözünürlükteki görüntüleri alma yeteneği |
| Sıcaklık ölçeklendirme | "log parametreli tau" | CLIP, `log(1/tau)`'yi gradient'lerin davranacağı şekilde parametreleştirir; sıfıra yakın tau'ya çökmeyi önleyen klipsler |

## Daha Fazla Okuma

-[Radford ve ark. — Doğal Dil Denetiminden Aktarılabilir Görsel Modellerin Öğrenilmesi (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — CLIP makalesi.
- [Zhai ve ark. — Dil Görüntüsü Ön Eğitimi için Sigmoid Kaybı (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP.
- [Tschannen ve ark. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — çok dilli + NaFlex.
- [Jia ve diğerleri. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — gürültülü web verileriyle ölçeklendirme.
- [Cherti ve ark. — Karşılaştırmalı dil-görüntü öğrenimi için tekrarlanabilir ölçeklendirme yasaları (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — OpenCLIP ölçeklendirme yasaları.
