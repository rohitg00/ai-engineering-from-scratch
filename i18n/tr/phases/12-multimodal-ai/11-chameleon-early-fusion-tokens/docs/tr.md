# Sadece Kameleon ve Erken Füzyon Token-Only Multimodal Modeller

> Şimdiye kadar gördüğümüz her VLM'de görüntü ve metin ayrı kalıyor. Görsel tokenler bir görme kodlayıcısından gelir, bir projektorun içine akıyor, sonra LLM içinde metin buluyorlar. Görme ve metin sözlükleri asla üst üste geçmez. Chameleon (Meta, Mayıs 2024) sordu: Ya yaparlarsa? Bir resmini paylaşılmış bir kelime kaynağından ayrı bir token dizisine dönüştüren bir VQ-VAE eğit. Her multimodal belge şimdi tek bir dizi  metin işaretleri ve görüntü işaretleri birbirine karışmış, tek bir autoregressive kaybı. Yan etkisi: model, tek bir sonuç çağrısında değişen metin ve görüntü belirtilerini  karışık modalite çıkışları oluşturabilir. Bu ders erken bir birleşme tezini okuyor ve bir oyuncak versiyonu sonuna kadar inşa ediyor.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Paylaşılan kelime birikimi + tek kayıpın neden modelin yapabileceği şeyi değiştirdiğini açıklayın.
- Bir VQ-VAE'nin bir transformerin bir sonraki belirtilmiş hedefiyle uyumlu bir ayrı bir dizine bir görüntüyi nasıl işaretlediğini açıklayın.
- Chameleon'un eğitim ve istikrar hilelerini isimlendirin: QK-Norm, bırakma yerleştirme, LayerNorm siparişleri.
- Chameleon vs BLIP-2'in Q-Former yaklaşımını karşılaştırın ve her biri doğru seçim olduğunda açıklayın.

## Sorun

Adaptör tabanlı VLM'ler (LLaVA, BLIP-2, Qwen-VL) metin ve görüntüyi iki farklı şey olarak değerlendirir.`embed(text_token)`Bir görüntü geçer .`visual_encoder(image) → projector → ... pseudo_tokens`Modelin iki giriş yolu var.

Üç sonuç:

1. LLM sadece görüntü tüketir, yayınlamaz.
2. Karışık modalite belgeleri (bir makalede olduğu gibi alternatif paragraflar ve görüntüler) garip  ya model dışında ya da zincir nesillerinde multimodal girişleri analiz edersiniz.
3. Distribüsiyonal eşleşme eksikliği. Görsel jetonlar ve metin jetonları gizli alanın farklı bölgelerinde yaşar ve ince bir uyum sorunları yaratır.

Chameleon, bu önyargıyı reddediyor: görüntüler, paylaşılmış bir sözlükten ayrı bir token sekanslarıdır. Modelli birbirine karışmış belgelere uygulayın, bir kayıp, bir autoregressive decoder ve karışık modalite üretimini ücretsiz olarak açarsınız.

## Anlaşım

### VQ-VAE görüntü simgeselcisi olarak

Tokenizer, vektörlü kuantitasyonlu bir otomatik kodlayıcıdır.

- Kodlayıcı: CNN + ViT görüntüyi bir uzay özellik haritasına haritası yapan, dim 256'nin 32x32 özelliklerini söyleyin.
- Kod kitabı: K vektörlerinin öğrenilmiş bir kelime kaynağı (Chameleon 8192 kullanır), aynı zamanda 256'yi de zayıflatır.
- Kvantisa: her alan özelliği için, L2 mesafe ile en yakın kod defteri girişini arayın. Sürekli özelliği tam sayı endeksi ile değiştirin.
- Çözücü: CNN'de kuantistik özellikler pixel olarak geri götürülür.

Eğitim: VAE yeniden yapılandırma kaybı + bağlılık kaybı + kod defteri kaybı.

Chameleon için: bir görüntü 32*32 = 1024 simge olur. Bu simge kimliklerini metin BPE simgelerinin aynı kimlik alanına koyun. Chameleon'un tek simgeci 65,536 giriş vardır ve bu sayıya zaten 8192 görüntü kodları ve görüntü ayırıcıları gibi özel simgeler dahil. Transformatör bir dizi, bir kaybı görür.

### Paylaşılan kelime birikimi

Chameleon'un kelime birikimi metin jetonları, görüntü jetonları ve modalite ayırıcılarını birleştirir. Her jeton tek bir kimliğe sahiptir. Giriş yerleştirme katmanı her kimliği bir D-dim gizli vektörüne haritası yapar. Çıkış projeksiyonu sözcük logitlerine geri gizlenir. Softmax, bir sonraki jetonu seçer.

Ayrıcılar önemli: `<image>`ve `</image>`Etiketler görüntü belirtilen dizini destekler.`<image>`, aşağı akımlı yazılım, önümüzdeki 1024 tokeni pixel gösterimi için dekodere göndermek için VQ indeksleri olduğunu biliyor.

### Karışık modalite üretim

İndirim, paylaşılmış kelimeforumunda bir sonraki belirti tahminidir. Örnek istek: "Bir kedi çiz ve onu tanımla".

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

Model, sırayı kendiliğinden seçer.  görüntü, sonra metin, metin, sonra görüntü veya ara bırakma üretebilir. Aynı dekodör, aynı kaybı.

Sadece metin üretilen adapter VLM'lerle karşılaştırın.

### Eğitim istikrarı  QK-Norm, bırakma, LayerNorm sipariş

Erken füzyon eğitimi ölçeğinde dengesiz.

- QK-Norm. LayerNorm'u nokta ürünü öncesinde dikkat içindeki sorgu ve anahtar projeksiyonlarına uygulayın.
- Arıza ve MLP'den sonra değil, her kalan eklemeden sonra bırakın.
- LayerNorm düzenleme. Geri kalan dalda (standard) öncesi LN, son blokun atış bağlantısında ek bir LN. Son katman gradient akışını istikrarlı kılar.

Bu hileler olmadan 34B-param kameleon eğitimi birden fazla kontrol noktasında farklılaşmış ve onlarla birleşti.

### Tokenizer'in yeniden inşaat tavanı

VQ-VAE kayblıdır. 8192 kod defteri girişinde ve 512x512 görüntü başına 1024 token'de, yeniden yapılandırma PSNR kaplamaları 26-28 dB civarında. Bu tanınabilir görüntü gen için yeterli ama sürekli uzay difüzyonundan görünüşe göre daha kötüdür (Stable Diffusion 3 32+ dB'ye ulaşır).

Tokenizer, şişe boğazıdır. Daha iyi tokenizerler (MAGVIT-v2, IBQ, SBER-MoVQGAN) tavanı kaldırır. Emu3 (Desin 12.12) yalnızca daha iyi tokenizer aracılığıyla SDXL kalitesi üretimini sağlar.

### Kameleon vs BLIP-2 / LLaVA

Kameleon (erken birleşme, ortak kelime):
- Bir kayıp, bir dekoder.
- Karışık modalite çıkışı üretir.
- Tokenizer kalite tavanıdır.
- Pahalı: VQ-VAE dekodörü, sonuç yolu üzerinde üretilen görüntü başına.

BLIP-2 / LLaVA (son birleştirme, ayrı kuleler):
- Görüş içeri, mesaj sadece.
- Ön eğitimli LLM'yi tekrar kullanıyor.
- Anlamak için tokenizer boğazı yok.
- Ucuz: tek ileri geçiş.

Eğer görüntü üretimi, Chameleon ailesine ihtiyacınız varsa, sadece anlayış istiyorsanız, adapter-VLM daha basit ve daha önceden eğitilmiş hesaplama kullanır.

### Fuyu ve AnyGPT

Fuyu (Adept, 2023) ilgili bir yaklaşımdır: ayrı görme kodlayıcısını tamamen atlayın, LLM'nin giriş projesi yoluyla ham görüntü yamalarını tıkınlar gibi besleyin, tıkınlayıcı yok.

AnyGPT (Zhan et al., 2024) Cameleon'u dört modaya genişletiyor: metin, görüntü, konuşma, müzik. Her biri için aynı VQ-VAE hilesi, paylaşılan dönüştürücü. Herhangi bir nesle.

```figure
vq-codebook
```

## Kullan

`code/main.py`Oyuncakların sonundan sonuna erken bir birleşim modeli oluşturur:

- 8x8 patchleri kod defteri indekslerine (K=16) haritası yapan küçük bir VQ-VAE tarzı kuantitör.
- Paylaşılan bir kelime birikimi (metin kimlikleri 0..31) + (resim kimlikleri 32..47) + (paylayıcılar 48, 49).
- Sintez başlık + görüntü-töken diziler üzerinde eğitilmiş bir oyuncak autoregressive decoder (bigram tablosu).
- Bir istek verildiğinde alternatif metin + görüntü belirtilerini yayılan örnekleme döngüsü.

Kod kasıtlı olarak transformatörü küçük tutar (bigramlar) böylece sinyal akışını sonundan sonuna kadar takip edebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-tokenizer-vs-adapter-picker.md`. Ürün özelliklerini göz önüne alarak (tek anlamak vs. anlamak + oluşturmak, gerekli görüntü kalitesi, maliyet bütçesi) Chameleon-familie (erkek füzyon) ve LLaVA-familie (kenak füzyon) arasında seçim yaparak, kuantitatif kurallarla haklı çıkar.

## Egzersizler

1. Chameleon, 512x512 görüntü başına K=8192 kod defteri girişlerini ve 1024 jetonu kullanır.

2. Aynı VQ-VAE yoğunluğundaki 4K görüntü (3840x2160) kaç görüntü belirti üretir? Bir Chameleon tarzı modeli bir sonuç çağrısında 4K görüntü oluşturabilir mi?

3. Temiz Python'da QK-Norm uygulamak. 64 boyutlu bir sorgu ve anahtar verildiğinde, LayerNorm'den önce ve sonra nokta ürünü göster. Büyüklük kontrolü derinliklerde neden önemlidir?

4. "Chameleon" Bölümü 2.3'i okuyun. 34B'de QK-Norm olmadan gözlemlenen kağıtın tam başarısızlık modunu açıklayın. "Norma patlaması" imzası neydi?

5. Oyuncak dekodörünü sadece metin istekleri verildiğinde karışık bir modaliyetli bir yanıt yayınlamak için genişlet. Modelin önce görüntü vs. önce metin seçtiğini ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Daha Fazla Okumak

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
