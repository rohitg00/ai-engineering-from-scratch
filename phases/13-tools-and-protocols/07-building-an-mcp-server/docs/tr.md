# Bir MCP Sunucusu Oluşturma — Python + TypeScript SDK'ları

> Çoğu MCP öğreticisi yalnızca stdio merhaba dünyalarını gösterir. Gerçek bir sunucu, araçları artı kaynakları ve prompt'leri kullanıma sunar, yetenek görüşmelerini yönetir, yapılandırılmış hatalar yayar ve SDK'lar genelinde aynı şekilde çalışır. Bu ders uçtan uca bir not sunucusu oluşturur: stdlib stdio aktarımı, JSON-RPC gönderimi, üç sunucu temel öğesi ve mezun olduğunuzda Python SDK'nın FastMCP'sine veya TypeScript SDK'sına düşen saf işlev stili.

**Tür:** Yapım
**Diller:** Python (stdlib, stdio MCP sunucusu)
**Önkoşullar:** Aşama 13 · 06 (MCP'nin temelleri)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list` ve `prompts/get` yöntemlerini uygulayın.
- JSON-RPC mesajlarını stdin'den okuyan ve yanıtları stdout'a yazan bir gönderme döngüsü yazın.
- JSON-RPC 2.0 spesifikasyonuna ve MCP'nin ek kodlarına göre yapılandırılmış hata yanıtları yayınlayın.
- Araç mantığını yeniden yazmadan bir stdlib uygulamasını FastMCP'ye (Python SDK) veya TypeScript SDK'ya yükseltin.

## Sorun

Uzak aktarımı (Aşama 13 · 09) veya kimlik doğrulama katmanını (Aşama 13 · 16) kullanmadan önce temiz bir yerel sunucuya ihtiyacınız vardır. Yerel, stdio anlamına gelir: sunucu, istemci tarafından bir alt süreç olarak oluşturulur, mesajlar yeni satırla ayrılmış stdin/stdout üzerinden akar.

2025-11-25 spesifikasyonu, stdio mesajlarının açık bir `\n` ayırıcıyla JSON nesneleri olarak kodlanmasını belirtir. Burada SSE yok; SSE, eski uzak moddu ve 2026'nın ortasında kaldırılıyor (Atlassian'ın Rovo MCP sunucusu 30 Haziran 2026'da, Keboola ise 1 Nisan 2026'da bu özelliği kullanımdan kaldırdı). Stdio için, satır başına bir JSON nesnesi tüm kablo formatıdır.

Bir not sunucusu iyi bir biçimdir çünkü üç sunucu temel öğesinin tümünü kullanır. Araçlar mutasyonlar yapar (`notes_create`). Kaynaklar verileri açığa çıkarır (`notes://{id}`). Prompt'ler şablonları (`review_note`) gönderir. Bu dersin şekli herhangi bir alana genellenebilir.

## Konsept

### Gönderim döngüsü

```
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

Üç kural:

- JSON-RPC zarfı olmayan hiçbir şeyi stdout'a yazdırmayın. Hata ayıklama günlükleri stderr'e gider.
- Her isteğin aynı `id`'yi taşıyan bir yanıtla eşleşmesi ZORUNLUDUR.
- Bildirimlere CEVAP VERİLMEMELİDİR.

### `initialize`'nin Uygulanması

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

Yalnızca neyi desteklediğinizi bildirin. İstemci, kapı özelliklerine ayarlanan yeteneklere güvenir.

### `tools/list` ve `tools/call`'nin uygulanması

`tools/list`, her girişin `name`, `description`, `inputSchema`'ye sahip olduğu `{tools: [...]}`'yi döndürür. `tools/call`, `{name, arguments}`'yi alır ve `{content: [blocks], isError: bool}`'yi döndürür.

İçerik blokları yazılır. En yaygın olanı:

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

Takım hataları iki şekilde ortaya çıkar. Protokol düzeyindeki hatalar (bilinmeyen yöntem, hatalı parametreler) JSON-RPC hatalarıdır. Araç düzeyindeki hatalar (geçerli çağrı ancak araç başarısız oldu) `{content: [...], isError: true}` olarak döndürülür. Bu, modelin başarısızlığı kendi bağlamında görmesini sağlar.

### Kaynakları uygulama

Kaynaklar tasarım gereği salt okunurdur. `resources/list` bir bildirim döndürür; `resources/read` içeriği döndürür. URI'ler `file://...`, `http://...` veya `notes://` gibi özel bir şema olabilir.

Verileri bir araç yerine kaynak olarak kullanıma sunduğunuzda:

- Model onu "çağırmaz"; istemci, kullanıcının isteği üzerine bunu içeriğe enjekte edebilir.
- Abonelikler, kaynak değiştiğinde sunucunun güncellemeleri göndermesine olanak tanır (Aşama 13 · 10).
- Aşama 13 · 14, etkileşimli kaynaklara yönelik `ui://` ile bunu genişletiyor.

### prompt'leri Uygulama

Prompt'ler adlandırılmış bağımsız değişkenlere sahip şablonlardır. Ana bilgisayar bunları eğik çizgi komutları olarak ortaya çıkarır. Bir `review_note` prompt, bir `note_id` bağımsız değişkenini alabilir ve istemcinin modeline beslediği çoklu mesaj prompt şablonunu üretebilir.

### Stdio aktarım incelikleri

- Yeni satırla ayrılmış JSON. Uzunluk ön ekli çerçeveleme yok.
- Tamponlamayın. Her yazmadan sonra `sys.stdout.flush()`.
- Müşteri ömrünü kontrol eder. Stdin kapandığında (EOF), temiz bir şekilde çıkın.
- SIGPIPE'i sessizce tutmayın; oturum açın ve çıkın.

### Ek Açıklamalar

Her alet, güvenlik özelliklerini açıklayan `annotations` taşıyabilir:

- `readOnlyHint: true` — saf okuma, tekrar denemesi güvenli.
- `destructiveHint: true` — geri dönüşü olmayan yan etkiler; müşteri onaylamalıdır.
- `idempotentHint: true` — aynı girişler aynı çıktıları üretir.
- `openWorldHint: true` — harici sistemlerle etkileşime girer.

İstemci bunları UX'e (onay diyalogları, durum göstergeleri) ve yönlendirmeye (Aşama 13 · 17) karar vermek için kullanır.

### Mezuniyet yolu

`code/main.py`'deki stdlib sunucusu yaklaşık 180 satırdır. FastMCP (Python) aynı mantığı dekoratör stiline daraltır:

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK'nın eşdeğer bir şekli vardır. Hazır olduğunuzda mezuniyet yolu açılır; kavramlar (yetenekler, dağıtım, içerik blokları) aynıdır.

## Kullan onu

`code/main.py`, yalnızca stdio ve stdlib üzerinden eksiksiz bir not MCP sunucusudur. Üç araç için `initialize`, `tools/list`, `tools/call`'yi (`notes_list`, `notes_search`, `notes_create`), her nota için `resources/list` ve `resources/read`'yi ve bir `review_note` prompt'yi yönetir. JSON-RPC mesajlarını ileterek bunu sürdürebilirsiniz:

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

Neye bakmalı:

- Dağıtıcı, yöntem adına göre anahtarlanan bir `dict[str, Callable]`'dir.
- Her araç yürütücüsü, çıplak bir dize değil, içerik bloklarının bir listesini döndürür.
- Uygulayıcı yükseldiğinde `isError: true` ayarlanır.

## Gönderin

Bu ders `outputs/skill-mcp-server-scaffolder.md`'yi üretir. Bir etki alanı (notlar, biletler, dosyalar, veritabanı) verildiğinde, beceri, doğru araçlara / kaynaklara / prompt bölünmesine ve SDK mezuniyet yoluna sahip bir MCP sunucusunu iskele haline getirir.

## Egzersizler

1. `code/main.py`'yi çalıştırın ve elle oluşturulmuş JSON-RPC mesajlarıyla çalıştırın. Yeni notu almak için `notes_create` ve ardından `resources/read` egzersizini yapın.

2. `annotations: {destructiveHint: true}` ile bir `notes_delete` aracı ekleyin. İstemcinin bir onay iletişim kutusu açacağını doğrulayın (bu, gerçek bir ana bilgisayar gerektirir; Claude Masaüstü çalışır).

3. `resources/subscribe`'yi uygulayın, böylece sunucu bir not değiştirildiğinde `notifications/resources/updated`'yi iter. Bir canlı tutma görevi ekleyin.

4. Sunucuyu FastMCP'ye bağlayın. Python dosyası 80 satırın altına küçültülmelidir. Kablo davranışı aynı olmalıdır; aynı JSON-RPC test donanımıyla doğrulayın.

5. Spesifikasyonun `server/tools` bölümünü okuyun ve bu dersin sunucusunda uygulanmayan bir araç tanımının bir alanını tanımlayın. (İpucu: Birkaç tane var; birini seçin ve ekleyin.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MCP sunucusu | "Aletleri açığa çıkaran şey" | Stdio veya HTTP üzerinden MCP JSON-RPC'yi konuşan işlem |
| stdyo taşımacılığı | "Alt süreç modeli" | Sunucu istemci tarafından oluşturulur; stdin/stdout aracılığıyla iletişim kurar |
| Sevk Görevlisi | "Yöntem yönlendirici" | JSON-RPC yöntem adının işleyici işlevine eşlenmesi |
| İçerik bloğu | "Araç sonucu öbeği" | Bir araç yanıtının `content` dizisinde yazılan öğe |
| `isError` | "Araç düzeyinde hata" | Aracın başarısız olduğuna dair sinyaller; JSON-RPC hatasından ayırt edilir |
| Ek Açıklamalar | "Güvenlik ipuçları" | salt okunur / yıkıcı / idempotent / openWorld bayrakları |
| FastMCP | "Python SDK'sı" | Dekoratör tabanlı üst düzey framework, MCP protokolünün üstünde |
| Kaynak URI'sı | "Adreslenebilir veriler" | `file://`, `db://` veya bir kaynağı tanımlayan özel şema |
| Prompt şablonu | "Eğik çizgi komut özeti" | Ana bilgisayar kullanıcı arayüzleri için bağımsız değişken yuvalarına sahip, sunucu tarafından sağlanan şablon |
| Yetenek beyanı | "Özellik geçişi" | `initialize`'de bildirilen ilkel başına bayraklar |

## Daha Fazla Okuma

- [Model Bağlam Protokolü — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — referans Python uygulaması
- [Model Bağlam Protokolü — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — paralel TS uygulaması
- [FastMCP — sunucu framework](https://gofastmcp.com/) — MCP sunucuları için dekoratör tarzı Python API'si
- [MCP — Hızlı başlangıç sunucusu kılavuzu](https://modelcontextprotocol.io/quickstart/server) — SDK'lardan herhangi birini kullanan uçtan uca eğitim
- [MCP — Sunucu araçları özellikleri](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — araçlar/* mesajları için tam referans
