# Eşzamansız Görevler (SEP-1686) — Uzun Süreli Çalışmalar için Şimdi Ara, Daha Sonra Getir

> Gerçek agent çalışması dakikalar ila saatler sürer: CI çalıştırmaları, derin araştırma sentezi, toplu dışa aktarımlar. Eşzamanlı araç, bağlantıları kesmeyi, zaman aşımına uğramayı veya kullanıcı arayüzünü engellemeyi çağırır. 2025-11-25'te birleştirilen SEP-1686, bir Görevler temel öğesi ekler: herhangi bir istek, bir görev haline getirilecek şekilde genişletilebilir ve sonuç daha sonra getirilebilir veya durum bildirimleri yoluyla yayınlanabilir. Sürüklenme riski notu: Görevler 2026 yılının ilk yarısına kadar deneyseldir; SDK yüzeyi hala spesifikasyona göre tasarlanmaktadır.

**Tür:** Yapım
**Diller:** Python (stdlib, eşzamansız görev durumu makinesi)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu), Aşama 13 · 09 (aktarımlar)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Bir aracın ne zaman eşzamanlı durumdan görevle zenginleştirilmiş duruma yükseltileceğini belirleyin (>30 saniyelik sunucu tarafı çalışması).
- Görev yaşam döngüsünü yürütün: `working` → `input_required` → `completed` / `failed` / `cancelled`.
- Çökmelerin uçuş sırasındaki işleri kaybetmemesi için görev durumunu sürdürün.
- `tasks/status`'yi yoklayın ve `tasks/result`'yi doğru şekilde getirin.

## Sorun

Bir `generate_report` aracı, çok dakikalık bir çıkarma hattını çalıştırır. Senkron model altındaki seçenekler:

1. Bağlantıyı üç dakika açık tutun. Uzaktan taşımalar bunu bırakıyor; istemciler zaman aşımına uğrar; Kullanıcı arayüzleri donuyor.
2. Bir yer tutucuyla hemen geri dönün; istemcinin özel bir uç noktayı yoklamasını gerektirir. MCP tekdüzeliğini bozar.
3. Ateşle ve unut; sonuç yok.

Hiçbiri iyi değil. SEP-1686 dördüncüyü ekliyor: görev genişletme. Herhangi bir istek (genellikle `tools/call`) görev olarak etiketlenebilir. Sunucu hemen bir görev kimliği döndürür. İstemci `tasks/status`'yi yoklar ve tamamlandığında `tasks/result`'yi getirir. Sunucu tarafı durumu yeniden başlatmalardan sonra hayatta kalır.

## Konsept

### Görev genişletme

Bir istek, `params._meta.task.required: true` (veya `optional: true`, sunucu karar verir) ayarlandığında bir göreve dönüşür. Sunucu hemen şu şekilde yanıt verir:

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "_meta": {
      "task": {
        "id": "tsk_9f7b...",
        "state": "working",
        "ttl": 900000
      }
    }
  }
}
```

`ttl`, sunucunun durumu koruma sözüdür; ttl'den sonra görev sonucu atılır.

### Araç başına katılım

Araç ek açıklamaları görev desteğini bildirebilir:

- `taskSupport: "forbidden"` — bu araç her zaman eşzamanlı olarak çalışır. Hızlı araçlar için güvenlidir.
- `taskSupport: "optional"` — istemci görev genişletme talebinde bulunabilir.
- `taskSupport: "required"` — istemcinin görev genişletmeyi kullanması ZORUNLUDUR.

Bir `generate_report` aracı `required` olacaktır. Bir `notes_search` aracı `forbidden` olacaktır.

### Eyaletler

```
working  -> input_required -> working  (loop via elicitation)
working  -> completed
working  -> failed
working  -> cancelled
```

Durum makinesi yalnızca ekleme amaçlıdır: `completed`, `failed` veya `cancelled` olduğunda görev terminaldir.

### Yöntemler

- `tasks/status {taskId}` — mevcut durumu ve ilerleme ipucunu döndürür.
- `tasks/result {taskId}` — henüz yapılmadıysa 404'ü engeller veya döndürür.
- `tasks/cancel {taskId}` — değişmez; terminal durumları yoksayılır.
- `tasks/list` — isteğe bağlı; etkin ve yakın zamanda tamamlanan görevleri sıralar.

### Akış durumu değişiklikleri

Sunucu bunu desteklediğinde istemci durum bildirimlerine abone olabilir:

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

Anket yerine yayın yapan istemciler daha iyi bir kullanıcı deneyimi elde eder. Yoklama her zaman minimum yüzey olarak desteklenir.

### Dayanıklı durum

Spesifikasyon, durumun devam etmesi için görev desteğini bildiren sunucuları gerektirir. Bir kilitlenme ttl içinde tamamlanmış sonuçları kaybetmemelidir. Mağazalar SQLite'tan Redis'e ve dosya sistemine kadar değişir. Ders 13 donanımı dosya sistemini kullanır.

### İptal anlambilimi

`tasks/cancel` önemsizdir. Görev yürütmenin ortasındaysa, sunucu durmaya çalışır (yürütücü-işbirlikçi iptalini kontrol edin). Zaten terminal ise istek işlem dışıdır.

### Kilitlenme kurtarma

Sunucu işlemi yeniden başlatıldığında:

1. Tüm kalıcı görev durumlarını yükleyin.
2. İşlemi sona eren tüm `working` görevlerini `failed` olarak `CRASH_RECOVERY` hatasıyla işaretleyin.
3. `completed` / `failed` / `cancelled`'yi ttl'leri için koruyun.

### Eşzamansız görevler artı örnekleme

Bir görevin kendisi `sampling/createMessage`'yi çağırabilir. Uzun süredir devam eden araştırma görevleri bu şekilde çalışır: sunucunun görev iş parçacığı, müşterinin modelini gerektiği gibi örneklerken, müşterinin kullanıcı arayüzü, görevi periyodik ilerleme güncellemeleriyle `working` olarak gösterir.

### Bu neden deneysel

SEP-1686, 2025-11-25'te gönderildi ancak daha geniş yol haritası üç açık sorunu ortaya koyuyor: dayanıklı abonelik temelleri, alt görevler (ebeveyn-çocuk görev ilişkileri) ve sonuç-TTL standardizasyonu. Spesifikasyonun 2026'ya kadar gelişmesini bekleyin. Üretim kodu, Görevleri yalnızca genel durum için kararlı olarak değerlendirmeli ve alt görevler için gelecekteki SDK değişikliklerine karşı koruma sağlamalıdır.

## Kullan onu

`code/main.py`, dayanıklı bir görev deposu (dosya sistemi destekli) ve arka plan iş parçacığında çalışan bir `generate_report` aracı uygular. İstemciler aracı çağırır, hemen bir görev kimliği alır, çalışan ilerlemeyi güncellerken `tasks/status`'yi yoklar ve bittiğinde `tasks/result`'yi getirir. İptal işlemleri; Kilitlenme kurtarma, çalışan iş parçacığının öldürülmesi ve durumun yeniden yüklenmesi yoluyla simüle edilir.

Neye bakmalı:

- JSON görev durumu `/tmp/lesson-13-tasks/<id>.json` olarak devam etti.
- Çalışan iş parçacığı `progress` alanını günceller; anket ilerleme kaydettiğini gösteriyor.
- Müşteri tarafından iptal edilmesi bir olaya neden olur; işçi kontrol eder ve erken çıkar.
- "Çökme" durumunda yeniden yükleme durumu, uçuş sırasındaki görevi `CRASH_RECOVERY` ile `failed` olarak işaretler.

## Gönderin

Bu ders `outputs/skill-task-store-designer.md`'yi üretir. Uzun süre çalışan bir araç (araştırma, derleme, dışa aktarma) verildiğinde, beceri görev deposunu tasarlar (durum şekli, ttl, dayanıklılık), doğru görev Destek bayrağını seçer ve ilerleme bildirimlerinin taslağını çizer.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Bir `generate_report` görevini başlatın, durumu yoklayın ve ardından sonucu alın.

2. Çalışmanın ortasında bir `tasks/cancel` çağrısı ekleyin. Çalışanın bunu kabul ettiğini ve durumun `cancelled` olduğunu doğrulayın.

3. Kilitlenme kurtarmayı simüle edin: çalışan iş parçacığını sonlandırın, yükleyiciyi yeniden başlatın ve `CRASH_RECOVERY` hata modunu gözlemleyin.

4. Mağazayı SQLite'a genişletin. Dayanıklılık kazanımları aynıdır; sorgu seçenekleri açılır (X oturumundaki tüm görevleri listeleyin).

5. 2026 için MCP yol haritası gönderisini okuyun. Gelecek yıl SDK API tasarımını etkileme olasılığı en yüksek olan Görevlerle ilgili açık sorunu belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Görev | "Uzun süren araç çağrısı" | Zaman uyumsuz yürütme için `_meta.task` ile artırılan istek |
| SEP-1686 | "Görev özellikleri" | 2025-11-25'te Görevler Ekleyen Özel Gelişim Teklifi |
| `_meta.task` | "Görev zarfı" | Kimlik, durum, ttl içeren istek başına meta veriler |
| görevDestek | "Araç bayrağı" | Alet başına `forbidden` / `optional` / `required` |
| `tasks/status` | "Anket yöntemi" | Mevcut durumu ve isteğe bağlı ilerleme ipucunu getir |
| `tasks/result` | "Sonucu getir" | Tamamlanan yükü veya henüz yapılmadıysa 404'ü döndürür |
| `tasks/cancel` | "Durdur şunu" | Süresiz iptal talebi |
| ttl | "Elde tutma bütçesi" | Sunucu, milisaniyeler içinde görev durumunu korumayı vaat ediyor |
| `notifications/tasks/updated` | "Devlet baskısı" | Sunucu tarafından başlatılan durum değişikliği olayı |
| Dayanıklı mağaza | "Çökme korumalı durum" | Dosya sistemi / SQLite / Redis kalıcılık katmanı |

## Daha Fazla Okuma

- [MCP — GitHub SEP-1686 sayısı](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) — kaynak teklif ve tam tartışma
- [WorkOS — AI agent iş akışları için MCP zaman uyumsuz görevleri](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) — gerekçeli tasarım kılavuzu
- [DeepWiki — MCP görev sistemi ve eşzamansız işlemler](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) — mekanik ve durum makinesi
- [FastMCP — Görevler](https://gofastmcp.com/servers/tasks) — SDK düzeyinde görev uygulama kalıpları
- [MCP blogu — 2026 yol haritası](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — alt görevler dahil açık sorunlar ve 2026 öncelikleri
