# MCP Ağ Geçitleri ve Kayıtlar — Kurumsal Kontrol Düzlemleri

> Şirketler her geliştiricinin rastgele MCP sunucuları kurmasına izin veremez. Bir ağ geçidi, kimlik doğrulamayı, RBAC'yi, denetimi, hız sınırlamayı, önbelleğe almayı ve araç zehirlenmesi tespitini merkezileştirir ve ardından birleştirilmiş araç yüzeyini tek bir MCP uç noktası olarak ortaya çıkarır. Resmi MCP Kaydı (Anthropic + GitHub + PulseMCP + Microsoft, ad alanı onaylı) kanonik yukarı akıştır. Bu ders, bir ağ geçidinin nereye uyduğunu adlandırır, minimum uygulamayı yürütür ve 2026 satıcı ortamını inceler.

**Tür:** Öğren
**Diller:** Python (stdlib, minimum ağ geçidi)
**Önkoşullar:** Aşama 13 · 15 (alet zehirlenmesi), Aşama 13 · 16 (OAuth 2.1)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Bir MCP ağ geçidinin nerede bulunduğunu açıklayın (MCP istemcileri ile birden fazla arka uç MCP sunucusu arasında).
- Beş ağ geçidi sorumluluğunu uygulayın: kimlik doğrulama, RBAC, denetim, hız sınırı, politika.
- Ağ geçidi katmanında sabitlenmiş bir araç karma bildirimini zorunlu kılın.
- Resmi MCP Kaydını meta kayıtlardan (Glama, MCPMarket, MCP.so, Smithery, LobeHub) ayırın.

## Sorun

Fortune 500'de 30 onaylı MCP sunucusu, 5000 geliştirici, uyumluluk ve denetim gereksinimleri ve merkezi politika isteyen bir güvenlik ekibi bulunur. Her geliştiricinin IDE'lerine rastgele sunucular kurmasına izin vermek başlangıç ​​dışı bir yaklaşımdır.

Ağ geçidi modeli:

1. Ağ geçidi, geliştiricilerin bağlandığı tek bir Streamable HTTP uç noktası olarak çalışır.
2. Ağ geçidi, her arka uç MCP sunucusunun kimlik bilgilerini tutar.
3. Her geliştirici isteğinin kimliği ağ geçidinin kendi OAuth'u aracılığıyla doğrulanır ve kapsamı belirlenir.
4. Ağ geçidi, politikayı uygulayarak çağrıyı arka uç sunucusuna yönlendirir.
5. Tüm çağrılar denetim için günlüğe kaydedilir.

Cloudflare MCP Portalları, Kong AI Gateway, IBM ContextForge, MintMCP, TrueFoundry, Envoy AI Gateway — 2025-2026'da gönderilen tüm ağ geçitleri veya ağ geçidi özellikleri.

Bu arada, Resmi MCP Kaydı kanonik yukarı akış olarak başlatıldı: ağ geçidinin çekebileceği seçilmiş, ad alanı doğrulanmış, ters DNS adlı sunucular. Meta kayıtlar (Glama, MCPMarket, MCP.so, Smithery, LobeHub) sunucuları birden fazla kaynaktan toplar.

## Konsept

### Beş ağ geçidi sorumluluğu

1. **Auth.** Geliştiriciyi tanımlamak için OAuth 2.1; kullanıcı rolleriyle eşleşir.
2. **RBAC.** Kullanıcı başına politika: hangi sunucular, hangi araçlar, hangi kapsamlar.
3. **Denetim.** Her çağrının kim, ne, ne zaman ve sonuç bilgileri ile kaydedilmesi.
4. **Oran sınırı.** Kötüye kullanımı önlemek için kullanıcı başına / araç başına / sunucu başına sınırlar.
5. **Politika.** Zehirli açıklamaları reddedin, İki Kuralı'nı uygulayın, PII'yi düzenleyin.

### Tek uç nokta olarak ağ geçidi

Geliştiricilere ağ geçidi tek bir MCP sunucusu gibi görünür. Dahili olarak N arka uca yönlendirir. Oturum kimlikleri (Aşama 13 · 09) sınırda yeniden yazılır.

### Kimlik bilgileri atlama

Geliştiriciler hiçbir zaman arka uç token'leri görmezler. Ağ geçidi bunları tutar (veya bunları tutan bir kimlik sağlayıcının proxy'lerini oluşturur). Ağ geçidinde `notes:read` bulunan bir geliştirici, ağ geçidinin kendi arka uç kimlik bilgileriyle notlar MCP sunucusuna geçişli olarak erişebilir; ancak yalnızca geçişli erişimi bağlayan politika kapsamında.

### Ağ geçidine araç karması sabitleme

Ağ geçidi, onaylanmış araç açıklamalarının (SHA256 karmaları) bir bildirimini tutar. Keşif sırasında, her bir arka ucun `tools/list`'sini getirir, karmaları bildirimle karşılaştırır ve açıklaması değişen tüm araçları kaldırır. Bu, merkezi olarak uygulanan Aşama 13.15'teki halı çekme savunmasıdır.

### Kod olarak politika

Gelişmiş ağ geçitleri politikayı OPA/Rego, Kyverno veya Styra'da ifade eder. "`alice` kullanıcısı `github.open_pr`'yi yalnızca `acme` kuruluşundaki depolarda arayabilir" gibi kurallar bildirimsel olarak kodlanır. Basit ağ geçitleri elle kodlanmış Python kullanır. Her iki şekil de geçerlidir.

### Oturuma duyarlı yönlendirme

Bir kullanıcının oturumu bir sunucu karışımı içerdiğinde, ağ geçidi çoğullama yapar: geliştiricinin tek MCP oturumu, sunucu başına bir tane olmak üzere N arka uç oturumu tutar. Ağ geçidi üzerinden geliştiricinin oturumuna giden herhangi bir arka uç yolundan gelen bildirimler.

### Ad alanı birleştirme

Ağ geçitleri, tüm arka uçlardaki araç ad alanlarını, genellikle çarpışma önekiyle birleştirir. `github.open_pr`, `notes.search`. Bu, yönlendirmeyi açık hale getirir.

### Kayıtlar

- **Resmi MCP Kaydı (`registry.modelcontextprotocol.io`).** Anthropic, GitHub, PulseMCP ve Microsoft yönetimi altında başlatıldı. Ad alanı doğrulandı (ters DNS: `io.github.user/server`). Temel kalite için önceden filtrelenmiştir.
- **Glama.** Birçok kaynağı bir araya getiren arama merkezli meta kayıt sistemi.
- **MCPMarket.** Satıcı listelerini içeren ticari eğilimli dizin.
- **MCP.so.** Topluluk dizini; başvuruları açın.
- **Smithery.** Paket yöneticisi tarzı kurulum akışı.
- **LobeHub.** LobeChat uygulamasında kullanıcı arayüzüyle entegre kayıt defteri.

Kurumsal ağ geçitleri varsayılan olarak Resmi Kayıt Defterinden bilgi alır, meta kayıtlardan yönetici tarafından seçilen eklemelere izin verir ve sabitlenmemiş her şeyi reddeder.

### Ters DNS adlandırma

Resmi Kayıt Defteri, genel sunucular için ters DNS adlarını zorunlu kılar: `io.github.alice/notes`. Ad alanları işgali önler ve güven delegasyonunu daha net hale getirir.

### Satıcı anketi, Nisan 2026

| Satıcı | Güç |
|--------|----------|
| Cloudflare MCP Portalları | Edge tarafından barındırılan; OAuth entegre; ücretsiz katman |
| Kong AI Ağ Geçidi | K8s-yerli; ince taneli politika; OpenTelemetry'ye günlükler |
| IBM ContextForge | Kurumsal IAM; uyumluluk; ihracat denetimi |
| TrueFoundry | DevOps'a dayalı; metrikler öncelikli |
| NaneMCP | Geliştirici platformu odaklı |
| Elçi AI Ağ Geçidi | Açık kaynak; özelleştirilebilir filtreler |

Aşama 17 (üretim altyapısı), ağ geçidi operasyonlarını daha derinlemesine ele alıyor.

## Kullan onu

`code/main.py`, yaklaşık 150 satırlık minimum bir ağ geçidi sunar: sahte bir Taşıyıcı token ile kullanıcıların kimliğini doğrular, kullanıcı başına bir RBAC politikası tutar, istekleri iki arka uç MCP sunucusuna yönlendirir, her çağrıyı bir denetim günlüğüne yazar, bir hız sınırı uygular ve açıklama karması sabitlenmiş bildirimle eşleşmeyen herhangi bir arka uç aracını reddeder.

Neye bakmalı:

- `user_id` tarafından izin verilen `server_tool` girişleriyle anahtarlanan `RBAC` diktesi.
- `AUDIT_LOG` olayların yalnızca eklenen bir listesidir.
- Hız sınırında kullanıcı başına bir token paketi kullanılır.
- Sabitlenmiş bildirim `server::tool -> hash`'nin bir diktesidir.

## Gönderin

Bu ders `outputs/skill-gateway-bootstrap.md`'yi üretir. Bir kurumsal MCP planı (kullanıcılar, arka uçlar, uyumluluk) göz önüne alındığında, beceri bir ağ geçidi yapılandırma spesifikasyonu üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. İzin verilen kullanıcı olarak arama yapın; daha sonra izin verilmeyen bir kullanıcı olarak; ardından hız sınırının aşıldığı bir patlama. Her üç akışı da doğrulayın.

2. İstemciye geri dönmeden önce sonuçlardan PII'yi çıkaran bir politika ekleyin. SSN şeklindeki dizeler için basit bir normal ifade geçişi kullanın; boşluğu not edin (e-postalar, telefon numaraları).

3. OpenTelemetry GenAI yayılmalarını yaymak için denetim günlüğünü genişletin. Aşama 13 · 20 tam özellikleri kapsar.

4. Beş arka uca (notes, github, postgres, jira, slack) sahip 50 geliştiriciden oluşan bir ekip için bir RBAC politikası tasarlayın. Her birinde salt okunur kimler var? Kim yazacak?

5. Cloudflare kurumsal MCP yazısını yukarıdan aşağıya okuyun. Cloudflare'in bu stdlib ağ geçidinde bulunmayan bir özelliğini belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Ağ Geçidi | "MCP proxy'si" | Sunucuyu istemciler ve arka uçlar arasında merkezileştirme |
| Kimlik bilgileri atlama | "Arka uç token'ler sunucu tarafında kalıyor" | Geliştiriciler hiçbir zaman yukarı akış token'leri görmezler |
| Oturuma duyarlı yönlendirme | "Çoklu arka uç oturumu" | Ağ Geçidi, geliştirici oturumu başına N arka uç oturumunu çoğaltır |
| Araç karma sabitleme | "Onaylanmış bildirim" | Onaylanan her alet tanımının SHA256'sı; merkezi olarak halı çekme blokları |
| RBAC | "Kullanıcı başına politika" | Araçlar ve sunucular için rol tabanlı erişim kontrolü |
| Kod olarak politika | "Bildirim kuralları" | Ağ geçidinde uygulanan OPA/Rego, Kyverno, Styra politikaları |
| Denetim günlüğü | "Kim, ne, ne zaman" | Uyumluluk için yalnızca ekleme olay günlüğü |
| Oran sınırı | "Kullanıcı başına token paketi" | Kötüye kullanımı önlemek için dakika başına sınırlar |
| Resmi MCP Kaydı | "Kanonik yukarı akış" | `registry.modelcontextprotocol.io`, ad alanı onaylı |
| Ters DNS adlandırma | "Kayıt defteri ad alanı" | `io.github.user/server` kongresi |

## Daha Fazla Okuma

- [Resmi MCP Kaydı](https://registry.modelcontextprotocol.io/) — kanonik yukarı akış, ad alanı doğrulamalı
- [Cloudflare — Kurumsal MCP](https://blog.cloudflare.com/enterprise-mcp/) — OAuth ve politikaya sahip ağ geçidi modeli
- [agentic-community — MCP ağ geçidi kaydı](https://github.com/agentic-community/mcp-gateway-registry) — açık kaynaklı referans ağ geçidi
- [TrueFoundry — MCP ağ geçidi nedir?](https://www.truefoundry.com/blog/what-is-mcp-gateway) — özellik karşılaştırma makalesi
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — IBM'den kurumsal ağ geçidi
