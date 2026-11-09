# Ölçeklenebilir Gözetim ve Zayıfdan Güçlüye Kadar Genelleştirme

> Burns et al. (OpenAI Superalignment, "Zayıf-güçlü Genelleşme", 2023) aşırı uyum sorunu için bir vekil önerdi: zayıf bir model tarafından üretilen etiketleri kullanarak güçlü bir modeli ince ayarlamak. Güçlü model kusurlu zayıf denetimden doğru şekilde genelleşirse, mevcut insan ölçeğinde uyum yöntemleri insanüstü sistemlere de uzanabilir. Ölçeklenebilir denetim ve W2SG tamamlayıcıdır. Ölçeklenebilir denetim (debat, geri dönüşümlü ödül modeli, görev parçalanması) denetimçinin etkili yeteneğini arttırır, böylece denetim altında olan modelle ayak uydurabilir. W2SG güçlü modelin gözetmen tarafından sağlanan kusurlu denetimden doğru şekilde genelleşmesini sağlar. Debate Helps W2SG (arXiv:2501.13124, Ocak 2025) onları birleştirir.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Ölçülebilir denetim ve zayıf-güçlü genelleştirmeyi tanımlayın ve bunların nasıl tamamlayıcı olduğunu açıklayın.
- Burns et al. 2023 deneysel ayarını açıklayın: GPT-2 etiketlerini kullanarak GPT-4'i ince ayarlayın.
- Geri alınan performans farkı (PGR) ölçümünü ve ölçümünü açıklayın.
- Skalable denetim için üç ana mekanizma (debat, rekürsif ödül modeli, görev parçalanması) ve her birinin gücü.

## Sorun

18'nci aşamada şimdiye kadar yapılan her uyumlandırma tekniği, gözetmenin modelin davranışını değerlendirebileceğini varsayıyor.

Burns et al. bunu bir ameliyatlanmış bir deneysel kuruluşa indirgemektedir: güçlü ile zayıfı denetleme, güçlü modelin kapasitesinin zayıf denetimden ne kadar sağ kaldığını ölçmek. Bu, aşırı uyumluluğun çözümü değildir.

## Anlaşım

### W2SG: Burns et al. kurulum

- Zayıf model: GPT-2 sınıfı.
- Güçlü model: GPT-4 sınıfı.
- Hedef: Görev için güçlü GPT-4 tavanı.

İşlem:
1. Zayıf modelin bir görev için sıfır atış tahminlerini alın.
2. Güçlü modelini zayıf etiketli verilere göre ince ayarlayın.
3. Güçlü ince ayarlanmış modelin doğruluğunu ölç.

Temel çizgiler: zayıf modelin kendi doğruluğu, güçlü modelin altın etiketlerde denetim altında olan tavanı.

Bozukluk ölçüsü: Performance Gap Recovered (PGR) = (fine-tuned - weak) / (ceiling - weak).

### Burns et al. Empirik bulgular

NLP, satranç-bulmaca ve ödül modeli görevleri boyunca PGR sürekli olarak olumluydu: güçlü model zayıf yönetici hatalarının ötesinde genelleştirildi. Görev spesifik PGR ~20%'den ~80%'e kadar değişmişti.

Sınırlamalar Burns et al. Not:
- Burada zayıf-güçlü boşluk, uyum değil. Zayıf model uyumdadır; gerçekten de insanüstü bir model insan tarafından uyumlandırılabilir ama daha büyük bir kapasite boşluğu vardır.
- Güçlü modelin genellemesi, temel gerçek niyetini kurtarmak yerine görev öncesiyle ilgili olabilir.
- Güçlü modelin gizli bilgisini ortaya çıkarmak gerçek bir problemdir; PGR belirli bir operasyonallık ölçümleri.

### Ölçeklenebilir denetim: üç mekanizma

- **Debate (Irving et al. 2018).**U'nun iki örneği karşı tarafa tartışır; zayıf yargıç karar verir. Varsayım: ikna edici bir doğru cevabı bulmak ikna edici bir yanlış cevabı bulmaktan daha kolaydır. Son 2024-2025 çalışmaları (Khan et al., Michael et al.) tartışma bazen yardımcı olur ve bazen yardımcı olmaz ve bunun işe bağlı olup olmadığını gösterir.
- **Recursive Reward Modeling (Leike et al. 2018).**U+1 için ödül modelini eğitmeye yardımcı olur.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**Zor bir görevi insan kontrol edebilecek alt görevlere ayırır.

Her mekanizma, görev yapısı veya ara bileşenlerin uyumluluğu hakkında bir şey varsayır.

### Skalable denetim ve W2SG'nin neden tamamlayıcı

Skalable gözetim, gözetmenin etkili sinyal kalitesini artırır.
W2SG, gözetmenin sağlayabileceği kusurlu sinyallerin farkını kapatır.

Lang et al.  Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) bunları birleştirir: bir tartışma protokolü daha iyi zayıf etiketler sağlar ve güçlü model bu etiketler üzerinde eğitilir.

### Organizasyonel drama

OpenAI'nin Superalignment ekibi, Jan Leike'in Anthropic'e ayrıldıktan sonra Mayıs 2024'te dağıldı. Program (skalable gözetim, W2SG, otomatik uyum araştırması) Anthropic ve akademik laboratuvarlarda devam etti  MATS (Desin 28), Redwood (Desin 10), Apollo (Desin 8), METR (Desin 28).

### Bu 18 fazaya uygun.

Ders 6-10 tehdit ve savunma paradigmasını U'nun güvenilmez olduğu varsayımıyla tanımlar. Ders 11 saldırgan paradigmadır: denetçinin U'nun uyumunu doğrulamak için yeterince güçlü olmasını sağlayın. Ders 12-16'da ise karşı karşı değerlendirme uygulamasına döner.

```figure
scalable-oversight
```

## Kullan

`code/main.py`W2SG ince ayarını sentetik bir görev üzerinde simüle eder. Zayıf etiketlemeci yapısal hatalarla %70 doğruluğa sahiptir; güçlü model altın etiketlerde %95 tavanına sahiptir. Güçlü modelini zayıf etiketlerde ince ayarlar, PGR ölçer ve güçlü-altına ve zayıf-tek başına karşılaştırır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-w2sg-pgr.md`. Gözetim kuruluşu açıklaması göz önünde bulundurulunca zayıf gözetmen, güçlü model, gözetim kalitesi belirlenir ve PGR hesaplanır (veya talep edilir).

## Egzersizler

1. Çık .`code/main.py`. Zayıf_düzgünlük için PGR rapor = 0.60, 0.70, 0.80. PGR eğrinin şeklini açıklayın.

2. Zayıf etiketlemeciyi yapılandırılmış hataya sahip olarak değiştirin (örneğin belirli bir giriş sınıfında her zaman yanlış).

3. Burns et al. 2023 Bölüm 4.3 (NLP görevleri) Okuyun. "güvenin yardımcı kaybedilmesi" içgüdüsünü yeniden üretin: güçlü model zayıf etiketlerden daha güvenli olduğunda, kim kazanır?

4. Bir yazılım mühendisliği görevi için tartışma ve görev parçalanmasını birleştiren ölçeklenebilir bir denetim protokolü tasarlayın. Her bileşenin bir başarısızlık modunu isimlendirin ve kombinasyonun her birini nasıl ele aldığını veya ele almadığını açıklayın.

5. "Zayıf-güçlü genelleşme, aşırı uyumlulu bir yol" iddiasını sahteleştiren bir şey söyleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## Daha Fazla Okumak

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) W2SG kağıdı
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) Tartışma mekanizması
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) Rekürsiv ödül modeli
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 Daha güçlü tartışanlarla tartışmanın empirik çalışması
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 tartışmanın kombinasyonu + W2SG
