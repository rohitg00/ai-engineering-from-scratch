# STAR, V-STAR, Quiet-STAR — Kendi Kendine Öğretilen Muhakeme

> Mümkün olan en küçük kişisel gelişim döngüsü mantığın içinde yer alır. Bir model bir düşünce zinciri oluşturur, doğru cevaplara ulaşanları tutar ve bunlara ince ayar yapar. Bu STAR'dır. V-STaR bir doğrulayıcı ekler, böylece inference-zaman seçimi daha iyidir. Quiet-STaR mantığı her token'e indirir. Üçü de çalışıyor. Hiçbiri sihir değil; döngü, doğru cevaba ulaşmak için kullanılan tüm kısayolları korur.

**Tür:** Öğren
**Diller:** Python (stdlib, önyükleme döngüsü simülatörü)
**Önkoşullar:** Aşama 13 · 01-03 (Akıl Yürütme ve CoT), Aşama 15 · 01 (uzun ufuk çerçeveleme)
**Süre:** ~60 dakika

## Sorun

Bir modele akıl yürütmeyi öğretmenin basit yolu, insan tarafından yazılan akıl yürütme izlerini toplamaktır. Bu pahalıdır, yavaştır ve insanların ne kadar yüksek kaliteli düşünce zinciri yazmaya istekli olduklarıyla sınırlıdır.

STaR (Kendi Kendini Öğreten Akılcı, Zelikman ve diğerleri, 2022) şunu sorar: Model kendi gerekçelerini yazıp bunları bilinen yanıtlara göre derecelendirirse ne olur? Döngü:

1. Bir muhakeme takibi artı cevabı örnekleyin.
2. Son cevap doğruysa izi sürdürün.
3. Tutulan izlere ince ayar yapın.
4. Tekrar edin.

İşe yarıyor. GSM8K ve CommonsenseQA'nın her ikisi de yeni insan açıklaması olmadan iyileştirildi. Ancak döngünün yerleşik bir önyargısı vardır: Doğru cevabı üreten herhangi bir mantık, muhakemenin kendisinin sağlam olup olmadığına bakılmaksızın korunur. V-STaR (Hosseini ve diğerleri, 2024) bunu öğrenilmiş bir doğrulayıcıyla yamalar; Quiet-STaR (Zelikman ve diğerleri, 2024) bu fikri per-token iç rasyonellere genelleştirir.

## Konsept

### STaR: neyin işe yaradığına dair önyükleme

Biraz zayıf muhakeme yeteneği olan temel bir modelle başlayın. Her eğitim probleminde bir gerekçe artı cevabı örnekleyin. Cevap etiketle eşleşiyorsa (sorun, gerekçe, cevap) üçlüsünü koruyun. Tutulan setteki modele ince ayar yapın. Tekrarlamak.

Bir bükülme önemlidir. Eğer model bir problemi hiçbir zaman doğru çözemezse, döngü bunu öğrenemez. STaR **rasyonelleştirme** ekler: modelin başarısız olduğu sorunlar için, ipucu olarak doğru cevabı enjekte edin ve ona yol açan bir mantık üretmek için modeli yenidenprompt yapın. Eğitim setine rasyonelleştirilmiş gerekçeler eklenir.

Orijinal makaledeki sonuç (Zelikman ve diğerleri, 2022): GSM8K'de rasyonelleştirme ile tekrarlanan STaR turları yoluyla %5,8'den %10,7'ye iyileştirilen bir GPT-J temel modeli - yaklaşık yüzde 5 mutlak puan. CommonsenseQA'da, STaR eğitimli GPT-J 6B, ince ayarlı GPT-3 175B (~%73) ile karşılaştırılabilecek şekilde %72,5'e ulaştı; bu, elle açıklamalı gerekçelerle eğitilmiş kabaca 30 kat daha büyük bir model.

### V-STaR: DPO ile bir doğrulayıcıyı eğitin

STaR yanlış gerekçeleri ortadan kaldırır. Hosseini ve ark. (2024) bunların da veri olduğunu gözlemlemiştir: her bir (gerekçe, "bu doğru mu") çifti bir doğrulayıcıyı eğitebilir. Bir sıralama oluşturmak için hem doğru hem de yanlış çözümler yerine Doğrudan Tercih Optimizasyonunu kullanırlar. inference zamanında, N gerekçeyi örnekleyin ve doğrulayıcının en iyi seçimini seçin.

Bildirilen delta: GSM8K ve MATH'de önceki kişisel gelişim temellerine göre yüzde +4 ila +17 puan; kazancın çoğu, ek oluşturucu fine-tuning yerine inference-zaman seçimi için doğrulayıcının kullanılmasından geliyor.

### Sessiz-STaR: başına-token dahili mantık

Zelikman ve ark. (2024) şunu sordu: Ya model sadece problem ile cevap arasında değil, her token pozisyonda kısa bir dahili mantık üretmeyi öğrenirse? Quiet-STaR, tahmin edilen her token öncesinde gizli bir "düşünce" yaymak için bir modeli eğitir, ardından öğrenilen bir ağırlık aracılığıyla düşünce farkındalığına sahip tahmini temel tahminle karıştırır.

Sonuç: Mistral 7B, göreve özel fine-tuning olmadan GSM8K'de %5,9'dan %10,9'a ve CommonsenseQA'da %36,3'ten %47,2'ye mutlak sıfır atış iyileştirmeleri elde etti. Model "ne zaman düşüneceğini" öğrendi; zor token'lar daha uzun içsel mantıklara sahip olur; kolay olanlar neredeyse hiç alamaz.

### Neden üçü de aynı güvenlik endişesini paylaşıyor?

Her üç yöntem de son cevabı gradient sinyali olarak kullanır. Kısa yoldan faydalanmak, tahminde bulunmak veya genellemeyen bir kalıp kullanmak gibi hatalı akıl yürütme yoluyla doğru cevaba ulaşan bir mantık, olumlu bir şekilde pekiştirilir. Dağıtım içi problemlerde kısayol işe yarar. Dağıtım dışı problemlerde sessizce bozulur.

V-STaR'ın doğrulayıcısı, gerekçeleri sıralamayı öğrenerek hafifletir, ancak doğrulayıcı aynı etiket seti üzerinde eğitilir. Dürüst belirsizlik yerine iyi biçimlendirilmiş yanlış akıl yürütmeyi tercih etmeyi öğrenebilir. Daha güvenli tasarım, STaR tarzı verileri (a) süreç denetimli ödül modelleri (sadece yanıtları değil, ara adımları ödüllendiren) ve (b) basit kısayolları ortadan kaldıran uzun süreli OOD değerlendirmesiyle birleştirmektir.

### Karşılaştırmak

| Yöntem | Eğitim sinyali | Inference maliyet | Veri israfı | Bilinen arıza modu |
|---|---|---|---|---|
| YILDIZ | doğruysa devam et (gerekçe, cevap) | 1x | tüm yanlış gerekçeleri bir kenara bırakır | kısayol gerekçeleri |
| STaR + rasyonelleştirme | yukarıda + doğru cevap ima edilen yeniden denemeler | 1x | daha az | rasyonelleştirilmiş gerekçeler mantıksız olabilir |
| V-STAR | Her iki sınıftan STaR + DPO doğrulayıcı | Nx (N'nin en iyisi) | minimum | doğrulayıcı kendinden emin yanlışlığı güçlendirebilir |
| Sessiz-STAR | per-token mantığı + karışım ağırlığı | 1,5-3x | minimum | hala cevap koşullu gradient |

### Bunun 2026 yığınında yeri nerede

STAR eski. Ancak bu model 2025-2026'da her yerde yeniden ortaya çıkıyor. Doğrulanabilir matematik problemlerindeki RL (DeepSeek-R1, Kimi-k1.5, o1), STaR'ın ölçeklendirilmiş yanıt koşullu gradient sinyalidir. Süreç ödül modelleri (Lightman ve diğerleri, 2023; OpenAI'nin "Adım adım doğrulayalım") süreç denetimli alternatifidir. AlphaEvolve (Ders 3), kod için STaR'dir ve etiket yerine program değerlendiriciye sahiptir. Darwin Gödel Makinesi (Ders 4), agent iskelesinin kendisi için STaR'dir.

STaR'ı anlamak tüm bu tıklamaları sağlar. Bu, minimum uygulanabilir kişisel gelişim döngüsüdür.

```figure
reflection-loop
```

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak aritmetik görevinde simüle edilmiş bir STaR döngüsü çalıştırıyor. Şunları izleyebilirsiniz:

- Önyükleme turlarında doğruluk nasıl artıyor?
- Kısayollar nasıl gizlice içeri giriyor: Simülatör, zamanın %40'ında doğru cevabı alan ancak kötü bir şekilde genelleyen "tembel" bir mantık sınıfı içeriyor. STaR'ın bunları tutup tutmadığını izleyin.
- Bir doğrulayıcının (V-STaR stili) inference'da nasıl yardımcı olduğu ancak eğitim sırasında tanıtılan kısayolları tam olarak budayamadığı.

## Ship It — Kullanıma Sun

`outputs/skill-star-loop-reviewer.md` , önerilen kendi kendine öğrenilen muhakeme hattı üzerinde eğitim almadan önce onu denetlemenize yardımcı olur.

## Egzersizler

1. Simülatörü çalıştırın. Kısayol frekansını sıfıra, ardından 0,4'e ayarlayın. Her ikisi de eğitim dağılımında >%90'a ulaşsa bile, iki çalıştırma arasında nihai doğruluk ne kadar farklılık gösteriyor?

2. Simülatöre uzatılmış bir OOD testi ekleyin. Farklı bir dağıtımdan problemler çıkarın ve önyüklemeli modeli hem dağıtım içi hem de OOD setlerinde değerlendirin. Boşluğu ölçün.

3. Quiet-STaR makalesini okuyun (arXiv:2403.09629) Bölüm 3. "Düşüncenin sonu" token ve karıştırma ağırlığı başlığını üçer cümleyle açıklayın.

4. STaR'ın doğruysa tut filtresini, her rasyonel adımı bağımsız olarak ödüllendiren süreç denetimli bir alternatifle karşılaştırın. Etiketleme maliyet farkını ve makul kalite farkını belirleyin.

5. Dağıtılmış bir modelde kısayol gerekçelerini yakalayacak bir değerlendirme tasarlayın. Mükemmel olması gerekmez; bir STaR döngüsünün güçlendireceği en basit kısayolları ortadan kaldırması gerekir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| YILDIZ | "Kendi Kendini Öğretmiş Akılcı" | Doğru yanıtları sağlayan model tarafından oluşturulan gerekçelere ince ayar yapın; tekrarla |
| Rasyonalizasyon | "İpucu yeniden deneme" | Doğru cevabı enjekte edin ve temel modelin başarısız olduğu sorunların gerekçesini yeniden-prompt yapın |
| V-STAR | "Doğrulayıcı STaR" | DPO, bir doğrulayıcıyı hem doğru hem de yanlış gerekçeler konusunda eğitir, onu inference-zaman seçimi için kullanın |
| Sessiz-STAR | "Per-token gerekçesine göre" | Her token pozisyonda gizli düşünceler üret; temel tahminle karıştırın |
| Cevap koşullu gradient | "Sonuca dayalı sinyal" | Eğitim döngüsü, akıl yürütme adımlarını değil, nihai yanıtları ödüllendirir |
| Süreç ödül modeli | "Adım düzeyinde doğrulayıcı" | Sonuç değil, adım başına doğruluk üzerine eğitilmiş ödül modeli - STaR ile tezat oluşturuyor |
| Kısayol mantığı | "Doğru cevap, yanlış muhakeme" | Etikete genelleyici olmayan bir kalıpla ulaşan bir gerekçe; STaR bunları saklıyor |

## Daha Fazla Okuma

- [Zelikman ve ark. (2022). STaR: Muhakeme ile Muhakeme Önyüklemesi](https://arxiv.org/abs/2203.14465) — orijinal makale.
- [Hosseini ve ark. (2024). V-STaR: Kendi Kendini Öğreten Akıl Yürütenler için Eğitim Doğrulayıcıları](https://arxiv.org/abs/2402.06457) — inference-zaman seçimi için bir DPO doğrulayıcı ekler.
- [Zelikman ve ark. (2024). Quiet-STaR: Dil Modelleri Kendilerine Konuşmadan Önce Düşünmeyi Öğretebilir](https://arxiv.org/abs/2403.09629) — per-token dahili mantıklara göre.
- [Lightman ve ark. (2023). Adım Adım Doğrulayalım](https://arxiv.org/abs/2305.20050) — ödül modellerini, alternatif gradient sinyalini işleyin.
- [DeepSeek-R1 makalesi (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — Doğrulanabilir görevlerde RL, sınır eğitimine ölçeklendirilmiş STaR.
