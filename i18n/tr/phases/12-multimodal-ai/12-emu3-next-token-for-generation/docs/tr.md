# Emu3: Resim ve Video Yüklemesi İçin Sonraki Konuşulan Tahmin

> BAAI'nin Emu3 (Wang et al., Eylül 2024) yayılma karşı-autoregressive tartışmayı bitirecek olan 2024 sonucu. Tek bir Llama tarzı dekoder-tek dönüştürücü, sadece bir sonraki belirti-bunu tahmin amacıyla eğitilmiş, tek bir kelime birikimi üzerinden metin + VQ görüntü belirtiler + 3D VQ video belirtiler, görüntü üretimi SDXL ve algılama LLaVA-1.6 yener. Klip kaybı yok. Yayılma programı yok. Kalite için sonuca çıkarma için sınıflandırıcı dışı rehberlik kullanılır, ancak temel eğitim amacı öğretmen zorlama ile bir sonraki belirti tahminidir. Nature dergisinde yayınlandı. Bu ders Emu3 tezini okuyor  neden daha iyi bir tokenizer artı ölçek tüm ihtiyacınız  ve difüzyon yaklaşımlarıyla karşıt.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Emu3'ün tek kayıp bir sonraki belirti hedefi, görüntü kalitesi için yayılma gerekli olduğu uzun zamandır kabul edilen varsayıma rağmen neden işe yaradığını açıklayın.
- 3D video tokenizer'i açıklayın: uzay-zamanlı VQ kod defteri nasıl görünüyor, neden yamalar zaman geçirir.
- Emu3 vs. Stable Diffusion XL ile karşılaştırın (öğrenme hesaplama, sonucu çıkarma maliyeti, kalite tavanı).
- Aynı Emu3 modeli oynayan üç rolü isimlendirin: Emu3-Gen (resim gen), Emu3-Chat (görüş), Emu3-Stage2 (video gen).

## Sorun

2024 yılına kadar geleneksel bilgelik: görüntü üretimi yayılmaya ihtiyaç duyar. Dövüş: ayrı görüntü belirtileri ayrıntıları yeniden yapılandırmak için çok fazla bilgi kaybeder ve autoregressive örnekleme binlerce belirti boyunca hata biriktirir. Dall-E 3, Imagen, Midjourney, her biri bir çeşit difüzyon kullanıyor. Chameleon (Düşünme 12.11) bunu küçük ölçekte kısmen reddetti ancak kalitede SDXL ile eşleşmedi.

Emu3, argümanın önüne saldırdı. İddia: daha iyi görsel tokenizer + yeterli ölçek + sonraki token kaybı = algılama yapan aynı modelde difüzyon-beating görüntü üretimi.

Bahis yayınlandığında tartışmalıydı. İki yıl sonra, açık kaynaklı tek nesil ailesi (Emu3, Show-o, Janus-Pro, Transfusion) araştırma için varsayılan yoldur; üretim sınır modelleri bazı variantları kullanıyor gibi görünüyor.

## Anlaşım

### Emu3 Tokenizer

Ana bileşen görsel tokenizer. Emu3 bir token başına 8x8 çözünürlük azaltma ile özel IBQ sınıfı tokenizer (Inverse Bottleneck Quantizer, SBER-MoVQGAN ailesi) eğitir. 512x512 bir görüntü 64x64 = 4096 token kod defteri büyüklüğünde 32768 olur.

Bu, her iki eksede 512x512 başına 1024 simgelik simgelikten daha büyüktür: K=8192: simgelerin dört katı ve kod defteri dört katı büyüktür. Ekstra kapasite yeniden inşaat kalitesini satın alır. Anahtar ölçüm: yeniden inşaat PSNR 30,5 dB'de, Stable Diffusion'un sürekli gizli alanı 32 dB'de rekabetçi.

Video için: 3D VQ tokenizer bir uzay-zaman yamağını (4 çerçeve x 8x8 piksel) bir tamsayıya kodlar. 8 FPS'de 4s klipi 32 çerçeveye sahiptir; 8x uzaylı ve 4x zamanlı azaltma ile 256x256'da, token sayısı (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8,192 token.

Tokenizer kalitesi tavan. Emu3'ün katkı kısmen "çok iyi bir tokenizer eğittik".

### Tek Kayıp Eğitim

Emu3 bir hedef kullanır: metin jetonları, 2D görüntü jetonları ve 3D video jetonları arasında paylaşılan bir kelime birikimine bağlı bir sonraki jeton öngörümü.

Tren, bir karışım üzerinde:
- Resim gen: `<text caption> <image> image_tokens </image>`
- Resim algısı: `<image> image_tokens </image> <question> text_tokens`
- Video Gen: `<text caption> <video> video_tokens </video>`
- Video algısı: Analog.
- Tekst: Standart NTP.

Model, verilerin dağıtımından görüntü jetonları vs metin jetonları ne zaman yayılacağını öğrenir.`<image>`- Etiket.

### Sınıflandırıcı olmayan yönlendirme ve sıcaklık

Autoregressive görüntü oluşturma, sınıflandırıcısız rehberlik (CFG) ile sonuçlandırma sırasında çok daha iyi hale gelir. Emu3 onu kullanır: iki kez, bir kez tam başlık ile, bir kez boş başlık ile oluşturun, logitleri rehberlik ağırlığıyla karıştırın (tipik 3.0-7.0). Bu aynı CFG numara yayılması kullanımıdır, autoregressive ayarına ödünç alınmıştır.

Sıcaklık önemli: çok yüksek, eserler; çok düşük, mod çöküşü.

### Üç rol, bir model.

Emu3 gemileri, üç işlevsel olarak farklı API'de, ancak bir temel ağırlık seti olarak:

- Emu3-Gen. Resim oluşturma. Giriş metni, çıkış resim belirtileri.
- Emu3-Chat. VQA ve başlıklama. Giriş görüntü (token), çıkış metni.
- Emu3-Stage2. Video oluşturma ve video VQA. Giriş metni veya video, çıkış metni veya video.

Görev özel başlık yok, farklı istek şablonları, aynı kontrol noktası.

### Önyargılar

Emu3 makalesinden (Ecuba 2024):

- Resim üretimi: MJHQ-30K FID (5.4 vs 5.6) üzerinde SDXL'i yener, GenEval genel olarak (0.54 vs 0.55  istatistiksel denge) ve Deep-Eval'in bileşik eşdeğerini.
- Resim algısı: VQAv2 (75.1 vs 81.8) ve MMMU (31.6 vs 35.1) üzerinde LLaVA-1.6 izler, ancak SEED-Bench, OCRBench ve ChartQA'da yener.
- Video üretimi: 4 saniyelik video kalitesi, Sora çağının kamuoyuna göre standartlaştırılmış modelleri ile rekabetçi FVD'de.

Sayılar her zaman kazanmıyor  Emu3 burada bir noktayı bir noktaya karşı tutar  ama "sonraki jeton tahmininin tek ihtiyacı olan şey" iddiası, modaliteler arasında savunulabilir.

### Hesaplama maliyeti

Emu3 8B parametre modelidir. Kağıt GPU saat toplamını yayınlamıyor; ölçek için Llama-2-7B öncesi eğitim yaklaşık 184k A100 GPU saat, yaklaşık 21 GPU-yıl kullanıyor.

Sonuç olarak, Emu3 görüntü başına SDXL'den daha yavaş: 30 tok/s'de 4096 görüntü jetonu, 512x512 görüntü başına ~ 2 dakika, SDXL için 2-5 saniye. Speküel çözme ve KV-cache optimizasyonu boşluğu daraltır, ancak kapatmaz. Autoregressive görüntü gen hesaplama ağırdır; bu daimi pazarlama.

### Neden önemli?

Emu3'ün derin katkı konseptaldir. Eğer bir sonraki belirti tahmininin görüntü üretimi üzerinde yayılma ile eşleşmesi için ölçekleri varsa, tek bir model yolu (bir kayb, bir omurgan, herhangi bir modalik) uygulanabilirdir. Gelecek modeller ayrı metin kodlayıcılarına, ayrı yayılma programcılarına, ayrı VAE'lere ihtiyaç duymaz.

Show-o, Janus-Pro ve InternVL-U, tümü bu tez üzerinde inşa ediyor veya meydan okuyor. Çin laboratuvarları (BAAI, DeepSeek) 2025 yılına kadar ABD laboratuvarlarından daha agresif bir şekilde bu yönde yayın yapıyor.

```figure
l5-emu3-next-token
```

## Kullan

`code/main.py`İki oyuncak parça yapar:

- 2D vs 3D VQ tokenizer sayım hesaplayıcı: verilen ( çözünürlük, yama, clip_length, FPS), hesaplama simgelerinin görüntü vs. video sayıları.
- Sınıflandırıcı olmayan sıcaklık yönlendirici bir autoregressive image-token sampleler.

CFG uygulaması Emu3'ün reçetesine  şartlı ve koşulsuz logitleri bir rehberlik ağırlığı ile karıştırır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-token-gen-cost-analyzer.md`. Bir jenerasyon ürün özellikini (resim veya video, hedef çözünürlük, kalite seviyesini, gecikme bütçesini) göz önüne alarak, token sayısını, sonuç maliyetini hesaplar ve Emu3 ailesini yayılma karşısında seçer.

## Egzersizler

1. Emu3 512x512 görüntü başına 4096 token üretir. 8x8 azaltımıyla. 1024x1024 ve 2048x2048 için eşdeğer hesaplayın.

2. Emu3'ü video tokenizer'deki 3.3 bölümde okuyun. 3D VQ yama şeklini ve tek bir çerçeve yerine 4 çerçeve x 8x8 piksellik neden olduğunu açıklayın.

3. Sınıflandırıcısız rehberlik ağırlığı 5.0 vs 3.0: hangi görsel etki? Matematikleri izleyin `code/main.py`- Evet .

4. Emu3 (8B) için hesaplama eğitim FLOP'larını, 300B token olarak varsayılan bir değerle hesaplayın ve Stable Diffusion 3 ile karşılaştırın.

5. Emu3 FID'de SDXL'yi yener, ancak VQAv2 vs. uzmanlaşmış VLM'lerde değil.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## Daha Fazla Okumak

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
