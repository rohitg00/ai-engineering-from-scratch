# Rol Uzmanlığı  Planlayıcı, Eleştirmen, İcracı, Deneyci

> 2026'da en yaygın çok ajanlı parçalanma: bir ajan planlar, bir yönetir, bir eleştirir veya doğruluyor. MetaGPT (arXiv:2308.00352) bunu rol isteklerine kodlanmış SOP'ler olarak resmileştirir  Ürün Yöneticisi, Mimar, Proje Yöneticisi, Mühendis, Sorucu Mühendis  aşağıdaki `Code = SOP(Team)`- Evet . ChatDev (arXiv:2307.07924) dizayner, programcı, yorumcu, testçi dizaynını "çap zinciri" ile "kommunikatif halüsinasyon" ile zincirler (ajanlar açıkça eksik detayları talep eder). Verifiyeci yük taşıyıcıdır: Cemri et al. (MAST, arXiv:2503.13657) gösterir her multi-ajan başarısızlığı kayıp veya kırık doğrulama izlenebilir. PwC, CrewAI'de yapılandırılmış onay döngüslerinden 7× doğruluk artışı (% 10 → 70%) rapor etti.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Sorun

Genel çoklu ajanlı sistemler genel çıkış üretir. Grup sohbetinde üç kodlayıcı aynı ortalama kodun üç tadını yazar. Daha fazla ajan ekleyebilir, daha fazla yuvarlak ekleyebilir ve yine de kalite eşiğini geçemezsiniz.

Bu, bir sistemin temel düzeltme ile içsel anlaşmazlığa sahip olması anlamına gelir. Bu sistemin temel düzeltme ile içsel anlaşmazlıkları vardır.

## Anlam

### Dört kanonik rol

**Planner.**Hedef okuyor, adım listesi veya bir spesifikasyon oluşturur. Araçlar: bilgi alımı, belgeleri. Çıktı: yapılandırılmış plan.

**Executor.**Bir planı bir adımdan bir okuyor, eser üretir. Araçlar: gerçek çalışma araçları (kod kompiliörü, kabuğu, API istemcisi). Çıktı: eser.

**Critic.**Yönetici'nin niyetine karşı çıkışını okuyor. Araçlar: eserlere sadece okuyucu erişim, statik analiz. Çıktı: kabul/dönüş nedenlerle.

**Verifier.**Artifakti okuyor ve belirleyici bir kontrol yürütüyor. Araçlar: test koşucusu, tip kontrolcü, şema onaylayıcı. Çıktı: kanıt ile geç / başarısız.

Eleştirmen, öznel, görüşlü, genellikle LLM tabanlıdır.

### MetaGPT'nin SOP örneği

MetaGPT (arXiv:2308.00352) yazılım mühendisliği SOP'lerini rol istekleri olarak kodlar:

- **Product Manager**- PRD'nin yazdığı gibi.
- **Architect**Sistem tasarımı üretir.
- **Project Manager**Görevleri bölüyor.
- **Engineer**araçlar.
- **QA Engineer**Testler yaptırıyor.

Her rolün kapsamlı bir giriş/çıktı şeması vardır.`Code = SOP(Team)`formülasyon  Deterministik SOP'ler bir LLM ekibiyi öngörülebilir bir boru hattına dönüştürür.

### ChatDev'in iletişimsel halüsinasyonu.

ChatDev bir anahtar hareket ekler: bir icracı planda olmayan belirli bir ayrıntıya ihtiyaç duyduğunda, devam etmeden önce tasarımcıya açıkça sorar. Bu, ayrıntıyı makul bir şekilde icat etmenin klasik LLM başarısızlığını önler.

Uygulama: rol sorgulaması "verilmediğiniz belirli bilgilere ihtiyacınız olduğunda, çıkış üretmeden önce ilgili rolün adını sorun".

### Neden doğrulayıcı en önemli

Cemri et al. (MAST) 1642 çoklu ajan uygulama başarısızlığını takip etti. 21.3% doğrulama boşluklarıydı  sistem kimse kontrol etmediği bir cevap gönderdi. Geri kalan 79% genellikle "sessiz bir şekilde başarısız olan bir kontrol vardı veya hiç çalıştırılmadı".

PwC (CrewAI dağıtımları, 2025) bir yapılandırılmış doğrulama döngüsünün eklenmesinin doğruluğunu %10'dan %70'e taşıdığını bildirdi.

### Eleştirmen vs. doğrulayıcı

- Eleştirmen, bir eseryi kalitesi için değerlendiren bir Yüksek Lisans Derecesidir.
- Bir doğrulayıcı, eser üzerinde çalışan bir belirleyici programdır.

İkisi de kullanın. Eleştirmen, verifikatörün ifade edemediği tad sorunlarını yakalar. Verifikatör, eleştirmenin göremediği hataları yakalar çünkü sadece çalıştırma sırasında ortaya çıkarlar.

### Anti-önüm

Sisteminizde her rol bir LLM'dir ve her rolün çıkışı "Bana iyi görünüyor". Klasik MAST başarısızlık modudur.

### Çerçeve haritalamaları

- **CrewAI** `Agent(role, goal, backstory)`ders kitabı uzmanlık yüzeyi.
- **LangGraph** düğümler özel isteklere sahip olabilir; kenarlar boru hattını zorlar.
- **AutoGen** Grup Çat'ta tek kelime isimleri ile rolü özel konuşma ajanları.
- **OpenAI Agents SDK** Rol uzmanı ajanlar arasında el ele alma araçları.

```figure
swarm-roles
```

## Yapın

`code/main.py`basit bir Python fonksiyonu oluşturan 4 rollü bir boru hattı uyguluyor:

- **Planner**bir spesifikasyon üretir.
- **Executor**bir kod dizini oluşturur.
- **Critic**(LLM simülasyonu) açık sorunları işaretler.
- **Verifier**oluşturulan kodı kum kutuya (`exec`) bir test durumuna karşı.

Demo iki kez çalışır: bir kez uygulayıcı doğru kod üretirken (kritik + doğrulayıcı her ikisi de geçer), bir kez uygulayıcı açık olmayan kod üretirken (kritik yanlışlığı kaçırır çünkü makul görünüyor, doğrulayıcı test başarısız olduğu için yakalar).

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

## Kullan

`outputs/skill-role-designer.md`Bir görev alır ve rol listesi (3-5 rol), her rol için giriş/çıktı şeması ve doğrulayıcı kontrolü üretir.

## Gönder

Kontrol listesini:

- **At least one deterministic verifier.**Hiç de tüm-LLM.
- **Explicit I/O schema per role.**Planlayıcı bir spesifikasyon gönderir, proza değil; uygulayıcı bu şemaları okuyor.
- **Communicative dehallucination.**İnkârcı, bilgi eksik olduğunda planlayıcısına sormalıdır; asla icat etme.
- **Critic/verifier ordering.**Önce eleştirmen çalıştır ( ucuz, tasarım sorunlarını yakalar), ikinci doğrulayıcı (yavaş, hataları yakalar).
- **Loop budget.**Max 2 eleştirmen-işleyici gözden geçirme turları insan olarak yükselmeden önce.

## Egzersizler

1. Çık .`code/main.py`ve doğrulayıcı eleştirmenin kaçırdığı hatayı nasıl yakaladığını gözlemleyin.`return`) bir ek doğrulayıcı olarak.
2. 5. rolü ekleyin: "gereklilik analitiği" kullanıcı isteğini planlama hazır bir spesifikasyon olarak çevirir. Hangi iletişimsel halüsinasyon istekleri ona doğru akmalı?
3. MetaGPT Bölümü 3'ü okuyun ("Agentler"). MetaGPT'nin 5 rolünün her birinin giriş/çıktı şeması listelenmelidir.
4. ChatDev'in sohbet zinciri şablonunu okuyun (arXiv:2307.07924 Şekil 3). İletişimsel halüsinasyonun sonsuz bir döngü kırıldığı yerleri belirleyin.
5. PwC'nin 7× doğruluk kazanımı doğrulama döngüslerinden geldi. Bir doğrulama cihazı eklemenin yardımcı olmayacağı üç görevi varsayın  doğruluğun belirleyici kontrolü imkansız veya yasaklı bir şekilde pahalı olduğu yerlerde.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Daha Fazla Okumak

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) SOP-as-role-prompt referans kağıdı
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) Çat zinciri + iletişimsel halüsinasyon
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST taksonomisi; doğrulama boşlukları başarısızlıkların % 21,3'ünü oluşturur
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) üretim rolü özellik yüzeyi
