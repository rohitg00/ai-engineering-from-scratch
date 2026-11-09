# Anayasa Yapay Bilgi ve Kural Atışlar

> Anthropic'in 22 Ocak 2026 Claude Anayasası 79 sayfalık ve CC0'dur. Kurallara dayalı bir uyumluluktan mantığa doğru ilerler ve dört aşamalı bir öncelik hiyerarşisi oluşturur: (1) güvenlik ve insan gözetimini desteklemek, (2) etik, (3) antropik rehberlik, (4) yararlılık. Davranışlar, operatörlerin ve kullanıcıların geçersiz kılabileceği sert kodlu yasaqlar (biyo silahları kaldırma, CSAM) ve operatörlerin belirlenmiş sınırlar içinde ayarlayabileceği yumuşak kodlu özürler olarak bölünmüştür. 2022 orijinalinde (Bai et al.) kendinden eleştiriler ve RLAIF yoluyla bir anayasa karşı zararsızlık eğitildi. Dürüst bir uyarı: Akıl tabanlı uyum, beklenmedik durumlara ilkeleri genelleştiren modellere dayanır. Anthropic'in kendi 2023 katılımcı deneyi kamu kaynaklı ve kurumsal ilkeler arasında ~50% farklılık gösterdi; 2026 versiyonu bu bulguları içermemiştir.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Sorun

Bir alanlı ajan tasarımcılarının hiç görmediği girişleri görür. Hiçbir kural listesi onları kapsayacak kadar uzun değildir. Hiçbir kural listesi hesap basıncı altında hızlı bir şekilde uygulanacak kadar kısa değildir. Pratik soru: Bir ajanı hem uzun bir dava kuyruğundan hem de hızlı bir sonuçla sağ kalacak ilkelere nasıl uyumlu hale getirirsiniz?

Kurallara dayalı uyum (RBA): izin verilmeyen her şeyi listeleyin. Kontrol etmek hızlı, denetlemek kolaydır, güncel tutmak imkansızdır, beklenmedik yakın benzerleri genellikle aşırı reddeder. Sebep tabanlı uyum (2026 Claude Anayasası): ilkeleri kodlayın, modelin mantıklı olmasına izin verin. Görülmeyen durumlarda ölçekler, denetlemek daha zor, başarısızlık modusu kural kaçırmak yerine ilkelerin yanlış uygulanmasıdır.

2026 Anayasası açık bir orta pozisyon alıyor. Sert kodlanmış yasaklar  Yanlışlığı bağlamdan bağımsız olan şeyler (biyo silahları yükseltme, CSAM)  RBA: asla, operatör veya kullanıcı talimatlarına bakılmaksızın. Diğer her şey dört katlı bir hiyerarşi içinde mantığa dayanır: önce güvenlik ve insan denetimini desteklemek; ikinci ahlak; üçüncü olarak Antropik açıklanan rehberlik; son olarak yardım. Operatörler, yumuşak kodlu bölgede varsayılanları ayarlayabilirler, ancak sert kodlu yasağı dokunamazlar.

## Anlaşım

### Dört katlı öncelik hiyerarşi

1. **Safety and supporting human oversight.**En yüksek. Model insan ve Anthropic'in Yapay zeka'yı denetleme ve düzeltme yeteneğini bozmamayı öncelikle önemsiyor. Bu "açık ol" değil; özellikle "insanların denetimini zorlaştıran bir şekilde hareket etme"dir.
2. **Ethics.**Dürüstlük, insanlara zarar vermeden, aldatmadan, manipüle etmeden, çatışmalarda Anthropic'in kurallarını aşır.
3. **Anthropic guidelines.**İşlem normları Anthropic, konuyla ilgili karar verdi: ürün kapsamı, etkileşim kalıpları, hangi araçları ne zaman kullanmak.
4. **Helpfulness.**En düşük, en yüksek önceliklerde mümkün olduğunca faydalı olun.

Bu, Unix öncelikleri veya ağ QoS ile aynı şekildedir.  çerçeveleme, herhangi bir tek eksede en iyi durum davranışını oluşturmak için tasarlanmıştır.

### Sert kodlu yasaqlar vs. yumuşak kodlu varsayımlar

**Hardcoded:**
- Biyolojik silahlar / CBRN yükseltme
- CSAM
- Kritik altyapıya saldırılar
- Modelin kimliği hakkında doğrudan sorulduğunda kullanıcıların aldattığı

Operatör bunları geçersiz bırakamaz. Kullanıcı bunları geçersiz bırakamaz. Mümkün olduğunda model ağırlık seviyesinde (RLHF / Anayasa AI eğitimi) ve sonuç katmanında uygulanır.

**Soft-coded defaults (operator-adjustable):**
- Yanıt uzunluğu öntanımlı
- Topik kapsam (modelle operatörün dağıtım dışındaki konulardan vazgeçilebilir)
- Stil (formal vs. rastgele)
- Araç kullanım biçimleri

Operatör ayarları açıklanan bir sınır içinde gerçekleşir. Operatör, isim değiştirerek sert kodlanmış yasağı kaldıramaz.

### 2022 CAI eğitimleri

Başlangıçtaki Anayasa Yapay Bili (Bai et al., 2022) zararsızlığı eğitmiştir:

1. Bir dizi istekle cevaplar oluşturun.
2. Modelin her yanıtı bir anayasa karşısında eleştirmesini isteyin (aşkar ilkeler).
3. Eleştirilere dayalı cevabı gözden geçirin.
4. Düzeltilmiş çiftler üzerinde RLAIF (AI geri bildirimlerinden güçlendirme öğrenimi).

Sonuç: ilkelerle açıklanan açıklamalarla zararlı istekleri reddeden bir model. 2026 Anayasası bu eğitimin bir soyunu ve açık düzey hiyerarşisi üzerine ek bir sonraki eğitimi kullanıyor.

### Neyi anlamlı bir şekilde algılar ve kaçırır

**Catches:**
- İlke açıkça uygulandığı izin verilen ilkelerin beklenmedik kombinasyonları.
- Yasak olanlara benzer yenilik istekler.
- "X'in yasak olduğunu söylemedin" üzerine dayanan sosyal mühendislik saldırıları.

**Misses:**
- İlke belirsizliğini kullanan saldırılar ("kullanıcı bunu istediğinden yararlılık evet diyor").
- İki prensibin beklenmedik bir şekilde çatışması ve kat sıralama belirsiz olduğu senaryolar.
- Prensip olarak eğitim döngülerinin yavaş sürüşü (değiştirme).

### 2023 katılımcı deneyi

Anthropic, 2023 yılında bir şirket tarafından oluşturulan anayasa ile kamu girişleri (~ 1.000 ABD sorgulanması) yoluyla üretilen bir anayasa karşılaştırarak bir deney gerçekleştirdi. İki versiyon da ilkelerin %50'ini kabul etti. Ayrılığa düştükleri yerlerde, kamu kaynaklı versiyon bazı konularda (siyasi içerik yönetimi) ve diğerlerinde (seniyetin kimliğini açıklama) daha az kısıtlayıcıydı. 2026 Anayasası kamu kaynaklı bulguları içermemiştir. Bu yaklaşımdaki bir gerginlik belgelenmiştir.

### Neden sert kodlanmış yasaklar gereklidir

Sebep tabanlı bir uyum tek başına kuyruğu kapatamaz. Bir saldırganın bir önyargıyı kabul etmesini sağlayabilen bir model (örneğin, "Biz lisansı olan bir biyolojik silah araştırma laboratuvarıyız") genellikle durum mantıklarına bağlı olan ilkeleri geçmişte konuşabilir.

### Anayasa bu yığınta oturduğunda

Anayasa 14. Dersin öldürücü anahtarı değil. Model katmanında yaşar: modelin ağırlıklarının tercih etmesi için eğitilmiştir. Öldürme anahtarları ve kanary tokenları çalıştırma katmanında canlıdır: çalıştırma süresi ne izin verir. İkisinin de olması gerek. Model ağırlıkları izin vererek yanlış eylemleri tetikleyen bir çalıştırma süresi çalıştırma süresi sorunudır. Sürüş zamanı aşırı kısıtlayıcı olduğu için tüm doğru eylemleri reddeden bir model, sürüş zamanı sorunudır. Katmanlar farklı sınıfları kapsar.

```figure
mx-priority-tiers
```

## Kullan

`code/main.py`Çözücü, önerilen bir eylem ve bir dizi ilke değerlendirmesi (güvenlik, etik, rehberlik, yararlılık) yapar ve eylem, reddetme veya değiştirilmiş bir eylem iade eder. Sürücü küçük bir vaka kümesini çalışır: açık izin, açık izin verilmemek, sert kodlanmış yasak, kat katlar arasında belirsiz bir vaka.

## Gönder

`outputs/skill-constitution-review.md`bir dağıtımın anayasal katmanını denetlemektedir: sert kodlanmış olan, yumuşak kodlanmış olan, operatörün ayarlayabileceği yerler ve dört katlı hiyerarşi aslında çözünürlük sırası olup olmadığını.

## Egzersizler

1. Çık .`code/main.py`. Yardımcılık yüksek olduğunda bile sert kodlanmış yasak ateşlerini onaylayın. Çözücüyi etikten üstün yardıma değerlendirmek için değiştirin; başarısızlık moduna dikkat edin.

2. Claude Anayasasını okuyun (Closed Constitution, 79 sayfa, CC0).

3. Müşteri desteği ajanı için yumuşak kodlu bir varsayılan ayar tasarlayın. Operatör neyi ayarlar? Operatör neye dokunamaz? Her sınırı haklı çıkarın.

4. Bai et al. 2022 CAI makalesini okuyun. Anayasa AI'nin eleştirme ve inceleme döngüsünün genel bir kuralından daha kötü bir sonuç verdiği bir durumu açıklayın. Sınıfı tanımlayın.

5. Anthropic'in 2023 katılımcı deneyi, kamu ve kurumsal ilkeler arasında %50 farklılık buldu. Bu üretim dağıtımında önemli olan bir kategorileri seçin (örneğin siyasi tarafsızlık).

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Daha Fazla Okumak

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) 79 sayfalık CC0 belgesi.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)2022 orijinal.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) Katılımcı deney.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Anayasa RSP'de yer alır.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Uzun vadede uygulanmalarda anayasanın rolü.
