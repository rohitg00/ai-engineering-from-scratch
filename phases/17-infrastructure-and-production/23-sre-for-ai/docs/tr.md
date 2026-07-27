# AI için SRE — ÇokluAgent Olay Müdahalesi, Runbook'lar, Tahmine Dayalı Tespit

> AI SRE, araştırma, belgeleme ve koordinasyon aşamalarını otomatikleştirmek için RAG aracılığıyla altyapı verilerine (günlükler, runbook'lar, hizmet topolojisi) dayanan LLM'leri kullanır. 2026 mimari modeli çoklu-agent orkestrasyondan oluşur; bir denetçi tarafından koordine edilen uzmanlaşmış agent'lar (günlükler, metrikler, runbook'lar); Yapay zeka hipotezler ve sorgular önerir, insanlar ise karar çağrılarını onaylar. Datadog Bits AI ve Azure SRE Agent bunu yönetilen ürünler olarak sunar. Runbook'lar gelişiyor: NeuBird Hawkeye çekişmeli değerlendirmeyi kullanıyor (iki model aynı olayı analiz ediyor; anlaşma = güven, anlaşmazlık = belirsizlik); operasyonel hafıza ekip değişiklikleri boyunca devam eder. Otomatik iyileştirme temkinli olmaya devam ediyor: Yapay zeka öneriyor, insanlar onaylıyor. Tamamen otonom eylem, sıkı korkuluklarla dardır (yeniden başlatma bölmesi, geri alma özel konuşlandırma) - "ayarla ve unut" satan herkes aşırı satış yapıyor. Ortaya çıkan sınır: olay öncesi tahmin. MIT araştırması, geçmiş günlükler + GPU sıcaklıkları + API hata kalıpları üzerine eğitim almış bir yüksek lisans programının kesintilerin %89'unu 10-15 dakika erken tahmin ettiğini bildirmektedir. Tahmin: Kurumsal LLM'lerin %95'inde 2026 sonuna kadar otomatik yük devretme işlemi gerçekleştirilecek.

**Tür:** Öğren
**Diller:** Python (stdlib, toy multi-agent olay önceliklendirme simülatörü)
**Önkoşullar:** Aşama 17 · 13 (Observability), Aşama 17 · 24 (Kaos Mühendisliği)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Çokluagent AI SRE mimarisinin diyagramını çizin: gözetmen + uzmanlaşmış agent'lar (günlükler, metrikler, runbook'lar) + insan onay kapısı.
- Otomatik iyileştirmenin neden geniş (yeniden mimarlık hizmeti) yerine dar (bölmeyi yeniden başlatma, dağıtımı geri alma) olduğunu açıklayın.
- Rekabetçi değerlendirme modelini adlandırın (NeuBird Hawkeye): iki model aynı fikirde = güven; katılmıyorum = tırmandırmak.
- MIT'in %89'luk erken tespit sonucunu ve operasyonel kısıtlamayı belirtin: harekete geçirilmeyen tahminler yalnızca gösterge tablolarından ibarettir.

## Sorun

Nöbetçi bir mühendise 3 a.m numaralı telefondan çağrı yapılır. "Ödemede yüksek hata oranı." Datadog'u, Loki'yi, üç runbook'u ve dağıtım günlüğünü kontrol ediyorlar. 30 dakika sonra temel nedenin KV önbellek artışından kaynaklanan bir vLLM OOM olduğunu fark ederler. Bölmeyi yeniden başlatırlar; hata temizlenir.

2026'da bu soruşturmanın ilk 20 dakikası otomatikleştirilebilir. Günlükleri hizmete göre gruplandırma, son dağıtımlarla ilişkilendirme, runbook'larla eşleştirme — bunların tümü RAG + araç kullanımıdır. Denetlenen bir agent, ilk geçiş önceliklendirmesini yapabilir ve insan Datadog'u açmadan önce bir hipotez sunabilir.

Tamamen otonom iyileştirme farklı bir sorundur. Pod'u yeniden başlatın: güvenli. GPU havuzunu ölçeklendirin: politika izin veriyorsa güvenlidir. Hizmeti yeniden tasarlayın: kesinlikle hayır. Disiplin dar çizgiyi çiziyor.

## Konsept

### Çoklu-agent mimarisi

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

Süpervizör olayı alt sorgulara ayırır. Uzmanlaşmış agent'ların araç erişimi vardır (günlük arama, PromQL, belge alma). Süpervizör sentezler, hipotez + kanıtları insana sunar. İnsan onaylar veya yönlendirir.

### Otomatik düzeltme kapsamı

**Güvenli (dar)**: bölmeyi yeniden başlatın, belirli dağıtımı geri alın, havuzu önceden onaylanmış sınırlar dahilinde ölçeklendirin, önceden onaylanmış özellik işaretini etkinleştirin.

**Güvenli değil (geniş)**: Hizmet topolojisini değiştirin, kaynak sınırlarını değiştirin, yeni kod dağıtın, IAM'yi değiştirin, veritabanlarını değiştirin.

"Ayarla ve unut" diyen herkes aşırı satış yapıyor demektir. AI SRE olgunlaştıkça güvenli küme de büyür ancak sınır gerçektir.

### Çelişkili değerlendirme (NeuBird Hawkeye)

İki model aynı olayı bağımsız olarak analiz ediyor. Temel neden üzerinde anlaşırlarsa güven yüksektir. Katılmıyorlarsa, her iki hipotezi de görünür şekilde insana iletin. Basit desen, halüsinasyonlu temel nedenlere karşı etkili filtre.

### Operasyonel hafıza

Ekip devri, geleneksel SRE'nin sessizce öldürülmesidir - kabile bilgisinin ayrılması. AI SRE, runbook'ları ve otopsileri bir vektör DB'sinde depolar; Her yeni olayda agent'lar alınır. Yeni mühendisler katıldığında yapay zekanın tam geçmişi olur.

### Olay öncesi tahmin

MIT 2025 araştırması: Geçmiş günlükler, GPU sıcaklıkları ve API hata kalıpları üzerine eğitim almış Yüksek Lisans, kesintilerin %89'unu test setinde gerçekleşmeden 10-15 dakika önce tahmin etti.

Gerçeklik kontrolü: harekete geçirilmeyen tahminler gösterge tablolarıdır. Operasyonel soru şudur: "Tahmin ettiğimizde ne yaparız?" Önleyici drenaj mı? Çağrı cihazı? Otomatik ölçeklendirme mi? Cevap politikaya özgüdür.

### 2026'daki ürünler

- **Datadog Bits AI** — Datadog içinde yönetilen SRE yardımcı pilotu.
- **Azure SRE Agent** — Azure'da yerel.
- **NeuBird Hawkeye** — çekişmeli değerlendirme + operasyonel hafıza.
- **PagerDuty AIOps** — önceliklendirme + veri tekilleştirme.
- **Incident.io Otomatik pilot** — olay komutanı + koordinasyon.

### Kod olarak Runbook'lar

Runbook'lar, Confluence sayfalarından yapılandırılmış bölümlere (belirti, hipotez, doğrulama, eylem) sahip sürümlü işaretlemeye doğru evrilir. Yapılandırılmış runbook'lar daha iyi RAG alımını besler. Yapılandırılmamış runbook'ları yapılandırılmış hale getirerek herhangi bir AI-SRE dağıtımını başlatın.

### Hatırlamanız gereken sayılar

- MIT erken tespiti: Kesintilerin %89'u, 10-15 dakikalık teslim süresi.
- Çoklu-agent önceliklendirme: gözetmen + (günlükler, ölçümler, runbook'lar) + insan.
- Güvenli otomatik iyileştirme seti: bölmeyi yeniden başlatın, dağıtımı geri alın, sınırlar dahilinde ölçeklendirin.
- Karşıt değerlendirme: iki model bağımsız; anlaşma = güven.

## Use It — Hazır Araçla Uygula

`code/main.py` çoklu-agent önceliklendirmeyi simüle eder: günlük agent hatayı bulur, metrik agent CPU artışını bulur, runbook agent bilinen sorunla eşleşir. Danışman hipotezleri sıralar.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-ai-sre-plan.md` üretir. Mevcut çağrı, olay hacmi ve ekibin olgunluğu göz önüne alındığında, bir AI SRE kullanıma sunulması tasarlanır.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Günlük ve metrik agent'lar aynı fikirde değilse ne olur? Süpervizör nasıl çözer?
2. Hizmetiniz için üç "güvenli" otomatik düzeltme eylemi tanımlayın. Her birini haklı çıkarın.
3. Yapılandırılmış bir runbook şablonu yazın: bölümler, gerekli alanlar, doğrulama komutları.
4. Tahmine dayalı algılama 12 dakika öncesinde devreye girer. Politikanız nedir — çağrı cihazı mı, ön tahliye mi, yoksa her ikisi mi?
5. 3 kişilik bir ekibin 2026'da AI SRE'yi benimsemesi mi yoksa beklemesi mi gerektiğini tartışın. Vadeyi, hacmi ve riski göz önünde bulundurun.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| AI SRE | "agent çağrı için" | Yüksek Lisans destekli olay araştırması + koordinasyon |
| Danışman agent | "orkestratör" | Üst düzey agent olayları alt sorgulara ayırma |
| Uzmanlaşmış agent | "etki alanı agent" | Araç erişimine sahip Sub-agent (günlükler, ölçümler, runbook'lar) |
| Otomatik iyileştirme | "Yapay zeka sorunu düzeltiyor" | Dar önceden onaylanmış eylem; Geniş kapsamlı yeniden mimari DEĞİL |
| Operasyonel hafıza | "vektör runbook'ları" | RAG için vektör DB'sinde otopsiler + runbook'lar |
| Çelişkili değerlendirme | "iki modelli kontrol" | Bağımsız analizler; anlaşma = güven |
| NeuBird Şahin Gözü | "düşman olan" | Rakip değerlendirme + bellek modeline sahip ürün |
| Bit AI | "Datadog'un SRE'si agent" | Datadog tarafından yönetilen AI SRE |
| Olay öncesi tahmin | "erken teşhis" | Kesinti tahmininde 10-15 dakika teslim süresi |

## Daha Fazla Okuma

- [incident.io — AI SRE Tam Kılavuz 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — SRE için İnsan Odaklı Yapay Zeka](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — SRE 2026'da yapay zeka](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Şahin Gözü](https://www.neubird.ai/)
- [harika-ai-sre](https://github.com/agamm/awesome-ai-sre)
