# SRE for AI  Çoklu Ajanlar Olgu Cezası, Çalışma Kitapları, Tahminci tespit

> AI SRE, araştırma, belgeleme ve koordinasyon aşamalarını otomatikleştirmek için RAG üzerinden altyapı verilerine (loglar, çalıştırma kitapları, hizmet topolojisi) dayalı LLM'leri kullanır. 2026 mimarlık örneği, bir denetmen tarafından koordine edilen çoklu ajan orkestrasyonu  uzman ajanlar (loglar, metrikler, çalıştırma kitapları); AI hipotez ve sorular önerir, insanlar yargı çağrılarını onaylar. Datadog Bits AI ve Azure SRE Agent bunu yönetilen ürünler olarak gönderir. Çalışma kitapları gelişmektedir: NeuBird Hawkeye karşıt değerlendirmeyi kullanır (iki model aynı olayı analiz eder; anlaşma = güven, anlaşmazlık = belirsizlik); ekip değişiklikleri boyunca operasyonel hafızan kalır. Otomatik tedavi dikkatli kalır: Yapay zeka önerir, insanlar onaylar. Tamamen özerk eylem dar (başlangıç kapsülü, geri dönüş özel dağıtım) sıkı koruma rayları ile  "settin ve unut" satan herkes aşırı satış yapıyor. Yeni gelişen sınır: olay öncesi tahmin. MIT araştırmaları, tarihsel kayıtlar + GPU temp + API hata kalıpları üzerine eğitimli bir LLM'nin, %89'ın 10-15 dakika erken kesinti olacağını öngördüğünü bildirmektedir. Projection: İşletme LLM'lerinin %95'i 2026 sonuna kadar otomatik olarak başarısızlığa uğramış olacak.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Çoklu ajanlı AI SRE mimarisini çiz: denetçi + uzman ajanlar (loglar, metrikler, çalıştırma defterleri) + insan onay kapısı.
- Otomatik düzeltmenin neden geniş değil (önce yapılandırma hizmeti) dar olduğunu açıklayın (baştan başlatma kapsülü, geri yükleme).
- Karşılıklı değerlendirme modelini (NeuBird Hawkeye) isimlendirin: iki model anlaşılır = güven; anlaşmazlık = yükseliş.
- MIT'in %89 erken tespit sonucu ve operasyonel kısıtlamaları alın: Aksiyon olmadan tahminler sadece araç tablosudur.

## Sorun

Bir çağrı mühendisi sabahın 3'ünde "Kavda yüksek hata oranı" diye çağrılır. Datadog, Loki, üç çalıştırma defteri, dağıtım günlüğünü kontrol ederler. 30 dakika sonra temel nedeni KV önbelleği tırmanışından vLLM OOM olduğunu fark ederler. Kapsulunu yeniden başlatırlar; hata temizlenir.

2026'da bu soruşturmanın ilk 20 dakikası otomatik hale gelir. Son kullanımlara ilişkin, son yayımlara ilişkin, çalıştırma kitaplarına karşı eşleşen servis kayıtlarını gruplandırmak  hepsi RAG + araç kullanımıdır. Gözetim altındaki bir ajan, ilk geçiş triajını yapabilir ve insan Datadog'u açmadan önce bir hipotez sunabilir.

Tamamen otonom bir iyileştirme farklı bir problem. Kapsul: güvenli yeniden başlat. Skalalı GPU havuzu: güvenli eğer politika izin verir. Hizmet yeniden yapılandır: kesinlikle değil. Disiplin dar çizgi çizmektedir.

## Anlaşım

### Çoklu ajan mimarisi

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

Gözetmen olayı alt sorgulara ayırır. Uzman ajanlar araç erişimine sahiptir (log arama, PromQL, belge kurtarma). Gözetmen hipotezi + kanıt sunar, insanlara sunar. İnsan onaylar veya yönlendirir.

### Otomatik düzeltme kapsamı

**Safe (narrow)**: başlatma modülü, belirli dağıtımları geri çevirme, önceden onaylanmış sınırlar içinde ölçekleme havuzu, önceden onaylanmış özellik bayrağını etkinleştirme.

**Not safe (broad)**: hizmet topolojisini değiştirmek, kaynak sınırlarını değiştirmek, yeni kodlar yerleştirmek, IAM'i değiştirmek, veritabanlarını değiştirmek.

"Sett it and forget it" satılan herkes aşırı satıyor.

### Karşılıklı değerlendirme (NeuBird Hawkeye)

İki model aynı olayı bağımsız olarak analiz eder. Eğer kök nedenleri konusunda anlaşırlarsa, güven yüksek olur. Eğer anlaşmazlıkları varsa, her iki hipotez de görünürken insana kadar yükselir.

### İşlem belleği

Ekip döngüsü, geleneksel SRE  kabile bilgisi yaprağının sessiz öldürülmesidir. AI SRE, bir vektör DB'de çalışma kitapları + post-mortemleri depolar; ajanlar her yeni olayda geri alırlar. Yeni mühendisler katıldığında, AI'nin tam tarihi vardır.

### Olay öncesi tahmin

MIT 2025 araştırması: Tarih kayıtları, GPU sıcaklıkları, API hata kalıpları üzerine eğitim alan LLM, test setinde gerçekleşmeden 10-15 dakika önce kesintilerin% 89'unu öngördü.

Gerçeklik kontrolü: etkinleştirilmemiş tahminler araç tablosudur. Operasyonel soru "Önümüze baktığımızda ne yapıyoruz?" önleyici boşaltma mı? Pager mi? Otomatik ölçeklendirme mi? Cevap politika özel.

### 2026 yılında ürünler

- **Datadog Bits AI**Datadog'un içinde SRE'nin yardımcı pilotunun yönetimi.
- **Azure SRE Agent** Azure doğası.
- **NeuBird Hawkeye** karşıt değerlendirme + işletim hafızası.
- **PagerDuty AIOps** triaj + deduplasyon.
- **Incident.io Autopilot** olay komutanı + koordinasyon.

### Kod olarak çalıştırma defterleri

Runbooks, Confluence sayfalarından yapılandırılmış bölümlerle (semptom, hipotez, doğrulama, eylem) versiyon markdown'a kadar evrimleşir. Struktürlü runbooks daha iyi RAG kurtarma sağlar.

### Hatırlamalısın numaralar

- MIT erken tespit: %89 kesinti, 10-15 dakika öncesi zaman.
- Çoklu ajan sınıflandırması: denetçi + (loglar, metrikler, çalışma kitapları) + insan.
- Güvenli otomatik düzeltme seti: Kapsul yeniden başlat, yeniden dağıt, sınırlar içinde ölçeklendirin.
- Karşılıklı değerlendirme: iki bağımsız model; anlaşma = güven.

```figure
i4-incident-agents
```

## Kullan

`code/main.py`Bir çok ajanlı bir triaj simülasyonu: log ajanı hatayı bulur, metrik ajanı CPU spike bulur, runbook ajanı bilinen soruya eşleşir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-ai-sre-plan.md`.Şimdilik çağrıda olan, olay hacmi, ekip olgunluğu göz önüne alındığında, bir AI SRE dağıtımını tasarlıyor.

## Egzersizler

1. Çık .`code/main.py`Ya kayıt ve metrik ajanları anlaşmazlıklarda?
2. Hizmetiniz için üç "güvenli" otomatik tedavi eylemini tanımlayın.
3. Yapılandırılmış bir çalıştırma defteri şablonu yazın: bölümler, gerekli alanlar, doğrulama komutları.
4. 12 dakika öncelik alarak ateş tespit edilebilir.
5. 3 kişilik bir ekip 2026'da AI SRE'yi benimsemesi mi yoksa bekleme mi gerektiğini tartışın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## Daha Fazla Okumak

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
