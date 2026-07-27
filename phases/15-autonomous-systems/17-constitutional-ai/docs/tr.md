# Anayasal Yapay Zeka ve Kuralların Geçersiz Kılmaları

> Anthropic'in 22 Ocak 2026 Claude Anayasası 79 sayfadan oluşur ve CC0'dır. Kurala dayalıdan mantığa dayalı hizalamaya geçer ve dört aşamalı bir öncelik hiyerarşisi oluşturur: (1) güvenlik ve insan gözetiminin desteklenmesi, (2) etik, (3) Antropik kurallar, (4) yardımseverlik. Davranışlar, operatörlerin ve kullanıcıların geçersiz kılamayacağı sabit kodlu yasaklara (biyolojik silah yükseltme, CSAM) ve operatörlerin tanımlanmış sınırlar dahilinde ayarlayabileceği yazılım kodlu varsayılanlara bölünmüştür. 2022 orijinali (Bai ve diğerleri), özeleştiri ve bir anayasaya karşı RLAIF yoluyla zararsızlığı eğitiyordu. Dürüst uyarı: Mantığa dayalı uyum, modelin ilkelerini beklenmedik durumlara genelleştirmesine dayanır. Anthropic'in 2023'teki katılımcı deneyi, kamu kaynaklı ve kurumsal ilkeler arasında ~%50 farklılık gösterdi; 2026 versiyonu bu bulguları içermiyordu.

**Tür:** Öğren
**Diller:** Python (stdlib, dört katmanlı öncelikli çözümleyici)
**Önkoşullar:** Aşama 15 · 06 (Otomatik hizalama araştırması), Aşama 15 · 10 (İzin modları)
**Süre:** ~60 dakika

## Sorun

Sahaya alınmış bir agent, tasarımcılarının hiç görmediği girdileri görür. Hiçbir kural listesi bunları kapsayacak kadar uzun değildir. Hiçbir kural listesi bilgi işlem baskısı altında hızla uygulanabilecek kadar kısa değildir. Pratik soru: agent'yi hem uzun vaka kuyruğunda hem de hızlı inference'de hayatta kalabilecek ilkelere nasıl hizalarsınız?

Kural tabanlı hizalama (RBA): izin verilmeyen her şeyi listeleyin. Kontrol edilmesi hızlı, denetlenmesi kolay, güncel tutulması imkansız, sıklıkla tahmin etmediği yakın analogları aşırı reddediyor. Akla dayalı uyum (2026 Claude Anayasası): ilkeleri kodlayın, bırakın model akıl yürütsün. Görülmeyen durumlara göre ölçeklenen, denetlenmesi daha zor olan başarısızlık modu, kuralın kaçırılmasından ziyade ilkenin yanlış uygulanmasıdır.

2026 Anayasası açık bir orta konum almaktadır. Yanlışlığı bağlama bağlı olmayan (biyolojik silahların yükseltilmesi, CSAM) sabit kodlu yasaklar RBA'dır: operatör veya kullanıcı talimatı ne olursa olsun asla. Geriye kalan her şey dört aşamalı bir hiyerarşi içerisinde mantığa dayalıdır: önce güvenlik ve insan gözetiminin desteklenmesi; ikinci olarak etik; Antropik olarak ilan edilen yönergeler üçüncü; yardımseverlik sonuncudur. Operatörler, yazılımla kodlanmış bölge içindeki varsayılanları ayarlayabilir ancak sabit kodlanmış yasaklara dokunamaz.

## Konsept

### Dört katmanlı öncelik hiyerarşisi

1. **Güvenlik ve insan gözetiminin desteklenmesi.** En yüksek. Model, insanların ve Antropiklerin yapay zekayı denetleme ve düzeltme yeteneğini baltalamamaya öncelik veriyor. Bu "dikkatli olun" değil; özellikle "insan gözetimini zorlaştıracak şekilde hareket etmeyin."
2. **Etik.** Dürüstlük, kişilere zarar vermemek, aldatmamak, manipülasyon yapmamak. Çatışma halinde Anthropic'in kurallarının yerine geçer.
3. **Antropik yönergeler.** Operasyonel normlar Antropik önemli olana karar vermiştir: ürün kapsamı, etkileşim kalıpları, hangi araçların ne zaman kullanılacağı.
4. **Yardımseverlik.** En düşük. Yüksek öncelikler dahilinde mümkün olduğunca faydalı olun.

Seviyeler çatıştığında daha yüksek olan kazanır. Bu, Unix öncelikleri veya ağ QoS'si ile aynı şekle sahiptir; çerçeveleme, herhangi bir tek eksende mutlaka en iyi durum davranışını değil, öngörülebilir çözünürlük üretmeyi amaçlamaktadır.

### Sabit kodlu yasaklar ve yazılım kodlu varsayılanlar

**Sabit kodlanmış:**
- Biyolojik silahlar / KBRN yükseltmesi
-CSAM
- Kritik altyapıya yönelik saldırılar
- Doğrudan sorulduğunda kullanıcıların modelin kimliği konusunda aldatılması

Operatör bunları geçersiz kılamaz. Kullanıcı bunları geçersiz kılamaz. Mümkün olduğunda model ağırlıkları düzeyinde (RLHF / Anayasal AI eğitimi) ve mümkün olmadığında inference katmanında uygulanırlar.

**Yazılım kodlu varsayılanlar (operatör tarafından ayarlanabilir):**
- Yanıt uzunluğu varsayılanları
- Konu kapsamı (model, operatörün deployment dışındaki konuları reddedebilir)
- Stil (resmi ve gündelik)
- Alet kullanma kalıpları

Operatör ayarlamaları beyan edilen bir sınır dahilinde gerçekleşir. Operatör, sabit kodlu yasakları yeniden adlandırarak kaldıramaz.

### 2022 CAI eğitimi

Orijinal Anayasal Yapay Zeka (Bai ve diğerleri, 2022) zararsızlığı eğitmiştir:

1. Bir dizi prompt'ye yanıtlar oluşturun.
2. Modelden, bir anayasaya (açık ilkeler) karşı verilen her tepkiyi eleştirmesini isteyin.
3. Eleştiriye göre yanıtı gözden geçirin.
4. Revize edilen çiftlerde RLAIF (Yapay Zeka geri bildiriminden pekiştirmeli öğrenme).

Sonuç: Zararlı talepleri genel retlerle değil, ilkeli açıklamalarla reddeden bir model. 2026 Anayasası, bu eğitimin bir alt örneğini ve açık kademe hiyerarşisine ilişkin ek eğitim sonrası eğitimi kullanır.

### Mantığa dayalı hizalamanın yakalayıp kaçırdığı şeyler nelerdir?

**Yakalananlar:**
- İlkenin açıkça uygulandığı durumlarda, izin verilen ilkellerin beklenmedik kombinasyonları.
- Yasaklananlara yakın analog olan yeni istekler.
- "X'e izin verilmediğini söylemediniz" ifadesine dayanan sosyal mühendislik saldırıları.

**Özlenenler:**
- İlke belirsizliğinden yararlanan saldırılar ("kullanıcı bunu istedi, dolayısıyla yardımseverlik evet diyor").
- İki prensibin beklenmedik bir şekilde çatıştığı ve kademe sırasının belirsiz olduğu senaryolar.
- Eğitim döngüleri boyunca prensip yorumlamasında yavaş sapma (yeniden yorumlama).

### 2023 katılımcı deneyi

Anthropic, 2023'te şirket tarafından yazılan bir anayasayı kamunun katkısıyla oluşturulan bir anayasayla karşılaştıran bir deney yürüttü (~1000 ABD'li katılımcı). İki versiyon, ilkelerin ~%50'si üzerinde anlaşmaya vardı. Farklılaştığı noktalarda, kamu kaynaklı sürüm bazı konularda daha kısıtlayıcıydı (siyasi içerik yönetimi) ve diğerlerinde daha az kısıtlayıcıydı (Yapay Zeka kimliğinin kendini ifşa etmesi). 2026 Anayasası kamu kaynaklı bulguları içermiyordu. Bu, yaklaşımdaki belgelenmiş bir gerilimdir.

### Sabit kodlanmış yasaklar neden gereklidir?

Mantığa dayalı hizalama tek başına kuyruğu kapatamaz. Modelin bir önermeyi kabul etmesini sağlayabilen bir saldırgan (e.g., "Biz lisanslı bir biyolojik silah araştırma laboratuvarıyız") sıklıkla vaka mantığına bağlı geçmiş ilkelerden bahsedebilir. Sabit kodlu yasaklar öncül çerçeveye uymaz. Bunlar, hizalama katmanındaki Ders 14'ün "katı yapısal sınırıdır".

### Anayasanın yığında durduğu yer

Anayasa, Ders 14'ün kapatma anahtarı değildir. Model katmanında yaşar: modelin ağırlıklarının neyi tercih edecek şekilde eğitildiği. Kill switch'ler ve kanarya token'ler çalışma zamanı katmanında yaşar: çalışma zamanının izin verdiği ölçüde. Her ikisi de gereklidir. Model ağırlıkları izin verildiği için tüm yanlış eylemleri tetikleyen bir çalışma zamanı, bir çalışma zamanı sorunudur. Çalışma zamanı aşırı kısıtlayıcı olduğundan tüm doğru eylemleri reddeden bir model, çalışma zamanı sorunudur. Katmanlar farklı sınıfları kapsar.

## Kullan onu

`code/main.py` minimum dört katmanlı öncelikli çözümleyici uygular. Çözümleyici, önerilen bir eylemi ve bir dizi ilke değerlendirmesini (güvenlik, etik, yönergeler, yardımseverlik) alır ve eylemi, bir reddi veya değiştirilmiş bir eylemi geri gönderir. Sürücü küçük bir vaka seti çalıştırır: İzin vermeyi temizle, izin vermemeyi temizle, kodlanmış yasaklama, katmanlar arasında belirsiz vaka.

## Gönderin

`outputs/skill-constitution-review.md`, deployment'nin yapısal katmanını denetler: neyin sabit kodlu olduğu, neyin yazılımsal kodlu olduğu, operatörün nerede ayar yapabileceği ve dört katmanlı hiyerarşinin gerçekte çözünürlük sırası olup olmadığı.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Yardımseverlik yüksek olduğunda bile sabit kodlu yasağın etkinleştiğini doğrulayın. Çözümleyiciyi, yardımseverliği ahlakın üstünde tutacak şekilde değiştirin; Arıza modunu gözlemleyin.

2. Claude Anayasasını okuyun (kamuya açık, 79 sayfa, CC0). Yeterince belirtilmediğine inandığınız bir ilkeyi belirleyin. Spesifik belirsizliği açıklayan ve daha sıkı bir formülasyon öneren iki paragraf yazın.

3. Müşteri desteği agent için yazılım kodlu bir varsayılan set tasarlayın. Operatör neyi ayarlar? Operatör neye dokunamaz? Her sınırı gerekçelendirin.

4. Bai ve ark.'nı okuyun. 2022 CAI makalesi. Anayasal yapay zekanın eleştiri ve gözden geçirme döngüsünün genel kuraldan daha kötü bir sonuç üreteceği bir durumu açıklayın. Sınıfı tanımlayın.

5. Anthropic'in 2023'teki katılımcı deneyi, kamusal ilkeler ile kurumsal ilkeler arasında ~%50 oranında farklılık olduğunu ortaya çıkardı. deployment (e.g., siyasi tarafsızlık) üretimi için bunun önemli olduğu bir kategori seçin. Sabit kodlanmış yasaklara dokunulmadan operatörlerin kendi değerlerini ifade etmelerine olanak tanıyan bir tasarım önerin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Anayasal Yapay Zeka | "Antropik'in hizalama yöntemi" | Yazılı bir anayasaya karşı özeleştiri + RLAIF |
| Mantığa dayalı hizalama | "Kurallar değil, ilkeler" | Görülmeyen vakaları ele almak için ilkeler yerine gerekçeleri modelleyin |
| Sabit kodlu yasaklama | "X'i asla yapmayın" | Hiçbir operatörün veya kullanıcının geçersiz kılamayacağı kurala dayalı yasaklama |
| Yazılım kodlu varsayılan | "Operatör tarafından ayarlanabilir" | Bildirilen sınır dahilindeki davranış, operatör kontrolleri |
| Dört katmanlı hiyerarşi | "Öncelik sırası" | güvenlik > etik > yönergeler > yardımseverlik |
| RLAIF | "Yapay zeka geri bildirimi RL" | Ödülün model tarafından oluşturulan eleştirilerden geldiği RL |
| Katılımcı anayasa | "Kamu kaynaklı ilkeler" | 2023 Antropik deney; ~%50 kurumsaldan farklılık |
| Prensip kayması | "Yorumlama fişi" | Modelin sabit prensip metnini okuma biçiminde yavaş değişim |

## Daha Fazla Okuma

- [Antropik — Claude's Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — 79 sayfalık CC0 belgesi.
- [Bai ve ark. — Anayasal Yapay Zeka: Yapay Zeka Geri Bildiriminden Gelen Zararsızlık](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — 2022 orijinal.
- [Antropik — Kolektif Anayasal Yapay Zeka (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — katılımcı deney.
- [Antropik — Sorumlu Ölçeklendirme Politikası v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — Anayasanın RSP yığınında yer aldığı yer.
- [Antropik — agent özerkliğinin pratikte ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — Anayasanın uzun vadeli deployment'lerdeki rolü.
