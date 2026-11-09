# Özerk Kodlama Ajanları Landskapı (2026)

> SWE-bench Verified, üç yıl içinde% 4'ten% 80,9'a yükseldi. Aynı Claude Sonnet 4.5 SWE-agent v1 üzerinde 43.2% ve Cline otonom üzerinde 59.8% puan aldı. OpenHands (eski OpenDevin) MIT lisanslı en aktif platformdur ve CodeAct döngüsü, JSON araç çağrıları yerine doğrudan bir kum kutusunda Python eylemlerini gerçekleştirir. Başlık sayıları bir metodolojik sorun saklar: SWE-bench Verified görevlerinin 500'inden 161'si sadece 12 satır değişikliğine ihtiyaç duyar ve SWE-bench Pro (10+ satır görevleri) aynı sınır modelleri için 2359%'a sahiptir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Sorun

Doğru soru şu: işime uyan bir görev dağılımında, üretimdeki asfaltla, sonundan sonuna kadar hangi güvenilirliğe sahip olacağım?

2022 ile 2026 yılları arasında alan, asfaltlama  kurtarma katmanı, planlayıcısı, kum kutusu, düzenleme-temizleme döngüsü, geri bildirim biçimi  yük taşıyan olduğunu öğrendi. Claude Sonnet 4.5 SWE-agent v1 üzerinde SWE-benç Verified üzerinde %43,2 puan aldı; aynı model Cline'in otonom asfaltında %59,8 puan aldı. 16.6 mutlak fark noktaları, aynı ağırlıklar. Temel model bir bileşen; döngü üründür.

Yanındaki sorun, referans doyumu geri dönüşleri gizlemektir. SWE-bench Verified doymaya yakın ve kolay görev kuyruğu (161'i 500 görevin içinde ≤2 satır gerektirir) en yüksek puanları çıkarır. Gerçek dünya kalitesi SWE-bench Pro gibi dağıtımlarda daha iyi ölçülür (10+ satır değişimleri), aynı liderlerin hala 2359%'da oturduğu yerlerde.

## Anlaşım

### SWE-benç, bir paragraf

SWE-bench (Jimenez ve diğerleri) gerçek GitHub sorunlarını temel gerçeklik patchleriyle alır ve bir ajanı test paketini geçiren bir patch üretmesini ister. SWE-bench Verified (OpenAI, 2024) belirsiz ve kırık görevleri kaldırılan insan kuralı 500 görev alt kümesidir. SWE-bench Pro, 10+ değişim çizgisi gerektiren daha zor halefi  görevlerdir.

### 2022 → 2026 eğri aslında ne gösteriyor

- **2022**: %4'lik araştırma modelleri çiğ SWE-benç üzerinde.
- **2024**: GPT-4 + Devin tarzı asfaltlama %14; SWE-ağentme %12
- **2025**: Claude 3.5/3.7 Aider ve SWE ajanı içindeki Sonet 40~55% aralığına doğru ilerler.
- **2026**Claude Sonnet 4.5 ve SWE-bencinde 70~80%+'de sınır rekabetçileri Verified.

İndirme üç bileşik kaynaktan geldi: daha iyi temel modeller, daha iyi asfaltlama (CodeAct, yansıma, doğrulayıcı döngüler) ve daha iyi referanslar (Tahqiqatlı gürültü çıkarma).

### CodeAct vs JSON araç çağrıları

OpenHands (All-Hands-AI, arXiv:2407.16741, eski OpenDevin) belirli bir mimari bahis yaptı: bir host tarafından dekode edilen ve uygulanan JSON araç çağrılarını yayımlayan modelin yerine, model Python kodu yayar ve Jupyter tarzı bir çekirdeği onu kum kutuunda çalıştırabilir. Ajan dosyaları, zincir araçlarını döngüye alabilir ve bir eylem içinde kendi istisnalarını yakalayabilir.

- İşbirliği:

- **JSON tool calls**: her eylem bir dönüştür; denetleme kolay; kısıtlı kompozisyon; varsayılan olarak güvenli çünkü her çağrı açık bir onaylayıcıdan geçer.
- **CodeAct**: bir eylem tüm bir program olabilir; kompozisyonal; sert bir kum kutusu gerektirir (OpenHands Docker izolasyonunu kullanır); başarısızlık modları kum kutusu çalıştırma süresi izin veren her şeyi içerir.

Her iki mimarlık da üretimde. CodeAct açık platformlarda (OpenHands, smolagents) baskındır. JSON araç çağrıları, icracıyı sağlayan sağlayıcı kontrol ettiği yönetilen hizmetlerde (Anthropic Managed Agents, OpenAI Asistanları) baskın kalır.

### 2026 manzarasında asfaltlar

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### Neden asfaltlar üstünlük kazanıyor?

Bir kodlama koşusu uzun ufuklu bir yoldur (Dene 1) Merdivenler boyunca güvenilirlik bileşikleri.

1. **Retrieval**SWE-Agent'in ACI, OpenHands'in dosya indeksleri ve Aider'in repo haritası hepsinin saldırısı.
2. **Verifier loop**SWE-benç üzerinde 10+ puan delta ile testler yapılır, yığın izlerini okur ve tekrar denenilir.
3. **Failure containment**Bu nedenle, bir verifiyeci döngüsü ile ve olmadan aynı model iki farklı ürüne benziyor.

### Benchmark saturasyonu ve gerçek dağılım

OpenHands yazarları ve Epoch AI hem SWE-bench Verified'in kolay bir kuyruğu olduğunu belirtti: 500 görevden 161'i sadece 12 değişim çizgisi gerektirir. Yüksek puanlar kısmen bu kuyruğun etkisiyle hareket eder. SWE-bench Pro 10+ çizgi değişimlerine sınırlandırır ve sınır sistemleri için bile 2359% aralığında puanlar verir. Üretim dağılımınız neredeyse kesinlikle Verified'e göre Pro'ya daha yakındır.

Bir ajan seçimi için etkisi: kendi hata arka arkadasının Pro'ya benzer bir alt kümesini çalıştırın. Önemli olan puan, gönderdiğiniz görevlerin temsilcisi olan puanıdır.

```figure
a5-scaffold-delta
```

## Kullan

`code/main.py`sabit bir mini görev dağılımında iki oyuncak ajanı asfaltı karşılaştırılır:

1. A.**JSON tool-call**Bir turda bir hareket yapan bir heykel.
2. A.**CodeAct**Bir harekete küçük bir Python fragmanı gönderebilecek bir heykel.

Her ikisi de bir "model" (deterministik kurallar) kullanır, bu nedenle karşılaştırma asfaltı model kalitesinden ayırır.

## Gönder

`outputs/skill-scaffold-audit.md`kabul edilmeden önce önerilen kodlama ajanı asfaltını denetlemenize yardımcı olur: geri alım kalitesi, doğrulayıcı varlığı, kum kutu izolesi ve referans değerinden dağıtım için uygunluk.

## Egzersizler

1. Çık .`code/main.py`Her bir asfalt aynı görev setinde kaç dönüş yapar?

2. OpenHands kağıdı okuyun (arXiv:2407.16741). Kağıt CodeAct'in karmaşık görevlerde JSON aracı çağrılarını yendiğini iddia ediyor. Kağıtın kabul ettiği bir başarısızlık modunu tanımlayın ve bu modun üretimde ne zaman baskın olacağı konusunda bir cümle yazın.

3. İki dosya boyunca 10+ değişim satırı gerektiren bir hata arka arkadan bir görev seçin. (a) JSON araç çağrıları ve (b) CodeAct altında bir sınır modeli için uçtan sona başarı olasılığını tahmin edin. Boşluğu haklı çıkarın.

4. SWE-bench Verified'de 161 tek dosya, 12 satırlı görev var. Onları dışlayan bir puan oluşturun.

5. "SWE-bench Verified" (OpenAI) başlatmayı okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## Daha Fazla Okumak

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) orijinal referans değer ve metodoloji.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) kurate alt kümenin nasıl inşa edildiği.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) CodeAct mimarisi ve olay akışı tasarımı.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks)- Canlı izlenen notlar.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) uzun uzayda kodlama ajanı güvenilirliği çerçevesini oluşturmak.
