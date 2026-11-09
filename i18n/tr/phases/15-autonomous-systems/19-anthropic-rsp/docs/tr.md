# Antropik Sorumlu Ölçekleme Politikası v3.0

> RSP v3.0, 2023 politikasını değiştirerek 24 Şubat 2026 tarihinde yürürlüğe girdi. İki katlı azaltma: Anthropic'in tek taraflı olarak ne yapacağı vs. endüstri genelinde bir önerme olarak çerçeve edilen (RAND SL-4 güvenlik standartları dahil). Bir kez teslim edilen ürünlerin yerine, sınır güvenliği yol haritası ve risk raporları kalıcı belgeler olarak eklenir. 2023'te bir süreliğine bağlılık düşürüyor. AI R&D-4 eşiğini tanıttı: Bir kez geçtiğinde, Anthropic, yanlış uyum sağlama risklerini ve hafiflemelerini belirleyen bir onaylı vaka yayınlamalıdır. Claude Opus 4.6 bunu aşmaz. Antropic, v3.0 duyurmasında "bunu güvenle dışlamak zorlaşıyor" diyor. SaferAI 2023 RSP'yi 2.2 olarak değerlendirdi; v3.0'u 1.9'a düşürdüler. Bu sayede Antropic OpenAI ve DeepMind ile birlikte "zayıf" RSP kategorisine girdi. Kaliteli eşiğin 2023'teki miktarlı yükümlülükleri değiştirdiği için, durak sözcükünün kaldırılması en şiddetli gerilemedir.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## Sorun

Sınır laboratuvarları, kısmen teknik belgeler, kısmen yönetim belgeleri ve kısmen düzenleyicilere sinyaller olan ölçekleme politikalarını yayınlar. RSP v3.0 mevcut Anthropic belgesidir. Onu yakından okumak, ona uymak zorunlu olmadığı için değil, çerçeveleri bir laboratuvarın felaket riskini nasıl algıladığını ve halka nasıl pazarlamalar yapıldığını şekillendirdiği için önemlidir.

V3.0 vs. v2.0 farkı yararlı birimdir. Eklenenler: Sınır Güvenliği Yol Haritaları, Risk Raporları, Yapay Zeka Araştırma ve Gelişim 4 Eğlence. Çıkarılan şey: 2023'te bir süreliğine bağlılık. Yeniden çerçeveye alınan: Antropik-bir taraflı ve endüstri önerisi arasında iki katlı bir azaltma programı. Dış inceleme  SaferAI  puanı 2.2 (v2) 'den 1.9 (v3.0) 'ye düşürdü. Bu şekilde ölçeklendirme politikası daha ince görünenken daha az sıkı hale gelebilir.

## Anlaşım

### İki katlı azaltma programı

- **Anthropic unilateral actions**Diğer laboratuvarların yaptıklarından bağımsız olarak Anthropic'in yapacağı şey.
- **Industry-wide recommendations**Bu, Anthropic'in tarafındaki yükümlülükler değil, politik destekler.

İki katlı yapı v2'de değildi. Bu, bir okuyucu'nun her taahhüdün hangi sütunda yaşadığını görmesi gerektiği anlamına gelir. "endüstri genelinde önerme" sütunda bir güvenlik önlemi Anthropic'in vaadi değil; Anthropic'in umudu.

### AI Araştırma ve Gelişim-4 Eğlence

Bu, RSP 3.0'ın önümüzdeki önemli eşiği olarak adlandırdığı yetenek seviyesi. Özellikle: AI araştırmalarının önemli bir kısmını rekabetçi maliyetle otomatikleştirebilecek bir model. Anthropic bir modelin bunu geçtiğine inandıktan sonra, ölçeklendirmeyi sürdürmeden önce yanlış uyum risklerini ve hafiflemeleri belirleyen bir onaylı durum yayınlamalıdır.

Claude Opus 4.6 v3.0 duyurularına göre bunu aşmaz. Belge ekliyor: "Bu konuyu kesin olarak reddetmek zorlaşıyor". Bu ifade önemli; bu sınırın bir spekülasyon sınırı değil, canlı bir endişe için yeterince yakın olduğunu kabul ediyor.

6. Ders (Automatik Uyum Araştırması) ve 7. Ders (Kendici Öz-İyişim) doğrudan bu eşiğe girer.

### Sınır Güvenliği Yol Haritaları ve Risk Raporları

v3.0 iki eser türünü kalıcı belgelere yükseltir:

- **Frontier Safety Roadmap**: planlanan güvenlik çalışmalarını, kapasite beklentilerini ve hafifleme araştırmalarını açıklayan ileriye bakışlı belge.
- **Risk Report**: serbest bırakıldıktan sonra belirli modeller üzerinde gözlemlenen kapasite ve kalan riskleri açıklayan geriye dönük belge.

Her ikisi de kamuoyundadır. Her ikisi de açıklanmış bir kadens üzerinde güncellenir. Faydalı olan: okuyucu, Anthropic'in bir Yol Haritasında yapacağını söylediği şeyin Risk Raporunda rapor ettikleriyle nasıl karşılaştırıldığını takip edebilir.

### Durma sözcükünü kaldırmak

2023 RSP açık bir durak taahhüdü içeriyordu: bir model belirli kapasite eşiğlerini geçirse, eğitim hafifletmeler yapılana kadar durakta kalır. v3.0 açık bir durakta daha yumuşak bir formülasyonla yerini alır (etkin bir durum yayınlayın, hafifletmeler yeterli ise devam edin). SaferAI ve diğer analistler bunu yeni belgedeki en güçlü gerilem olarak doğrudan çağırdılar.

Değişikliğin politik argümanı: 2023'te miktarlı eşiğler 2026 çağındaki kapasite referansları tarafından erişilemez hale geldi çünkü referanslar yeniden ölçeklendirilmiştir. Karşı argüman: ölçeklendirme politikasında bir duraklama klazuli bir taahhüt aracıdır; kaldırılması politikanın güvenilirliğini ortadan kaldırır.

### SaferAI'nin derecelendirilmesi

SaferAI, RSP tarzındaki belgeleri değerlendiren bağımsız bir organizasyon. Halk tarafından yapılan değerlendirme: 2023 Anthropic RSP 2.2 puan aldı ( 4.0'ın en iyi mevcut RSP olduğu ve 1.0'ın nominal olduğu bir ölçekten). v3.0 1.9 puan aldı. Bu, Anthropic'i "orta" dan "zayıf"a taşıdı ve OpenAI ve DeepMind'e zayıf kategoride katıldı.

SaferAI'ye göre derecelendirme faktörleri:
- Kaliteci eşiğin yerini miktarlı eşiğin aldı.
- Durum yükümlülüğü kaldırıldı.
- AI R&D-4 eşiği azaltmaları, özel önlemlerden ziyade "etkin durum" olarak tanımlanır.
- Tekrarlama mekanizmaları, sınırlı bağımsız denetim ile Anthropic'in Güvenlik Danışmanlık Grubu'na bağlıdır.

### Bu ders ne değildir

Bu bir uyumluluk dersi değildir. RSP v3.0 bir düzenlemedir; hiçbir şey Anthropic'i buna uymaya zorlamaz. Dersi, dokümanı hak ettiği spesifiklik ve şüphecilik ile okumaktır. Ölçekleme politikaları, felaket risk duruşları hakkında yayınlanan ilk kamu sinyal sınır laboratuvarlarıdır. Onları iyi okuyan herkes için pratik bir beceri.

```figure
a5-rsp-ladder
```

## Kullan

`code/main.py`RSP eşiği değerlendirme şeklini yansıtan küçük bir karar motorunu uyguluyor: aday model ve bir dizi kapasite ölçümünü vererek, AI R&D-4 eşiği geçti mi, gerekli onaylı durum bölümleri ve dağıtım devam edebilir mi, geri dönün. Bu kasten basit; amacın belgenin mantığını açık bir şekilde yapmaktır.

## Gönder

`outputs/skill-scaling-policy-review.md`v3.0 referansına karşı bir ölçeklendirme politikasını (Anthropic, OpenAI, DeepMind veya iç) değerlendirir: iki katlı yapı, eşiği, duraklama yükümlülükleri, bağımsız değerlendirme.

## Egzersizler

1. Çık .`code/main.py`. Farklı kapasite düzeyleri ile üç sentetik model ekleyin.

2. RSP v3.0'u tam olarak okuyun (32 sayfa). "endüstri genel önerisi" seviyesinde yaşayan her taahhüdü belirleyin.

3. SaferAI'nin RSP derecelendirme metodolojisini okuyun. V3.0 için 1.9 puanlarını belgeye rubriklerini uygulayarak yeniden üretin. Hangi rubrik satırı en fazla indirmeyi tetikledi?

4. 2023'te durdurma taahhüdü kaldırıldı. 2026'da referans değerlerini yeniden ölçeklendirme problemini kabul ederek politika güvenilirliğini koruyan bir değiştirme taahhüdünü önerin.

5. RSP v3.0 ile OpenAI Hazırlık Çerçevi v2 (Denevi 20) karşılaştırın. v3.0'un daha güçlü olduğu bir alan seçin. Hazırlık Çerçevi daha güçlü olan bir alan seçin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Daha Fazla Okumak

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) 32 sayfalık politika.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) v2'den gelen değişikliklerin özetleri.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) RSP v3.0'dan bağlantılı kalıcı belge.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) Claude Opus 4.6'da geriye dönük bir bakış, yayınlandığı zaman sınır modeli.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) AI R&D-4'i ölçülen özerklik ile bağlar.
