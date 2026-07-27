# Benchmarks: SWE-bank, GAIA, AgentBench

> 2026'da üç benchmarkbağlayıcı agent değerlendirmesi. SWE-bench, kod düzeltme ekini test ediyor. GAIA genel araç kullanımını test eder. AgentÇoklu ortam muhakemesini kıyaslama testleri. Bileşimlerini, kirlenme hikayelerini ve neyi ölçmediklerini bilin.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 06 (Alet Kullanımı)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- SWE-bench'in test donanımını (FAIL_TO_PASS) adlandırın ve ünite testlerinde neden geçit verdiğini açıklayın.
- SWE-bench Verified'ın (OpenAI, 500 görev) neden var olduğunu ve neleri kaldırdığını açıklayın.
- GAIA'nın tasarımını açıklayın: insanlar için basit, yapay zeka için zor; üç zorluk seviyesi.
- AgentBench'in sekiz ortamını ve açık kaynaklı LLM'ler için birincil engelleyicisini adlandırın.
- SWE-bench+ kontaminasyon bulgusunu ve sonuçlarını özetleyin.

## Sorun

Skor tabloları size bir benchmark modelde hangi modelin kazandığını gösterir. Size şunu söylemiyorlar:

- benchmark'nin kirlenip kirlenmediği (eğitim verilerindeki çözümler, test sızıntısı).
- benchmark'nin önemsediğiniz şeyi ölçüp ölçmediği (kod vs. tarama vs genelci).
- Değerlendiricinin sağlam olup olmadığı (AST eşleştirmesi, durum kontrolleri, insan incelemesi).

Bir rakam vermeden önce üç sabitleme benchmark'yi ve onların hata modlarını öğrenin.

## Konsept

### SWE-bank (Jimenez ve diğerleri, ICLR 2024 sözlü)

- 12 popüler Python deposundan 2.294 gerçek GitHub sorunu.
- Agent şunu alır: ön düzeltme işlemindeki kod tabanı + doğal dil sorunu açıklaması.
- Agent şunu üretir: bir yama.
- Değerlendirici: yamayı uygulayın, reponun test paketini çalıştırın. Düzeltme ekinin, PASS_TO_PASS testlerini bozmadan FAIL_TO_PASS testlerini (daha önce başarısız olan, şimdi başarılı olan) çevirmesi gerekir.

SWE-agent (Yang ve diğerleri, 2024), agent-bilgisayar arayüzlerini (dosya düzenleyici komutları, modelin anladığı arama sözdizimini) vurgulayarak piyasaya sürüldüğünde %12,5'e ulaştı.

### SWE tezgahı Doğrulandı

OpenAI, Ağustos 2024. İnsanların hazırladığı 500 görevlik alt küme. Belirsiz sorunları, güvenilmez testleri ve düzeltmenin belirsiz olduğu görevleri ortadan kaldırır. "agent cihazınız gerçek yamalar gönderiyor mu?" için birincil benchmark

### Kirlenme

- SWE-bench sorunlarının %94'ünden fazlası çoğu model kesintisinden öncesine dayanıyor.
- **SWE-bench+** başarılı yamaların %32,67'sinin sorun metninde çözüm sızdırdığını tespit etti (model, açıklamada düzeltmeyi gördü) ve %31,08'i zayıf test kapsamı nedeniyle şüpheliydi.
- Doğrulandı daha temizdir ancak kirlenmemiş değildir.

Pratik sonuç: SWE-bench'te %50 puan alan bir model, SWE-bench+'te %35 puan alabilir. SWE bench performansını iddia ediyorsanız her zaman her ikisini de rapor edin.

### GAIA (Mialon ve diğerleri, Kasım 2023)

- 466 soru; 300'ü huggingface.co/gaia-benchmark adresindeki özel skor tablosu için tutuldu.
- Tasarım felsefesi: "kavramsal olarak insanlar için basit (%92) ancak yapay zeka için zor (eklentili GPT-4: %15").
- Mantık yürütmeyi, çok-modluluğu, web ve araç kullanımını test eder.
- Üç zorluk seviyesi; Seviye 3, yöntemler arasında uzun alet zincirleri gerektirir.

GAIA, "genel yeteneği" ölçmek için çalıştırdığınız şeydir. Koda özgü benchmark'lerle karıştırmayın.

### AgentBench (Liu ve diğerleri, ICLR 2024)

- Kod (Bash, DB, KG), oyunlar (Alfworld, LTP), web (WebShop, Mind2Web) ve açık uçlu nesilde 8 ortam.
- Çoklu dönüş, bölünme başına ~4k-13k dönüş.
- Birincil bulgu: uzun vadeli akıl yürütme, karar verme ve talimatları takip etme, OSS Yüksek Lisans'larının reklamlara yetişmesini engelleyen engellerdir.

### Bunların neyi ölçmediği

- Gerçek dünyadaki işletme maliyeti (tokens, duvar saati).
- Zorlu koşullarda güvenlik davranışı.
- Alanınızdaki performans (kendi değerlendirmelerinizi kullanın, Ders 30).
- Kuyruk arızaları (benchmarkortalama; üretim operatörleri en kötü %1'i önemsiyor).

### benchmarkişlerin ters gittiği yer

- **Tek rakam sabitlemesi.** SWE-bench %50 size P50/P75/P95 maliyet + adım dağılımından daha azını anlatır.
- **Kirli iddialar.** Verified veya SWE-bench+'tan bahsetmeden SWE-bench'i raporlamak yanıltıcıdır.
- **Benchmark-as-development-target.** benchmark için optimizasyon, üretim kullanışlılığından farklıdır.

## İnşa Et

`code/main.py` oyuncak SWE bankına benzer bir koşum takımı uyguluyor:

- Sentetik hata düzeltme görevleri (3 görev).
- Yamalar öneren komut dosyasıyla yazılmış bir "agent".
- FAIL_TO_PASS (hata artık düzeltildi) ve PASS_TO_PASS'i (bozuk bir şey yok) kontrol eden bir test çalıştırıcısı.
- Soru ayrıştırma derinliğine dayalı GAIA tarzı bir zorluk sınıflandırıcısı.

Çalıştır:

```
python3 code/main.py
```

Çıktı, görev başına + zorluk başına çözüm oranını gösterir ve değerlendiricinin kurallarını somut hale getirir.

## Kullan onu

- agent kodu için **SWE-bench Onaylandı**. Her zaman Doğrulanmış puanları bildirin.
- **GAIA** genelci agent'lar için. Özel skor tablosu bölümünü kullanın.
- Çoklu ortam karşılaştırması için **AgentBench**.
- Ürününüzün gerçek şekli için **Özel değerlendirmeler** (Ders 30).

## Gönderin

`outputs/skill-benchmark-harness.md`, FAIL_TO_PASS / PASS_TO_PASS geçişine sahip herhangi bir kod tabanı-görev çifti için SWE tezgahı tarzı bir koşum takımı oluşturur.

## Egzersizler

1. Gerçek bir depoda çalıştırmak için oyuncak koşum takımını taşıyın (sizinkinden birini seçin). Bilinen hatalar için 3 FAIL_TO_PASS testi yazın.
2. Bir adım sayısı ölçüsü ekleyin. 3 görevinizde çözünürlük başına kaç agent adım var?
3. SWE-bench+ makalesini okuyun. Bir çözüm sızıntısı kontrolü uygulayın (sorun metnini farkla desen olarak eşleştirin).
4. Herkese açık bölümden bir GAIA sorusu indirin. GPT-4 sınıfı bir agent'nin ne yapacağını izleyin. Hangi araçlara ihtiyacı var?
5. AgentBench'in ortam bazında dökümünü okuyun. Ürününüzün yüzeyini hangi ortam yansıtıyor? "SOTA" orada neye benziyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| SWE-bank | "Kod agent benchmark" | 2.294 GitHub sorunu; yama FAIL_TO_PASS testlerini çevirmelidir |
| SWE tezgahı Doğrulandı | "SWE tezgahını temizleyin" | İnsanların hazırladığı 500 görev, OpenAI |
| FAIL_TO_PASS | "Kapıyı düzelt" | Daha önce başarısız olan ve yamadan sonra geçmesi gereken testler |
| PASS_TO_PASS | "Regresyonsuz kapı" | Geçmekte olan ve hala geçmesi gereken testler |
| GAİA | "Genel Uzman benchmark" | 466 insan tarafından kolay / yapay zeka ile zor çok amaçlı soru |
| AgentBank | "Çok ortamlı benchmark" | 8 ortam; uzun ufukta çok dönüşlü |
| Kirlenme | "Eğitim seti sızıntısı" | Model eğitiminde Benchmark görev mevcut |
| SWE-bank+ | "Kirlilik denetimi" | Başarılı SWE-bench yamalarında %32,67 oranında çözüm sızıntısı bulundu |

## Daha Fazla Okuma

- [Jimenez ve diğerleri, SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) — orijinal benchmark
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — seçilmiş alt küme
- [Mialon ve diğerleri, GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) — genelci benchmark
- [Liu ve diğerleri, AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) — çoklu ortam paketi
