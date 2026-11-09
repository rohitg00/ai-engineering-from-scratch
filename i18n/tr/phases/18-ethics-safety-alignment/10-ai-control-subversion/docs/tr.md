# AI Kontrolü  Devrimlere Karşı Güvenlik

> Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024). Kontrol güvenlik sorusunu yeniden çerçeveliyor: Size karşı olumsuz optimizasyon sağlayabilecek güvenilir olmayan güçlü bir model U'nun göz önüne alındığında, kabul edilemez bir sonuç olasılığını sınırlayanken yararlı çalışmayı çıkarmanıza hangi protokoller izin veriyor? Kaynaklar güvenilir bir zayıf model T, güvenilir insan iş gücü bütçesi H ve U'nun çıkışlarını düzenleme yeteneğidir. Bu çerçeve içinde, Güvenli Düzenleme Pareto, kod arka kapı görevlerinde güvensiz izleme üzerinde egemenlik kazanır. Çerçeve güvenlik mühendisliği'nden en kötü varsayımları miras alır: güvenlik, U'nun yerine gelen kırmızı takım basıncı altında ölçülen, karşı karşıya seçilen U'nun belirli kabul edilemez bir sonuca neden olamayacağı olasılığıdır.

**Type:** Learn
**Languages:** Python (stdlib, safety-vs-usefulness frontier on code-backdoor task), TypeScript
**Prerequisites:** Phase 18 · 07 (sleeper agents), Phase 18 · 08 (scheming), Phase 18 · 09 (alignment faking)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Yapay zeka Kontrol tehdidi modeli tanımlayın: güvenilmeyen güçlü model U, güvenilen zayıf model T, güvenilen insan bütçesi H.
- Güvenli Düzenleme protokolünü ve neden ICML 2024 kod arka kapı görevi üzerinde güvensiz izleme üzerinde Pareto'nun baskısı olduğunu açıklayın.
- Düzeltme (U güvenilir) ve kontrol (U güvenilir değil ve yine de güvendeyiz) arasındaki farkı açıklayın.
- Kontrolün üç sınırını belirtin: İnsanlar ölçeklenmez, güvenilir zayıf modeller sonunda geride kalır, kontrol güvenilir güçlü modeller üretmez.

## Sorun

Dersler 7-9 bir sınır modeli aldatıcı bir şekilde uyumlu, planlama veya sahte uyumlu olabilir. Güvenlik sorusu yeniden çerçeveliyor: Kabul edilemez sonuçlar getirme fırsatı vermeden güvenmediğimiz bir modelden yararlı çalışmalar elde edebilir miyiz? Bu kontrol sorunu ve klasik güvenlik gibi yapılandırılmış: en kötü durumda rakibi varsayın, bir protokol tasarlayın, kırmızı takım baskısı altında rakibin başarısı oranını ölçün.

## Anlaşım

### Tehdit modeli

Kontrol şu varsayımları yapar:
- U  güvenilmeyen güçlü model. Yetenekli. Muhtemelen karşıt (değerlendirme bunu öyle görüyor).
- Daha zayıf bir model, daha az yetenekli ama düşmanca olmayan biri.
- H  güvenilir insan gücü.

Sistem, U kullanarak yararlı bir çıkış üretmelidir. Düşman, yararlılık eşiğinde geçmek için meşru yararlı işlerin bir kısmını korurken, kabul edilemez bir sonuca neden olmaya çalışır (örneğin gönderilen kodda arka kapı).

Kontrol, U'ya güvenmeyi bırakır. Güven yokken hangi protokollerin güvenliğini koruduğunu sorar.

### ICML 2024 arka kapı görevi

U'nun, bir çözümün bir arka kapı içerdiği takdirde gizli bir oracle bayraklar (kodun yanlış bir çıkış üretmesini sağlayan belirli bir giriş). Kırmızı takım U'yu kontrol eder ve tüm protokol içsellerini görmesine izin verilir. Protokol, arka kapı nakliye hızını bir eşiğin altında tutarak çözülmüş sorun oranını en üst düzeye çıkarmalıdır.

### Dört protokol karşılaştırıldı

- **Baseline:**U gemisinin çıkışı doğrudan, maksimum kullanılabilirlik, güvenlik minimum.
- **Upfront auditing:**Tüm çıkışlarda H kullanın.
- **Untrusted Monitoring:**U'nun ikinci bir örneği ilk bir örneğin çıkışını puanlar; H, işaretli çıkışları denetler.
- **Trusted Editing:**T her sorguda U'nun çıkışını düzenler. T güvenmezse, H'ye yönlendirin.

Greenblatt et al. ' in bulduğu gibi güvenilir düzenleme Pareto-dominates güvensiz izleme: her güvenlik seviyesinde daha yüksek kullanışlılık.

### Neden Güvenli Düzenleme Başarıyor

Güvenilmeyen izleme U'nun ikinci durumunun ilk durumla koordinasyon yapamayacağını gerektirir. Kolluzyona steganografik ipuçları veya ortak eğitim öncesi yoluyla ulaşılabilir. Protokol, monitörün sinyalini azaltan bir anlaşmazlığa direnç (parafrasi, bulanıklık) bütçesini yatırım yapmalıdır. Güvenli Düzenleme, tamamen anlaşmazlıktan kaçınır çünkü T güvenilir  T'nin önerdiği herhangi bir düzenleme varsayımla karşıt değildir. Maliyet T'nin daha az yeteneği olması, yani ince arka kapıları aşırı reddedebilir veya kaçırır.

### Dört protokol eksesi

1. U'nun rolü: sadece üreticisi, monitör veya her ikisi de.
2. T'nin rolü nedir: editör, monitör veya resampler.
3. H'nin nasıl dağıtılması: birer denetim, rastgele denetim veya bayrak yönlendirilmiş denetim.
4. Protokolün anlaşma direnci için harcadığı miktarı hesaplayın.

### Düzeltme vs. kontrol

- Düzeltme: "Sana güvenmek için güvenli misin?" 2., 4., 5., 6., 7., 8. 9. dersler buna dayanır.
- Kontrol: "U'yu güvenmeden güvenli bir şekilde kullanabilir miyiz?" Ders 10.

Düzeltme, modelin bir özelliğidir. Kontrol, dağıtım protokolünün bir özelliğidir. Kontrol, düzeltme modellerini üretmez; düzeltme olmayan modellerin güvenli bir şekilde kullanımı sağlar. Her iki gündeme de gereklidir.

### Üç temel sınırlama

- İnsan ölçeklendirme yapmaz. H bütçesi zor AI çıkışlarını denetlemeyi isteyen insanların sayısıyla sınırlıdır.
- Güvenli zayıf modeller sonunda geride kalır. T U'dan çok daha zayıf olduğunda, T'nin düzenleme sinyali gürültü haline gelir.
- Kontrol bir uyum değildir. ASL-3'de (Desin 18) çalışan protokoller, T'yi manipüle edebilir veya H'nin denetim dağılımını akıl yürütürse, kontrol başarısız olabilir.

### 2025'in gelişiminin

UK AISI ve Redwood Kontrol Güvenlik Kazları (metr.org / redwoodresearch.org 2025) üzerinde işbirliği yapmaktadır: bir kontrol güvenliği vakaı, U hakkında en kötü varsayımlarda, protokol kabul edilemez bir sonuç olasılığını sınırlıyor. Güvenlik vakaları (Desin 18) kontrol çerçevesini miras alır.

### Bu 18 fazaya uygun.

Ders 6-9 tehdit ( aldatma mümkün) tanımlar. Ders 10 tehdit gerçek olduğu varsayımıyla savunma paradigmasını tanımlar. Ders 11 tamamlayıcı saldırı paradigmasını tanımlar (U'yu ölçeklenebilir denetim yoluyla güvenilir hale getirir).

```figure
al-control-protocol
```

## Kullan

`code/main.py`Oyuncak arka kapı görevinde dört protokolü simüle eder. U çıkışlar üretir; bir bölümü arka kapı (kırmızı takım politikası). T onaylar veya düzenlemeler yapar. H bir bütçe üzerine çağrılır. Pareto sınırını yeniden üretmek için bütçeyi ve anlaşma parametresini Greenblatt et al. 2024'te görüntüleyebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-control-protocol-audit.md`. Bir dağıtım protokolü açıklaması verildiğinde, U / T / H rollerini tanımlar, anlaşma vektörlerini isimlendirir ve protokolün kullanılabilirlik-güvenlik sınırında kırmızı takım basıncı altında konumunu tahmin eder.

## Egzersizler

1. Çık .`code/main.py`Güvenli Düzenleme ile Güvensiz Denetim için yararlılık-güvenlik sınırını yeniden üretmek.

2. Yeni bir protokol ekleyin: "T düşük sıcaklıkta yeniden örnekler, sonra U T'nin çıkışını düzenler".

3. 2024 makalesinde U'nun protokolü görebileceğini varsayıyor. U'nun denetlendiği çıkışlardan saklanan bir protokol tasarlıyor. Bu protokol yerleştirme altyapısından ne gerektirir?

4. Greenblatt et al. 2024 Bölüm 7 (koşulma) okuyun.

5. U = GPT-4 sınıfı, T = GPT-3.5 sınıfı, H = % 1 denetim edilen çıkışları kullanan bir dağıtım için bir kontrol güvenlik kazasını açıklayın. Kaza bağlı olan tek en güçlü varsayımı tanımlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AI Control | "safety under subversion" | Protocol design that bounds unacceptable outcomes under a worst-case U |
| Untrusted model (U) | "the strong model" | The capable model we want to extract work from but do not trust |
| Trusted model (T) | "the weak model" | A weaker model, known not to be adversarial, used as editor/monitor |
| Trusted human (H) | "the audit budget" | Bounded expert labor; expensive; the ground-truth signal |
| Trusted Editing | "T edits U" | Protocol where T is the gate on U's outputs; H called on ambiguous outputs |
| Untrusted Monitoring | "U monitors U" | Protocol where a second U instance scores outputs; collusion-resistant only with extra investment |
| Control safety case | "the formal argument" | Written argument that a protocol bounds the adversary's success under worst-case U |

## Daha Fazla Okumak

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942) Kanonik ICML 2024 kağıdı
- [Redwood Research — Recent AI Control papers index](https://redwoodresearch.substack.com/) 2024-2025 takipleri
- [UK AISI + METR — Control safety cases](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Sınır laboratuvarlarının operasyonelleştirilmesi
- [Hubinger et al. — Sleeper Agents (Lesson 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566) Tehdit modeli kontrolü varsayımları
