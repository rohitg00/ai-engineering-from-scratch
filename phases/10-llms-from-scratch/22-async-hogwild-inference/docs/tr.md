# Asenkron ve Hogwild! Inference

> Spekülatif kod çözme (Aşama 10 · 15), token'leri tek bir dizi içinde paralelleştirir. Çoklu agent framework'ler tüm dizi boyunca paralelleşir ancak açık koordinasyonu (oylama, alt görev bölme) zorlar. Hogwild! Inference (Rodionov ve diğerleri, arXiv:2504.06261) başka bir şey yapar: aynı LLM'nin N örneğini PAYLAŞILAN bir anahtar/değer önbelleğine karşı paralel olarak çalıştırın. Her çalışan, diğer çalışanların oluşturduğu token'leri anında görür. Modern akıl yürütme modelleri (QwQ, DeepSeek-R1), herhangi bir fine-tuning olmadan bu paylaşılan önbellek aracılığıyla kendi kendini koordine edebilir. Yaklaşım deneyseldir ancak spesifik kod çözme işlemine dik duran tamamen yeni bir inference paralellik ekseni açar. Bu ders iki işçili bir Hogwild'i uygulamaktadır! stdlib Python'daki simülatör ve paylaşılan önbellek işbirliğinin neden mevcut modelin akıl yürütme yeteneklerinden ortaya çıktığını açıklıyor.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 10 · 12 (inference optimizasyonu), Aşama 10 · 15 (spekülatif kod çözme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç ortak paralel LLM topolojisini (oylama, alt görev, Hogwild!) tanımlayın ve her birinin hangi sorunları hedeflediğini belirtin.
- Hogwild'in çekirdeğini belirtin! kurulum: birden fazla çalışan, bir paylaşılan KV önbelleği, kendi kendine prompting aracılığıyla acil koordinasyon.
- Hogwild'in duvar zamanındaki hızlanmasını hesaplayın! çalışan sayısı `N`, görev düzeyinde paralellik `p` ve koordinasyon yükü `c`'nin bir fonksiyonu olarak.
- İki işçili bir Hogwild uygulayın! Simülatörü bir oyuncak problemi üzerinde çalıştırın ve ortaya çıkan görev bölümünü gözlemleyin.

## Sorun

Modern LLM'ler zor problemleri uzun akıl yürütme zincirleri üreterek çözer - 5000 token'lik adım adım mantık yaygındır, on binlerce token derin matematik problemlerinde gerçekleşir. 70B modelinde 35 token/sn kod çözme hızında, 50 bin token 24 ​​dakikadır. Etkileşimli model değildir.

Spekülatif kod çözme (Aşama 10 · 15), tek bir dizide paralelleştirme yaparak size 3-5 kat hız kazandırır. Otoregresif kod çözmenin sıralı bağımlılığının ötesinde sert tavan vardır. Her yeni token, önceki token'ye bağlıdır.

Açık soru: Diziler arasında paralellik kurabilir miyiz? Aynı modelin birden fazla kopyasını aynı problem üzerinde çalıştırın, işbirliği yapmalarına izin verin, işi bölüştürsünler mi?

Önceki çalışma: oylama toplulukları (N model çalıştırın, çoğunluk cevabını seçin), düşünce ağacı (dallanma yolları ve yeniden birleştirme) ve çoklu agent framework'ler (her agent'ye bir alt görev atayın, bir koordinatör kullanın). Bunların hepsi belirli görev alanlarında yardımcı olur. Hepsi aynı zamanda açık koordinasyon mekanizmasını da tanıtıyor; oylama kuralları, dallandırma ve budama mantığı, agent'den agent'ye mesajlaşma protokolleri.

Hogwild! Inference farklı bir yaklaşım benimsiyor. N çalışan tek bir KV önbelleğini paylaşıyor. Her çalışan, diğer çalışanların oluşturduğu token'leri sanki kendi bağlamıymış gibi anında görür. İşçiler - herhangi bir eğitim veya fine-tuning olmadan - işin nasıl bölüneceğini buluyorlar. Modern akıl yürütme modelleri (QwQ, DeepSeek-R1, Claude ailesi akıl yürütme modu) paylaşılan önbelleği okuyabilir ve "Çalışan 2'nin temel durumu zaten ele aldığını görüyorum, bu yüzden tümevarımsal adım üzerinde çalışacağım" gibi şeyler söyleyebilir.

Hızlanma iş yüküne bağlı ve Nisan 2026 itibarıyla deneysel. Ancak bu fikir bilinmeye değer çünkü inference paralelliğinde yeni bir eksen açıyor.

## Konsept

### Kurulum

Hepsi aynı LLM'yi çalıştıran N çalışan sürecini başlatın. Çalışan başına KV önbellekleri yerine BİR paylaşılan önbellek bulundurun. Çalışan `i`, token `t_j` oluşturduğunda, token bir sonraki konumdaki paylaşılan önbelleğe yazılır. Çalışan `k` bir sonraki adımı attığında, önbelleğin mevcut durumunu okur (bu, tüm N çalışanın şu ana kadar oluşturduğu her şeyi içerir).

Adım zamanında işçiler token'leri yazmak için yarışırlar. Çalışan başına konum dizini yoktur; önbellek, büyüyen tek bir diziden oluşur. Sipariş, yazmanın varış saatine göre belirlenir.

### Koordinasyon neden ortaya çıkıyor?

İşçiler bir prompt paylaşıyor. Genellikle şuna benzer bir şey: "Siz bu sorun üzerinde birlikte çalışan N örnekten birisiniz. Her örnek, paylaşılan belleği okur ve diğer örneklerin ne yazdığını görebilir. Gereksiz çalışmadan kaçının." prompt artı paylaşılan önbellek yeterlidir. Akıl yürütme modelleri önbelleği okur, sorunun hangi kısımlarının daha önce denendiğini fark eder ve (her zaman olmasa da çoğu zaman) keşfedilmemiş kısımlara döner.

Hogwild! makale (Rodionov ve diğerleri, 2025) aşağıdaki gibi gözlemleri rapor etmektedir:

- Çalışanlar planları formüle eder ve bunları önbellek aracılığıyla diğer çalışanlara iletir.
- İşçiler, diğer işçilerin mantık yürütmelerindeki hataları fark eder ve bunları dile getirir.
- Çalışanlar bir plan başarısız olduğunda uyum sağlar ve alternatifler önerir.
- Artıklık kontrolü için prompt kullanıldığında çalışanlar bunu algılar ve döner.

Bunların hiçbiri fine-tuning gerektirmez. Ortaya çıkan davranış, modelin halihazırda sahip olduğu akıl yürütme yeteneklerinden gelir.

### Adlandırma

Gazetenin adı Hogwild'e gönderme yapıyor! SGD (Recht ve diğerleri, 2011), eşzamansız bir güncelleme iyileştiricisidir. Analoji: SGD'nin eşzamansız çalışanlarının tümü paylaşılan bir parametre vektörüne yazar; Hogwild! Inference çalışanlarının tümü paylaşılan bir KV önbelleğine yazar. Her ikisi de senkronizasyon garantilerinden ziyade ampirik yakınsamaya dayanır.

### RoPE bunu takip edilebilir hale getiriyor

Döner Konum Embedding'ler (RoPE, Su ve diğerleri 2021), Q ve K vektörlerindeki dönüş yoluyla konum bilgilerini kodlar. Konumlar rotasyon olduğundan ve yerleşik uzaklıklar olmadığından, token'nin konumu KV önbellek girişi yeniden hesaplanmadan değişebilir. Çalışan `i`, `p` konumundaki paylaşılan önbelleğe yazdığında, bu konumu okuyan diğer çalışanlar önbelleğe alınan girişi doğrudan kullanabilir; yeniden döndürmeye gerek yoktur.

Öğrenilmiş konum veya mutlak konum modelinde Hogwild! her eşzamanlı yazma işleminde önbelleğin geçersiz kılınması gerekir. RoPE, önbelleğin sabit kalmasını sağlar.

### Duvar zamanlı matematik

`T_serial` bir çalışanın sorunu tek başına çözebileceği süre olsun. `p` görev düzeyinde paralelleştirilebilir kesir olsun. Adım başına koordinasyon yükü `c` olsun (genişletilmiş önbelleğin okunması, ne yazılacağına karar verilmesi).

Tek işçinin çalışma süresi: `T_serial`.
N-işçi Hogwild! koordinasyon serbestse zaman: `T_serial * ((1 - p) + p / N)`. Klasik Amdahl.
Koordinasyon yüküyle birlikte: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`.

Bir çalışanın üretken olabilmesi için `c`'nin adım başına kod çözme süresine göre küçük olması gerekir. 5k'dan fazla token üreten muhakeme modellerinde, çalışanlar yüzlerce token koordinasyon yükünü karşılayabilir ve yine de öne geçebilirler. Kısa sohbet görevlerinde koordinasyon hakimdir ve Hogwild! diziden daha kötü.

### Somut örnek

Muhakeme problemi: 10 bin token düşünce zinciri. Sorunun `p = 0.7` paralelleştirilebilir içeriğe (farklı kanıt stratejileri, farklı vaka analizleri) ve çalışan başına `c = 200` token koordinasyon yüküne sahip olduğunu varsayalım. `N = 4` çalışanları ile:

- Seri zaman: 10000 kod çözme adımı.
- Hogwild! süre: 10000 * (0,3 + 0,7 / 4) + 200 * 4 = 10000 * 0,475 + 800 = 5550 kod çözme adımı.
- Hızlanma: 10000 / 5550 = 1,8x.

Bu çok mütevazı. Ancak daha uzun akıl yürütme problemlerinde (50 bin token), koordinasyon yükü amorti edilir ve hızlanma 2,5-3 kat artar. Hogwild! doğal olarak çok iş parçacıklı kod yazmanıza olanak tanıyan bir dilde iş parçacığı düzeyinde paralelliğin inference eşdeğeridir.

### Hogwild'e ne zaman ulaşmalı!

- Görevin bağımsız alt hedefler arasında paralelleştirilebildiği uzun muhakeme problemleri (binlerce token).
- Adım adım düşünmek üzere eğitilmiş muhakeme modelleri. Mantık yürütmeyen modeller kendi kendini iyi koordine edemez.
- Paylaşılan önbelleği ve N çalışan işlemlerini tutmaya yetecek kadar VRAM'e sahip tek düğümlü deployment'ler. Önbellek paylaşılır ancak her çalışanın kendi etkinleştirme belleği vardır.

### Ne zaman yapılmamalı

- Kısa etkileşimli sohbet. Koordinasyon yükü hakimdir.
- Paralelleşmeyen görevler (tek doğrusal kanıt, tek derleme). N=1 maksimumdur.
- Mantıksal olmayan modeller. Herhangi bir koordinasyon ortaya çıkmıyor.
- Çok düğümlü deployment'ler. Paylaşılan önbellek, çalışanlar arası çok hızlı senkronizasyona ihtiyaç duyar. Düğüm içi sorun yok; düğümler arası bir gecikme felaketidir.

### Deneysel durum

Nisan 2026 itibarıyla Hogwild! açık kaynaklı PyTorch uygulamasına sahip bir araştırma yöntemidir. Üretimin benimsenmesi gerçekleşmedi. Üç engelleyici:

1. Eşzamanlı süreçler arasında paylaşılan KV önbellek yönetimi önemsiz bir mühendislik değildir.
2. Acil koordinasyon göreve bağlıdır; benchmark'ler halen oluşturulmaktadır.
3. Hızlanmalar, spekülatif kod çözmenin halihazırda sağladığıyla karşılaştırıldığında mütevazıdır ve ikisi birleştirilebilir, ancak birleştirilmiş mühendislik başka bir katmandır.

Bilmeye değer. Denemeye değer. Henüz bir ürün üzerine bahse girmeye değmez.

```figure
continuous-batching
```

## İnşa Et

`code/main.py` bir oyuncak Hogwild'i kullanıyor! simülatör:

- Her biri bilinen olasılıklarla birkaç token kategorisinden (iş-token, gözlem-token, koordinat-token) birini üreten deterministik bir "LLM" olan iki çalışan süreci.
- Her iki çalışanın da okuyup yazdığı paylaşılan bir önbellek (yalnızca token'lerin bir listesi).
- Basit bir koordinasyon mantığı: Bir çalışan diğerinin zaten bir kategoride yeterince token iş ürettiğini gördüğünde farklı bir kategori seçer.

Simülatör sabit bir adım bütçesi için çalışır ve şunları bildirir:

- Üretilen toplam iş-token'ler.
- Toplam duvar süresi (işçi adımlarının sayısı).
- Tek bir çalışan üzerinde etkili hızlanma.
- Hangi işçinin hangi token'yi yazdığının izi.

### Adım 1: paylaşılan önbellek

Her iki çalışanın da eklediği bir liste. Gerçek bir uygulamada basit kilitleme (Python `threading.Lock`); bir sayaçla simüle ediyoruz.

### Adım 2: çalışan döngüsü

Her çalışan, her adımda:

- Geçerli paylaşılan önbelleği okur.
- Zaten orada olana dayanarak hangi token kategorisinin yazılacağına karar verir.
- Bir token yazar.

### Adım 3: koordinasyon buluşsal yöntemi

X kategorisinin önbelleğinde zaten K token varsa ve çalışanın amaçlanan kategorisi X ise, çalışan Y kategorisine geçer. Bu, "bunun zaten kapsandığına dikkat edin, onun yerine başka bir şey yapın" şeklindeki akıl yürütme modeli davranışının oyuncak bir benzeridir.

### Adım 4: ölçülen hızlanma

Simülatörü N=1 işçi ve N=2 işçi ile aynı toplam adım bütçesiyle çalıştırın. Üretilen token çalışmalarını sayın. N=2, koordinasyona dayalı görev bölümü nedeniyle kabaca 1,5-1,8 kat daha fazla iş token üretmelidir.

### Adım 5: koordinasyonu vurgulayın

Koordinasyon buluşsal yönteminin hassasiyetini azaltın. Tekrar koş. İyi bir koordinasyon olmadan, N=2'nin yedekli olarak aynı token'leri ürettiğini ve hızın 1'in altına düştüğünü gözlemleyin. Bu, makalenin gözlemiyle örtüşüyor: hile yalnızca işçilerin kendi kendini koordine etme akıl yürütme kapasitesine sahip olması durumunda işe yarar.

## Kullan onu

Hogwild! Nisan 2026 itibarıyla üretime entegrasyon araştırma düzeyindedir. Yandex/HSE/IST'in referans uygulaması PyTorch tabanlıdır ve DeepSeek-R1 ve QwQ modellerinde tek düğümlü çoklu işlem kurulumlarını hedefler.

Pragmatik benimseme yolu:

1. Muhakeme görevi iş yükünüzün profilini çıkarın. Keşifsel (çoklu stratejiler, vaka analizleri, arama) ve doğrusal olan token'lerin oranını ölçün.
2. Keşif hakimse, iki işçili bir Hogwild çalıştırın! deney. Duvar süresindeki iyileşmeyi ölçün.
3. İyileşme 1,3x'in altındaysa koordinasyonun hakim olduğu rejimdesiniz. Tek işçiye dönüş.
4. İyileşme 1,5 katın üzerindeyse N=4'e basın ve tekrar ölçün. Azalan getiriler genellikle N=4-8 civarına ulaşır.

Spekülatif kod çözme ile birleştirin: her Hogwild! çalışan bağımsız olarak spesifikasyon kod çözmeyi kullanabilir. İki hızlandırma çoğalarak (kabaca) 3x spesifikasyon kod çözme ve 1,8x Hogwild getiriyor! saf tek çalışanlı kod çözme işlemine kıyasla etkili 5,4 kat daha fazla.

## Gönderin

Bu ders `outputs/skill-parallel-inference-router.md`'yi üretir. Mantıklı bir iş yükü profili (token bütçesi, görev paralellik profili, model ailesi, deployment hedefi) göz önüne alındığında, oylama, düşünce ağacı, çoklu agent, Hogwild! ve spekülatif kod çözme stratejileri arasında yönlendirme yapar.

## Egzersizler

1. `code/main.py`'yi varsayılan ayarlarla çalıştırın. N=2 Hogwild'i doğrulayın! konfigürasyonu aynı duvar süresi içinde N=1 temel çizgisinden daha fazla iş-token üretir.

2. Koordinasyon buluşsal yönteminin gücünü azaltın (`coordination_weight=0.1`'yi ayarlayın). Yeniden çalıştırın. Hızlanmanın çöktüğünü gösterin. Nedenini açıklayın: İşçiler koordine olamadıkları zaman çabayı tekrarlıyorlar.

3. Beklenen Hogwild'i hesaplayın! `p=0.8, c=500` ve N=4 çalışanla 50k-token akıl yürütme görevi için hızlanma. `p=0.3, c=200` ve N=4 ile 1k-token sohbet görevi için de aynısını yapın. Neden biri kazanırken diğeri kayıp oluyor?

4. Hogwild'i okuyun! Makalenin 4. Bölümü (ön değerlendirme). Yazarların bildirdiği iki arıza modunu tanımlayın. Daha iyi bir koordinasyon olan prompt'nin her birini nasıl azaltabileceğini açıklayın.

5. Hogwild'i birleştirin! oyuncakta spekülatif kod çözme ile: her çalışan dahili olarak 2-token spesifik kod çözme özelliğini kullanır. Çarpımsal hızlanmayı bildirin. İki çalışanın her ikisi de aynı paylaşılan önbellek önekini genişletmek istediğinde hangi defter tutma sorunu ortaya çıkar?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Hogwild! | "Paralel çalışanlar, paylaşılan önbellek" | Aynı LLM'nin N örneği, tek bir paylaşılan KV önbelleğiyle eşzamanlı olarak çalışıyor; self-prompting aracılığıyla acil koordinasyon |
| Paylaşılan KV önbelleği | "Koordinasyon ortamı" | Tüm çalışanların okuyup yazdığı, büyüyen tek bir KV arabelleği; çalışanlar arasında anında token görünürlüğü sağlar |
| Acil durum koordinasyonu | "Eğitime gerek yok" | Muhakeme yeteneğine sahip LLM'ler, paylaşılan önbelleği okuyabilir ve herhangi bir fine-tuning veya açık protokol olmadan işi bölebilir |
| Koordinasyon yükü (c) | "Token'ler oryantasyona harcandı" | Genişletilmiş önbelleği okumanın ve ne yapılacağına karar vermenin çalışan başına maliyeti; toplam kod çözme süresine kıyasla küçük kalmalı |
| Paralelleştirilebilir kesir (p) | "Neler paralel olarak çalışabilir?" | Görev düzeyinde paralellik: toplam işin doğası gereği sıralı olmayan kısmı |
| RoPE Hogwild'i mümkün kılıyor! | "Döner konumlar kaydırmayla değişmez" | Konumlar rotasyon olduğundan, paylaşılan bir önbelleğe yazmak önceki token'lerin yeniden hesaplanmasını gerektirmez.
| Oylama topluluğu | "N'yi çalıştırın, çoğunluğu seçin" | En basit paralel inference topolojisi; sınıflandırma için yararlı, uzun biçimli akıl yürütme için daha az |
| Düşünce Ağacı | "Dal ve kuru erik" | Çoklu dalları ve kuru erikleri araştıran muhakeme stratejisi; açık koordinasyon mantığı |
| Çoklu agent framework | "Alt görevleri atayın" | Her agent bir rol alır; bir koordinatör yönetir; ağır protokol yükü |

## Daha Fazla Okuma

- [Rodionov ve ark. — Hogwild! Inference: Eşzamanlı Dikkat Yoluyla Paralel Yüksek Lisans Üretimi (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) — Hogwild! makale, QwQ ve DeepSeek-R1 hakkında ön değerlendirme
- [Recht, Re, Wright, Niu — Hogwild!: Stokastik Gradient İnişini Paralelleştirmeye Kilitsiz Bir Yaklaşım (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) — orijinal Hogwild!, adlandırma kaynağı
- [Su ve ark. — RoFormer: Döner Konumlu Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) ile geliştirilmiş Transformer — RoPE, paylaşılan önbellek inference'yi izlenebilir hale getiren özellik
- [Yao ve ark. — Düşünce Ağacı: Büyük Dil Modelleriyle Kasıtlı Problem Çözme (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — düşünce ağacı akıl yürütme stratejisi Hogwild! dik oturur
- [Leviathan ve ark. — Spekülatif Kod Çözme (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) aracılığıyla Transformer'lerden hızlı Inference — spekülatif kod çözme, dizi içi paralellik Hogwild! ile oluşur
- [Hogwild! referans PyTorch uygulaması](https://github.com/eqimp/hogwild_llm) — makalenin deneyleri için tek gerçek kaynak
