# Güvenlik — Sırlar, API Anahtar Rotasyonu, Denetim Günlükleri, Korkuluklar

> Merkezi kasalar (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault) aracılığıyla gizli yayılmayı ortadan kaldırın. Kimlik bilgilerini asla yapılandırma dosyalarında, env dosyalarını VCS'de, elektronik tablolarda saklamayın. Statik anahtarlar üzerinden IAM rollerini kullanın; CI/CD için OIDC. Yapay zeka ağ geçidi modeli 2026 çözümüdür: uygulamalar → ağ geçidi → model sağlayıcı, ağ geçidinin çalışma zamanında kasadan kimlik bilgilerini çekmesiyle. Kasada rotasyon yapın ve tüm uygulamalar dakikalar içinde çalışmaya başlar; yeniden dağıtım yok, Slack'in "yeni anahtar kimde?" mesajı yok. Rotasyon politikası ≤90 gün; Her işlemde TruffleHog / GitGuardian / Gitleaks ile tarayın. Sıfır güven: MFA, SSO, RBAC/ABAC, kısa ömürlü token'lar, cihazın duruşu. PII temizleme, iletmeden önce PHI/PII'yi maskelemek için varlık tanımayı kullanır; tutarlı tokenizasyon (Mesh yaklaşımı), hassas değerleri kararlı yer tutucularla eşleştirir, böylece LLM kod/ilişki anlambilimini korur. Ağ çıkışı: Özel VPC/VNet alt ağında yalnızca `api.openai.com`, `api.anthropic.com` vb. beyaz listeye alınan LLM hizmetleri; diğer tüm gidenleri engelle. 2026 olayının tetikleyicisi: Güvenliği ihlal edilmiş CI/CD kimlik bilgileri aracılığıyla sızdırılan ortam aracılığıyla Vercel tedarik zinciri saldırısı, binlerce müşteri deployment arasında farklılık gösteriyor.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak PII temizleyici + denetim günlüğü yazarı)
**Önkoşullar:** Aşama 17 · 19 (AI Ağ Geçitleri), Aşama 17 · 13 (Observability)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Dört gizli yönetim anti-örüntüsünü (VCS'deki yapılandırma dosyaları, sabit kodlu env, elektronik tablolar, statik anahtarlar) numaralandırın ve bunların değiştirilmelerini adlandırın.
- 2026 üretim standardı olarak yapay zeka ağ geçidinin kasadan çekilmesi modelini açıklayın.
- Anlambilimin hayatta kalması için tutarlı tokenizasyon (aynı değer → aynı yer tutucu) ile bir PII temizleyici uygulayın.
- 2026 Vercel tedarik zinciri olayının adını ve bunun CI/CD kimlik hijyeni hakkında ne öğrettiğini belirtin.

## Sorun

Bir stajyer API anahtarlarıyla `.env` işlemini gerçekleştirir. Çabuk silerler. Anahtarlar zaten git geçmişindedir - GitGuardian taraması onu yakalar, rotasyon süreciniz "Ekibi gevşetin, 40 yapılandırma dosyasını güncelleyin, tüm hizmetleri yeniden konuşlandırın." 8 saat sonra hizmetlerinizin yarısı yayında, yarısı da dağıtım pencerelerini bekliyor.

Ayrı olarak, prompt kullanıcısı "SSN'im 123-45-6789"u içerir. Prompt OpenAI'ye gidiyor. Bir BAA'nız var ancak dahili politikanız, iletmeden önce PII'yi maskelemek. Yapmadın.

Ayrı olarak, EKS kümenizin LLM bölmesi herhangi bir internet ana bilgisayarına erişebilir. Birisi verileri DNS araması yoluyla saldırganın kontrolündeki bir alana aktarır. Hiçbir şey onu engellemedi.

LLM hizmetlerinin güvenliğinin bu üç vektörü de ele alması gerekir. Vault destekli kimlik bilgileri. PII temizleme. Ağ çıkışı filtreleme. Denetim günlükleri.

## Konsept

### Merkezi kasa + IAM rolü çekme

**Vault**: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. Gerçeğin tek kaynağı.

**IAM rolü**: uygulama/ağ geçidi, statik bir anahtarla değil, IAM kimliğiyle kimlik doğrulaması yapar. Vault, token'ın ömrü boyunca sırrı döndürür.

**Yapay zeka ağ geçidi modeli**: ağ geçidi, istek zamanında `OPENAI_API_KEY` 'yi kasadan çeker. Kasada döndürün; sonraki istek yeni anahtarı alır. Yeniden dağıtım yok.

### Rotasyon politikası ≤ 90 gün

Tüm API anahtarları, kasa kökü token'lar, CI/CD kimlik bilgileri. Mümkün olduğunda otomatik rotasyon. Manuel rotasyon günlüğe kaydedilir ve takip edilir.

### Gizli tarama

- **TruffleHog** — taahhütlerde normal ifade + entropi.
- **GitGuardian** — ticari, yüksek doğruluk.
- **Gitleaks** — OSS, CI'da çalışır.

Her taahhütte çalıştırın. Yeni bir sır tespit edilirse PR'yi engelleyin.

### Sıfır güven duruşu

- Tüm hesaplarda MFA gereklidir.
- SAML/OIDC aracılığıyla TOA.
- Ayrıntılı erişim için RBAC (rol tabanlı) veya ABAC (öznitelik tabanlı).
- Kısa ömürlü tokens (günler değil, saatler).
- Cihaz duruşu — yalnızca disk şifrelemeli şirket cihazları.

### PII / PHI temizleme

prompt altyapınızdan ayrılmadan önce:

1. Varlık tanıma (spaCy NER, Presidio, ticari).
2. Eşleşen varlıkları maskele: `"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`.
3. Tutarlı tokenizasyon (Mesh yaklaşımı): LLM'nin ilişkileri koruyabilmesi için aynı değer aynı yer tutucuyla eşleşir.
4. LLM yanıtı için isteğe bağlı ters eşleme.

Statik normal ifade filtreleri temel kalıpları yakalar; NER daha fazlasını yakalıyor. Her ikisini de kullanın.

### Giriş + çıkış korkulukları

Giriş: bilinen jailbreak'leri, yasak konuları engelleyin; kullanıcı başına ücret sınırı.

Çıktı: sızdırılan sırlar için normal ifade temizleme (API anahtar kalıpları, ret bağlamlarında e-posta kalıpları), politika ihlallerine yönelik sınıflandırıcı.

### Ağ çıkışı beyaz listesi

Özel bir alt ağdaki LLM hizmetleri:
- Beyaz liste: `api.openai.com`, `api.anthropic.com`, vektör veritabanı uç noktaları, kasa uç noktaları.
- Diğer her şey: bırak.
- Yalnızca izin verilenler listesindeki çözümleyici aracılığıyla DNS (DNS tünelleme exfil'inden kaçının).

### Denetim günlüğü

Her LLM çağrısının değişmez günlüğü:
- Zaman damgası.
- Kullanıcı / kiracı.
- Prompt hash (gizlilik için ham prompt değil).
- Model + versiyon.
- Token sayar.
- Maliyet.
- Yanıt karması.
- Herhangi bir korkuluk gezisi.

Mevzuat gerekliliklerine göre saklayın (SOC 2 1 yıl, HIPAA 6 yıl).

### 2026 Vercel olayı

Tedarik zinciri saldırısı: güvenliği ihlal edilmiş CI/CD kimlik bilgilerinin sızdırıldığı ortam, binlerce müşteri deployment arasında farklılık gösterir. Ders: CI/CD kimlik bilgileri üretime eşdeğerdir. Kasada saklayın. Kapsamı dar. Agresif bir şekilde döndürün.

### Hatırlamanız gereken sayılar

- Rotasyon politikası: ≤ 90 gün.
- Her işlemi tarayın: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: CI/CD kimlik bilgileri tehlikeye girdi → binlerce müşteri ortamı sızdırıldı.
- Denetim günlüğünün saklanması: SOC 2 = 1 yıl, HIPAA = 6 yıl.

## Use It — Hazır Araçla Uygula

`code/main.py` , tutarlı bir tokenizasyona ve yalnızca eklemeli bir denetim günlüğüne sahip bir oyuncak PII temizleyici uygular.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-llm-security-plan.md` üretir. Düzenleyici kapsam ve mevcut durum göz önüne alındığında kasa geçişini, temizlemeyi, çıkışı ve denetim günlüğünü planlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Aynı SSN'ye atıfta bulunan iki prompt gönder. Her ikisinin de aynı yer tutucuyu aldığını doğrulayın.
2. OpenAI + Anthropic + Weaviate'i çağıran bir vLLM-on-EKS deployment için ağ çıkış politikasını tasarlayın.
3. Git geçmişinde (2 yıllık) bir anahtar keşfedersiniz. Doğru yanıt nedir: anahtarı döndürmek mi, geçmişi temizlemek mi, yoksa her ikisi mi? Savunmak.
4. Denetim günlüğünüz günde 10 GB büyür. Tutma katmanlarını tasarlayın (sıcak 30 gün, sıcak 12 ay, soğuk 6 yıl).
5. Yer tutucuları görünür tutmak yerine ters-tokenleştirmenin (gerçek değerleri LLM yanıtına geri koymanın) karmaşıklığa değip değmeyeceğini tartışın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kasa | "sırlar mağazası" | Merkezi kimlik bilgisi yönetimi hizmeti |
| IAM rolü | "kimlik tabanlı kimlik doğrulama" | Uygulamanın üstlendiği rol; kısa ömürlü kredileri döndürür |
| CI/CD için OIDC | "bulut tarafından sağlanan token'lar" | CI'da statik anahtar yok - OIDC aracılığıyla kimlik |
| TruffleHog / GitGuardian / Gitleaks | "gizli tarayıcılar" | Taahhüt anında gizli algılama |
| RBAC / ABAC | "erişim kontrolü" | Rol tabanlı ve nitelik tabanlı |
| PII temizleme | "veri maskeleme" | Hassas varlıkları kaldırın veya tokenözelleştirin |
| Tutarlı tokenizasyon | "kararlı yer tutucular" | Aynı değer → her seferinde aynı token |
| Örgü yaklaşımı | "Örgü tokenleştirme" | Anlamsallığı koruyan tokenoluşturma modeli |
| Çıkış beyaz listesi | "giden izin verilenler listesi" | Yalnızca izin verilen alan adlarına ulaşılabilir |
| Denetim günlüğü | "değişmez tarih" | Uyumluluk için yalnızca ekleme kaydı |

## Daha Fazla Okuma

- [Doppler — Gelişmiş Yüksek Lisans Güvenliği](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — LLM API anahtarlarını gizli referanslarla yönetin](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails En İyi Uygulamaları](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Sır Yönetimi En İyi Uygulamaları 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — Kişisel Bilgilerin tespiti ve anonimleştirilmesi.
- [HashiCorp Kasası belgeleri](https://developer.hashicorp.com/vault/docs)
