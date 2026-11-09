# Yönetimsel çerçeveler  AB, ABD, İngiltere, Kore

> Dört ana düzenleyici rejim 2026 Yapay zeka yönetimi manzarasını tanımlar. AB AI Yasası (1 Ağustos 2024)  2 Şubat 2025'ten itibaren yasak uygulamalar ve AI bilgisliliği; 2 Ağustos 2025'ten itibaren GPAI yükümlülükleri; tam uygulanabilirlik ve 50 Maddesi 2 Ağustos 2026'da şeffaflık; miras alınan GPAI ve yerleşik yüksek riskli sistemler 2 Ağustos 2027; 15 milyon EUR'ye kadar veya küresel döviz miktarının% 3'üne kadar cezalar. GPAI Uygulama Kodu (10 Temmuz 2025): üç bölüm  Şeffaflık, Telif Hakları, Güvenlik ve Güvenlik  12 taahhüt; uygulanma Ağustos 2026'da başlar. UK AISI -> AI Güvenlik Enstitüsü (Şubat 2025): isim değiştirme sinyalleri daha dar bir kapsamda. ABD AISI -> CAISI (Haziran 2025): NIST'in altındaki AI Standartları ve Yenilikleri Merkezi; büyüme destekleyen bir duruşa doğru geçiş. Koreli AI Çerçeve Yasası (Aralık 2024'te kabul edildi, Ocak 2026'da yürürlüğe girdi): Madde 12 MSIT'de AISI'yi kurar; yabancı AI şirketleri için yerel temsilcileri, risk değerlendirmesini, yüksek etkisi ve üretken AI için güvenlik önlemlerini görevlendirir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- AB AI Yasası risk seviyelerini (yasaklanmış, yüksek riskli, genel amaçlı, sınırlı riskli) ve Ağustos 2025 / Ağustos 2026 / Ağustos 2027 zaman çizelgesini açıklayın.
- GPAI Uygulama Kodu'nun üç bölümünü ve her bir sağlayıcıyı hangi bölümlerle bağlayanı açıklayın.
- 2025'te yeniden markalar tanımlayın: UK AISI -> AI Security Institute; US AISI -> CAISI; her bir yeniden marka politika yönü hakkında neyi içerir.
- Kore'nin AI Çerçeve Yasasının temel hükümlerini belirtin.

## Sorun

Laboratuvar çerçeveleri (Desin 18) gönüllüdür. Yönetim çerçeveleri zorunludur. 2024-2026 döneminde kapsamlı AI düzenlemesinin ilk dalgası yürürlüğe girdi. Deployerler teknik kontrolleri düzenleyici yükümlülüklere haritası yapmalıdır. Haritalama yargı yetkisine göre farklıdır.

## Anlaşım

### AB AI Yasası

**In force 1 August 2024.**Risk seviyesindeki yapı:

- **Prohibited practices**(Maddesi 5) Sosyal puanlama, gerçek zamanlı uzaktan kamuya ait biometrik kimlik tespiti (yasa uygulama istisnaları hariç), savunmasız grupların sömürüsel manipülasyonu. 2 Şubat 2025'te uygulanmıştır.
- **High-risk systems**(İlişki III). İş, eğitim, kredi, kanun uygulama, adalet, göç.
- **General-Purpose AI (GPAI) models**. 2 Ağustos 2025'te uygulanır. Tüm GPAI sağlayıcılarının yükümlülükleri vardır; sistemik risk GPAI (> 1e25 FLOP eğitim hesaplama) ek yükümlülüklere sahiptir.
- **Limited-risk systems**- 50 (AI üretilen içerik etiketlemesi) maddesine göre şeffaflık yükümlülükleri. 2 Ağustos 2026'da uygulanır.

Zaman çizelgesi:
- 2 Şubat 2025: yasak uygulamalar + Yapay zeka bilgisliliği.
- 2 Ağustos 2025: GSYİH + yönetim.
- 2 Ağustos 2026: Tam uygulanabilirlik + 50 Maddesi şeffaflık + 15 milyon EUR /% 3 küresel döviz oranı kadar cezalar.
- 2 Ağustos 2027: miras GPAI + yerleşik yüksek risk.

Bu nedenle, yüksek riskli bir süreyi 2025'in sonuna kadar 16 aya ayarlamak için bir öneride bulunmuştur.

### GPAI Uygulama Kodu

10 Temmuz 2025'te yayınlandı.

- **Transparency.**Tüm GPAI sağlayıcıları.
- **Copyright.**Tüm GPAI sağlayıcıları.
- **Safety and Security.**Sistemik risk GPAI sağlayıcıları (sayılan 5-15 şirket).

Toplam 12 taahhüt. AI Ofisi tarafından başkanlık edilen İmzalatçı Görev Forması uygulamayı yönetir. Uygulama 2 Ağustos 2026'da başlar; o zamana kadar, iyi niyetle uyumluluk kabul edilir.

### 50. Madde Açıklık Kodu

İlk taslak 17 Aralık 2025. İkinci taslak Mart 2026. Son versiyonu Haziran 2026. Deepfakes dahil AI üretilen içerik etiketlemesini kapsar  Ders 23'ün su işaretleme teknolojisini gerektiren düzenleyici katman.

### İngiltere AI Güvenlik Enstitüsü (Şubat 2025)

Yeni adı AI Güvenlik Enstitüsü'nden değiştirilmiştir. Yeniden marka alanını daraltıyor: algoritmik tarafsızlığı ve konuşma özgürlüğü çerçevelerini düşürüyor; sınır kapasitesi güvenliği üzerine odaklanıyor. Açık kaynaklı İnspect değerlendirme aracı (Mayıs 2024) . Kontrol güvenlik vakalarında Redwood (Desin 10) ile işbirliği yapıyor.

### ABD CAISI (Haziran 2025)

Trump yönetimi NIST'in AI Güvenlik Enstitüsü'nü, "İli Standartlar ve Yenilikler Merkezi"ne dönüştürüyor. VP Vance'in Paris AI Eylem Zirvesi görüşmelerine göre "Gelişme yanlısı AI politikalarına" yöneldi. Deployment öncesi değerlendirme üzerinde az bir vurgu; standartlara ve yenilik desteğine önem verdi. AB AI Yasasının düzenleyici duruşuna yerel karşı ağırlık.

### Koreli Yapay zeka Çerçeve Yasası

Aralık 2024'te kabul edildi. Ocak 2025'te yürürlüğe girdi. Ocak 2026'da yürürlüğe girdi. 19 ayrı AI tasarısı birleştirildi.

Madde 12 Bilim ve İKT Bakanlığı (MSIT) altında bir AISI kurar.
- Kore'de faaliyet gösteren yabancı AI şirketlerinin yerel temsilcileri.
- "Yüksek Etki" AI sistemleri için risk değerlendirme.
- Yüklü Yapay zeka ve yüksek etkili Yapay zeka için güvenlik önlemleri.

Açık bir yatay AI düzenlemesi olan ilk Asya yargı yetkisi.

### Yurtlar arası dinamikler

- AB: Katı, riskli ve ağır cezalar.
- ABD: yeniliklere yönelik, merkezi olmayan eyaletler (örneğin, California AB 2013  Ders 27) federal boşlukları dolduruyor.
- Birleşik Krallık: Sık güvenlik odaklılık, güçlü değerlendirme altyapısı.
- Kore: MSIT tarafından yönetilen, yabancı sağlayıcı odaklı.

Rekabetçi düzenleyici felsefeler. Çoklu yargı alanlarında yerleştiriciler en sıkı olanına uymalıdır, bu da 2026 yılında tipik olarak AB AI Yasasıdır.

### Bu 18 fazaya uygun.

Ders 18 laboratuvar gönüllü yönetimdir; Ders 24 düzenleyici; Ders 25 AI sistemleri için gelişen bir CVE sınıfıdır; Ders 26-27 belgeler (kartlar) ve eğitim veri yönetimi kapsamaktadır.

```figure
an-eu-act-timeline
```

## Kullan

İttifak Kurulu'nun temel kaynaklarını okuyun: düzenleme metni, GPAI uygulama kuralları, İngiltere AISI İnspeksiyon çerçevesini.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-regulatory-map.md`- Bir görev tanımını göz önünde bulundurarak, uygulanabilir yargı alanlarını, her bir sınıflandırmanın seviyesini, yargı alanına ilişkin yükümlülükleri ve tarih yapısını haritalar.

## Egzersizler

1. AB AI Yasası (regulasyon 2024/1689) ve GPAI Uygulama Kodu (10 Temmuz 2025) okuyun.

2. Bir ABD şirketi tarafından dağıtılan bir uygulama, AB altyapısında çalışmaktadır ve Kore kullanıcılarına hizmet vermektedir. Hangi üç yargı yetkisi kuralları uygulanır ve hangi kural her maddi soruya bağlanır?

3. İngiltere AI Güvenlik Enstitüsü'nün yeniden adlandırılması kapsamı daraltıyor. Daha dar çerçeveleme karşı ve karşı savunuyorlar. Her pozisyonun bağlı olduğu politika varsayımını belirleyin.

4. CAISI'nin "çeşitme yanlısı" çerçevesinde, 2022-2024 AI güvenlik enstitüsü modelinden bir ayrım bulunmaktadır. Bu çerçevenin ardından gelecek iki ölçülebilir politika değişikliğini belirleyin.

5. Kore'nin AI Çerçeve Yasası, yabancı sağlayıcılar için yerel temsilcileri gerektiriyor. Koreli kullanıcılara hizmet veren bir Körfez Bölgesi şirketi için operasyonel etkileri anlatın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | Risk-tier-based horizontal AI regulation; in force Aug 2024 |
| GPAI | "general-purpose AI" | Large foundation models; systemic-risk subset has additional obligations |
| Article 50 | "transparency obligations" | AI-generated content labelling; applies Aug 2026 |
| UK AISI | "AI Security Institute" | Renamed Feb 2025; narrower frontier-security focus |
| CAISI | "US center for AI standards" | Renamed Jun 2025 from AI Safety Institute; pro-growth posture |
| Korean AI Framework Act | "MSIT horizontal regulation" | First Asian comprehensive AI law; effective Jan 2026 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | Additional obligations tier; estimated 5-15 companies bound |

## Daha Fazla Okumak

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) düzenleme ve zaman çizelgesi
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) Üç bölümlü kod
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute) Resmi sayfa
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) Kore çerçeve analizi
