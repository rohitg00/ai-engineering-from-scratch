# Uyumluluk — SOC 2, HIPAA, GDPR, PCI-DSS, AB AI Yasası, ISO 42001

> Çoklu-framework kapsamı, 2026 kurumsal anlaşmalar için masa bahisleridir. **AB AI Yasası**: 1 Ağustos 2024'ten beri yürürlükte. Yüksek risk gereksinimlerinin çoğu 2 Ağustos 2026'da yürürlüğe girecek. Yüksek riskli sistem yükümlülükleri için 15 milyon Euro'ya veya küresel yıllık cironun %3'üne kadar para cezaları (Mad. 99(4)); yasaklanmış AI uygulamaları için 35 milyon Euro'ya veya %7'ye kadar (Mad. 99(3)). AB kullanıcılarına hizmet veriliyorsa küresel olarak geçerlidir. **Colorado Yapay Zeka Yasası**: 30 Haziran 2026'dan itibaren geçerlidir (SB25B-004 tarafından Şubat 2026'dan itibaren ertelenmiştir) — yüksek riskli sistemler için etki değerlendirmeleri, yapay zeka kararlarına itiraz etme hakkı. Kredi/istihdam/konut/eğitim açısından Virginia benzer. **SOC 2 Tip II**: fiili B2B AI gereksinimi (fintech için Tip I değil, Tip II). **GDPR**: Clearview AI'ye karşı belgelenen en büyük yapay zekaya özel para cezası 30,5 milyon Euro'dur (Dutch DPA, Eylül 2024); İtalyan Garante, Aralık 2024'te OpenAI'ye karşı 15 milyon Euro ihraç etti (daha sonra Mart 2026'da temyiz üzerine bozuldu). inference adresindeki gerçek zamanlı PII redaksiyonu savunulabilir standarttır; İşlem sonrası temizleme yeterli değildir. **HIPAA**: sağlık hizmetlerine bağlı — BAA olmadan harici AI hizmetlerine PHI gönderilemez. **PCI-DSS**: Yapay zeka etkileşim katmanı kapsamı, otomatik değil, yapılandırma + sözleşmeye dayalı anlaşmalar gerektirir. **ISO 42001**: ortaya çıkan yapay zeka yönetişim standardı, ISO 27001 ile birlikte büyüyen satın alma gereksinimi. Referans profili: OpenAI, ChatGPT ödeme bileşenleri için SOC 2 Tip 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS'yi korur. Çapraz-framework eşleme denetim yorgunluğunu azaltır: ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Tür:** Öğren
**Diller:** (Python isteğe bağlıdır — uyumluluk politika + süreçtir, kod değildir)
**Önkoşullar:** Aşama 17 · 25 (Güvenlik), Aşama 17 · 13 (Observability)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Yüksek Lisans ürünleriyle alakalı yedi 2026 framework'yı numaralandırın ve her birini bir müşteri segmentiyle eşleştirin.
- AB AI Yasası uygulama zaman çizelgesini (Ağustos 2024'te yürürlükte; yüksek riskli uygulama Ağustos 2026) ve iki kademeli ceza tavanını (yüksek riskli yükümlülükler için 15 milyon Euro / %3, yasaklı uygulamalar için 35 milyon Euro / %7) belirtin.
- İşleme sonrası PII temizliğinin GDPR için neden yeterli olmadığını açıklayın ve savunulabilir standart olarak gerçek zamanlı inference katmanı düzenlemesini adlandırın.
- Çaprazframework kontrol eşlemesini açıklayın (e.g., ISO 27001 A.5.15-5.18 + GDPR Madde 32 + HIPAA §164.312(a)'ya göre erişim kontrolü eşlemeleri).

## Sorun

Kurumsal bir müşterinin satın alma işleminde SOC 2 Tip II, GDPR, HIPAA BAA, ISO 27001 ve "AB Yapay Zeka Yasası uyumluluk bildirimi" istenir. Ekibinizde SOC 2 Tip I var. Tip II'ye altı ay kaldı ve GDPR Madde 30 kayıtlarına başlamadınız.

Çoklu-framework kapsamı bir Yüksek Lisans sorunu değildir; bu, Yüksek Lisans'a özgü katmanlara sahip kurumsal bir SaaS sorunudur. 2026'daki tedarik ekipleri PDF yerine, framework başına satır ve kontrol başına sütun içeren bir matris istiyor.

## Konsept

### Yedi framework

| Framework | Kapsam | Yüksek Lisans'a özel gereksinim |
|-----------|-------|--------------------------|
| SOC 2 Tip II | B2B SaaS temeli | Proses kontrolleri 6-12 ay boyunca denetlendi |
| HIPAA | ABD sağlık | BAA gerekli; PHI anlaşma imzalamadan altyapıdan ayrılamaz |
| GDPR | AB kullanıcıları | Gerçek zamanlı PII redaksiyonu; veri sahibi hakları; Madde 30 kayıtları |
| PCI-DSS | Ödeme verileri | Ödemeye dokunan yapay zeka için yapılandırma + sözleşmeler |
| AB Yapay Zeka Yasası | AB kullanıcılarına hizmet | Risk katmanı sınıflandırması; yüksek riskli sistemler: uygunluk değerlendirmesi, belgeleme, kayıt tutma |
| Colorado Yapay Zeka Yasası | CO sakinlerine hizmet | Etki değerlendirmeleri; itiraz hakkı |
| ISO 42001 | yapay zeka yönetişimi | Ortaya çıkan; ISO 27001 ile çiftler |

### AB Yapay Zeka Yasası zaman çizelgesi

- 1 Ağustos 2024: yürürlükte.
- 2 Şubat 2025: Yasaklanan yapay zeka uygulamaları yürürlüğe girdi.
- 2 Ağustos 2026: Yüksek riskli sistemler zorunlu hale getirildi (uygunluk değerlendirmesi, dokümantasyon, kayıt altına alma).
- Ağustos 2027: uyumlaştırılmış mevzuat kapsamındaki ürünlerde yüksek riskli sistemler.

Risk katmanları: Kabul edilemez (yasaklı), Yüksek risk (uygunluk + günlük kaydı), Sınırlı risk (şeffaflık), Minimum risk (kısıtlama yok). B2B LLM SaaS'ın çoğu sınırlı risklidir; İstihdam, kredi, eğitim, kolluk kuvvetleri, göç ve temel hizmetler için yüksek risk devreye giriyor.

Para cezaları (Madde 99): yüksek riskli sistem yükümlülüklerinin ihlali nedeniyle 15 milyon Euro'ya kadar veya küresel yıllık cironun %3'üne kadar (Mad. 99(4)); yasaklanmış yapay zeka uygulamaları için 35 milyon Euro'ya veya %7'ye kadar (Mad. 99(3)); hangisi daha yüksekse geçerlidir.

### GDPR — gerçek zamanlı düzenleme standarttır

İşleme sonrası temizleme (LLM gördükten sonra PII'yi düzeltin) savunulabilir bir duruş değildir; model verileri zaten görmüştür. Gerçek zamanlı inference katmanı redaksiyonu 2026 standardıdır:

- LLM çağrısından önce varlık tanıma.
- Tutarlı tokenizasyon (Mesh yaklaşımı) anlambilimi korur.
- Yalnızca düzeltilmiş prompt'ları + izin verilen ham katılımı depolayın.

Son yaptırım: Clearview AI'ye karşı 30,5 milyon Euro (Hollanda DPA, Eylül 2024), bugüne kadar AI'ya özgü belgelenmiş en büyük GDPR cezasıdır; OpenAI'ye karşı 15 milyon avro (İtalya'nın Garante'si, Aralık 2024), LLM'ye özel en büyük para cezası olmasına rağmen Mart 2026'da temyizde bozuldu ve karar daha fazla inceleme altında. İşlem sonrası talepler denetimde başarısız oldu.

### HIPAA — BAA isteğe bağlı değildir

İmzalı bir İş Ortaklığı Anlaşması olmadan PHI'yı harici AI hizmetlerine gönderemezsiniz. Hiper ölçekleyici LLM platformlarının üçü de (Bedrock, Azure OpenAI, Vertex) BAA'lar sunuyor. OpenAI doğrudan API'si BAA sunar. Antropik doğrudan API, BAA'yı sunar. PHI'yi göndermeden önce onaylayın.

### SOC 2 Tip II

Tip I: tasarlanan ve belgelenen kontroller.
Tip II: Kontroller 6-12 ay boyunca etkili bir şekilde çalışır.

2026'da B2B satın alma varsayılan olarak Tip II'ye geçecektir. Tip I bir başlangıçtır; Tip II kapıdır.

Yaygın denetim etkenleri: erişim günlükleri (kim neyi gördü), değişiklik yönetimi (nasıl uygulandı), risk değerlendirmeleri (üç ayda bir), olay müdahalesi (test edildi mi?). Aşama 17 · 25'teki denetim günlüğü doğrudan yeniden kullanılabilir.

### Çaprazframework eşleme

Bir erişim kontrolü politikası birden fazla framework kontrolünü karşılar:

| Kontrol | Frameworks |
|---------|-----------|
| Günlüğe erişim | ISO 27001 A.5.15-5.18, GDPR Md. 32, HIPAA §164.312(a) |
| Yönetim değişikliği | ISO 27001 A.8.32, PCI DSS Gerekliliği. 6, HIPAA ihlal bildirimi kapsamı |
| Aktarım sırasında şifreleme | ISO 27001 A.8.24, GDPR Md. 32, HIPAA §164.312(e) |
| Sırlar yönetimi | ISO 27001 A.8.19, PCI DSS Gerekliliği. 8, SOC 2 CC6.1 |

Uyumluluk araçları (Drata, Vanta, Secureframe) bu eşlemeyi otomatikleştirir. Büyük ölçekte maliyete değer.

### ISO 42001 — ortaya çıkıyor

2023'ün sonlarında yayınlandı. ISO 27001'in yanı sıra artan satın alma gereksinimi. Risk yönetimi, veri kalitesi, şeffaflık, insan gözetimi de dahil olmak üzere yapay zeka yönetişimi için Framework.

### OpenAI'nin referans profili

OpenAI, ChatGPT ödeme bileşenleri için SOC 2 Tip 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS'yi korur. Bu, kabaca 2026'daki kurumsal tablonun riskleri.

### Hatırlamanız gereken sayılar

- AB Yapay Zeka Yasası para cezaları: 15 milyon Avro / %3'e kadar (yüksek riskli yükümlülükler, Madde 99(4)); 35 milyon Avro / %7'ye kadar (yasaklı uygulamalar, Madde 99(3)).
- AB Yapay Zeka Yasasının yüksek risk uygulaması: 2 Ağustos 2026.
- AI'ya özgü belgelenen en büyük GDPR cezası: 30,5 milyon Euro, Clearview AI (Dutch DPA, Eylül 2024).
- Yüksek Lisans'a özel en büyük GDPR cezası: 15 milyon Euro, OpenAI (İtalya'nın Garante'si, Aralık 2024; Mart 2026'da temyiz üzerine bozuldu).
- SOC 2 Tip II penceresi: 6-12 aylık kontrollerin çalıştırılması.
- Colorado AI Yasası yürürlük tarihi: 30 Haziran 2026 (SB25B-004 tarafından Şubat 2026'dan ertelendi).

## Use It — Hazır Araçla Uygula

`code/main.py` , Python'da bir uyumluluk eşleme e-tablosudur; bir kontrol verildiğinde, karşıladığı framework'lerı listeler.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-compliance-matrix.md` üretir. Müşteri segmenti ve coğrafya dikkate alındığında gerekli framework'leri ve kontrolleri belirtir.

## Egzersizler

1. İlk kurumsal müşteriniz SOC 2 Tip II, HIPAA BAA, AB AI Yasası beyanına ihtiyaç duyar. Anlaşmayı kazanmak için geçerli minimum uyumluluk duruşu nedir?
2. Üç varsayımsal LLM ürününü AB Yapay Zeka Yasası risk katmanları kapsamında sınıflandırın. Yüksek riskte ne gibi değişiklikler olur?
3. Yanlışlıkla PHI'yı BAA'sı olmayan bir sağlayıcıya gönderdiniz. Olay müdahalesini gözden geçirin.
4. Orta ölçekli bir yapay zeka tedarikçisi için ISO 42001'in "2026'da gerekli" olup olmadığını tartışın.
5. LLM denetim günlüğü alanlarınızı (Aşama 17 · 25) en az üç framework kontrolüyle eşleştirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| SOC 2 Tip II | "denetlenen kontroller" | 6-12 ay boyunca çalışan kontroller, bağımsız olarak onaylanmıştır |
| HIPAA BAA | "sağlık sözleşmesi" | İş Ortaklığı Anlaşması; PHI için gerekli |
| GDPR | "AB gizliliği" | Gerçek zamanlı PII redaksiyonu savunulabilir 2026 standardıdır |
| AB Yapay Zeka Yasası | "AB AI kuralları" | Yüksek riskli yaptırım Ağustos 2026; 15 Milyon Avro / %3 (yüksek riskli yükümlülükler) — 35 Milyon Avro / %7 (yasaklanmış uygulamalar) |
| Colorado Yapay Zeka Yasası | "ABD Yapay Zeka Eyalet Yasası" | 30 Haziran 2026'dan itibaren geçerli (SB25B-004 nedeniyle ertelendi); etki değerlendirmeleri |
| ISO 42001 | "Yapay zeka yönetişimi" | Yapay zeka riski + şeffaflık için ortaya çıkan framework |
| ISO 27001 | "güvenlik BGYS'si" | Bilgi Güvenliği Yönetim Sistemi temeli |
| Uygunluk değerlendirmesi | "AB AI belge paketi" | Yüksek risk gereksinimi: belgeler, test etme, günlük kaydı |
| Çapraz-framework eşleme | "tek kontrol, birçok çerçeve" | Tek politika birden fazla framework kontrolünü karşılar |

## Daha Fazla Okuma

- [OpenAI Güvenliği ve Gizliliği](https://openai.com/security-and-privacy/) — uyumluluk profiline bakın.
- [GuardionAI — Yüksek Lisans Uyumluluğu 2026: ISO 42001, AB AI Yasası, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Tip 2 Denetim Kılavuzu 2026: 10 Yapay Zeka Kontrolü](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [AB AI Yasası resmi metni](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — birincil kaynak.
- [Colorado AI Yasası](https://leg.colorado.gov/bills/sb24-205) — birincil kaynak.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — Yapay zeka yönetim sistemi standardı.
