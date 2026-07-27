# Capstone — Eksiksiz bir Araç Ekosistemi Oluşturun

> Aşama 13 her parçayı öğretti. Bu kapak taşı bunları üretim şeklindeki tek bir sisteme bağlar: araçlar + kaynaklar + prompt'ler + görevler + kullanıcı arayüzü, uçta OAuth 2.1 içeren bir MCP sunucusu, bir RBAC ağ geçidi, çok sunuculu bir istemci, bir A2A alt agent çağrısı, bir toplayıcıya yönelik OTel izleme, CI'da araç zehirlenmesi tespiti ve bir AGENTS.md + SKILL.md paketi. Sonunda her mimari seçimi savunabilirsiniz.

**Tür:** Yapım
**Diller:** Python (stdlib, uçtan uca ekosistem donanımı)
**Önkoşullar:** Aşama 13 · 01'den 21'e
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- `ui://` uygulamasıyla araçları, kaynakları, prompt'leri ve bir görevi açığa çıkaran bir MCP sunucusu oluşturun.
- Sunucuyu, RBAC'yi ve sabitlenmiş karmaları uygulayan bir OAuth 2.1 ağ geçidiyle ön plana çıkarın.
- OTel GenAI niteliklerini uçtan uca takip eden çok sunuculu bir istemci yazın.
- İş yükünün bir kısmını bir A2A alt agent'ye devredin; opaklığın korunduğunu doğrulayın.
- Tüm yığını AGENTS.md + SKILL.md ile paketleyin, böylece diğer agent'ler onu çalıştırabilir.

## Sorun

"Araştırma ve raporlama" sistemini gönderin:

- Kullanıcı şunu sorar: "agent protokolleri hakkında en çok alıntı yapılan 2026 arXiv makalesini özetleyin."
- Sistem: MCP aracılığıyla arXiv'i arayın; A2A aracılığıyla makale özetleme işlemini uzman bir yazara agent devredin; toplu sonuçlar; MCP Uygulamaları `ui://` kaynağı olarak etkileşimli bir rapor oluşturun; Her adımı OTel'e kaydedin.

Aşama 13'teki tüm ilkeller ortaya çıkıyor. Bu bir oyuncak değil; 2026'da Anthropic (Claude Research ürünü), OpenAI (Apps SDK'lı GPT'ler) ve üçüncü taraflar tarafından gönderilen üretim araştırma asistanı sistemleri tam da bu şekle sahip.

## Konsept

### Mimarlık

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### İzleme hiyerarşisi

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

Bir izleme kimliği. Her yayılma doğru `gen_ai.*` özniteliklerine sahiptir.

### Güvenlik duruşu

- Hedef kitleyi ağ geçidine sabitleyen kaynak göstergesiyle OAuth 2.1 + PKCE.
- Ağ geçidi, yukarı akış kimlik bilgilerini tutar; kullanıcı bunları asla görmez.
- RBAC: `alice`, `research:read`, `research:write`'ye sahiptir, tüm araçları çağırabilir. `bob`'de `research:read` var, `generate_report` çağrılamıyor.
- Sabitlenmiş açıklama bildirimi: araç karmaları değişen tüm sunucular bırakıldı.
- İki Kuralı denetimi: hiçbir araç güvenilmeyen girdiyi, hassas verileri ve sonuç niteliğindeki eylemi birleştirmez.

### Oluşturma

Son `generate_report` görevi içerik bloklarının yanı sıra bir `ui://report/current` kaynağı döndürür. İstemcinin ana bilgisayarı (Claude Desktop vb.), etkileşimli kontrol panelini bir korumalı alan iframe'inde oluşturur. Kontrol panelinde sıralanmış bir makale listesi, alıntı sayıları ve kullanıcının tıkladığı herhangi bir makale için `host.callTool('summarize_paper', {arxiv_id})`'yi çağıran bir düğme bulunur.

### Paketleme

Her şey şu şekilde gönderilir:

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

Kullanıcılar `docker compose up` ile dağıtım yapar. Claude Code, Cursor, Codex ve opencode kullanıcıları `run-research` becerisini kullanarak sistemi çalıştırabilirler.

### Her Aşama 13 dersinin katkısı nedir?

| Ders | Kapak taşı ne kullanır |
|--------|------------------------|
| 01-05 | Araç arayüzü, sağlayıcı tarafından taşınabilirlik, paralel çağrılar, şemalar, astarlama |
| 06-10 | MCP temel öğeleri, sunucu, istemci, aktarımlar, kaynaklar + prompt'ler |
| 11-14 | Örnekleme, kökler + ortaya çıkarma, eşzamansız görevler, `ui://` uygulamalar |
| 15-17 | Araç zehirlenmesi, OAuth 2.1, ağ geçidi + kayıt defteri |
| 18 | A2A alt agent heyeti |
| 19 | OTel GenAI izleme |
| 20 | Yüksek Lisans katmanı için yönlendirme ağ geçidi |
| 21 | SKILL.md + AGENTS.md paketleme |

## Kullan onu

`code/main.py` önceki derslerin modellerini çalıştırılabilir tek bir demoda birleştiriyor. Tamamı stdlib, tamamı işlem halinde, böylece uçtan uca okuyabilirsiniz. Araştırma ve raporlama senaryosunun tüm akışını çalıştırır: ağ geçidiyle anlaşma, OAuth 2.1 simüle edilmiş, araçlar/liste birleştirilmiş, görev olarak rapor oluştur, yazara A2A çağrısı, ui:// kaynağı döndürüldü, OTel yayılımları yayıldı.

Neye bakmalı:

- Her atlamada bir izleme kimliği.
- Ağ geçidi politikası ikinci bir kullanıcının yazmasını engeller.
- Görev yaşam döngüsü çalışmaya başlar → tamamlanır ve hem metin hem de ui:// içeriğini döndürür.
- A2A çağrısının iç durumu orkestratör için opaktır.
- AGENTS.md ve SKILL.md, başka bir agent'nin iş akışını yeniden oluşturmak için ihtiyaç duyduğu dosyalardır.

## Gönderin

Bu ders `outputs/skill-ecosystem-blueprint.md`'yi üretir. Bir ürün ihtiyacı göz önüne alındığında (araştırma, özetleme, otomasyon), beceri tam mimariyi üretir: hangi MCP temelleri, hangi ağ geçidini kontrol eder, hangi A2A çağırır, hangi telemetri, hangi paketleme.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Tek izleme kimliğini ve yuvanın nasıl yayıldığına dikkat edin. Demonun 13. Aşamadan kaç ilkel öğeye dokunduğunu sayın.

2. Demoyu genişletin: ikinci bir arka uç MCP sunucusu ekleyin (e.g. `bibliography`) ve ağ geçidinin araçlarını aynı ad alanında birleştirdiğini doğrulayın.

3. Sahte A2A yazıcı agent'yi bir alt işlemde çalışan gerçek yazıcıyla değiştirin. Ders 19 emniyet kemerini kullanın.

4. Orchestrator ile LLM arasındaki yönlendirme ağ geçidine bir PII düzenleme adımı ekleyin. Kullanıcı sorgusundaki e-postaların silindiğini onaylayın.

5. Bu sistemin bakımını yapacak bir takım arkadaşınız için bir AGENTS.md yazın. Okumak ve onlara İmleç veya Kodeks'te kapak taşını sürmek için ihtiyaç duydukları her şeyi vermek beş dakikadan az sürecektir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Bitirme Taşı | "Faz-13 entegrasyon demosu" | Her ilkel ürünü kullanan uçtan uca sistem |
| Araştırma ve raporlama | "Senaryo" | Deseni arayın, özetleyin, oluşturun |
| Ekosistem | "Bütün parçalar bir arada" | Sunucu + istemci + ağ geçidi + alt agent + telemetri + paket |
| Hiyerarşiyi izle | "Tek izleme kimliği" | Her atlama aralığı izi paylaşır; yayılma kimlikleri aracılığıyla ebeveyn-çocuk |
| Ağ geçidi tarafından verilen token | "Geçişli kimlik doğrulama" | İstemci yalnızca ağ geçidinin token'sini görür; ağ geçidi yukarı akış kredilerini tutar |
| Birleştirilmiş ad alanı | "Tüm araçlar tek bir listede" | Ağ geçidinde çoklu sunucu birleştirme, çarpışma durumunda önek |
| Opaklık sınırı | "A2A çağrısı dahili bilgileri gizler" | Sub-agent'nin mantığı orkestratöre görünmez |
| Üç katmanlı yığın | "AGENTS.md + SKILL.md + MCP" | Proje içeriği + iş akışı + araçlar |
| Derinlemesine savunma | "Birden fazla güvenlik katmanı" | Sabitlenmiş karmalar, OAuth, RBAC, İkili Kural, denetim günlüğü |
| Spesifikasyon uyumluluğu matrisi | "Spesifikasyonun gerektirdiği şeyleri gönderiyoruz" | Teslimatların 2025-11-25 gereksinimlerine göre eşleştirilmesi için kontrol listesi |

## Daha Fazla Okuma

- [MCP — Spesifikasyon 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — birleştirilmiş referans
- [MCP blogu — 2026 yol haritası](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — protokolün gittiği yer
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 referansı
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — kanonik izleme kuralları
- [Anthropic — Claude Agent SDK'ya genel bakış](https://code.claude.com/docs/en/agent-sdk/overview) — üretim agent çalışma zamanı modelleri
