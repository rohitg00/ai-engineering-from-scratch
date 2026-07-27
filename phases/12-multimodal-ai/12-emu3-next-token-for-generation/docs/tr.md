# Emu3: Görüntü ve Video Oluşturma için Sonraki Token Tahmini

> BAAI'nin Emu3'ü (Wang ve diğerleri, Eylül 2024), difüzyona karşı otoregresif tartışmasını sona erdirmesi gereken 2024 sonucudur. Metin + VQ görüntü token'ler + 3D VQ video token'lerden oluşan birleşik bir kelime dağarcığı genelinde yalnızca sonraki token tahmin hedefi üzerinde eğitilmiş tek bir Llama tarzı kod çözücü transformer, görüntü oluşturmada SDXL'yi ve algılamada LLaVA-1.6'yı geride bırakır. CLIP kaybı yok. Yayılma programı yok. Kalite için inference'de sınıflandırıcısız rehberlik kullanılır, ancak temel eğitim hedefi öğretmen zorlamasıyla sonraki token tahminidir. Nature'da yayınlandı. Bu ders Emu3 tezini okuyor - neden daha iyi bir tokenizer plus ölçeğine ihtiyacınız var - ve yayılma yaklaşımlarıyla çelişiyor.

**Tür:** Öğren
**Diller:** Python (stdlib, 3D video tokenizer matematik + otoregresif örnekleyici iskeleti)
**Önkoşullar:** Aşama 12 · 11 (Bukalemun)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Emu3'ün tek kayıplı sonraki token hedefinin, görüntü kalitesi için difüzyonun gerekli olduğu şeklindeki uzun süredir kabul edilen varsayıma rağmen neden işe yaradığını açıklayın.
- tokenizer 3D videosunu açıklayın: uzay-zamansal bir VQ kod kitabının neye benzediği, yamaların neden zamana yayıldığı.
- Emu3 ile Stable Diffusion XL'i karşılaştırın (eğitim hesaplaması, inference maliyeti, kalite tavanı).
- Aynı Emu3 modelinin oynadığı üç rolü adlandırın: Emu3-Gen (görüntü oluşturma), Emu3-Chat (algılama), Emu3-Stage2 (video oluşturma).

## Sorun

2024'e kadar olan geleneksel görüş: İmaj oluşturmanın yaygınlaşmaya ihtiyacı var. Tartışma şu: ayrık görüntü token'ler ayrıntıları yeniden oluşturmak için çok fazla bilgi kaybediyor ve otoregresif örnekleme binlerce token'de hata biriktiriyor. Stabil Difüzyon, DALL-E 3, Imagen, Midjourney'in tümü bir tür difüzyon kullanır. Chameleon (Ders 12.11) bunu küçük ölçekte kısmen çürüttü ancak kalite açısından SDXL ile eşleşmedi.

Emu3 tartışmaya doğrudan saldırdı. İddia: daha iyi görsel tokenizer + yeterli ölçek + sonraki token kaybı = aynı modelde algıyı da yapan, yayılmayı yenen görüntü üretimi.

Bahis yayınlandığında tartışmalıydı. İki yıl sonra, açık kaynaklı birleştirilmiş nesil ailesi (Emu3, Show-o, Janus-Pro, Transfusion) araştırma için varsayılan yoldur; üretim sınırı modelleri bazı değişkenleri kullanıyor gibi görünüyor.

## Konsept

### Emu3 tokenizer

Anahtar bileşen görsel tokenizer'dir. Emu3, token başına 8x8 çözünürlük azaltmada özel bir IBQ sınıfı tokenizer'yi (Ters Darboğaz Niceleyici, SBER-MoVQGAN ailesi) eğitir. 512x512 boyutunda bir görüntü, 32768 kod kitabı boyutunda 64x64 = 4096 token olur.

Bu, Chameleon'un K=8192'de 512x512 başına 1024 token'sinden daha büyüktür, ancak token başına daha ucuzdur (daha küçük kod kitabı aramaları, daha basit codec bileşeni). Temel ölçüm: Stabil Difüzyon'un 32 dB'deki sürekli gizli alanıyla rekabet edebilecek şekilde PSNR'nin 30,5 dB'de yeniden yapılandırılması.

Video için: 3D VQ tokenizer, uzay-zamansal bir yamayı (4x4x4 piksel) bir tamsayıya kodlar. 8 FPS'deki 4s'lik bir klipte 32 kare bulunur; 4x uzaysal ve 4x zamansal azaltma ile 256x256'da token sayısı (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32.768 token'dir.

Tokenizer kalitesi tavandır. Emu3'ün katkısı kısmen "çok iyi bir tokenizer yetiştirdik."

### Tek kayıplı eğitim

Emu3 tek bir amaç kullanır: metin token'ler, 2B görüntü token'ler ve 3B video token'ler arasında paylaşılan bir kelime dağarcığı üzerinde sonraki token tahmini. Ağırlıklar, katkıyı dengelemek için eğitim sırasında modaliteye özgü faktörlerle çarpılır, ancak loss function aynıdır.

Aşağıdakilerin bir karışımı üzerinde eğitim alın:
- Resim oluşturma: `<text caption> <image> image_tokens </image>`
- Görüntü algısı: `<image> image_tokens </image> <question> text_tokens`
- Video oluşturucu: `<text caption> <video> video_tokens </video>`
- Video algısı: benzer.
- Yalnızca metin: standart NTP.

Model, veri dağıtımından görüntü token'lerin ve metin token'lerin ne zaman yayınlanacağını öğrenir. Üretim, `<image>` etiketinden sonra görüntü token'leri tahmin eden modelden ortaya çıkar.

### Sınıflandırıcısız yönlendirme ve sıcaklık

Otomatik regresif görüntü oluşturma, inference'deki sınıflandırıcısız rehberlik (CFG) ile çok daha iyi hale gelir. Emu3 bunu kullanır: iki kez oluşturun, bir kez tam başlıkla, bir kez boş başlıkla, logitleri bir kılavuz ağırlığıyla karıştırın (tipik 3.0-7.0). Bu, otoregresif ayara ödünç alınan CFG hileli difüzyon kullanımlarının aynısıdır.

Sıcaklık önemlidir: çok yüksek, artifacts; çok düşük, mod çöküyor. Emu3'ün önerilen sıcaklığı algılama için 1,0, görüntü oluşturma için 0,8'dir.

### Üç rol, tek model

Emu3, işlevsel olarak üç farklı API olarak gönderilir ancak temel ağırlık seti tektir:

- Emu3-Gen. Görüntü oluşturma. Giriş metni, çıkış görüntüsü tokens.
- Emu3-Sohbet. VQA ve altyazı. Giriş görüntüsü (tokens), çıkış metni.
- Emu3-Aşama2. Video oluşturma ve video VQA. Metin veya video girişi yapın, metin veya video çıkışı yapın.

Göreve özgü kafalar yok. Sadece farklı prompt şablonları. Aynı kontrol noktası.

### Benchmark'ler

Emu3 makalesinden (Eylül 2024):

- Görüntü oluşturma: MJHQ-30K FID'de SDXL'yi (5,4'e karşı 5,6), GenEval genelini (0,54'e karşı 0,55 — istatistiksel eşitlik) ve Deep-Eval'in kompozitini geride bırakıyor.
- Görüntü algısı: VQAv2'de LLaVA-1,6'yı geçiyor (75,1'e karşı 72,4) ve MMMU ile kabaca eşleşiyor.
- Video oluşturma: Sora döneminin halka açık benchmarked modelleri ile rekabetçi FVD'de 4 saniyelik klip kalitesi.

Rakamlar her zaman kazandırmıyor - Emu3 burada bir puan karşılığında şurada bir puan takas ediyor - ancak "sonraki token tahmini ihtiyacınız olan tek şey" iddiası farklı yöntemler arasında savunulabilir.

### İşlem maliyeti

Emu3, 7B parametreli bir modelle ~300 milyar multimodal token üzerinde eğitildi. GPU saatleri kabaca Llama-2-7B ön eğitimiyle karşılaştırılabilir (A100 sınıfı silikonda 2k-4k GPU yılı). Stable Diffusion 3 gibi dağıtım modelleri benzer bütçelerde eğitilir ancak ayrı metin kodlayıcılara ve daha karmaşık işlem hatlarına ihtiyaç duyar.

inference'de Emu3, görüntü başına SDXL'den daha yavaştır: 30 tok/s'de 4096 görüntü token, 512x512 görüntü başına ~2 dakika, SDXL için ise 2-5 saniyedir. Spekülatif kod çözme ve KV önbellek optimizasyonu boşluğu daraltır ancak kapatmaz. Otoregresif görüntü oluşturma işlemi yoğundur; bu kalıcı bir değiş-tokuştur.

### Neden önemlidir?

Emu3'ün derin katkısı kavramsaldır. Sonraki token tahmini, görüntü oluşturmadaki difüzyonla eşleşecek şekilde ölçeklenirse, birleşik model yolu (bir kayıp, bir omurga, herhangi bir yöntem) uygulanabilir. Gelecek modellerde ayrı metin kodlayıcılara, ayrı dağıtım zamanlayıcılara, ayrı VAE'lere gerek yok. Bir transformer, modalite başına bir tokenizer, ölçek.

Show-o, Janus-Pro ve InternVL-U'nun tümü bu tezi temel alıyor veya bu teze meydan okuyor. Çin laboratuvarları (BAAI, DeepSeek) 2025 yılına kadar ABD laboratuvarlarından daha agresif bir şekilde bu yönde yayın yapacak.

## Kullan onu

`code/main.py` iki oyuncak parçası oluşturur:

- 2D ve 3D VQ tokenizer sayım hesaplayıcısı: verilen (çözünürlük, yama, klip_uzunluğu, FPS), görüntü ve video için token sayımlarını hesaplayın.
- Sıcaklıkta sınıflandırıcı içermeyen rehberliğe sahip, otoregresif bir görüntü-token örnekleyici.

CFG uygulaması Emu3'ün tarifiyle eşleşiyor: koşullu ve koşulsuz logitleri bir kılavuz ağırlığıyla karıştırın.

## Gönderin

Bu ders `outputs/skill-token-gen-cost-analyzer.md`'yi üretir. Bir nesil ürün özelliği verildiğinde (görüntü veya video, hedef çözünürlük, kalite katmanı, gecikme bütçesi), token sayılarını, inference maliyetini hesaplar ve Emu3 ailesi ile yayılmayı seçer.

## Egzersizler

1. Emu3, 8x8 azaltmada 512x512 görüntü başına 4096 token üretir. 1024x1024 ve 2048x2048'in eşdeğerini hesaplayın. inference gecikmesine ne olur?

2. tokenizer videosundaki Emu3 Bölüm 3.3'ü okuyun. 3D VQ yama şeklini ve neden 8x8x1 değil 4x4x4 olduğunu açıklayın.

3. Sınıflandırıcısız yönlendirme ağırlığı 5,0 vs 3,0: hangi görsel efekt? `code/main.py`'deki matematiğin izini sürün.

4. 300B token'lerde Emu3-7B için eğitim FLOP'larını hesaplayın ve Kararlı Difüzyon ile karşılaştırın 3. Hangisinin eğitimi daha pahalıydı?

5. Emu3, FID'de SDXL'yi yener ancak VQAv2'de özel VLM'lere karşı geçemez. Birleştirilmiş kayıp yaklaşımının, farklı benchmark'lerdeki uzmanlara kıyasla neden farklı güçlü yönler gösterdiğini açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Sonraki-token tahmini | "NTP" | Standart otoregresif kayıp: token[0..i] verildiğinde token[i+1]'i tahmin edin; tokenized |
| IBQ tokenizer | "Ters darboğaz niceleyicisi" | Chameleon'dan daha büyük kod kitaplarına (32768+) ve daha iyi yeniden yapılandırmaya sahip bir VQ-VAE sınıfı |
| 3D VQ | "Uzaysal-zamansal niceleyici" | (zaman, satır, sütun) ile indekslenen kod kitabı; bir token, 4x4x4 piksellik bir küpü kapsar |
| Sınıflandırıcısız rehberlik | "CFG" | Koşullu ve koşulsuz logitleri ağırlık gama ile karıştırın; inference'de görüntü kalitesini artırır |
| Birleşik kelime dağarcığı | "Paylaşılan token'ler" | Metin + resim + videonun tümü aynı tamsayı uzayından alınır; modeli, bundan sonra hangi yöntemin geleceğini tahmin ediyor |
| MJHQ-30K | "Resim gen benchmark" | 30k prompt ile orta yolculuk kalitesinde benchmark; Emu3 FID'yi burada rapor ediyor |

## Daha Fazla Okuma

- [Wang ve ark. — Emu3: Sonraki-Token Tahmin İhtiyacınız Olan Tek Şey (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun ve ark. — Emu: Çoklu Modalitede Üretken Ön Eğitim (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu ve ark. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu ve ark. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian ve ark. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
