# Çift Boru Paralelliği

> DeepSeek-V3, düğümlere dağılmış MoE uzmanlarıyla 2.048 H800 GPU üzerinde eğitildi. Düğümler arası uzman hepsine iletişim, her 1 GPU saatlik bilgi işlem için 1 GPU saatlik iletişim maliyetine sahiptir. GPU'lar zamanın yarısında boştaydı. DualPipe (DeepSeek, Aralık 2024), tetikledikleri tümden herkese iletişimlerle ileri ve geri hesaplamayı örtüşen çift yönlü bir boru hattıdır. Baloncuklar düşüyor, üretim artıyor ve iki model-parametre kopyasının (adını veren "ikili") tutulması, Uzman Paralelliği halihazırda uzmanları kademeler arasında yaymaya başladıktan sonra ucuz oluyor. Bu ders, DualPipe'ın gerçekte ne yaptığını ve Sea AI Lab'ın DualPipeV iyileştirmesinin marjinal olarak daha dar bir balon pahasına neden parametre maliyetini 2 kat düşürdüğünü açıklayan Öğrenme tipi bir kılavuzdur.

**Tür:** Öğren
**Diller:** Python (stdlib, zamanlama simülatörü)
**Önkoşullar:** Aşama 10 · 05 (dağıtılmış eğitim, FSDP, DeepSpeed), Aşama 10 · 14 (açık model mimariler ve MoE)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- DualPipe ileri-geri yığınının dört bileşenini adlandırın ve neden her birinin kendi örtüşme penceresine sahip olduğunu belirtin.
- Boru hattı balonu sorununu geniş ölçekte açıklayın ve "kabarcıksız"ın pratikte ve pazarlamada ne anlama geldiğini açıklayın.
- 8 PP kademesi ve 16 mikro parti için DualPipe programını elle takip edin ve ileri ve geri akışların birbirlerinin boş yuvalarını doldurduğunu doğrulayın.
- DualPipeV'in (Sea AI Lab, 2025) sağladığı ödünleşimi belirtin: Uzman Paralelliği etkin olmadığında biraz daha büyük bir balon pahasına 2 kat parametre çoğaltmasını düşürür.

## Sorun

671B MoE modelinin 2k H800 GPU'larda eğitilmesi üç bileşik darboğazla karşı karşıyadır:

1. **Bellek baskısı.** Her GPU modelin bir dilimini tutar. 128 kafadaki 61 katmandaki 8k dizisindeki aktivasyon belleği çok büyüktür.
2. **Ardışık düzen balonları.** Geleneksel ardışık düzen paralelliği (GPipe, 1F1B), aşamalarının girişini veya gradient'yi beklerken GPU'ları boşta bırakır. 8 aşamada, 1F1B planlamada bile GPU süresinin kabaca %12'si kabarcık olabilir.
3. **Düğümler arası hepsi bir arada.** Uzman paralelliğine sahip MoE, uzmanları düğümler arasında dağıtır. Her ileri geçiş, uzmanlarına token'ların gönderilmesi ve birleştirilmesi için bir başkasının gönderilmesini tetikler. 2k GPU'larda bu kolaylıkla 1:1 hesaplama-iletişim oranına dönüşür.

Bunların her birinin ayrı çözümleri vardır: Bellek için gradient kontrol noktası oluşturma, boru hattı kabarcıkları için Sıfır Kabarcık (Sea AI Lab, 2023), hepsi bir arada için uzman-paralel iletişim çekirdekleri. DualPipe'ın yaptığı şey onların birlikte oynamasını sağlamaktır. Zamanlama, tek bir ileri-geri yığın içinde bilgi işlem ve iletişimi üst üste bindirir, ardışık düzenin her iki ucundan aynı anda mikro gruplar enjekte eder ve sonuçta ortaya çıkan zamanlamayı, hesaplama pencerelerinin içinde hepsi bir arada gizlemek için kullanır.

Bildirilen sonuç: DeepSeek-V3'ün 14,8T-token eğitim çalıştırmasında boru hattı kabarcıklarının neredeyse tamamen ortadan kaldırılması, %95'in üzerinde GPU kullanımı.

## Konsept

### Ardışık düzen paralelliği tazeleme

N katmanlı bir modeli P aygıtlarına bölün. `i` cihazı, `i * N/P .. (i+1) * N/P - 1` katmanlarını barındırıyor. Bir mikro parti, 0'dan P-1'e giden cihazlardan ileri doğru akar, ardından P-1'den 0'a geri doğru akar. Her cihaz, ileri aşamasına yalnızca önceki cihaz çıkışını gönderdiğinde başlayabilir ve yalnızca aşağı akışlı cihaz, yukarı akışlı gradient'yi gönderdiğinde geriye doğru başlayabilir.

GPipe (Huang ve diğerleri, 2019) tek seferde bir mikro partiyi planlar ve bu da GPU zamanının çoğunu boşa harcar. 1F1B (Narayanan ve diğerleri, 2021), birden fazla mikro parti için ileri ve geri geçişleri serpiştirir. Zero Bubble (Qi ve diğerleri, 2023), geri geçişi iki parçaya böler: girdi için geriye doğru (B) ve ağırlıklar için geriye doğru (W) ve bunları balonu dolduracak şekilde programlar. Zero Bubble'dan sonra boru hattı neredeyse sıkı.

DualPipe bir sonraki adımdır. Üstüne iki fikir ekler:

### Fikir 1: yığın ayrıştırma

Her ileri parça dört bileşene bölünmüştür:

- **Dikkat.** Q/K/V projeksiyonları, dikkat, çıktı projeksiyonu.
- **Tümden herkese gönderim.** token'ları uzmanlarına gönderen düğümler arası iletişim.
- **MLP.** MEB uzman hesaplaması.
- **Hepsi bir arada.** Uzman çıktılarını geri getiren düğümler arası iletişim.

Geriye doğru bir yığın, bunların her birinin gradient versiyonunu ekler. DualPipe bunları, hepsine gönderimin bir sonraki parçanın dikkat hesaplamasına paralel olarak gerçekleşmesini ve hepsinden hepsine birleştirmenin de sonraki parçanın MLP hesaplamasına paralel olarak gerçekleşmesini sağlayacak şekilde programlar.

### Fikir 2: çift yönlü planlama

Çoğu boru hattı programı, mikro partileri aşama 0'dan enjekte eder ve aşama P-1'e doğru akar. DualPipe mikro partileri HER İKİ uçtan enjekte eder. Aşama 0'da ileri mikro partilerin buradan kaynaklandığı görülüyor; P-1 aşaması da ileri mikro partilerin buradan kaynaklandığını görüyor. İki dere ortada buluşuyor.

Bunun çalışması için, `i` cihazının HEM erken ardışık düzen katmanını `i` HEMDE son ardışık düzen katmanını `P - 1 - i` tutması gerekir. Bu, DualPipe'ın "ikili" kısmıdır: her cihaz, hizmet vermesi gereken model katmanlarının iki kopyasını (her yön için bir tane) tutar. DeepSeek-V3 ölçeğinde bu, parametre çoğaltma maliyetinin 2 katıdır. Ekonomiktir çünkü Uzman Paralelliği zaten MEB uzmanlarını o kadar ince yaymaktadır ki, uzman olmayan katmanları iki kez kopyalamak küçük patateslerdir.

En önemlisi, bir yöndeki ileri akış ve diğer yöndeki geri akış, tek yönlü bir programda kabarcıkların olacağı yerde tam olarak örtüşüyor. Kabarcıklar kaybolur.

### Elle takip edilen bir program

P = 4 sırayı, 8 mikro partiyi, 4 ileri / 4 geri bölünmüş olarak düşünün. Zaman soldan sağa doğru hareket eder; satırlar cihaz sıralamalarıdır.

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

"F4/F5R" notasyonunun okunması: sıra 1, aynı zaman diliminde mikro parti 4'ün ilerisinde (boru hattında soldan sağa gidiyor) VE mikro parti 5'in ilerisinde (sağdan sola gidiyor) koşuyor. Operasyonel olarak "çift yönlü"nün anlamı budur.

2. seviyede çapraz akışlar daha erken örtüşür, 0. ve P-1'de ise en geç çakışırlar. Programın istikrarlı orta aşamasında, her sıra, Y yönünün gerisiyle örtüşen X yönünün ilerisine doğru ilerler. Hesaplama meşgul. İleri geçiş için tümden herkese gönderimler geriye doğru hesaplamanın içinde gizlenir. Hepsinden hepsine birleştirmeler ileri hesaplamanın içinde gizlenir. Kabarcıklar sıkılarak dışarı atılır.

### Kabarcık muhasebesi

Standart 1F1B boru hattı balonu (sıralama başına boşa harcanan zaman):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Sıfır Kabarcık iyileştirmesi onu aşağıya indirir ancak sıfıra indirmez. DualPipe, kararlı fazda, eğer mikro parti sayısı boru hattı derinliğinin 2 katına bölünebiliyorsa sıfır kabarcık içerir. Kararlı aşamanın (ısınma ve soğuma) dışında bir miktar baloncuk var, ancak mikro partilerin sayısıyla birlikte büyümüyor; bu makalenin vurguladığı önemli bir özellik.

Pazarlama açısından: "kabarcıksız". Teknik açıdan söylemek gerekirse, mikro parti sayımıyla kabarcıklar büyümez. Sea AI Lab'ın takip analizi (DualPipeV / Cut-in-half), yalnızca Uzman Paralelliği darboğaz olmadığında sıfır balonun tamamını gösterir; EP odaklı hepsi bir arada, bazı zamanlama uzlaşmaları her zaman mevcuttur.

### DualPipeV — iyileştirme

Sea AI Lab (2025), konu EP iletişim örtüşmesi olmadığında 2x parametre çoğaltmasının israf olduğunu gözlemledi. DualPipeV programları, çift yönlü enjeksiyonu tek bir parametre kopyası üzerinde çalışan "V şeklinde" bir programa katlar. Baloncuk DualPipe'ınkinden biraz daha büyüktür, ancak bellek tasarrufu oldukça fazladır. DeepSeek, açık kaynaklı DualPipe uygulamasında EP kapalı modu olarak DualPipeV'i benimsedi.

Takas:

| Özellik | Çift Boru | Çift BoruluV | 1F1B | Sıfır Kabarcık |
|---------|---------|-----------|------|------------|
| Cihaz başına parametre kopyaları | 2 | 1 | 1 | 1 |
| Kabarcık ve mikro partiler | sabit | küçük büyüme | büyüyor | büyüyor |
| Bilgi işlem-iletişim çakışması | dolu | kısmi | minimum | kısmi |
| Şu durumlarda kullanın | EP ağırlıklı MoE | yoğun veya EP hafif | temel | herhangi bir boru hattı |

### 14,8T-token koşu için bunun anlamı nedir

DeepSeek-V3'ün ön eğitimi, yaklaşık 2,8 milyon GPU saatinde 2.048 H800 GPU'da 14,8 T tokens tüketti. Saf 1F1B ile bunun %12-15'ini ardışık düzen balonları yüzünden kaybederlerdi; 340-420K GPU saati, tam bir 70B modelini eğitmeye yetecek kadar. DualPipe bunların çoğunu kurtardı. Katkıyı doğrudan ölçmek, dahili günlükler olmadan zordur, ancak makaledeki iddia, eğitim boyunca ortalama %95 GPU kullanımının üzerindedir.

Daha küçük işlemler için (1k GPU'ların altında), DualPipe aşırıya kaçıyor; ardışık düzen balonları toplam maliyete göre daha küçük ve yoğun model eğitimi nadiren genel darboğaza ulaşıyor. Binlerce GPU ölçeğinde sınır MoE eğitimi için etkili bir şekilde gereklidir.

### Yığındaki yeri

- **FSDP**'yi (Aşama 10 · 05) tamamlayıcıdır. FSDP, model parametrelerini kademeler arasında parçalara ayırır; DualPipe, hesaplamayı kademeler arasında planlar. Birleşiyorlar.
- **ZeRO-3** gradient parçalamayla uyumludur. İki kopyalı çoğaltma için defter tutmanın, Sıfır'ın parçalanmış gradient'leri ile işbirliği yapması gerekir.
- Belirli küme topolojisi için ayarlanmış **özel hepsi-hepsi çekirdekleri** gerektirir. DeepSeek'in açık kaynaklı çekirdekleri referans uygulamasıdır.

```figure
expert-capacity
```

## Kullan onu

`code/main.py` bir ardışık düzen zamanlama simülatörüdür. `(P, n_micro_batches, schedule)` alır ve 1F1B, Zero Bubble, DualPipe ve DualPipeV'nin her biri için kararlı faz kullanımını yazdırır. Bu bir öğretim aracıdır; sayılar, makalelerdeki nitel iddialarla örtüşmektedir; bunlar, üretimin ölçülen hızlanmasıyla ilgili bir iddia değildir.

Simülatörün değeri: farklı P ve mikro parti sayımlarıyla çalıştırın ve kabarcık fraksiyonunun 1F1B için nasıl büyüdüğünü ancak DualPipe için olmadığını izleyin.

Gerçek bir eğitim çalıştırması için entegrasyon hususları:

- Mikro parti sayınızı temiz bir şekilde bölen boru hattına paralel bir derinlik seçin.
- Uzman paralel ağınızın her şeyi çift yönlü olarak desteklediğinden emin olun. DeepSeek'in çekirdekleri referanstır.
- İlk seferde programın kendisinde bir haftalık hata ayıklama süresinin harcanmasını bekleyin. Muhasebe işi berbat.
- Yalnızca toplam değil, sıralama başına GPU kullanımını izleyin. DualPipe'ın faydası başıboş kalanların sıkılaştırılmasından kaynaklanmaktadır.

## Gönderin

Bu ders `outputs/skill-dualpipe-planner.md` üretir. Bir eğitim kümesi spesifikasyonu (GPU sayısı, topoloji, ara bağlantı, model şekli) göz önüne alındığında, bir ardışık düzen paralellik stratejisi, kullanılacak planlama algoritması ve hedef ölçekte beklenen kabarcık fraksiyonu önerilir.

## Egzersizler

1. `(P=8, micro_batches=16, schedule=dualpipe)` ve `(P=8, micro_batches=16, schedule=1f1b)` üzerinde `code/main.py` komutunu çalıştırın. GPU kullanım farkını hesaplayın ve bunu milyon token saniyelik eğitim başına kurtarılan GPU saati olarak ifade edin.

2. `(P=4, micro_batches=8, schedule=dualpipe)` için program tablosunu elle çizin. Her zaman aralığını mikro parti kimliği ve yönü ile işaretleyin. Baloncukların olmadığı ilk zaman aralığını belirleyin.

3. DeepSeek-V3 teknik raporundaki Şekil 5'i okuyun (arXiv:2412.19437). Bir DualPipe ileri öbeğinde tümden herkese gönderim için örtüşme penceresini tanımlayın. İşlem zamanlamasının bunu nasıl gizlediğini açıklayın.

4. P=8 boru hattı aşamalarına sahip 70B yoğun bir model ve P=16 boru hattı aşamalarına sahip bir 671B MoE modeli için DualPipe'ın 2x parametre yükünü hesaplayın. MoE vakasının yükünün neden orantısal olarak daha küçük olduğunu gösterin (çoğu parametre uzmandır ve büyük bir EP grubuna bölünmüştür).

5. DualPipe'ı Chimera (2021'deki rakip çift yönlü zamanlayıcı) ile karşılaştırın. Makalenin Bölüm 3.4'ünü referans olarak kullanarak DualPipe'ın Chimera'da olmayan eklediği iki spesifik özelliği tanımlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Boru hattı balonu | "Seviye başına boşta kalma süresi" | Bir işlem hattı aşamasının girişini beklemesi nedeniyle GPU döngüleri boşa harcandı veya gradient |
| 1F1B | "Varsayılan ardışık düzen programı" | Bir ileri / bir geri serpiştirilmiş planlama; temel DualPipe vuruşları |
| Sıfır Kabarcık | "Deniz Yapay Zeka Laboratuvarı 2023" | B (giriş gradient) ve W (ağırlık gradient) olarak geriye doğru bölünür; boru hattını neredeyse tamamen sıkılaştırıyor |
| Çift Boru | "DeepSeek-V3 programı" | Çift yönlü ardışık düzen + bilgi işlem-iletişim çakışması; kabarcıklar mikro parti sayımıyla büyümüyor |
| Çift BoruluV | "Yarıdan kesme" | Biraz daha büyük baloncuklar pahasına 2 kat parametre çoğaltmasını azaltan V şeklinde iyileştirme |
| Parça | "Boru hattı işi birimi" | Bir mikro partinin bir boru hattı aşamasından ileri veya geri geçişi |
| Hepsinden herkese gönderim | "token'ları uzmanlara gönder" | token'leri atanmış MoE uzmanlarına yönlendiren düğümler arası iletişim |
| Hepsi bir arada birleştirme | "Uzman çıktılarını geri getirin" | MLP'den sonra uzman çıktılarını toplayan çapraz düğüm iletişimi |
| Uzman Paralellik (EP) | "GPU'larda uzmanlar" | MoE uzmanlarını farklı kademelerde parçalara ayırarak farklı GPU'ların farklı uzmanlara sahip olmasını sağlar |
| Boru Hattı Paralelliği (PP) | "GPU'lardaki katmanlar" | Parçalar katmanlar arasında model katmanları oluşturur; boyut DualPipe programları |
| Kabarcık fraksiyonu | "Boşa harcanan GPU zamanı" | (balon_zamanı / toplam_zaman); DualPipe'ın sıfıra doğru ilerleme oranı |

## Daha Fazla Okuma

- [DeepSeek-AI — DeepSeek-V3 Teknik Raporu (arXiv:2412.19437), Bölüm 3.3.2 ve Şekil 5](https://arxiv.org/abs/2412.19437) — birincil DualPipe referansı
- [DeepSeek — DualPipe GitHub deposu](https://github.com/deepseek-ai/DualPipe) — DualPipeV (yarıdan kesme) modu dahil açık kaynaklı referans uygulaması
- [Qi ve ark. — Zero Bubble Boru Hattı Paralelliği (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) — Zero Bubble'ın öncülü
- [Sea AI Lab — DualPipe, Dual olmadan daha iyi olabilirdi](https://sail.sea.com/blog/articles/63) — DeepSeek'in EP kapalı modunu bilgilendiren DualPipeV analizi
- [Narayanan ve ark. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) — DualPipe'ın karşılaştırdığı 1F1B programı
- [Huang ve ark. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) — orijinal boru hattı paralellik makalesi ve kabarcık sorunu
