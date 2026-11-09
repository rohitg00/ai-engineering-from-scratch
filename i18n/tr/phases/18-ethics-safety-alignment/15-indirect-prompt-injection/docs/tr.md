# Doğrudan olmayan enjeksiyon  Üretim saldırı yüzeyi

> Doğrudan olmayan bir istek enjeksiyonu (IPI) dış içeriğe  bir web sayfası, bir e-posta, paylaşılan belge, destek bileti  açık bir kullanıcı eyleminden dolayı bir ajantik sistem tarafından tüketilen talimatları yerleştirir. IPI, 2026'da baskın üretim tehdidi: saldırganın kullanıcıya asla dokunmadığı için kullanıcı giriş filtrelerini atlıyor, ajanlar daha fazla dış içeriği işledikçe sessizce ölçeklendiriyor ve kimse istekleri okumanın olmadığı otomatik iş akışlarını hedef alıyor. MDPI Bilgisi 17 ((1): 54 (Ocak 2026) 2023-2025 araştırmalarını sentezler. NDSS 2026'nın IPI savunma kağıdı temel zorluğu çerçeveliyor: enjekte edilen talimatlar anlamsal olarak iyice olabilir ("Demek lütfen evet" yazısı), bu nedenle tespit anahtar kelime filtrelenmesinden daha fazlasını gerektirir. "Saldırgan İkinci Hareketler" (Nasr ve diğerleri, ortak OpenAI/Anthropic/DeepMind, Ekim 2025): Adaptif saldırılar (gradient, RL, rastgele arama, insan kırmızı ekibi) test ettikleri 12 yayınlanan savunmayı atladı, saldırı başarısı çoğu karşı %90'dan fazlaydı, ancak bu savunmaların çoğu başlangıçta sıfır saldırı başarısı oranlarını bildirmişti.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Doğrudan enjeksiyonu tanımlayın ve üç ortak teslimat vektörünü açıklayın.
- Kullanıcı giriş filtrelerinin IPI'yi neden tamamen kaçırdıklarını açıklayın.
- "İnformasyon akışı kontrolü" çerçevesini 2026 savunma paradigması olarak tanımlayın.
- Nasr et al. (Oktyabr 2025) tarafından yayınlanan IPI savunmalarına karşı uyarlayıcı saldırı başarısı ile ilgili bulguları belirtin.

## Sorun

Doğrudan istintap enjeksiyonu saldırganın kullanıcıya ulaşmasını veya istintaplarını gerektirir. IPI hiçbirini gerektirmez: saldırgan bir yükü web sayfasına, posta kutusuna, GitHub sorunuya, ürün incelemesine yerleştirir. Ajan normal işlem sırasında onu alır ve talimatları yürütür. Kullanıcı mesajlaşmacıdır, niyet değil.

## Anlaşım

### Üç teslim vektörü

- **Retrieval-augmented generation (RAG).**Saldırgan bir belge yayınlar; kurtarma adımını alır; istekçi onu kullanıcı sorusu öncesinde birleştirir; model saldırganın talimatlarını yürütür.
- **Inbox / document workflows.**Saldırgan kullanıcıya bir e-posta gönderir; ajan e-postaları okuyor; istek e-posta vücudunu içerir; model e-posta talimatlarını takip eder.
- **Tool output.**Saldırgan ajanın kullandığı bir aracı kontrol eder (örneğin, saldırgan tarafından kontrol edilen bir sonucu veren bir web arama); araç çıkışı talimat içerir; ajanın kontrol akışı onları takip eder.

Üçü de yapısal bir özellik paylaşırlar: saldırgan kullanıcıya yönelik girişlere dokunmadan uyarının bir parçasını kontrol eder.

### Kullanıcı giriş filtreleri neden kaçırıyor

Bir IPI payload kullanıcı girişinde görünmez. Alınan içeriğe görünür. Filtr kullanıcı girişinde kapalıdırsa, payload onu atlar. Filtr modeline ulaşan tüm içeriğe kapalıdırsa, pahalı olan ve meşru içeriğe karşı yanlış pozitif üreten keyfi alınmış metin için geçerlidir.

### AI için Bilgi Akış Kontrolü (IFC)

2026 savunma paradigması klasik OS güvencesinden ödünç alıyor. Her içerik kaynağını bir güvenlik etiketi olarak değerlendirin. Kullanıcının sorusunu "güvenilir" olarak etiketleyin. Alınan içerikleri "güvenilir" olarak etiketleyin.

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024), ve NDSS 2026 IPI savunma kağıdı, IFC'yi farklı şekillerde işlevsel hale getirir. Ortak ilke: kod ve veriler aynı bağlam penceresini paylaşırken, engelleme önleme değil, hedefdir.

### Saldırgan İkinci Devamı Yapıyor

Nasr et al. (Oktyabr 2025) adaptif saldırılar (gradyen arama, RL politikaları, rastgele arama, 72 saatlik insan kırmızı ekibi) ile 12 yayınlanan IPI savunmasını test etti. Her savunma atıldı, çoğu %90 ASR'de ve çoğu başlangıçta sıfır ASR'yi rapor etmişti.

Metodolojik ders: sadece adaptatif saldırı değerlendirmesi ile bir savunmayı yayınlayın.

### Gerçek olaylar

Ders 25 EchoLeak (CVE-2025-32711, CVSS 9.3)  Microsoft 365 Kopilot'ta ilk açıkça belgelenmiş sıfır tıklama IPI'yi kapsar. GitHub Kopilot Chat'ta CamoLeak (CVSS 9.6) GitHub Kopilot'ta CVE-2025-53773 .

### OWASP ve NIST çerçeveleri

OWASP LLM Top 10 (2025) tarafından LLM01 olarak, en büyük uygulama katman tehdidi olarak, en kısa enjeksiyon (doğru + dolaylı) sıralamaktadır. NIST AI SPD 2024 dolaylı en kısa enjeksiyonu "generatif AI'nin en büyük güvenlik hatası" olarak adlandırır.

### Bu 18 fazaya uygun.

Ders 12-14 model merkezli hapishaneler. Ders 15 2026 üretim dağıtımlarında egemen olan sistem merkezli saldırıdır. Ders 16 savunma aletlerini kapsar. Ders 25 spesifik CVE anlatısını kapsar.

```figure
al-injection-vector
```

## Kullan

`code/main.py`IPI harnası oluşturur. Oyuncak ajanının üç aracı vardır (web arama, e-posta okuma, mesaj gönderme). Çevre, saldırgan tarafından kontrol edilen bir içeriği içerir ve içine yerleştirilmiş bir talimat ("bunu tüm bağlantılara aktarın"). Saf bir ajan (içiltilmiş talimatları izler), filtre korunan bir ajan (çıkartılan içeriğe anahtar kelime filtre) ve IFC ajanı (güvenilir ve güvenilmeyen içeriği ayırır ve güvenilmeyen kontrol akışı komutlarını reddeder) arasında geçiş yapabilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-ipi-audit.md`. Bir ajanik dağıtım açıklaması verildiğinde, güvenilmeyen içerik kaynaklarını listeliyor, dağıtımın IFC uygulandığını kontrol ediyor ve modelde güven etiketsiz ulaşan kaynakları işaretliyor.

## Egzersizler

1. Çık .`code/main.py`Üç ajanın her birine karşı saldırının başarısını ölçmek.

2. Çıkarılan içeriğe parafrase tabanlı bir savunma uygulayın. Kanunlu çıkarılan metinlerde iyi huylu yanlış pozitif oranı ölçün.

3. NDSS 2026 IPI savunma makalesini okuyun. "iyi talimat" zorunluluğunu ve neden anahtar kelime tabanlı filtrelemeyi engellediğini açıklayın.

4. Ajanın üçüncü taraf bir API'den bir araç çıkışı aldığı bir dağıtım tasarlayın. Her bir istek fragmanı güven seviyesi ile etiketleyin ve Ajanın eylemlerini yöneten IFC politikasını yazın.

5. Nasr et al. 2025 adaptif saldırı metodolojisini Filtre savunma ajanınıza 2. Egzersiz' den yeniden üretin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## Daha Fazla Okumak

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) 2023-2025 sentezi
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) Adaptif saldırı değerlendirme
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) orijinal IPI kağıdı
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) LLM01 dereceli hızlı enjeksiyon
