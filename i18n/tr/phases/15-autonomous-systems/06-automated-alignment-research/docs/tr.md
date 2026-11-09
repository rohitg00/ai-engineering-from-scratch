# Otomatik Düzeltme Araştırması (Antropik AAR)

> Anthropic, bağımsız kum kutularında Claude Opus 4.6 Autonomous Alignment Araştırmacılarının paralel ekiplerini çalıştı ve kayıtları herhangi bir kum kutuunun dışında yaşayan paylaşılan bir forum aracılığıyla koordine etti (bu nedenle ajanlar kendi kayıtlarını silemezler). Zayıf-güçlü eğitim sorunu konusunda AAR'lar insan araştırmacılarını geçirdi. İş akışlarını belirleyen Anthropic'in kendi özetli bayrakları genellikle AAR esnekliğini kısıtlar ve performansını düşürür. Otomatik uyum araştırması zaman çizgisini sıkıştırır ve RSP'nin tespit etmek amacıyla aynı yanlış uyum riskleri üzerine bunu yapar.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Sorun

Düzeltme araştırmaları insan- araştırmacı zamanında pahalıdır. Ölçeklenebilir denetim, ödül spesifikasyonu veya zayıf-güçlü eğitim gibi sorunlar, her tekrarlama için haftalar süren deneylere ihtiyaç duyar. Sınır yetenekleri ilerledikçe, düzeltme iş yükü nitelikli araştırmacıların tedarikinden daha hızlı büyür.

Otomatik Alignment Research (AAR), aynı sınır modellerinin, sınırlandırmayı aşma kapasitesinin bu boşluğu kapatmaya katkıda bulunabileceklerini sorar. Anthropic'in AAR tarafından yürütülen zayıf-güçlü eğitim çalışması (alignment.anthropic.com/2026/automated-w2s-researcher/) hakkındaki 2026 raporu, bu sınıfın dağıtılmış bir sisteminden ilk kamu sonuçlarından biridir.

Sonuç gerçekten olumlu: AAR'lar bir araştırma sorunu insan başlangıç çizgisinden daha iyi çözdü. Sonuç aynı zamanda bu aşamada gelişen her kaygıyı tek bir sistemde yoğunlaştırır. Düzeltme araştırması otomatik hale getirilebilirse, korumaları tehlikeye atan parçalar da otomatik hale gelebilir.

## Anlaşım

### Mimarlık (açıkça açıklandığı gibi)

- **Parallel agents.**Claude Opus 4.6'un birden fazla örneği, her biri bağımsız bir kum kutuunda AAR olarak çalışır. Kum kutuları dosya sistemini, ağını ve işlem yüzeyini sınırlandırır.
- **Shared forum.**Bulgular her kum kutuunun dışında bulunan depolama arka planı bulunan bir paylaşılan forumda yayınlanır. Ajanlar forumı okuyabilir; Ajanlar kendi kum kutuları içinde forum kayıtlarını silemez veya düzenleyemez.
- **Task allocation.**İnsan tasarımındaki görev kuyrukları AAR'lara araştırma sorunları atfeder. AAR'lar parçalanma önerileri, deneyler yürütmek, bulguları yazmak.
- **Weak-to-strong training focus.**Yayınlanan çalışma, zayıf-güçlü eğitimi  daha güçlü bir öğrenci modeli eğitmek için daha zayıf bir denetçi modelini kullanarak ele aldı.

### Kum kutusundan çıkmış günlük neden önemli?

Log-integrity özelliği, kontrol edilen bir deney ile potansiyel olarak tehlikeye girebilecek bir deney arasındaki farkdır. AAR'lar kendi günlüğlerini düzenleyebilse, başarısız veya şüpheli deneyleri örtbas edebilir. Antropik bunu doğrudan işaretler: özelliği araştırma çıkışına güvenmek için gerekli bir şarttır ve doğrulama önemsiz değildir.

Altyapı açısından analog sadece ekleme kayıtları dış depolama (örneğin S3 nesne kilitleme, değişmez Datadog kayıtları) ile yazılıdır. Ajanın geçmiş kayıtları değiştirmek için yetkisi yoktur. Bu 2026 kurumsal güvenlik ekiplerinin ransomware- dirençli denetim izleri yapmak için kullandığı aynı kalıp.

### Önlenmiş iş akışı bozukluğu

Anthropic'in raporunda belirtilen iş akışlarının genellikle AAR esnekliğini kısıtladığını ve performansı düşürdüğünü belirtti. Başka bir deyişle: insan tasarımcısı araştırma planını adım adım yazarsa, AAR'lar yüksek düzeyde hedefler ve parçalanma özgürlüğü verildiğinde daha kötü sonuçlar elde eder. Bu, ajan araştırmaları (LangGraph, Microsoft'un Agent Framework)  aşırı belirlenmiş asfaltlar yetenekli ajanları zarar verir.

Güvenlik anlamı ince. AAR performansını iyileştiren esneklik aynı zamanda onaylanmamış parçalanma, yeni araç kullanım ve hedef kaydırma izin veren esnekliktir.

### Sıkıştırma riski

RSP v3.0 (Desin 19) bir AI R&D yetenek eşiği tanıttı: rekabetçi maliyet vs. insan + AI araçları ile AI R&D borusunu tamamen otomatikleştirme yeteneği. DeepMind'in FSF v3 benzer bir ML R&D özerklik seviyesini içerir. Her iki çerçeve de bu eşiği yükseltilmiş kontrollerin tetikçisi olarak ele alıyor.

AAR, eylemi bir adım daha azdır: borunun bir kısmını otomatikleştirir (özel, iyi kapsamlı görevler üzerinde uyum araştırmaları), ancak son-son kapasite geliştirme döngüsünü değil.

Sıkıştırılmış zaman çizgileri, birleşme başarısızlığı endişesi. Düzeltme araştırmaları ve kapasite araştırması benzer hızlarla birleşirse, yanlış uyum sağlama riski yüzeyi, kapasite kadar hızlı büyür. Eğer yetenekler daha hızlı bir şekilde (tarihi eğilim) artarsa, fark genişler. Bu, AAR'ın nitelikli bir mal olması için bir argüman: Her ek uyumlandırma sonucu, araştırma sürecinin güvenilir olması durumunda ve yalnızca bu sürece farkı azaltır.

### AAR'ın yerine ne geçmez

İnsan araştırmacıları görev sırasını belirler, sonuçları inceler ve anayasal yetkiyi tutar. AAR'lar boru hattının ortasını hızlandırır, sonları değil. Anthropic'in yayınlanan çıkışları hem AAR katkılarını hem de neyi yayınlamak, neyi geri çekmek ve neyi geliştirmek gerektiği konusunda insan- araştırmacı yargısını içerir.

Bu, araştırmaya uygulanan Ders 15'in önerme-doğrusu-yaptırma örneğine uyuyor: AAR'lar önerir; insanlar görev yapar.

```figure
aar-forum
```

## Kullan

`code/main.py`Üç bağımsız " araştırma ajanı " paralel olarak çalışarak bulguları yalnızca ekleme forumuna, seçmeli bozukluk denemeleri ile yayınlar.

- Gözleyin.

- Kum kutusundan çıkmış kayıplar kayıpları bozmaktan nasıl kaçınıyor?
- Özgür parçalanma ile görev dağılımı daha zor sorunlar üzerinde sabit iş akışlarını nasıl üstlenir.
- Bir tek compromised AAR forum sinyalini bulaştırır nasıl eğer kayıt tamir edici değilse.

## Gönder

`outputs/skill-aar-deployment-review.md`otomatik uyumlama-kağıt araştırma hattının, yerleştirilmeden önce bir incelemesi.

## Egzersizler

1. Çık .`code/main.py`"Sıkı iş akışı" ile "savaşsız parçalanma" ayarlarını karşılaştırın.

2. Simülatörü değiştirin, böylece bir ajan kayıt kayıtlarını değiştirmeye çalışır. Sadece eklenen kayıt kayıtlarını tespit etmesini onaylayın.

3. Anthropic'in zayıf-güçlü AAR raporunu okuyun. AAR'ların insan araştırmacılarını yendiği belirli alt görevi belirleyin.

4. AAR esnekliğini (yani daha iyi sonuçlar) belirlenen iş akışı kısıtlamalarıyla (sederce denetim) dengeleyen görev sırası tahsis politikası tasarlayın.

5. RSP v3.0'un AI R&D-4 eşiğini okuyun. Bir paragrafda, AAR'ın şu anda yapmadığı aşmayı düşündüğünüz şeyi açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Daha Fazla Okumak

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) İlk kaynak.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) AI Araştırma ve Gelişim Eğlence Çelişkisi çerçevesinde.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) daha geniş bir ajan-özerk çerçevesini oluşturmak.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML Araştırma ve Gelişim özerkliği seviyeleri RSP ile paralel.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) AAR'ların saldırdığı temel sorun.
