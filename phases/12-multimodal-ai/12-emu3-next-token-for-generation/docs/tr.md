# Emu3: Görüntü ve Video Oluşturma için Sonraki-Token Tahmini

> BAAI'nin Emu3'ü (Wang ve diğerleri, Eylül 2024), difüzyona karşı otoregresif tartışmasını sona erdirmesi gereken 2024 sonucudur. Metin + VQ görüntü token'ler + 3D VQ video token'lardan oluşan birleşik bir kelime dağarcığı genelinde yalnızca sonraki-token-tahmin hedefi konusunda eğitilmiş, yalnızca Llama tarzı kod çözücüye yönelik tek bir transformer, görüntü oluşturmada SDXL'yi ve algılamada LLaVA-1.6'yı yener. CLIP kaybı yok. Yayılma programı yok. Sınıflandırıcısız rehberlik, kalite için inference'da kullanılır, ancak temel eğitim hedefi, öğretmen zorlamasıyla sonraki-token tahmindir. Nature'da yayınlandı. Bu ders Emu3 tezini okuyor - neden daha iyi bir tokenizer artı ölçeğine ihtiyacınız var - ve yayılma yaklaşımlarıyla çelişiyor.

**Tür:** Öğren
**Diller:** Python (stdlib, 3D video tokenizer matematik + otoregresif örnekleyici iskeleti)
**Önkoşullar:** Aşama 12 · 11 (Bukalemun)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Emu3'ün tek kayıplı sonraki-token hedefinin, görüntü kalitesi için difüzyonun gerekli olduğu şeklindeki uzun süredir kabul edilen varsayıma rağmen neden işe yaradığını açıklayın.
- 3 boyutlu videoyu tokenizer açıklayın: uzay-zamansal VQ kod kitabının neye benzediği, yamaların neden zamana yayıldığı.
- Emu3 ile Stable Diffusion XL'i (eğitim hesaplaması, inference maliyet, kalite tavanı) karşılaştırın.
- Aynı Emu3 modelinin oynadığı üç rolü adlandırın: Emu3-Gen (görüntü oluşturma), Emu3-Chat (algılama), Emu3-Stage2 (video oluşturma).

## Sorun

2024'e kadar olan geleneksel görüş: İmaj oluşturmanın yaygınlaşmaya ihtiyacı var. Argüman: ayrık görüntü token'ler, ayrıntıları yeniden oluşturmak için çok fazla bilgi kaybeder ve otoregresif örnekleme, binlerce token'de hata biriktirir. Stabil Difüzyon, DALL-E 3, Imagen, Midjourney'in tümü bir tür difüzyon kullanır. Chameleon (Ders 12.11) bunu küçük ölçekte kısmen çürüttü ancak kalite açısından SDXL ile eşleşmedi.

Emu3 tartışmaya doğrudan saldırdı. İddia: daha iyi görsel tokenizer + yeterli ölçek + sonraki-token kayıp = algıyı da yapan aynı modelde yayılmayı yenen görüntü üretimi.

Bahis yayınlandığında tartışmalıydı. İki yıl sonra, açık kaynaklı birleştirilmiş nesil ailesi (Emu3, Show-o, Janus-Pro, Transfusion) araştırma için varsayılan yoldur; üretim sınırı modelleri bazı değişkenleri kullanıyor gibi görünüyor.

## Konsept

### Emu3 tokenizer

Anahtar bileşen görseldir tokenizer. Emu3, token başına 8x8 çözünürlük azaltımıyla özel bir IBQ sınıfı tokenizer (Ters Darboğaz Niceleyici, SBER-MoVQGAN ailesi) eğitir. 512x512 boyutunda bir görüntü, 32768 kod kitabı boyutunda 64x64 = 4096 tokens olur.

Bu, K=8192'de Chameleon'un 512x512 başına 1024 token'sinden daha büyüktür, ancak token başına daha ucuzdur (daha küçük kod kitabı aramaları, daha basit codec bileşeni). Temel ölçüm: Stabil Difüzyon'un 32 dB'deki sürekli gizli alanıyla rekabet edebilecek şekilde PSNR'nin 30,5 dB'de yeniden yapılandırılması.

Video için: 3D VQ tokenizer, uzay-zamansal bir yamayı (4x4x4 piksel) bir tamsayıya kodlar. 8 FPS'deki 4s'lik bir klipte 32 kare bulunur; 4x uzaysal ve 4x zamansal azaltma ile 256x256'da, token sayısı (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 tokens'dir.

Tokenizer kalitesi tavandır. Emu3'ün katkısı kısmen "çok iyi bir tokenizer yetiştirdik."

### Tek kayıplı eğitim

Emu3 tek bir amaç kullanır: metin token'ler, 2B görüntü token'ler ve 3B video token'lar arasında paylaşılan bir kelime dağarcığı üzerinde sonraki-token tahmini. Ağırlıklar, katkıyı dengelemek için eğitim sırasında modaliteye özgü faktörlerle çarpılır, ancak loss function aynıdır.

Aşağıdakilerin bir karışımı üzerinde eğitim alın:
- Resim oluşturma: `<text caption> <image> image_tokens </image>`
- Görüntü algısı: `<image> image_tokens </image> <question> text_tokens`
- Video oluşturma: `<text caption> <video> video_tokens </video>`
- Video algısı: benzer.
- Yalnızca metin: standart NTP.

Model, veri dağıtımından görüntü token'lerin ve metin token'lerin ne zaman yayınlanacağını öğrenir. Oluşturma, `<image>` etiketinden sonraki token görüntülerini tahmin eden modelden ortaya çıkar.

### Sınıflandırıcısız yönlendirme ve sıcaklık

Otomatik regresif görüntü oluşturma, inference'da sınıflandırıcısız rehberlik (CFG) ile çok daha iyi hale gelir. Emu3 bunu kullanır: iki kez oluşturun, bir kez tam başlıkla, bir kez boş başlıkla, logitleri bir kılavuz ağırlığıyla karıştırın (tipik 3.0-7.0). Bu, otoregresif ayara ödünç alınan CFG hileli difüzyon kullanımlarının aynısıdır.

Sıcaklık önemlidir: çok yüksek, artifacts; çok düşük, mod çöküyor. Emu3'ün önerilen sıcaklığı algılama için 1,0, görüntü oluşturma için 0,8'dir.

### Üç rol, tek model

Emu3, işlevsel olarak üç farklı API olarak gönderilir ancak temel ağırlık seti tektir:

- Emu3-Gen. Görüntü oluşturma. Giriş metni, çıkış görüntüsü tokens.
- Emu3-Sohbet. VQA ve altyazı. Giriş resmi (tokens), çıkış metni.
- Emu3-Aşama2. Video oluşturma ve video VQA. Metin veya video girişi yapın, metin veya video çıkışı yapın.

Göreve özgü kafalar yok. Yalnızca farklı prompt şablonları. Aynı kontrol noktası.

### Benchmarks

Emu3 makalesinden (Eylül 2024):

- Görüntü oluşturma: MJHQ-30K FID'de SDXL'yi (5,4'e karşı 5,6), GenEval genelini (0,54'e karşı 0,55 — istatistiksel eşitlik) ve Deep-Eval'in kompozitini geride bırakıyor.
- Görüntü algısı: VQAv2'de LLaVA-1,6'yı geçiyor (75,1'e karşı 72,4) ve MMMU ile kabaca eşleşiyor.
- Video oluşturma: Sora döneminin herkese açık benchmarked modelleriyle rekabetçi FVD'de 4 saniyelik klip kalitesi.

Rakamlar her zaman kazandırmıyor - Emu3 burada bir puan karşılığında şuraya bir puan veriyor - ancak "sonrakitoken tek ihtiyacınız olan tahmin" iddiası çeşitli yöntemlerde savunulabilir.

### İşlem maliyeti

Emu3, 7B parametreli bir modelle ~300 milyar multimodal token üzerinde eğitildi. GPU saatleri kabaca Llama-2-7B ön eğitimiyle karşılaştırılabilir (A100 sınıfı silikonda 2k-4k GPU yılı). Stable Diffusion 3 gibi dağıtım modelleri benzer bütçelerde eğitilir ancak ayrı metin kodlayıcılara ve daha karmaşık işlem hatlarına ihtiyaç duyar.

inference'da Emu3, görüntü başına SDXL'den daha yavaştır: 30 tok/s'de 4096 görüntü tokens, 512x512 görüntü başına ~2 dakika, SDXL için ise 2-5 saniyedir. Spekülatif kod çözme ve KV önbellek optimizasyonu boşluğu daraltır ancak kapatmaz. Otoregresif görüntü oluşturma işlemi yoğundur; bu kalıcı bir değiş-tokuştur.

### Neden önemlidir?

Emu3'ün derin katkısı kavramsaldır. Sonraki-token tahmini, görüntü oluşturmadaki difüzyonla eşleşecek şekilde ölçeklenirse, birleşik model yolu (bir kayıp, bir omurga, herhangi bir yöntem) uygulanabilir. Gelecek modellerde ayrı metin kodlayıcılara, ayrı dağıtım zamanlayıcılara, ayrı VAE'lere gerek yok. Bir transformer, modalite başına bir tokenizer, ölçek.

Show-o, Janus-Pro ve InternVL-U'nun tümü bu tezi temel alıyor veya bu teze meydan okuyor. Çin laboratuvarları (BAAI, DeepSeek) 2025 yılına kadar ABD laboratuvarlarından daha agresif bir şekilde bu yönde yayın yapacak.

## Kullan onu

`code/main.py` iki oyuncak parçası yapıyor:

- 2D ve 3D VQ tokenizer sayım hesaplayıcısı: verilen (çözünürlük, yama, klip_uzunluğu, FPS), görüntü ve video için token sayımlarını hesaplayın.
- Sıcaklıkta sınıflandırıcı içermeyen rehberliğe sahip, otoregresif bir görüntü-token örnekleyici.

CFG uygulaması Emu3'ün tarifiyle eşleşiyor: koşullu ve koşulsuz logitleri bir kılavuz ağırlığıyla karıştırın.

## Gönderin

Bu ders `outputs/skill-token-gen-cost-analyzer.md` üretir. Bir nesil ürün spesifikasyonu (görüntü veya video, hedef çözünürlük, kalite katmanı, gecikme bütçesi) verildiğinde, token sayısını, inference maliyetini hesaplar ve Emu3 ailesi ile yayılmayı seçer.

## Egzersizler

1. Emu3, 8x8 azaltmada 512x512 görüntü başına 4096 tokens üretir. 1024x1024 ve 2048x2048'in eşdeğerini hesaplayın. inference gecikmeye ne olur?

2. tokenizer videosundaki Emu3 Bölüm 3.3'ü okuyun. 3D VQ yama şeklini ve neden 8x8x1 değil 4x4x4 olduğunu açıklayın.

3. Sınıflandırıcısız yönlendirme ağırlığı 5,0 vs 3,0: hangi görsel efekt? `code/main.py`'daki matematiğin izini sürün.

4. Emu3-7B için 300B tokens'de eğitim FLOP'larını hesaplayın ve Kararlı Difüzyon 3 ile karşılaştırın. Hangisinin eğitimi daha pahalıydı?

5. Emu3, FID'de SDXL'yi yener ancak VQAv2'de özel VLM'lere karşı geçemez. Birleştirilmiş kayıp yaklaşımının neden farklı benchmark'larda uzmanlara göre farklı güçlü yönler gösterdiğini açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Sonraki-token tahmin | "NTP" | Standart otoregresif kayıp: token[0..i] verildiğinde token[i+1]'i tahmin edin; tokenözelleştirildiğinde her yöntem için çalışır |
| IBQ tokenizer | "Ters darboğaz niceleyicisi" | Daha büyük kod kitaplarına (32768+) ve Chameleon'unkinden daha iyi yeniden yapılandırmaya sahip bir VQ-VAE sınıfı |
| 3D VQ | "Uzaysal-zamansal niceleyici" | (zaman, satır, sütun) ile indekslenen kod kitabı; bir token 4x4x4 piksellik bir küpü kapsar |
| Sınıflandırıcısız rehberlik | "CFG" | Koşullu ve koşulsuz logitleri ağırlık gama ile karıştırın; inference görüntü kalitesini artırır |
| Birleşik kelime dağarcığı | "Paylaşılan token'lar" | Metin + resim + videonun tümü aynı tamsayı uzayından alınır; modeli, bundan sonra hangi yöntemin geleceğini tahmin ediyor |
| MJHQ-30K | "Resim oluştur benchmark" | 30k prompts ile yolculuk ortası kalitesinde benchmark; Emu3 FID'yi burada rapor ediyor |

## Daha Fazla Okuma

- [Wang ve ark. — Emu3: Sonraki-Token Tek İhtiyacınız Olan Tahmin (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun ve ark. — Emu: Çok Modlulukta Üretken Ön Eğitim (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu ve ark. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu ve ark. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian ve ark. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
