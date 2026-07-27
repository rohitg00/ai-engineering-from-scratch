# Bukalemun ve Early Fusion Token-Yalnızca Multimodal Modeller

> Şu ana kadar gördüğümüz her VLM, görselleri ve metni ayrı tutuyor. Görsel token'ler bir görüntü kodlayıcıdan gelir, bir projektöre akar ve ardından LLM içindeki metinle buluşur. Vizyon ve metin sözcükleri hiçbir zaman örtüşmez. Bukalemun (Meta, Mayıs 2024) sordu: Ya yapsalardı? Bir görüntüyü, paylaşılan bir kelime dağarcığından ayrık token dizilerine dönüştüren bir VQ-VAE eğitin. Her çok modlu belge artık tek bir diziden oluşuyor; metin token'ler ve görüntü token'ler serpiştirilmiş, tek bir otoregresif kayıp. Yan etki: Model, tek bir inference çağrısında alternatif metin ve resim token'ler içeren karma modlu çıktılar üretebilir. Bu derste early fusion tezi okunur ve uçtan uca bir oyuncak versiyonu oluşturulur.

**Tür:** Yapım
**Diller:** Python (stdlib, VQ-VAE tokenizer + aralıklı kod çözücü)
**Önkoşullar:** Aşama 12 · 05, Aşama 8 (Üretici Yapay Zeka)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Paylaşılan bir kelime dağarcığının + tek kaybın neden modelin yapabileceklerini değiştirdiğini açıklayın.
- Bir VQ-VAE'nin tokenbir görüntüyü, transformer'nin sonraki-token hedefiyle uyumlu ayrık bir diziye nasıl dönüştürdüğünü açıklayın.
- Chameleon'un eğitim stabilitesi püf noktalarını adlandırın: QK-Norm, bırakma yerleştirme, LayerNorm sıralaması.
- Chameleon ile BLIP-2'nin Q-Former yaklaşımını karşılaştırın ve her birinin ne zaman doğru seçim olduğunu açıklayın.

## Sorun

Bağdaştırıcı tabanlı VLM'ler (LLaVA, BLIP-2, Qwen-VL) metin ve görüntüyü iki farklı şey olarak ele alır. token metni `embed(text_token)` üzerinden geçer; bir görüntü `visual_encoder(image) → projector → ... pseudo_tokens` üzerinden geçiyor. Modelin kısmen birleşen iki giriş yolu vardır.

Üç sonuç:

1. Yüksek Lisans yalnızca görüntüleri tüketebilir, yayınlayamaz. Çıktı yalnızca metindir.
2. Karma modlu belgeler (bir makalede olduğu gibi değişen paragraflar ve resimler) tuhaftır; ya çok modlu girişi modelin dışında ayrıştırırsınız ya da nesilleri zincirlersiniz.
3. Dağıtım uyumsuzluğu. Görsel token'ler ve metin token'ler, gizli alanın farklı bölgelerinde bulunur ve ince hizalama sorunları yaratır.

Chameleon bu önermeyi reddediyor: görseller yalnızca paylaşılan bir kelime dağarcığından ayrık token dizileridir. Modeli aralıklı belgeler, bir kayıp, bir otoregresif kod çözücü üzerinde eğitin ve karma mod oluşturmanın kilidini ücretsiz olarak açın.

## Konsept

### VQ-VAE resim olarak tokenizer

tokenizer, vektör nicemli değişken bir otomatik kodlayıcıdır. Mimari:

- Kodlayıcı: Görüntüyü mekansal bir özellik haritasına eşleyen CNN + ViT, örneğin dim 256'nın 32x32 özellikleri.
- Kod Kitabı: K vektörlerinin öğrenilmiş bir sözlüğü (Chameleon 8192 kullanır), ayrıca dim 256.
- Niceleme: her uzamsal özellik için, L2 mesafesine göre en yakın kod kitabı girişine bakın. Sürekli özelliğini tamsayı indeksiyle değiştirin.
- Kod Çözücü: Nicelenmiş özellikleri piksellere geri götüren CNN.

Eğitim: VAE yeniden yapılandırma kaybı + taahhüt kaybı + kod kitabı kaybı. Kod kitabı endeksleri görüntüler için ayrı bir alfabe oluşturur.

Bukalemun için: bir görüntü, 8192 kelime dağarcığından alınmış 32*32 = 1024 tokens olur. Metin tokens (LLM'nin BPE sözlüğünden, örneğin 32000) ile birleştirin. Son sözcük dağarcığı: 40192. transformer bir dizi, bir kayıp görüyor.

### Paylaşılan kelime dağarcığı

Chameleon'un sözcük dağarcığı metin token'leri, görüntü token'leri ve kiplik ayırıcıları birleştirir. Her token'nin tek bir kimliği vardır. Giriş embedding katmanı, her kimliği bir D-dim gizli vektöre eşler. Çıktı projeksiyonu, kelime logitlerine gizlenmiş eşlemelerdir. Softmax, yöntem ne olursa olsun sonraki token'yi seçer.

Ayırıcılar önemlidir: `<image>` ve `</image>` etiketleri, image-token dizisini parantez içine alır. Üretim zamanında, eğer model `<image>` yayarsa, downstream yazılımı sonraki 1024 token'nin piksel oluşturma için kod çözücüye gönderilecek VQ endeksleri olduğunu bilir.

### Karma yöntem üretimi

Inference, paylaşılan sözlükteki sonraki-token tahmindir. Örnek prompt: "Bir kedi çizin ve onu tanımlayın." Bukalemun yayar:

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

Model, sırayı bağımsız olarak seçer; önce görüntü, ardından metin, metin, ardından görüntü veya ara sayfa üretebilir. Aynı kod çözücü, aynı kayıp.

Oluşturmanın salt metin olduğu adaptör VLM'leriyle karşılaştırın. Chameleon, model çıktı yöntemleri sorununu yeniden gündeme getiriyor.

### Eğitim kararlılığı — QK-Norm, bırakma, LayerNorm sıralaması

Early fusion eğitimi ölçekte istikrarsızdır. Chameleon'un makalesi üç hileyi belgeliyor:

- QK-Normu. Nokta çarpımdan önce, ilgi içindeki sorguya ve anahtar projeksiyonlara LayerNorm'u uygulayın. Derinlikte logit büyüklüğünde patlamayı önler. 2024 sonrası birden fazla büyük model tarafından kullanılır.
- Bırakma yerleşimi. Sadece dikkat ve MLP'den sonra değil, her arta kalan eklemeden sonra bırakma. token görüntüsünden gradient'lar baskın olabildiğinde daha fazla düzenleme gerekir.
- LayerNorm sıralaması. Artık dalda (standart) ön LN artı son bloğun atlama bağlantısında ekstra bir LN. Son katman gradient akışını stabilize eder.

Bu hileler olmadan, 34B-paramlı Chameleon eğitimi birçok kontrol noktasında farklılık gösteriyordu. Onlarla birleşir. Mimarlık kadar eğitim reçetesinin de katkısı var.

### tokenizer'nin yeniden inşa tavanı

VQ-VAE kayıplıdır. 8192 kod kitabı girişi ve 512x512 görüntü başına 1024 tokens ile yeniden yapılanma PSNR'si 26-28 dB civarında sınırlanıyor. Bu, tanınabilir görüntü üretimi için yeterlidir ancak sürekli alan difüzyonundan gözle görülür şekilde daha kötüdür (Stabil Difüzyon 3, 32+ dB'ye ulaşır).

tokenizer darboğazdır. Daha iyi tokenizer'ler (MAGVIT-v2, IBQ, SBER-MoVQGAN) tavanı kaldırıyor. Emu3 (Ders 12.12), yalnızca daha iyi bir tokenizer aracılığıyla SDXL kalitesinde üretime ulaşır.

### Bukalemun vs BLIP-2 / LLaVA

Bukalemun (early fusion, paylaşılan kelime bilgisi):
- Bir kayıp, bir kod çözücü.
- Karışık modlu çıktı üretir.
- Tokenizer kalite tavanıdır.
- Pahalı: inference yolunda oluşturulan görüntü başına VQ-VAE kod çözücü.

BLIP-2 / LLaVA (late fusion, ayrı kuleler):
- Görüş girişi, yalnızca metin çıkışı.
- Önceden eğitilmiş LLM'yi yeniden kullanır.
- Anlamak için tokenizer darboğaz yok.
- Ucuz: tek ileri geçiş.

Göreve göre seç. İmaj oluşturmaya ihtiyacınız varsa Chameleon ailesi. Yalnızca anlamaya ihtiyacınız varsa, adaptör-VLM daha basittir ve daha fazla önceden eğitilmiş bilgi işlemi yeniden kullanır.

### Fuyu ve AnyGPT

Fuyu (Adept, 2023) ilgili bir yaklaşımdır: ayrı görüntü kodlayıcıyı tamamen atlayın, ham görüntü yamalarını LLM'nin giriş projeksiyonu aracılığıyla sanki token'lermiş gibi besleyin, tokenizer yok. Chameleon'dan daha basittir ve paylaşılan sözcük çıktısı oluşturma özelliğini kaybeder.

AnyGPT (Zhan ve diğerleri, 2024), Chameleon'u dört modaliteye genişletir: metin, görüntü, konuşma, müzik. Her biri için aynı VQ-VAE numarası, paylaşılan transformer. Herhangi bir nesilden herhangi bir nesile. Daha fazlasını Ders 12.16'da ele aldık.

## Kullan onu

`code/main.py` oyuncak, uçtan uca bir early fusion modeli oluşturuyor:

- 8x8 yamayı kod kitabı indekslerine (K=16) eşleyen küçük bir VQ-VAE tarzı niceleyici.
- (metin kimlikleri 0..31) + (resim kimlikleri 32..47) + (ayırıcılar 48, 49) şeklinde paylaşılan bir kelime dağarcığı.
- Sentetik altyazılar + resim-token dizileri üzerine eğitilmiş bir oyuncak otoregresif kod çözücü (bigram tablosu).
- prompt verilen alternatif metin + resim token'leri yayan örnekleme döngüsü.

Kod kasıtlı olarak transformer küçücük (bigram) tutar, böylece sinyal akışını uçtan uca takip edebilirsiniz.

## Gönderin

Bu ders `outputs/skill-tokenizer-vs-adapter-picker.md` üretir. Bir ürün spesifikasyonu verildiğinde (yalnızca anlama ve anlama + oluşturma, gerekli görüntü kalitesi, maliyet bütçesi), Chameleon ailesi (early fusion) ile LLaVA ailesi (late fusion) arasında seçim yapar ve temel niceliksel kurallarla gerekçelendirir.

## Egzersizler

1. Bukalemun, 512x512 görüntü başına K=8192 kod kitabı girişi ve 1024 token kullanır. 24 bitlik bir RGB görüntüsüne göre sıkıştırma oranını tahmin edin. Kayıplı mı? Ne kadar kayıplı?

2. Aynı VQ-VAE yoğunluğundaki bir 4K görüntü (3840x2160) kaç tane görüntü tokens üretir? Bukalemun tarzı bir model tek bir inference çağrıda 4K görüntü oluşturabilir mi? İlk önce hangisi bozulur; bağlam mı, tokenizer kalitesi mi, yoksa KV önbelleği mi?

3. QK-Norm'u saf Python'a uygulayın. 64-dimlik bir sorgu ve anahtar verildiğinde, nokta çarpımı LayerNorm'dan önce ve sonra gösterin. Derinlikte büyüklük kontrolü neden önemlidir?

4. Antrenman stabilitesi ile ilgili Chameleon Bölüm 2.3'ü okuyun. Makalenin 34B'de QK-Norm olmadan gözlemlediği arıza modunu tam olarak açıklayın. "Norm patlaması" imzası neydi?

5. Oyuncak kod çözücüyü, yalnızca metinden oluşan bir prompt verilen karma modlu bir yanıt verecek şekilde genişletin. %60 metin öncelikli / %40 resim öncelikli eğitim verisi dağıtımına göre modelin önce görseli, önce metni ne sıklıkla seçtiğini ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Early fusion | "Birleşik token'ler" | Birinci adımdan itibaren transformer'nin kelime dağarcığını paylaşan ayrık token'lere dönüştürülen resimler |
| VQ-VAE | "Resim tokenizer" | Görüntüleri transformer'nin tahmin edebileceği tamsayı endeksleriyle eşleştiren CNN + ViT + kod kitabı |
| Paylaşılan kelime dağarcığı | "Bir sözlük" | Metin + resim + modalite ayırıcılarını kapsayan tek bir token kimlik alanı |
| QK-Normu | "Dikkat dengeleyici" | Sorgu ve anahtara nokta çarpımından önce uygulanan LayerNorm, norm patlamasını önler |
| Karma yöntem üretimi | "Metin + resim çıktısı" | Tek geçişte bağımsız olarak aralıklı metin ve görüntü token'ler üreten Inference |
| Kod kitabı boyutu | "K girişleri" | VQ-VAE'nin nicemleyebileceği ayrık vektörlerin sayısı; sadakat için sıkıştırma ticareti |
| Tokenizer tavan | "Yeniden yapılanma sınırı" | VQ token'ların kodunu çözerek elde edilebilecek en iyi PSNR; modelin görüntü kalitesini sınırlıyor |

## Daha Fazla Okuma

- [Bukalemun Takımı — Bukalemun: Karma Modlu Early Fusion Temel Modelleri (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan ve ark. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu ve ark. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan ve ark. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Usta — Fuyu-8B blogu (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
