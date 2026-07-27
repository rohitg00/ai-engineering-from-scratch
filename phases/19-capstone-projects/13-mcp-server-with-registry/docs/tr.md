# Capstone 13 — Kayıt Defteri ve Yönetim Özellikli MCP Sunucusu

> Model Bağlam Protokolü gelecek olmayı bıraktı ve 2026'da varsayılan araç kullanımı spesifikasyonu haline geldi. Antropik, OpenAI, Google ve tüm büyük IDE, MCP istemcilerini gönderir. Pinterest, MCP sunucularından oluşan dahili ekosistemini yayınladı. AAIF Kaydı, `.well-known` adresindeki yetenek meta verilerini resmileştirdi. AWS ECS durum bilgisi olmayan deployment referansını yayınladı. Block'un kazı-agent aynı protokolü barındırılan bir asistanın içine yerleştirdi. 2026 üretim şekli şu şekildedir: StreamableHTTP aktarımı, OAuth 2.1 kapsamları, OPA politika geçişi ve platform ekiplerinin sunucuları keşfetmesine, doğrulamasına ve etkinleştirmesine olanak tanıyan bir kayıt defteri. Bunu uçtan uca inşa edin.

**Tür:** Kapak taşı
**Diller:** Python (sunucu, FastMCP aracılığıyla) veya TypeScript (@modelcontextprotocol/sdk), Go (kayıt defteri hizmeti)
**Önkoşullar:** Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar ve MCP), Aşama 14 (agents), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P11 · P13 · P14 · P17 · P18
**Süre:** 25 saat

## Sorun

MCP, araç kullanımının ortak dili haline geldi. Claude Code, Cursor 3, Amp, OpenCode, Gemini CLI ve yönetilen her agent artık MCP sunucularını kullanıyor. Üretimdeki zorluklar, sunucuların yazılması değil (FastMCP bunu kolaylaştırır), ancak bunları kurumsal gereksinimlere uygun ölçekte dağıtmaktır: kiracı başına OAuth kapsamları, yıkıcı araçlara ilişkin OPA politikası, StreamableHTTP durum bilgisi olmayan ölçeklendirme, keşif için bir kayıt defteri, araç çağrısı başına denetim günlükleri. Pinterest'in dahili MCP ekosistemi ve AAIF Kayıt Defteri spesifikasyonu 2026 çıtasını belirliyor.

10 dahili aracı (Postgres salt okunur, S3 listeleme, Jira, Linear, Datadog vb.), platform keşfi için bir kayıt defteri kullanıcı arayüzünü ve yıkıcı araçlar için bir insan onayı kapısını açığa çıkaran bir MCP sunucusu oluşturacaksınız. Yük testi StreamableHTTP yatay ölçeklendirmeyi gösterir. Denetim izi kurumsal güvenlik incelemesini karşılıyor.

## Konsept

MCP 2026 revizyonu, StreamableHTTP'yi varsayılan aktarım olarak zorunlu kılar. Önceki stdio ve SSE şeklinden farklı olarak StreamableHTTP varsayılan olarak durum bilgisizdir: tek bir HTTP uç noktası JSON-RPC isteklerini kabul eder, yanıtları aktarır ve bildirimler için uzun ömürlü bağlantıları destekler. Durum bilgisi olmayan, bir yük dengeleyicinin arkasında yatay olarak ölçeklenebilir anlamına gelir.

Yetkilendirme, araç başına kapsamlarla OAuth 2.1'dir. Bir token, `jira:read`, `s3:list`, `postgres:query:readonly` gibi kapsamları taşır. MCP sunucusu kapsamları yalnızca oturumun başlangıcında değil, araç çağrısı sırasında da kontrol eder. Yüksek riskli araçlar için sunucu, kapsamı son N dakika içinde `approved:by:human` düzeyine yükseltilmeyen tüm çağrıları reddeder; bu yükseltme bir Slack inceleme kartından gelir.

Kayıt defteri ayrı bir hizmettir. Her MCP sunucusu, araç bildirimi, aktarım URL'si ve kimlik doğrulama gereksinimleriyle birlikte bir `.well-known/mcp-capabilities` belgesini kullanıma sunar. Kayıt defteri yoklar, doğrular ve dizinler. Platform ekipleri, hangi araçların kullanılabilir olduğunu, hangi kapsamlara ihtiyaç duyduklarını ve bunlara hangi ekiplerin sahip olduğunu görmek için kayıt defteri kullanıcı arayüzünü kullanır.

## Mimarlık

```
MCP client (Claude Code, Cursor 3, ...)
          |
          v
StreamableHTTP over HTTPS (JSON-RPC + streaming)
          |
          v
MCP server (FastMCP) behind load balancer
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 listing  Jira       Linear     Datadog
(read-only) (paged)     (read)     (read)     (query)
          |
   +------+-------------+
   v                    v
 OPA policy gate   destructive tool MCP (separate server)
                        |
                        v
                   human approval via Slack
                        |
                        v
                   audit log (append-only, per-tenant)

  registry service
     |
     v  GET /.well-known/mcp-capabilities from each server
     v
     UI: search / validate / enable-disable / ownership
```

## Yığın

- Sunucu framework: FastMCP (Python) veya `@modelcontextprotocol/sdk` (TypeScript)
- Aktarım: HTTPS üzerinden StreamableHTTP (durum bilgisi olmayan)
- Kimlik Doğrulama: SPIFFE / SPIRE aracılığıyla iş yükü kimliğiyle OAuth 2.1
- Politika: Araç başına OPA / Rego kuralları; Talep başına politika karar hizmeti
- Kayıt defteri: kendi kendine barındırılan, `.well-known/mcp-capabilities` bildirimini tüketir
- İnsan onayı: Yıkıcı araçlar için Slack etkileşimli mesajı
- Deployment: AWS ECS Fargate veya Fly.io, kiracı başına bir sunucu veya kiracı kapsamıyla paylaşılıyor
- Denetim: çağrı başına kökene sahip, kiracı başına yapılandırılmış JSONL grubu

## Build It — Kendin Geliştir

1. **Araç yüzeyi.** 10 dahili aracı kullanıma çıkarın: Postgres salt okunur sorgu, S3 liste nesneleri, Jira arama/getirme, Doğrusal arama/getirme, Datadog metrik sorgusu, PagerDuty çağrı sırasında arama, GitHub salt okunur, Notion arama, Slack arama, Salesforce okuma. Her aracın yazılı bir şeması ve kapsam etiketi vardır.

2. **FastMCP sunucusu.** Araçları monte edin. StreamableHTTP aktarımını yapılandırın. OAuth token iç incelemesi ve kapsamın uygulanması için bir ara yazılım ekleyin.

3. **OPA politikası.** Araç başına rego politikası: hangi kapsamlar çağrıya izin verir, hangi PII düzeltmeleri uygulanır, hangi yük boyutu sınırları uygulanır. Karar servisi her araç çağrısında çağrıldı.

4. **Kayıt defteri hizmeti.** Kayıtlı sunuculardan `.well-known/mcp-capabilities` 'yi yoklayan, JSON Şeması ile doğrulayan ve bir liste / arama / doğrulama / etkinleştirme-devre dışı bırakma kullanıcı arayüzünü ortaya çıkaran ayrı Go veya TS hizmeti.

5. **Yetenek bildirimi.** Her sunucu, `.well-known/mcp-capabilities` 'yi aşağıdakilerle birlikte kullanıma sunar: araç listesi, kimlik doğrulama gereksinimleri, aktarım URL'si, sahip ekibi, SLO.

6. **Yıkıcı araç ayrımı.** Durumu değiştiren araçlar (Jira oluşturma, Doğrusal oluşturma, Postgres yazma), daha sıkı bir kimlik doğrulama akışına sahip ikinci bir MCP sunucusunda yaşar: token'lar, Slack kartı aracılığıyla 15 dakika içinde yükseltilmiş bir `approved:by:human` kapsamına sahip olmalıdır.

7. **Denetim günlüğü.** Kiracı başına yalnızca eklenen JSONL: `{timestamp, user, tool, args_redacted, response_redacted, outcome}`. Yazmadan önce Presidio aracılığıyla PII redaksiyonu.

8. **Yük testi.** StreamableHTTP'de 100 eşzamanlı istemci. İkinci bir kopya ekleyerek yatay ölçeklendirmeyi gösterin; yük dengeleyicinin oturum yapışkanlığı olmadan yeniden dağıtıldığını gösterin.

9. **Uyumluluk testleri.** Resmi MCP uyumluluk paketini her iki sunucuda da çalıştırın. Tüm zorunlu bölümleri geçin.

## Use It — Hazır Araçla Uygula

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   capability validated: postgres.readonly v1.2
[policy]    scope postgres:query:readonly present; allowed
[audit]     logged: user=u42 tool=postgres.readonly outcome=ok
response:    { "result": { "rows": [[1]] } }
```

## Ship It — Kullanıma Sun

`outputs/skill-mcp-server.md` teslimatı açıklar. OAuth 2.1 kapsamlarına ve OPA geçişine sahip dahili araçlar için üretim düzeyinde bir MCP sunucusu + kayıt defteri + denetim katmanı.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Spesifikasyon uyumluluğu | StreamableHTTP + yetenek bildirimi MCP uygunluk testlerini geçti |
| 20 | Güvenlik | Kapsamın uygulanması, her araçta OPA kapsamı, gizli hijyen |
| 20 | Observability | PII düzenlemesi ile araç başına arama denetim günlüğü |
| 20 | Ölçek | 100 istemcili yük testi yatay ölçek gösterimi |
| 15 | Kayıt Defteri Kullanıcı Deneyimi | İş akışını keşfedin / doğrulayın / etkinleştirin-devre dışı bırakın |
| **100** | | |

## Egzersizler

1. Yeni bir araç ekleyin (Kavşak araması). Çekirdek sunucuya dokunmadan kayıt defteri doğrulama akışı aracılığıyla gönderin.

2. `email`, `ssn` veya `phone` adlı sütunları içeren Postgres sorgu sonuçlarını çıkaran bir OPA politikası yazın. Bir araştırma sorgusu ile alıştırma yapın.

3. Yerel gecikmede Benchmark StreamableHTTP ve stdio karşılaştırması. Arama başına rapor p50/p95.

4. Kiracı başına kotayı uygulayın: kiracı ve araç başına dakika başına maksimum N çağrı. İkinci bir OPA kuralı aracılığıyla yürürlüğe koyun.

5. [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) adresinden MCP uyumluluk paketini çalıştırın ve her hatayı düzeltin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| YayınlanabilirHTTP | "2026 MCP aktarımı" | Durum bilgisi olmayan HTTP + akışı; ağ bağlantılı sunucular için SSE + stdio'nun yerini alıyor |
| Yetenek bildirimi | "Tanınmış belge" | Araç listesi, kimlik doğrulama, aktarım URL'si ile `.well-known/mcp-capabilities` |
| OPA / Geri | "Politika motoru" | Araç çağrılarının harici kurallara karşı yetkilendirilmesi için Açık Politika Agent |
| Kapsam yükseltmesi | "İnsanlar tarafından onaylandı" | Slack onayıyla verilen kısa ömürlü kapsam, yıkıcı araçlar için gereklidir |
| Kayıt | "Takım keşfi" | MCP sunucularını yetenek bildirimlerinden indeksleyen hizmet |
| İş yükü kimliği | "SPIFFE / KULESİ" | OAuth token verilmesi için şifreleme hizmeti kimliği |
| Uyumluluk paketi | "Özellikler testleri" | StreamableHTTP + araç bildiriminin doğruluğu için resmi MCP test pili |

## Daha Fazla Okuma

- [Model Bağlam Protokolü 2026 Yol Haritası](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP, yetenek meta verileri, kayıt defteri
- [AAIF MCP Kayıt Defteri spesifikasyonu](https://github.com/modelcontextprotocol/registry) — 2026 kayıt defteri spesifikasyonu
- [AWS ECS referansı deployment](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — referans üretimi deployment
- [Pinterest dahili MCP ekosistemi](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — dahili referans deployment
- [ `goose` MCP kullanımını engelle](https://block.github.io/goose/) — agent tüketim modelini referans al
- [FastMCP](https://github.com/jlowin/fastmcp) — Python sunucusu framework
- [Açık Politika Agent](https://www.openpolicyagent.org/) — politika motoru referansı
- [SPIFFE / SPIRE](https://spiffe.io) — iş yükü kimlik referansı
