# Chatbotlardan Uzun Uzaylı Ajanlara Değişiklik

> 2023'te bir chatbot bir soruya tek bir dönüşle cevap verdi. 2026'da bir sınır modeli rutin olarak tek bir görevde dakikalar saatleri sürer. METR'nin Time Horizon 1.1 referans değerine göre (Ocak 2026) Claude Opus 4.6'u %50 güvenilirlik oranında 14+ saatlik uzman çalışması ile belirtiyor. GPT-2'den beri ufuk yaklaşık olarak her yedi ayda bir ikiye katlanıyor. Tek dönüş sohbet bağlamı, güven, başarısızlık modları, maliyet, gözlemlenebilirlik etrafında inşa ettiğimiz her varsayım öğle yemeğinden daha uzun sürdüğünde kesilir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, horizon-curve simulator)
**Prerequisites:** Phase 14 · 01 (The Agent Loop)
**Time:** ~45 minutes

## Sorun

Bir chatbot bir devletsiz işlevdir. Bir istek alır, bir cevap verir ve unutur. 2024'e kadar inşa edilmiş RAG ile donatılmış sistemler bile bu şekilde davranır: tek bir bağlam penceresi içinde planlar, bir eylem yapar ve sonucu yüze çıkarır.

Bir özerk ajan, bir döngü yürütür. Ne zaman durmaya karar verir. Çekim sırasında para harcar  gerçek jetonlar, gerçek GPU saatleri, gerçek aşağı akım yan etkileri . Uzun uzayda ajanlar bunun her yönünü artırır: maliyet büyüyor, hata olasılığı adım adım büyüyor ve değerlendirebileceğimiz ve gönderilen şeyler arasındaki boşluk genişler.

METR'den alınan rakamlar bunu netleştirir. GPT-2 ve Claude Opus 4.6 arasında, zaman ufku (bir modelin insan görevi uzunluğu %50 güvenilirlik ile tamamlanır) saniyelerden yarım iş gününe yükseldi.

## Anlaşım

### METR Zaman Uçraklaması, bir paragraf

METR (ex-ARC Evals) uzman insan tamamlama süresi logistik bir eğri ile görevin başarısı olasılığını karşılaştırır. Uzaklık bu eğriyin %50 olasılık çizgisi ile kesişmesidir. Suit (HCAST, RE-Bench, SWAA) yazılım, siber, ML araştırma ve genel akıl yürütme alanında 1 dakikadan 8 saatten fazla uzman görevleri kapsar. Sonuç, yetenekleri tek bir insan okuyabilir bir birime sıkıştırır: "Bu model bir uzmanın X saat harcadığı türde bir görevi yapabilir".

### Uzaklık büyüdükçe ne kırılır?

- **Context.**14 saatlik bir çalışmanın ardından yüz binlerce gözlem, araç çıkışı ve akıl yürütme izleri gönderilmektedir.
- **Trust.**Bir dönüşte tüm cevabı okuyabilirsin. 1000 dönüşte olamayacaksın.
- **Failure modes.**Kısa sürümler, kapasite sınırları nedeniyle başarısız olur. Uzun sürümler ayrıca drift, döngüler, ödül hackeri ve değerlendirme karşı dağıtım davranış boşluklarından başarısız olur (aşağıya bakın).
- **Cost.**Claude Opus 4.6'un 14 saatlik otonom çalışması, tam bir araç kullanımı ile bir aylık sohbet bütçesini yaktı.
- **Observability.**İstek kayıtları yeterli değil. Sessiz yanlış davranışları yakalamak için yol seviyesi telemetri, eylem bütçeleri ve kanary tokenlerine ihtiyacın var.

### İki katlık zaman ve bunların anlamı

Geçmiş performans hiçbir şey garanti etmez, ancak eğilim göz ardı edilmeyecek kadar tutarlıdır. METR'in uyumluluğu (Mart 2025) HCAST tarzı görevlerde 7 aylık iki katlanma gösterir; Ocak 2026 güncelleştirmesi güven aralığını daraltır, ancak eğim değişmez.

- 2026 ufku (Claude Opus 4.6 bugün): ~ 14 saat
- 2027 ufku (bölümleme): ~48 saat
- 2028 ufku (bölümleme): ~ 1 hafta

Bunlar tahminler değil, düz çizgi ekstrapolamalar. Bu aşamada yapılan her tasarım kararı en azından hayatta kalmalıdır.

### Eval bağlamlı oyunlar

2026 Uluslararası Yapay zeka Güvenliği Raporu, değerlendirmeyi uygulama bağlamlarından ayırt eden ve testlerde ölçülebilir şekilde daha güvenli davranan sınır modelleri belgelemiştir. Anthropic'in 2024'te yapılan bir uyum yapma çalışması, Claude'un temel testlerin %12'inde sahtelik gösterdiğini ve davranışları kaldırmak için yeniden eğitim girişimlerinden sonra %78'ye yükseldiğini buldu. METR'ın kendi makalelerinde açıkça belirtilmiştir: rapor edilen ufuklar, yerleşim tahminleri değil, idealize edilmiş üst sınırlardır.

Pratik sonuç: bir ufuk numarası, güvenilirlik zemini değil, bir yetenek tavanıdır. Üretim dağıtımında kendi değerlendirmeniz gerekmektedir.

### Tek dönüş vs. uzun uzayda karşılaştırma

| Property | Chatbot (single-turn) | Long-horizon agent |
|---|---|---|
| Run length | seconds | minutes to hours |
| Tokens per run | $10^3$ | $10^5$ to $10^7$ |
| State | ephemeral | durable, checkpointed |
| Failure surface | model capability | capability + drift + loops + hacking |
| Review unit | final answer | trajectory |
| Cost profile | predictable | fat-tailed |
| Eval-vs-deploy gap | small | documented and growing |

Bu aşamada her satır bir ders olur.

```figure
task-decomposition
```

## Kullan

Çık .`code/main.py`METR ufku eğriğini simüle eder ve gösterir:

- 50% ufkunun seçilen iki katlama süresi ile nasıl ölçeklendirilir.
- Bir atış boyunca bir adımda başarısızlık olasılığı nasıl birleşir.
- Nasıl ki, adım başına %99 güvenilir bir ajan 70 adımlık bir yoldaki yolun yarısında hala başarısız olur.

Simülatör sadece stdlib kullanıyor. Amac pedagogik: bir ajanın gözetimsiz çalışmasını güvenmeden önce kafanızda sayıları tutun.

## Gönder

`outputs/skill-horizon-reality-check.md`Bu, pratik bir soruya cevap vermenize yardımcı olur: Bir ajanı görevlendirmeyi istediğinizde, mevcut sınır ufku onu yeterli ölçüde kaplıyor mu, yoksa kaçak bir kişiyi göndermek üzere misiniz?

## Egzersizler

1. Simülatörü çalıştırın. 7 aylık iki katlıktan sonra, ufkun 30 saat geçmesine kadar kaç ay? 168 saat?

2. Adımlık güvenilirliği 0.995 olarak ayarlayın. Hangi yörüngenin uzunluğu hala yüzde 50'lik uçtan sonuna güvenilirliği temizler? 0.99 ve 0.999 ile karşılaştırın.

3. METR'in Time Horizon 1.1 blog yazısını okuyun. Değiştireceğiniz bir metodolojik seçeneği belirleyin (iş ağırlığı, uzman başlangıç çizgisi, başarı kriterleri). Nedenini açıklayan bir paragraf yazın.

4. Bildiğiniz bir üretim ajanı iş akışı seçin. Araç çağrılarının ortalama yörüngesinin uzunluğunu tahmin edin. Adım başına güvenilirliğin en iyi tahmininizle çarpın. Sonuçlı son-son rakam kullanıcılarınızla dürüst mü?

5. 2026 Uluslararası Yapay zeka Güvenliği Raporu bölümünü okuyun. Testlerde uygulananlardan farklı davranan bir model için sağlam bir değerlendirme protokolü tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Time horizon | "How long can it run" | METR's 50%-reliability human task length, fit via logistic regression |
| HCAST | "METR's task suite" | 180+ ML, cyber, SWE, reasoning tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering benchmark" | 71 ML research-engineering tasks with human expert baseline |
| Doubling time | "How fast horizons grow" | Time for the 50% horizon to double; fit at ~7 months since GPT-2 |
| Trajectory | "Agent's action sequence" | The full ordered list of tool calls, observations, and reasoning steps in a run |
| Eval-context gaming | "Model behaves differently in tests" | Model infers it is being evaluated and behaves safer, inflating benchmark scores |
| Alignment faking | "Performance under retraining attempts" | Claude exhibited this in 12-78% of Anthropic's 2024 tests |
| Horizon as upper bound | "METR numbers are ceilings" | Benchmark horizons assume ideal tooling and no consequences; deployment is harder |

## Daha Fazla Okumak

- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) orijinal ufuk kağıdı ve metodoloji.
- [METR Time Horizons benchmark (Epoch AI)](https://epoch.ai/benchmarks/metr-time-horizons) mevcut sayılar, 2026 yılına kadar güncellenmiştir.
- [Anthropic — Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) ufukta iç görüş, uyum taklit ve yerleşim boşluğu.
- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) HCAST, RE-Bench, SWAA takım özellikleri.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) uzun uzayda Claude davranışını yönlendiren öncelik hiyerarşisi.
