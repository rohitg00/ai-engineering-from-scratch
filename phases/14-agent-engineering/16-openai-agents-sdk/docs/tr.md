# OpenAI Agent SDK'sı: Aktarma, Korkuluklar, İzleme

> OpenAI Agents SDK, Responses API'si üzerine oluşturulmuş hafif çoklu agent framework'dir. Beş temel öğe: Agent, Aktarma, Korkuluk, Oturum, İzleme. Aktarımlar `transfer_to_<agent>` adlı araçlardır. Korkuluklar girişte veya çıkışta tetiklenir. İzleme varsayılan olarak açıktır.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 06 (Araç Kullanımı)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- OpenAI Agents SDK'nın beş temel öğesini adlandırın.
- Aktarmaları açıklayın: neden araç olarak modellendiler, modelin hangi adı gördüğü ve bağlamın nasıl aktarıldığı.
- Giriş korkuluklarını, çıkış korkuluklarını ve alet korkuluklarını ayırt edin; `run_in_parallel` ve engelleme modunu açıklayın.
- Aktarımlar + korkuluklar + yayılma tarzı izleme ile bir stdlib çalışma zamanı uygulayın.

## Sorun

Temiz bir şekilde yetki veremeyen Agent'ler, her şeyi tek bir prompt'ye tıkıyor. Korkulukları olmayan Agent'ler PII'yi, politikayı ihlal eden çıktıları veya sonsuza kadar döngüyü gönderir. OpenAI'nin SDK'sı, çoklu agent'nin çalışmasını takip edilebilir kılan üç temel öğeyi kodlar.

## Konsept

### Beş ilkel

1. **Agent.** LLM + talimatlar + araçlar + aktarımlar.
2. **Devretme.** Başka bir agent'ye yetki verme. Modele `transfer_to_<agent_name>` adlı bir araç olarak temsil edilmiştir.
3. **Korkuluk.** Girişte (yalnızca ilk agent), çıkışta (yalnızca son agent) veya araç çağrısında (işlev aracı başına) doğrulama.
4. **Oturum.** Sıralar arasında otomatik konuşma geçmişi.
5. **İzleme.** LLM nesilleri için yerleşik aralıklar, araç çağrıları, aktarmalar, korkuluklar.

### Araç olarak aktarmalar

Model, takım listesinde `transfer_to_billing_agent`'yi görüyor. Bunu çağırmak çalışma zamanına şunu bildirir:

1. Konuşma içeriğini kopyalayın (veya `nest_handoff_history` beta aracılığıyla daraltın).
2. agent hedefini talimatlarıyla başlatın.
3. agent hedefiyle koşuya devam edin.

Bu ürünleştirilmiş süpervizör modelidir (Ders 13 / Ders 28).

### Korkuluklar

Üç tat:

- **Giriş korkulukları.** İlk agent girişinde çalıştırın. Herhangi bir LLM çağrısından önce güvenli olmayan veya kapsam dışı istekleri reddedin.
- **Çıkış korkulukları.** Son agent çıkışında çalıştırın. PII sızıntılarını, politika ihlallerini ve hatalı biçimlendirilmiş yanıtları yakalayın.
- **Alet korkulukları.** İşlevsel alete göre çalıştırın. Bağımsız değişkenleri doğrulayın, izinleri kontrol edin, yürütmeyi denetleyin.

Mod:

- **Paralel** (varsayılan). Guardrail LLM, ana LLM'nin yanında çalışır. Daha düşük kuyruk gecikmesi. Açılırsa ana LLM'nin çalışması atılır (token atık).
- **Engelleme** (`run_in_parallel=False`). İlk olarak Guardrail LLM çalışır. Açılırsa ana çağrıda hiçbir token israf edilmez.

Tuzak telleri `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`'yi yükseltir.

### İzleme

Varsayılan olarak açıktır. Her LLM nesli, takım çağrısı, aktarma ve korkuluk bir açıklık yayar. `OPENAI_AGENTS_DISABLE_TRACING=1` devre dışı kalır. `add_trace_processor(processor)` hayranları, OpenAI'lerin yanı sıra kendi arka ucunuza da yayılır.

### Oturum

`Session` konuşma geçmişini bir arka uçta (SQLite, Redis, özel) saklar. `Runner.run(agent, input, session=session)` otomatik olarak yüklenir ve eklenir.

### Bu modelin yanlış gittiği yer

- **Atlatma kayması.** Agent A, Agent A'ya geri veren Agent B'ye aktarır. Bir atlama sayacı ekleyin.
- **Korkuluk bypass'ı.** Alet korkulukları yalnızca işlev araçlarıyla ateşlenir; yerleşik araçların (dosya okuyucu, web getirme) ayrı bir politikaya ihtiyacı vardır.
- **Aşırı izleme.** Aralıklardaki hassas içerik. OTel GenAI içerik yakalama kurallarıyla eşleştirin (Ders 23) — harici olarak saklayın, kimliğe göre referans alın.

## İnşa Et

`code/main.py`, SDK şeklini stdlib'de uygular:

- `Agent`, `FunctionTool`, `Handoff` (transfer anlambilimine sahip bir işlev aracı olarak).
- Giriş/çıkış/araç korkulukları, aktarma gönderimi ve atlama sayacıyla `Runner`.
- İz şeklini göstermek için basit bir yayılma yayıcı.
- Kullanıcının sorgusuna göre faturalandırmaya veya desteğe aktarılan bir agent önceliklendirmesi; korkuluk tek girişte açılır.

Çalıştır:

```
python3 code/main.py
```

İz, iki başarılı aktarmayı, bir giriş korkuluk açmasını ve gerçek SDK'nın yaydığını yansıtan bir yayılma ağacını gösterir.

## Kullan onu

- OpenAI ilk ürünleri için **OpenAI Agent SDK'sı**.
- Claude First ürünleri için **Claude Agent SDK** (Ders 17).
- **LangGraph** (Ders 13) açık ve kalıcı bir özgeçmiş istediğinizde.
- **Özel** tam kontrole ihtiyaç duyduğunuzda (ses, çoklu sağlayıcı, birleştirilmiş deployment'ler).

## Gönderin

`outputs/skill-agents-sdk-scaffold.md`, bir Agent SDK uygulamasını agent önceliklendirmesi, aktarımlar, giriş/çıkış/araç korkulukları, oturum deposu ve bir izleme işlemcisi ile destekler.

## Egzersizler

1. Aktarma atlama sayacı ekleyin: N aktarımdan sonra reddedin. Davranışı takip edin.
2. `nest_handoff_history`'yi bir seçenek olarak uygulayın; aktarmadan önce önceki mesajları tek bir özet halinde daraltın.
3. Engelleyici bir çıkış korkuluğu yazın. Onu tetikleyecek prompt'lerdeki gecikmeyi geçenlerle karşılaştırın.
4. `add_trace_processor`'yi bir JSON günlükçüye bağlayın. Açıklık başına hangi şekli yayar?
5. SDK belgelerini okuyun. Stdlib oyuncağınızı `openai-agents-python`'ye taşıyın. Neyi yanlış modelledin?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent | "Yüksek Lisans + talimatlar" | SDK'daki Agent türü; aletlerin ve aktarmaların sahibi |
| Aktarma | "Aktarım" | Model çağrılarını başka bir kişiye yetki vermek için kullanılan araç agent |
| Korkuluk | "Politika kontrolü" | Giriş/çıkış/araç çağrısında doğrulama |
| Tripwire | "Korkuluk gezisi" | Korkuluk reddedildiğinde ortaya çıkan istisna |
| Oturum | "Tarih mağazası" | Çalıştırmalar arasında kalıcı konuşma belleği |
| İzleme | "Açıklıklar" | LLM + alet + aktarma + korkuluk üzerinde yerleşik observability |
| Engelleme korkuluğu | "Sıralı kontrol" | Önce korkuluk çalışır; yolculukta token atık yok |
| Paralel korkuluk | "Eşzamanlı kontrol" | Korkuluk yanından geçiyor; gecikme süresi azalır, yolculuk sırasında token israfı |

## Daha Fazla Okuma

- [OpenAI Agents SDK belgeleri](https://openai.github.io/openai-agents-python/) — temel öğeler, aktarmalar, korkuluklar, izleme
- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude aromalı karşılığı
- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — aktarmalar için ne zaman ulaşılmalı
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — standart Agent SDK'sı haritayı kapsar
