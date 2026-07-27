# Show-o ve Ayrık Difüzyon Birleşik Modelleri

> Transfüzyon sürekli ve ayrık temsilleri karıştırır. Show-o (Xie ve diğerleri, Ağustos 2024) diğer tarafa gidiyor: metin token'ler nedensel sonraki token tahminini kullanıyor, görüntü token'ler MaskGIT ruhuna uygun olarak maskelenmiş ayrık difüzyon kullanıyor. Her ikisi de hibrit bir dikkat maskesiyle bir transformer'nin içinde oturuyor. Sonuç, VQA, metinden görüntüye, iç boyama ve karma modalite oluşturmayı tek bir omurgada, her modalite için bir tokenizer, bir kayıp formülasyonunda (sonraki token, maskelenmiş tahmine genişletilmiş) birleştirir. Bu derste Show-o tasarımı anlatılıyor - maskeli ayrık difüzyonun neden paralel, birkaç adımlı bir görüntü oluşturucu olduğu - ve Transfusion ve Emu3 ile tezat oluşturuyor.

**Type:** Learn
**Diller:** Python (stdlib, maskeli-ayrık-difüzyon örnekleyici)
**Önkoşullar:** Aşama 12 · 13 (Transfüzyon)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Maskelenmiş ayrık difüzyonu açıklayın: token'leri eşit şekilde maskeleyen program daha sonra transformer'den bunları kurtarmasını ister.
- Hız ve kalite açısından paralel görüntü kod çözmeyi (Show-o, MaskGIT) otoregresif görüntü kod çözmeyle (Chameleon, Emu3) karşılaştırın.
- Show-o'nun tek bir kontrol noktasında gerçekleştirdiği üç görevi adlandırın: T2I, VQA, görüntü içi boyama.
- Bir maskeleme planı (kosinüs, doğrusal, kesik) seçin ve bunun örnek kalitesi üzerindeki etkisinin nedenini belirleyin.

## Sorun

Transfüzyonun iki kayıplı eğitimi işe yarıyor ancak daha karmaşık dinamiklere sahip; sürekli difüzyon kaybı, ayrık NTP kaybından farklı bir sayısal ölçekte yaşıyor. Kayıp ağırlıklarının dengelenmesi bir hiperparametre aramasıdır. Mimari etkili ancak karmaşıktır.

Show-o'nun cevabı: Her iki yöntemi de ayrı tutun (Chameleon gibi), ancak görüntüleri sıralı yerine maskelenmiş ayrık difüzyon yoluyla paralel olarak oluşturun. Eğitim hedefi, sonraki token tahminini doğal olarak genelleştiren tek bir maskeli token tahmini haline gelir.

## Konsept

### Maskeli ayrık difüzyon (MaskGIT)

Orijinal Chang ve ark. (2022) MaskGIT numarası zariftir. Tamamen maskelenmiş bir görüntüyle başlayın (her token, özel `<MASK>` kimliğidir). Her adımda, tüm maskelenmiş token'leri paralel olarak tahmin edin, ardından en emin K tahminlerini koruyun ve geri kalanını yeniden maskeleyin. ~8-16 yinelemeden sonra tüm token'ler doldurulur. Adım başına kaç token'nin maskesinin kaldırılacağına ilişkin program ayarlanır — kosinüs programları iyi çalışır.

Eğitim basittir: [0, 1]'den eşit bir maskeleme oranı örnekleyin, bunu görüntünün VQ token'lerine uygulayın, maskelenmiş olanları kurtarmak için transformer'yi eğitin. Tam olarak BERT'in metin için yaptığı şeyin görüntü oluşturmaya ölçeklendirilmesi.

### Show-o: bir transformer, hibrit maske

Show-o, MaskGIT'i nedensel dil modeli transformer'nin içine yerleştirir. Dikkat maskesi:

- Metin tokens: nedensel (standart LLM).
- Görüntü token'ler: görüntü bloğu içinde tam çift yönlü (böylece maskelenmiş token'ler tahmin sırasında diğer tüm token görüntülerini görebilir).
- Metinden resme: metin önceki görsellerle ilgilenir, görsel ise önceki metne katılır.

Eğitim şu şekilde değişir:
1. Metin dizilerinde standart NTP.
2. T2I örnekleri: metin → maskelenmiş görüntü token'ler içeren görüntü, maskelenmiş-token-tahmin kaybı.
3. VQA örnekleri: resim → maskelenmiş metin içeren metin token'ler (gerçekte sadece NTP).

Birleşik kayıp, `<MASK>` token'lerde hem metin NTP'sini (yalnızca son token "maskelenmiştir") hem de görüntü maskeli difüzyonu (rastgele alt küme maskelenmiştir) kapsayan çapraz entropidir.

### Parallel sampling

Show-o, ~1000 (token başına otoregresif) veya ~20 (difüzyon) yerine ~16 adımda bir görüntü oluşturur. Her adımda, tüm maskelenmiş token'leri paralel olarak tahmin edin; en iyi K'yi kendinize güvenerek taahhüt edin; tekrarlamak.

Karşılaştırın:
- Chameleon / Emu3 (token'ler üzerinde otoregresif): N_token'lerin ileri geçişleri, genellikle görüntü başına 1024-4096.
- Transfüzyon (sürekli difüzyon): ~20 adım, her biri tam bir transformer geçişi.
- Show-o (maskeli ayrık difüzyon): ~16 adım, her biri tam bir transformer geçişi.

Show-o, benzer ölçekli modellerde Chameleon'dan daha hızlıdır ve adım başına daha düşük maliyetle Transfüzyon adım sayısıyla kabaca eşleşir (ayrık kelime logitleri ve sürekli MSE kaybı).

### Görevler tek bir kontrol noktasında

Show-o, prompt formatına göre seçilen inference'de dört görevi destekler:

- Metin oluşturma: standart otoregresif metin çıkışı.
- VQA: resim girişi, metin çıkışı.
- T2I: maskelenmiş ayrık dağıtım yoluyla metin girişi, görüntü çıkışı.
- İç boyama: bazı token'lerin maskelendiği görüntü, doldurun.

İç boyama yeteneği maskeli tahmin eğitiminden ücretsiz olarak gelir. VQ-token ızgarasının bir bölgesini maskeleyin, geri kalanını artı bir prompt metnini besleyin, maskelenmiş token'leri tahmin edin.

### Maskeleme programı

Adım başına kaç token'nin maskesinin kaldırılacağına ilişkin program, kaliteyi şekillendirir. Show-o kosinüsü önerir:

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

0. adımda tüm token'ler maskelenir (oran 1,0). T adımında hiçbiri maskelenmedi. Kosinüs, kütleyi tahminin en bilgilendirici olduğu orta aralık oranlarına yoğunlaştırır. Doğrusal çizelgeler de işe yarar ancak daha hızlı sabitlenir.

### Gösteri-o2

Show-o2 (2025 takibi, arXiv 2506.15564) Show-o'yu ölçeklendirir: daha büyük LLM tabanı, daha iyi tokenizer, geliştirilmiş maske programı. Aynı mimari desen.

### Show-o'nun oturduğu yer

2026 taksonomisinde:

- Ayrık token'ler + NTP: Chameleon, Emu3. Basit ama yavaş inference.
- Ayrık token'ler + maskeli difüzyon: Show-o, MaskGIT, LlamaGen, Muse. Paralel örnekleme, tokenizer'ye göre hala kayıplı.
- Sürekli + difüzyon: Transfüzyon, MMDiT, DiT. En yüksek kalitede, daha karmaşık eğitim.
- Bir VLM'de sürekli + akış eşleştirme: JanusFlow, InternVL-U. En yeni.

Göreve göre seçim: Makul hızda tek bir açık modelde T2I + iç boyama + VQA istediğinizde Show-o; Kalitenin en önemli olduğu ve iki kayıplı tesisatı karşılayabildiğiniz zaman transfüzyon.

## Kullan onu

`code/main.py` Show-o örneklemesini simüle eder:

- 16 VQ token'den oluşan bir oyuncak ızgarası.
- prompt'ye ve şu anda maskesi kaldırılmış olan token'lere dayalı olarak logitleri tahmin eden sahte bir "transformer".
- Kosinüs programıyla 8 adımda paralel maskeli örnekleme.
- Ara durumları (maske modeli gelişimi) ve son token'leri yazdırır.

Çalıştırın, maskenin adım adım çözülmesini izleyin.

## Gönderin

Bu ders `outputs/skill-unified-gen-model-picker.md`'yi üretir. Açık ağırlık kısıtlamasıyla hem anlaşılması (VQA, altyazı ekleme) hem de oluşturulması (T2I, iç boyama) gerektiren bir ürün verildiğinde, somut ödünleşimlerle Show-o ailesi, Transfusion/MMDiT ailesi ve Emu3 / Chameleon ailesi arasında seçim yapın.

## Egzersizler

1. ~16 adımda maskelenmiş ayrık difüzyon örnekleri. Neden 1 değil? 0. adımda her şeyin maskesini kaldırırsanız ne bozulur?

2. Maskeli difüzyonla iç boyama ücretsizdir. Show-o'nun iç boyamasının uzman bir modeli geride bıraktığı bir ürün kullanım durumu (gerçek veya varsayımsal) önerin.

3. Kosinüs çizelgesi ve doğrusal çizelge: T=8 için adım başına maskesiz token'lerin sayısını izleyin. Hangisi daha dengeli?

4. 512x512 Show-o görüntüsü 1024 token'dir. Kelime K=16384'te model 1024 * log2(16384) = 14.336 bit (~1,75 KiB) veri yayar. Kararlı Difüzyon, 512*512*24 bit = 6.291.456 bit (~768 KiB) ham piksel çıkışı sağlar. Sıkıştırma oranı nedir ve hangi kaliteyi satın alır?

5. LlamaGen'i (arXiv:2406.06525) okuyun. LlamaGen'in sınıf koşullu otoregresif görüntü modelinin Show-o'nun maskeli yaklaşımından farkı nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Maskelenmiş ayrık difüzyon | "MaskGIT tarzı" | Maskelenmiş token'leri tahmin etme eğitimi; inference'de en güvenilir tahminlerin maskesini yinelemeli olarak ortaya çıkarın |
| Kosinüs programı | "Programın maskesini kaldır" | inference adımlarında maske oranının azalması; güven artışını orta aralıkta yoğunlaştırıyor |
| Paralel kod çözme | "Tüm token'ler aynı anda" | Her adım, maskelenmiş token'lerin tam sırasını tek bir ileri geçişte tahmin eder ve ardından top-K |
| Hibrit dikkat | "Nedensel + çift yönlü" | Metin token üzerinde nedensel ve görüntü blokları içinde çift yönlü maske |
| İç boyama | "Doldurma oluşturma" | Bazı token'lerin maskelendiği bir görüntüdeki koşul, eksik olanları tahmin edin; eğitim hedefinden muaf |
| Taahhüt oranı | "Top-K per step" | Yineleme başına kaç tane token'nin "tamamlandığı" bildirildi; kontroller inference ile kalite dengesi |

## Daha Fazla Okuma

- [Xie ve ark. — Gösteri-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Göster-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang ve ark. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun ve ark. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang ve ark. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
