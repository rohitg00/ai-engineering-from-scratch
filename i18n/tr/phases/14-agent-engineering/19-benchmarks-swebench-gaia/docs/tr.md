# Benchmarks: SWE-bench, GAIA, AgentBench

> SWE-bench testleri kod patching. GAIA genel araç kullanımı testleri. AgentBench çok çevre mantıklama testleri. Kompozisyonlarını, kirliliği hikayesini ve ölçmediği şeyleri bil.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- SWE-benç test harnasının (FAIL_TO_PASS) adını verin ve neden birim testlerinde kapıları olduğunu açıklayın.
- SWE-bench Verified (OpenAI, 500 görev) neden var olduğunu ve neyi kaldırdığını açıklayın.
- GAIA'nın tasarımı anlatın: insanlar için basit, AI için zor; üç zorluk seviyesi.
- AgentBench'in sekiz ortamını ve açık kaynaklı LLM'ler için ana engelleyici adını verin.
- SWE-bench+ kirliliği bulgularını ve sonuçlarını özetleyin.

## Sorun

Ranger tabloları size bir referans değerinde hangi modelin kazandığını söyler.

- Referans değerinin kirlenmiş olup olmadığını (öğretim verilerindeki çözümler, test sızması).
- Benchmark neyi önemsediğinizi ölçüyor mu (kod vs. tarama vs. genel).
- Değerlendirici'nin sağlam olup olmadığı (AST eşleşimi, devlet kontrolleri, insan incelemesi).

Bir rakamı alıntılamadan önce üç demirleme referansını ve başarısızlık modlarını bil.

## Anlaşım

### SWE-benç (Jimenez et al., ICLR 2024 oral)

- 12 popüler Python depolarından 2.294 gerçek GitHub sorunu.
- Ajan alır: ön ayarlı komisyonun kod tabanı + doğal dil sorununun açıklaması.
- Ajan üretir: bir yama.
- Değerlendirici: patch uygulamak, repo'nun test paketini çalıştırmak. Patch, PASS_TO_PASS testlerini kırmadan FAIL_TO_PASS testlerini (önceden başarısız, şimdi geçiyor) çevirmelidir.

SWE-agent (Yang et al., 2024), ajan-bilgisayar arayüzlerini vurgulayarak (file editörü komutları, modelin anladığı arama sentaksı) serbest bırakılmasında % 12,5'e ulaştı.

### SWE-benç Verified

OpenAI, Ağustos 2024. İnsan tarafından kurate edilen 500 görev alt kümesi. Açıklama belirsiz olan sorunları, güvenilir olmayan testleri ve çözülmeyen görevleri ortadan kaldırır.

### Kirlilik

- SWE-benç sorunlarının %94'ü çoğu model kesintiden önceydi.
- **SWE-bench+**Başarılı yamaların %32,67%'i sorun metinde sızmış çözümler buldu (model açıklamada düzeltmeyi gördü) ve %31,08%'i zayıf test kapsamı nedeniyle şüpheli oldu.
- Kontrol edilmiş daha temiz ama kirlenmeden değil.

Pratik anlam: SWE-benç üzerinde %50 puan alan bir model SWE-benç üzerinde %35 puan alabilir.

### GAIA (Mialon et al., Kasım 2023)

- 466 soru; huggingface.co/gaia-benchmark adresinde özel sıralamalar için 300 soru tutuldu.
- Tasarım felsefesi: "İnsanlar için kavramsal olarak basit (92%) ama AI için zor (Pluginlerle GPT-4: 15%). "
- Deneyim, çok yönlülik, web, araç kullanımı testleri.
- Üç zorluk seviyesi; 3 seviye, modaliteler arasında uzun alet zincirlerini gerektirir.

GAIA, "generalist kapasitesi" ölçümüne çalıştırılan şeydir.

### AgentBench (Liu et al., ICLR 2024)

- 8 kod (Bash, DB, KG), oyun (Alfworld, LTP), web (WebShop, Mind2Web) ve açık nesil ortamı.
- Çok dönüşlü, bölünme başına 4k-13k dönüş.
- Ana bulgu: Uzun vadeli akıl yürütme, karar verme ve talimat aşağıdaki OSS LLM'lerin ticariye yetişmesini engelleyenler.

### Bunlar neyi ölçmez?

- Gerçek dünya operasyon maliyeti (tokens, duvar saati).
- Karşılıklı koşullarda güvenlik davranışları.
- Alanınızda performans (öz değerlendirmelerinizi kullanın, Ders 30).
- Kuyruk hataları (benchmark ortalaması; üretim işletmelerinin en kötü % 1'i önemsediği).

### Benchmarking'in yanlış gittiği yer

- **Single-number fixation.**SWE-benç %50'i, P50/P75/P95 maliyet + adım dağılımından daha az.
- **Contaminated claims.**Verified veya SWE-bench+'den bahsetmeden SWE-bench raporlanması yanıltıcıdır.
- **Benchmark-as-development-target.**Referans değerine göre optimize edilmek üretim yararlılığından farklıdır.

```figure
ae-swebench-gate
```

## Yapın

`code/main.py`Oyuncak SWE bank benzeri bir harness kullanıyor:

- Sentetik hata düzeltme görevleri (3 görev).
- Bir senaryo "askan" ve patch önerisi.
- FAIL_TO_PASS (bug şimdi tamir edildi) ve PASS_TO_PASS (bir şey kırılmamış) kontrol eden bir test koşucusu.
- Soruların parçalanma derinliğine dayanan GAIA tarzında bir zorluk sınıflandırıcısı.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı sonuç, görev başına çözünürlük oranını + zorluk başına gösterir ve değerlendirici kurallarını somutlaştırır.

## Kullan

- **SWE-bench Verified**- Her zaman doğrulanmış puanları rapor edin.
- **GAIA**Genelist ajanlar için özel liderlik çizelgesini kullanın.
- **AgentBench**Çok çevre karşılaştırması için.
- **Custom evals**(Deneyim 30) ürününüzün gerçek şekli için.

## Gönder

`outputs/skill-benchmark-harness.md`FAIL_TO_PASS / PASS_TO_PASS kapalı herhangi bir kod tabanlı görev çiftine SWE-bench tarzında bir harness oluşturur.

## Egzersizler

1. Oyuncak harnesini gerçek bir repo'da çalıştırmak için yükleyin. Bilinen hatalar için 3 FAIL_TO_PASS testi yazın.
2. 3 görevinin üzerinde çözünürlük başına kaç ajan adım atıyor?
3. SWE-bench+ kağıdı okuyun. Çözüm sızdırma kontrolü uygulayın (önümsel sorun metnini farklılığa karşı eşleştirin).
4. GPT-4 sınıfı bir ajanın ne yapacağını izle.
5. AgentBench'in çevre oranı, ürün yüzeyini hangi çevreyi yansıtıyor, "SOTA" nasıl görünüyor?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## Daha Fazla Okumak

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) orijinal referans değer
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) kurate edilen alt kümeler
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) Genelist referans değerleri
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) Çoklu çevre paketleri
