# LLaVA-OneVision: Tek Modelde Tek Görüntü, Çoklu Görüntü, Video

> LLaVA-OneVision'dan önce (Li ve diğerleri, Ağustos 2024) açık VLM dünyasının ayrı kökenleri vardı: tek görüntüler için LLaVA-1.5, Mantis ve VILA gibi çoklu görüntü modelleri, Video-LLaVA ve Video-LLaMA gibi video modelleri. Her biri benchmark'sini kazandı ve diğerlerinde başarısız oldu. LLaVA-OneVision, tek bir müfredatın, her üç senaryoya da hakim olacak bir modeli eğitebileceğini ve ortaya çıkan görev aktarımı etkilerinin (tek görüntü becerileri videoya aktarılırken, çoklu görüntü muhakemesi tek görüntüye aktarılır) uzmanların toplamını geride bıraktığını savundu. Tarif aldatıcı derecede basittir: senaryolar arasında sabit kalan görsel bir token bütçesi ve ayrıca tek görüntüden OneVision'a (çoklu görüntü) ve videoya geçiş yapan açık bir müfredat. Bu ders bütçeyi, müfredatı ve ortaya çıkan davranışları okur.

**Tür:** Yapım
**Diller:** Python (stdlib, token bütçe çözücü + müfredat planlayıcı)
**Önkoşullar:** Aşama 12 · 05 (LLaVA), Aşama 12 · 06 (herhangi bir çözünürlük)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Tek görüntülü, çoklu görüntülü ve video girişlerinde sabit kalan görsel bir token bütçesi tasarlayın.
- Becerileri tek görüntüden videoya felaketle sonuçlanan bir unutma olmadan aktaran bir eğitim müfredatı sipariş edin.
- Müfredat doğru uygulandığında tek bir modelin neden aynı parametre sayısında uzmanları geride bıraktığını açıklayın.
- LLaVA-OneVision tarafından bildirilen üç yeni yeteneği adlandırın: çoklu kamera muhakemesi, işaret seti prompting, iPhone ekran görüntüsü agent.

## Sorun

Görüntü, çoklu görüntü ve videonun her biri bir modeli farklı şekilde vurgular.

Tek görüntü, OCR'yi ve ince ayrıntıları yakalamak için yüksek çözünürlüklü token'lerin (AnyRes, ~2880 görsel token'ler) olmasını istiyor. Örnek başına bütçe: bir resim, 2880 token.

Çoklu görüntü, orta çözünürlükte birkaç görüntü (her biri ~576 token) ister, böylece görüntüler arasında akıl yürütme bağlama uygun olur. Örnek başına bütçe: 4-8 resim, her biri 576, 2300-4600 token.

Video, zamansal dinamikleri yakalamak için düşük çözünürlükte çok sayıda kare (havuzlama sonrasında kare başına ~196 token) istiyor. Örnek başına bütçe: 8-32 kare, her biri 196, 1600-6200 token.

Ayrı modeller eğitiyorsanız bir bütçe seçersiniz. Bir modeli eğitiyorsanız, bağlamı bozmadan senaryolar arasında makul bir şekilde ölçeklendirmek için bütçeye ihtiyacınız vardır.

OneVision Öncesi varsayılan yanıt şuydu: "bir senaryoyu eğitin, diğerlerini görmezden gelin." Video-LLaVA, videoyu ekstra eğitim aşamalarıyla bir görüntü modeline yeniden yerleştirdi. LLaVA-NeXT, döşemeyle çoklu görüntü desteği ekledi. Hiçbiri üçünü de temiz bir şekilde ele almadı.

## Konsept

### OneVision token bütçesi

LLaVA-OneVision, senaryoya göre farklı şekilde tahsis edilen, örnek başına yaklaşık 3000-4000 token'lik birleşik bir görsel token bütçesi seçer:

- Tek resim: AnyRes-9 (3x3 döşeme + küçük resim), her döşeme 729 yamayla 384'te, agresif çift doğrusal havuzlama 2x2 → döşeme başına 182. Toplam: 9 * 182 + 182 = 1820 token. Veya döşeme başına 729'da AnyRes-4 = 2916 + 729.
- Çoklu görüntü: her görüntü orta çözünürlükte (384, döşeme yok), havuzlama olmadan 729 token. Bütçe 6 resim → 4374 tokens.
- Video: Agresif 3x3 çift doğrusal havuzla 384 çözünürlükte 32 kare → kare başına 81 token. Toplam: 32 * 81 = 2592 token.

Tahsis, toplam token'leri kabaca sabit tutar. Yüksek Lisans asla bağlamını bozan bir parti görmez. Kodlayıcı senaryo başına farklı geometri üretir ancak Yüksek Lisans aynı bütçeyi tüketir.

### Üç aşamalı müfredat

LLaVA-OneVision üç aşamada eğitim verir:

1. Tek görüntülü SFT (aşama SI). Tüm veriler tek resim artı metinden oluşur. Yüksek çözünürlüklü AnyRes girişi üzerinde eğitim alın. Bu algıyı, OCR'yi ve ayrıntılı anlayışı öğretir. LLaVA-NeXT verilerinin yanı sıra OneVision'a özgü tek görüntü verilerini kullanır.
2. OneVision SFT (aşama OV). Tek görüntü + çoklu görüntü + videoyu (düzgün şekilde örneklenmiş kareler) karıştırın. Birleşik token bütçesine göre eğitim alın. Bu, modele heterojen parti şekillerini yönetmeyi öğretir. Ağırlık sıfırlaması yok — SI aşamasından devam eder.
3. Görev aktarımı (TT aşaması). Ürüne bağlı olarak genellikle çoklu resim veya video üzerinde daha ağır olan hedef görev karışımıyla devam edin. deployment için isteğe bağlı ince ayar.

Kritik: Müfredat sırası önemlidir. Önce video veya çoklu görüntü öncelikli eğitim, aynı verilerle bile tek görüntü öncelikli eğitimden daha kötü görüntü performansı sağlar. Makale bunu açıkça ortadan kaldırıyor.

### Müfredat neden işe yarıyor?

Tek görüntü eğitimi algısal temeli oluşturur. Patch token'ler ince taneli görsel özellikler taşır; LLM bunları metinle bütünleştirmeyi öğrenir. Çoklu görüntü ve video, güçlü bir algısal temel olmadan öğrenilmesi zor olan yapısal zorlukları (hangi görüntünün hangisi olduğu, ilk önce ne olduğu) ortaya çıkarır.

Tüm senaryoları sıfırdan birlikte eğitirseniz, model algıya yetersiz uyum sağlar (topluluk başına sınırlı tek görüntü verisi) ve yapıya gereğinden fazla uyum sağlar (çok sayıda çoklu görüntü / video verisi). Sonuç: çapraz görsel akıl yürütme kalıplarını takip eden ancak görsel olarak sığ bir model.

Müfredat sıralaması size SI aşamasından itibaren algı gücünü, ardından OV aşamasından itibaren bileşimsel/zamansal muhakeme gücünü kaybetmeden verir.

### Acil senaryolar arası beceriler

LLaVA-OneVision makalesi üç acil yeteneği rapor ediyor:

1. Çoklu kamera muhakemesi. Çoklu görüntü + video konusunda ayrı ayrı eğitim almış; inference'de, çoklu kameralı bir sürüş sahnesi hakkında mantık yürütmesi istendi. Model, eğitimde tam olarak bu formatı görmemesine rağmen görünümleri doğru bir şekilde entegre ediyor.
2. prompting işaret seti. Kullanıcı, görüntüdeki nesnelere numaralı işaretlerle açıklama ekler; model "Mark 3'ün Mark 7'ye göre ne yaptığı" ile ilgili mantık yürütüyor. Ne işaretler ne de açıklamalar konusunda eğitim almış; mekansal topraklama + çoklu görüntü referansının birleşiminden öğrenilmiştir.
3. iPhone ekran görüntüsü agent. Kullanıcı bir iPhone ekranının ekran görüntüsünü sağlar ve bir sonraki tıklamayı planlamasını ister. Kullanıcı arayüzü ekran görüntüleri, kullanıcı iş akışlarının videoları ve çoklu görüntü öncesi/sonrası çiftleri konusunda eğitimli. agent kullanım senaryosunu genelleştirir.

Bunlar eğitimli görevler değildir; müfredatın kompozisyon yapısından ortaya çıkarlar.

### Visual-token havuzlama

token bütçesi havuz oluşturmayı gerektirir. OneVision, 2D yama ızgarasında çift doğrusal enterpolasyon kullanır: 24x24 = 576 yama, 12x12 = 144 (2x faktör) veya 8x8 = 64 (3x faktör) olur. Havuzlama, yerelliği korumak için token alanında değil yama ızgara alanında yapılır.

Senaryo başına havuzlama faktörü seçiminin kendisi bir hiper parametredir. Daha az havuzlama = daha fazla token = daha zengin gösterim. Daha fazla havuzlama = daha az token = daha fazla kare/görüntü sığar.

### LLaVA-OneVision-1.5

2025 takibi (LLaVA-OneVision-1.5, arXiv 2509.23661) eğitim verileri, model ağırlıkları ve kod açısından "tamamen açıktır". Bazı benchmark'lerdeki tescilli boşluğu eşleştirir ve tarifi demokratikleştirir. Aynı müfredat, daha fazla veri, daha iyi temel LLM. Mimari değişiklik yok.

### Qwen2.5-VL ile kontrast

Qwen2.5-VL (Ders 12.09) farklı seçimler yapar. Sabit havuzlama yerine M-RoPE ve dinamik FPS kullanır. Bütçesi girdiye göre ölçeklenir; 1 dakikalık bir video, 5 saniyelik bir videodan daha fazla token kullanır. LLaVA-OneVision bütçeyi sabitler ve havuzlamayı ölçeklendirir. Her ikisi de işe yarar; öngörülebilirlik için yapılandırılabilirliği tercih ediyorlar.

## Kullan onu

`code/main.py`, OneVision tarzı bir VLM için bir müfredat ve bütçe planlayıcıdır. Örnek başına bir token bütçesi ve hedef senaryo karışımı (%40 tek görüntü, %30 çoklu görüntü, %30 video diyelim) göz önüne alındığında, bu:

- Senaryo başına çözünürlük, havuzlama faktörü ve kareleri tahsis eder.
- Her senaryonun paylaşılan bütçeye uygun olup olmadığını kontrol eder.
- Beklenen token sayısını, LLM FLOP'ları ve hangi senaryoların token'nin altında olduğunu raporlar.
- Aşamalı bir eğitim programı yazdırır.

OneVision'da ince ayar planlamak veya VLM deployment'nin istek başına maliyetini kontrol etmek için bunu kullanın.

## Gönderin

Bu ders `outputs/skill-onevision-budget-planner.md`'yi üretir. Hedef görev dağılımı ve örnek başına bütçe göz önüne alındığında, AnyRes faktörünü, kare başına havuzlamayı, video kare sayısını ve müfredat aşaması ağırlıklarını yayar. Birleşik senaryolu bir VLM'yi eğitirken veya ince ayar yaparken bunu kullanın.

## Egzersizler

1. Ürününüz %80 tek görüntü, %10 çoklu görüntü (2-4 görüntü), %10 video (8-16 kare) destekler. token bütçesini tasarlayın. Ağır çoklu görüntü yapmamaktan tasarruf ettiğiniz ekstra bütçeyi nereye koyarsınız?

2. LLaVA-OneVision Bölüm 4.3'ü (ortaya çıkan yetenekler) okuyun. Müfredatın muhtemelen açığa çıkaracağı dördüncü bir beceri önerin, ancak makale bunu bildirmedi.

3. Müfredat sırasını değiştirin; önce çoklu görüntüyü, ardından tek görüntüyü ve ardından videoyu eğitin. Hangi benchmark'lerin bozulduğunu ve nedenini tahmin edin.

4. Makale, benchmark videolarının örnek başına yalnızca 8 kareyle eğitildiğini bildiriyor. Bu, inference'deki 30 saniyelik videolara genelleniyor mu? İlk önce ne bozulur – token bütçesi mi, yoksa zamansal akıl yürütme mi?

5. 24x24 yamanın 12x12'ye çift doğrusal havuzlanması, loş başına 4 kat azalmadır. Stdlib Python'da havuzlamayı uygulayın ve her 2x2 bloktaki ortalamanın çift doğrusal çıktıyla eşleştiğini doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| OneVision senaryosu | "Tek görüntü, çoklu görüntü veya video" | Birleştirilmiş VLM'nin işlediği üç giriş şeklinden biri; bütçe genelinde sabit kalıyor |
| Token bütçe | "Örnek başına kaç token" | LLM'nin eğitim başına gördüğü toplam görsel token'ler / inference örneği, genellikle 3000-4000 |
| Müfredat | "Eğitim siparişi" | Acil aktarım için seçilen aşama sıralaması (tek görüntü → çoklu görüntü → video) |
| Çift doğrusal havuzlama | "Token küçült" | Yerelliği korurken token sayısını azaltmak için yama ızgarasına (2D) çift doğrusal enterpolasyon uygulama |
| Acil beceri | "Eğitim almadım, hala çalışıyor" | Müfredat yapısı nedeniyle inference'de eşleşen eğitim verileri olmadan görünen yetenek |
| AnyRes-k | "k-kare kurulumu" | sabit çözünürlüklü k alt döşeme artı bir küçük resim, tipik k ∈ {4, 9} |
| Görev aktarımı | "Senaryolar arası genelleme" | Paylaşılan omurga aracılığıyla videoya (ve tam tersi) uygulanan, tek görüntüde öğrenilen beceriler |

## Daha Fazla Okuma

- [Li ve ark. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Tamamen Açık Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin ve ark. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin ve ark. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang ve ark. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
