# Uyum  SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Yasası, ISO 42001

> Çoklu çerçeve kapsamı, 2026 kurumsal anlaşmalar için masanın bahisidir. **EU AI Act**• 1. Ağustos 2024'ten bu yana yürürlüğe giren yüksek riskli gereksinimlerin çoğu 2 Ağustos 2026'da yürürlüğe girer. Yüksek riskli sistem yükümlülükleri için 15 milyon Euro'ya veya% 3'e kadar küresel yıllık döviz cezası (Maddesi 99(4); yasaklı AI uygulamaları için 35 milyon Euro'ya veya% 7'e kadar (Maddesi 99(3)).**Colorado AI Act**: 30 Haziran 2026'da yürürlüğe girer (Febre 2026'dan sonra SB25B-004 tarafından ertelenir)  Yüksek riskli sistemler için etki değerlendirmeleri, Yapay zeka kararlarına itiraz etme hakkı.**SOC 2 Type II**: gerçekte B2B AI gereksinimleri (fintech için II tip, I tip değil). **GDPR**Bu nedenle, bu durumun bir sonraki döneminde, bu durumun daha da kötüye gittiğini belirten bir durum olarak görülebilir.**HIPAA**: sağlık hizmetleri bağlanmış  BAA olmadan PHI'yi dış AI hizmetlerine gönderemez. **PCI-DSS**: AI etkileşim katman kapsamı otomatik değil, yapılandırma + sözleşme anlaşmaları gerektirir. **ISO 42001**Açıklama profil: OpenAI SOC 2 Tipi 2'yi sürdürüyor, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, ChatGPT ödeme bileşenleri için PCI-DSS. Çapraz haritalama denetim yorgunluğunu azaltır: ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312 ((a) boyunca erişim kontrolleri haritası.

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- LLM ürünleri için ilgili yedi 2026 çerçevesini listeleyin ve her biri bir müşteri segmentine eşleşsin.
- AB AI Yasası'nın uygulanması için zaman çizelgesini (Ağustos 2024; Yüksek Riskli uygulanma Ağustos 2026) ve iki katlı para cezası (yüksek riskli yükümlülükler için 15 milyon € / 3% ve yasak uygulamalar için 35 milyon € / 7%) belirtin.
- İşlem sonrası PII temizlemesinin GDPR için neden yeterli olmadığını açıklayın ve savunulabilir standart olarak gerçek zamanlı sonuç katman redaksiyonunu adlandırın.
- Çapraz kontrol haritasını açıklayın (örneğin, ISO 27001 A.5.15-5.18 + GDPR 32 + HIPAA §164.312 ((a)) için erişim kontrol haritası).

## Sorun

Bir kurumsal müşteri satın alma SOC 2 Tipi II, GDPR, HIPAA BAA, ISO 27001 ve "EU AI Yasası uyumluluk açıklaması" için talep eder.

Çoklu çerçeve kapsamı bir LLM sorunu değil  bu bir kurumsal-SaaS sorunu, LLM-specifik üstlenmeleri ile. 2026'da tedarik ekipleri bir çerçeve için bir satır ve kontrol için bir sütun ile bir matris istiyor, PDF değil.

## Anlaşım

### Yedi çerçeve

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### AB AI Yasası Zaman çizelgesi

- 1 Ağustos 2024: yürürlüğe girer.
- 2 Şubat 2025: Yasaklı Yapay Bilgi uygulamaları uygulanıyor.
- 2 Ağustos 2026: Yüksek riskli sistemler uygulanmıştır ( uyumluluk değerlendirmesi, belgeleme, kayıtlama).
- Ağustos 2027: uyumlu bir yasa çerçevesinde ürünlerde yüksek riskli sistemler.

Risk seviyeleri: Kabul edilemez (yasaklanmış), Yüksek risk ( uyumluluk + kayıt), Sınırlı risk (şeffaflık), Asgari risk (boşluk yoktur). Çoğu B2B LLM SaaS sınırlı risklidir; istihdam, kredi, eğitim, kanun uygulama, göç, temel hizmetler için yüksek riskli bir fırtına.

Cezalar (Maddesi 99): Yüksek riskli sistem yükümlülüklerinin ihlal edilmesi için 15 milyon Euro'ya veya% 3'lik küresel yıllık döviz (Maddesi 99(4); yasaklanmış AI uygulamaları için 35 milyon Euro'ya veya% 7'ye kadar (Maddesi 99(3)); hangisi daha yüksek olursa olsun.

### GDPR  Gerçek zamanlı düzenleme standarttır

İşlem sonrası temizlik (LLM'nin gördüğünden sonra PII'yi yeniden düzenle) savunulabilir bir duruş değildir.

- LLM çağrısı öncesi kuruluş tanınması.
- Düzgün bir işaretleme (Mesh yaklaşımı) semantikayı korur.
- Sadece düzenlenmiş çağrıları + onaylanmış seçme hamı saklayın.

Son uygulanma: Clearview AI'ye karşı 30.5 milyon € (Hollanda DPA, Eylül 2024) bugüne kadar belgelenmiş en büyük AI-spesifik GDPR cezası; OpenAI'ye karşı 15 milyon € (İtalya'nın Garante, Aralık 2024) en büyük LLM-spesifik cezası, ancak Mart 2026'da itiraz ile iptal edildi ve karar daha fazla inceleme altında kalıyor.

### HIPAA  BAA seçmeli değil

İşletme Ortaklığı Sözleşmesi imzalansak, PHI'yi dış AI hizmetlerine gönderemezsiniz. Üç hiperkaler LLM platformu (Bedrock, Azure OpenAI, Vertex) BAA'ları sunar. OpenAI doğrudan API BAA'yı sunar. Anthropic doğrudan API BAA'yı sunar. PHI göndermeden önce onaylayın.

### SOC 2 II tip

Tip I: tasarlanmış ve belgelenmiş kontrol cihazları.
Tip II: kontroller 6-12 ay boyunca etkili şekilde çalışır.

2026'da B2B satın almaları Tip II'ye kayıp. Tip I bir başlangıçtır; Tip II kapıdır.

Genel denetim sürücüleri: erişim kayıtları (neyi kim gördü), değişiklik yönetimi (nasıl uygulandı), risk değerlendirme (törtümlük), olay tepkisi (test edildi)?

### Çerçeve çaplı haritalama

Bir erişim kontrol politikası birden fazla çerçeve kontrolünü karşılar:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Uyum araçları (Drata, Vanta, Secureframe) bu haritayı otomatikleştirir.

### ISO 42001  ortaya çıkıyor

2023'ün sonlarında yayınlanan. ISO 27001 ile birlikte artan satın alma gereksinimleri. Risk yönetimi, veri kalitesi, şeffaflık, insan denetimi dahil olmak üzere AI yönetimi çerçevesini.

### OpenAI'nin referans profili

OpenAI, SOC 2 Tipi 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, ChatGPT ödeme bileşenleri için PCI-DSS'i sürdürüyor.

### Hatırlamalısın numaralar

- AB AI Yasası cezası: 15M € / 3%'a kadar (yüksek riskli yükümlülükler, 99 (4)); 35M € / 7%'e kadar (yasaklanmış uygulamalar, 99 (3)).
- AB Yapay zeka Yasası yüksek riskli uygulanması: 2 Ağustos 2026.
- En büyük belgelenmiş AI-specifik GDPR cezası: €30.5M, Clearview AI (Hollanda DPA, Eylül 2024).
- En büyük LLM özel GDPR cezası: 15 milyon €, OpenAI (İtalya Garante, Aralık 2024; Mart 2026'da temyizde iptal edildi).
- SOC 2 II tip penceresi: 6-12 aylık kontrol çalışmaları.
- Colorado AI Yasası yürürlüğe girme tarihi: 30 Haziran 2026 (SB25B-004 tarafından Şubat 2026'dan ertelendi).

```figure
i4-control-matrix
```

## Kullan

`code/main.py`Python'da bir uyumlulık haritası kalıp sayfasıdır  bir kontrol verilirse, karşıladığı çerçeveleri listeler.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-compliance-matrix.md`Müşteri segmentini ve coğrafi alanını göz önünde bulundurarak gerekli çerçeveleri ve kontrolleri belirler.

## Egzersizler

1. İlk kurumsal müşteriniz için SOC 2 Tipi II, HIPAA BAA, AB AI Yasası açıklaması gerekir.
2. Üç hipotetik LLM ürünü AB AI Yasası risk seviyeleri altında sınıflandırın.
3. BAA'sı olmayan bir sağlayıcının yanına yanlışlıkla PHI gönderdin.
4. Orta pazarlı bir AI satıcısı için ISO 42001'nin "2026 yılında gerekli olup olmadığını" tartışın.
5. LLM denetim günlüğü alanlarını (Fase 17 · 25) en az üç çerçeve kontrolüne yerleştirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Daha Fazla Okumak

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) İade dosyası.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) İlk kaynak.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) İlk kaynak.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) AI yönetim sistemi standardı.
