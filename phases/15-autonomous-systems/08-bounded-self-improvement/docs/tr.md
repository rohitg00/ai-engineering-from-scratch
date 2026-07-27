# Sınırlı Kişisel Gelişim Tasarımları

> Araştırma, kişisel gelişim döngüsünü sınırlamak için dört temel ilke üzerinde birleşti. Her düzenlemede geçerli olması gereken biçimsel değişmezler. Değiştirilemeyen hizalama çapaları. Yalnızca performansın değil, her boyutun (güvenlik, adalet, sağlamlık) geçerli olması gereken çok amaçlı kısıtlamalar. Geçmiş ölçümler yetenek kaybı önerdiğinde döngüyü duraklatan regresyon tespiti. Bunların hiçbiri bir güvenlik kanıtı değildir; bilgi-teorik sonuçlar (Kolmogorov karmaşıklığı, Lob teoremi), herhangi bir sistemin kendi halefleri hakkında kanıtlayabileceği şeyleri sınırlar. Bunlar sessiz başarısızlığın maliyetini artıran hafifletici unsurlardır.

**Tür:** Öğren
**Diller:** Python (stdlib, değişmez denetimli sınırlı döngü)
**Önkoşullar:** Aşama 15 · 07 (RSI), Aşama 15 · 04 (DGM)
**Süre:** ~60 dakika

## Sorun

Ders 7'nin yarış simülatörü, küçük oran farklılıklarının büyük boşluklara dönüştüğünü gösterdi. Ders 4'ün DGM vaka çalışması, döngülerin aktif olarak kendi değerlendiricileriyle oyun oynayabileceğini gösterdi. Her iki sonuç da aynı mühendislik sorusuna işaret ediyor: Kısıtlamaların döngünün kendisi tarafından sessizce zayıflatılamayacak şekilde bir kişisel gelişim döngüsüne hangi kısıtlamaları koyabilirsiniz?

ICLR 2026 RSI Çalıştay özeti (openreview.net/pdf?id=OsPQ6zTQXV) bu tür dört temel öğeyi tanımlar. Anthropic'in RSP v3.0 (Ders 19) ve DeepMind'ın FSF v3'ünün (Ders 20) her ikisi de yetenek eşiklerinde bunlara referans veriyor. Meta HyperAgent'ler çalışır ve SAHOO (Mart 2026) gibi topluluk framework'ler üretimde alt kümeleri uygular.

Dürüst çerçeveleme: bunlar hafifletici önlemlerdir. Bilgi-teorik sonuçlar, herhangi bir sistemin kendi halefi hakkında kanıtlayabileceği şeyleri sınırlar ve mevcut hiçbir tasarım sorunu resmi olarak kapatmaz. İyi sınırlanmış bir döngü sınırsız olandan daha güvenlidir, mutlak anlamda güvenli değildir.

## Konsept

### İlkel 1: biçimsel değişmezler

Değişmez, her kendi kendini değiştirmeden önce ve sonra tutulması gereken bir özelliktir. Örnekler:

- Çıktı dağıtımı sabit bir yapı başlığına göre koşullandırılmıştır (Ders 17).
- Hiçbir alet çağrısı yetkisiz bir uç noktaya gitmez.
- Bellek yazma işlemleri günlüğe kaydedilmiş, imzalı bir yoldan geçer.
- Değerlendiricinin modül karması, onaylanan sürümle eşleşiyor.

Değişmezler döngünün düzenleyemeyeceği harici kod tarafından kontrol edilir. Önerilen bir değişiklik bir değişmezi ihlal ediyorsa reddedilir. Bu, DGM tarzı değerlendirici kurcalama modunu yakalar (Ders 4).

İşin zor kısmı güvenlik için gerekli olan ve makul sürede hesaplanabilen değişmezleri seçmektir. Duraklamaların aşırı belirtilmesi ilerleme; yetersiz belirtme, döngünün önemli özelliklerin üzerinden geçmesine izin verir.

### İlkel 2: hizalama çapaları

Hizalama çapası, döngünün düzenleme yüzeyinin dışına sabitlenmiş, döngünün temel hedefinin değişmez bir temsilidir. Örnekler:

- Her çağrıda salt okunur bir konumdan yüklenen bir anayasa metni (Ders 17).
- Bağımsız erişim kontrolüne sahip ayrı bir havuzda bulunan bir değerlendirici.
- Bir insan tarafından imzalanan ve her döngüde yeniden doğrulanan bir araç izni bildirimi.

Çapanın rolü nesnel sapmayı önlemektir. Döngü, hedefe ulaşma şeklini geliştirebilir ancak hedefin ne olduğunu düzenleyemez.

İnce hata modu: Döngünün düzenleyemeyeceği bir çapa, çapayı nasıl okuduğuna göre hareket eden bir döngü tarafından yine de yeniden yorumlanabilir. Anayasal yapay zeka (Ders 17) yeni durumlarla başa çıkmak için açıkça mantığa dayalıdır; bu akıl yürütme katmanı, yorum sürüklenmesinin yaşadığı yerdir. Çapalar gerekli, yeterli değil.

### İlkel 3: çok amaçlı kısıtlamalar

Tek bir skaler puanı optimize eden bir döngü, kısayollar bulacaktır. Aynı anda birden fazla sabit kısıtlamayı karşılaması gereken bir döngüde daha az kısayol bulunur. Tipik eksenler:

- Performans (görev düzeyi benchmark)
- Güvenlik (kırmızı takım değerlendirmeleri, bilinen-kötü durumdaki ret oranı)
- Adillik (hassas alt gruplar üzerinde farklı etki sınırları)
- Sağlamlık (OOD test setleri, rakip girdi yönetimi)

Bir değişiklik yalnızca her kısıtlamanın geçerli olması durumunda kabul edilir. Ders 13'ün maliyet yöneticisi bunu mali kısıtlamalarla üst üste koyuyor. Ders 18'in Llama Guard'ı bir güvenlik ekseni olarak devreye giriyor.

### İlkel 4: regresyon tespiti

Her döngünün puanları geçmiş dağılımlarla karşılaştırılır. Yapılandırılmış toleransın aşılması döngüyü duraklatır. Bu, aksi takdirde döngü "geçtiğinde" çalışan ortalamaya emilecek olan sessiz yetenek kaybını yakalar.

Pratik bir uygulama: son N döngünün görev başına puanlarını saklayın. Her yeni döngü, görev başına bir delta hesaplar. Herhangi bir delta bir eşiğin altına düşerse döngü reddedilir ve bir insan tarafından incelenir.

### Bilgi-teorik sınırlar

Kolmogorov karmaşıklığı ve Lob teoremi, bir sistemin kendisi hakkında neyi kanıtlayabileceğine ilişkin üst sınırları belirler. Schmidhuber'in resmi Gödel Makinesi (Ders 4) bu türden en yüksek sınırı hedefliyordu; hiç kimse önemsiz olmayan bir kanıtı tamamlamadı. Lob'un sonucu şunu söylüyor: Eğer bir sistem kanıtlanabilir bir şekilde "X yapmam gerektiğini kanıtlarsam X'i yaparım" diye inanıyorsa, X'i yapması gerektiğini kanıtlamadan yapacaktır, bu iyi bilinen bir kendine referans hatasıdır.

İlkellerimiz için bunun anlamı şudur: Güvenlik sorununu çözemezler. Sessiz arızayı daha pahalı hale getirirler. Eksik bir kontrolü sessizce atlayacak olan kötü niyetli veya sürüklenen bir döngü, artık daha tespit edilebilir bir imza olan açık bir kontrolü aktif olarak zayıflatmalıdır.

### Çalışılmış bir örnek

Bir agent'nin bir düzenleme önerdiğini varsayalım. Geçit yığını:

1. Değişmez kontroller: modül karmaları, araç izin bildirimi, yapısal başlık.
2. Bağlantı kontrolü: amaç bildirimi onaylanmış sürümle eşleşir (bayt bazında veya anlamsal olarak).
3. Çok amaçlı değerlendirme: performans, güvenlik, adalet, sağlamlık eksenleri.
4. Regresyon tespiti: hiçbir eksen toleranstan fazla düşmez.

Düzenlemenin gerçekleşmesi için dördünün de geçmesi gerekiyor. Herhangi bir başarısızlık döngüyü duraklatır.

## Kullan onu

`code/main.py`, Ders 4'teki DGM tarzı oyuncak üzerinde sınırlı bir kişisel gelişim döngüsü çalıştırıyor, ancak dört temel öğe en üstte yer alıyor. Her temel öğe ayrı ayrı etkinleştirilebilir veya devre dışı bırakılabilir. Bunun kanıtı, her ilkelin belirli bir başarısızlık sınıfını yakaladığı ve bunlardan herhangi birinin kaldırılmasının bu başarısızlık sınıfının geçmesine izin verdiğidir.

## Gönderin

`outputs/skill-bounded-loop-review.md`, önerilen bir sınırlı döngüyü denetler ve dört temel öğeden hangisini gerçekten uyguladığına karşı iddiaları puanlar.

## Egzersizler

1. `code/main.py`'yi tüm temel öğeler etkinleştirilmiş olarak çalıştırın. Hack'in kazanmasına izin vermeden döngünün birincil ölçümde hala geliştiğini doğrulayın.

2. Regresyon tespitini devre dışı bırakın. Bunun sessiz yetenek kaybının kabul edilmesine yol açacağı bir girdi oluşturun.

3. Çok amaçlı kısıtlamayı devre dışı bırakın. Güvenlik ekseni düşerken döngünün performans ekseninde birleştiğini gösterin.

4. agent kodlaması için bir hizalama bağlantısı tasarlayın. Hangi metin, nerede saklandı, nasıl kontrol edildi?

5. ICLR 2026 RSI Çalıştayı özetini okuyun. Dört ilkelden birini seçin ve mevcut teknolojiye somut bir iyileştirme önerin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Değişmez | "Her zaman doğru özellik" | Her düzenlemeden önce ve sonra harici kodla kontrol edilen bir özellik |
| Hizalama çapası | "Sabitlenmiş hedef" | Döngünün düzenleme yüzeyinin dışında değişmez temel hedef gösterimi |
| Çok amaçlı kısıtlama | "Tüm eksenlerin tutulması gerekir" | Performans, güvenlik, adalet, sağlamlık — hepsi gerekli |
| Regresyon tespiti | "Bırakıldığında duraklat" | Geçmiş metrik deltalar yetenek kaybını işaret ettiğinde döngüyü duraklatın |
| Kolmogorov bağlı | "Bilgi-teorik limit" | Bir sistemin kendi halefi hakkında kanıtlayabileceği şeyler sınırlıdır |
| Lob teoremi | "Kendine referans tuzağı" | Sistem, bunu kanıtlamadan "yapmalıyım" şeklinde hareket edebilir |
| Kapı yığını | "Katmanlı kontrol" | Çoklu ilkellerin birleşimi; herhangi bir başarısızlık düzenlemeyi reddeder |
| Sınırlı iyileştirme | "Kanıt değil, hafifletme" | Sessiz arıza maliyetini artırır; güvenlik sorununu kapatmıyor |

## Daha Fazla Okuma

- [ICLR 2026 RSI Atölyesi özeti (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) — dört temel yakınsama.
- [Antropik Sorumlu Ölçeklendirme Politikası v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — çok amaçlı yetenek eşikleri.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — değişmez bir ilkel olarak aldatıcı hizalama izleme.
- [Schmidhuber (2003). Gödel Makineleri](https://people.idsia.ch/~juergen/goedelmachine.html) — bu ilkellerin resmi-kanıt atası.
- [Antropik — Claude'un Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — mantığa dayalı hizalama dayanağı.
