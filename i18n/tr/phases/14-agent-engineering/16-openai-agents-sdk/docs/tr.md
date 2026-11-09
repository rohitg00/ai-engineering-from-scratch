# OpenAI Ajanları SDK: El uzatma, Gardails, Takip

> OpenAI Agents SDK, Cevaplar API'si üzerine inşa edilen hafif multi-agent çerçevesidir. Beş primitif: Agent, Handoff, Guardrail, Session, Tracing. Handoffs isimli araçlardır `transfer_to_<agent>`-Guardails giriş veya çıkışta hareket etmektedir.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- OpenAI Ajanlar SDK'nin beş primitifini isimlendirin.
- Elveriler: neden araç olarak modellendiğini, modelin hangi isim şeklini gördüğünü ve bağlamın nasıl aktarıldığını açıkla.
- Giriş koruma, çıkış koruma ve araç koruma arasında ayrım yapın; açıklayın `run_in_parallel`- Bloklama moduna karşı.
- El sürümleri + koruma rayları + uzanış tarzı izleme ile stdlib çalıştırın.

## Sorun

Temiz bir şekilde yetki veremeyen ajanlar, her şeyi bir tek çağrışmaya doldururlar. Koruma koruması olmayan ajanlar PII, politika ihlal eden çıkış veya sonsuza dek döngü gönderiyorlar. OpenAI'nin SDK'si, çoklu ajan işinin ele alınmasını sağlayan üç ilk şeyi kodlar.

## Anlaşım

### Beş ilk

1. **Agent.**LLM + talimatlar + araçlar + el konuları.
2. **Handoff.**Başka bir ajanı temsil etmek.`transfer_to_<agent_name>`- Evet .
3. **Guardrail.**Giriş (yalnızca ilk ajan), çıkış (yalnızca son ajan) veya araç çağrısı (her fonksiyon aracı başına) üzerinde doğrulama.
4. **Session.**Devamlar boyunca otomatik konuşma tarihi.
5. **Tracing.**LLM nesillerinin içe gömülü alanları, araç çağrıları, el uzatma, koruma.

### Kullanımlı aletler

Model görüyor .`transfer_to_billing_agent`Bu araç listesinde.

1. Konuşmanın bağlamını kopyalayın (veya `nest_handoff_history`Beta).
2. Hedef ajanını talimatlarıyla başlatın.
3. Hedef ajanı ile koşmaya devam edin.

Bu, yapımcılık yapımı yönetici modelidir (Dene 13 / 28. Ders).

### Koruma rayları

Üç tadı:

- **Input guardrails.**İlk ajanın girişini kullanın ve herhangi bir LLM çağrısı yapmadan önce güvenli olmayan veya kapsamının dışındaki talepleri reddedin.
- **Output guardrails.**Son ajanın çıkışını çalıştır, PII sızdırmalarını, politika ihlallerini, yanlış yanıtları yakalayın.
- **Tool guardrails.**Fonksiyonlara göre araç çalıştır, argümanları doğrulay, izinleri kontrol et, denetim yap.

Mod:

- **Parallel**(devayla) Guardrail LLM, ana LLM ile birlikte çalışır. Aşağı kuyruğu gecikme. Eğer tökezlerse, ana LLM'nin işi atılır (token atık).
- **Blocking**(`run_in_parallel=False`Guardrail LLM önce çalışır. Eğer kaçarsa, ana çağrıda hiç bir token harcanmaz.

Üç tel yükseltir .`InputGuardrailTripwireTriggered`- Ne ?`OutputGuardrailTripwireTriggered`- Evet .

### İzleme

Her LLM nesli, araç çağrısı, teslimat ve koruma rayı bir süre yayar.`OPENAI_AGENTS_DISABLE_TRACING=1`- Çıkmak için.`add_trace_processor(processor)`Fanlar OpenAI'nin yanında kendi arka planınıza da uzanıyor.

### Sessiyonlar

`Session`sohbet geçmişini arka uçta saklar (SQLite, Redis, özel). `Runner.run(agent, input, session=session)`Otomatik yükler ve ekler.

### Bu kalıp yanlış gittiğinde

- **Handoff drift.**A ajanı A ajanı B ajanına teslim eder. A ajanı A ajanına geri verir.
- **Guardrail bypass.**Araç koruma perdelerinin sadece işlev araçları üzerinde ateş edilmesi; yerleşik araçlar (dosya okuyucu, web alımı) ayrı bir politika gerektirir.
- **Over-tracing.**Otel GenAI içeriği yakalama kurallarıyla (Desin 23)  dıştan depolama, ID ile referans.

```figure
ae-agent-handoff
```

## Yapın

`code/main.py`stdlib'de SDK şeklini uyguluyor:

- `Agent`- Evet .`FunctionTool`- Evet .`Handoff`(transfer semantikası ile bir fonksiyon aracı olarak).
- `Runner`Giriş/çıktı/erkeç koruma rayları, teslimat ve hop counter ile.
- İz şeklini göstermek için basit bir uzantı emiten.
- Kullanıcının sorgularına göre faturalama veya destek için teslim edilen bir triage ajanı; bir giriş üzerinde koruma yolculuğu.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz iki başarılı teslimat, bir giriş koruma yolculuğu ve gerçek SDK'nin yaydığı şeyi yansıtan bir tarama ağacı gösterir.

## Kullan

- **OpenAI Agents SDK**OpenAI-first ürünler için.
- **Claude Agent SDK**(Deneyim 17) Claude-first ürünler için.
- **LangGraph**(Deneyim 13) Açık bir durum ve kalıcı bir öykü istediğinizde.
- **Custom**Tam kontrolün (sessiz, çoklu sağlayıcı, federasyonlu dağıtımlar) gerektiğinde.

## Gönder

`outputs/skill-agents-sdk-scaffold.md`Bir triage ajanı, el uzatma, giriş/çıktı/üçüm koruma rayları, oturum depolama ve bir izleme işlemcisi olan bir Agents SDK uygulamasını hazırlar.

## Egzersizler

1. Bir el uzatma hop sayıcısı ekleyin: N transferinden sonra reddet. Davranışları takip edin.
2. Uygulama`nest_handoff_history` aktarmadan önce önceki mesajları bir özetle birleştirmek.
3. Bir çıkış koruma koruma çizgisi yazın.
4. Kablo `add_trace_processor`JSON kaydeticisine.
5. SDK dosyalarını okuyun ve oyuncaklarınızı STDlib'e aktarın.`openai-agents-python`- Neyi yanlış modelledin?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Daha Fazla Okumak

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) Primitivler, elveriler, koruma rayları, izleme
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) Claude lezzeti olan eşya
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)- Ne zaman elveriler için el çekmek
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) Standart Ajanlar SDK haritasını
