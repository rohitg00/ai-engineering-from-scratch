# Transfüzyon: Otoregresif Metin + Difüzyon Görüntüsü Bir Arada Transformer

> Chameleon ve Emu3 her şeyi ayrı token'lara yatırıyor. Çalışıyorlar, ancak nicemleme darboğazı görülebiliyor; sürekli uzay difüzyon modellerinin altındaki görüntü kalitesi platoları. Transfüzyon (Meta, Zhou ve diğerleri, Ağustos 2024) tam tersini tercih ediyor: görüntüleri sürekli tutun, VQ-VAE'yi tamamen bırakın ve bir transformer'yi iki kayıpla eğitin. Metin token'ler sonraki-token-tahmini alır. Görüntü yamaları akış eşleştirme/yayılma kaybı yaşar. Her iki hedef de aynı ağırlıkları optimize eder. Kararlı Difüzyon 3'ün (MMDiT) altında yatan mimari yakın bir kuzendir. Bu derste Transfüzyon tezi okunur, oyuncak iki kayıplı eğitici yapılır ve bir transformer'nin her iki işi de yapmasına olanak tanıyan dikkat maskesinin izini sürer.

**Tür:** Yapım
**Diller:** Python (stdlib, MNIST ölçekli oyuncakta iki kayıplı eğitmen)
**Önkoşullar:** Aşama 12 · 11 (Bukalemun), Aşama 8 (Üretici Yapay Zeka)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Bir omurga üzerinde iki kayıp (metin token'lerde NTP, görüntü yamalarında difüzyon MSE) çalıştıran bir transformer bağlayın.
- Görüntü yamaları boyunca çift yönlü dikkatin yanı sıra metin token'ler üzerinde nedensel dikkatin neden doğru maske seçimi olduğunu açıklayın.
- Bilgi işlem, kalite ve kod karmaşıklığı açısından Transfüzyon stilini (sürekli görüntüler, yayılma kaybı) Bukalemun stiliyle (ayrı görüntüler, NTP) karşılaştırın.
- MMDiT'in katkısını adlandırın: her blokta modaliteye özgü ağırlıklar, kalan akışta ortak dikkat.

## Sorun

Ayrık ve sürekli görüntü token'nin tartışması yüksek lisans eğitimlerinden daha eskidir. Sürekli gösterimler (ham pikseller, VAE gizlileri) ayrıntıları korur. Ayrık token'ler (VQ endeksleri), transformer'nin yerel kelime dağarcığına uyar ancak niceleme adımında ayrıntıyı kaybeder.

Chameleon / Emu3 ayrık hale geldi: bir kayıp, bir mimari, ancak görüntü doğruluğu tokenizer kalitesiyle sınırlandı.

Yayılma modelleri sürekliydi: olağanüstü görüntü kalitesi, ancak LLM'den ayrı bir model, karmaşık gürültü çizelgesi mühendisliği ve metin oluşturmayla temiz bir entegrasyon yok.

Transfüzyon şunu sorar: İkisini de alabilir miyiz? Görüntüleri sürekli tutun, yine de bir modeli eğitin, bir gradient adımda birleştirilmiş iki kaybı kullanın.

## Konsept

### İki kayıplı mimari

Yalnızca kod çözücüye ait tek bir transformer, aşağıdakileri içeren bir diziyi işler:

- Metin token'ler (ayrı, BPE kelimesinden).
- Görüntü yamaları (doğrusal embedding aracılığıyla gizli loşluğa yansıtılan sürekli, 16x16 piksellik bloklar — ViT kodlayıcının girişiyle aynı).
- Sürekli yamaların nerede bulunduğunu gösteren `<image>` ve `</image>` etiketleri.

İleri pas bir kez çalışır. Yenilgi, token başına iki turadan birini seçer:

- Metin token'ler için: kelime bilgisi-logit başındaki standart çapraz entropi.
- Görüntü yamaları için: sürekli yamalardaki yayılma kaybı — her yamaya eklenen gürültüyü tahmin edin.

gradient, paylaşılan transformer gövdesi boyunca akar. Her iki kayıp da paylaşılan ağırlıkları aynı anda iyileştirir.

### Dikkat maskesi: nedensel metin + çift yönlü resim

Metin token'ler nedensel olmalıdır — bir token metninin gelecekteki metne katılmasına veya öğretmenin ara vermeye zorlamasına izin veremezsiniz. Ancak görüntü yamaları tek bir anlık görüntüyü temsil eder; aynı görüntü bloğu içerisinde çift yönlü olarak birbirlerine dikkat etmelidirler.

Maske:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i_image_end)   # text attends to previous images
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Eğitimde ve inference blok-üçgen maske olarak uygulandı.

### transformer içindeki difüzyon kaybı

Difüzyon kaybı standarttır: bir görüntü yamasına gürültü ekleyin, modelden gürültüyü (veya eşdeğer olarak temiz yamayı) tahmin etmesini isteyin. Transfusion'ın versiyonu akış eşleştirmeyi kullanıyor; gürültülüden temize doğru hız alanını tahmin ediyor.

Eğitim sırasında:
1. Her görüntü yaması x0 için rastgele bir zaman adımı t'yi örnekleyin.
2. Örnek gürültü ε, hesaplama xt = (1-t) * x0 + t * ε (akış uyumu için doğrusal enterpolasyon).
3. transformer v_theta(xt, t);'yi tahmin eder; kayıp = MSE(v_theta(xt, t), ε - x0).
4. Aynı dizideki metin NTP kayıplarının yanında Backprop.

inference'da nesil:
- Metin token'ler: standart otoregresif örnekleme.
- Görüntü yamaları: önceki metin token'lere göre koşullandırılmış difüzyon örnekleme döngüsü (tipik olarak 10-30 adım).

### MMDiT: Kararlı Difüzyon 3'ün çeşidi

Stabil Difüzyon 3 (Esser ve diğerleri, Mart 2024), MMDiT'yi (Multimodal Difüzyon Transformer) Transfüzyon ile hemen hemen aynı zamanlarda gönderdi. Mimarlar kardeştir.

MMDiT'in temel farklılıkları:

- Blok başına modaliteye özgü ağırlıklar. Her transformer bloğu, metin token'ler ve görüntü yamaları için ayrı Q, K, V ve MLP ağırlıklarına sahiptir. Dikkat ortaktır (çapraz modalite); geri kalan her şey modaliteye özgüdür.
- Düzeltilmiş akış eğitimi. Bilinen örneklemeye ve DDPM'den daha basit matematiğe sahip belirli bir akış eşleştirme çeşidi.
- Ölçek. MMDiT, SD3'ün (2B ve 8B param varyantları) omurgasıdır. Transfüzyonun kağıdı 7B'ye ölçekleniyor.

Her ikisi de aynı temel fikir üzerinde birleşiyor: Bir transformer, metin üzerinde NTP'yi ve sürekli görüntü temsilleri üzerinde difüzyonu çalıştırıyor.

### Bu neden Bukalemun stilinden daha iyi?

Görüntü oluşturmada sürekli difüzyon ve ayrık NTP arasındaki kalite farkı ölçülebilir. Transfüzyon kağıdı raporları:

- 7B paramlarında, aynı boyuttaki Bukalemun tarzı modeli FID'de 3-5 puanla geçiyor.
- tokenizer eğitimi gerekmez — görüntü kodlayıcı daha basittir (Gizliye doğrusal projeksiyon, ViT'nin giriş katmanıyla aynı).
- Inference, otoregresif görüntü token'lerden farklı olarak görüntü yaması gürültüsünü gidermeyi paralel hale getirebilir.

Dezavantajı: Transfüzyonun çift kayıplı bir model olması, eğitim dinamiklerini daha karmaşık hale getirir. Kayıp ağırlıklarının ayarlanması gerekir. NTP ve difüzyon arasındaki zamanlama uyumsuzluğu bir başın baskın olmasına neden olabilir.

### Aşağı yönde ne var

Janus-Pro (Ders 12.15), transformer gövdesini paylaşırken, anlama ve oluşturma için görüntü kodlayıcıyı (biri için SigLIP, diğeri için VQ) ayırarak Transfusion'ın fikrini geliştirir. Show-o (Ders 12.14), difüzyonu ayrık difüzyonla değiştirir (maskeli tahmin). Birleşik nesil ailesi Transfüzyondan sonra hızla dallanır.

Görüntü yayan 2026 üretim VLM'leri (Gemini 3 Pro, GPT-5, Claude Opus 4.7'nin görüntü oluşturma yolu) neredeyse kesinlikle bu ailenin bazı soyundan gelenleri kullanıyor. Ayrıntılar özeldir.

## Kullan onu

`code/main.py`, MNIST benzeri küçük bir sorun üzerine oyuncak bir Transfüzyon oluşturuyor:

- Metin başlıkları bir rakamı (0-9) açıklayan kısa tamsayı dizileridir.
- Görüntüler 4x4 baytlık ızgaralardır.
- Bir çift paylaşılan ağırlıklı doğrusal projeksiyon, transformer vekili görevi görür; Metinde NTP kaybı, gürültülü yamalarda MSE kaybı.
- Eğitim döngüsü iki kaybı dönüşümlü olarak gerçekleştirir, dikkat maskesi açıktır.
- Üretim, tek ileri geçişte bir metin başlığı ve 4x4 görüntü üretir.

transformer bir oyuncaktır. İki kayıplı tesisat, dikkat maskesi yapımı ve inference döngüsü gerçek artifact'lardır.

## Gönderin

Bu ders `outputs/skill-two-loss-trainer-designer.md` üretir. Yeni bir çok modlu eğitim görevi (metin + görüntü, metin + ses, metin + video) verildiğinde, iki kayıp programını (kayıp ağırlıkları, maske şekli, paylaşılan ve modaliteye özgü bloklar) tasarlar ve uygulama risklerini işaretler.

## Egzersizler

1. Transfüzyon tarzı bir model, %70 metin token'leri ve %30 görüntü yamalarını eğitir. Görüntü yayılma kaybı, metin NTP kaybının ~10 katı büyüklüğündedir. Hangi kayıp ağırlıkları bunları dengeler?

2. Bir dizi için blok üçgen maskesini uygulayın: `[T, T, <image>, P, P, P, P, </image>, T]`. Her girişi 0 veya 1 olarak işaretleyin.

3. MMDiT'in modaliteye özgü QKV ağırlıkları vardır. Bu, Transfüzyon'un tam olarak paylaşılan transformer'sine kıyasla hangi parametre sayımı yükünü artırıyor? 7B paramlarında buna değer mi?

4. Nesil: prompt metni verildiğinde, model 50 token saniye boyunca NTP'yi çalıştırır, ardından `<image>`'ya ulaşır ve ardından 20 gürültü giderme adımı üzerinden 256 yama üzerinde difüzyonu çalıştırır. Toplam kaç ileri pas var?

5. SD3 makalesini okuyun Bölüm 3. Düzeltilmiş akışı açıklayın ve neden DDPM'den daha az inference adımda yakınsadığını açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| İki mağlubiyet eğitimi | "NTP + difüzyon" | Tek bir transformer, aynı gradient adımında hem metin token'lerdeki çapraz entropiyi hem de sürekli görüntü yamalarındaki MSE'yi optimize eder |
| Akış eşleştirme | "Düzeltilmiş akış" | Gürültüden temiz verilere doğru bir hız alanı öngören yayılma varyantı; DDPM'den daha basit matematik |
| MMDIT | "Multimodal DiT" | Stabil Difüzyon 3'ün mimarisi: ortak dikkat, modaliteye özgü MLP'ler ve normlar |
| Blok-üçgen maske | "Nedensel metin + çift yönlü resim" | Metin genelinde nedensel olan ancak görüntü bölgelerinde çift yönlü olan dikkat maskesi |
| Sürekli görüntü gösterimi | "VQ Yok" | Tamsayı kod kitabı endeksleri değil, gerçek değerli vektörler olarak görüntü yamaları |
| Hız tahmini | "v-parametreleştirme" | Ağ çıkışı, gürültünün kendisi değil, gürültü ve veri arasındaki hız alanıdır |

## Daha Fazla Okuma

- [Zhou ve ark. — Transfüzyon (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser ve ark. — Kararlı Difüzyon 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles ve Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao ve ark. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie ve ark. — Göster-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
