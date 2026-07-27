# Dolaylı Prompt Enjeksiyon — Üretim Saldırı Yüzeyi

> Dolaylı prompt enjeksiyonu (IPI), talimatları açık bir kullanıcı eylemi olmadan bir agentic sistemi tarafından tüketilen harici içeriğin (bir web sayfası, bir e-posta, paylaşılan bir belge, bir destek bileti) içine yerleştirir. IPI, 2026'nın en önemli üretim tehdididir: Saldırgan kullanıcıya asla dokunmadığı için kullanıcı giriş filtrelerini atlar, agent daha fazla harici içerik işledikçe sessizce ölçeklenir ve kimsenin prompt okumadığı otomatik iş akışlarını hedefler. MDPI Bilgisi 17(1):54 (Ocak 2026), 2023-2025 araştırmasını sentezlemektedir. NDSS 2026'nın IPI savunma makalesi temel zorluğu çerçeveliyor: enjekte edilen talimatlar anlamsal olarak zararsız olabilir ("lütfen Evet yazdırın"), dolayısıyla tespit, anahtar kelime filtrelemesinden daha fazlasını gerektirir. "Saldırgan İkinci Hareket Ediyor" (Nasr ve diğerleri, ortak OpenAI/Anthropic/DeepMind, Ekim 2025): uyarlanabilir saldırılar (gradient, RL, rastgele arama, insan kırmızı takımı), başlangıçta sıfıra yakın saldırı başarı oranları bildiren yayınlanmış 12 savunmanın >%90'ını kırdı.

**Tür:** Yapım
**Diller:** Python (stdlib, IPI saldırısı + savunma donanımı)
**Önkoşullar:** Aşama 18 · 12 (PAIR), Aşama 14 (agent mühendislik)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Dolaylı prompt enjeksiyonunu tanımlayın ve üç ortak dağıtım vektörünü tanımlayın.
- Kullanıcı giriş filtrelerinin neden IPI'yi tamamen kaçırdığını açıklayın.
- "Bilgi akışı kontrolü" çerçevesini 2026 savunma paradigması olarak tanımlayın.
- Nasr ve ark.'nın bulgusunu belirtin. (Ekim 2025) yayınlanan IPI savunmalarına karşı uyarlanabilir saldırı başarısı üzerine.

## Sorun

Doğrudan prompt enjeksiyonu, saldırganın kullanıcıya veya onun prompt'sine ulaşmasını gerektirir. IPI bunların ikisini de gerektirmez: Saldırgan, agent'ın okuyabileceği herhangi bir içeriğe (bir web sayfası, gelen kutusundaki bir e-posta, bir GitHub sorunu, bir ürün incelemesi) bir veri yükü yerleştirir. agent normal çalışma sırasında onu alır ve talimatları yürütür. Kullanıcı elçidir, amaç değil.

## Konsept

### Üç teslimat vektörü

- **Retrieval-augmented generation (RAG).** Saldırgan bir belge yayınlar; geri alma adımı onu getirir; prompt onu kullanıcı sorusundan önce birleştirir; model saldırganın talimatlarını yerine getirir.
- **Gelen kutusu/belge iş akışları.** Saldırgan kullanıcıya bir e-posta gönderir; agent e-postaları okur; prompt e-posta gövdesini içerir; model e-postanın talimatlarını takip eder.
- **Araç çıkışı.** Saldırgan, agent'ın kullandığı bir aracı kontrol eder (e.g., saldırgan tarafından kontrol edilen bir sonuç döndüren bir web araması); araç çıktısı talimatlar içerir; agent'ın kontrol akışı onları takip eder.

Üçü yapısal bir özelliği paylaşıyor: Saldırgan, kullanıcının karşılaştığı girişe dokunmadan prompt'nın bir parçasını kontrol ediyor.

### Kullanıcı giriş filtreleri bunu neden kaçırıyor?

Kullanıcının girişinde bir IPI verisi görünmüyor. Alınan içerikte görünür. Filtre kullanıcı girişine bağlıysa yük onu atlar. Filtre, modele ulaşan tüm içeriğe kapalıysa, keyfi olarak alınan metne uygulanması gerekir; bu pahalıdır ve emir kipi dili içeren meşru içeriğe karşı yanlış pozitifler üretir.

### Yapay Zeka için Bilgi Akışı Kontrolü (IFC)

2026 savunma paradigması klasik işletim sistemi güvenliğinden ilham alıyor. Her içerik kaynağına bir güvenlik etiketi olarak davranın. Kullanıcının sorgusunu "güvenilir" olarak etiketleyin. Alınan içeriği "güvenilmez" olarak etiketleyin. Modelin kontrol akışını bir bilgi akışı olarak ele alın: Güvenilmeyen içerik tarafından tetiklenen eylemlerin, yürütülmeden önce güvenilir giriş tarafından onaylanması gerekir.

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024) ve NDSS 2026 IPI savunma belgesi, IFC'yi farklı şekillerde operasyonel hale getiriyor. Ortak prensip: Kod ve veri aynı context window'yı paylaştığı sürece amaç önleme değil, kontrol altına almadır.

### Saldırgan İkinci Hamleyi Yapıyor

Nasr ve ark. (Ekim 2025), yayınlanmış 12 IPI savunmasını uyarlanabilir saldırılarla (gradient arama, RL politikaları, rastgele arama, 72 saatlik insan kırmızı takımı) test etti. Başlangıçta sıfıra yakın ASR bildiren her savunma, >%90 ASR'ye kırıldı.

Metodolojik ders: yalnızca uyarlanabilir saldırı değerlendirmesiyle bir savunma yayınlayın. Statik saldırı benchmark'lar sağlamlığın kanıtı değildir; Saldırgan savunmayı tanır.

### Gerçek olaylar

25. Ders, Microsoft 365 Copilot'ta genel olarak belgelenen ilk sıfır tıklamalı IPI olan EchoLeak'i (CVE-2025-32711, CVSS 9.3) kapsar. GitHub Copilot Sohbetinde CamoLeak (CVSS 9.6). GitHub Copilot'ta CVE-2025-53773. Üretim deployment'ler, yalnızca benchmark'larda değil, sahadaki IPI tarafından tehlikeye atılıyor.

### OWASP ve NIST çerçeveleme

OWASP LLM Top 10 (2025), prompt enjeksiyonunu (doğrudan + dolaylı) 1 numaralı uygulama katmanı tehdidi olan LLM01 olarak sıralıyor. NIST AI SPD 2024, dolaylı prompt enjeksiyonu "üretken yapay zekanın en büyük güvenlik kusuru" olarak adlandırıyor.

### Bunun 18. Aşamada yeri nedir

12-14. dersler model merkezli jailbreak'lerdir. Ders 15, 2026 üretim deployment'lerine hakim olan sistem merkezli saldırıdır. Ders 16 savunma takımlarını kapsar. Ders 25 spesifik CVE anlatımını kapsar.

## Use It — Hazır Araçla Uygula

`code/main.py` bir IPI koşum takımı oluşturur. Bir agent oyuncağının üç aracı vardır (web'de arama yapma, e-posta okuma, mesaj gönderme). Ortamda, yerleşik bir talimat ("bunu tüm kişilere ilet") içeren, saldırgan tarafından kontrol edilen içerik bulunmaktadır. Saf bir agent (enjekte edilen talimatları takip eder), filtre korumalı bir agent (alınan içerikteki anahtar kelime filtresi) ve bir IFC agent (güvenilen ve güvenilmeyen içeriği ayırır ve güvenilmeyen kontrol akışı komutlarını reddeder) arasında geçiş yapabilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-ipi-audit.md` üretir. Bir agentic deployment açıklaması verildiğinde, güvenilmeyen içerik kaynaklarını numaralandırır, deployment'nin IFC'yi uygulayıp uygulamadığını kontrol eder ve güven etiketi olmadan modele ulaşan kaynakları işaretler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Üç agent'ın her birine yönelik saldırının başarı oranını ölçün.

2. Alınan içeriğe ilişkin açıklama tabanlı bir savunma uygulayın. Yasal olarak alınan metindeki zararsız yanlış pozitif oranını ölçün.

3. NDSS 2026 IPI savunma belgesini okuyun. "İyi huylu talimat" sorununu ve bunun anahtar kelimeye dayalı filtrelemeyi neden engellediğini açıklayın.

4. agent'ın üçüncü taraf bir API'den araç çıktısı aldığı bir deployment tasarlayın. Her prompt parçasını bir güven düzeyiyle etiketleyin ve agent'ın eylemlerini yöneten IFC politikasını yazın.

5. Nasr ve ark. Alıştırma 2'deki filtre korumalı agent cihazınızda 2025 uyarlanabilir saldırı metodolojisi. Uyarlanabilir saldırıdan önce ve sonra ASR'yi rapor edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| IPI | "dolaylı prompt enjeksiyon" | Normal çalışma sırasında agent tarafından tüketilen, kullanıcının yazmadığı içerik yoluyla enjeksiyon |
| RAG enjeksiyonu | "zehirli geri alma" | Saldırgan, alma adımının getirdiği içeriği yayınlar; prompt yükü içerir |
| Sıfır tıklama | "kullanıcı eylemi yok" | Saldırı, agent işlemi sırasında otomatik olarak tetiklenir; kullanıcı hiçbir şey yapmıyor |
| IFC | "bilgi akışı kontrolü" | Etiket tabanlı yaklaşım: güvenilmeyen içerikten kaynaklanan eylemler güvenilir onay gerektirir |
| Uyarlanabilir saldırı | "gradient / RL kırmızı takım" | Savunmayı bilen ve ona karşı optimizasyon yapan saldırı; dürüst değerlendirme için gereklidir |
| İyi huylu talimat | "lütfen Evet yazdırın" | Anlamsal olarak zararsız olan IPI yükü; hiçbir anahtar kelime filtresi onu yakalayamıyor |
| Kapsam ihlali | "çapraz güven sızıntısı" | Agent, bir güven bağlamındaki verilere erişir ve onu diğerine gönderir |

## Daha Fazla Okuma

- [MDPI Bilgileri 17(1):54 — Dolaylı Prompt Enjeksiyon Araştırması (Ocak 2026)](https://www.mdpi.com/2078-2489/17/1/54) — 2023-2025 sentezi
- [Nasr ve ark. — Saldırgan İkinci Hareket Ediyor (OpenAI/Anthropic/DeepMind ortak, Ekim 2025)](https://arxiv.org/abs/2510.18108) — uyarlanabilir saldırı değerlendirmesi
- [Greshake ve ark. — Kaydolduğunuz şey değil (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) — orijinal IPI belgesi
- [OWASP — Yüksek Lisans İlk 10 (2025)](https://genai.owasp.org/llm-top-10/) — prompt enjeksiyon sıralaması LLM01
