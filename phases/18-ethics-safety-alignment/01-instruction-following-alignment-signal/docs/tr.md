# Hizalama Sinyali Olarak Talimat Takibi

> RLHF'ye yönelik sonraki her eleştiri bu boru hattına karşı çıkıyor. Optimizasyon baskısının bir proxy'yi nasıl bozduğunu incelemeden önce proxy'yi görmeniz gerekir. InstructGPT (Ouyang ve diğerleri, 2022) referans mimarisini tanımladı: talimat-yanıt çiftleri üzerinde denetlenen fine-tuning, ikili tercih sıralamaları üzerine eğitilmiş bir ödül modeli ve SFT politikasına KL cezası ile ödül modeline karşı PPO. 175B GPT-3 yerine 1.3B InstructGPT tercih edildi. Bu tek sonuç, 2026'da her sınır laboratuvarının hâlâ RLHF şeklinde eğitim sonrası boru hattı göndermesinin nedenidir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak üç aşamalı işlem hattı)
**Önkoşullar:** Aşama 10 · 06 (SFT), Aşama 10 · 07 (RLHF), Aşama 10 · 08 (DPO)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- InstructGPT hattının üç aşamasını ve her birinde kullanılan kaybı adlandırın.
- 1.3B talimat ayarlı modelin insan tercihi değerlendirmesinde ham 175B GPT-3'ü neden geride bıraktığını açıklayın.
- 3. aşamadaki KL cezasının neye karşı koruduğunu ve onu kaldırmanın neden mod arama davranışına dönüştüğünü belirtin.
- Uyum vergisini ve PPO-ptx azaltımını açıklayın Ouyang ve ark. ona karşı kullanılır.

## Sorun

Önceden eğitilmiş dil modelleri metni tamamlar. Sorulara cevap vermiyorlar. GPT-3'e "bir listeyi tersine çeviren bir Python işlevi yaz" dediğinizde sıklıkla başka bir prompt yanıtı alırsınız, çünkü eğitim dağıtımının çoğu, daha fazla web metniyle devam eden web metnidir. Model işini yapıyor; iş yanlış.

Bunu düzeltmek için her ciddi laboratuvarın kullandığı vekil insan tercihidir. İki tamamlama değerlendiriciye gider; değerlendirici daha iyi olanı seçer; Bir ödül modeli değerlendiriciyi öğrenir. Daha sonra bir RL döngüsü, politikayı ödül modelinin yüksek puan aldığı çıktılara doğru kaydırır. Bu, üç cümlelik InstructGPT tezinin tamamıdır. Makalenin geri kalanı mühendisliktir.

## Konsept

### Aşama 1: denetlenen fine-tuning (SFT)

Yanıtın iyi niyetli bir insanın yazacağı yanıt olduğu prompt-yanıt çiftlerini toplayın. Ouyang ve diğerleri. etiketleyicilerden ve OpenAI API'sinden 13 bin prompt kullanıldı. Standart çapraz entropi kaybıyla bu verilerdeki temel modele ince ayar yapın.

SFT'nin size sağladığı şey: Model artık soruları sürdürmek yerine yanıtlıyor. Size vermediği şey: birden fazla yanıt makul olduğunda değerlendiricinin hangi yanıtı tercih edeceğine dair herhangi bir işaret.

### Aşama 2: ödül modeli (RM)

Her prompt için SFT modelinden K tamamlamasını örnekleyin. Bir etiketleyici onları sıralıyor. Herhangi bir prompt-yanıt çiftini puanlayan bir ödül modeli eğitin; böylece, `y_w` 'nin `y_l` yerine tercih edildiği çiftler için:

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

Bu Bradley-Terry ikili tercih kaybıdır. RM genellikle SFT modelinden başlatılır ve LM kafası bir skaler kafa ile değiştirilir.

Ödül modelleri küçük: 175B InstructGPT için 6B yeterliydi. Ayrıca kırılgandırlar; makalenin 5. bölümü çoğunlukla küçük ölçekte ortaya çıkan ödül korsanlığı davranışlarıyla ilgilidir.

### 3. Aşama: KL cezasıyla PPO

Hedefi tanımlayın:

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

PPO ile maksimuma çıkarın. KL terimi, `pi` 'nin SFT politikasından uzaklaşmasını önler. Bu olmadan, optimize edici rakip örnekler bulur; RM altında yüksek puan alan dizeler, çünkü insanlar onları gerçekten tercih ettiği için değil, RM onları hiç görmemiştir.

KL katsayısı `beta` en önemli tek RLHF hiperparametresidir. Çok düşük: ödül hackleme. Çok yüksek: SFT'ye göre gelişme yok.

### Uyum vergisi

RLHF'den sonra model insanlar tarafından tercih edilir ancak standart benchmark'lara (SQuAD, HellaSwag, DROP) göre geriler. Ouyang ve diğerleri. buna hizalama vergisi adını verin ve PPO-ptx ile düzeltin: ön eğitim gradient'leri RL hedefine karıştırın, böylece model hiçbir zaman ödüllendirilmediği aşağı yönlü görevlerin nasıl yapıldığını unutmaz.

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx standart hale geldi. Antropik, DeepMind ve Meta'nın tümü bazı değişkenleri kullanır.

### Sonuç

Etiketleyiciler tarafından 175B bazlı GPT-3 yerine yaklaşık %70 oranında 1.3B InstructGPT (SFT + RM + PPO-ptx) tercih edilir. Üretim trafiğindeki gizli test prompt'lar arasındaki fark genişliyor. Bu numarayı okumak için iki şey:

1. Uyum, yetenekten farklı bir eksendir. 175B modeli daha fazla yeteneğe sahipti; 1.3B modeli daha fazla hizalamaya sahipti; etiketleyiciler hizalanmış olanı tercih etti.
2. Yetenek tabanı temel modele göre belirlenir. Hiç görmediği gerçekleri bilmek için temel bir modeli RLHF yapamazsınız.

### Neden bu Aşama 18 için referans noktasıdır?

Sonraki derslerdeki her eleştiri - ödül hackleme (Ders 2), DPO (Ders 3), dalkavukluk (Ders 4), CAI (Ders 5), uyuyan agent'lar (Ders 7), hizalama sahtekarlığı (Ders 9) - bu hattın bir kısmına karşı çıkıyor. Ödül korsanlığı saldırıları 2. aşama. DPO, 2. ve 3. aşamaları çökertir. CAI, insan etiketleyicinin yerini alır. Dalkavukluk, etiketleyicinin taraflı bir sinyal olduğunu gösterir. Hizalama sahtekarlığı, politikanın tamamen 3. aşama etrafında dönebileceğini gösteriyor. Öncelikle kafanızda boru hattı olmadan bu eleştirilerin hiçbirini takip edemezsiniz.

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak tercihi verilerindeki üç aşamayı simüle eder. Temel "politika", {A, B, C} eylemlerine karşı önyargılı bir paradır. Aşama 1 SFT, 200 prompts'deki etiketleme eylemlerini taklit eder. Aşama 2, 500 ikili sıralamadan Bradley-Terry ödül modeline uyar. Aşama 3, SFT politikasına KL cezası içeren basitleştirilmiş bir PPO güncellemesi çalıştırır. Ödül tırmanışını, KL farklılığının büyümesini ve politika sapmasını izleyebilir ve 50 güncelleme adımında ödül hacklemenin göründüğünü görmek için KL dönemini kapatabilirsiniz.

Neye bakmalı:

- `beta = 0.1` ve `beta = 0.0` ile ödül yörüngesi.
- KL(pi || pi_SFT) eğitim adımları üzerinden.
- Etiketleyici tercihine kıyasla son eylem dağılımı.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-instructgpt-explainer.md` üretir. Bir RLHF boru hattı açıklaması veya bir makale özeti verildiğinde, üç aşamadan hangisinin değiştirildiğini, her aşamada hangi kaybın kullanıldığını ve bir KL cezasının veya eşdeğer bir düzenleyicinin mevcut olup olmadığını tanımlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. `beta = 0.0` 'yi ayarlayın ve 200 PPO adımı sonrasında eylem dağılımını raporlayın. Mod arama davranışını bir paragrafta açıklayın.

2. Ödül modelini, B eylemi için +0,5 önyargıya (simüle edilmiş bir ödül hatası) sahip olacak şekilde değiştirin. PPO'yu `beta = 0.1` ile çalıştırın. KL cezası, politikanın önyargıdan yararlanmasını engelliyor mu? İstismar hangi `beta` 'de görünür hale gelir?

3. Ouyang ve ark.'yı okuyun. (arXiv:2203.02155) Şekil 1. PPO'yu 1, 5, 20, 100 adım için çalıştırarak ve tercihi SFT modeline göre ölçerek etiketleme tercihi eğrisini yeniden oluşturun.

4. Makalenin Bölüm 4.3'ü, 1.3B InstructGPT'nin 175B GPT-3'ü yaklaşık %70 oranında yendiğini bildirmektedir. Bu oran neden gizli üretim prompt'larde etiketleyicinin kendi prompt'larine göre daha yüksek olsun ki?

5. Aynı tercih verilerinde PPO kaybını DPO (Aşama 10 · 08) ile değiştirin. Nihai politika sapmasını (KL'den SFT'ye) ve nihai ödülü karşılaştırın. Hangi yöntem eşleşen ödülde daha da ileri gidiyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| SFT | "talimat ayarı" | Aşama 1: prompt-yanıt çiftlerinde çapraz entropi ince ayarı |
| Ödül modeli | "RM" | Skaler regresör (prompt, yanıt) Bradley-Terry ile ikili etiketler üzerinde eğitildi |
| Bradley-Terry | "çiftli tercih kaybı" | -log sigmoid(r_w - r_l); ikili sıralamayı ikili sınıflandırmaya indirir |
| KL penaltı | "düzenleyici" | `beta * KL(pi \|\| pi_SFT)` — RL politikasını SFT çapasının yakınında tutar |
| PPO-ptx | "Ön eğitim karışımıyla PPO" | Uyum vergisini dengelemek için PPO hedefine eğitim öncesi günlük olasılığının bir kısmını ekler |
| Uyum vergisi | "RLHF regresyonu" | RLHF'nin hedeflemediği standart benchmark'larda RLHF sonrası düşüş |
| Etiketleyici tercihi | "temel gerçek" | İnsan sıralaması örneği; RM bunun istatistiksel bir göstergesidir, "insani değerler" için değil |

## Daha Fazla Okuma

- [Ouyang ve ark. — İnsan geri bildirimiyle talimatları takip edecek şekilde dil modellerini eğitmek (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — InstructGPT belgesi, takip edilen her RLHF ardışık düzeninin temeli
- [Stiennon ve ark. — İnsan geri bildirimlerinden özetlemeyi öğrenme (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — özetleme için RLHF'nin öncülü
- [Christiano ve ark. — İnsan tercihlerinden derin takviyeli öğrenme (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — orijinal tercihe dayalı RL formülasyonu
- [Bai ve ark. — RLHF ile Yararlı ve Zararsız Bir Asistanın Eğitimi (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — Anthropic'in InstructGPT hattının HH uzantısı
