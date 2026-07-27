# Doğrudan Tercih Optimizasyon Ailesi

> Rafailov ve ark. (2023), RLHF'nin optimumunun tercih verileri açısından kapalı bir forma sahip olduğunu gösterdi, böylece açık ödül modelini atlayıp politikayı doğrudan optimize edebilirsiniz. Bu içgörü, her biri DPO'nun arıza modunu düzelten bir aileyi (IPO, KTO, SimPO, ORPO, BPO) doğurdu. 2026'da doğrudan hizalama algoritmaları, PPO'ya göre daha fazla sınır eğitim sonrası çalıştırma gönderiyor. Ancak Ders 2'deki aşırı optimizasyon eğrisi hala geçerlidir: DAA'lar Goodhart'tan kaçmaz, yalnızca ısırdığı yere doğru hareket ederler.

**Tür:** Öğren
**Diller:** Python (stdlib, altı değişkenli tercih kaybı karşılaştırıcısı)
**Önkoşullar:** Aşama 18 · 01 (InstructGPT), Aşama 18 · 02 (Ödül korsanlığı), Aşama 10 · 08 (DPO temelleri)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- DPO kapalı formunu RLHF-KL optimumundan türetin.
- DPO'daki IPO, KTO, SimPO, ORPO, BPO düzeltmelerinin her birinin hata modunu belirtin.
- "Örtülü ödül açığını" "tercih gücü"nden ayırın ve halka arzın kimlik haritalamasının neden önemli olduğunu açıklayın.
- Neden Rafailov ve ark. (NeurIPS 2024), açık bir RM'ye sahip olmamasına rağmen DAA'ların aşırı optimizasyon yaptığını kanıtlıyor.

## Sorun

RLHF hedefi (Ders 1):

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

bilinen bir optimumu vardır:

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

Dolayısıyla ödül, dolaylı olarak optimal politikanın referansa oranıyla tanımlanır:

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

Bunu Bradley-Terry tercih olasılığına koyarsak, `Z(x)` bölme işlevi yalnızca `x`'ye bağlı olduğundan iptal olur. Geriye yalnızca politika parametrelerindeki kayıp kalıyor; ödül modeline gerek yok. Bu DPO'dur.

Kırışıklık: türetme, optimumun ulaşılabilir olduğunu, tercih verilerinin dağıtımda olduğunu ve referans politikasının gerçek mod çapası olduğunu varsayar. Bunların hiçbiri tam olarak geçerli değil. Her aile üyesi farklı, ihlal edilen bir varsayımı düzeltir.

## Konsept

### DPO (Rafailov ve diğerleri, 2023)

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

Neler yanlış gidebilir:

- Örtülü ödül açığı `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` sınırsızdır. Küçük bir tercih keyfi olarak büyük bir boşluk yaratabilir.
- Kayıp, seçilen ve reddedilen log-prob'ları zıt yönlere yönlendirir. Reddedilen daha hızlı düştüğü sürece seçilen mutlak log-probu aşağı itebilir. Bu, Bozulmuş Seçilmiş Yanıt olgusudur.
- Dağıtım dışı tercihler (nadir nadir çift vs nadir nadir çift) keyfi örtülü ödüller üretir.

### Halka arz (Azar ve diğerleri, 2024)

Kimlik Tercihi Optimizasyonu, log-sigmoid'i tercih olasılığına ilişkin bir kimlik eşlemesiyle değiştirir. Kayıp, sınırlı bir hedefte kare hata haline gelir:

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

Kenar boşluğu `1/(2 beta)` ile sınırlanmıştır. Tercih gücü ve örtülü ödül farkı orantılıdır. Patlama yok.

### KTO (Ethayarajh ve diğerleri, 2024)

Kahneman-Tversky Optimizasyonu ikili yapıyı tamamen kaldırır. Tek bir etiketli çıktı ve ikili bir "arzu edilen" veya "istenmeyen" sinyal verildiğinde, bir olasılık teorisi yardımcı programıyla eşleşir:

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

kazançlar ve kayıplar için farklı ağırlıklar (kayıptan kaçınma). Avantajı: Çok daha fazla miktarda bulunan eşleştirilmemiş verileri kullanabilirsiniz.

### SimPO (Meng ve diğerleri, 2024)

Basit Tercih Optimizasyonu, eğitim sinyalini üretimle uyumlu hale getirir. Referans politikasını tamamen kaldırın ve günlük olasılığını uzunluğa göre normalleştirin:

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

dengelemek için `gamma` kenar boşluğuyla. Uzunluk normalizasyonu, DPO'nun uzunluk sapması arıza modundan yararlanma teşvikini ortadan kaldırır (daha uzun `y_w` , yapı gereği daha büyük bir log-prob boşluğu verir).

### ORPO (Hong ve diğerleri, 2024)

Oran Oranı Tercih Optimizasyonu, standart SFT negatif log olasılığına bir tercih terimi ekler:

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

Referans politikası yok — SFT terimi düzenleyicidir. Temel modelden hizalanmış modele kadar tek aşamada eğitim alın. Ayrı bir SFT kontrol noktası yok.

### BPO (ICLR 2026 gönderimi, OpenReview kimliği=b97EwMUWu7)

Azaltılmış Seçilmiş Yanıtlar sorununu tanımlar: DPO, `y_w > y_l` sıralamasını korur ancak `y_w` 'nin mutlak log-olasılığı düşebilir. BPO, seçilen yanıttaki aşağı yönlü hareketleri cezalandıran tek satırlık bir düzeltme ekler. DPO üzerinden Llama-3.1-8B-Instruct matematik muhakemesinde +%10,1 doğruluk bildirildi.

### Evrensel sonuç: DAA'lar hâlâ aşırı optimize ediliyor

Rafailov ve ark. "Doğrudan Hizalama Algoritmalarında Ödül Modeli Aşırı Optimizasyonu için Ölçeklendirme Yasaları" (NeurIPS 2024), KL bütçeleri genelinde birden fazla dataset üzerinde DPO, IPO, SLiC ile eğitimli politikalar. Altın ödülüne karşı KL eğrileri aynı Gao ve ark. zirve ve çöküş şekli. Örtülü ödül, eğitim sırasında dağıtım dışı örnekleri sorgular; KL düzenlemesi bunu dengelemez.

DAA'lar Goodhart'tan kaçamaz. "Ödül modelinin aşırı optimize edilmesinden" "referans politikası oranının aşırı optimize edilmesine" kadar ısırdığı yüzeyi değiştiriyorlar. Evrensel çözüm (daha iyi veriler, topluluklar, erken durdurma) her ikisi için de geçerlidir.

### Aralarından Seçim Yapmak (2026)

- Büyük eşleştirilmiş tercih verileriniz varsa: Muhafazakar beta ile DPO, uzunluk eğilimi belirginse SimPO.
- Eşlenmemiş ikili geri bildiriminiz varsa: KTO.
- Temel modelden tek aşamalı bir işlem hattı istiyorsanız: ORPO.
- DPO günlüklerinde bozulmuş seçilmiş günlük olasılıkları görürseniz: BPO.
- Tercih güçleri büyük ölçüde farklılık gösteriyorsa ve DPO doyuma ulaşıyorsa: Halka arz.

Her laboratuvar beşini de pille çalıştırıyor ve görev başına kazananı seçiyor. Matematiksel akıl yürütme ve güvenlik açısından optimumun aynı olmasının hiçbir nedeni yoktur.

```figure
dpo-margin
```

## Use It — Hazır Araçla Uygula

`code/main.py` , gerçek tercih gücünün çifte göre değiştiği bir oyuncak tercihindeki dataset altı kaybı (DPO, IPO, KTO, SimPO, ORPO, BPO) karşılaştırır. Her kayıp, küçük bir softmax politikasıyla aynı 500 çiftlik örneğe göre optimize edilir. Yöntem başına nihai kazanma oranını, seçilen günlük olasılık kaymasını ve örtülü ödül dağılımını çizer.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-preference-loss-selector.md` üretir. dataset istatistikleri (eşleştirilmiş vs eşleşmemiş, değişken vs tek tip tercih gücü, uzunluk dağılımı) ve bir hedef (tek aşamalı veya SFT-o zaman tercihi) göz önüne alındığında, bir tercih kaybı önerin ve koruduğu başarısızlık modunu bildirin.

## Egzersizler

1. `code/main.py`'yı çalıştırın. DPO ve BPO için seçilen son günlük olasılık düşüşünü bildirin. BPO daha yüksek seçilmiş mutlak olasılığı korumalıdır - bunu doğrulayın.

2. Tüm çiftlerin eşit güce sahip olması için tercih verilerini değiştirin. Altı yöntemden hangisi en sağlamdır? Hangisi bozulur? Halka arzın avantajını burada açıklayın.

3. Reddedilen yanıtları seçilen yanıtların ortalama 2 katı kadar uzun yapın. Başka hiçbir şeyi değiştirmeden, DPO'nun uzunluk kullanımını sayısal olarak ve SimPO'nun düzeltmesini gösterin.

4. Rafailov ve ark. (NeurIPS 2024), DAA'ların aşırı optimize edildiğini iddia ediyor. Tek noktalı bir sürümü yeniden oluşturun: seçilen eksi reddedilen KL farklılığını çizin ve büyük betada DPO'da aşırı optimizasyonu gözlemleyin.

5. BPO makale özetini okuyun (OpenReview b97EwMUWu7). BPO'nun DPO'ya eklediği tek satırlık düzeltmeyi yazın. `code/main.py`'daki uygulamaya karşı onaylayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| DPO | "Ödül modeli olmayan RLHF" | Kapalı formdaki RLHF optimumundan elde edilen kayıp; yalnızca politika parametreleri |
| Örtülü ödül | "log oranı" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — DPO'nun ima ettiği ödül |
| halka arz | "sınırlı DPO" | Log-sigmoid'i kimlikle değiştirir; örtülü ödül açığı `1/(2 beta)` |
| KTO | "eşleştirilmemiş DPO" | Kayıptan kaçınma ile tek etiketler üzerinden beklenti teorisi faydası |
| SimPO | "referanssız DPO" | Uzunluk normalleştirilmiş log-olabilirlik + kenar boşluğu; referans politikası yok |
| ORPO | "tek aşamalı DPO" | NLL + olasılık oranı tercih terimi; tek geçişte temel modelden trenler |
| BPO | "seçilen-koruyan DPO" | DPO artı seçilen yanıtın mutlak log-probunu azaltmanın cezası |
| Bozulmuş Seçilmiş | "seçilenler aşağı iner" | Reddedilenler daha hızlı düştüğü sürece DPO, seçilen günlük olasılığını azaltır |
| DAA | "doğrudan hizalama algoritması" | Açık bir RM'yi atlayan herhangi bir tercih kaybı yöntemi |

## Daha Fazla Okuma

- [Rafailov ve ark. — Doğrudan Tercih Optimizasyonu (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar ve ark. — İnsan Tercihlerinden Öğrenmeyi Anlamak İçin Genel Bir Teorik Paradigma (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — Halka Arz
- [Ethayarajh ve ark. — KTO: Olasılık Teorik Optimizasyonu Olarak Model Hizalama (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Davranış Koruma Optimizasyonu (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov ve ark. — DAA'larda RM Aşırı Optimizasyonu için Ölçeklendirme Yasaları (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
