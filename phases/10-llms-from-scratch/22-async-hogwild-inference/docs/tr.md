# Asenkron ve Hogwild! Inference

> Spekülatif kod çözme (Aşama 10 · 15), token'leri bir dizi içinde paralelleştirir. Çoklu-agent framework'ler tüm dizi boyunca paralelleşir ancak açık koordinasyonu (oylama, alt görev bölme) zorlar. Hogwild! Inference (Rodionov ve diğerleri, arXiv:2504.06261) başka bir şey yapar: aynı LLM'nin N örneğini PAYLAŞILAN bir anahtar/değer önbelleğine karşı paralel olarak çalıştırın. Her çalışan diğer tüm çalışanların oluşturduğu token'ları anında görür. Modern akıl yürütme modelleri (QwQ, DeepSeek-R1), herhangi bir fine-tuning olmadan bu paylaşılan önbellek aracılığıyla kendi kendini koordine edebilir. Yaklaşım deneyseldir ancak spesifik kod çözme işlemine dik duran tamamen yeni bir inference paralellik ekseni açar. Bu ders iki işçili bir Hogwild'i uygulamaktadır! stdlib Python'daki simülatör ve paylaşılan önbellek işbirliğinin neden mevcut modelin akıl yürütme yeteneklerinden ortaya çıktığını açıklıyor.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 10 · 12 (inference optimizasyon), Aşama 10 · 15 (spekülatif kod çözme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç ortak paralel LLM topolojisini (oylama, alt görev, Hogwild!) tanımlayın ve her birinin hangi sorunları hedeflediğini belirtin.
- Hogwild'in çekirdeğini belirtin! kurulum: birden fazla çalışan, bir paylaşılan KV önbelleği, kendi kendine prompting yoluyla acil koordinasyon.
- Hogwild'in duvar zamanındaki hızlanmasını hesaplayın! çalışan sayısının `N`, görev düzeyinde paralelliğin `p` ve koordinasyon yükünün `c` bir fonksiyonu olarak.
- İki işçili bir Hogwild uygulayın! Simülatörü bir oyuncak problemi üzerinde çalıştırın ve ortaya çıkan görev bölümünü gözlemleyin.

## Sorun

Modern Yüksek Lisans'lar zor problemleri uzun akıl yürütme zincirleri üreterek çözerler — 5000 token'lik adım adım mantık yaygındır, onbinlerce token derin matematik problemlerinde gerçekleşir. 70B modelinde 35 tokens/sn kod çözmede, 50k tokens 24 dakikadır. Etkileşimli model değildir.

Spekülatif kod çözme (Aşama 10 · 15), tek bir dizide paralelleştirme yaparak size 3-5 kat hız kazandırır. Otoregresif kod çözmenin sıralı bağımlılığının ötesinde sert tavan vardır. Her yeni token, önceki her token'ye bağlıdır.

Açık soru: Diziler arasında paralellik kurabilir miyiz? Aynı modelin birden fazla kopyasını aynı problem üzerinde çalıştırın, işbirliği yapmalarına izin verin, işi bölüştürsünler mi?

Önceki çalışma: oylama toplulukları (N modeli çalıştırın, çoğunluk cevabını seçin), düşünce ağacı (dallanma yolları ve yeniden birleştirme) ve çoklu-agent framework'ler (her agent'ye bir alt görev atayın, bir koordinatör kullanın). Bunların hepsi belirli görev alanlarında yardımcı olur. Hepsi aynı zamanda açık koordinasyon mekanizmasını da tanıtıyor — oylama kuralları, dal ve budama mantığı, agent-to-agent mesajlaşma protokolleri.

Hogwild! Inference farklı bir yaklaşım benimsiyor. N çalışan tek bir KV önbelleğini paylaşıyor. Her çalışan, diğer tüm çalışanların oluşturduğu token'ları sanki kendi bağlamıymış gibi anında görür. İşçiler - herhangi bir eğitim veya fine-tuning olmadan - işin nasıl bölüneceğini buluyorlar. Modern akıl yürütme modelleri (QwQ, DeepSeek-R1, Claude ailesi akıl yürütme modu) paylaşılan önbelleği okuyabilir ve "Çalışan 2'nin temel durumu zaten ele aldığını görüyorum, bu nedenle tümevarımsal adım üzerinde çalışacağım" gibi şeyler söyleyebilir.

Hızlanma iş yüküne bağlıdır ve Nisan 2026 itibarıyla deneyseldir. Ancak bu fikir bilinmeye değer çünkü yeni bir inference paralellik ekseni açıyor.

## Konsept

### Kurulum

Hepsi aynı LLM'yi çalıştıran N çalışan sürecini başlatın. Çalışan başına KV önbellekleri yerine BİR paylaşılan önbellek bulundurun. İşçi `i`, token `t_j` ürettiğinde, token bir sonraki konumdaki paylaşılan önbelleğe yazılır. Çalışan `k` bir sonraki adımı attığında, önbelleğin mevcut durumunu okur (bu, tüm N çalışanın şu ana kadar oluşturduğu her şeyi içerir).

Adım zamanında işçiler token'ları yazmak için yarışır. Çalışan başına konum dizini yoktur; önbellek, büyüyen tek bir diziden oluşur. Sipariş, yazmanın varış saatine göre belirlenir.

### Koordinasyon neden ortaya çıkıyor?

İşçiler bir prompt paylaşıyor. Genellikle şuna benzer bir şey: "Siz bu sorun üzerinde birlikte çalışan N örnekten birisiniz. Her örnek, paylaşılan belleği okur ve diğer örneklerin ne yazdığını görebilir. Gereksiz çalışmadan kaçının." prompt artı paylaşılan önbellek yeterlidir. Akıl yürütme modelleri önbelleği okur, sorunun hangi kısımlarının daha önce denendiğini fark eder ve (her zaman olmasa da çoğu zaman) keşfedilmemiş kısımlara döner.

Hogwild! makale (Rodionov ve diğerleri, 2025) aşağıdaki gibi gözlemleri rapor etmektedir:

- Çalışanlar planları formüle eder ve bunları önbellek aracılığıyla diğer çalışanlara iletir.
- İşçiler, diğer işçilerin mantık yürütmelerindeki hataları fark eder ve bunları dile getirir.
- Çalışanlar bir plan başarısız olduğunda uyum sağlar ve alternatifler önerir.
- Fazlalık olup olmadığını kontrol etmek için promptedildiğinde çalışanlar bunu algılar ve döner.

Bunların hiçbiri fine-tuning gerektirmez. Ortaya çıkan davranış, modelin halihazırda sahip olduğu akıl yürütme yeteneklerinden gelir.

### Adlandırma

Gazetenin adı Hogwild'e gönderme yapıyor! SGD (Recht ve diğerleri, 2011), eşzamansız bir güncelleme iyileştiricisidir. Benzetme: SGD'nin eşzamansız çalışanlarının tümü paylaşılan bir parametre vektörüne yazar; Hogwild! Inference çalışanlarının tümü paylaşılan bir KV önbelleğine yazıyor. Her ikisi de senkronizasyon garantilerinden ziyade ampirik yakınsamaya dayanır.

### RoPE bunu takip edilebilir hale getiriyor

Döner Konum Embedding'lar (RoPE, Su ve diğerleri 2021), Q ve K vektörlerindeki dönüş yoluyla konum bilgilerini kodlar. Konumlar rotasyon olduğundan ve yerleşik uzaklıklar olmadığından, bir token'nin konumu KV önbellek girişi yeniden hesaplanmadan değişebilir. `i` çalışanı, `p` konumundaki paylaşılan önbelleğe yazdığında, bu konumu okuyan diğer çalışanlar, önbelleğe alınan girişi doğrudan kullanabilir; yeniden döndürmeye gerek yoktur.

Öğrenilmiş konum veya mutlak konum modelinde Hogwild! her eşzamanlı yazma işleminde önbelleğin geçersiz kılınması gerekir. RoPE, önbelleğin sabit kalmasını sağlar.

### Duvar zamanlı matematik

Bir işçinin sorunu tek başına çözebileceği süre `T_serial` olsun. Görev düzeyinde paralelleştirilebilir kesir `p` olsun. Adım başına koordinasyon yükü `c` olsun (genişletilmiş önbelleğin okunması, ne yazılacağına karar verilmesi).

Tek işçi süresi: `T_serial`.
N-işçi Hogwild! koordinasyon serbestse zaman: `T_serial * ((1 - p) + p / N)`. Klasik Amdahl.
Koordinasyon yüküyle birlikte: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`.

Bir çalışanın üretken olabilmesi için, `c`'nin adım başına kod çözme süresine göre küçük olması gerekir. 5k'dan fazla token üreten akıl yürütme modellerinde, işçiler yüzlerce token'lik koordinasyon yükünü karşılayabilir ve yine de öne geçebilirler. Kısa sohbet görevlerinde koordinasyon hakimdir ve Hogwild! diziden daha kötü.

### Somut örnek

Muhakeme problemi: 10k tokens'lik düşünce zinciri. Sorunun, `p = 0.7` paralelleştirilebilir içeriğe (farklı kanıt stratejileri, farklı vaka analizleri) ve çalışan başına `c = 200` tokens koordinasyon yüküne sahip olduğunu varsayalım. `N = 4` işçiyle:

- Seri zaman: 10000 kod çözme adımı.
- Hogwild! süre: 10000 * (0,3 + 0,7 / 4) + 200 * 4 = 10000 * 0,475 + 800 = 5550 kod çözme adımı.
- Hızlanma: 10000 / 5550 = 1,8x.

Bu çok mütevazı. Ancak daha uzun akıl yürütme problemlerinde (50k tokens), koordinasyon yükü amorti edilir ve hızlanma 2,5-3 kat artar. Hogwild! doğal olarak çok iş parçacıklı kod yazmanıza olanak tanıyan bir dilde iş parçacığı düzeyinde paralelliğin inference eşdeğeridir.

### Hogwild'e ne zaman ulaşmalı!

- Görevin bağımsız alt hedefler arasında paralelleştirilebildiği uzun muhakeme problemleri (binlerce tokens).
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
2. Acil koordinasyon göreve bağlıdır; benchmark'lar hâlâ inşa ediliyor.
3. Hızlanmalar, spekülatif kod çözmenin halihazırda sağladığıyla karşılaştırıldığında mütevazıdır ve ikisi birleştirilebilir, ancak birleştirilmiş mühendislik başka bir katmandır.

Bilmeye değer. Denemeye değer. Henüz bir ürün üzerine bahse girmeye değmez.

```figure
continuous-batching
```

## İnşa Et

`code/main.py` bir oyuncak Hogwild'i uyguluyor! simülatör:

- Her biri bilinen olasılıklarla birkaç token kategoriden (iş-token, gözlem-token, koordinat-token) birini üreten deterministik bir "LLM" olan iki çalışan süreci.
- Her iki çalışanın da okuyup yazdığı, paylaşılan bir önbellek (yalnızca token'ların listesi).
- Basit bir koordinasyon mantığı: Bir çalışan, diğerinin zaten bir kategoride yeterince token iş ürettiğini gördüğünde, farklı bir kategori seçer.

Simülatör sabit bir adım bütçesi için çalışır ve şunları bildirir:

- Üretilen toplam iş-tokens.
- Toplam duvar süresi (işçi adımlarının sayısı).
- Tek bir çalışan üzerinde etkili hızlanma.
- Hangi işçinin hangi token'yi yazdığının izi.

### Adım 1: paylaşılan önbellek

Her iki çalışanın da eklediği bir liste. Gerçek bir uygulamada basit kilitleme (Python `threading.Lock`); bir sayaçla simüle ediyoruz.

### Adım 2: çalışan döngüsü

Her çalışan, her adımda:

- Geçerli paylaşılan önbelleği okur.
- Halihazırda mevcut olana dayalı olarak hangi token kategorisinin yazılacağına karar verir.
- Bir token yazar.

### Adım 3: koordinasyon buluşsal yöntemi

Eğer X kategorisinin önbelleğinde zaten K token varsa ve çalışanın amaçlanan kategorisi X ise, çalışan Y kategorisine geçer. Bu, "bunun zaten kapsandığına dikkat edin, bunun yerine başka bir şey yapın" şeklindeki akıl yürütme modeli davranışının oyuncak bir benzeridir.

### Adım 4: ölçülen hızlanma

Simülatörü N=1 işçi ve N=2 işçi ile aynı toplam adım bütçesiyle çalıştırın. Üretilen tokenişleri sayın. N=2, koordinasyona dayalı görev bölümü nedeniyle kabaca 1,5-1,8 kat daha fazla iştoken üretmelidir.

### Adım 5: koordinasyonu vurgulayın

Koordinasyon buluşsal yönteminin hassasiyetini azaltın. Tekrar koş. İyi bir koordinasyon olmadan N=2'nin gereksiz olarak aynı token'ları ürettiğini ve hızın 1'in altına düştüğünü gözlemleyin. Bu, makalenin gözlemiyle örtüşüyor: hile yalnızca işçilerin kendi kendini koordine etme akıl yürütme kapasitesine sahip olması durumunda işe yarar.

## Kullan onu

Hogwild! Nisan 2026 itibarıyla üretime entegrasyon araştırma düzeyindedir. Yandex/HSE/IST'in referans uygulaması PyTorch tabanlıdır ve DeepSeek-R1 ve QwQ modellerinde tek düğümlü çoklu işlem kurulumlarını hedefler.

Pragmatik benimseme yolu:

1. Muhakeme görevi iş yükünüzün profilini çıkarın. Keşif amaçlı (çoklu stratejiler, durum analizleri, arama) ve doğrusal olan token'ların oranını ölçün.
2. Keşif hakimse, iki işçili bir Hogwild çalıştırın! deney. Duvar süresindeki iyileşmeyi ölçün.
3. İyileşme 1,3x'in altındaysa koordinasyonun hakim olduğu rejimdesiniz. Tek işçiye dönüş.
4. İyileşme 1,5 katın üzerindeyse N=4'e basın ve tekrar ölçün. Azalan getiriler genellikle N=4-8 civarına ulaşır.

Spekülatif kod çözme ile birleştirin: her Hogwild! çalışan bağımsız olarak spesifikasyon kod çözmeyi kullanabilir. İki hızlandırma çoğalarak (kabaca) 3x spesifikasyon kod çözme ve 1,8x Hogwild getiriyor! saf tek çalışanlı kod çözme işlemine kıyasla etkili 5,4 kat daha fazla.

## Gönderin

Bu ders `outputs/skill-parallel-inference-router.md` üretir. Mantıklı bir iş yükü profili (token bütçesi, görev paralellik profili, model ailesi, deployment hedefi) göz önüne alındığında, oylama, düşünce ağacı, çoklu-agent, Hogwild! ve spekülatif kod çözme stratejileri arasında yönlendirme yapar.

## Egzersizler

1. `code/main.py`'yi varsayılan ayarlarla çalıştırın. N=2 Hogwild'i doğrulayın! konfigürasyon aynı duvar süresi içinde N=1 temel çizgisinden daha fazla iş-token üretir.

2. Koordinasyon buluşsal yönteminin gücünü azaltın (set `coordination_weight=0.1`). Yeniden çalıştırın. Hızlanmanın çöktüğünü gösterin. Nedenini açıklayın: İşçiler koordine olamadıkları zaman çabayı tekrarlıyorlar.

3. Beklenen Hogwild'i hesaplayın! `p=0.8, c=500` ve N=4 çalışanla 50ktoken akıl yürütme görevinin hızlandırılması. Aynısını `p=0.3, c=200` ve N=4 ile 1k-token sohbet görevi için yapın. Neden biri kazanırken diğeri kayıp oluyor?

4. Hogwild'i okuyun! Makalenin 4. Bölümü (ön değerlendirme). Yazarların bildirdiği iki arıza modunu tanımlayın. Daha iyi bir koordinasyonun prompt her birini nasıl hafifletebileceğini açıklayın.

5. Hogwild'i birleştirin! oyuncakta spekülatif kod çözme ile: her işçi dahili olarak 2-token spesifik kod çözme kullanır. Çarpımsal hızlanmayı bildirin. İki çalışanın her ikisi de aynı paylaşılan önbellek önekini genişletmek istediğinde hangi defter tutma sorunu ortaya çıkar?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Hogwild! | "Paralel çalışanlar, paylaşılan önbellek" | Aynı LLM'nin N örneği, tek bir paylaşılan KV önbelleğiyle eşzamanlı olarak çalışıyor; self-prompting yoluyla acil koordinasyon |
| Paylaşılan KV önbelleği | "Koordinasyon ortamı" | Tüm çalışanların okuyup yazdığı, büyüyen tek bir KV arabelleği; çalışanlar arasında anında token görünürlüğü sağlar |
| Acil durum koordinasyonu | "Eğitime gerek yok" | Muhakeme yeteneğine sahip LLM'ler, paylaşılan önbelleği okuyabilir ve işi herhangi bir fine-tuning veya açık protokol olmadan bölebilir |
| Koordinasyon yükü (c) | "Tokensayıyı oryantasyona harcadı" | Genişletilmiş önbelleği okumanın ve ne yapılacağına karar vermenin çalışan başına maliyeti; toplam kod çözme süresine kıyasla küçük kalmalı |
| Paralelleştirilebilir kesir (p) | "Neler paralel olarak çalışabilir?" | Görev düzeyinde paralellik: toplam işin doğası gereği sıralı olmayan kısmı |
| RoPE Hogwild'i mümkün kılıyor! | "Döner konumlar kaydırmayla değişmez" | Konumlar rotasyon olduğundan, paylaşılan bir önbelleğe yazmak, önceki tokens |
| Oylama topluluğu | "N'yi çalıştırın, çoğunluğu seçin" | En basit paralel inference topolojisi; sınıflandırma için yararlı, uzun biçimli akıl yürütme için daha az |
| Düşünce Ağacı | "Dal ve kuru erik" | Çoklu dalları ve kuru erikleri araştıran muhakeme stratejisi; açık koordinasyon mantığı |
| Çoklu-agent framework | "Alt görevleri atayın" | Her agent bir rol alır; bir koordinatör yönetir; ağır protokol yükü |

## Daha Fazla Okuma

- [Rodionov ve ark. — Hogwild! Inference: Eşzamanlı Dikkat Yoluyla Paralel LLM Oluşturma (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) — Hogwild! makale, QwQ ve DeepSeek-R1 hakkında ön değerlendirme
- [Recht, Re, Wright, Niu — Hogwild!: Stokastik Gradient İnişi Paralelleştirmeye Kilitsiz Bir Yaklaşım (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) — orijinal Hogwild!, adlandırma kaynağı
- [Su ve ark. — RoFormer: Döner Konumlu Embedding Geliştirilmiş Transformer (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) — RoPE, paylaşılan önbellek inference'yi izlenebilir hale getiren özellik
- [Yao ve ark. — Düşünce Ağacı: Büyük Dil Modelleriyle Kasıtlı Problem Çözme (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — düşünce ağacı akıl yürütme stratejisi Hogwild! dik oturur
- [Leviathan ve ark. — Spekülatif Kod Çözme (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) yoluyla Transformer'lardan hızlı Inference - spekülatif kod çözme, dizi içi paralellik Hogwild! ile oluşur
- [Hogwild! referans PyTorch uygulaması](https://github.com/eqimp/hogwild_llm) — makalenin deneyleri için tek gerçek kaynak
