# Görsel Otoregresif Modelleme (VAR): Sonraki Ölçek Tahmini

> Difüzyon modelleri zaman içinde yinelemeli olarak örneklenir (gürültüden arındırma adımları). VAR ölçekte yinelemeli örnekleme yapar; her ölçek bir öncekine göre koşullandırılarak nihai çözünürlüğe kadar 1x1 token, ardından 2x2, ardından 4x4 tahmin eder. 2024 tarihli makale, VAR'ın görüntü oluşturma konusunda GPT tarzı ölçeklendirme yasalarını karşıladığını ve aynı işlem bütçesinde DiT'yi geride bıraktığını gösterdi. Bu ders temel mekanizmayı oluşturur.

**Tür:** Yapım
**Diller:** Python (PyTorch ile)
**Önkoşullar:** Aşama 7 Ders 03 (Çok Kafalı Dikkat), Aşama 8 Ders 06 (DDPM)
**Süre:** ~90 dakika

## Sorun

Otoregresif nesil, dil modellemeye hakim oldu çünkü tahmin edilebilir şekilde ölçekleniyordu: daha fazla hesaplama, daha fazla parametre, daha düşük karışıklık, daha iyi çıktılar. Görüntü oluşturmanın 2024'ten önce iki ana AR denemesi vardı: PixelRNN/PixelCNN (piksel piksel) ve DALL-E 1 / Parti / MuseGAN (VQ-VAE kodlarında token-by-token).

Her ikisi de nesil sırası probleminden muzdaripti. Pikseller ve token'lar 2 boyutlu bir ızgarada düzenlenir, ancak AR modelinin bunları 1 boyutlu tarama sırasına göre ziyaret etmesi gerekir. Erken köşe pikselinin görüntünün sonunda ne olacağı hakkında hiçbir fikri yoktur. Üretim kalitesi, metin üzerinde GPT'den daha kötü ölçeklendi ve eşleşen bilgi işlemde hiçbir zaman yayılma modeli kalitesine ulaşmadı.

VAR, üretileni değiştirerek üretim sırası sorununu çözer. VAR, token görüntülerini uzayda tek tek tahmin etmek yerine, artan çözünürlüklerde görüntünün tamamını tahmin eder. Adım 1: 1x1 token (genel görüntü "özeti") tahmin edin. Adım 2: token'lerden (daha kaba özellikler) oluşan 2x2'lik bir ızgarayı tahmin edin. Adım 3: 4x4'lük bir ızgarayı tahmin edin. Adım K: son (H/8)x(W/8) karesini tahmin edin.

Her ölçek önceki tüm ölçeklere (nedensel olarak "ölçek sırasına" göre) katılır ve kendi ölçeği içinde paraleldir. Sıralama sorunu ortadan kalkar: k ölçeğindeki görüntünün tamamı bir transformer geçişte üretilir.

## Konsept

### VQ-VAE Çok Ölçekli Tokenizer

VAR'ın **çok ölçekli ayrık bir tokenizer**'ye ihtiyacı vardır. Bir x görüntüsü için, giderek daha yüksek çözünürlüklü token ızgaralardan oluşan bir dizi üretir:

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

Her z_k aynı kod kitabını kullanır (tipik boyut 4096-16384). Her ölçekteki tokenizasyon bağımsız değildir; her ölçekte artıkların toplanması f'yi yeniden oluşturacak şekilde eğitilmiştir:

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

Bu **artık VQ** çeşididir. Ölçek k, 1..k-1'in kaçırdığı ölçekleri yakalar. Kod çözücü tüm embedding ölçeklerinin toplamını alır ve görüntüyü üretir.

Çok ölçekli VQ tokenizer bir kez eğitilir (VQGAN gibi) ve sonra dondurulur. Tüm üretken iş, üstteki otoregresif model tarafından yapılır.

### Sonraki Ölçek Tahmini

Üretken model, önceki tüm ölçeklerdeki token'leri gören ve bir sonraki ölçekteki token'leri tahmin eden bir transformer'dır.

Giriş sırası yapısı:
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

Konum embedding'lar hem ölçek indeksini hem de ölçek içindeki uzamsal konumu kodlar. Dikkat ölçek sırasına göre nedenseldir: k ölçeğinde token, konum (i, j), 1..k ölçeğindeki tüm token'lere ve kullanılan ölçek içi sıralamada daha önce gelen k ölçeğindeki token'lere katılabilir (VAR, ölçek içi nedensellik olmadan sabit konumsal dikkat kullanır - bir ölçek içindeki tüm konumlar paralel olarak tahmin edilir).

Eğitim kaybı: her k ölçeğinde, önceki tüm ölçek token'lere göre tokens z_k'yi tahmin edin. Ayrık VQ kodlarında çapraz entropi kaybı. "Sıranın" artık ölçek yapılı olması dışında GPT ile aynı yapı.

### Nesil

inference konumunda:
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

K = 10 ölçek için üretim 10 transformer ileri geçiştir. Her geçiş kendi ölçeğinin tamamını paralel olarak üretir; bir ölçek içinde per-token otoregresyonu yoktur. 256x256'lık bir görüntü için bu, DiT'nin 28-50'sine karşılık kabaca 10 geçiştir.

### Neden Sonraki Ölçek Sonraki-Token'e Karşı Kazanıyor?

Üç yapısal galibiyet:
1. **Kabadan inceye, doğal görüntü istatistikleriyle hizalanır.** İnsanın görsel algısı ve görüntü dataset'lerin her ikisi de ölçeğe bağlı düzenlilikler sergiler: düşük frekanslı yapı sabit ve öngörülebilirdir; yüksek frekanslı ayrıntı düşük frekanslı içeriğe bağlıdır. Bir sonraki ölçek tahmini bundan yararlanır.
2. **Ölçek içinde paralel oluşturma.** GPT tarzı token AR'den farklı olarak VAR, tüm token'leri tek adımda belirli bir ölçekte üretir. Etkili nesil uzunluğu doğrusal yerine log ölçeğindedir.
3. **Üretim sırası sapması yok.** k ölçeğindeki Token'ler k-1 ölçeğinin tamamına bakın; erken token'leri geç bağlam mevcut olmadan işlemeye zorlayan "soldan" veya "yukarıdan" önyargısı yoktur.

### Ölçekleme Yasası

Tian ve diğerleri. VAR'ın, tıpkı GPT'nin şaşkınlık için yaptığı gibi, ImageNet'te FID için güç yasası ölçeklendirme eğrisini takip ettiğini gösterdi. Parametreleri iki katına çıkarmak veya hesaplamak, hatayı güvenilir bir şekilde yarıya indirir. Bu, bu tür ölçeklendirme davranışını dil modelleri kadar net bir şekilde sergileyen ilk görüntü üretici modeldi. Sonuç olarak, VAR ölçeğindeki tahminler, mimari başına ampirik tahminler yerine hesaplama yoluyla tahmin edilebilir hale gelir.

### Difüzyonla İlişki

VAR ve yayılma aynı veri sıkıştırma hikayesini paylaşıyor: her ikisi de üretim problemini bir dizi daha kolay alt problemlere bölüyor.

- Yayılma: yavaş yavaş gürültü ekleyin, bir adımı geri almayı öğrenin.
- VAR: yavaş yavaş çözünürlük ekleyin, bir sonraki ölçeği tahmin etmeyi öğrenin.

Bunlar problemin farklı eksenleridir. Her ikisi de izlenebilir koşullu dağılımlar sağlar. Deneysel olarak VAR, inference'da daha hızlıdır (daha az geçiş, bir ölçek dahilinde hepsi paralel) ve sınıf-koşullu ImageNet'te DiT ile eşleşir veya onu yener. Metin koşullu VAR (VARclip, HART) aktif bir araştırma yönüdür.

## İnşa Et

`code/main.py`'da şunları yapacaksınız:
1. Sentetik "görüntü" verileri (2D Gauss halkaları) üzerinde küçük bir **çok ölçekli VQ tokenizer** oluşturun.
2. token'leri sonraki ölçekte tahmin etmek için **VAR tarzı bir transformer** eğitin.
3. transformer'yı 4 kez (4 ölçek) çağırıp kod çözerek örnekleyin.
4. Ölçek sıralı eğitimin bir ölçek içinde paralel üretim yaptığını doğrulayın.

Bu bir oyuncak uygulamasıdır. Önemli olan, ölçek yapılandırılmış dikkat maskesinin ve ölçek içi paralel neslin gerçekten işe yaradığını görmektir.

## Gönderin

Bu ders, çok ölçekli bir tokenizer tasarlama becerisi olan `outputs/skill-var-tokenizer-designer.md`'yi üretir: ölçek sayısı, ölçek oranları, kod kitabı boyutu, artık paylaşımı, kod çözücü mimarisi.

## Egzersizler

1. **Ölçek sayımı ablasyonu.** VAR'ı 4, 6, 8, 10 ölçekle eğitin. Otoregresif geçişlerin sayısı ile yeniden yapılandırma kalitesini ölçün. Daha fazla ölçek = daha ince artıklar = daha iyi kalite ancak daha fazla geçiş.

2. **Kod kitabı boyutu.** tokenizer'ları kod kitabı boyutları 512, 4096, 16384 ile eğitin. Daha büyük kod kitapları daha iyi yeniden yapılandırma sağlar ancak daha zor tahmin sağlar. Dizini bul.

3. **Ölçek içi paralellik kontrolü.** Eğitimli bir VAR için dikkat modelini açıkça ölçün. K ölçeğinde, model ölçekler arası konumlara katılıyor ancak ölçek içi konumlara katılmıyor mu? Maske uygulamasını doğrulayın.

4. **VAR ve DiT ölçeklendirmesi.** Aynı ImageNet sınıfı koşullu görevi için, VAR ve DiT'yi eşleşen parametre bütçelerinde (e.g., 33M, 130M, 458M) eğitin. FID ile hesaplamanın grafiğini çizin. VAR, her boyutta DiT'nin önüne geçmeli ve makalenin sonucunu küçük ölçekte yeniden üretmelidir.

5. **Metin koşullandırma.** adaLN aracılığıyla ekstra koşullandırma girişi olarak bir embedding metnini (CLIP havuzlanmış) alacak şekilde VAR'ı genişletin. Bu HART'ın tarifi. FID, metne hizalanmış örneklemeyi ne kadar geliştirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| VAR | "Görsel Otomatik Gerilemeli" | VQ token ızgaralarından oluşan bir piramit üzerinden sonraki ölçek tahminine göre görüntü oluşturma |
| Sonraki ölçekli tahmin | "Daha kaba, daha sonra daha ince tahmin edin" | Model, önceki tüm ölçeklerde koşullandırma yaparak, artan çözünürlük ölçeklerinde token'leri tahmin eder |
| Çok ölçekli VQ tokenizer | "Artık VQ" | Tüm ölçekleri toplayan kod çözücüyle birlikte artan çözünürlükte K token ızgara üreten VQ-VAE |
| Ölçek k | "Piramit seviyesi k" | K=1'de 1x1'den k=K'da (H/p)x(W/p)'ye kadar K çözünürlük düzeylerinden biri |
| Paralel ölçek içi | "Ölçek başına bir ileri" | k ölçeğindeki tüm token'ler, otoregresif olarak değil, tek bir transformer geçişte tahmin edilir |
| Ölçekler arası nedensellik | "Ölçek sıralı dikkat" | k ölçeğindeki Token, 1..k ölçeklerinin tümüne katılabilir ancak k+1..K ölçeklerine katılamaz |
| Artık VQ | "Ek tokenizasyon" | Her ölçeğin token'leri, daha düşük ölçeklerin bıraktığı artığı kodlar; kod çözücü tüm ölçek embedding'leri toplar |
| VAR ölçeklendirme kanunu | "Resim GPT ölçeklendirmesi" | FID, dil modellerinin karmaşıklığı gibi bilgi işlemde öngörülebilir bir güç yasasını izler |
| HART | "Hibrit VAR + metin" | MaskGIT tarzı yinelemeli kod çözmeyi VAR'ın ölçek yapısıyla birleştiren metin koşullu VAR çeşidi |
| Ölçek konumu embedding | "(ölçek, satır, sütun) üçlü" | Konumsal kodlama, ölçek içinde hem ölçek indeksini hem de uzaysal koordinatları taşır |

## Daha Fazla Okuma

- [Tian ve diğerleri, 2024 — "Görsel Otoregresif Modelleme: Sonraki Ölçek Tahmini Yoluyla Ölçeklenebilir Görüntü Oluşturma"](https://arxiv.org/abs/2404.02905) — VAR belgesi, kanonik referans
- [Peebles ve Xie, 2022 — "Transformers ile Ölçeklenebilir Difüzyon Modelleri"](https://arxiv.org/abs/2212.09748) — DiT, difüzyon karşılaştırma temeli
- [Esser ve diğerleri, 2021 — "Yüksek Çözünürlüklü Görüntü Sentezi için Transformer'leri Ehlileştirmek"](https://arxiv.org/abs/2012.09841) — VQGAN, tokenizer ailesi VAR'ın çok ölçekli tokenizer kapsamını genişletiyor
- [van den Oord ve diğerleri, 2017 — "Nöral Ayrık Temsil Öğrenimi"](https://arxiv.org/abs/1711.00937) — VQ-VAE, ayrık görüntü tokenleştirmenin temeli
- [Tang ve diğerleri, 2024 — "HART: Hibrit Otoregresif Transformer ile Verimli Görsel Üretim"](https://arxiv.org/abs/2410.10812) — metin koşullu VAR
