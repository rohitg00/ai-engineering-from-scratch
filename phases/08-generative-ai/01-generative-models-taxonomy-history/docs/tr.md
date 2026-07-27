# Üretken Modeller — Taksonomi ve Tarih

> Her görüntü modeli, metin modeli, video modeli ve 3D model, beş gruptan birine sığar. Yanlış kovayı seçerseniz haftalarca matematikle mücadele edeceksiniz. Doğru olanı seçtiğinizde, alanın son on iki yıllık ilerlemesi kafanızda temiz bir şekilde birikir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 2 (ML Temelleri), Aşama 3 (Deep Learning Temel), Aşama 7 · 14 (Transformer)
**Süre:** ~45 dakika

## Sorun

Üretken bir model tek bir işi yapar: Bilinmeyen bir `p_data(x)` dağılımından alınan eğitim örnekleri verildiğinde, aynı dağılımdan gelmiş gibi görünen yeni örneklerin çıktısını alır. Yüzler, cümleler, MIDI dosyaları, protein yapıları; gözlerinizi kısarsanız hepsi aynı sorundur.

Buradaki sorun, `p_data`'nin milyonlarca boyuta sahip bir alanda yaşamasıdır (512x512 RGB görüntü ~786k boyuttur), örnekler bu alanın içindeki ince bir manifold üzerinde yer alır ve elinizde yalnızca 10 milyon örneğiniz vardır. Yoğunluğu kaba kuvvetle zorlamak umutsuz bir durumdur. Her üretken model, zor bir sorunu biraz daha az zor bir sorunla değiştiren bir uzlaşmadır.

Son on iki yılda beş aile hayatta kaldı. Her ailenin hangi uzlaşmayı yaptığını bilmek size neden bazı görevlerde kazandığını ve diğerlerinde çöktüğünü anlatır.

## Konsept

![Beş üretken model ailesi — modellediklerine göre sınıflandırma](../assets/taxonomy.svg)

**1. Açık yoğunluk, izlenebilir.** Gerçekten değerlendirebileceğiniz bir toplam olarak `log p(x)` yazın. Otoregresif modeller (PixelCNN, WaveNet, GPT) `p(x) = ∏ p(x_i | x_<i)`'yi çarpanlara ayırır. Normalleştirme akışları (RealNVP, Glow), `p(x)`'yi basit bir tabanın ters çevrilebilir dönüşümü olarak oluşturur. Artıları: kesin olasılık, temiz eğitim kaybı. Con: otoregresif inference sıralıdır (uzun diziler için yavaştır), akışlar ters çevrilebilir mimarilere ihtiyaç duyar (mimari olarak kısıtlayıcı).

**2. Açık yoğunluk, yaklaşık.** `log p(x)` alttan bağlanır (ELBO) ve sınırı optimize eder. VAE'ler (Kingma 2013), varyasyonel sonsala sahip bir kodlayıcı-kod çözücü kullanır. Difüzyon modelleri (DDPM, Ho 2020), ağırlıklı ELBO'yu dolaylı olarak optimize eden bir gürültü gidericiyi eğitir. Yayılma, 2026'nın baskın görüntü, video ve 3D omurgasıdır.

**3. Örtülü yoğunluk.** Yoğunluğu tamamen atlayın; Örnekler üreten `G(z)` oluşturucuyu ve gerçeği sahteden ayıran `D(x)` ayırıcıyı öğrenin. GAN'lar (Goodfellow 2014). inference'de hızlı (bir ileri pas) ancak antrenman sırasında dengesiz olduğu biliniyor. StyleGAN 1/2/3, 2026'da bile sabit alanlı fotogerçekçilik (yüzler, yatak odaları) için en gelişmiş teknolojiyi kullanmaya devam edecek.

**4. Puana dayalı / sürekli zaman.** `∇_x log p(x)` günlük yoğunluğunun (puan) gradient değerini doğrudan öğrenin. Song ve Ermon (2019), puan eşleştirmenin yayılımı bir SDE'ye genelleştirdiğini gösterdi. Akış eşleştirme (Lipman 2023) 2024-2026'nın en gözdesidir: simülasyonsuz eğitim, daha düz yollar, DDPM'den 4-10 kat daha hızlı örnekleme. Stabil Difüzyon 3, Flux, AudioCraft 2'nin tümü akış eşleştirmeyi kullanır.

**5. Ayrık kodlar üzerinde Token tabanlı otoregresif.** Yüksek loş verileri bir VQ-VAE veya artık niceleyiciyle kısa bir ayrık token dizisine sıkıştırın, ardından token dizisini modellemek için bir Transformer kullanın. Parti, MuseNet, AudioLM, VALL-E, Sora'nın yaması tokenizer bunu kullanıyor. Bu, 1. grup artı öğrenilmiş bir tokenizer'dir.

## Kısa bir tarih

| Yıl | Modeli | Neden önemliydi |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | Kullanılabilir eğitim kaybına sahip ilk derin üretken model. |
| 2014 | GAN (İyi arkadaş) | Örtük yoğunluk, olasılık yok; şaşırtıcı derecede keskin örnekler. |
| 2015 | ÇİZİM, PixelCNN | Sıralı görüntü oluşturma. |
| 2017 | Parıltı, RealNVP | Tersine çevrilebilir akışlar; derinlikle kesin olasılık. |
| 2017 | Aşamalı GAN | İlk megapiksel yüzler. |
| 2019 | StilGAN / StilGAN2 | Bu tek alan için fotogerçekçi yüzleri yenmek hala zor. |
| 2020 | DDPM (Ho) | Difüzyon pratik hale gelir. |
| 2021 | KLİP, DALL-E 1, VQGAN | Metin-görüntü ana akım haline geliyor. |
| 2022 | Görüntü, Kararlı Difüzyon 1, DALL-E 2 | Gizli yayılma + metin koşullandırma = meta. |
| 2022 | ControlNet, LoRA | Önceden eğitilmiş difüzyon üzerinde hassas kontrol. |
| 2023 | SDXL, Midjourney v5, Akış eşleştirme | Ölçeklendirme + daha iyi eğitim dinamikleri. |
| 2024 | Sora, Kararlı Difüzyon 3, Flux.1 | Video yayılımı; akış eşleştirme kazanır. |
| 2025 | Veo 2, Kling 1.5, Pist Gen-3, Nano Muz | Üretim düzeyinde video. |
| 2026 | Tutarlılık + Düzeltilmiş Akış | Difüzyon omurgalarından tek adımlı örnekleme. |

## Beş soruluk triyaj

Yeni bir üretken model makalesi düştüğünde, yöntem bölümünü okumadan önce bu beş soruyu yanıtlayın.

1. **Ne modelleniyor?** Pikseller, latentler, ayrık token'ler, 3D Gaussian'lar, ağlar, dalga formları?
2. **Yoğunluk açık mı yoksa örtülü mü?** `log p(x)` yazıyorlar mı?
3. **Örnekleme: tek seferlik mi, yinelemeli mi?** Yinelemeli, daha yavaş anlamına gelir inference; tek atış genellikle düşmanca veya damıtılmış anlamına gelir.
4. **Koşullandırma: koşulsuz, sınıf, metin, görüntü, poz?** Bu, kaybı ve mimari iskeleyi belirler.
5. **Değerlendirme: FID, CLIP puanı, IS, insan tercihi, görev doğruluğu?** Her birinin bilinen başarısızlık modları vardır (bkz. Ders 14).

Bu aşamadaki her ders için bu beş soruyu yeniden yanıtlayacaksınız. Sonunda refleks olacaklar.

## İnşa Et

Bu dersin kodu hafif bir görselleştirmedir: üç oyuncak yaklaşımı (çekirdek yoğunluğu, ayrık histogram ve en yakın örnek "GAN-ish" oluşturucu) kullanarak örneklerden 1 boyutlu Gaussian karışımını yerleştirin, böylece tek ekrana yazdırabileceğiniz bir problemde açık ve örtülü yoğunluk arasındaki farkı görebilirsiniz.

`code/main.py`'yi çalıştırın. İki modlu bir Gauss karışımından 2000 örnek alır ve ardından şunu yazdırır:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Dikkat: İlk ikisi "bu noktanın olasılığı ne kadar?" diye sormanıza izin veriyor. Üçüncüsü yapamaz. Bu, gelecekteki her ders için önemli olacak *açık ve örtülü* ayrımdır.

## Kullan onu

2026'da hangi aile, hangi görev için?

| Görev | En iyi aile | Neden |
|------|-------------|-----|
| Fotogerçek yüzler, dar alan | StilGAN 2/3 | Hâlâ en keskin, en hızlı inference. |
| Genel metinden resme | Gizli difüzyon + akış eşleştirme | SD3, Flux.1, DALL-E 3. |
| Hızlı metinden resme | Düzeltilmiş akış + damıtma | SDXL-Turbo, SD3-Turbo, LCM. |
| Metinden videoya | Difüzyon Transformer + akış eşleştirme | Sora, Veo 2, Kling. |
| Konuşma + müzik | Token tabanlı AR (AudioLM, VALL-E, MusicGen) veya akış eşleştirme (AudioCraft 2) | Ayrık token'ler ucuza ölçeklenir. |
| 3D sahneler | Gauss Splatting uyumu, difüzyon öncesi | Yeniden yapılandırma için 3D-GS, yeni görünüm için yayılma. |
| Yoğunluk tahmini (örnekleme yok) | Akışlar | Tam `log p(x)`'ye sahip tek aile. |
| Simülasyon / fizik | Akış eşleştirme, puan SDE | Düz çizgili yollar, düzgün vektör alanları. |

## Gönderin

`outputs/skill-model-chooser.md` olarak kaydedin.

Beceri bir görev tanımı alır ve şu çıktıları alır: (1) hangi ailenin kullanılacağı, (2) üç açık ve üç barındırılan seçeneğin sıralanmış listesi, (3) izlemeniz gereken olası hata modu ve (4) bir işlem/zaman bütçesi.

## Egzersizler

1. **Kolay.** Bu beş ürünün her biri için aileyi ve omurgayı tanımlayın: ChatGPT görüntüsü, Midjourney v7, Sora, Runway Gen-3, ElevenLabs. Kanıtlar kamuya açık teknik raporlardan olmalıdır.
2. **Orta.** Yarın okuyacağınız makale, örneklemenin yayılmadan 100 kat daha hızlı olduğunu iddia ediyor. Hızlanmanın koşullandırma ve yüksek çözünürlükten sağ çıkıp çıkmadığını kontrol etmek için üç soru yazın.
3. **Zor.** Önem verdiğiniz bir alanı alın (e.g. protein yapısı, CAD, moleküller, yörüngeler). Bu alandaki mevcut SOTA modeli için beş soruluk önceliklendirmeyi yanıtlayın ve daha iyi bir modelin neleri değiştirebileceğini çizin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Üretken model | "Yeni şeyler yaratıyor" | `p_data(x)` için bir örnekleyici öğrenir ve isteğe bağlı olarak `log p(x)`'yi kullanıma sunar. |
| Açık yoğunluk | "Değerlendirebilirsiniz" | Model, kapalı formlu veya izlenebilir bir `log p(x)` sağlar. |
| Örtülü yoğunluk | "GAN tarzı" | Yalnızca örnekleyici — belirli bir noktanın `p(x)` değerini değerlendirmenin yolu yoktur. |
| ELBO | "Kanıt alt sınırı" | `log p(x)`'de izlenebilir bir alt sınır; VAE'ler ve difüzyon bunu optimize eder. |
| Puan | "Günlük yoğunluğunun Gradient'si" | `∇_x log p(x)`; difüzyon ve SDE modelleri bu alanı öğrenir. |
| Manifold hipotezi | "Veriler yüzeyde yaşar" | Yüksek loş veriler, düşük loş bir manifold üzerinde yoğunlaşır; boyutluluk azaltma neden işe yarıyor? |
| Otoregresif | "Sonraki parçayı tahmin et" | Eklemi koşul cümlelerinin çarpımı olarak çarpanlara ayırın. |
| Gizli | "Sıkıştırılmış kod" | Bir kod çözücünün girişi yeniden oluşturabileceği düşük loş gösterim. |

## Üretim notu: beş aile, beş inference şekli

Her aile farklı bir inference sunucusu maliyet eğrisiyle eşleşir. üretim-inference literatür çerçeveleri LLM inference ön doldurma + kod çözme olarak; aynı ayrıştırma burada da geçerlidir:

- **Otoregresif (grup 1 ve 5).** Sıralı kod çözme, gecikmeye hakimdir; KV-önbellek, sürekli gruplama ve spekülatif kod çözmenin tümü doğrudan uygulanır.
- **VAE / difüzyon / akış eşleştirme (2. ve 4. kovalar).** LLM anlamında kod çözme yoktur. Maliyet = `num_steps × step_cost` ve `step_cost`, tam gizli çözünürlükte bir transformer veya U-Net ileridir. Üretim düğmeleri adım sayısı (DDIM / DPM-Solver / damıtma), parti boyutu ve hassasiyettir (bf16 / fp8 / int4).
- **GAN (kova 3).** Bir ileri geçiş. Program yok, KV önbelleği yok. TTFT ≈ toplam gecikme. StyleGAN'ın dar alanlı UX'te hala kazanmasının nedeni budur.

Bir makale özetinde "yayılmadan daha hızlı" ifadesini gördüğünüzde, bunu "daha az adım × aynı adım maliyeti" veya "aynı adımlar × daha ucuz adım maliyeti" olarak çevirin. Geriye kalan her şey pazarlamadır.

## Daha Fazla Okuma

- [Goodfellow ve ark. (2014). Üretken Rekabet Ağları](https://arxiv.org/abs/1406.2661) — GAN belgesi.
- [Kingma ve Welling (2013). Otomatik Kodlama Değişken Bölümleri](https://arxiv.org/abs/1312.6114) — VAE kağıdı.
- [Ho, Jain, Abbeel (2020). Gürültü Giderici Difüzyon Olasılık Modelleri](https://arxiv.org/abs/2006.11239) — DDPM makalesi.
- [Song ve ark. (2021). SDE'ler aracılığıyla Puan Tabanlı Üretken Modelleme](https://arxiv.org/abs/2011.13456) — SDE olarak yayılma.
- [Lipman ve ark. (2023). Üretken Modelleme için Akış Eşleştirme](https://arxiv.org/abs/2210.02747) — akış eşleştirme kağıdı.
- [Esser ve ark. (2024). Yüksek Çözünürlüklü Görüntü Sentezi için Düzeltilmiş Akış Transformer'leri Ölçeklendirme](https://arxiv.org/abs/2403.03206) — Kararlı Difüzyon 3.
