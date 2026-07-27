# MCP Örnekleme — Sunucu Tarafından Talep Edilen LLM Tamamlamaları ve Agent Loop'ler

> Çoğu MCP sunucusu aptal uygulayıcılardır: argümanları alır, kodu çalıştırır, içeriği döndürür. Örnekleme, sunucunun yön değiştirmesine olanak tanır: müşterinin LLM'sinden bir karar vermesini ister. Bu, sunucunun herhangi bir model kimlik bilgilerine sahip olmasına gerek kalmadan, sunucuda barındırılan agent loop'lere olanak tanır. 2025-11-25'te birleştirilen SEP-1577, döngünün daha derin muhakeme içerebilmesi için örnekleme isteklerinin içine araçlar ekledi. Sapma riski notu: SEP-1577 araç-örnekleme şekli 2026'nın ilk çeyreğine kadar deneyseldi ve halen SDK API'lerine yerleşiyor.

**Tür:** Yapım
**Diller:** Python (stdlib, örnekleme koşum takımı)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu), Aşama 13 · 10 (kaynaklar ve prompt'ler)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- `sampling/createMessage`'nin neyi çözdüğünü açıklayın (sunucu tarafı API anahtarları olmadan sunucuda barındırılan döngüler).
- İstemciden çok dönüşlü bir prompt üzerinden örnekleme yapmasını isteyen ve tamamlamayı döndüren bir sunucu uygulayın.
- Müşteri modeli seçimine rehberlik etmek için `modelPreferences`'yi (maliyet / hız / zeka öncelikleri) kullanın.
- Sabit kodlama davranışı yerine örnekleme yoluyla dahili olarak yinelenen bir `summarize_repo` aracı oluşturun.

## Sorun

Kod özetleme iş akışı için kullanışlı bir MCP sunucusunun şunları yapması gerekir: bir dosya ağacında gezinmek, hangi dosyaların okunacağını seçmek, bir özeti sentezlemek ve geri dönmek. Yüksek Lisans muhakemesi nerede gerçekleşir?

Seçenek A: sunucu kendi LLM'sini çağırır. API anahtarı gerektirir, sunucu tarafında faturalanır, kullanıcı başına pahalıdır.

Seçenek B: sunucu ham içeriği döndürür; müşterinin agent'si muhakemeyi yapar. Çalışıyor ancak sunucu mantığını hassas olan prompt istemcisine taşıyor.

Seçenek C: sunucu, müşterinin LLM'sini `sampling/createMessage` aracılığıyla sorar. Sunucu algoritmayı (hangi dosyaların okunacağı, kaç geçiş yapılacağı) korurken istemci faturalandırmayı ve model seçimini korur. Sunucunun hiçbir kimlik bilgisi yok.

Örnekleme C seçeneğidir. Bu, güvenilir bir sunucunun kendisi tam bir LLM ana bilgisayarı olmadan bir agent loop'yi barındırabilmesini sağlayan mekanizmadır.

## Konsept

### `sampling/createMessage` isteği

Sunucu şunu gönderir:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{"role": "user", "content": {"type": "text", "text": "..."}}],
    "systemPrompt": "...",
    "includeContext": "none",
    "modelPreferences": {
      "costPriority": 0.3,
      "speedPriority": 0.2,
      "intelligencePriority": 0.5,
      "hints": [{"name": "claude-3-5-sonnet"}]
    },
    "maxTokens": 1024
  }
}
```

Müşteri LLM'yi çalıştırır ve şunu döndürür:

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

Toplamı 1,0 olan üç kayan nokta:

- `costPriority`: daha ucuz modelleri tercih edin.
- `speedPriority`: daha hızlı modelleri tercih edin.
- `intelligencePriority`: daha yetenekli modelleri tercih edin.

Ayrıca `hints`: sunucunun tercih ettiği adlandırılmış modeller. Müşteri ipuçlarını dikkate alabilir veya dikkate almayabilir; istemcinin kullanıcı yapılandırması her zaman kazanır.

### `includeContext`

Üç değer:

- `"none"` — yalnızca sunucu tarafından sağlanan mesajlar. Varsayılan.
- `"thisServer"` — bu sunucunun oturumundan önceki mesajları içerir.
- `"allServers"` — tüm oturum bağlamını içerir.

`includeContext`, bir güvenlik sorunu olan sunucular arası bağlamı sızdırdığı için 2025-11-25 itibarıyla geçici olarak kullanımdan kaldırıldı. `"none"`'yi tercih edin ve mesajlarda açık bağlamı iletin.

### Araçlarla numune alma (SEP-1577)

2025-11-25'teki yenilikler: örnekleme isteği bir `tools` dizisi içerebilir. İstemci bu araçları kullanarak tam bir araç çağırma döngüsü çalıştırır. Bu, sunucunun, istemcinin modeli aracılığıyla ReAct tarzı bir agent loop barındırmasına olanak tanır.

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

İstemci döngü yapar: örnek alır, çağrılırsa aracı çalıştırır, tekrar örnek alır, son yardımcı mesajını döndürür. Bu, 2026 yılının ilk çeyreğine kadar deneyseldir; SDK imzaları hâlâ sürüklenebilir. Uyguladığınızda 2025-11-25 spesifikasyonunun istemci/örnekleme bölümüne göre onaylayın.

### Döngüdeki insan

İstemci, örneği çalıştırmadan önce sunucunun modelden ne yapmasını istediğini kullanıcıya GÖSTERMELİDİR. Kötü amaçlı bir sunucu, kullanıcının oturumunu değiştirmek için örneklemeyi kullanabilir ("kullanıcıya X deyin, böylece Y'ye tıklasınlar"). Kullanıcının reddedebileceği bir onay iletişim kutusu olarak Claude Desktop, VS Code ve Cursor yüzey örnekleme istekleri.

2026 konsensüsü: İnsan onayı olmadan numune alınması bir tehlike işaretidir. Ağ geçitleri (Aşama 13 · 17) düşük riskli örneklemeyi otomatik olarak onaylayabilir ve şüpheli her şeyi otomatik olarak reddedebilir.

### API anahtarları olmadan sunucuda barındırılan döngüler

Kurallı kullanım durumu: kendi LLM erişimi olmayan bir kod özetleme MCP sunucusu. Şunları yapar:

1. Repo yapısını yürütün.
2. `sampling/createMessage`'yi "Bu reponun amacını tanımlaması en muhtemel beş dosyayı seç" ile arayın.
3. Bu dosyaları okuyun.
4. Dosyaların içeriğini `sampling/createMessage` ile çağırın ve "Repo'yu 3 paragrafta özetleyin."
5. Özeti `tools/call` sonucu olarak döndürün.

Sunucu hiçbir zaman bir LLM API'sine dokunmaz. Müşterinin kullanıcısı tamamlamalar için kendi kimlik bilgilerini kullanarak ödeme yapar.

### Güvenlik riskleri (Birim 42 açıklaması, 2026 1. Çeyrek)

- **Gizli örnekleme.** Örneklemeyi her zaman "oturum bağlamından kullanıcının e-postasıyla yanıtlama" ile çağıran bir araç. Aşama 13 · 15, saldırı vektörlerini kapsar.
- **Örnekleme yoluyla kaynak hırsızlığı.** Sunucu, istemciden saldırganın yükünü özetlemesini ister ve kullanıcıya fatura keser.
- **Döngü bombaları.** Sunucu örneklemeyi sıkı bir döngüde çağırır. İstemcilerin oturum başına hız sınırlarını uygulaması ZORUNLUDUR.

## Kullan onu

`code/main.py`, sunucudan istemciye sahte bir örnekleme sistemi gönderir. Simüle edilmiş bir "summarize_repo" aracı, iki örnekleme turu başlatır (dosyaları seç, sonra özetle) ve sahte istemci, hazır yanıtlar döndürür. Koşum şunu gösterir:

- Sunucu, `modelPreferences` ile `sampling/createMessage`'yi gönderir.
- İstemci bir tamamlama döndürür.
- Sunucu döngüsüne devam eder.
- Hız sınırlayıcı, araç çağrısı başına toplam örnekleme çağrılarını sınırlar.

Neye bakmalı:

- Sunucu yalnızca bir aracı kullanıma sunar (`summarize_repo`); tüm akıl yürütme örnekleme çağrılarında gerçekleşir.
- Model tercihleri müşterinin model seçimine ağırlık verir; ipuçları tercih edilen modelleri listeler.
- Döngü `stopReason: "endTurn"`'de sona erer.
- `max_samples_per_tool = 5` limiti kontrolden çıkan bir döngü yakalıyor.

## Gönderin

Bu ders `outputs/skill-sampling-loop-designer.md`'yi üretir. LLM çağrılarına (araştırma, özetleme, planlama) ihtiyaç duyan bir sunucu tarafı algoritması göz önüne alındığında, beceri, doğru model Tercihleri, hız sınırları ve güvenlik onaylarıyla örnekleme tabanlı bir uygulama tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. `max_samples_per_tool`'yi 2 olarak değiştirin ve hız sınırı kesimini gözlemleyin.

2. SEP-1577 araç-örnekleme varyantını uygulayın: örnekleme isteği bir `tools` dizisini taşır. Son tamamlamayı döndürmeden önce istemci tarafındaki döngünün bu araçları çalıştırdığını doğrulayın. Kayma riskine dikkat edin: SDK imzaları 2026'nın ilk yarısına kadar hâlâ değişebilir.

3. Döngüdeki insan onayını ekleyin: sunucunun ilk `sampling/createMessage` işleminden önce duraklatın ve kullanıcı onayını bekleyin. Reddedilen çağrılar yazılı bir ret yanıtı döndürür.

4. İstemci oturumuna göre anahtarlanan kullanıcı başına hız sınırlayıcı ekleyin. Aynı kullanıcının aynı sunucu döngüleri bir bütçeyi paylaşmalıdır.

5. Dahil edilecek parçaları seçmek için örneklemeyi kullanan bir `summarize_pdf` aracı tasarlayın. Gönderilen mesajların taslağını çizin. `modelPreferences.intelligencePriority`, davranışı 0,1'e karşı 0,9'da nasıl değiştirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Örnekleme | "Sunucudan istemciye LLM çağrısı" | Sunucu, istemcinin modelinin tamamlanmasını ister |
| `sampling/createMessage` | "Yöntem" | Örnekleme istekleri için JSON-RPC yöntemi |
| `modelPreferences` | "Model öncelikleri" | Maliyet / hız / zeka ağırlıkları artı isim ipuçları |
| `includeContext` | "Oturumlar arası sızıntı" | Geçici olarak kullanımdan kaldırılan bağlam ekleme modu |
| EYLÜL-1577 | "Örneklemedeki araçlar" | Sunucuda barındırılan ReAct için örnekleme içindeki araçlara izin ver |
| Döngüdeki insan | "Kullanıcı onaylıyor" | İstemci, çalıştırmadan önce kullanıcıya örnekleme isteğini iletiyor |
| Döngü bombası | "Kaçak örnekleme" | Sunucu tarafı sonsuz örnekleme döngüsü; istemcinin hız limiti olması gerekir |
| Gizli örnekleme | "Gizli mantık" | Kötü amaçlı sunucu, prompt'leri örnekleme amacını gizler |
| Kaynak hırsızlığı | "Kullanıcının LLM bütçesi kullanılıyor" | Sunucu, istemciyi istemediği örneklemeye harcamaya zorluyor |
| `stopReason` | "Neden üretim durduruldu" | `endTurn`, `stopSequence` veya `maxTokens` |

## Daha Fazla Okuma

- [MCP — Kavramlar: Örnekleme](https://modelcontextprotocol.io/docs/concepts/sampling) — örneklemeye üst düzeyde genel bakış
- [MCP — İstemci örnekleme spesifikasyonu 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — standart `sampling/createMessage` şekli
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — Örneklemedeki araçlar için Özel Gelişim Teklifi (deneysel)
- [Birim 42 — MCP saldırı vektörleri](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — gizli örnekleme ve kaynak hırsızlığı modelleri
- [Speakeasy — MCP örnekleme çekirdek konsepti](https://www.speakeasy.com/mcp/core-concepts/sampling) — istemci tarafı kod örnekleriyle ayrıntılı bilgi
