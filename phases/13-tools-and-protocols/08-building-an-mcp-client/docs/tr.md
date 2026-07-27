# Bir MCP İstemcisi Oluşturma — Keşif, Çağırma, Oturum Yönetimi

> Çoğu MCP içeriği, sunucu eğitimlerini gönderir ve müşteriye el sallar. İstemci kodu, sıkı orkestrasyonun yaşadığı yerdir: süreç oluşturma, yetenek anlaşması, birden fazla sunucuda araç listesi birleştirme, geri aramaları örnekleme, yeniden bağlanma ve ad alanı çarpışma çözümü. Bu ders, üç farklı MCP sunucusunu model için tek bir düz araç ad alanına taşıyan çok sunuculu bir istemci oluşturur.

**Tür:** Yapım
**Diller:** Python (stdlib, çok sunuculu MCP istemcisi)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu oluşturma)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Alt işlem olarak bir MCP sunucusu oluşturun, `initialize`'yi tamamlayın ve bir `notifications/initialized` gönderin.
- Sunucu başına oturum durumunu koruyun (yetenekler, araç listesi, son görülen bildirim kimlikleri).
- Birden çok sunucudaki araç listelerini çarpışma yönetimiyle tek bir ad alanında birleştirin.
- Bir araç çağrısını, kendisine ait olan sunucuya yönlendirin ve yanıtı yeniden birleştirin.

## Sorun

Gerçek bir agent ana bilgisayarı (Claude Desktop, Cursor, Goose, Gemini CLI) aynı anda birden fazla MCP sunucusunu yükler. Bir kullanıcının aynı anda çalışan bir dosya sistemi sunucusu, bir Postgres sunucusu ve bir GitHub sunucusu olabilir. Müşterinin işi:

1. Her sunucuyu oluşturun.
2. Birbirinizden bağımsız olarak el sıkışın.
3. Her birinde `tools/list`'yi çağırın ve sonucu düzleştirin.
4. Model `notes_search` yayınladığında, bunu birleştirilmiş ad alanında arayın ve doğru sunucuya yönlendirin.
5. Herhangi bir sunucudan (`tools/list_changed`) gelen bildirimleri engellemeden işleyin.
6. Aktarım hatası durumunda yeniden bağlanın.

Tüm bunları elle yuvarlamak, "oyuncağı" "kullanıma uygun" olandan ayıran şeydir. Resmi SDK'lar bunu tamamlıyor ancak zihinsel modelin size ait olması gerekiyor.

## Konsept

### Çocuk süreçli üreme

`stdin=PIPE, stdout=PIPE, stderr=PIPE` ile `subprocess.Popen`. `bufsize=1`'yi ayarlayın ve satır satır okumalar için metin modunu kullanın. Her sunucu bir süreçtir; istemci, sunucu başına bir `Popen` tanıtıcısına sahiptir.

### Sunucu başına oturum durumu

Sunucu başına bir `Session` nesnesi şunları içerir:

- `process` — Popen tanıtıcısı.
- `capabilities` — sunucunun `initialize`'de beyan ettiği şey.
- `tools` — son `tools/list` sonucu.
- `pending` — yanıtı bekleyen bir söze/geleceğe yönelik istek kimliğinin haritası.

İstekler doğası gereği eşzamansızdır; B sunucusu çağrının ortasındayken A sunucusuna gönderilen `tools/call` bloke edilmemelidir. Kuyruklu veya eşzamansız iş parçacıklarını kullanın.

### Birleştirilmiş ad alanı

İstemci toplu araç listesini gördüğünde adlar çarpışabilir. İki sunucunun her ikisi de `search`'yi açığa çıkarabilir. İstemcinin üç seçeneği vardır:

1. **Sunucu adına göre önek.** `notes/search`, `files/search`. Açık ama çirkin.
2. **Sessiz ilk gelen.** Daha sonraki sunucunun `search` özelliği öncekini geçersiz kılar. Riskli; çarpışmaları gizler.
3. **Çarpışma reddi.** İkinci sunucuyu yüklemeyi reddedin; kullanıcıyı bilgilendirin. Güvenliğe duyarlı ana bilgisayarlar için en güvenlisi.

Claude Desktop, sunucuya göre önek kullanır. İmleç, açık bir hatayla çarpışma reddini kullanır. VS Code MCP, sunucuya göre öneki de benimser.

### Yönlendirme

Birleştirmeden sonra bir sevk tablosu `tool_name -> session`'yi eşler. Model isme göre bir çağrı yapar; istemci oturumu bulur ve bu sunucunun stdin'ine bir `tools/call` mesajı yazar ve ardından yanıtı bekler.

### Örnekleme geri araması

Sunucu, `initialize`'de `sampling` yeteneğini beyan ederse, `sampling/createMessage` göndererek istemciden LLM'yi çalıştırmasını isteyebilir. Müşteri şunları yapmalıdır:

1. Örnek çözülene kadar bu sunucuya gelecek diğer istekleri veya uygulaması eşzamanlılığı destekliyorsa ardışık düzeni engelleyin.
2. LLM sağlayıcısını arayın.
3. Yanıtı sunucuya geri gönderin.

Ders 11 uçtan uca örneklemeyi kapsar. Bu ders onu bütünlük açısından kısaltıyor.

### Bildirim yönetimi

`notifications/tools/list_changed`, `tools/list`'yi yeniden çağırmak anlamına gelir. `notifications/resources/updated`, kullanımdaysa kaynağın yeniden okunması anlamına gelir. Bildirimler yanıt üretmemelidir; onları onaylamaya çalışmayın.

Yaygın bir istemci hatası: akışta bir bildirim bulunurken `tools/call` üzerinde okuma döngüsünün engellenmesi. Her mesajı bir kuyruğa iten bir arka plan okuyucu iş parçacığı kullanın; ana iş parçacığı kuyruktan ayrılır ve gönderilir.

### Yeniden Bağlanma

Aktarım başarısız olabilir: sunucu çöktü, işletim sistemi süreci sonlandırdı, stdio kanalı bozuldu. İstemci stdout'ta EOF'yi tespit eder ve oturumu ölü olarak ele alır. Seçenekler:

- Sunucuyu sessizce yeniden başlatın ve yeniden el sıkışın. Tamamen salt okunur sunucular için uygun.
- Arızayı kullanıcıya gösterin. Kullanıcı tarafından görülebilen oturumlara sahip durum bilgisi olan sunucular için uygundur.

Aşama 13 · 09, Akışlı HTTP yeniden bağlanma semantiğini kapsar; stdio daha basittir.

### Canlı tutma ve oturum kimliği

Akış yapılabilir HTTP, `Mcp-Session-Id` başlığını kullanır. Stdio'nun oturum kimliği yoktur; işlem kimliği oturumdur. Canlı tutma pingleri isteğe bağlıdır; stdio boruları hareketsizlik durumunda kırılmaz.

## Kullan onu

`code/main.py`, alt süreçler olarak üç simüle edilmiş MCP sunucusu oluşturur, her biri için el sıkışır, araç listelerini birleştirir ve araç çağrılarını doğru olana yönlendirir. "Sunucular" aslında oyuncak yanıtlayıcıları çalıştıran diğer Python işlemleridir (gerçek LLM yoktur). Görmek için çalıştırın:

- Her biri kendi yetenek setine sahip üç başlatma.
- Üç `tools/list` sonucu 7 araçlı bir ad alanında birleştirildi.
- Araç adına dayalı bir yönlendirme kararı.
- Ad alanı önekiyle önlenen bir çarpışma.

Neye bakmalı:

- `Session` veri sınıfı, sunucu başına durumu temiz bir şekilde tutar.
- Arka plan okuyucu iş parçacığı, ana iş parçacığını engellemeden stdout'taki her satırı kuyruktan çıkarır.
- Gönderim tablosu basit bir `dict[str, Session]`'dir.
- Çarpışma yönetimi açıktır: iki sunucu aynı adı bildirdiğinde, sonraki sunucu bir önekle yeniden adlandırılır.

## Gönderin

Bu ders `outputs/skill-mcp-client-harness.md`'yi üretir. MCP sunucularının bildirime dayalı bir listesi (ad, komut, argümanlar) verildiğinde, beceri bunları üreten, araç listelerini birleştiren ve çarpışma çözümlemeli bir yönlendirme işlevi gönderen bir donanım üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın ve sunucunun ortaya çıkma günlüğünü izleyin. Simüle edilmiş sunucu işlemlerinden birini bir SIGTERM ile sonlandırın ve istemcinin EOF'yi nasıl algıladığını ve bu oturumu ölü olarak işaretlediğini gözlemleyin.

2. Ad alanı önekini uygulayın. İki sunucu `search`'yi kullanıma sunduğunda ikinciyi `<server>/search` olarak yeniden adlandırın. Dağıtım tablosunu güncelleyin ve araç çağrılarının doğru şekilde yönlendirildiğini doğrulayın.

3. Sunucunun yeniden başlatılması için bağlantı havuzu tarzı bir geri çekilme ekleyin: ardışık arızalarda üstel geri çekilme, 30 saniyeyle sınırlayın, üç arızadan sonra kullanıcıya bir bildirim gönderin.

4. 100 eşzamanlı MCP sunucusunu destekleyen bir istemci taslağı çizin. Basit sevk deyiminin yerini hangi veri yapısı alır? (İpucu: önek ad alanını ve ayrıca sunucu başına araç sayısı için bir ölçümü deneyin.)

5. İstemciyi resmi MCP Python SDK'sına taşıyın. SDK, `stdio_client` ve `ClientSession`'yi sarar. Çoklu sunucu yönlendirmesini korurken kodun ~200 satırdan ~40 satıra küçültülmesi gerekir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MCP istemcisi | "agent ana bilgisayarı" | Sunucuları oluşturan ve araç çağrılarını düzenleyen süreç |
| Oturum | "Sunucu başına durum" | Yetenekler, araç listesi ve bekleyen istek defter tutma |
| Birleştirilmiş ad alanı | "Tek araç listesi" | Tüm aktif sunucularda düz araç adları kümesi |
| Ad alanı çarpışması | "İki sunucu aynı araç" | Müşteri kopyanın önüne eklemeli, reddetmeli veya ilk gelen kopyayı kullanmalıdır |
| Yönlendirme | "Bu çağrıyı kim alıyor?" | Araç adından sahip olunan sunucuya gönderim |
| Arka plan okuyucusu | "Engellemeyen stdout" | Sunucu stdout'unu kuyruğa aktaran iş parçacığı veya görev |
| Örnekleme geri arama | "Hizmet olarak Yüksek Lisans" | Sunucudan `sampling/createMessage` için istemci işleyicisi |
| `notifications/*_changed` | "İlkel mutasyona uğramış" | İstemcinin yeniden keşfetmesi veya yeniden okuması gerektiğinin sinyali |
| Yeniden bağlanma politikası | "Sunucu öldüğünde" | Aktarım başarısız olduğunda anlambilimi yeniden başlatın |
| Stdio oturumu | "Süreç = oturum" | Oturum kimliği yok; alt sürecin ömrü oturumdur |

## Daha Fazla Okuma

- [Model Bağlam Protokolü — İstemci spesifikasyonu](https://modelcontextprotocol.io/specification/2025-11-25/client) — standart istemci davranışı
- [MCP — Hızlı başlangıç istemci kılavuzu](https://modelcontextprotocol.io/quickstart/client) — Python SDK ile merhaba dünya istemci eğitimi
- [MCP Python SDK — istemci modülü](https://github.com/modelcontextprotocol/python-sdk) — `ClientSession` ve `stdio_client` referansı
- [MCP TypeScript SDK — İstemci](https://github.com/modelcontextprotocol/typescript-sdk) — TS paralel
- [VS Code — uzantılarda MCP](https://code.visualstudio.com/api/extension-guides/ai/mcp) — VS Code'un birden fazla MCP sunucusunu tek bir düzenleyici ana bilgisayarda nasıl çoğalttığı
