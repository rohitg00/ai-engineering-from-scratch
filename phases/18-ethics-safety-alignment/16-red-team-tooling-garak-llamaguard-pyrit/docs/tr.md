# Kırmızı Takım Takımlama — Garak, Llama Guard, PyrRIT

> Üç üretim aracı, 2026 kırmızı takım yığınını çerçeveliyor. Llama Guard (Meta) — 14 MLCommons tehlike kategorisine göre hassas şekilde ayarlanmış bir Llama-3.1-8B sınıflandırıcısı; 2025 Llama Guard 4, Llama 4 Scout'tan budanmış, 12B yerel multimodal bir sınıflandırıcıdır. Garak (NVIDIA) — halüsinasyon, veri sızıntısı, prompt enjeksiyonu, zehirlilik ve jailbreak'lere karşı statik, dinamik ve uyarlanabilir problara sahip açık kaynaklı LLM güvenlik açığı tarayıcısı. PyRIT (Microsoft) — Crescendo, TAP ve derin kullanım için özel dönüştürücü zincirleri içeren çok turlu kırmızı takım kampanyaları. Llama Guard 3, Meta'nın "Llama 3 Herd of Models" (arXiv:2407.21783) belgesinde belgelenmiştir; arXiv'de Llama Guard 3-1B-INT4:2411.17713; github.com/NVIDIA/garak'taki Garak'ın araştırma mimarisi. Bu araçlar, kırmızı takım araştırması (Ders 12-15) ve deployment (Ders 17+) arasındaki 2026 üretim arayüzüdür.

**Tür:** Yapım
**Diller:** Python (stdlib, araç mimarisi simülatörü ve Llama Guard tarzı sınıflandırıcı modeli)
**Önkoşullar:** Aşama 18 · 12-15 (jailbreak'ler ve IPI)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Llama Guard 3/4'ün güvenlik yığınındaki konumunu açıklayın: giriş sınıflandırıcı, çıkış sınıflandırıcı veya her ikisi.
- 14 MLCommons tehlike kategorisini adlandırın ve açık olmayan bir tanesini belirtin (Kod Yorumlayıcının Kötüye Kullanımı).
- Garak'ın sonda mimarisini tanımlayın: sondalar, dedektörler, donanımlar.
- PyRIT'in çok yönlü kampanya yapısını ve Garak sondalarıyla nasıl birleştiğini açıklayın.

## Sorun

12-15. dersler saldırı yüzeyini sunar. Üretim deployment'lerin tekrarlanabilir, ölçeklenebilir değerlendirmeye ihtiyacı vardır. 2026'ya üç araç hakim: Llama Guard (savunma sınıflandırıcı), Garak (tarayıcı), PyRIT (kampanya orkestratörü). Her biri kırmızı takım yaşam döngüsünün farklı bir katmanını hedefliyor.

## Konsept

### Lama Muhafızı (Meta)

Llama Guard 3, MLCommons AILuminate 14 kategorisine göre giriş/çıkış sınıflandırması için ince ayar yapılmış bir Llama-3.1-8B modelidir:
- Şiddet içeren suçlar, şiddet içermeyen suçlar, cinsiyetle ilgili, CSAM, hakaret
- Uzman tavsiyesi, gizlilik, fikri mülkiyet, ayrım gözetmeyen silahlar, nefret
- İntihar/kendine zarar verme, cinsel içerik, seçimler, kod yorumlayıcısının kötüye kullanılması

8 dili destekler. Kullanım: LLM'den önce (girdi moderasyonu), LLM'den sonra (çıktı moderasyonu) veya her ikisinde birden yerleştirin. Her iki kullanım da farklı eğitim dağılımları yaratıyor; Llama Guard 3, her ikisini de tek bir model olarak taşıyor.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, mobil CPU'da ~30 tokens/s) kuantize edilmiş kenar çeşididir.

Llama Guard 4 (Nisan 2025), doğal olarak multimodal olan 12B'dir ve Llama 4 Scout'tan budanmıştır. Hem 8B metin hem de 11B görüntü öncüllerini, metin + görüntüleri alan tek bir sınıflandırıcıyla değiştirir.

### Garak (NVIDIA)

Açık kaynaklı güvenlik açığı tarayıcısı. Mimari:
- **Sondalar.** Halüsinasyon, veri sızıntısı, prompt enjeksiyonu, zehirlilik, jailbreak'ler için saldırı oluşturucular. Statik (sabit prompt'lar), dinamik (oluşturulan prompt'lar), uyarlanabilir (hedef çıktıya yanıt verir).
- **Dedektörler.** Çıktıları, zehirli, sızdırılmış, jailbreakli gibi beklenen hata modlarına göre puanlayın.
- **Harnesses.** Prob-dedektör çiftlerini yönetin, kampanyalar yürütün, raporlar oluşturun.

TrustyAI, uçtan uca korumalı hedef değerlendirmesi için Garak'ı Llama-Stack kalkanlarıyla (Prompt-Guard-86M giriş sınıflandırıcı, Llama-Guard-3-8B çıkış sınıflandırıcı) entegre eder. Katman tabanlı puanlama (TBSA), ikili başarılı/başarısızın yerini alır; bir model, aynı araştırmada önem düzeyi 3'te geçebilir ve önem düzeyi 5'te başarısız olabilir.

### PyrIT (Microsoft)

Python Risk Tanımlama Araç Seti. Çok dönüşlü kırmızı takım kampanyaları. Etrafında inşa edilmiş:
- **Dönüştürücüler.** Bir çekirdeği dönüştürün prompt — başka kelimelerle ifade edin, kodlayın, çevirin, rol oynayın.
- **Orkestratörler.** Kampanyayı çalıştırın: Crescendo (yükseltme), TAP (dallanma), RedTeaming (özel döngü).
- **Puanlama.** Yargıç olarak Yüksek Lisans veya yargıç olarak sınıflandırıcı.

PyrRIT, Garak'ın daha ağır kuzenidir. Garak binlerce tek dönüşlü sondayı çalıştırıyor; PyRIT, belirli başarısızlık modlarını kırmak için tasarlanmış derin, çok dönüşlü kampanyalar yürütür.

### Yığın

Modelin her iki tarafına da Llama Guard'ı yerleştirin. Gerileme için Garak'ı her gece çalıştırın. Yayın öncesi kampanyalar için PyRIT'i çalıştırın. Bu, çoğu üretim deployment'ler için 2026 varsayılan yapılandırmasıdır.

### Değerlendirme tuzakları

- **Yargıç kimliği.** Her üç araç da bir Yüksek Lisans jürisi kullanabilir; kalibrasyon sürücülerinin rapor ettiği ASR'leri değerlendirin (Ders 12). Aracın yanında hakimi belirtin.
- **Bayatlığı araştırın.** Garak, modeller onlara yamandıkça yaşlanmayı araştırıyor. Adaptif problar (ÇİFT şekilli) statik problara göre daha yavaş yaşlanır.
- **İyi huylu içerik hakkında Llama Guard FPR.** İlk Llama Guard versiyonları siyasi ve LGBTQ+ içeriklerini aşırı işaretliyordu; Llama Guard 3/4 kalibrasyonları iyileştirildi ancak -deployment'ye göre kalibre edilmedi.

### Bunun 18. Aşamada yeri nedir

12-15. dersler saldırı aileleridir. Ders 16 üretim araçlarıdır. Ders 17 (WMDP), ikili kullanım kapasitesinin değerlendirilmesidir. Ders 18, bu araçları bir politika yapısına saran sınır güvenliği framework'lerdir.

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak bir Llama Guard tarzı sınıflandırıcı (14 kategoride anahtar kelime + anlamsal özellikler), bir oyuncak Garak koşum takımı (sonda-dedektör döngüsü) ve bir PyRIT tarzı çok turlu dönüştürücü zinciri oluşturur. Üç aracı sahte bir hedefe karşı çalıştırabilir ve farklı kapsama imzalarını gözlemleyebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-red-team-stack.md` üretir. Bir deployment açıklaması verildiğinde, üç araçtan hangisinin uygun olduğunu, her birinde neyin yapılandırılacağını ve hangi regresyon temposunun çalıştırılacağını belirtir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Llama-Guard tarzı sınıflandırıcının tek dönüşlü ve çok dönüşlü saldırılardaki algılama oranını karşılaştırın.

2. Yeni bir Garak araştırması uygulayın: base64 kodlu zararlı bir istek. Llama-Guard tarzı sınıflandırıcıyla tespitini ölçün.

3. PyRIT tarzı dönüştürücü zincirini "Fransızcaya çevir, ardından başka sözcüklerle ifade et" dönüştürücüyle genişletin. Saldırı başarısını yeniden ölçün.

4. Llama Guard 3'ün tehlike kategorisi listesini okuyun. Eğitim verilerinin meşru geliştirici içeriğinde gerçekçi bir şekilde yüksek hatalı pozitif oranlar üreteceği iki kategori belirleyin.

5. Garak ve PyrIT'in tasarım ilkelerini karşılaştırın. Her birinin doğru araç olduğu bir deployment için tartışın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Lama Muhafızı | "sınıflandırıcı" | 14 tehlike kategorisine sahip hassas ayarlı Llama-3.1-8B/4-12B güvenlik sınıflandırıcısı |
| Garak | "tarayıcı" | NVIDIA açık kaynaklı güvenlik açığı tarayıcısı; problar, dedektörler, donanımlar |
| PyrIT | "kampanya aracı" | Microsoft çok dönüşlü kırmızı takım orkestratörü; dönüştürücüler, orkestratörler, skorlama |
| Prompt-Muhafız | "küçük sınıflandırıcı" | Meta'nın 86M prompt-enjeksiyon sınıflandırıcısı, Llama Guard |
| TBSA | "kademe bazlı puanlama" | Garak'ın ikili sonuçların yerini alan kademe bazlı başarılı/başarısız yöntemi |
| Dönüştürücü zinciri | "açıklama + kodlama + ..." | Çok adımlı saldırılar oluşturmak için ilkel PyRIT bileşimi |
| MLCommons tehlike kategorileri | "14 taksonomi" | Endüstri standardı sınıflandırma Llama Guard hedefleri |

## Daha Fazla Okuma

- [Meta — Llama Guard 3 (Llama 3 Herd makalesinde, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B sınıflandırıcısı
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — nicemlenmiş mobil sınıflandırıcı
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — tarayıcı deposu ve belgeler
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — kampanya araç seti
