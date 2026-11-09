# Dürüstlük Kriterileri  Grup, Bireysel, Karşılıklı

> Adalet edebiyatını üç aile düzenliyor. Grup adilliği: demografik eşitlik, eşit olasılıklar, koşullu kullanım doğruluğu eşitliği  korunan gruplar arasında ortalama eşit oranlar. Bireysel adillik (Dwork et al. 2012): benzer bireyler benzer kararlar alır; karar haritasında Lipschitz durumu. Gerçeklere karşı adillik (Kusner et al. 2017): Hissedici özellikler karşıt bir şekilde değiştirildiğinde değişmezse bir karar birey için adil olacaktır. 2024 teorik sonucu (NeurIPS 2024): CF vs. doğruluk içeren bir değişim vardır; bir model-agnostik yöntem, optimal ama haksız bir tahminciyi sınırlı doğruluk kaybı olan CF'ye dönüştürür. Geriye doğru geriye doğru doğrular (arXiv:2401.13935, Ocak 2024): yasal olarak korunan özellikler üzerinde müdahale gerekmesinden kaçınan yeni bir paradigma. Felsefi uzlaşma (ICLR Blogposts 2024): sebepli grafikler ile, belirli grup adalet önlemlerini tatmin etmek karşı gerçek adaleti içerir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Grup adaletinin üç kriterini (demografik eşitlik, eşitliğe sahip oranlar, koşullu kullanım doğruluğunun eşitliği) ve bir imkansızlık sonucu belirtin.
- Dwork et al. 2012 Lipschitz formülü ile bireysel adalet tanımlayın.
- Karşı gerçeklik adilliği ve nedensel grafik bağımlılığı anlatın.
- Geriye doğru geriye doğru karşılıkları ve müdahale ile korunan özellik sorunu neden kaçınılması gerektiğini açıklayın.

## Sorun

Ders 20 tarafsızlığı ölçmekle ilgiliydi. Ders 21 ölçüm hizmet etmesi gereken adillik standardını tanımlamakla ilgiliydi. Üç aile yapısal olarak farklı standartlar verir.

## Anlaşım

### Grup adilliği

- **Demographic parity.**P\Y=1\A=a=P\Y=1\A=a') tüm gruplar için.
- **Equalized odds.**P  Y=1  Y*=y, A=a) = P  Y=1  Y*=y, A=a') gruplar arasında eşit TPR ve FPR.
- **Conditional use accuracy equality.**P\Y*=y\Y=y, A=a) = P\Y*=y\Y=y, A=a\') gruplar arasında eşit tahminsel değer.

İmkansızlık (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): Bu üçü eşit olmayan temel oranlarda aynı anda tatmin edilemez.

### Kişisel adalet

Dwork et al. 2012. Bir karar haritası f, belirli bir Lipschitz sabit L için bireysel olarak adil bir görev-spesifik benzerlik metrikine d if (f(x) - f(x') <= L * d(x, x') göre benzer kararlar alır.

D. Politik soru, istatistik değil.

### Gerçeklere karşı adillik

Kusner et al. 2017. Bir karar birey için karşıt olarak adil olur i eğer, nüfusun nedensel bir modeli altında, karar değişmez i hassas özellikler karşıt olarak değiştirildiğinde.

Bir sebepçi DAG gerektirir. DAG bir model seçeneği. Karşıt gerçeklik adillik sadece DAG kadar haklı.

### CF vs. Düzgünlik karşılığı

NeurIPS 2024 teorik: karşıt gerçeklik ve tahminsel doğruluk arasında doğuştan bir değişim vardır. Bir model-agnostik yöntem, sınırlı bir doğruluk maliyetinde, optimal ama haksız bir tahminciyi CF'ye dönüştürebilir.

### Geriye dönme karşı faktörleri

ArXiv:2401.13935 (Ocak 2024): Geleneksel karşı faktörler hassas özelliğe müdahale gerektirir  "Bu kişi farklı bir cinsiyet olsaydı karar değişir miydi". Hukuki olarak, bu sorunlu: korunan özelliğe sınıflandırma yasasında müdahale edilmez.

Geriye doğru karşı faktörler yönünü tersine çeviriyor: özelliğe müdahale etmek yerine, bireyin gerçek özelliklerinin hangi kombinasyonunun karşı faktör sonuçları doğurduğunu sorun. Bu yasal itirazın önüne geçiyor.

### Felsefi uzlaşma

ICLR Blogposts 2024. Bir sebep grafikini elinde tutarak, belirli grup adalet önlemlerini tatmin etmek karşı gerçek adalet gerektirir.

Bu, imkansızlık teoremlerini çözmez (eşitsiz temel oranlar hala aynı anda grup adilliğini engeller). Ancak "grup" ve " bireysel / kontrafaktal" arasındaki görünen muhalefetin kısmen sebep model hakkında açık olmayan bir eser olduğunu gösterir.

### Bu 18 fazaya uygun.

Ders 20 tarafsızlık ölçümü. Ders 21 adillik tanımlaması. Ders 22 gizlilik (farklı gizlilik). Ders 23 su işaretlemesi. Bunlar, aldatma ile bitişik dersleri tamamlayan tahsisle ilgili dersler 7-11.

```figure
an-fairness-trilemma
```

## Kullan

`code/main.py`Bu, bir oyuncakın duyarlı bir özelliği ve eşit olmayan temel oranları olan ikili sınıflandırma verileri oluşturur. Demografik eşitliği, eşitliğe sahip oranları ve koşullı kullanım doğruluğu eşitliğini basit bir sınıflandırıcıda hesaplayın. Üç ölçüyü birbirinden farklı olarak gözlemleyin. Demografik eşitlik için yeniden ağırlık uygulayın ve diğer iki maliyetini gözlemleyin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-fairness-criterion.md`. Adalet iddiası veya politikası göz önüne alındığında, hangi kriterin talep edildiğini, modelin iddia edilen eşitsiz temel oranlar altında kalan kriterleri karşılayabileceğini ve iddia hangi sebepli DAG'den bağlı olduğunu belirler.

## Egzersizler

1. Çık .`code/main.py`. Öntanımlı veriler üzerinde üç grup ölçüsünü rapor edin. Demografik eşitlik hedefli yeniden ağırlama ve yeniden raporlama uygulayın.

2. Hissetisiz özellikler üzerinde L2 kullanarak Dwork et al. 2012 bireysel adillik ölçüsünü uygulayın. Lipschitz'i sürekli L=1 ile kaç çift ihlal ettiğini bildirin.

3. Kusner et al. 2017'yi okuyun. Başlangıç notları için basit iki özellikli bir sebepli DAG oluşturun ve içerdiği karşı gerçeklik-eğenlik koşulunu belirleyin.

4. 2024'te geriye doğru geriye doğru karşı faktörler makalesi korunan özelliklere müdahaleden kaçınır.

5. ICLR 2024 uzlaşması, grup ve karşı gerçek adilliği aynı yapının yönleri olduğunu savunuyor.`code/main.py`ve onları eşdeğer kılan sebepçi varsayımı belirtin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | "equal rates" | P(Y=1 | A=a) equal across groups |
| Equalized odds | "equal TPR/FPR" | Equal true-positive and false-positive rates across groups |
| Conditional use accuracy | "equal PPV/NPV" | Equal predictive values across groups |
| Individual fairness | "Lipschitz condition" | Similar individuals get similar decisions |
| Counterfactual fairness | "causal alteration invariance" | Decision unchanged under counterfactual attribute alteration |
| Backtracking counterfactual | "explain via actuals" | Counterfactual reasoned backward from outcome, not forward from attribute |
| Impossibility theorem | "the three conflict" | Chouldechova / KMR 2017: group criteria mutually exclusive under unequal base rates |

## Daha Fazla Okumak

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) bireysel adalet
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) karşı gerçek adillik
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) imkansızlık
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) Korunmuş özellikler ile ilgili yeni bir paradigma
