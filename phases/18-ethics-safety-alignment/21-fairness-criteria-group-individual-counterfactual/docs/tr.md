# Adillik Kriterleri — Grup, Bireysel, Karşı Olgusal

> Adalet literatürünü üç aile yapılandırıyor. Grup adaleti: demografik eşitlik, eşit oranlar, koşullu kullanım doğruluğu eşitliği - korunan gruplar arasında ortalama olarak eşit oranlar. Bireysel adalet (Dwork ve ark. 2012): benzer bireyler benzer kararları alır; Karar haritasında Lipschitz koşulu. Karşıolgusal adalet (Kusner ve ark. 2017): Bir karar, hassas nitelikler karşıolgusal olarak değiştirildiğinde değişmediği takdirde birey için adildir. 2024 teorik sonucu (NeurIPS 2024): doğasında CF-doğruluk dengesi vardır; modelden bağımsız bir yöntem, optimal fakat adil olmayan bir tahminciyi, sınırlı doğruluk kaybı olan bir CF tahmincisine dönüştürür. Karşı olguların geriye doğru izlenmesi (arXiv:2401.13935, Ocak 2024): Yasal olarak korunan niteliklere müdahale edilmesini gerektirmeyen yeni paradigma. Felsefi uzlaşma (ICLR Blogposts 2024): nedensel grafiklerle, belirli grup adaleti önlemlerinin karşılanması, karşıolgusal adaleti gerektirir.

**Tür:** Öğren
**Diller:** Python (stdlib, üç kriterli karşılaştırma)
**Önkoşullar:** Aşama 18 · 20 (önyargı), Aşama 02 (klasik ML)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç grup adaleti kriterini (demografik eşitlik, eşitlenmiş oranlar, koşullu kullanım doğruluk eşitliği) ve bir imkansızlık sonucunu belirtin.
- Bireysel adaleti Dwork ve diğerleri aracılığıyla tanımlayın. 2012 Lipschitz formülasyonu.
- Karşıolgusal adaleti ve onun nedensel grafik bağımlılığını açıklayın.
- Karşıt olguları geriye doğru izlemeyi ve korunan özniteliğe müdahale probleminden neden kaçındıklarını açıklayın.

## Sorun

20. ders önyargının ölçülmesiyle ilgiliydi. 21. Ders, ölçümün hizmet etmesi gereken adalet standardının tanımlanmasıyla ilgilidir. Üç aile yapısal olarak farklı standartlar veriyor; bir model grup açısından adil ve bireysel olarak adaletsiz, karşı olgusal olarak adil ve grup açısından adaletsiz olabilir. Bir standardın seçilmesi bir politika kararıdır; hiçbir standart evrensel olarak optimal değildir.

## Konsept

### Grup adaleti

- **Demografik eşitlik.** Tüm gruplar için P(Y=1 | A=a) = P(Y=1 | A=a'). Eşit kabul oranları.
- **Eşitleştirilmiş oranlar.** P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a'). Gruplar arasında eşit TPR ve FPR.
- **Koşullu kullanım doğruluğu eşitliği.** P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a'). Gruplar arasında eşit tahmin değeri.

İmkansızlık (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): bu üçü eşit olmayan baz oranlar altında aynı anda karşılanamaz.

### Bireysel adalet

Dwork ve ark. 2012. Bir f karar haritası, eğer |f(x) - f(x')| ise, göreve özgü benzerlik metriği d açısından bireysel olarak adildir. Bazı Lipschitz sabiti L için <= L * d(x, x') . Benzer bireyler benzer kararlar alırlar.

Tanımlamayı gerektirir d. Politika sorusu, istatistiksel değil.

### Karşıolgusal adalet

Kusner ve ark. 2017. Nüfusun nedensel bir modeli altında, i'nin hassas özellikleri karşı olgusal olarak değiştirildiğinde karar değişmiyorsa, bir karar birey i için karşıolgusal olarak adildir.

Nedensel bir DAG gerektirir. DAG bir modelleme seçimidir. Karşıolgusal adalet ancak DAG kadar meşrudur.

### CF-doğruluk dengesi

NeurIPS 2024 teorik: Karşıolgusal adalet ile tahmine dayalı doğruluk arasında doğal bir denge vardır. Modelden bağımsız bir yöntem, sınırlı bir doğruluk maliyetiyle optimal ancak adil olmayan bir tahminciyi CF tahminciye dönüştürebilir. Doğruluk maliyeti, optimal adil olmayan tahmincideki hassas nitelik katsayısının büyüklüğüne bağlıdır.

### Karşıt olguları geriye doğru izlemek

arXiv:2401.13935 (Ocak 2024). Geleneksel karşıolgusal yaklaşımlar, hassas niteliğe müdahale edilmesini gerektirir: "Bu kişi farklı bir cinsiyet olsaydı karar değişir miydi?" Yasal olarak bu sorunludur: Korunan niteliklere sınıflandırma hukukunda müdahale edilemez.

Geriye doğru giden karşıolgusal ifadeler yönü tersine çevirir: niteliğe müdahale etmek yerine, bireyin gerçek özelliklerinin hangi kombinasyonunun karşıolgusal sonucu üretebileceğini sorun. Bu hukuki itirazı ortadan kaldırır.

### Felsefi uzlaşma

ICLR Blogposts 2024. Eldeki nedensel bir grafikle, belirli grup adaleti önlemlerinin karşılanması karşıolgusal adaleti gerektirir. Üç aile birbirine dik değildir; bunlar aynı temel nedensel yapının farklı yönleridir.

Bu, imkansızlık teoremlerini çözmez (eşit olmayan taban oranları hâlâ eş zamanlı grup adaletini engellemektedir). Ancak "grup" ile "bireysel/karşı-olgusal" arasındaki bariz karşıtlığın kısmen nedensel model hakkında açık olmama artifact olduğunu göstermektedir.

### Bunun 18. Aşamada yeri nedir

Ders 20 önyargı ölçümüdür. Ders 21 adaletin tanımıdır. Ders 22 mahremiyettir (diferansiyel mahremiyet). Ders 23 filigranlamadır. Bunlar, aldatmaya bitişik Dersler 7-11'i tamamlayan tahsise bitişik derslerdir.

## Use It — Hazır Araçla Uygula

`code/main.py` , hassas bir özniteliğe ve eşit olmayan taban hızlarına sahip bir oyuncak ikili sınıflandırma dataset oluşturur. Basit bir sınıflandırıcıda demografik eşitliği, eşitlenmiş olasılıkları ve koşullu kullanım doğruluğu eşitliğini hesaplayın. Birbiriyle çelişen üç ölçümü gözlemleyin. Demografik eşitlik için yeniden ağırlıklandırma uygulayın ve bunun diğer ikisi üzerindeki maliyetini gözlemleyin.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-fairness-criterion.md` üretir. Bir adalet iddiası veya politikası göz önüne alındığında, hangi kriterin iddia edildiğini, modelin iddia edilen eşit olmayan taban oranlar altında kalan kriterleri karşılayıp karşılayamayacağını ve iddianın hangi nedensel DAG'a bağlı olduğunu tanımlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Varsayılan verilerdeki üç grup metriğini raporlayın. Demografik eşitlik hedefli yeniden ağırlıklandırmayı uygulayın ve yeniden raporlayın.

2. Dwork ve diğerlerini uygulayın. Hassas olmayan özelliklerde L2'yi kullanan 2012 bireysel adalet metriği. Kaç çiftin Lipschitz'i L=1 sabitiyle ihlal ettiğini bildirin.

3. Kusner ve ark.'nı okuyun. 2017. Puanlamayı sürdürmek için iki özellikli basit bir nedensel DAG oluşturun ve bunun ima ettiği karşı olgusal adalet koşulunu belirleyin.

4. 2024 tarihli geri izleme-karşı olgular belgesi, korunan niteliklere müdahaleyi önler. Bunun yasal uyumluluk açısından önemli olduğu bir senaryoyu açıklayın.

5. ICLR 2024 uzlaşması, grup adaletinin ve karşıolgusal adaletin aynı yapının yönleri olduğunu ileri sürüyor. `code/main.py` 'daki üç kriterden ikisini seçin ve bunları eşdeğer kılacak nedensel varsayımı belirtin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Demografik eşitlik | "eşit oranlar" | P(Y=1 | A=a) gruplar arasında eşit |
| Eşitlenmiş oranlar | "eşit TPR/FPR" | Gruplar arasında eşit doğru pozitif ve yanlış pozitif oranları |
| Koşullu kullanım doğruluğu | "eşit PPV/NPV" | Gruplar arasında eşit tahmin değerleri |
| Bireysel adalet | "Lipschitz durumu" | Benzer kişiler benzer kararlar alıyor |
| Karşıolgusal adalet | "nedensel değişiklik değişmezliği" | Karşıolgusal nitelik değişikliği nedeniyle karar değişmedi |
| Karşıolgusal geri izleme | "gerçekler aracılığıyla açıkla" | Karşıolgusal, nitelikten ileri değil, sonuçtan geriye doğru gerekçelendirilmiştir |
| İmkansızlık teoremi | "üç çatışma" | Chouldechova / KMR 2017: eşit olmayan taban oranlar altında birbirini dışlayan grup kriterleri |

## Daha Fazla Okuma

- [Dwork ve ark. — Farkındalık Yoluyla Adillik (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) — bireysel adalet
- [Kusner, Loftus, Russell, Silva — Karşıolgusal Adalet (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) — karşıolgusal adalet
- [Chouldechova — Farklı etkiye sahip adil tahmin (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) — imkansızlık
- [Karşı Gerçekleri Geriye İzleme (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) — korumalı öznitelik müdahaleleri için yeni paradigma
