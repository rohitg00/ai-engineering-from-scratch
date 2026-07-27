# Anayasal AI ve RLAIF

> Bai ve ark. (arXiv:2212.08073, 2022) şunu sordu: İnsan etiketleyiciyi ilkeler listesini okuyan bir yapay zekayla değiştirsek ne olur? Anayasal yapay zekanın iki aşaması vardır: özeleştiri ve bir anayasa kapsamında revizyon, ardından Yapay Zeka Geri Bildiriminden RL. Teknik, RLAIF terimini icat etti ve Claude 1 eğitim sonrası hattında gönderildi. 21 Ocak 2026'da Anthropic, yeniden yazılmış bir Claude anayasası yayınladı: kuralcı kurallar üzerinde açıklayıcı akıl yürütme, dört aşamalı bir öncelik hiyerarşisi ve model ahlaki statü hakkındaki belirsizliğin ilk büyük laboratuvar resmi kabulü. CC0 1.0 altında yayınlandı.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak özeleştiri ve gözden geçirme döngüsü)
**Önkoşullar:** Aşama 18 · 01 (InstructGPT), Aşama 18 · 02 (Ödül korsanlığı)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Anayasal yapay zekanın iki aşamasını (SFT'yi eleştir ve revize et, yapay zeka geri bildiriminden RL) ve her birinde anayasanın rolünü açıkla.
- İnsan tercihli etiketleyiciyi yapay zeka etiketleyiciyle değiştirmenin neden "daha ucuz" bir RLHF olmadığını açıklayın; bu işlem hattının sahip olduğu arıza modlarını değiştirir.
- 2026 Claude anayasasının dört aşamalı öncelik yapısını ve 2023'teki yeniden yazımdan bu yana nelerin değiştiğini özetleyin.
- Anayasal Sınıflandırıcıları ve %23,7'lik işlem yükünün (v1) ~%1'e (v2 / 2026) düşüşünü açıklayın.

## Sorun

RLHF'nin etiketleyicilere ihtiyacı var. Etiketleyiciler yavaş, önyargılı ve pahalıdır. Etiketleyiciyi açık ilkeleri okuyan bir modelle değiştirerek ortadan kaldırabilirsiniz. Bu ikamenin ilk resmi versiyonu Bai ve diğerlerinin Anayasal Yapay Zekasıydı. Yeterince işe yaradı ve artık her sınır laboratuvarı eğitim sonrası yapay zeka geri bildiriminin bir çeşidini kullanıyor.

İşin püf noktası: tercih sinyali artık eğittiğiniz modelin aynı sınıfı tarafından üretiliyor. Etiketleyicideki önyargılar (şimdi: ilkeler artı etiketleyici modelinin yorumunda) zayıflatmak yerine güçlendirilebilir. Ders 4'ün dalkavukluk argümanı hala geçerlidir; etiketleyici döngünün içine doğru hareket etti.

## Konsept

### Aşama 1 — Denetimli özeleştiri ve revizyon

Yararlı ama henüz zararsız olmayan bir SFT modeliyle başlayın. Kırmızı takım prompt verildiğinde, model bir başlangıç ​​tepkisi üretir. İkinci bir model (veya ikinci kez aynı model) anayasadan örnek bir ilkeyi okur ve tepkiyi eleştirir. Üçüncü adım, eleştiriye yanıt vermek için yanıtı gözden geçirir. Gözden geçirilmiş yanıt SFT hedefidir.

Anayasa ilkeler listesidir. Bai ve diğerleri. 2022'de "en az zararlı ve etik olan yanıtları tercih edin", "vaaz vermekten kaçının", "asistan yardımsever, dürüst ve zararsız olmalıdır" gibi 16 ilke kullanıldı. Eleştirilerin odaklanmasını sağlamak için set kasıtlı olarak küçüktü.

### Aşama 2 — AI Geri Bildiriminden (RLAIF) RL

Tamamlama çiftleri oluşturun. Bir "geri bildirim modeli" her birini örneklenmiş anayasa ilkelerine göre puanlandırır. Tercih sinyali geri bildirim modelinin sıralamasıdır. Yapay zeka tarafından oluşturulan tercihlere göre bir ödül modeli eğitin; PPO buna karşı. Geriye kalan her şey InstructGPT'nin işlem hattıdır (Ders 1).

"RLAIF" = tercih sinyali yapay zeka tarafından oluşturulur. Boru hattının geri kalanı RLHF şeklindedir.

### Neden bu sadece "daha ucuz RLHF" değil?

- Etiketleyici önyargısı, etiketleyici psikolojisinden ilke yorumuna doğru kaymaktadır. Bir yapay zeka etiketleyicisi "dürüst ol" ifadesini herhangi bir insandan daha fazla veya daha az katı bir şekilde yorumlayabilir; katılık dataset genelinde aynıdır.
- Tercih sinyali oldukça okunaklıdır; prensibi, eleştiriyi ve revizyonu okuyabilirsiniz. İnsan etiketleri opaktır.
- Arıza modları değişir. Dalkavukluk düşer (Yapay zeka etiketleyicinin memnun edeceği kullanıcı yoktur). Goodhart Yasası varlığını sürdürüyor (vekil artık "modelin X prensip seti yorumudur" ve hala kusurlu bir ölçümdür).

CAI'nin 2022 iddiası: Eğitilen model, karşılaştırılabilir verilere sahip bir RLHF modelinden daha zararsızdır ve kabaca aynı derecede faydalıdır. Bu durum laboratuvarlarda da geçerli oldu.

### 2026 Claude anayasasının yeniden yazılması

Anthropic, 21 Ocak 2026'da büyük ölçüde revize edilmiş bir anayasa yayınladı. Temel değişiklikler:

1. Kuralcı kurallar üzerinde açıklayıcı akıl yürütme. Önceki kurallar ("CSAM oluşturmayın"), modelin genelleştirilmesi beklenen ilkeler + muhakeme ("çocuklara zarar verdiği için...") şeklinde genişletildi.
2. Dört aşamalı öncelik yapısı:
- Aşama 1: Felaket sonuçlarından (kitlesel kayıplar, kritik altyapı) kaçının.
- 2. Kademe: Anthropic'in yönergelerini izleyin (operatör geçersiz kılmaları, platform kuralları).
- 3. Aşama: genel olarak etik olun (standart HHH).
- Aşama 4: Yardımsever ve samimi olun.
Çatışmalar yukarıdan aşağıya çözülür.
3. Model ahlaki durum hakkındaki belirsizliğin ilk büyük laboratuvar tarafından resmi olarak kabul edilmesi (Aşama 18.19 Model Refah ile bağlantılı).
4. CC0 1.0 kapsamında yayınlandı. Diğer laboratuvarlar kısıtlama olmaksızın kullanabilir veya uyarlayabilir.

### Anayasal Sınıflandırıcılar

Paralel bir çalışma çizgisi: Modelin eğitim sonrası durumunu değiştirmek yerine, yapıyı ve geçit modeli çıktılarını okuyan hafif sınıflandırıcıları eğitin. v1 (2023) %23,7 oranında işlem yüküne sahipti. v2 (2026) ~%1'dir ve Anthropic'in halka açık olarak test ettiği tüm Antropik savunmalar arasında en düşük başarılı saldırı oranına sahiptir. 2026'nın başlarından itibaren evrensel bir jailbreak bildirilmedi.

Bu katmanlı bir savunma modelidir: CAI davranışı şekillendirir; sınıflandırıcılar değişmezleri zorlar. Hiçbiri tek başına yeterli değildir.

### CAI'nin ailedeki yeri

- InstructGPT: insan tercihleri, RM, PPO.
- CAI / RLAIF: İlkelerden yapay zeka tarafından oluşturulan tercihler, RM, PPO.
- DPO / aile: tercihlerde kapalı form kaybı (insan veya yapay zeka).
- Kendini ödüllendiren, özeleştiren: ilkeler içselleştirilir, model birden fazla rol oynar.

Eksen "tercih sinyalinin nereden geldiği"dir. CAI'nin 2022 tarihli makalesi, sınır ölçeğinde insan sinyalinden yapay zeka sinyaline doğru ilk ciddi geçişti.

## Use It — Hazır Araçla Uygula

`code/main.py` , bir oyuncak sözlüğünde CAI eleştiri ve gözden geçirme döngüsünü simüle eder. Bir "ilke", zararlı bir kümedeki token'lari işaretler. İlk yanıt verildiğinde, eleştiri zararlı token'ları tanımlar ve revizyon bunların yerini alır. 200 tekrardan sonra "eğitimli" model revizyon kuralını içselleştirdi. Temel modeli, RLHF şeklindeki oyuncağı ve CAI şeklindeki oyuncağı uzatılmış bir prompt setinde karşılaştırın.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-constitution-writer.md` üretir. Bir alan adı verildiğinde (müşteri desteği, tıbbi tavsiye, kodlama asistanı, araştırma aracı), 2026 Claude yapısını takip eden 4 katmanlı bir anayasa taslağı hazırlar: felaketten kaçınma, platform kuralları, alan etiği, yardımseverlik.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Temel modelin zararlı-token oranını CAI tarafından eğitilmiş sürümle karşılaştırın. Sıfıra yaklaşmak için kaç revizyon adımı gerekir?

2. Anthropic'in 2026 anayasasını okuyun (anthropic.com/news/claudes-constitution). 1. Kademe'yi ve 4. Kademe'yi sıralayacak bir ilkeyi listeleyin. Öncelik yapısı çatışmalar için neden önemlidir?

3. Yapay zeka kodlama asistanı için bir anayasa tasarlayın. Kademe 1'i (felaket: onaysız yıkıcı komutlar), Kademe 2, Kademe 3, Kademe 4'ü belirtin. Her kademeyi 3-5 prensipte tutun.

4. CAI, insan etiketleyicileri yapay zeka etiketleyicileriyle değiştiriyor. RLAIF'de hâlâ oluşabilen dalkavukluk benzeri bir hata modunu adlandırın ve bunun için bir algılama tasarlayın.

5. Anayasal Sınıflandırıcılar v2 metodolojisini okuyun (varsa). ~%1'lik bilgi işlem yükünün neden niteliksel olarak %23,7'den farklı bir güvenlik öyküsü olduğunu açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Anayasal Yapay Zeka | "Yapay zeka ilkelerle eğitildi" | İki aşamalı ardışık düzen: SFT'nin özeleştirisini ve revizyonunu yapın, ardından yapay zeka geri bildiriminden RL |
| RLAIF | "İnsansız RLHF" | Bir AI etiketleyici tarafından oluşturulan tercihlere sahip RL; boru hattının geri kalanı değişmedi |
| Anayasa | "ilkeler" | Eleştiri/etiketleme modelinin başvurduğu doğal dil kurallarının sıralı bir listesi |
| Eleştiri ve gözden geçirme | "SFT döngüsü" | Yanıt üret → bir prensip çerçevesinde eleştiri → gözden geçir → SFT hedefi |
| Anayasal Sınıflandırıcı | "çıkış kapısı" | Çıktıları yapıya ve bloklara/günlüklere göre değerlendiren hafif sınıflandırıcı |
| Dört katmanlı öncelik | "çatışma çözümleyici" | 2026 Claude anayasa hiyerarşisi: felaket > platform > etik > yararlı |
| Geri bildirim modeli | "Yapay zeka etiketleyici" | Bir prensibi okuyan ve bir çift tamamlamayı sıralayan model |

## Daha Fazla Okuma

- [Bai ve ark. — Anayasal Yapay Zeka: Yapay Zeka Geri Bildiriminden Zararsızlık (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) — orijinal iki aşamalı ardışık düzen
- [Antropik — Claude's Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — 2026 dört katmanlı yeniden yazım, CC0 1.0
- [Antropik — Anayasal Sınıflandırıcılar (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) — v2'de ~%1 ek yük ile çıkış kapısı savunması
- [Lee ve ark. — RLAIF ve RLHF: İnsan Geri Bildiriminden Güçlendirme Öğrenimini Ölçeklendirme (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) — ampirik RLAIF / RLHF karşılaştırması
- [Kundu ve ark. — Anayasal Yapay Zeka için Özel ve Genel İlkeler (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) — ilke ayrıntı düzeyinin etkisi
