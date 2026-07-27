# MCP Uygulamaları — `ui://` aracılığıyla Etkileşimli Kullanıcı Arayüzü Kaynakları

> Salt metin aracı çıktısı, agent'lerin gösterebileceği sınırları belirler. MCP Uygulamaları (SEP-1724, resmi 26 Ocak 2026), bir aracın Claude Desktop, ChatGPT, Cursor, Goose ve VS Code'da satır içi olarak oluşturulmuş korumalı alanda etkileşimli HTML döndürmesine olanak tanır. Kontrol panelleri, formlar, haritalar, 3D sahneler, hepsi tek bir uzantıda. Bu derste `ui://` kaynak şeması, `text/html;profile=mcp-app` MIME, iframe-sandbox postMessage protokolü ve bir sunucunun HTML oluşturmasına izin veren güvenlik yüzeyi anlatılmaktadır.

**Tür:** Yapım
**Diller:** Python (stdlib, kullanıcı arayüzü kaynak yayıcı), HTML (örnek uygulama)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu), Aşama 13 · 10 (kaynaklar)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Bir araç çağrısından bir `ui://` kaynağı döndürün ve doğru MIME ve meta verileri ayarlayın.
- Bir aracın ilişkili kullanıcı arayüzünü `_meta.ui.resourceUri`, `_meta.ui.csp` ve `_meta.ui.permissions` ile bildirin.
- Kullanıcı arayüzünden ana makineye iletişim için iframe korumalı alan postMessage JSON-RPC'yi uygulayın.
- Kullanıcı arayüzü kaynaklı saldırılara karşı koruma sağlayan CSP ve izin politikası varsayılanlarını uygulayın.

## Sorun

2025 dönemine ait bir `visualize_timeline` aracı şu sonucu verebilir: "İşte kronolojik olarak düzenlenmiş 14 not: ...". Bu bir paragraf. Kullanıcılar aslında etkileşimli zaman çizelgesini istiyor. MCP Uygulamalarından önce seçenekler şunlardı: istemciye özel widget API'leri (Claude artifact'ler, OpenAI Özel GPT HTML) veya hiçbir kullanıcı arayüzü olmaması.

MCP Uygulamaları (SEP-1724, 26 Ocak 2026'da gönderildi) sözleşmeyi standartlaştırıyor. Bir araç sonucu, URI'si `ui://...` ve MIME'si `text/html;profile=mcp-app` olan bir `resource` içerir. Ana bilgisayar, bunu sınırlı bir CSP'ye sahip ve açıkça izin verilmediği sürece ağ erişimi olmayan korumalı alanlı bir iframe'de işler. İframe'in içindeki kullanıcı arayüzü, mesajları küçük bir postMessage JSON-RPC lehçesi aracılığıyla ana bilgisayara gönderir.

Her uyumlu istemci (Claude Desktop, ChatGPT, Goose, VS Code) aynı `ui://` kaynağını aynı şekilde işler. Bir sunucu, bir HTML paketi, evrensel kullanıcı arayüzü.

## Konsept

### `ui://` kaynak şeması

Bir araç şunu döndürür:

```json
{
  "content": [
    {"type": "text", "text": "Here is your notes timeline:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

Toplantı sahibi daha sonra `ui://notes/timeline` URI'sinde `resources/read`'yi çağırır ve geri döner:

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe korumalı alanı

Ana bilgisayar, HTML'yi korumalı alana alınmış bir `<iframe>` içinde şunu kullanarak işler:

- `sandbox="allow-scripts allow-same-origin"` (veya sunucu bildirimine göre daha katı)
- Yanıt başlıkları aracılığıyla uygulanan sunucu tarafından bildirilen CSP.
- Çerez yok, ana bilgisayarın kaynağından localStorage yok.
- Ağ erişimi CSP'de `connectSrc` ile sınırlıdır.

### mesaj sonrası protokolü

iframe, ana bilgisayarla `window.postMessage` aracılığıyla iletişim kurar. Küçük bir JSON-RPC 2.0 lehçesi:

`targetOrigin`'yi her zaman eşin tam kaynağına sabitleyin ve alıcı tarafta, herhangi bir yükü işlemeden önce `event.origin`'yi izin verilenler listesine göre doğrulayın. Bu kanalın her iki tarafı için de asla `"*"` kullanmayın; gövde, araç çağrılarını ve kaynak okumalarını taşır.

```js
// iframe to host  (pin to host origin)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host to iframe  (pin to iframe origin)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receiver on both sides
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // safe to process event.data
});
```

Kullanıcı arayüzünün çağırabileceği mevcut ana bilgisayar tarafı yöntemleri:

- `host.callTool(name, arguments)` — bir sunucu aracını çağırır.
- `host.readResource(uri)` — bir MCP kaynağını okur.
- `host.getPrompt(name, arguments)` — bir prompt şablonu getirir.
- `host.close()` — kullanıcı arayüzünü kapatır.

Her çağrı yine de MCP protokolünden geçer ve sunucunun izinlerini devralır.

### İzinler

`_meta.ui.permissions` listesi ekstra yetenekler ister:

- `camera` — kullanıcının kamerasına erişin (bir belge tarama kullanıcı arayüzleri için kullanılır).
- `microphone` — ses girişi.
- `geolocation` — konum.
- `network:*` — `connectSrc`'nin tek başına izin verdiğinden daha geniş ağ erişimi.

Her izin, kullanıcının kullanıcı arayüzü oluşturulmadan önce gördüğü bir prompt'dir.

### Güvenlik riskleri

Bir iframe'deki HTML hala HTML'dir. Yeni saldırı yüzeyi:

- **Prompt-kullanıcı arayüzü aracılığıyla enjeksiyon.** Kötü amaçlı bir sunucu kullanıcı arayüzü, sistem mesajına benzeyen bir metin gösterebilir ve kullanıcıyı kandırabilir. Ana bilgisayar oluşturma, sunucu kullanıcı arayüzünü ana bilgisayar kullanıcı arayüzünden gözle görülür şekilde ayırt etmelidir.
- **`connectSrc` aracılığıyla filtreleme.** CSP, `connect-src: *`'ye izin veriyorsa, kullanıcı arayüzü her yere veri gönderebilir. Varsayılan katı olmalıdır.
- **Tıklama hırsızlığı.** Kullanıcı arayüzü ana bilgisayar kromunu kaplar. Ana bilgisayarlar, z-endeksi manipülasyonunu önlemeli ve opaklık kurallarını uygulamalıdır.
- **Odak çalma.** Kullanıcı arayüzü klavye odağını alır ve bir sonraki mesajı yakalar. Ev sahiplerinin araya girmesi gerekiyor.

Aşama 13 · 15, MCP güvenliğinin bir parçası olarak bunları derinlemesine kapsar; bu ders onları tanıtır.

### `ui/initialize` el sıkışma

iframe yüklendikten sonra postMessage üzerinden `ui/initialize` gönderir:

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

Ana bilgisayar, yetenekler ve bir oturum token ile yanıt verir. Kullanıcı arayüzü, sonraki her ana bilgisayar çağrısında token oturumunu kullanır.

### AppRenderer / AppFrame SDK temel öğeleri

Ext-apps SDK'sı iki kolaylık ilkesini ortaya çıkarır:

- `AppRenderer` (sunucu tarafı) — bir React / Vue / Solid bileşenini sarar ve doğru MIME ve meta verilere sahip bir `ui://` kaynağı yayar.
- `AppFrame` (istemci tarafı) — kaynağı alır, iframe'i bağlar ve postMessage'a aracılık eder.

Bunları kullanabilir veya HTML ve JSON-RPC'yi elle yuvarlayabilirsiniz.

### Ekosistem durumu

MCP Uygulamaları 26 Ocak 2026'da gönderildi. Nisan 2026 itibarıyla istemci desteği:

- **Claude Masaüstü.** Ocak 2026'dan beri tam destek.
- **ChatGPT.** Apps SDK (aynı temel MCP Apps protokolü) aracılığıyla tam destek.
- **İmleç.** Beta; ayarlar aracılığıyla etkinleştirin.
- **VS Kodu.** Yalnızca Insider derlemeleri.
- **Kaz.** Tam destek.
- **Zed, Rüzgar Sörfü.** Yol haritası oluşturuldu.

Üretimdeki sunucular: gösterge tabloları, harita görselleştirmeleri, veri tabloları, grafik oluşturucular, korumalı alan IDE önizlemeleri.

## Kullan onu

`code/main.py`, not sunucusunu, bir `ui://notes/timeline` kaynağı döndüren bir `visualize_timeline` aracıyla ve ayrıca bu URI üzerinde SVG zaman çizelgesine sahip küçük ama eksiksiz bir HTML paketi döndüren `resources/read` için bir işleyiciyle genişletir. HTML stdlib şablonludur; derleme sistemi yoktur. stdlib bir tarayıcıyı çalıştıramadığı için postMessage JS yorumlarında çizilmiştir.

Neye bakmalı:

- Araç yanıtındaki `_meta.ui`, ResourcesUri, CSP ve izinleri taşır.
- HTML, ağ erişimi olmadan işlenir; tüm veriler satır içidir.
- JS, `window.parent.postMessage` aracılığıyla `host.callTool`'yi çağırır (belgelenmiştir ancak bu stdlib demosunda etkisizdir).

## Gönderin

Bu ders `outputs/skill-mcp-apps-spec.md`'yi üretir. Etkileşimli bir kullanıcı arayüzünden yararlanacak bir araç verildiğinde, beceri tam MCP Uygulama sözleşmesi üretir: `ui://` URI, CSP, izinler, Mesaj sonrası giriş noktaları ve bir güvenlik kontrol listesi.

## Egzersizler

1. `code/main.py`'yi çalıştırın ve yayılan HTML'yi inceleyin. HTML'yi doğrudan bir tarayıcıda açın; SVG görüntülerini doğrulayın. Ardından kullanıcı arayüzünün `host.callTool("notes_update", ...)`'yi çağırmak için kullanacağı postMessage sözleşmesini çizin.

2. CSP'yi sıkın: `'unsafe-inline'`'yi kaldırın ve tabanlı olmayan bir komut dosyası ilkesi kullanın. HTML oluşturma kodunda ne gibi değişiklikler olur?

3. Bir notu yerinde düzenlemek için bir form içeren ikinci bir kullanıcı arayüzü kaynağı `ui://notes/editor` ekleyin. Kullanıcı gönderdiğinde iframe `host.callTool("notes_update", ...)`'yi çağırır.

4. Kullanıcı arayüzünün saldırı yüzeyini denetleyin. Kötü amaçlı bir sunucu içeriği nereye enjekte edebilir? iframe korumalı alanı neye karşı koruma sağlar ve neye karşı koruma sağlamaz?

5. SEP-1724 spesifikasyonunu okuyun ve MCP Apps SDK'sında bu oyuncak uygulamasının kullanmadığı bir özelliği belirleyin. (İpucu: bileşen düzeyinde durum senkronizasyonu.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MCP Uygulamaları | "Etkileşimli kullanıcı arayüzü kaynakları" | SEP-1724 uzantısı gönderildi 2026-01-26 |
| `ui://` | "Uygulama URI şeması" | Kullanıcı arayüzü paketleri için kaynak şeması |
| `text/html;profile=mcp-app` | "MIME" | MCP Uygulaması HTML'si için içerik türü |
| Iframe korumalı alanı | "Kapsayıcıyı oluştur" | Kullanıcı arayüzünün tarayıcıda CSP ve izinlerle korumalı alana alınması |
| mesaj gönder JSON-RPC | "Kullanıcı arayüzünden ana bilgisayara kablo" | Ana bilgisayar çağrıları için küçük JSON-RPC-over-postMessage lehçesi |
| `_meta.ui` | "Araç-UI bağlama" | Bir araç sonucunu bir kullanıcı arayüzü kaynağına bağlayan meta veriler |
| CSP | "İçerik-Güvenlik-Politikası" | Komut dosyaları, ağ ve stiller için izin verilen kaynakları bildirir |
| Uygulama Oluşturucu | "Sunucu SDK'sı ilkel" | framework bileşenini `ui://` kaynağına dönüştürür |
| Uygulama Çerçevesi | "İstemci SDK'sı ilkel" | postMessage'a aracılık eden Iframe bağlama yardımcısı |
| `ui/initialize` | "El Sıkışma" | İlk gönderiKullanıcı arayüzünden ana bilgisayara mesaj |

## Daha Fazla Okuma

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — referans uygulaması ve SDK
- [MCP Uygulama spesifikasyonu 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — resmi spesifikasyon belgesi
- [MCP — Uygulama uzantısına genel bakış](https://modelcontextprotocol.io/extensions/apps/overview) — üst düzey belgeler
- [MCP blogu — MCP Uygulamalarının lansmanı](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — Ocak 2026 lansman gönderisi
- [MCP Apps API referansı](https://apps.extensions.modelcontextprotocol.io/api/) — JSDoc tarzı SDK referansı
