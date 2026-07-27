# Ses-Dil Modelleri: Ses Flamingo 3 Arc'a Fısıltı

> Whisper (Radford ve diğerleri, Aralık 2022) yerleşik konuşma tanıma — 680 bin saat zayıf denetimli çok dilli konuşma, basit bir kodlayıcı-kod çözücü transformer, sonraki her ASR sürümünde bundan alıntı yapılmasını sağlayan bir benchmark. Ancak tanınma, akıl yürütme değildir. "Bu kayıtta hangi enstrümanlar var" veya "konuşmacı hangi duyguyu ifade ediyor" veya "3. dakikada ne oldu?" gibi sorular, transkripsiyon değil, sesin anlaşılmasını gerektirir. Qwen-Audio, SALMONN, LTU ve NVIDIA Audio Flamingo 3 (AF3, Temmuz 2025) bu yığını aşamalı olarak oluşturdu: Whisper sınıfı kodlayıcıları koruyun, Q-former'ları kullanın, sesli metin talimat verilerini eğitin, düşünce zinciri mantığı ekleyin. Bu ders konuyu ele alıyor.

**Tür:** Yapım
**Diller:** Python (stdlib, log-Mel spektrogramı + ses Q-former iskeleti)
**Önkoşullar:** Aşama 6 (Konuşma ve Ses), Aşama 12 · 03 (Q-Former)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Bir dalga formundan log-Mel spektrogramını hesaplayın: pencereleme, FFT, filtre bankaları, log dönüşümü.
- Kodlayıcı seçeneklerini karşılaştırın: Whisper kodlayıcı, BEAT'ler, AF-Whisper hibrit. Her biri kazandığında.
- Sesli bir Q-former oluşturun: Spektrogram yamalarına çapraz katılım sağlayan N sayıda öğrenilebilir sorgu.
- Basamaklı (Whisper-then-LLM) ve uçtan uca sesli yüksek lisans eğitimine kıyasla uçtan uca ölçeklendirmenin neden muhakeme açısından daha iyi olduğunu açıklayın.

## Sorun

Konuşma tanıma Whisper tarafından çözüldü. Sesin OCR'si bir üründür. Ancak "meta" transkripsiyonda durur. Model, duyduğu şeyler (zamanlama, hoparlörler, duygu, müzik yapısı, çevresel sesler) üzerinde akıl yürütemezse, transkripsiyon tek başına ürün özelliklerini yönlendiremez.

Üç belirgin rota:

1. Cascade: Whisper transkripsiyonları, LLM transkript üzerinden nedenler. Saf konuşma senaryoları için çalışır. Müzik, çevresel ses, çoklu hoparlör çakışması ve duygu durumlarında başarısız olur.

2. Uçtan uca ses-LLM: bir ses kodlayıcı, ses token'leri transkripsiyonu atlayarak doğrudan bir LLM'ye besler. Akustik bilgileri (duygu, konuşmacı, çevre) korur. Yeni eğitim verilerine ihtiyaç var.

3. Hibrit: hem yazıya dökebilen hem de akıl yürütebilen ses kodlayıcı + metin kod çözücü. Qwen-Audio ve Audio Flamingo bu rotayı seçiyor.

## Konsept

### Log-Mel spektrogramı: giriş özelliği

Her ses kodlayıcı aynı özellikle başlar: log-Mel spektrogramı.

1. 16 kHz'e yeniden örnekleyin.
2. 25ms pencereli, 10ms atlamalı kısa süreli Fourier dönüşümü.
3. FFT sonucunun büyüklüğünü alın.
4. Algısal frekansı çarpıtmak için Mel filtre kümelerini (tipik olarak 0-8000 Hz log aralıklı 80 filtre) uygulayın.
5. Dinamik aralık için log sıkıştırması (log(1 + x))

Sonuç: T'nin zaman çerçevelerinin sayısı olduğu 2 boyutlu bir şekil dizisi (T, 80). 100 Hz kare hızında 30 saniyelik bir klip için: (3000, 80).

### Whisper'ın kodlayıcısı

Whisper'ın kodlayıcısı, log-Mel spektrogramını bir zaman çerçevesi dizisi olarak işleyen 12 katmanlı ViT tarzı bir transformer'dir. Çıktı: zaman çerçevesi başına bir gizli durum vektörü.

ASR için Whisper'ın kod çözücüsü, kodlayıcı çıkışına göre koşullandırılmış token metinleri üreten çapraz dikkat transformer'dir. Standart kodlayıcı-kod çözücü.

ALM'ler (ses-LLM'ler) için, kodlayıcı çıkışının farklı bir LLM'ye giriş olarak olmasını istersiniz. Model: Whisper kodlayıcı dondurulmuş, Q-former eğitilebilir, LLM dondurulmuş veya ayarlanmış.

### BEAT'ler ve sese özel kodlayıcılar

Whisper, konuşmaya hakim veriler üzerinde eğitildi. Müzik ve çevresel ses için daha zayıftır.

BEATs (Chen ve diğerleri, 2022), AudioSet üzerinde eğitilmiş, kendi kendini denetleyen bir transformer'dir. Aynı parametre sayısında müzik ve ortam seslerini Whisper'dan daha iyi yakalar.

AF-Whisper (Audio Flamingo 3'ün hibriti): ses girişi olarak concat Whisper + BEATs özellikleri. Fısıltı dilsel sinyali, BEAT ise akustik sinyali taşır.

### Ses Q-eski

BLIP-2'nin görsel Q-former'ı ile aynı model. Sabit sayıda öğrenilebilir sorgu (genellikle 32 veya 64), ses kodlayıcının çıkış çerçeveleri üzerinde çapraz katılım sağlar. Sorgular, LLM tarafından tüketilen ses token'ler haline gelir.

Eğitim hizalama aşaması: Yalnızca Q-former, sesli metin çiftlerinde karşılaştırmalı + altyazı kayıpları (AudioCaps, Clotho). Talimat aşaması: uçtan uca, LLM'yi çözün, talimat verileri üzerinde eğitim verin.

### Ark — SALMONN, Qwen-Audio, AF3

SALMONN (Tang ve diğerleri, 2023): Whisper + BEAT'ler + Q-former + LLaMA. Ciddi muhakeme yeteneğine sahip ilk açık ses yüksek lisansı. MMAU'daki Benchmark'ler ~0,55 kompozit gösterir.

Qwen-Audio (Chu ve diğerleri, 2023): daha zengin bir dataset üzerinde eğitilmiş, çok turlu diyalog için ayarlanmış benzer mimari. MMAU ~0.60.

LTU — Dinle, Düşün, Anla (Gong ve diğerleri, 2023): açık muhakeme verileri, ses klipleri üzerinden düşünce zincirine odaklanma. Daha küçük ama daha odaklanmış.

Audio Flamingo 3 (Goel ve diğerleri, Temmuz 2025): mevcut açık SOTA. 8B LLM omurgası (Qwen2 7B), Fısıltı büyüklüğünde kodlayıcı concat BEAT'ler, 64 sorgulu Q-former, 1 milyondan fazla sesli metin talimat çifti üzerinde eğitim. MMAU 0.72, bazı alt görevlerde özel sınırlarla eşleşir.

AF3 ayrıca ses için isteğe bağlı düşünce zincirini de sunar: model, son yanıttan önce isteğe bağlı olarak düşünme token'ler ("önce enstrümanları tanımlamama izin verin: ...") yayabilir. Karmaşık akıl yürütme görevlerindeki doğruluk, düşünme etkinleştirildiğinde 3-5 puan artırır.

### Basamaklı vs uçtan uca

Kademeli boru hattı:

1. Whisper, ses → metni metne dönüştürür.
2. LLM'nin metin üzerindeki nedenleri.

"Bu podcast'i özetlemek" için mükemmel çalışıyor. Şunun için başarısız:
- "Bu şarkının havası nasıl?" — ruh hali kelimelerde değil, sestedir.
- "Kim konuşuyor, Alice mi Bob mu?" — konuşmacının kimliğini gerektirir.
- "Patlama hangi saniyede oluyor?" — metinde zamansal temelin kaybolması.
- "Bu gerçek mi yoksa üretilmiş ses mi?" — Deepfake tespiti akustik özelliklere ihtiyaç duyar.

Uçtan uca akustik sinyali korur. Qwen-Audio ve AF3 müziği, ortamı ve duyguyu yerel olarak yönetir.

### 2026 üretim tarifi

Yeni bir ses anlama ürünü için:

- Basamaklı ise: hedef transkripsiyon ise, müzik yok, duygu yok inference.
- AF3 / Qwen-Audio ailesi eğer: müzik, duygu, çoklu hoparlör veya karmaşık ses muhakemesi.

Basamaklı daha ucuz ve daha basittir. Uçtan uca daha yeteneklidir.

### MMAU — ses muhakemesi benchmark

MMAU (Massive Multimodal Audio Understanding), 2024-2025 ses mantığı benchmark'dir:

- Konuşma, müzik ve çevresel sesler genelinde 10.000 sesli metin QA çifti.
- Sınıflandırmayı, zamansal akıl yürütmeyi, nedensel akıl yürütmeyi, açık uçlu QA'yı kapsar.
- Kademeli boru hatlarının sistematik olarak neyi gözden kaçırdığını test eder.

SOTA'yı (AF3) 0,72'de açın; tescilli sınır ~0,78 (Gemini 2.5 Pro, Claude Opus 4.7). Aradaki fark VideoMME'nin açık-kapalı deltasından daha küçük, bu da ses-LLM'lerin olgunlaştığını gösteriyor.

## Kullan onu

`code/main.py`:

- Stdlib'de log-Mel spektrogram hesaplamasını uygular: pencereleme, saf DFT, Mel filtre bankası.
- Ses Q-eski iskeleti: verilen kodlayıcı çıkış çerçeveleri, Q, K, V'yi hesaplar, dikkat eder ve N token'leri yayar.
- Bir oyuncak görevinde kademeli ve uçtan uca karşılaştırma.

## Gönderin

Bu ders `outputs/skill-audio-llm-pipeline-picker.md`'yi üretir. Bir ses görevi verildiğinde (transkripsiyon, müzik etiketleme, duygu inference, çok hoparlörlü günlük tutma, ortam sınıflandırması), basamaklı, uçtan uca AF3'ü veya bir hibriti seçer.

## Egzersizler

1. 16kHz'de, 25 ms pencerede, 10 ms atlamada, 80 Mel kutuda 30 saniyelik bir klip için log-Mel spektrogram boyutunu hesaplayın. Bu 48kHz'de nasıl değişir?

2. Whisper neden müzikte düşük performans gösteriyor? BEAT'ler Whisper'ın yakalayamadığı hangi ses özelliklerini yakalıyor?

3. 64 sorguya karşı 32 sorguya sahip Audio Q-former: 64, hangi görev karmaşıklığında işe yarar? 32 hesaplamayı ne için kaydetmelisiniz?

4. İsteğe bağlı düşünmeyle ilgili AF3 Bölüm 4'ü okuyun. Düşünce zincirinin en çok yardımcı olduğu üç ses görevi önerin.

5. AF3'ün çıktısını kullanarak minimal bir günlükleştirme hattı uygulayın. Konuşmacı değişikliklerini nasıl bildirirsiniz?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Log-Mel spektrogramı | "Mel'in özellikleri" | Mel filtre bankalarından sonra log-büyüklük değerlerinin 2B (zaman, frekans) dizisi |
| Ses Q-eski | "Ses Algılayıcısı" | Ses kodlayıcı çıkışından Yüksek Lisans'ı besleyen sabit uzunluklu sorgulara kadar çapraz dikkat darboğazı |
| Kademeli | "ASR-sonra-LLM" | Whisper'ın yazıya döktüğü boru hattı ve LLM'nin gerekçelerini içeren bir metin; akustik bilgiyi kaybeder |
| Uçtan uca | "Ses-Yüksek Lisans" | Ses özellikleri LLM'ye doğrudan Q-former aracılığıyla girer; akustik sinyali korur |
| BEAT'ler | "Audio AudioSet kodlayıcı" | SSL transformer AudioSet üzerinde eğitilmiştir; müzik + çevresel sesler konusunda güçlü |
| MMAU | "Ses muhakeme tezgahı" | Konuşma, müzik ve ortamda 10 bin QA çifti; 2024 değerlendirme standardı |
| İsteğe bağlı düşünme | "Ses CoT" | Model, isteğe bağlı olarak, son yanıttan önce token gerekçelerini yayınlayabilir, doğruluğu 3-5 puan artırır |

## Daha Fazla Okuma

-[Radford ve ark. — Fısıltı (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu ve ark. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel ve ark. — Ses Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang ve ark. — SOMON (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong ve ark. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
