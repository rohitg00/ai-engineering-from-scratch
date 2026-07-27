# Yapay Zeka Kontrolü — Yıkılmaya Rağmen Güvenlik

> Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024). Control, güvenlik sorusunu yeniden çerçevelendiriyor: Size karşı rakip olarak optimizasyon yapan, güvenilmeyen güçlü bir U modeli göz önüne alındığında, hangi protokoller kabul edilemez bir sonuç olasılığını sınırlarken faydalı işler çıkarmanıza izin verir? Kaynaklar, güvenilir bir zayıf model T, güvenilir insan emeği H bütçesi ve U'nun çıktılarını düzenleme yeteneğidir. Bu çerçevede, Güvenilir Düzenleme, kod arka kapı görevlerinde Güvenilmeyen İzlemeye Pareto hakimdir. Çerçeve, güvenlik mühendisliğinden en kötü durum varsayımlarını devralmıştır: güvenlik, rakip olarak seçilen bir U'nun, U'nun yerine geçen kırmızı takım baskısı altında ölçülen, kabul edilemez somut bir sonuca neden olamama olasılığıdır.

**Tür:** Öğren
**Diller:** Python (stdlib, arka kapı kodu görevinde güvenlik ve kullanışlılık sınırı)
**Önkoşullar:** Aşama 18 · 07 (uyuyan agents), Aşama 18 · 08 (planlama), Aşama 18 · 09 (hizalama sahteciliği)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Yapay Zeka Kontrolü tehdit modelini tanımlayın: güvenilmeyen güçlü model U, güvenilen daha zayıf model T, güvenilen insan bütçesi H.
- Güvenilir Düzenleme protokolünü ve ICML 2024 kod arka kapı görevinde Güvenilmeyen İzlemede Pareto'nun neden baskın olduğunu açıklayın.
- Hizalama (U güvenilirdir) ile kontrol (U güvenilir değildir ve biz zaten güvendeyiz) arasındaki farkı açıklayın.
- Kontrolün üç sınırını belirtin: İnsanlar ölçeklenmez, güvenilen zayıf modeller eninde sonunda geride kalır, kontrol güvenilir güçlü modeller üretmez.

## Sorun

7-9. Dersler, bir sınır modelinin aldatıcı bir şekilde hizalanabileceğini, planlanabileceğini veya sahte hizalanabileceğini ortaya koyuyor. Güvenlik sorusu yeniden çerçeveleniyor: Güvenmediğimiz bir modelden, ona kabul edilemez sonuçlara neden olma fırsatını vermeden yararlı işler çıkarabilir miyiz? Bu kontrol problemidir ve klasik güvenlik gibi yapılandırılmıştır: en kötü durumdaki rakibi varsayalım, bir protokol tasarlayın, kırmızı takım baskısı altında rakibin başarı oranını ölçün.

## Konsept

### Tehdit modeli

Kontrol şunları varsayar:
- U — güvenilmeyen güçlü model. Yetenekli. Muhtemelen düşmanca (değerlendirme sanki öyleymiş gibi ele alıyor).
- T — güvenilir, zayıf model. Daha az yetenekli, ancak düşman olmadığı biliniyor.
- H — güvenilir insan emeği. Küçük bütçe; ölçeklenmiyor.

Sistem, U kullanarak faydalı çıktı üretmelidir. Rakip, kullanışlılık eşiklerini geçmek için meşru yararlı çalışmanın bir kısmını korurken, somut kabul edilemez bir sonuca (e.g., gönderilen koddaki bir arka kapı) neden olmaya çalışır.

Kontrol, U'ya güvenmeyi bırakır. U'nun güven eksikliği durumunda hangi protokollerin güvenliği sağladığını sorar.

### ICML 2024 arka kapı görevi

Prompt'lar rekabet düzeyindeki kodlama sorunlarıdır. U aday çözüm üretiyor. Çözümün bir arka kapı (kodun yanlış bir çıktı üretmesine neden olan belirli bir giriş) içermesi durumunda gizli bir oracle işaretlenir. Kırmızı takım U'yu kontrol eder ve tüm protokol dahili bileşenlerini görmesine izin verilir. Protokol, arka kapı nakliye oranını bir eşiğin altında tutarken çözülen sorun oranını en üst düzeye çıkarmalıdır.

### Dört protokol karşılaştırıldı

- **Temel:** U'nun çıktısını doğrudan gönderir. Yararlılık maksimuma ulaştı. Güvenlik minimum.
- **Ön denetim:** tüm çıktılarda H kullanın. Güvenlik maksimuma çıkarıldı. Bütçe çabuk tükendi.
- **Güvenilmeyen İzleme:** ikinci bir U örneği, ilk örneğin çıktısını puanlar; H işaretli çıktıları denetler. Risk: İki U örneği gizli anlaşma yapabilir.
- **Güvenilir Düzenleme:** T, her sorguda U'nun çıktısını düzenler. T emin değilse H'ye yönlendirin.

Greenblatt ve ark. Güvenilir Düzenlemeyi Bul Pareto hakimdir Güvenilmeyen İzleme: her güvenlik düzeyinde daha yüksek kullanışlılık.

### Neden Güvenilir Düzenleme kazanıyor?

Güvenilmeyen İzleme, U'nun ikinci örneğinin birinciyle koordine olamamasını gerektirir. Gizli anlaşma steganografik ipuçları veya paylaşılan eğitim öncelikleri yoluyla mümkündür. Protokolün, monitörün sinyalini azaltan gizli anlaşma direncine (başka kelimelerle ifade etme, şaşırtma) bütçe ayırması gerekiyor. Güvenilir Düzenleme, T'ye güvenildiğinden gizli anlaşmayı tamamen önler; T'nin önerdiği herhangi bir düzenleme, varsayım gereği, düşmanca değildir. Bunun maliyeti, T'nin daha az yetenekli olmasıdır, bu nedenle aşırı reddedebilir veya ince arka kapıları kaçırabilir.

### Dört protokol ekseni

1. U'nun oynadığı rol: yalnızca yapımcı, monitör veya her ikisi.
2. T'nin oynadığı rol: editör, monitör veya yeniden örnekleyici.
3. H nasıl tahsis edilir: tek tip denetim, rastgele denetim veya bayrağa yönelik denetim.
4. Protokolün gizli anlaşmaya karşı direnç için ne kadar hesaplama harcadığı.

### Hizalama ve kontrol

- Hizalama: "U'ya güvenmek güvenli mi?" 2, 4, 5, 6, 7, 8, 9. derslerin hepsi bununla ilgilidir.
- Kontrol: "U'ya güvenmeden güvenle kullanabilir miyiz?" Ders 10.

Hizalama modelin bir özelliğidir. Kontrol, deployment protokolünün bir özelliğidir. Kontrol uyumlu modeller üretmez; muhtemelen hizalanmamış modellerin güvenli kullanımını sağlar. Her iki gündeme de ihtiyaç var.

### Üç temel sınır

- İnsanlar ölçeklenmez. H bütçesi, katı yapay zeka çıktılarını denetlemek isteyen insan sayısıyla sınırlıdır.
- Güvenilir zayıf modeller eninde sonunda geride kalır. T, U'dan çok daha zayıf olduğunda, T'nin düzenleme sinyali gürültüye dönüşür.
- Kontrol hizalama değildir. ASL-3'te çalışan protokoller (Ders 18) ASL-4'te çalışmayabilir; eğer U, T'yi manipüle edebilirse veya H'nin denetim dağıtımı hakkında mantık yürütebilirse, kontrol başarısız olur.

### 2025 gelişimi

Birleşik Krallık AISI ve Redwood, Kontrol Güvenlik Durumları (metr.org / redwoodresearch.org 2025) üzerinde işbirliği yapıyor: bir kontrol güvenlik durumu, U hakkındaki en kötü durum varsayımları altında protokolün kabul edilemez bir sonuç olasılığını sınırladığını savunuyor. Güvenlik durumları (Ders 18) kontrol çerçevesini devralır.

### Bunun 18. Aşamada yeri nedir

6-9. Dersler tehdidi açıklamaktadır (aldatma mümkündür). Ders 10, tehdidin gerçek olduğu varsayımı altında savunma paradigmasını anlatıyor. Ders 11, tamamlayıcı saldırı paradigmasını açıklamaktadır (ölçeklenebilir gözetim yoluyla U'yu güvenilir kılmak).

## Use It — Hazır Araçla Uygula

`code/main.py` bir oyuncak arka kapı görevindeki dört protokolü simüle eder. U çıktılar üretir; bir kısmı arka kapıya kapatılmıştır (kırmızı takım politikası). T onaylar veya düzenler. H bir bütçe için çağrıldı. Greenblatt ve diğerlerinde Pareto sınırını yeniden oluşturmak için bütçeyi ve gizli anlaşma parametresini tarayabilirsiniz. 2024 Şekil 2 (sayı değil şekil).

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-control-protocol-audit.md` üretir. Bir deployment protokol açıklaması verildiğinde, U/T/H rollerini tanımlar, gizli anlaşma vektörlerini adlandırır ve kırmızı takım baskısı altında protokolün kullanışlılık-güvenlik sınırındaki konumunu tahmin eder.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Güvenilir Düzenleme ve Güvenilmeyen İzleme için kullanışlılık-güvenlik sınırını yeniden oluşturun. Güvenilmeyen İzleme'nin gizli anlaşma varsayımının önemli hale geldiği bütçe rejimini belirleyin.

2. Yeni bir protokol ekleyin: "T düşük sıcaklıkla yeniden örnekler, ardından U, T'nin çıktısını düzenler." Sınırdaki konumunu ölçün. Bu neden Güvenilir Düzenleme'den daha feci bir şekilde başarısız oluyor?

3. 2024 belgesi U'nun protokolü görebildiğini varsaymaktadır. Hangi çıktıların denetlendiğini U'dan gizleyen bir protokol tasarlayın. Bu protokol deployment altyapısından ne gerektiriyor?

4. Greenblatt ve ark.'yı okuyun. 2024 Bölüm 7 (gizli anlaşma). Gizli anlaşmaya karşı bir direnç önlemi önerin ve beklenen fayda maliyetini açıklayın.

5. U = GPT-4-sınıfı, T = GPT-3.5-sınıfı, H = denetlenen çıktıların %1'ini kullanan bir deployment için bir kontrol güvenlik durumu ifade edin. Vakanın dayandığı en güçlü tek varsayımı belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Yapay Zeka Kontrolü | "Yıkılma altında güvenlik" | Kabul edilemez sonuçları en kötü durum U altında sınırlayan protokol tasarımı |
| Güvenilmeyen model (U) | "güçlü model" | İş çıkarmak istediğimiz ama güvenmediğimiz yetenekli model |
| Güvenilir model (T) | "zayıf model" | Rakip olmadığı bilinen, editör/monitör olarak kullanılan daha zayıf bir model |
| Güvenilir insan (H) | "denetim bütçesi" | Sınırlı uzman emeği; masraflı; temel gerçek sinyali |
| Güvenilir Düzenleme | "T U'yu düzenler" | T'nin U'nun çıkışlarındaki kapı olduğu protokol; H belirsiz çıktılara çağrıda bulundu |
| Güvenilmeyen İzleme | "U, U'yu izler" | İkinci bir U örneğinin çıktıları puanladığı protokol; yalnızca ekstra yatırımla gizli anlaşmalara dayanıklı |
| Kontrol güvenlik kutusu | "resmi argüman" | Bir protokolün düşmanın başarısını en kötü durum U |

## Daha Fazla Okuma

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942) — kanonik ICML 2024 makalesi
- [Redwood Research — En son AI Control makaleleri dizini](https://redwoodresearch.substack.com/) — 2024-2025 takipleri
- [Birleşik Krallık AISI + METR — Güvenlik durumlarının kontrolü](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — sınır laboratuvarları için operasyonelleştirme
- [Hubinger ve ark. — Uyuyan Agent'ler (Ders 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566) — tehdit modeli kontrolü şunu varsayar:
