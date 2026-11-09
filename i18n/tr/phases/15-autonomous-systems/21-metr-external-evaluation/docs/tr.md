# METR Zaman Uçakları ve Dış Yetenek Değerlendirme

> METR (ex-ARC Evals), Aralık 2023'ten beri bağımsız bir 501(c)(3) kuruluşu. Time Horizon 1.1 referans değerleri (Ocak 2026) görev başarısı olasılığı ile log ((insan uzmanı tamamlama zamanı) arasındaki lojistik bir eğriye uyar; %50 olasılıkla kesişme modelin zaman ufkunu tanımlar. 20252026 görev kümesi GPT-5.1, GPT-5.1-Codex-Max ve prototip izleme değerlendirmelerini kapsar (monitor yakalama yan görevleri yapabilir; ajan kaçınabilir). Benchmark suites: HCAST (180+ ML, cyber, SWE, akıl yürütme görevleri; 1 dakika ila 8+ saat), RE-Bench (71 ML araştırma- mühendislik görevleri uzman tabanı ile), SWAA. Dürüst bir not: METR ölçümleri idealize edilmiştir  insanlık yok, gerçek sonuçlar yok  ve ekip değerlendirme vs. dağıtım davranış boşluğu (Desin 1) belgelenmiştir. Zaman ufku bir üst sınır, bir yerleşim tahmin değil.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## Sorun

Ölçekleme politikaları (Lection 19, 20) sadece referansları olan ölçümler kadar yararlıdır. "AI R&D-4 eşiği" ve "Uzun mesafeli özerklik" politika prozasında tanımlanır; sadece belirli değerlendirmeler belirli sayıları ürettiğinde uygulanabilir hale gelir.

METR, bu rakamların çoğunu tanımlayan 20242026 dış değerlendirme örgütüdür. Sınır modelleri  genellikle önceden yayınlanır, NDA ile laboratuvarlar  altında değerlendirilir ve daha sonra metodoloji yayınlanır. Time Horizon 1.1 referans göstergesi (Ocak 2026) başlık eseridir: tek bir skalar, yetenekleri insan okuyabilir bir birime sıkıştırır ("bu model, bir uzmanın %50 güvenilirlik ile X saat harcadığı türde bir görevi yapabilir").

Ders kısmen metodoloji (bir ufuk nasıl hesaplanır) ve kısmen yorumlama (bir ufuk neden bir üst sınırdır, bir dağıtım tahmin değil) ile ilgilidir.

## Anlaşım

### METR arka planı

- Aralık 2023'te kuruldu (eski ARC Evals, bağımsız 501 ((c) ((3)) olarak ayrıldı).
- Kapsam: Sınır modellerinin özerk yeteneklerinin değerlendirilmesi, genellikle önceden yayınlanmaktadır.
- Ortak laboratuvarlar: Anthropic, OpenAI (çoklu görevler 20252026).
- Görülen sonuçlar: Time Horizon 1.0 (Mart 2025), Time Horizon 1.1 (Ocak 2026), prototip izleme değerlendirmeleri.

### Zaman Uçaklığı

Metodoloji (METR blogundan ve makaleleri):

1. Dakika ölçeği ile saat ölçeği uzman tamamlama süreleri arasında bir görev kümesi toplayın.
2. Her görev için model çalıştırın; başarıyı ya da başarısızlığı kaydetin.
3. Bir lojistik eğriyi ayarlayın: $P(\text{success})$$\log(\text{expert completion time})$- Evet .
4. Uçaklık, P ((başarılılık) = 0.5'in uzman zamanıdır.

Logistik uygunluk şekli doğru bir şekildir çünkü yetenek genellikle görev zorluğu ile yükselen, plato yaklaşımlı bir ilişkiye sahiptir. 50% noktası bir seçimdir (% 10 olabilir,% 90); METR ayrıntılı kağıda birden fazla eşiği bildirir, ancak en sezgisel olduğu için % 50 ile liderlik eder.

### 2026 Ocak sayıları

Zaman Uzaklığı 1.1:

- Claude Opus 4.6: Time Horizon 1.1 (Ocak 2026) itibariyle %50 güvenilirlik ile ~14 saat.
- HCAST tarzı görevlerde iki katlama süresi: ~4.3 ay (130.8 gün) Time Horizon 1.1 tarafından bildirilen 2023 sonrası uyum için (Ocak 2026); ~7 aylık rakam Time Horizon 1.0'dan tam 20192025 uyum için ve TH1.1 ile 2023 sonrası sayı ile birlikte bildirilmiştir.

Bu, 15'inci aşamada bulunan diğer referansların belirli sayılarıdır. Anthropic'in RSP v3.0 (Denevi 19) ve DeepMind'in FSF v3 (Denevi 20) 'de eşiği değerlendirmeleri sağlayan ölçümlerden biri olarak alıntılanmıştır.

### Benchmark suiteları

- **HCAST**: 189 görev, siber güvenlik, yazılım mühendisliği ve genel akıl yürütme alanında.
- **RE-Bench**: 71 ML araştırma- mühendislik görevleri insan uzmanı bir temel çizgi ile. Modelin AI R&D-4 e sahip olan ML T&D çalışmalarını yapabilecek-eceğini ölçer.
- **SWAA**: daha kısa görevler; ufak bir ufaklık eğriğinin alt ucunu kalibre etmek için kullanışlıdır.

### Prototyp izleme değerlendirmeleri

20252026 METR çalışması, izleme-değerlendirme prototiplerini içeriyordu: bir monitör yan görev yapan bir modeli yakalayabilir mi (operatörün istediği dışında bir şey); ajan monitörden kaçıyor mu? Bular doğrudan OpenAI PF v2'deki "Kafetleri azaltma" kategorisini ve DeepMind FSF v3'deki yanıltıcı uyum izlemeyi besler (Desin 20).

### Neden ufuklar üst sınırlar

- **Idealized tooling**Bu nedenle, bu işlerin yapılması için, modelin işlevlerini ve işlevlerini kontrol etmek gerekir.
- **No real consequences**Modelle hiçbir zaman gerçek bir müşteriye fatura çekmez, gerçek verileri silmez veya gerçek insanlarla temas etmez.
- **Eval-context gaming**Ders 1. Testlerde modeller farklı davranır. 2026 Uluslararası AI Güvenlik Raporu bunu empirize olarak belgelendirir.
- **No legitimate user variance**Benchmark istekleri yapılandırılmıştır. Gerçek kullanıcılar belirsiz, bağlamlara bağlı istekler üretir.

Uyumlu koşullarda kapasite tavanı ufaklık. Deployment güvenilirliği farklı bir sayı, daha düşük ve ekipler bunu bilmek için kendi dağılım ölçmek gerekir.

### Dış değerlendirici durum

Dış değerlendirme önemlidir çünkü iç laboratuvarlar rapor ettikleri ölçümleri optimize etmek için teşviklere sahiptir. METR'nin bağımsızlığı  bir 501(c)(3) açıklanmış bir metodoloji ve eşcinsel inceleme makaleleriyle  yapısal hafifletme. Tek başına yeterli değildir (laborlar hala METR'nin gördüğünü kontrol eder), ancak hiçbir dış değerlendirme olmaktan kesinlikle daha iyidir.

### Uygulamalarda ufuk sayıları nasıl kullanılır

- **As a capability filter**: Eğer bir modelin ufukları önerilen bir görevin uzmanlık süresinden çok daha aşağıysa, onu kendiliğinden göndermeyin (Lesson 1'in beceri dosyası).
- **As a trend indicator**: iki katlama süresi, yeni hafiflemeler olmadan da mevcut uygulama ne kadar süre güvenli kalacağını gösterir.
- **As a prior**Görev dağılımınız, araç kaliteniz ve dağıtım bağlamınız için ayarlayın.

```figure
a5-horizon-fit
```

## Kullan

`code/main.py`Görev başarısı vs.$\log(\text{expert time})$Bu, %50 ufku (METR başlığı), %10 ufku (sağlam) ve %90 ufku (iyi niyetli) rapor eder.

## Gönder

`outputs/skill-horizon-interpretation.md`Bir satıcının ufuk iddiasını gözden geçirir ve referans değer iddiası ile uygulama gerçekliği arasındaki boşluk analizini yapar.

## Egzersizler

1. Çık .`code/main.py`- Düzeltme %50 ufkunun sentetik yer gerçeğiyle uyumlu olduğunu doğrulayın. Şimdi görev zaman çubuğunu yarıya indir. ufkun değişimi anlamlı bir şekilde tahmin ediyor mu?

2. METR'nin Time Horizon 1.1 blog yazısını okuyun. Güvenliğin en yüksek ve en düşük olduğu belirli görevleri belirleyin.

3. METR'nin "Autonom Yapay zeka yeteneklerini ölçmek" kaynaklarını okuyun. HCAST görev kategorilerini listelenin. Bir üretim görevi için daha ağır ağır ağırlık vereceğiniz bir kategorisi seçin ve nedenini haklı çıkarın.

4. Simülatörde eval-context oyunlarını kullanın: başarısız görevlerin %20'ini başarıyla döndürün. Yeni ufku rapor edin. Bu,%20'lik bir oyun oranının gözlemlenen sayıya ne yaptığını yakındır.

5. Kendi hata arka kaydı veya temsilci bir görev kümesi üzerinde iç ufuk değerlendirmesini tasarlayın. Verilerin toplanmasını, uyumunu ve çıkışın size ne söylediğini açıklayın. METR sayıları ile karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Daha Fazla Okumak

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) HCAST, RE-Bench, SWAA özellikleri.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) orijinal ufuk kağıdı.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) mevcut sayı ve yöntem.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons)- Canlı izleme.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) METR'nin ölçümleri için iç perspektif.
