# MCP Aktarımları — stdio ve Akışkan HTTP ve SSE Geçişi

> stdio yerel olarak çalışır ve başka hiçbir yerde çalışmaz. Akış yapılabilir HTTP (2025-03-26) uzak standarttır. Eski HTTP+SSE aktarımı kullanımdan kaldırılacak ve 2026'nın ortalarında kaldırılacak. Yanlış taşımayı seçmek bir göçe mal olur; doğru olanı seçmek, oturum sürekliliğine ve DNS yeniden bağlama korumasına sahip, uzaktan barındırılabilir bir MCP sunucusu satın alır.

**Tür:** Öğren
**Diller:** Python (stdlib, Akışlı HTTP uç nokta iskeleti)
**Önkoşullar:** Aşama 13 · 07, 08 (MCP sunucusu ve istemcisi)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- deployment şekline (yerel vs uzak, tek işlem vs filo) göre stdio ve Akışlı HTTP arasında seçim yapın.
- Akışa uygun HTTP tek uç nokta modelini uygulayın: istekler için POST, oturum akışı için GET.
- DNS yeniden bağlamayı engellemek için `Origin` doğrulamasını ve oturum kimliği semantiğini zorunlu kılın.
- Eski bir HTTP+SSE sunucusunu, 2026 ortası kaldırma son tarihlerinden önce Yayınlanabilir HTTP'ye geçirin.

## Sorun

İlk MCP uzaktan aktarımı (2024-11) HTTP+SSE idi: biri istemcinin POST'ları için ve diğeri sunucudan istemciye akış için Sunucu-Gönderilen Olaylar kanalı olmak üzere iki uç nokta. İşe yaradı. Aynı zamanda beceriksizdi: oturum başına iki uç nokta, bazı CDN'lerin önündeki bozuk önbellekler ve bazı WAF'lerin agresif bir şekilde sonlandırdığı uzun ömürlü SSE bağlantılarına sıkı bir bağımlılık.

2025-03-26 spesifikasyonu bunu Akışlanabilir HTTP ile değiştirdi: bir uç nokta, istemci istekleri için POST, bir oturum akışı oluşturmak için GET, her ikisi de bir `Mcp-Session-Id` başlığını paylaşıyor. O zamandan bu yana oluşturulan veya taşınan her sunucu Akışlanabilir HTTP'yi kullanıyor. Eski SSE modu kullanımdan kaldırılıyor — Atlassian Rovo, 30 Haziran 2026'da bu modu kaldırdı; Keboola 1 Nisan 2026; 2026 sonuna kadar kalan kurumsal sunucuların çoğu.

Ve stdio yerel sunucular için hala önemlidir. Claude Desktop, VS Code ve her IDE şeklindeki istemci sunucularını stdio aracılığıyla oluşturur. Doğru zihinsel model: "bu makine" için stdio, "ağ üzerinden" için Akışlı HTTP. Geçiş yok.

## Konsept

### stdio

- Çocuk proses taşımacılığı. İstemci sunucuyu oluşturur, stdin/stdout aracılığıyla iletişim kurar.
- Satır başına bir JSON nesnesi. Yeni satırla ayrılmış.
- Oturum kimliği yok; süreç kimliği oturumdur.
- Kimlik doğrulamaya gerek yok (çocuk, ebeveynin güven sınırını devralır).
- Hiçbir zaman uzak sunucular için kullanmayın; tünel açmak için SSH veya socat'a ihtiyacınız olacaktır; bu noktada Streamable HTTP'yi kullanın.

### Akışlı HTTP

Tek uç nokta `/mcp` (veya herhangi bir yol). Üç HTTP yöntemini destekler:

- **POST /mcp.** İstemci bir JSON-RPC mesajı gönderir. Sunucu, tek bir JSON yanıtıyla veya bir veya daha fazla yanıttan oluşan bir SSE akışıyla yanıt verir (toplu yanıtlar ve bu istekle ilgili bildirimler için kullanışlıdır).
- **GET /mcp.** Müşteri uzun ömürlü bir SSE kanalı açar. Sunucu bunu sunucudan istemciye istekler (örnekleme, bildirimler, ortaya çıkarma) için kullanır.
- **DELETE /mcp.** İstemci oturumu açıkça sonlandırır.

Oturumlar, sunucunun ilk yanıtta ayarladığı `Mcp-Session-Id` başlığıyla tanımlanır ve istemci, sonraki her istekte yankı yapar. Oturum kimlikleri kriptografik olarak rastgele (128+ bit) OLMALIDIR; müşteri tarafından seçilen kimlikler güvenlik nedeniyle reddedilir.

### Tek uç nokta vs iki

Eski spesifikasyondaki iki uç nokta modu 2026'da hala çağrılabilir; spesifikasyon bunun "eski uyumlu" olduğunu beyan eder. Ancak tüm yeni sunucular tek uç nokta olmalıdır. Resmi SDK'lar tek uç nokta yayar; eski modu yalnızca taşınmamış bir uzaktan kumandayla konuşurken kullanın.

### `Origin` doğrulama ve DNS yeniden bağlama

Tarayıcılar (günümüzde) MCP istemcileri değildir, ancak bir saldırgan, tarayıcıyı kullanıcının yerel MCP sunucusunun dinlediği `localhost:1234/mcp` adresine POST yapmaya ikna eden bir web sayfası oluşturabilir. Sunucu `Origin`'yi kontrol etmezse, `Origin: http://evil.com` geçerli bir çapraz köken olduğundan tarayıcının aynı kaynak ilkesi onu kaydetmez.

2025-11-25 spesifikasyonu, sunucuların `Origin` izin verilenler listesinde olmayan istekleri reddetmesini gerektirir. İzin verilenler listesi genellikle MCP istemci ana bilgisayarını (`https://claude.ai`, `vscode-webview://*`) ve yerel kullanıcı arayüzleri için localhost çeşitlerini içerir.

### Oturum kimliği yaşam döngüsü

1. Müşteri ilk isteği `Mcp-Session-Id` olmadan gönderir.
2. Sunucu rastgele bir kimlik atar ve yanıt başlığında `Mcp-Session-Id`'yi ayarlar.
3. İstemci bu başlığı sonraki tüm isteklerde ve akış için `GET /mcp` üzerinde yansıtır.
4. Oturum sunucu tarafından iptal edilebilir; istemci sonraki isteklerde 404'ü görür ve yeniden başlatılması gerekir.
5. İstemci, temiz kapatma için oturumu açıkça SİLEBİLİR.

### Hayatta kalın ve yeniden bağlanın

SSE bağlantıları düşüyor. İstemci aynı `Mcp-Session-Id` ile yeniden GET yaparak yeniden kurulur. Sunucu, kesinti sırasında kaçırılan olayları sıraya koymalı (makul bir zaman aralığına kadar) ve istemcinin yansıttığı `last-event-id` başlığı aracılığıyla yeniden oynatmalıdır.

Aşama 13 · 13, uzun süren çalışmaların tam oturumda yeniden bağlanma durumunda bile hayatta kalmasına olanak tanıyan Görevleri kapsar.

### Geriye dönük uyumluluk araştırması

Hem eski hem de yeni sunucuları desteklemek isteyen bir istemci:

1. `/mcp`'ye POST yapın.
2. Yanıt JSON veya SSE ile `200 OK` ise bu, Akış Yapılabilir HTTP'dir.
3. Yanıt, `Content-Type: text/event-stream` VE ikincil bir uç noktaya işaret eden bir `Location` başlığına sahip `200 OK` ise, bu eski HTTP+SSE'dir; `Location`'yi takip edin.

### Cloudflare, ngrok ve barındırma

2026'daki üretim uzak MCP sunucuları, Cloudflare Workers (MCP Agent SDK'ları ile), Vercel Functions veya kapsayıcıya alınmış Node/Python üzerinde çalışır. Anahtar: Barındırma sisteminiz SSE GET için uzun ömürlü HTTP bağlantılarını desteklemelidir. Vercel'in ücretsiz kademe sınırı 10 saniyedir ve uygun değildir. Cloudflare Çalışanları belirsiz akışları destekler.

### Ağ geçidi kompozisyonu

Birden fazla MCP sunucusunu bir ağ geçidiyle ön plana çıkardığınızda (Aşama 13 · 17), ağ geçidi, oturum kimliklerini yeniden yazan ve yukarı akışı çoğullayan tek bir Akış Yapılabilir HTTP uç noktasıdır. Araçlar ağ geçidi katmanında birleştirilir; istemci tek bir mantıksal sunucu görür.

### Aktarım hatası modları

- **stdio SIGPIPE.** Yazma sırasında alt süreç ölümü SIGPIPE'ı yükseltir; sunucular temiz bir şekilde çıkmalıdır. İstemciler EOF'yi tespit etmeli ve oturumu ölü olarak işaretlemelidir.
- **HTTP 502 / 504.** Cloudflare, nginx ve diğer proxy'ler, yukarı akış arızasında bunları yayar. Akış yapılabilir HTTP istemcileri, kısa bir geri çekilmeden sonra bir kez daha denemelidir.
- **SSE bağlantısının kesilmesi.** TCP RST, proxy zaman aşımı veya istemci ağ değişikliği akışı kapatır. İstemci, devam etmek için `Mcp-Session-Id` ve isteğe bağlı `last-event-id` ile yeniden bağlanır.
- **Oturum iptali.** Sunucu, oturum kimliğini geçersiz kılar; müşteri bir sonraki istekte 404'ü görür. Müşteri yeniden tokalaşmalıdır.
- **Saat çarpıklığı.** İstemcideki kaynak-TTL hesaplamaları sunucudan farklıdır. Müşteri, sunucu zaman damgalarını yetkili olarak ele almalıdır.

### Akışlı HTTP ne zaman atlanmalı

Bazı kuruluşlar, MCP sunucularını kendi ağları içindeki gRPC veya mesaj kuyruğu aktarımlarının arkasına yerleştirir. Bu standart değildir; MCP'nin özellikleri bunları resmi olarak tanımlamaz. Ağ geçitleri, gRPC'yi dahili olarak kullanırken MCP istemcilerine Akış Yapılabilir bir HTTP yüzeyi sunabilir. Dış yüzeyin spesifikasyonlara uygun olmasını sağlayın; ağ geçidi çevirinin sahibidir.

## Kullan onu

`code/main.py`, `http.server` (stdlib) kullanarak minimum Akışlı HTTP uç noktası uygular. `/mcp` üzerinde POST, GET ve DELETE işlemlerini gerçekleştirir, ilk yanıtta `Mcp-Session-Id`'yi ayarlar, `Origin`'yi doğrular ve izin verilenler listesinde olmayan kaynaklardan gelen istekleri reddeder. İşleyici, Ders 07 notları sunucusunun gönderme mantığını yeniden kullanır.

Neye bakmalı:

- POST işleyicisi JSON-RPC gövdesini okur, gönderir ve bir JSON yanıtı yazar (tek yanıtlı değişken; SSE değişkeni yapısal olarak benzerdir).
- `Origin` kontrolü, varsayılan `http://evil.example` probunu reddeder ancak `http://localhost`'yi kabul eder.
- Oturum kimlikleri rastgele 128 bitlik onaltılık dizelerdir; sunucu oturum başına durumu bellekte tutar.

## Gönderin

Bu ders `outputs/skill-mcp-transport-migrator.md`'yi üretir. Bir HTTP+SSE (eski) MCP sunucusu göz önüne alındığında, beceri, oturum kimliği sürekliliği, Köken kontrolleri ve geriye dönük uyumlu araştırma desteği ile Akış Yapılabilir HTTP'ye bir geçiş planı üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. `curl`'den bir `initialize` POST yapın ve `Mcp-Session-Id` yanıt başlığını gözlemleyin. Başlığı yansıtan ikinci bir istek POST yapın ve oturumun sürekliliğini doğrulayın.

2. SSE akışını açan bir GET işleyicisi ekleyin. Her beş saniyede bir `notifications/progress` olayı gönderin. Aynı oturum kimliğiyle yeniden GET alarak yeniden bağlanın ve sunucunun bunu kabul ettiğini onaylayın.

3. `last-event-id` tekrar yürütme mantığını uygulayın. Yeniden bağlandığınızda, bu kimlikten bu yana oluşturulan tüm etkinlikleri yeniden oynatın.

4. `Origin` doğrulamasını joker karakter desenini (`https://*.example.com`) destekleyecek şekilde genişletin ve `https://app.example.com`'yi kabul ettiğini ancak `https://evil.example.com.attacker.net`'yi reddettiğini doğrulayın.

5. Resmi kayıt defterinden eski bir HTTP+SSE sunucusu alın (birkaç tane var) ve geçişin taslağını çıkarın: uç nokta işlemede, oturum kimliği oluşturmada ve başlık anlambiliminde ne gibi değişiklikler var.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| stdyo taşımacılığı | "Yerel alt süreç" | JSON-RPC, stdin/stdout üzerinden, yeni satırla ayrılmış |
| Akış yapılabilir HTTP | "Uzaktan taşıma" | Tek uç nokta POST + GET + isteğe bağlı SSE, 2025-03-26 spesifikasyonu |
| HTTP+SSE | "Miras" | İki uç nokta modeli 2026'nın ortalarında kaldırılıyor |
| `Mcp-Session-Id` | "Oturum başlığı" | Sunucu tarafından atanan rastgele kimlik, sonraki her istekte yankılandı |
| `Origin` izin verilenler listesi | "DNS yeniden bağlama savunması" | Kaynağı onaylanmayan istekleri reddet |
| Tek uç nokta | "Tek URL" | `/mcp`, tüm oturum işlemleri için POST / GET / DELETE işlemlerini yönetir |
| `last-event-id` | "SSE tekrarı" | Bırakılan bir akışı etkinlikleri kaçırmadan sürdürmek için kullanılan başlık |
| Geriye doğru uyumlu prob | "Eski ve yeni algılama" | Aktarımı otomatik olarak seçen istemci yanıt şekli kontrolü |
| Uzun ömürlü HTTP | "SSE akışı" | Sunucu, olayları tek bir TCP bağlantısı üzerinde dakikalarca veya saatlerce aktarır |
| Oturum iptali | "Yeniden başlatmaya zorla" | Sunucu bir oturum kimliğini geçersiz kılıyor; müşteri tekrar el sıkışmalı |

## Daha Fazla Okuma

- [MCP — Temel aktarım spesifikasyonu 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio ve Akışlı HTTP için standart referans
- [MCP — Temel aktarım spesifikasyonu 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Akış Yapılabilir HTTP'yi tanıtan revizyon
- [Cloudflare — MCP aktarımı](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Çalışanlar tarafından barındırılan Akış yapılabilir HTTP kalıpları
- [AWS — MCP taşıma mekanizmaları](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — deployment şekilleri arasında karşılaştırma
- [Atlassian — HTTP+SSE kullanımdan kaldırma bildirimi](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — somut geçiş son tarihi örneği
