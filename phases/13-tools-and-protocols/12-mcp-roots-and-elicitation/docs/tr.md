# Kökler ve Ortaya Çıkarma — Kapsam Belirleme ve Geçiş Ortası Kullanıcı Girişi

> Sabit kodlanmış yollar, kullanıcı farklı bir proje açtığı anda kesilir. Kullanıcı gereğinden az belirttiğinde, önceden doldurulmuş araç bağımsız değişkenleri bozulur. Kökler, sunucunun kapsamını kullanıcı tarafından kontrol edilen bir URI kümesine göre belirler; ortaya çıkarma, kullanıcıdan bir form veya URL yoluyla yapılandırılmış girdi istemek için araç çağrısını duraklatır. İki istemci temel öğesi, yaygın MCP arıza modları için iki düzeltme. SEP-1036 (URL modu ortaya çıkarma, 2025-11-25) H1 2026'ya kadar deneyseldir; buna bağlı kalmadan önce SDK sürümlerini kontrol edin.

**Tür:** Yapım
**Diller:** Python (stdlib, kökler + ortaya çıkarma demosu)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- `roots`'yi bildirin ve `notifications/roots/list_changed`'ye yanıt verin.
- Sunucu dosyası işlemlerini, bildirilen kök kümesi içindeki URI'lerle sınırlayın.
- Araç çağrısının ortasında kullanıcıdan onay veya yapılandırılmış giriş istemek için `elicitation/create` kullanın.
- Form modu ve URL modu ortaya çıkarma arasında seçim yapın (ikincisi deneyseldir; sürüklenme riski not edilmiştir).

## Sorun

Bir MCP sunucusunun üretim sırasında karşılaştığı iki somut arıza.

**Bozuk yol varsayımı.** Sunucu, `~/notes`'ye göre yazılmıştır. `~/Documents/Notes` dosyasında notları olan farklı bir makinedeki kullanıcı, sessizce başarısız olan (dosya bulunamadı) veya daha kötüsü yanlış yere yazan bir araç çağrısı alıyor.

**Kullanıcının bileceği argüman eksik.** Kullanıcı "eski TPS rapor notunu sil" diye sorar. Model `notes_delete(title: "TPS report")` adını veriyor ancak 2023, 2024 ve 2025'e ait eşleşen üç not var. Araç tahmin edemez. "Belirsiz" konusunda başarısız olmak can sıkıcıdır; üçü birden koşmak felakettir.

Kökler ilkini düzeltir: istemci, `initialize`'de sunucunun dokunabileceği URI kümesini bildirir. Ortaya çıkarma ikinci sorunu düzeltir: sunucu araç çağrısını duraklatır ve `elicitation/create` göndererek kullanıcının hangisini seçmesini ister.

## Konsept

### Kökler

İstemci `initialize` adresinde bir kök listesi bildirir:

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

Sunucu daha sonra `roots/list`'yi arayabilir:

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

Sunucular kökleri sınır olarak ele almalıdır ZORUNLU: kök kümesinin dışında okunan veya yazılan tüm dosyalar reddedilir. Bu, istemci tarafından zorunlu kılınmaz (sunucu hâlâ kullanıcının güvendiği koddur), ancak spesifikasyonlarla uyumlu sunucular buna saygı gösterir.

Kullanıcı bir kökü eklediğinde veya kaldırdığında istemci `notifications/roots/list_changed` gönderir. Sunucu `roots/list`'yi yeniden çağırır ve sınırını günceller.

### Kökler neden istemci ilkelidir?

Kökler, kullanıcının izin modelini temsil ettikleri için istemci tarafından bildirilir. Kullanıcı Claude Desktop'a "bu not sunucusunun bu iki dizine erişmesine izin ver" dedi. Sunucu bu kapsamı genişletemez.

### Ortaya Çıkarma: form modu varsayılanı

`elicitation/create` bir form şemasına ek olarak doğal dil prompt'yi alır:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Delete 'TPS report'? Multiple notes match; pick one.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "note_id": {
          "type": "string",
          "enum": ["note-3", "note-7", "note-14"]
        },
        "confirm": {"type": "boolean"}
      },
      "required": ["note_id", "confirm"]
    }
  }
}
```

Müşteri bir form oluşturur, kullanıcının yanıtını toplar ve şunu döndürür:

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

Üç olası eylem: `accept` (kullanıcı doldurdu), `decline` (kullanıcı kapattı), `cancel` (kullanıcı tüm araç çağrısını iptal etti).

Form şemaları düzdür; iç içe nesneler v1'de desteklenmez. SDK'lar genellikle tek bir katmandan daha karmaşık olan her şeyi reddeder.

### Ortaya çıkarma: URL modu (SEP-1036, deneysel)

2025-11-25'te yeni. Sunucu, şema yerine bir URL gönderir:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Sign in to GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

İstemci URL'yi bir tarayıcıda açar, tamamlanmasını bekler, kullanıcı geri döndüğünde geri döner. OAuth akışları, ödeme yetkilendirmesi ve formun yetersiz olduğu durumlarda belge imzalama için kullanışlıdır.

Sürüklenme riski notu: SEP-1036 yanıt şekli hâlâ yerleşmektedir; bazı SDK'lar geri arama URL'sini döndürür, diğerleri ise token tamamlamasını döndürür. Üretimde URL modunu kullanmadan önce SDK'nızın sürüm notlarını okuyun.

### Ortaya çıkarma doğru araç olduğunda

- Yıkıcı eylemlerden önce kullanıcı onayı (yıkıcı ipucu + ortaya çıkarma).
- Belirsizliği giderme (N eşleşmeden birini seçin).
- İlk çalıştırma kurulumu (API anahtarları, dizinler, tercihler).
- OAuth tarzı akışlar (URL modu).

### Ortaya çıkarma yanlış olduğunda

- Modelin düzyazıda isteyebileceği bir aracın gerekli argümanlarının doldurulması. Ortaya çıkarma iletişim kutusu değil, normal bir re-prompt kullanın.
- Yüksek frekanslı aramalar. Ortaya çıkarma konuşmayı kesintiye uğratır; bir döngü içinde ateşlemeyin.
- Sunucunun olaydan sonra doğrulayabileceği herhangi bir şey. Doğrulayın, bir hata döndürün, modelin kullanıcıya metin olarak sormasına izin verin.

### Döngüdeki insan köprüsü

Ortaya çıkarma ve örnekleme birlikte MCP'nin "döngüdeki insan" modelini mümkün kılar. Bir sunucunun agent loop'si, kullanıcı girişi (ortaya çıkarma) veya model muhakemesi (örnekleme) için duraklatabilir. Aşama 13 · 11 kapsamındaki numune alma; Bu ders ortaya çıkarmayı kapsar. Tam döngü ortası kontrolü için bunları bir araya getirin.

## Kullan onu

`code/main.py` not sunucusunu aşağıdakilerle genişletir:

- Kök listede değişiklik yapılan bildirimlerden sonra sunucunun yeniden sorguladığı `roots/list` yanıtı.
- Birden fazla not eşleştiğinde belirsizliği ortadan kaldırmak için `elicitation/create` kullanan bir `notes_delete` aracı.
- İlk çalıştırma yapılandırma sayfasını (simüle edilmiş) açmak için URL modu ortaya çıkarmayı kullanan bir `notes_setup` aracı.
- Bildirilen köklerin dışındaki URI'ler üzerindeki işlemleri reddeden bir sınır kontrolü.

Demo üç senaryo çalıştırıyor: mutlu yol (bir eşleşme), belirsizliğin giderilmesi (üç eşleşme, ortaya çıkarma yangınları), kök dışı yazma (reddedildi).

## Gönderin

Bu ders `outputs/skill-elicitation-form-designer.md`'yi üretir. Kullanıcı onayı veya belirsizliğin giderilmesi gerekebilecek bir araç verildiğinde, beceri, ortaya çıkarma formu şemasını ve mesaj şablonunu tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Belirsizliği giderme yolunu tetikleyin; simüle edilmiş kullanıcı yanıtının araca geri yönlendirildiğini onaylayın.

2. Her seferinde ortaya çıkarma onayı gerektiren (yıkıcı ipucu) yeni bir araç `notes_archive` ekleyin. UX'i kontrol edin: Bu, metinde yeniden soran modelle nasıl karşılaştırılır?

3. İlk çalıştırma OAuth akışı için URL modu ortaya çıkarmayı uygulayın. Sürüklenme riskine dikkat edin ve bir SDK sürümü koruması ekleyin.

4. `roots/list` işlemeyi genişletin: bir bildirim geldiğinde, sunucunun artık kapsam dışında olabilecek açık dosya tanıtıcılarını atomik olarak yeniden okuması ve yeniden taraması gerekir.

5. GitHub'daki SEP-1036 sayısı tartışma başlığını okuyun. Sunucuların URL modu geri aramalarını nasıl ele alması gerektiğini etkileyen açık bir soru belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kök | "Onay sınırı" | istemcinin sunucunun dokunmasına izin verdiği URI |
| `roots/list` | "Sunucu kapsam istiyor" | İstemci geçerli kök kümesini döndürür |
| `notifications/roots/list_changed` | "Kullanıcı kapsamı değiştirdi" | İstemci, kök kümesinin mutasyona uğradığını bildiriyor |
| Ortaya Çıkarma | "Kullanıcıya görüşme sırasında sor" | Yapılandırılmış kullanıcı girişi için sunucu tarafından başlatılan istek |
| `elicitation/create` | "Yöntem" | Ortaya çıkarma istekleri için JSON-RPC yöntemi |
| Form modu | "Şema odaklı form" | İstemci arayüzünde form olarak işlenen Düz JSON Şeması |
| URL modu | "Tarayıcı yönlendirmesi" | SEP-1036 deneysel; bir URL açar ve bekler |
| `accept` / `decline` / `cancel` | "Kullanıcı yanıtı sonuçları" | Sunucunun yönettiği üç dal |
| Disambiguation | "Birini seç" | Bir aracın N adayı olduğunda yaygın ortaya çıkarma kullanım durumu |
| Düz form | "Yalnızca üst düzey mülkler" | Ortaya çıkarma şemaları iç içe olamaz |

## Daha Fazla Okuma

- [MCP — İstemci kök spesifikasyonu](https://modelcontextprotocol.io/specification/draft/client/roots) — kurallı kök referansı
- [MCP — İstemci ortaya çıkarma spesifikasyonu](https://modelcontextprotocol.io/specification/draft/client/elicitation) — kanonik ortaya çıkarma referansı
- [Cisco — MCP ortaya çıkarma, yapılandırılmış içerik, OAuth geliştirmelerindeki yenilikler](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) — 2025/11/25 eklemelere ilişkin ayrıntılı açıklama
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) — URL modu ortaya çıkarma teklifi (deneysel, sürüklenme riski)
- [Yeni Yığın — Ortaya çıkarma, döngüdeki insanı yapay zeka araçlarına nasıl getiriyor](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) — UX izlenecek yol
