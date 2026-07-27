# A2A — Agent'den Agent'ye Protokol

> MCP, agent'den takımadır. A2A (Agent2Agent), agent'den agent'ye — farklı framework'ler üzerine kurulu opak agent'lerin işbirliği yapmasına izin veren açık bir protokoldür. Nisan 2025'te Google tarafından piyasaya sürüldü, Haziran 2025'te Linux Vakfı'na bağışlandı ve AWS, Cisco, Microsoft, Salesforce, SAP ve ServiceNow dahil 150'den fazla destekçiyle Nisan 2026'da v1.0'ye ulaştı. IBM'in ACP'sini benimsedi ve AP2 ödeme uzantısını ekledi. Bu derste Agent Kartı, Görev yaşam döngüsü ve iki aktarım bağlaması anlatılmaktadır.

**Tür:** Yapım
**Diller:** Python (stdlib, Agent Kart + Görev donanımı)
**Önkoşullar:** Aşama 13 · 06 (MCP'nin temelleri), Aşama 13 · 08 (MCP istemcisi)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- agent'den takıma (MCP) kullanım örneklerini agent'den agent'ye (A2A) kullanım örneklerinden ayırın.
- `/.well-known/agent.json` adresinde beceriler ve uç nokta meta verileri içeren bir Agent Kartı yayınlayın.
- Görev yaşam döngüsünü yürütün (gönderildi → çalışıyor → giriş gerekli → tamamlandı / başarısız oldu / iptal edildi / reddedildi).
- Parçalar (metin, dosya, veri) ve Artifact'leri içeren Mesajları çıktı olarak kullanın.

## Sorun

Bir müşteri hizmeti agent'nin rapor yazma görevini uzman bir yazar agent'ye devretmesi gerekir. A2A öncesi seçenekler:

- Özel REST API'si. Çalışıyor ancak her eşleştirme tek seferliktir.
- Paylaşılan kod tabanı. Aynı framework'yi çalıştırmak için iki agent gerekir.
-MCP. Uymuyor: MCP, araçları çağırmak içindir, her agent'nin opak dahili mantığını korurken işbirliği yapan iki agent için değil.

A2A boşluğu dolduruyor. Etkileşimi, yaşam döngüsü, mesajlar ve artifact'lerle birlikte bir agent'nin diğerine bir Görev göndermesi olarak modeller. Çağrılan agent'nin dahili durumu opak kalır; arayan kişi yalnızca görev durumu geçişlerini ve nihai çıktıları görür.

A2A, "framework'ler arasındaki agent'lerin birbirleriyle konuşmasına izin ver" protokolüdür. MCP'nin yerini almaz; ikisi tamamlayıcıdır.

## Konsept

### Agent Kart

Her A2A uyumlu agent, `/.well-known/agent.json`'de bir kart yayınlar:

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

Keşif URL tabanlıdır: kartı alın, A2A uç noktasının URL'sini öğrenin, becerileri sıralayın.

### İmzalı Agent Kartları (AP2)

AP2 uzantısı (Eylül 2025), Agent Kartlarına şifreleme imzaları ekler. Bir yayıncı kendi kartını JWT ile imzalar; Tüketiciler doğruluyor. Kimliğe bürünmeyi önler.

### Görev yaşam döngüsü

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

İstemciler `tasks/send` ile başlar. Çağrılan agent durumlar arasında geçiş yapar; istemciler SSE veya anket yoluyla durum güncellemelerine abone olurlar.

### Mesajlar ve Parçalar

Bir mesaj bir veya daha fazla Parçayı taşır:

- `text` — sade içerik.
- `file` — mimeType'lı base64 blobu.
- `data` — yazılan JSON yükü (çağrılan agent için yapılandırılmış giriş).

Örnek:

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "Summarize this paper."},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### Artifact'ler

Çıkışlar ham dizeler değil, Artifact'lerdir. Artifact, adlandırılmış, yazılan bir çıktıdır:

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifact'ler parçalar halinde yayınlanabilir. Arayan birikir.

### İki aktarım bağlaması

1. **HTTP üzerinden JSON-RPC.** `/a2a` uç noktası, istekler için POST, akış için isteğe bağlı SSE. Varsayılan bağlama.
2. **gRPC.** gRPC'nin yerel olduğu kurumsal ortamlar için.

Her iki bağlama da aynı mantıksal mesaj şeklini taşır.

### Opaklığın korunması

Temel tasarım ilkesi: agent adı verilen şeyin dahili durumu opaktır. Arayan kişi görev durumunu ve artifact'leri görür. agent adı verilen düşünce zinciri, araç çağrıları, agent alt heyeti — hepsi görünmez. Bu, araç çağrılarının şeffaf olduğu MCP'den farklıdır.

Gerekçe: A2A, rakiplerin iç bilgileri açığa vurmadan işbirliği yapmasına olanak tanır. A2A, arayan kişi agent'nin hizmeti nasıl uyguladığını öğrenmeden "bu müşteri hizmetini agent olarak adlandırabilir".

### Zaman Çizelgesi

- **2025-04-09.** Google, A2A'yı duyurdu.
- **2025-06-23.** Linux Vakfı'na bağışlanmıştır.
- **2025-08.** IBM'in ACP'sini kullanır.
- **2025-09.** AP2 uzantısı (Agent Ödemeler) gönderilir.
- **2026-04.** v1.0, 150'den fazla destekleyici kuruluşla birlikte piyasaya sürüldü.

### MCP ile İlişki

| Boyut | MCP | A2A |
|-----------|-----|-----|
| Kullanım örneği | Agent-araca | Agent'den agent'ye |
| Opaklık | Şeffaf araç çağrıları | Opak iç muhakeme |
| Tipik arayan | Agent çalışma zamanı | Başka bir agent |
| Devlet | Araç çağırma sonucu | Yaşam döngüsüne sahip görev |
| Yetkilendirme | OAuth 2.1 (Aşama 13 · 16) | JWT İmzalı Agent Kartlar (AP2) |
| Taşıma | Stdio / Akış Yapılabilir HTTP | HTTP / gRPC üzerinden JSON-RPC |

Belirli bir aracı çağırmak istediğinizde MCP'yi kullanın. Bir görevin tamamını başka bir agent'ye devretmek istediğinizde A2A'yı kullanın. Birçok üretim sistemi her ikisini de kullanır: agent, araç katmanı için MCP'yi ve işbirliği katmanı için A2A'yı kullanır.

## Kullan onu

`code/main.py`, minimal bir A2A donanımını uygular: bir araştırma agent kartını yayınlar, bir yazar agent, PDF ve metin talimatı içeren parçalar içeren bir `tasks/send` alır, çalışma → input_required → çalışma → tamamlandı yoluyla geçişler yapar ve bir artifact metnini döndürür. Tüm stdlib; mesaj şekillerine odaklanmak için bellek içi aktarım kullanır.

Neye bakmalı:

- Agent Kart JSON şekli.
- Görev kimliği ataması ve durum geçişleri.
- Karışık tipte kısımlara sahip mesajlar.
-Girdi gerektiren dal orta görev.
- Artifact tamamlandığında geri döner.

## Gönderin

Bu ders `outputs/skill-a2a-agent-spec.md`'yi üretir. Diğer agent'ler tarafından çağrılması gereken yeni bir agent verildiğinde, beceri Agent Kart JSON'unu, beceri şemasını ve uç nokta planını üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Çağrılan agent'nin açıklama istediği giriş gerektiren duraklama dahil olmak üzere tüm Görev yaşam döngüsünü izleyin.

2. İmzalı bir Agent Kartı ekleyin. Kartın standart JSON'u üzerinden HMAC ile oturum açın. Bir doğrulayıcı yazın ve mutasyona uğramış bir kartta başarısız olduğunu doğrulayın.

3. Görev akışını uygulayın: agent yazarı, SSE üzerinden üç artımlı artifact öbeği yayar ve arayan kişi bunları biriktirir.

4. Bir MCP sunucusunu saran bir A2A agent tasarlayın. Her MCP aracını bir A2A becerisiyle eşleyin. Takaslara dikkat edin; hangi şeffaflık kayboluyor?

5. A2A v1.0 duyurusunu okuyun ve Nisan 2026 itibarıyla herhangi bir framework tarafından henüz uygulanmayan bir özelliği belirleyin. (İpucu: çok duraklı görev atamasıyla ilgilidir.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| A2A | "Agent-Agent protokolü" | Opak agent işbirliği için açık protokol |
| Agent Kart | "`.well-known/agent.json`" | agent'nin becerilerini ve uç noktasını açıklayan yayınlanmış meta veriler |
| Beceri | "Çağrılabilir bir birim" | agent'nin desteklediği adlandırılmış bir işlem (MCP aracına analog) |
| Görev | "Heyet birimi" | Yaşam döngüsü ve finali olan bir iş öğesi artifact |
| Mesaj | "Görev girişi" | Parçaları Taşır (metin, dosya, veri) |
| Bölüm | "Yazılan yığın" | `text` / `file` / `data` mesajın öğesi |
| Artifact | "Görev çıktısı" | Tamamlandığında döndürülen adlandırılmış, yazılan çıktı |
| AP2 | "Agent Ödeme Protokolü" | Güven ve ödemeler için imzalı Agent Kart uzantısı |
| Opaklık | "Kara kutu işbirliği" | agent adı verilen cihazın dahili bilgileri arayan kişiden gizlendi |
| Giriş gerekli | "Görev duraklatma" | agent'nin daha fazla bilgiye ihtiyaç duyduğu yaşam döngüsü durumu |

## Daha Fazla Okuma

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — standart A2A spesifikasyonu
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — referans uygulamaları ve SDK'lar
- [Linux Foundation — A2A lansman basın bülteni](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — Haziran 2025 yönetim aktarımı
- [Google Cloud — A2A protokol yükseltmesi](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — yol haritası ve iş ortağı ivmesi
- [Google Dev — A2A 1.0 kilometre taşı](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 sürüm notları ve geriye dönük uyumluluk kılavuzu
