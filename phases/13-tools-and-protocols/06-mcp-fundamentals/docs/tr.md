# MCP Temelleri — İlkeller, Yaşam Döngüsü, JSON-RPC Tabanı

> MCP'den önceki her entegrasyon tek seferlikti. İlk olarak Kasım 2024'te Anthropic tarafından gönderilen ve şu anda Linux Foundation'ın Agentic AI Foundation tarafından yönetilen Model Bağlam Protokolü, herhangi bir istemcinin herhangi bir sunucuyla konuşabilmesi için keşif ve çağrıyı standart hale getiriyor. 2025-11-25 spesifikasyonu, altı temel öğeyi (üç sunucu, üç istemci), üç aşamalı bir yaşam döngüsünü ve bir JSON-RPC 2.0 kablo formatını adlandırır. Bunları öğrenin ve bu aşamanın MCP bölümünün geri kalanı okumaya dönüşsün.

**Tür:** Öğren
**Diller:** Python (stdlib, JSON-RPC ayrıştırıcı)
**Önkoşullar:** Aşama 13 · 01 - 05 (araç arayüzü ve işlev çağrısı)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Altı MCP temel öğesinin tümünü (araçlar, kaynaklar, sunucudaki prompt'ler; istemcide kökler, örnekleme, ortaya çıkarma) adlandırın ve her birine bir kullanım durumu verin.
- Üç aşamalı yaşam döngüsünü (başlatma, çalıştırma, kapatma) gözden geçirin ve her aşamada kimin hangi mesajı gönderdiğini belirtin.
- JSON-RPC 2.0 istek, yanıt ve bildirim zarflarını ayrıştırın ve yayınlayın.
- `initialize`'de yetenek görüşmesinin ne olduğunu ve bu olmadan nelerin bozulduğunu açıklayın.

## Sorun

MCP'den önce, agent aracını kullanan her aracın kendi protokolü vardı. İmlecin MCP şeklinde ancak uyumsuz bir araç sistemi vardı. Claude Desktop farklı bir ürünle birlikte gönderildi. VS Code'un Copilot uzantısının üçüncüsü vardı. Bir "Postgres sorgusu" aracı geliştiren bir ekip, aynı aracı her biri farklı bir ana bilgisayarın API'sine olmak üzere üç kez yazdı. Yeniden kullanmak, kodun kopyalanmasını gerektiriyordu.

Sonuç, tek seferlik entegrasyonların Kambriyen patlaması ve ekosistem hızının tavan yapmasıydı.

MCP, kablo formatını standartlaştırarak bu sorunu giderir. Tek bir MCP sunucusu her MCP istemcisinde çalışır: Claude Desktop, ChatGPT, Cursor, VS Code, Gemini, Goose, Zed, Windsurf, Nisan 2026'ya kadar 300'den fazla istemci. Aylık 110 milyon SDK indirmesi. 10.000'den fazla genel sunucu. Linux Vakfı, Aralık 2025'te yeni Agentic Yapay Zeka Vakfı kapsamında yönetimi devraldı.

Bu aşamada kullanılan spesifikasyon revizyonu **2025-11-25**'tir. Eşzamansız Görevler (SEP-1686), URL modu ortaya çıkarma (SEP-1036), araçlarla örnekleme (SEP-1577), artımlı kapsam onayı (SEP-835) ve OAuth 2.1 kaynak göstergesi semantiği ekler. Aşama 13 · 09'dan 16'ya kadar bu uzantıları kapsar. Bu ders temelde durur.

## Konsept

### Üç sunucu temel öğesi

1. **Araçlar.** Çağrılabilir eylemler. Aşama 13 · 01'deki aynı dört adımlı döngü.
2. **Kaynaklar.** Açığa çıkan veriler. URI tarafından adreslenebilir salt okunur içerik: `file:///path`, `db://query/...`, özel şemalar.
3. **Prompt'ler.** Yeniden kullanılabilir şablonlar. Ana bilgisayar kullanıcı arayüzündeki eğik çizgi komutları; sunucu şablonu sağlar, istemci ise argümanları doldurur.

### Üç istemci temel öğesi

4. **Kökler.** Sunucunun dokunmasına izin verilen URI kümesi. Müşteri bunları beyan eder; sunucu onlara saygı duyuyor.
5. **Örnekleme.** Sunucu, istemcinin modelinin bir tamamlama gerçekleştirmesini ister. Sunucu tarafı API anahtarları olmadan sunucuda barındırılan agent loop'leri etkinleştirir.
6. **Elicitation.** Sunucu, istemcinin kullanıcısından uçuş sırasında yapılandırılmış girdi ister. Formlar veya URL'ler (SEP-1036).

MCP'deki her yetenek bu altı yetenekten tam olarak birine aittir. Aşama 13 · 10'dan 14'e kadar olan aşamaların her biri derinlemesine ele alınır.

### İletim formatı: JSON-RPC 2.0

Her mesaj şu alanları içeren bir JSON nesnesidir:

- İstekler: `{jsonrpc: "2.0", id, method, params}`.
- Yanıtlar: `{jsonrpc: "2.0", id, result | error}`.
- Bildirimler: `{jsonrpc: "2.0", method, params}` — `id` yok, yanıt beklenmiyor.

Temel spesifikasyon, ilkel olarak gruplandırılmış ~ 15 yönteme sahiptir. Önemli olanlar:

- `initialize` / `initialized` (el sıkışma)
- `tools/list`, `tools/call`
- `resources/list`, `resources/read`, `resources/subscribe`
- `prompts/list`, `prompts/get`
- `sampling/createMessage` (sunucudan istemciye)
- `notifications/tools/list_changed`, `notifications/resources/updated`, `notifications/progress`

### Üç aşamalı yaşam döngüsü

**Aşama 1: başlatma.**

Müşteri `initialize`'yi `capabilities` ve `clientInfo` ile gönderir. Sunucu kendi `capabilities`, `serverInfo` ve konuştuğu spesifikasyon sürümüyle yanıt verir. Müşteri yanıtı sindirdiğinde `notifications/initialized` gönderir. Bundan sonra her iki taraf da üzerinde anlaşılan yeteneklere göre istek gönderebilir.

**Aşama 2: çalıştırma.**

Çift yönlü. Müşteri keşfetmek için `tools/list`'yi, ardından çağırmak için `tools/call`'yi arar. Sunucu bu yeteneği bildirmişse `sampling/createMessage` gönderebilir. Sunucu, araç seti değiştiğinde `notifications/tools/list_changed` gönderebilir. Kullanıcı kök kapsamını değiştirdiğinde istemci `notifications/roots/list_changed` gönderebilir.

**Aşama 3: kapatma.**

Her iki taraf da taşımayı kapatır. MCP'de yapılandırılmış kapatma yöntemi yoktur; aktarım (stdio veya Akışlı HTTP, Aşama 13 · 09) bağlantı sonu sinyalini taşır.

### Yetenek müzakeresi

`initialize` el sıkışmasındaki `capabilities` sözleşmedir. Bir sunucudan örnek:

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

Sunucu, `tools/list_changed` bildirimleri gönderebileceğini ve `resources/subscribe`'yi desteklediğini beyan eder. Müşteri aşağıdakileri beyan ederek kabul eder:

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

İstemci `sampling` bildirmezse sunucu `sampling/createMessage`'yi çağırmamalıdır. Simetrik: Sunucu `resources.subscribe` bildirmezse istemci abone olmayı denememelidir.

Ekosistemin sürüklenmesini önleyen şey budur. Örneklemeyi desteklemeyen bir istemci hâlâ geçerli bir MCP istemcisidir; `sampling`'yi çağırmayan bir sunucu hâlâ geçerli bir MCP sunucusudur. Sadece bu özelliği birlikte kullanmıyorlar.

### Yapılandırılmış içerik ve hata şekilleri

`tools/call`, yazılan bloklardan oluşan bir `content` dizisini döndürür: `text`, `image`, `resource`. Aşama 13 · 14, bu listeye MCP Uygulamalarını (`ui://` etkileşimli kullanıcı arayüzü) ekler.

Hatalar JSON-RPC hata kodlarını kullanır. Spesifikasyonla tanımlanan eklemeler: `-32002` "Kaynak bulunamadı", `-32603` "Dahili hata" ve ayrıca `error.data` olarak MCP'ye özgü hata verileri.

### İstemci yetenekleri ve araç çağrısı ayrıntıları

Yaygın bir karışıklık: `capabilities.tools`, istemcinin araç listesiyle değiştirilen bildirimleri destekleyip desteklemediğidir. İstemcinin belirli araçları çağırıp çağırmayacağı, bir yetenek bayrağı değil, modeline göre yönlendirilen bir çalışma zamanı seçimidir. Yetenek bayrağı, spesifikasyon düzeyindeki sözleşmedir. Modelin seçimi diktir.

### Neden REST değil de JSON-RPC?

JSON-RPC 2.0 (2010) hafif, çift yönlü bir protokoldür. REST istemci tarafından başlatılır. MCP'nin sunucu tarafından başlatılan mesajlara (örnekleme, bildirimler) ihtiyacı vardı, dolayısıyla simetrik istek/yanıt şekliyle JSON-RPC doğal bir uyumdu. JSON-RPC ayrıca HTTP'nin istek şeklini yeniden icat etmeden stdio ve WebSocket/Streamable HTTP üzerinde temiz bir şekilde oluşturur.

```figure
mcp-tool-call
```

## Kullan onu

`code/main.py`, minimum düzeyde bir JSON-RPC 2.0 ayrıştırıcı ve yayıcı gönderir, ardından `initialize` → `tools/list` → `tools/call` → `shutdown` sırasını elle yürüterek her mesajı yazdırır. Gerçek ulaşım yok; sadece mesaj şekilleniyor. Her bir zarfı doğrulamak için Daha Fazla Okuma bölümünde bağlantısı verilen teknik özelliklerle karşılaştırın.

Neye bakmalı:

- `initialize` her iki yönde de yetenekleri bildirir; yanıtta `serverInfo` ve `protocolVersion: "2025-11-25"` var.
- `tools/list` bir `tools` dizisini döndürür; her girişte `name`, `description`, `inputSchema` bulunur.
- `tools/call`, `params.name` ve `params.arguments`'yi kullanır.
- `content` yanıtı, `{type, text}` bloklarının bir dizisidir.

## Gönderin

Bu ders `outputs/skill-mcp-handshake-tracer.md`'yi üretir. Bir MCP istemci-sunucu etkileşiminin pcap tarzı bir transkripti verildiğinde, beceri her mesaja hangi ilkel, hangi yaşam döngüsü aşaması ve hangi yeteneğe bağlı olduğunu açıklar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Yetenek anlaşmasının gerçekleştiği satırı tanımlayın ve sunucunun `tools.listChanged` bildirmemesi durumunda nelerin değişeceğini açıklayın.

2. Ayrıştırıcıyı `notifications/progress`'yi işleyecek şekilde genişletin. Mesaj şekli: `{method: "notifications/progress", params: {progressToken, progress, total}}`. Uzun süredir çalışan bir `tools/call` devam ederken bunu yayınlayın ve istemci işleyicisinin bir ilerleme çubuğu görüntüleyeceğini onaylayın.

3. MCP 2025-11-25 teknik özelliklerini yukarıdan aşağıya okuyun — belgenin tamamı yaklaşık 80 sayfadır. Çoğu sunucunun ihtiyaç duymadığı tek yetenek bayrağını belirleyin. İpucu: Kaynak aboneliğiyle ilgilidir.

4. Varsayımsal bir "cron işi" özelliğinin ait olacağı ilkel şeyi kağıt üzerinde çizin. (İpucu: sunucu, istemcinin kendisini planlanmış bir zamanda başlatmasını istiyor. Altı temel öğenin hiçbiri bugüne uymuyor.) MCP'nin 2026 yol haritasında bunun için bir SEP taslağı var.

5. GitHub'daki açık bir MCP sunucusundan bir oturum günlüğünü ayrıştırın. İstek, yanıt ve bildirim mesajlarını sayın. Trafiğin ne kadarının yaşam döngüsüne ve operasyona karşılık geldiğini hesaplayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MCP | "Model Bağlam Protokolü" | Modelden araca keşif ve çağrı için açık protokol |
| Sunucu ilkel | "Sunucunun ortaya çıkardığı şeyler" | araçlar (eylemler), kaynaklar (veriler), prompt'ler (şablonlar) |
| İstemci ilkel | "Bir istemcinin sunucuların kullanmasına izin verdiği şey" | kökler (kapsam), örnekleme (LLM geri aramaları), ortaya çıkarma (kullanıcı girişi) |
| JSON-RPC 2.0 | "Tel formatı" | Simetrik istek/yanıt/bildirim zarfları |
| `initialize` el sıkışma | "Yetenek müzakeresi" | İlk mesaj çifti; sunucular ve istemciler destekledikleri özellikleri beyan ediyor |
| `tools/list` | "Keşif" | İstemci sunucudan mevcut araç setini ister |
| `tools/call` | "Çağrı" | İstemci, sunucudan bağımsız değişkenler içeren bir araç çalıştırmasını ister |
| `notifications/*_changed` | "Mutasyon olayları" | Sunucu istemciye ilkel listesinin değiştiğini bildirir |
| İçerik bloğu | "Yazılan sonuç" | Araç sonucunda `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| EYLÜL | "Spec Gelişim Önerisi" | Adlandırılmış taslak teklif (zaman uyumsuz Görevler için e.g. SEP-1686) |

## Daha Fazla Okuma

- [Model Bağlamı Protokolü — Spesifikasyon 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — standart spesifikasyon belgesi
- [Model Bağlamı Protokolü — Mimari kavramlar](https://modelcontextprotocol.io/docs/concepts/architecture) — altı temel zihinsel model
- [Antropik — Model Bağlam Protokolüne Giriş](https://www.anthropic.com/news/model-context-protocol) — Kasım 2024 lansman gönderisi
- [MCP blogu — MCP'nin ilk yıl dönümü](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — bir yıllık geriye dönük değerlendirme ve 2025-11-25 spesifikasyon değişiklikleri
- [WorkOS — MCP 2025-11-25 spesifikasyon güncellemesi](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686, 1036, 1577, 835 ve 1724'ün özeti
