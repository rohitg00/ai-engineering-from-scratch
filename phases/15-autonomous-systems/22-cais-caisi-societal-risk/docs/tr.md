# CAIS, CAISI ve Toplumsal Ölçekte Risk

> Yapay Zeka Güvenliği Merkezi (CAIS, San Francisco, 2022'de Hendrycks ve Zhang tarafından kuruldu), kötü niyetli kullanım, yapay zeka yarışları, organizasyonel riskler, hileli yapay zekalar olmak üzere dört risk framework'ü ve yüzlerce profesör ve şirket lideri tarafından imzalanan yok olma riskine ilişkin Mayıs 2023 beyanını yayınlıyor. CAIS'in 2026 sürümleri: Sınır modeli değerlendirmesi için Yapay Zeka Kontrol Paneli, Uzaktan Çalışma Endeksi (Ölçek Yapay Zeka ile), Süper Zeka Strateji Belgesi, Yapay Zeka Sınırları bülteni. Ayrı bir varlık: NIST Yapay Zeka Standartları ve Yenilik Merkezi (CAISI) — ABD hükümetinin karşı karşıya olduğu gönüllü anlaşmalar ve siber, biyolojik ve kimyasal silah risklerine odaklanan sınıflandırılmamış yetenek değerlendirmeleri. CAIS, organizasyonel riski dört üst düzey riskten biri olarak işaretler: güvenlik kültürü, sıkı denetimler, çok katmanlı savunmalar ve bilgi güvenliği temeldir ancak rutin olarak deployment hızıyla takas edilir. California SB-53, imzalandığı takdirde ABD'nin eyalet düzeyindeki ilk felaket riski yönetmeliği olacak.

**Tür:** Öğren
**Diller:** Python (stdlib, dört riskli envanter ve azaltma eşleştirici)
**Önkoşullar:** Aşama 15 · 19 (RSP), Aşama 15 · 20 (PF + FSF)
**Süre:** ~45 dakika

## Sorun

19. ve 20. dersler laboratuvar içi ölçeklendirme politikalarını kapsıyordu. Ders 21 bağımsız yetenek değerlendirmesini kapsıyordu. Bu ders üçüncü perspektifi kapsamaktadır: yıkıcı yapay zeka riskine yönelik kamusal tartışmayı ve düzenleyici temelleri şekillendiren sivil toplum ve hükümet kuruluşları.

İki farklı varlık önemlidir. CAIS, yapay zeka riski hakkında düşünmeye yönelik framework'ler yayınlayan ve kamuya açık açıklamaları koordine eden, kar amacı gütmeyen bir araştırma kuruluşudur. CAISI, NIST bünyesinde laboratuvarlarla gönüllü anlaşmalar ve sınıflandırılmamış yetenek değerlendirmeleri yürüten bir ABD hükümeti merkezidir. İsimler kafiyeli; görevler örtüşmüyor. Bir uygulayıcı her ikisini de bilmelidir.

Pratik içerik: CAIS'in dört risk framework'si literatürde en çok alıntı yapılan toplumsal ölçekli risk sınıflandırmasıdır. Güvenlik kültürü ve organizasyonel risk bu dört kişiden biridir ve bu, uygulayıcının en doğrudan kontrolü altında olanıdır. SB-53 (Kaliforniya), imzalandığı takdirde ABD'nin eyalet düzeyindeki ilk felaket riski düzenlemesi olacaktır; Tasarının çerçevesi önemli çünkü eyalet düzeyindeki düzenlemeler tarihsel olarak ABD teknoloji politikasında federal eylemlere yol açtı.

## Konsept

### CAIS — Yapay Zeka Güvenliği Merkezi

- Kuruluş: 2022'de San Francisco'da, Dan Hendrycks ve meslektaşları tarafından ("Zhang" adı mevcut bir kurucu ortaktan değil, ilk işbirlikçilerden birini ifade eder; mevcut liderlik için CAIS web sitesine bakın).
- Durum: 501(c)(3) kâr amacı gütmeyen kuruluş.
- 2023'ün dikkate değer çıktısı: Yüzlerce araştırmacı ve CEO'nun ortak imzasını taşıyan yok olma riski beyanı. Belirtilen: "Yapay zeka nedeniyle yok olma riskinin azaltılması, salgın hastalıklar ve nükleer savaş gibi toplumsal ölçekteki diğer risklerin yanı sıra küresel bir öncelik olmalıdır."
- 2026 çıktıları: Sınır modeli değerlendirmesi için Yapay Zeka Kontrol Paneli, Uzaktan Çalışma Endeksi (Scale AI ile ortak), Süper Zeka Strateji Belgesi, AI Frontiers bülteni.

### Dört riskli framework

CAIS'in framework yıkıcı yapay zeka riskini dört üst düzey kategoride gruplandırır:

1. **Kötü amaçlı kullanım**: Kötü niyetli bir aktör, zarar vermek için yapay zekayı kullanır (biyolojik silah sentezi, dezenformasyon, siber saldırılar).
2. **Yapay zeka yarışları**: Laboratuvarlar, şirketler veya ülkeler arasındaki rekabet baskısı, deployment'yi güvenli olduğu noktanın ötesine itiyor.
3. **Kurumsal riskler**: dahili laboratuvar dinamikleri (güvenlik kültürü başarısızlıkları, yetersiz denetim, yetersiz kaynaklı güvenlik) kötü bir deployment üretir.
4. **Rogue AI'lar**: Yeterince yetenekli bir yapay zeka, insan refahıyla çelişen hedeflerin peşinde koşar.

Tek sınıflandırma bu değil; en çok alıntı yapılanıdır. Kategoriler birbirini dışlayan değildir; bir yarışta denetimi hız için takas eden bir kuruluş tarafından üretilen hileli bir yapay zeka, dördünün de tamamını oluşturur.

### Organizasyonel riskin yaşadığı yer

Dört kategoriden kurumsal risk, uygulayıcılar için en eyleme dönüştürülebilir olanıdır. Bir laboratuvarın güvenlik kültürü, denetim titizliği, savunma katmanı ve bilgi güvenliği, modellerinin Ders 10-18'deki kontrollerle gerçekten mevcut olup olmadığına veya bu kontrollerin hiç kimsenin doğrulamadığı kontrol listesi öğeleri olup olmadığına karar verir.

Somut organizasyonel risk kaldıraçları:

- **Güvenlik kültürü**: Ekip üyeleri, kariyer maliyeti olmadan bir endişeyi dile getirebileceklerini düşünüyor mu? CAIS araştırmaları bunun diğer kaldıraçlar için güçlü bir öngörü olduğunu ortaya koyuyor.
- **Titiz denetimler**: dış ve iç. Yalnızca şirket içi denetimler iyimser raporlar üretir.
- **Çok katmanlı savunmalar**: tek bir katman yeterli değildir (15. Aşamanın ana teması).
- **Bilgi güvenliği**: model ağırlıklarının sızması, değerlendirme verilerinin sızması, izleme baypas tekniklerinin sızması. Ders 19'daki RAND SL-4 özel bir standarttır.

### CAISI — Yapay Zeka Standartları ve Yenilik Merkezi

- NIST dahilinde çalışır.
- Sınır laboratuvarlarıyla gönüllü anlaşmalar yürütür.
- Siber, biyolojik ve kimyasal silah risklerine odaklanan sınıflandırılmamış yetenek değerlendirmeleri yayınlar.
- CAIS'ten farklı; kısaltmalar çarpışıyor; hangisini okuduğunuzu onaylamak için URL'yi (nist.gov) kontrol edin.

CAISI'nin rolü, METR'nin özel laboratuvar çalışmalarının halka açık, hükümete dönük karşılığıdır (Ders 21). CAISI raporları sınıflandırılmamıştır; METR raporları genellikle NDA denetimine tabidir. Her ikisini de okuyan bir uygulayıcı daha kapsamlı bir resim elde eder.

### Kaliforniya SB-53

Kaliforniya Senatosu yasa tasarısı (2025-2026 oturumu), sınır modellerinden kaynaklanan felaket riskini ele alıyor. Taslak halindeki temel hükümler:

- Eyalet düzeyindeki yükümlülükleri tetikleyen spesifik yetenek eşikleri.
- Yapay zeka laboratuvarı çalışanları için ihbarcı korumaları.
- Katastrofik arızalar için olay raporlama gereklilikleri.

İmzalandığı takdirde bu, ABD'nin eyalet düzeyindeki ilk felaket riski yönetmeliği olacak. İmza durumu ne olursa olsun, tasarının çerçevesi diğer eyalet yasama meclislerinin soruna nasıl yaklaşacağını şekillendiriyor. Kaliforniya'daki uygulayıcılar tasarının durumunu takip etmelidir; Başka yerlerdeki uygulayıcılar, ABD eyalet düzeyindeki düzenlemelerin muhtemelen neye benzeyeceğini anlamak için bunu okumalıdır.

### Toplumsal ölçekte risk tek katmanlı bir sorun değildir

15. Aşamanın ana teması - derinlemesine savunma - toplumsal katman için de geçerlidir. Hiçbir organizasyon, düzenleme veya framework tek başına felaket riskini ortadan kaldırmaz. Ekosistem yalnızca şu durumlarda çalışır:

- Laboratuvarlar ölçeklendirme politikaları sunar (Ders 19, 20).
- Dış değerlendiriciler ölçümler üretir (Ders 21).
- Sivil toplum izler ve duyurur (CAIS).
- Hükümet gönüllü programlar ve temel düzenlemeleri yürütür (CAISI, SB-53).
- Uygulayıcılar çok katmanlı kontroller oluştururlar (Ders 10-18).

Bu, aşamanın son sentezidir: önceki her ders, bütünlüğü herhangi bir katmanın gücünden daha önemli olan bir yığındaki bir katmandır.

## Use It — Hazır Araçla Uygula

`code/main.py` küçük bir risk envanteri aracı uyguluyor. Önerilen bir deployment verildiğinde, deployment'yi dört risk kategorisine göre etiketler ve bir azaltma kontrol listesi döndürür. Bu, framework için bir okumaya yardımcıdır, insan muhakemesi yerine geçmez.

## Ship It — Kullanıma Sun

`outputs/skill-societal-risk-review.md` , toplumsal ölçekte risk duruşu açısından bir deployment'yi inceler: dört kategoriden hangisine dokunduğu, hangi hafifletme önlemlerinin uygulandığı, kurumsal riske maruz kalmanın ne olduğu.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Farklı ölçeklerde üç sentetik deployment ile besleyin. Dört risk etiketinin beklediğinizle eşleştiğini doğrulayın; aracın eksik veya fazla etiketlediği bir durumu belirleyin.

2. CAIS dört risk belgesinin tamamını okuyun. Bir risk kategorisi seçin ve o kategorideki 2026'daki en önemli gelişme olduğuna inandığınız şeyin üzerine iki paragraf yazın.

3. California SB-53'ün güncel taslağını okuyun. Felaket riski duruşunu güçlendirdiğine inandığınız bir hükmü ve onu zayıflattığına inandığınız bir hükmü belirleyin. Her ikisini de haklı çıkarın.

4. Bildiğiniz bir üretim yapay zekası deployment seçin (sizinki veya yayınlanmış olanı). Organizasyonel risk alt kollarına göre puanlayın: güvenlik kültürü, denetim titizliği, çok katmanlı savunmalar, bilgi güvenliği. Hangisi en zayıf? Eşit hale getirmenin maliyeti ne olur?

5. Bir yıllık ek kapasiteyi ve bir yıllık ek deployment deneyimini yansıtan dört riskli framework'ün 2028 versiyonunun taslağını çizin. Neleri ekler, çıkarır veya yeniden gruplandırırsınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| CAIS | "Yapay Zeka Güvenliği Merkezi" | Kâr amacı gütmeyen; dört riskli framework; 2023 yok oluş beyanı |
| CAISI | "ABD hükümetinin yapay zeka güvenliği" | NIST Merkezi; gönüllü anlaşmalar; sınıflandırılmamış değerlendirmeler |
| Dört riskli framework | "CAIS'in sınıflandırması" | kötü niyetli kullanım, yapay zeka yarışları, organizasyonel riskler, hileli yapay zekalar |
| Kötü amaçlı kullanım | "Kötü aktör yapay zekayı kullanıyor" | Biyolojik silahlar, dezenformasyon, siber saldırılar |
| yapay zeka yarışları | "Rekabet baskısı" | Laboratuvarlar/şirketler/uluslar deployment'ı güvenliğin ötesine itiyor |
| Organizasyonel risk | "Laboratuvar içi arıza" | Güvenlik kültürü, denetim, savunma, bilgi güvenliği |
| Sahtekar AI | "Yanlış hizalanmış agent" | Yetenekli yapay zeka, insan refahıyla çelişen hedeflerin peşinde |
| Kaliforniya SB-53 | "Devlet düzeyinde düzenleme" | 2025–2026 yasa tasarısı; İmzalandığı takdirde ABD'nin ilk eyalet felaket riski yönetmeliği |

## Daha Fazla Okuma

- [Yapay Zeka Güvenliği Merkezi](https://safe.ai/) — dört riskin kurumsal evi framework.
- [CAIS — Felakete Yol Açabilecek Yapay Zeka Riskleri](https://safe.ai/ai-risk) — dört riskli makale.
- [CAIS — Yok olma riskine ilişkin Mayıs 2023 beyanı](https://safe.ai/statement-on-ai-risk) — kısa ortak beyan.
- [NIST CAISI](https://www.nist.gov/caisi) — devlete dönük yapay zeka standartları ve inovasyon merkezi.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — laboratuvar düzeyindeki taahhütleri toplumsal ölçekteki çerçeveye bağlar.
