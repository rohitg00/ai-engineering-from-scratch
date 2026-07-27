# Otomatik Hizalama Araştırması (Antropik AAR)

> Anthropic, bağımsız sanal alanlarda Claude Opus 4.6 Otonom Hizalama Araştırmacılarından oluşan paralel ekipler çalıştırdı ve günlükleri herhangi bir sanal alanın dışında yaşayan paylaşılan bir forum aracılığıyla koordinasyon sağladı (böylece agent'ler kendi kayıtlarını silemez). Zayıftan güçlüye eğitim probleminde, AAR'lar insan araştırmacılardan daha iyi performans gösterdi. Anthropic'in iş akışlarını öngören kendi özet bayrakları genellikle AAR esnekliğini kısıtlar ve performansı düşürür. Hizalama araştırmasının otomatikleştirilmesi, zaman çizelgesini RSP'nin algılamayı amaçladığı tam hizalama risklerine göre sıkıştıran sıkıştırma adımıdır.

**Tür:** Öğren
**Diller:** Python (stdlib, paralel araştırma forumu simülatörü)
**Önkoşullar:** Aşama 15 · 05 (AI Scientist v2), Aşama 15 · 04 (DGM)
**Süre:** ~60 dakika

## Sorun

Hizalama araştırması, insan-araştırmacının zamanında pahalıdır. Ölçeklenebilir gözetim, ödül spesifikasyonu veya zayıftan güçlüye eğitim gibi sorunlar, yineleme başına haftalar süren deneyler gerektirir. Sınır yetenekleri geliştikçe uyum iş yükü, nitelikli araştırmacı arzından daha hızlı artıyor.

Otomatik Hizalama Araştırması (AAR), hizalamayı geride bırakan aynı sınır modellerinin aradaki farkı kapatmaya katkıda bulunup bulunamayacağını soruyor. Anthropic'in AAR tarafından yürütülen zayıftan güçlüye eğitim çalışmasına ilişkin 2026 raporu (alignment.anthropic.com/2026/automated-w2s-researcher/), bu sınıfta konuşlandırılmış bir sistemin ilk halka açık sonuçlarından biridir.

Sonuç gerçekten olumlu: AAR'lar bir araştırma problemini insani temelden daha iyi çözdü. Sonuç aynı zamanda bu aşamanın geliştirdiği her endişeyi tek bir sistemde yoğunlaştırıyor. Hizalama araştırması otomatikleştirilebiliyorsa, güvenlik önlemlerini tehlikeye atan parçalar da otomatikleştirilebilir. RSP'nin AI Ar-Ge yeteneği eşikleri bu döngü göz önünde bulundurularak yazılmıştır.

## Konsept

### Mimari (kamuya açıklandığı şekliyle)

- **Paralel agent'ler.** Birden fazla Claude Opus 4.6 örneği, her biri bağımsız bir sanal alanda AAR olarak çalışır. Korumalı alanlar dosya sistemini, ağı ve işlem yüzeyini sınırlar.
- **Paylaşılan forum.** Bulgular, depolama arka ucu her korumalı alanın dışında bulunan paylaşılan bir forumda yayınlanır. Agent'ler forumu okuyabilir; agent'ler forum kayıtlarını kendi sanal alanlarından silemez veya düzenleyemez.
- **Görev tahsisi.** İnsan tasarımı bir görev kuyruğu, araştırma problemlerini AAR'lara atar. AAR'lar ayrıştırma önerir, deneyler yapar, bulguları yazar.
- **Zayıftan güçlüye eğitim odağı.** Yayınlanan çalışma, daha güçlü bir öğrenci modelini eğitmek için daha zayıf bir yönetici modeli kullanarak, zayıftan güçlüye eğitimi ele aldı. AAR'lar bu görevde insan araştırmacılardan daha iyi performans gösterdi.

### Korumalı alanın dışındaki günlükler neden önemlidir?

Log-integrity özelliği, kontrollü bir deney ile potansiyel olarak tehlikeye atılmış bir deney arasındaki farktır. AAR'lar kendi günlüklerini düzenleyebilselerdi, başarısız veya şüpheli deneyleri örtbas edebilirlerdi. Antropik bunu doğrudan işaret ediyor: özellik, araştırma çıktısına güvenmek için gerekli bir koşuldur ve doğrulanması önemsiz değildir.

Altyapı açısından analog, harici depolamaya yazılabilen yalnızca eklemeli günlüklerdir (e.g.S3 nesne kilidi, değişmez Datadog günlükleri). agent'nin geçmiş kayıtları değiştirmeye yönelik hiçbir kimlik bilgisi yoktur. Bu, 2026 kurumsal güvenlik ekiplerinin fidye yazılımlarına dayanıklı denetim izleri oluşturmak için kullandığı modelin aynısıdır.

### Öngörülen iş akışı ödünleşimi

Anthropic'in raporu, öngörülen iş akışlarının sıklıkla AAR esnekliğini kısıtladığını ve performansı düşürdüğünü belirtiyor. Başka bir deyişle: Eğer insan tasarımcı araştırma planını adım adım yazarsa, AAR'lar üst düzey hedefler ve ayrıştırma özgürlüğü verildiğinde olduğundan daha kötü performans gösterir. Bu, agentic araştırmasının (LangGraph, Microsoft'un Agent Framework) sonuçlarıyla tutarlıdır - aşırı belirlenmiş yapı iskeleleri yetenekli agent'lere zarar verir.

Güvenlik etkisi incelikli. AAR performansını artıran esneklik aynı zamanda onaylanmamış ayrıştırmaya, yeni araç kullanımına ve hedef sapmasına izin veren esnekliktir. Takas, tasarım alanıyla ilgili bir karardır: agent'nin hedefleri dağıtım dışında genelleştirmesine izin vermeden, insanları yenmek için yeterli yeteneği ne kadar esneklik satın alabilir?

### Sıkıştırma riski

RSP v3.0 (Ders 19) bir Yapay Zeka Ar-Ge yeteneği eşiğini tanıtıyor: Yapay Zeka Ar-Ge hattını insan + yapay zeka araçlarına kıyasla rekabetçi maliyetle tamamen otomatikleştirme yeteneği. DeepMind'ın FSF v3'ü benzer bir ML Ar-Ge özerklik düzeyi içerir. Her iki framework de bu eşiği yükseltilmiş kontroller için tetikleyici olarak ele alır.

AAR, eşiğin bir adım gerisindedir: boru hattının bir kısmını (belirli, iyi kapsamlı görevler üzerinde uyum araştırması) otomatikleştirir, ancak uçtan uca yetenek geliştirme döngüsünü otomatikleştirmez. Zaman çizelgesi sorusu, farkın ne kadar hızlı kapanacağıdır.

Sıkıştırılmış zaman çizelgeleri, bileşik başarısızlık endişesidir. Uyum araştırması ve yetenek araştırması benzer oranlarda birleşirse, yanlış uyum riski yüzeyi en azından yetenek kadar hızlı büyür. Yetenek daha hızlı birleşirse (tarihsel eğilim), boşluk genişler. Bu, AAR'nin nitelikli bir mal olduğu yönündeki argümandır: her ek hizalama sonucu, ancak ve ancak araştırma süreci güvenilirse aradaki farkı azaltır.

### AAR neyin yerini almaz

İnsan araştırmacılar görev sırasını belirler, sonuçları gözden geçirir ve anayasal otoriteyi elinde tutar. AAR'lar boru hattının uçlarını değil ortasını hızlandırır. Anthropic'in yayınlanmış çıktıları, hem AAR katkılarını hem de neyin yayınlanacağı, neyin geri çekileceği ve neyin düzeltileceği konusunda insan-araştırmacının yargısını içerir.

Bu, araştırmanın kendisine uygulanan Ders 15'teki öner-sonra-taahhüt modeliyle eşleşir: AAR'lar teklif eder; insanlar taahhüt eder.

## Kullan onu

`code/main.py` çoklu AAR araştırma forumunu simüle eder. Üç bağımsız "araştırma agent" paralel olarak çalışır ve bulguları, isteğe bağlı kurcalama girişimleriyle yalnızca eklenen bir foruma gönderir.

İzle:

- Korumalı alan dışı günlük kaydının, günlükte değişiklik yapma girişimlerini nasıl yakaladığı.
- Serbest ayrıştırmayla görev tahsisinin, daha zorlu problemlerde sabit iş akışlarından nasıl daha iyi performans gösterdiği.
- Günlüğün tahrif edildiği açık değilse, güvenliği ihlal edilmiş tek bir AAR, forumun sinyalini nasıl bozabilir?

## Gönderin

`outputs/skill-aar-deployment-review.md`, otomatik hizalama araştırma hattının deployment öncesi incelemesidir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. "Sabit iş akışı" ile "serbest ayrıştırma" ayarlarını karşılaştırın. Serbest ayrıştırma her zaman kazanır mı, yoksa sabit iş akışının rekabetçi olduğu sorunlu sınıflar var mı?

2. Simülatörü, bir agent'nin günlüğe müdahale etmeye çalışacağı şekilde değiştirin. Yalnızca ekleme günlüğünün bunu algıladığını doğrulayın. Günlükte algılama imzasının tam olarak nasıl göründüğünü açıklayan bir paragraf yazın.

3. Anthropic'in zayıftan güçlüye AAR raporunu okuyun. AAR'ların insan araştırmacıları geride bıraktığı spesifik alt görevi tanımlayın. Onu otomasyona uygun kılan neydi?

4. AAR esnekliğini (daha iyi sonuçlar) öngörülen iş akışı kısıtlamalarına (daha kolay denetim) karşı dengeleyen bir görev kuyruğu tahsis politikası tasarlayın. İkisini nasıl A/B testine tabi tutacağınızı açıklayın.

5. RSP v3.0'nin AI Ar-Ge-4 eşiğini okuyun. Bir paragrafta, AAR'ın şu anda aşmadığını düşündüğünüz şeyleri açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| AAR | "Otomatik Hizalama Araştırmacısı" | Claude Opus 4.6 örneği hizalama sorunları üzerinde bağımsız olarak çalıştırıldı |
| Zayıftan güçlüye antrenman | "Daha zayıf bir yöneticiyle daha güçlü bir modeli eğitmek" | Klasik ölçeklenebilir gözetimli benchmark AAR'lar insanlardan daha iyi performans gösterdi |
| Paylaşılan forum | "agent'lerin bulguları yayınladığı yer" | Yalnızca ekleme amaçlı, korumalı alan dışı depolama |
| Korumalı alan dışı günlük | "Agent kendi kaydını düzenleyemiyor" | Harici depolamaya kurcalanmaya karşı korumalı yazma |
| Öngörülen iş akışı | "Tasarımcının insandan adım adım planı" | AAR'yi kısıtlar; serbest ayrışmaya karşı genellikle performansı düşürür |
| Serbest ayrıştırma | "Agent görevin nasıl sonlandırılacağına karar verir" | Daha yetenekli, denetlenmesi daha zor |
| Yapay Zeka Ar-Ge eşiği | "RSP/FSF yetenek düzeyi" | Rekabetçi maliyetle Ar-Ge hattının tam otomasyonu |
| Sıkıştırılmış zaman çizelgesi | "Hizalama ve yetenek yarışı" | Yetenek hizalamadan daha hızlı birleşirse, yanlış hizalama riski artar |

## Daha Fazla Okuma

- [Antropik — Otomatik Zayıftan Güçlüye Araştırmacı](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — birincil kaynak.
- [Antropik Sorumlu Ölçeklendirme Politikası v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — Yapay Zeka Ar-Ge eşik çerçevesi.
- [Antropik — Yapay Zeka agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — daha geniş agent özerklik çerçevesi.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — RSP'ye paralel makine öğrenimi Ar-Ge özerklik seviyeleri.
- [Burns ve ark. (2023). Zayıftan Güçlüye Genelleme (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — AAR'ların saldırdığı temel sorun.
