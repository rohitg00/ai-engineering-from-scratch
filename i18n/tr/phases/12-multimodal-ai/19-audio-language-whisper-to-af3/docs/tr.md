# Sesli Dil Modeller: Sesli Flamingo 3 Arc'a Şapışmak

> Whisper (Radford et al., Aralık 2022) konuşma tanıma  680k saat zayıf denetimli çok dilli konuşma, basit bir kodlayıcı-dekoder dönüştürücü, sonraki her ASR yayınını alıntı yapan bir referans değerini ayarladı. Ama tanınmak mantık değildir. "Bu kayıtta hangi aletler var?" ya da "sonucu ne duygu ifade ediyor?" ya da "üçüncü dakikada ne oldu?" sormak, ses anlayışını gerektirir, metinleri değil. Qwen-Audio, SALMONN, LTU ve NVIDIA'nın Audio Flamingo 3 (AF3, Temmuz 2025) bu yığınını aşamalı bir şekilde inşa etti: Whisper sınıfı kodlayıcıları tutun, Q-formörleri üzerine kurşun, ses metni talimat verileri üzerinde eğitim verin, düşünce zinciri mantıklılığı ekleyin. Bu ders, bir süreliğine ilerliyor.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Bir dalga şekli ile bir log-Mel spektrogramı hesaplayın: pencereler, FFT, filtre bankaları, log dönüşümü.
- Şapışkan şapışkan, BEAT, AF-Şapışkın hibrid seçeneklerini karşılaştır.
- Spektrogram yamalarına karşı çalışarak bir ses Q-former oluşturun: N öğrenilebilir sorular.
- Kaskadel (Shisper-then-LLM) vs. sonundan sonuna kadar ses-LLM eğitimini açıklayın: neden sonundan sonuna kadar düzeyleri akıl yürütmek için daha iyi.

## Sorun

Konuşma tanıma, Whisper tarafından çözüldü. Ses OCR bir maldır. Ancak "mal" transkripsiyonda durur. Eğer model duyduğu şeyi akıl yürütemiyorsa  zamanlama, hoparlörler, duygu, müzik yapısı, çevresel sesler  tek başına transkripsiyon ürün özelliklerini yönlendirebilir.

Üç açık yol:

1. Cascade: Whisper transkripte, LLM transkripte nedenler. saf konuşma senaryoları için çalışır. Müzik için başarısız, çevresel ses, çoklu hoparlör üst üstelik, duygu.

2. Sonundan sonuna kadar ses-LLM: bir ses kodlayıcı ses jetonlarını doğrudan bir LLM'ye ekler, transkripsiyonu atlar. Akustik bilgileri (duygu, hoparlör, ortam) korur. Yeni eğitim verilerine ihtiyaç duyar.

3. Hibrit: ses kodlayıcı + hem yazıp hem de mantık edebilen metin dekodörü. Qwen-Audio ve Audio Flamingo bu yolu seçer.

## Anlaşım

### Log-Mel spektrogramı: Giriş özelliği

Her ses kodlayıcı aynı özellikle başlar: bir log-Mel spektrogramı.

1. 16 kHz'e yeniden örnekleme.
2. Kısa süreli Fourier dönüşümü 25 ms pencereleri ile, 10 ms atlama.
3. FFT sonucu büyüklüğünü alın.
4. Merak frekansına warp için Mel filtre bankalarını (genellikle 0-8000 Hz log-spaced 80 filtre) uygulayın.
5. Çap kompressi$(\log(1 + x))$Dinamik aralığı için.

Sonuç: T'nin zaman çerçeveleri sayısının olduğu şekil 2 boyutlu bir dizi (T, 80) .

### Şapışkan'ın kodlayıcı

Whisper'in kodlayıcı, 12 katlı ViT tarzı transformatördür ve log-Mel spektrogramını zaman çerçeveleri olarak işlemektedir.

ASR için, Whisper'in dekodörü, kodlayıcı çıkışına bağlı metin işaretlerini oluşturan çapraz bir dikkat transformörüdür.

ALM (audio-LLM) için, kodlayıcı çıkışını farklı bir LLM'ye giriş olarak istiyorsunuz. Şablon: Sisper kodlayıcı dondurulmuş, Q-eski eğitimli, LLM dondurulmuş veya ayarlanmış.

### BEAT ve ses özel kodlayıcılar

Whisper konuşma baskın verileri üzerinde eğitilmiştir.

BEATs (Chen et al., 2022) AudioSet üzerinde eğitilmiş bir kendiliğinden denetimli bir dönüştürücüdür.

AF-Whisper (Audio Flamingo 3'ün kodlayıcı): Whisper-large-v3 kodlayıcısından başlayın ve konuşma, ses ve müzik üzerinde birlikte eğitmeye devam edin, böylece bir kodlayıcı hem dilsel hem de akustik sinyal taşır.

### Sesli Q-former

BLIP-2'nin görsel Q-former ile aynı kalıp. Bir dizi öğrenilebilir sorgu (sık sık 32 veya 64) ses kodleyicisinin çıkış çerçeveleri üzerinde çapraz olarak katılır. Sorgular LLM tarafından tüketilen ses jetonları haline gelir.

Eğitim ayarlama aşaması: tek başına Q-former, audio-metin çiftlerinde kontrastlı + başlık kaybı (AudioCaps, Clotho).

### Ark  SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA. Ciddi bir akıl yürütme yeteneği olan ilk açık ses-LLM. MMAU'daki değerler ~0.55 bileşik gösterir.

Qwen-Audio (Chu et al., 2023): benzer mimarlık, daha zengin bir veri kümesi üzerinde eğitilmiş, çok dönüşlü diyalog için ayarlanmıştır. MMAU ~ 0.60.

LTU  Dinle, Düşün, Anla (Gong et al., 2023): açık mantık verileri, ses klipleri üzerinde düşünce zinciri odaklan. Daha küçük ama daha odaklı.

Audio Flamingo 3 (Goel et al., Temmuz 2025): mevcut açık SOTA. 7B LLM omurgası (Qwen2.5-7B), Whisper-large-v3'den inşa edilmiş bir AF-Whisper ses kodlayıcı, LLM'ye küçük adaptör katmanları, 1M+ ses-metin talimat çiftleri üzerinde eğitim. MMAU 0.72, bazı alt görevlerde özel sınırla eşleşir.

AF3 ayrıca ses için talep üzerine düşünce zinciri de sunar: model, son cevabın öncesinde düşünce belirtileri ("al önce aletleri tanımlayacağım: ...") seçeneği olarak yayılabilir. Karmaşık akıl yürütme görevlerinde doğruluk düşünce etkinleştirildiğinde 3-5 puan yükselmektedir.

### Kaskadör vs. uçtan sonuna

Su içi boru hattı:

1. Whisper ses → metni transkripte eder.
2. - Yazıyı kullanmak için nedenler.

"Bu podcast'i özetle" için mükemmel bir şekilde çalışır.
- "Bu şarkının ruh halini ne?"  ruh halini ses, kelimeler değil.
- "Kim konuşuyor, Alice mi Bob mu?"  konuşmacı kimliğini belirleme gerektirir.
- "Plomba ne zaman gerçekleşir?"  Zamanlı yerleşim metinde kayboldu.
- "Bu gerçek mi yoksa üretilmiş mi?"  Deepfake algılama akustik özelliklere ihtiyaç duyar.

Sonundan sonuna kadar ses sinyali korunur. Qwen-Audio ve AF3 müzik, çevre ve duyguları doğal olarak ele alıyor.

### 2026 üretim tarifi

Yeni bir ses anlama ürünü için:

- Eğer: transkripsiyon amacımızsa, müzik yok, duygusal sonuç yok.
- AF3 / Qwen-Audio-aile: müzik, duygu, çok konuşmacı veya karmaşık ses düşüncesi.

Kaskadör daha ucuz ve daha basit.

### MMAU  sesli akıl yürütme referans değerini

MMAU (Massive Multimodal Audio Understanding) 2024-2025 ses akıl yürütme referansıdır:

- 10.000 sesli metin, konuşma, müzik, çevresel sesler arasında birleştirilmiş.
- Sınıflandırma, zamansal akıl yürütme, nedensel akıl yürütme, açık bir şekilde sorgulanma kapsamını kapsar.
- Kaskadör boru hattlarının sistematik olarak kaçırdığı şeyleri test eder.

Açık SOTA (AF3) 0,72; özel sınır ~ 0,78 (Gemini 2.5 Pro, Claude Opus 4.7).

```figure
audio-text-ctc
```

## Kullan

`code/main.py`- ...

- Stdlib'de log-Mel spektrogram hesaplamalarını uyguluyor: pencereler, saf DFT, Mel filtre bankası.
- Audio Q- eski iskelet: verilen kodlayıcı çıkış çerçeveleri, hesap Q, K, V, dikkat ve N simgeler gönderir.
- Oyuncak görevinde kaskadör karşı karşılaştırma.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-audio-llm-pipeline-picker.md`. Sesli bir görev (transkripsiyon, müzik etiketleme, duygu çıkarımı, çoklu hoparlör günlükleştirme, ortam sınıflandırması) verildiğinde, kaskad, uçtan sonuna AF3 veya hibrid seçilir.

## Egzersizler

1. 16kHz, 25ms penceresi, 10ms hop, 80 Mel kutuları için 30 saniyelik bir klip için log-Mel spektrogram boyutunu hesaplayın.

2. Whisper'in müzikte performansı neden düşük?

3. 64 sorusu ile 32 sorusu olan Audio Q-former: 64 hangi karmaşıklıklı görevin karşılığında ödüllendirilir? 32 hesaplama ne için?

4. AF3 Bölüm 4'ü okuyun. İsteğe bağlı düşünme.

5. AF3'in çıkışını kullanarak minimal günlükleştirme borusunu uygulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## Daha Fazla Okumak

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
