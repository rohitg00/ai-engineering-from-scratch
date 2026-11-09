# Hareket bütçeleri, İterasyon Kapıları ve Maliyet yöneticileri

> Orta büyüklükte bir e-ticaret ajansının aylık LLM maliyeti $1,200 to $Bu, fiyatlama hatası değil. Bu, yeni bir döngü bulmuş ve içindeki harcamaları sürdüren bir ajan. Microsoft'un Ajan Yönetimi Araç Kütleği (2 Nisan 2026) bu sınıfa karşı savunmayı kodlaştırır: talep başına`max_tokens`, görev başına token ve dolar bütçeleri, günlük / aylık limitler, iterasyon limitleri, katılımlı model yönlendirme, hızlı önbelleğe girme, bağlam pencereleri, pahalı eylemler için HITL kontrol noktaları, bütçe ihlalinde anahtarları öldürme. Anthropic'in Claude Code Agent SDK farklı isimlerle aynı primitifleri gönderir. Finansal hız limitleri  örneğin, erişimi 10 dakikada > $ 50'e kesin  aylık limitlerden daha hızlı yakalamak döngüler.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## Sorun

Özerk ajanlar her dönüşte gerçek para harcıyor. Bir chatbot'un kötü çıkışı kötü bir cevap; bir ajanın kötü döngüsü bir fatura. Başarısızlık modunun endüstri belgelenmiş terimi "Cüzdanı reddetmek"  ajan mantık yapmayı sürdürür, araç çağrısını sürdürür, faturalama yapmayı sürdürür ve hiçbir şey onu durdurmaz çünkü hiçbir şey tasarlanmamıştır.

Bu, bir sayı değil, farklı zaman ölçeklerinde ve ayrıntılılıklarda bir dizi sınırdır: talep başına, görev başına, saat başına, gün başına, ay başına. İyi tasarlanmış bir yığın, birkaç dakika içinde kaçan bir döngü, saatler içinde yavaş bir sızıntı ve bir gün içinde kötü bir serbest bırakmayı yakalar. Aynı yığın, ajan uzun uzayda ve özerk olduğunda bütçeyi tutar.

Bu bir mühendislik dersi: matematik önemsiz, disiplin takımların başarısız olduğu yerdir. Aşağıdaki sınırların listesi Microsoft Ajan Yönetim Araç Kütübesinde veya Anthropic Claude Code Agent SDK dosyalarında isimlendirilmiştir.

## Anlaşım

### Ücret yöneticisi yığın

1. **`max_tokens` per request.**Basit.Bir çağrı sınırsız bir bitirme yayınlamasını engeller.
2. **Per-task token budget.**Tüm koşuda N simgesini aşmayın.
3. **Per-task dollar budget.**Tokenler gibi ama para biriminde.`max_budget_usd`Claude Code'da.
4. **Per-tool call cap.**N' dan fazla değil`WebFetch`Çağrılar, N `shell_exec`Telefonlar vb.
5. **Iteration cap (`max_turns`).**Toplam ajan döngü iterasyonları; sonsuz akıl döngüslerini önler.
6. **Per-minute / per-hour / per-day / per-month cap.**Çevrimiş pencereler, farklı zaman ölçeklerinde sızıntılar algılar.
7. **Financial velocity limit.**Örneğin, "Eğer 10 dakika içinde 50 dolardan fazla harcadıyorsanız, erişiminizi kesin".
8. **Tiered model routing.**Küçük bir model için varsayılan; sınıflandırıcı görevi gerekli gördüğünde daha büyük bir model için yükselir.
9. **Prompt caching.**Sistemi hızlı ve sabit bağlamı, sağlayıcı önbelleğinde depolanır; yeniden gönderme için token maliyeti sıfıra yakın.
10. **Context windowing.**Etkin bağlamı bir eşiğin altında tutmak için kompaktleştirme / özetleme; doğrudan token maliyetleri azaltma.
11. **HITL checkpoints on expensive actions.**Pahalı olduğu bilinen bir eylemden önce (uzun araç çağrısı, büyük bir indirme, pahalı bir model yükseltmesi) insan dokunuşunu gerektirir.
12. **Kill switch on budget breach.**Sessiyon herhangi bir kapalı ateşlerken sona erer. Kapalı kaydedilir; ayrı bir yeniden etkinleştirilmiş yol gerektirir.

### Neden bir damla değil, bir damla?

Tek bir aylık kap, kaçan ajanı sadece cüzdanın kaybolmasından sonra yakalar. Tek bir istek kap, oturum düzeyinde hiçbir şey yakalamaz. Farklı başarısızlık modları farklı zaman ölçeklerini gerektirir:

- **Runaway loop**(Agent 5 saniyelik bir tekrar deneme sırasında sıkıştı): Hız sınırı tarafından yakalanmış.
- **Slow leak**(öğütçi görev başına beklenen işi 2 katına çıkarır): günlük sınırlama ile yakalanır.
- **Bad release**(yeni versiyon 5x token kullanıyor): haftalık / aylık sınırlama ile yakalanmış.
- **Legitimate surge**(gerçek talep, bir hata değil): açık bir kayıt ile saat / gün kapalı tarafından yakalanmış.

### Harness bütçe yüzeyi

Claude Code Agent SDK (ağcı belgeleri) açıklıyor:

- `max_turns` İterasyon kapısı.
- `max_budget_usd` Dolarlık sınırlama; aşıklıkta kürtaj.
- `allowed_tools`- Ne ?`disallowed_tools` alet aletleri ve deniller.
- Özel maliyet hesaplama için araç kullanmadan önce kaçağı noktaları.

İzin modu merdivenine (Deneyim 10) birleştirin.`autoMode`Oturma olmadan`max_budget_usd`Antropic açıkça otomatik modun bütçe kontrollerini gerektiren çerçevesini oluşturur; sınıflandırıcı maliyetle ortogonaldır.

### AB AI Yasası, OWASP Ajansı Top 10

Microsoft'un Ajan Yönetimi Araç Kütleği, OWASP Ajan Top 10 ve AB AI Yasası'nın 14 (insan denetimi) maddesindeki gereksinimleri kapsar.

### Görülmüştür .$1,200 → $4.800 dava

Microsoft dosyalarında gerçek durum: yeni bir araç eklendiğinde aylık maliyetleri dört katına çıkmış bir e-ticaret ajansı. Araç, ajanın her oturumda sipariş durumunu sorgulamasına izin verdi. Çubuk algılama yok. Bir alet için şapka yok. Haftalar arası büyüme konusunda uyarı yok. Düzenleme, her aletin kapalılık ve günlük büyüme uyarısıydı. Bu bir şablon: her yeni araç yüzeyi yeni bir potansiyel döngüdür; her yeni araç kendi kapalı ve kendi uyarısı gerekir.

```figure
cost-governor-stack
```

## Kullan

`code/main.py`simülasyonlu ajan birkaç dönüşten sonra bir oylama döngüsüne sürüklenir; katlı yığın, hız penceresinde yakalarken tek bir aylık kaplama birkaç gün sonra ateş etmez.

## Gönder

`outputs/skill-agent-budget-audit.md`Ödemelenen ajanların görevlendirilmesi için maliyet yöneticisi yığınını denetlemektedir ve eksik katmanları işaretler.

## Egzersizler

1. Çık .`code/main.py`Seçim döngüsü trajektöründe iterasyon kapağından önce hız sınırı ateşlerini onaylayın. Şimdi hız sınırı etkisizleştirin ve iterasyon kapağı onu yakalamadan önce ajanın ne kadar "harcadığını" ölçün.

2. Bir tarayıcı ajansı için her araç için bir kap seti tasarlayın (Deneyim 11). Hangi araç en sıkı kap ihtiyacı vardır? Hangi araç risk olmadan sınırsız çalışabilir?

3. Microsoft Ajan Yönetim Araç Kütü Dokümanlarını okuyun. Her kapak türü araç kit isimlerini listelenin. Her birini başarısızlık modlarından birine (kaynak döngüsü, yavaş sızıntı, kötü yayın, yükseliş) haritasına yerleştirin.

4. Gerçekçi bir görev için bir gece boyunca gözden geçirilmemiş bir çalışmanın fiyatı (örneğin "repoda 50 işlem ele alın").`max_budget_usd`2x'i haklı çıkarın.

5. Claude Code's'ın `max_budget_usd`Bu nedenle, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre sonra, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## Daha Fazla Okumak

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) `max_turns`- Evet .`max_budget_usd`, araçları kullananlar.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) maliyet yöneticisi kontrol noktaları.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) tedarikçi tarafından maliyet kontrolü.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)- Önbelleğe alma mekanizması.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Uzun üfüre sahip ajanlar için maliyet profili.
