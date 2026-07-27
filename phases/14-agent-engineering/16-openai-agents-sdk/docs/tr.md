# OpenAI Agent'nin SDK'sı: Aktarma, Korkuluklar, İzleme

> OpenAI Agent'nin SDK'sı, Responses API'si üzerine oluşturulmuş hafif çoklu-agent framework'dir. Beş temel öğe: Agent, Aktarma, Korkuluk, Oturum, İzleme. Aktarmalar `transfer_to_<agent>` adlı araçlardır. Korkuluklar girişte veya çıkışta tetiklenir. İzleme varsayılan olarak açıktır.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 06 (Araç Kullanımı)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- OpenAI AgentSDK'sının beş temel öğesini adlandırın.
- Aktarmaları açıklayın: neden araç olarak modellendiler, modelin hangi adı gördüğü ve bağlamın nasıl aktarıldığı.
- Giriş korkuluklarını, çıkış korkuluklarını ve alet korkuluklarını ayırt edin; `run_in_parallel` ve engelleme modunu açıklayın.
- Aktarımlar + korkuluklar + yayılma tarzı izleme ile bir stdlib çalışma zamanı uygulayın.

## Sorun

Temiz bir şekilde yetki veremeyen Agent'ler, her şeyi tek bir prompt'ye tıkarlar. Korkulukları olmayan Agent'ler kimlik bilgilerini, politikayı ihlal eden çıktıları veya sonsuza kadar döngüyü gönderir. OpenAI'nin SDK'sı çoklu-agent çalışmasını izlenebilir kılan üç temel öğeyi kodlar.

## Konsept

### Beş ilkel

1. **Agent.** Yüksek Lisans + talimatlar + araçlar + aktarımlar.
2. **Devretme.** Başka bir agent'ya yetki devri. Modele `transfer_to_<agent_name>` adlı bir araç olarak temsil edilir.
3. **Korkuluk.** Girişte (yalnızca ilk agent), çıktıda (yalnızca son agent) veya araç çağrısında (işlev aracı başına) doğrulama.
4. **Oturum.** Sıralar arasında otomatik konuşma geçmişi.
5. **İzleme.** LLM nesilleri için yerleşik aralıklar, araç çağrıları, aktarmalar, korkuluklar.

### Araç olarak aktarmalar

Model, araç listesinde `transfer_to_billing_agent` öğesini görüyor. Bunu çağırmak çalışma zamanına şunu bildirir:

1. Konuşma içeriğini kopyalayın (veya `nest_handoff_history` beta aracılığıyla daraltın).
2. agent hedefini talimatlarıyla başlatın.
3. agent hedefiyle koşuya devam edin.

Bu ürünleştirilmiş süpervizör modelidir (Ders 13 / Ders 28).

### Korkuluklar

Üç tat:

- **Giriş korkulukları.** İlk agent'nin girişinde çalıştırın. Herhangi bir LLM çağrısından önce güvenli olmayan veya kapsam dışı istekleri reddedin.
- **Çıkış korkulukları.** Son agent çıkışında çalıştırın. PII sızıntılarını, politika ihlallerini ve hatalı biçimlendirilmiş yanıtları yakalayın.
- **Alet korkulukları.** İşlevsel alete göre çalıştırın. Bağımsız değişkenleri doğrulayın, izinleri kontrol edin, yürütmeyi denetleyin.

Mod:

- **Paralel** (varsayılan). Guardrail LLM, ana LLM'nin yanında çalışır. Daha düşük kuyruk gecikmesi. Eğer tetiklenirse, ana LLM'nin çalışması atılır (token atık).
- **Engelleme** (`run_in_parallel=False`). İlk olarak Guardrail LLM çalışır. Eğer tetiklenirse, ana çağrıda hiçbir token boşa harcanmaz.

Tuzak telleri `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`'yi yükseltir.

### İzleme

Varsayılan olarak açıktır. Her LLM nesli, takım çağrısı, aktarma ve korkuluk bir açıklık yayar. `OPENAI_AGENTS_DISABLE_TRACING=1` devre dışı kalıyor. `add_trace_processor(processor)` hayran, OpenAI'nin yanı sıra kendi arka ucunuza da yayılıyor.

### Oturum

`Session` konuşma geçmişini bir arka uçta (SQLite, Redis, özel) saklar. `Runner.run(agent, input, session=session)` otomatik olarak yüklenir ve eklenir.

### Bu modelin yanlış gittiği yer

- **Handoff drift.** Agent A, Agent B'ye aktarılır ve bu, Agent A'ya geri aktarılır. Bir atlama sayacı ekleyin.
- **Korkuluk bypass'ı.** Alet korkulukları yalnızca işlev araçlarıyla ateşlenir; yerleşik araçların (dosya okuyucu, web getirme) ayrı bir politikaya ihtiyacı vardır.
- **Aşırı izleme.** Aralıklardaki hassas içerik. OTel GenAI içerik yakalama kurallarıyla eşleştirin (Ders 23) — harici olarak saklayın, kimliğe göre referans alın.

## İnşa Et

`code/main.py`, SDK şeklini stdlib'de uygular:

- `Agent`, `FunctionTool`, {`Handoff` (aktarım semantiğine sahip bir işlev aracı olarak).
- Giriş/çıkış/araç korkulukları, aktarım gönderimi ve atlama sayacıyla birlikte `Runner`.
- İz şeklini göstermek için basit bir yayılma yayıcı.
- Kullanıcının sorgusuna göre faturalandırmaya veya desteğe devredilen bir önceliklendirme agent; korkuluk tek girişte açılır.

Çalıştır:

```
python3 code/main.py
```

İz, iki başarılı aktarmayı, bir giriş korkuluk açmasını ve gerçek SDK'nın yaydığını yansıtan bir yayılma ağacını gösterir.

## Kullan onu

- **OpenAI ilk ürünleri için OpenAI AgentSDK'sı**.
- Claude First ürünleri için **Claude Agent SDK** (Ders 17).
- **LangGraph** (Ders 13) açık ve kalıcı bir özgeçmiş istediğinizde.
- **Özel** tam kontrole ihtiyaç duyduğunuzda (ses, çoklu sağlayıcı, birleştirilmiş deployment'lar).

## Gönderin

`outputs/skill-agents-sdk-scaffold.md`, bir Agent'nin SDK uygulamasını önceliklendirme agent, aktarımlar, giriş/çıkış/araç korkulukları, oturum deposu ve bir izleme işlemcisi ile destekler.

## Egzersizler

1. Aktarma atlama sayacı ekleyin: N aktarımdan sonra reddedin. Davranışı takip edin.
2. Bir seçenek olarak `nest_handoff_history`'ı uygulayın; aktarmadan önce önceki mesajları tek bir özet halinde daraltın.
3. Engelleyici bir çıkış korkuluğu yazın. Onu tetikleyecek prompt'lerdeki gecikmeyi geçenlerle karşılaştırın.
4. `add_trace_processor`'yi bir JSON günlükçüsüne bağlayın. Açıklık başına hangi şekli yayar?
5. SDK belgelerini okuyun. Stdlib oyuncağınızı `openai-agents-python`'ya taşıyın. Neyi yanlış modelledin?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent | "Yüksek Lisans + talimatlar" | Agent SDK'yı yazın; aletlerin ve aktarmaların sahibi |
| Aktarma | "Aktarım" | Model çağrılarını başka bir agent'ye yetki vermek için kullanılan araç |
| Korkuluk | "Politika kontrolü" | Giriş/çıkış/araç çağrısında doğrulama |
| Tripwire | "Korkuluk gezisi" | Korkuluk reddedildiğinde ortaya çıkan istisna |
| Oturum | "Tarih mağazası" | Çalıştırmalar arasında kalıcı konuşma belleği |
| İzleme | "Açıklıklar" | LLM + araç + aktarma + korkuluk üzerinden yerleşik observability |
| Engelleme korkuluğu | "Sıralı kontrol" | Önce korkuluk çalışır; yolculukta token israf yok |
| Paralel korkuluk | "Eşzamanlı kontrol" | Korkuluk yanından geçiyor; daha düşük gecikme, yolculukta tokens'yi boşa harcar |

## Daha Fazla Okuma

- [OpenAI Agent'nin SDK belgeleri](https://openai.github.io/openai-agents-python/) — temel öğeler, aktarmalar, korkuluklar, izleme
- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude aromalı karşılığı
- [Antropik, Etkili Agentlar Oluşturma](https://www.anthropic.com/research/building-effective-agents) — aktarmalara ne zaman ulaşılmalı
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — standart Agent SDK'sı eşlemeyi kapsar
