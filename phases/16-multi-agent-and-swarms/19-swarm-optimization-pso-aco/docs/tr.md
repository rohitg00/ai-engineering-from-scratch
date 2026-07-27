# LLM'ler için Swarm Optimizasyonu (PSO, ACO)

> Biyo-ilhamlı optimizasyon, LLM'ye geri dönüyor. **LMPSO** (arXiv:2504.09247), her parçacığın hızının bir prompt olduğu ve LLM'nin bir sonraki adayı oluşturduğu PSO'yu kullanır; yapılandırılmış dizi çıktıları (matematik ifadeleri, programlar) üzerinde iyi çalışır. **Model Swarms** (arXiv:2410.11163) her LLM uzmanını model ağırlıklı manifold üzerindeki bir PSO parçacığı gibi ele alır ve yalnızca 200 örnekle 9 dataset saniyede 12 taban çizgisi üzerinden **%13,3 ortalama kazanç** bildirir. **SwarmPrompt** (ICAART 2025), prompt optimizasyonu için PSO + Gri Kurt'u hibritleştirir. **AMRO-S** (arXiv:2603.12933), çoklu agent LLM yönlendirmesi için ACO'dan ilham alan feromon uzmanlarıdır — **4,7 kat hızlanma**, yorumlanabilir yönlendirme kanıtı, inference'yi öğrenmeden ayıran kalite kapılı asenkron güncelleme. Bu ders, PSO'yu prompt parametre uzayında ve ACO'yu agent yönlendirmesinde uygular, bu klasik algoritmaların neden LLM çağına uyduğunu ve ne zaman uymadığını ölçer.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 09 (Paralel Sürü Ağları), Aşama 16 · 14 (Konsensus ve BFT)
**Süre:** ~75 dakika

## Sorun

Görev değerlendirmenizde %62 puan alan bir prompt'niz var. Onu geliştirmek istiyorsun. Bu saf hareket, kötü ölçeklenen gradientücretsiz manuel ince ayardır. Takviyeli öğrenim, ödül sinyallerine ve eğitim için yeterli sayıda kullanıma ihtiyaç duyar. prompts üzerinden geri yayılım gerçekten mümkün değildir — prompt ayrık bir dizedir, türevlenebilir bir parametre değildir.

Klasik biyo-ilhamlı optimizasyon (sürekli arama alanları için PSO, yol seçimi için ACO) tam olarak bu rejim için tasarlandı: gradient-ücretsiz, nüfusa dayalı, değerlendirme başına ucuz. gradientücretsiz arama adımı için bunları Yüksek Lisans'larla eşleştirdiğinizde şaşırtıcı derecede pratik bir optimize edici elde edersiniz.

Aynı modeller çoklu-agent sistemlerdeki agent *yönlendirme* için de geçerlidir. ACO tarzı bir feromon izi, hangi agent'ın hangi görev türünde en iyi şekilde çalıştığını kaydeder, yönlendiricinin bu izi kullanmasına izin verir ve rotaların yeniden keşfedilebilmesi için feromonları bozar.

## Konsept

### PSO tazeleme (Kennedy ve Eberhart 1995)

Parçacık Sürü Optimizasyonu: sürekli bir arama uzayındaki parçacıkların popülasyonu. Her parçacığın `x_i` konumu ve `v_i` hızı vardır. Her yineleme:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

`p_best` parçacığın kendisinin en iyisi, `g_best` sürünün en iyisi, `w, c1, c2` atalet + bilişsel + sosyal ağırlıklar, `r1, r2` rastgele faktörlerdir.

### LLM çıkışlarında PSO — LMPSO

arXiv:2504.09247, LLM tarafından oluşturulan yapısal çıktılar (matematik ifadeleri, programlar) için PSO'yu uyarlar. Her parçacık bir aday çıktıdır. Hız, mevcut çıktının kişisel/küresel en iyiye doğru nasıl değiştirileceğini açıklayan bir *prompt*'dır. LLM yeni çıktıyı prompt hızından üretir. Hızın "atalet"i "küçük artımlı değişiklikler yap" gibi bir prompt'dir.

Bu şu durumlarda iyi çalışır:
- Çıktı yapılandırılmıştır (ayrıştırılabilir, değerlendirilebilir).
- Uygunluk otomatiktir (test çalışmaları, aritmetik değerlendirme).
- Nüfus küçüktür (~10-30 parçacık), dolayısıyla toplam LLM çağrıları yönetilebilir kalır.

Uygunluğun insan tarafından incelenmesi gerektiğinde iyi çalışmaz; yineleme başına maliyet fahiş hale gelir.

### Model Sürüleri

arXiv:2410.11163, PSO'yu çıktı katmanından *model* katmanına alır. Her "parçacık" bir uzman LLM'dir (parametreler). Sürü, gradientücretsiz bir güncelleme yoluyla parametreleri kolektif en iyiye doğru taşır. Bildirildi: Yineleme başına yalnızca 200 örnekle, 9 datasetsaniyede 12 taban çizgisi üzerinde ortalama %13,3 kazanç.

Buradaki temel fikir, LLM uzman modellerinin zaten paylaşılan bir parametre manifoldunda (adaptör ağırlıkları, LoRA deltaları) yakınlarda olmasıdır. Bu düşük boyutlu alt uzaydaki PSO ucuz ve etkilidir.

### ACO tazeleme (Dorigo 1992)

Karınca Kolonisi Optimizasyonu: karıncalar bir grafikte gezinir; her yolun bir feromon izi vardır. Karınca, feromon kuvvetine göre ağırlık taşıma olasılıklarını taşır. Görevi tamamlayan karıncalar, çözüm kalitesiyle orantılı olarak feromon salgılarlar. Feromon zamanla bozulur.

### AMRO-S — agent yönlendirme için ACO

arXiv:2603.12933 çoklu-agent yönlendirme için ACO'yu kullanır. Her görev türü bir "hedeftir"; her agent olası bir rotadır. Feromonlar iyi çıktılar üreten yolları güçlendirir. Anahtar katkılar:

- **Yorumlanabilir yönlendirme kanıtı.** Feromon gücü, insan tarafından okunabilen bir sinyaldir.
- **Kalite geçişli eşzamansız güncelleme.** Feromonlar yalnızca kalite kontrolleri geçtikten sonra güncellenir ve inference'yi öğrenmeden ayırır.
- Çokluagent yönlendirmede benchmark **4,7 kat hızlanma**.

Kalite kapısı önemlidir: Bu olmadan hızlı ama yanlış agentferomon biriktirir ve sistem kötü rotalara kilitlenir.

### Yüksek Lisans için PSO / ACO ne zaman kullanılmalı?

**PSO'yu şu durumlarda kullanın:**
- Arama alanı süreklidir veya sürekli parametrelerle (prompt embedding'ler, LoRA ağırlıkları, sayısal oluşturma parametreleri) eşlenir.
- Fitness ucuz ve otomatiktir.
- Nüfus az olabilir (10-30).

**ACO'yu şu durumlarda kullanın:**
- Bir yönlendirme veya yol seçme sorununuz var.
- Kararlar zamanla güçlenir (aynı görev türleri geri gelir).
- Yönlendirme kararları için yorumlanabilir kanıtlara ihtiyacınız var.

**Aşağıdaki durumlarda ikisini de kullanmayın:**
- Uygunluk, insan incelemesi gerektirir (yineleme başına çok pahalı).
- Arama uzayı, PSO'nun kapsamadığı şekilde ayrık ve kombinatoryaldir (bunun yerine genetik algoritmaları kullanın).
- Gerçek zamanlı kararlar sıkı bir gecikme süresi gerektirir (PSO/ACO, tek geçişli buluşsal yöntemlere göre daha yavaş birleşir).

### Neden biyo-ilham hâlâ kazanıyor?

Gradient-tabanlı yöntemler türevlenebilir sinyallere ihtiyaç duyar. LLM çıktıları ve yönlendirme kararları önemsiz bir şekilde farklılaştırılamaz. Sözdegradient yöntemler (güçlendirmeyle öğrenilen yönlendiriciler, DPO tarzı prompt ayarlayıcılar) işe yarar ancak pahalı eğitim gerektirir.

PSO ve ACO'nun yalnızca *değerlendirici* işlevine ihtiyacı vardır. Bir aday çıktısını veya bir yönlendirme kararını puanlayabiliyorsanız alan üzerinde optimizasyon yapabilirsiniz. Bu, uygulanabilirlik çıtasını çok daha düşük hale getirir.

### Pratik sınırlar

- **Popülasyon bütçesi.** N parçacık × T yineleme × değerlendirme başına maliyet. Yüksek Lisans için değerlendirmeler ~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20'dir. Buna göre plan yapın.
- **Keşif ve sömürü.** Feromon bozunma oranı ve PSO atalet dengesi; çok hızlı bozulma → çözümleri unutun; çok yavaş → erken yerel optimuma takılıp kaldı.
- **Felaket düzeyinde sürüklenme.** Fitness ortamı değişirse (yeni veri dağıtımı) her iki algoritma da yakınlaşabilir ve sonra farklılaşabilir. En iyi fitness stabilitesini izleyin.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `LMPSO` — Sayısal prompt parametre (sıcaklık, top_k ağırlıkları) üzerinden PSO. Her parçacığın "LLM nesli" kodlanmış bir uygunluk fonksiyonu olarak simüle edilir. Algoritmayı 30 yineleme boyunca çalıştırır ve g_best yakınsamasını gösterir.
- `AMRO_S` — ACO tarzı yönlendirme. 3 agents, 4 görev türü, feromon matrisi, 100 yönlendirilmiş görev. İz oluşumunu göstermek için zaman içindeki (task_type → agent seçenek) dağılımını yazdırır.
- Karşılaştırma: aynı görev akışında rastgele yönlendirme ve ACO yönlendirme. Kaliteyi ve gecikmeyi ölçer.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı:
- LMPSO: g_best uygunluğu 30 yinelemeden sonra rastgeleden optimuma yakın bir düzeye doğru iyileşir.
- AMRO-S: feromon tablosu görev türü başına sağda agent sabitlenir; ACO yönlendirmesi kalite açısından ~%30-40 oranında rastgele geçer ve gecikmeyi de azaltır (daha az yeniden deneme).

## Use It — Hazır Araçla Uygula

`outputs/skill-swarm-optimizer.md` , LLM / agent optimizasyon sorunları için PSO, ACO, genetik algoritmalar ve gradient tabanlı optimize ediciler arasında seçim yapılmasına yardımcı olur.

## Ship It — Kullanıma Sun

- **Küçük başlayın.** 10-20 parçacık, 20-50 tekrar. Yalnızca yakınsama eğrisi net kazanç gösteriyorsa ölçeği artırın.
- **Feromonları veya yineleme başına g_best'i günlüğe kaydedin.** Sürü optimize edicilerde iz olmadan hata ayıklamak zahmetlidir.
- **Kalite kapısı güncellemeleri.** Özellikle ACO yönlendirmesi için: hızlı ve yanlış agent'lar feromon biriktirmemelidir.
- **Dağıtım değişiminde bozulmayı sıfırlayın.** Değerlendirme dağılımınız değiştiğinde, eskimiş feromonlar eskimiş olur; bozunma oranını geçici olarak sıfırlayın veya iki katına çıkarın.
- **Yineleme başına maliyeti sınırlayın.** Yineleme başına maliyet ölçüsü yayınlayın. Tekrarlama başına 500$'a mal olan ve %0,5 kazanç sağlayan PSO gönderilemez.

## Egzersizler

1. `code/main.py`'yı çalıştırın. LMPSO yakınsamasını gözlemleyin. Popülasyon büyüklüğünü 5, 10, 20, 50 olarak değiştirin. Yakınsama süresi hangi boyutta doygunluğa ulaşır?
2. Bir "yıkıcı sürüklenme" deneyi uygulayın: 30. yinelemeden sonra uygunluk fonksiyonunu değiştirin. PSO ne kadar hızlı uyum sağlar? `p_best` 'yi sıfırlamanın faydası olur mu?
3. AMRO-S'ye bir kalite kapısı ekleyin: yalnızca değerlendirme puanı > 0,7 olan çalıştırmalarda feromon biriktirme. Bu, geçitsiz versiyona kıyasla yakınsamayı nasıl değiştirir?
4. LMPSO'yu (arXiv:2504.09247) okuyun. Kağıdın "prompt olarak hızını" sayısal hızınızla eşleyin. Simülasyonda neler kayboluyor ve neler korunuyor?
5. AMRO-S'yi (arXiv:2603.12933) okuyun. Eşzamansız feromon güncellemesiyle ayrıştırılmış "inference hızlı yolunu" uygulayın. Bu, sürekli yük altında sistem gecikmesini nasıl değiştirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| PSO | "Parçacık Sürü Optimizasyonu" | Kennedy-Eberhart 1995. Popülasyona dayalı gradientücretsiz optimize edici. |
| AKO | "Karınca Kolonisi Optimizasyonu" | Dorigo 1992. Feromon izleri aracılığıyla yol/rota optimizasyonu. |
| LMPSO | "LLM nesli ile PSO" | arXiv:2504.09247. Hız bir prompt'dır; LLM adaylar üretir. |
| Model Sürüleri | "Uzman ağırlıklarına ilişkin PSO" | arXiv:2410.11163. Gradient-model parametresi alt uzayında ücretsiz güncelleme. |
| AMRO-S | "agent yönlendirme için ACO" | arXiv:2603.12933. Görev türü × agent üzerinden feromon matrisi. |
| p_best / g_best | "Kişisel / küresel en iyi" | Parçacık başına ve sürü genelinde şu ana kadar bulunan en iyi çözümler. |
| Feromon | "Yönlendirme belleği" | Bir kenarda güç; zamanla bozulur; kaliteye ilişkin mevduatlar. |
| Kalite kontrollü güncelleme | "Yalnızca iyi koşulardan öğrenin" | Kalite kontrolüne bağlı olarak feromon depozitosu. |
| Yıkıcı sürüklenme | "Dağıtım değişimi" | Fitness ortamı değişiklikleri; eski p_best ve feromonlar bayat hale gelir. |

## Daha Fazla Okuma

- [Kennedy ve Eberhart — Parçacık Sürü Optimizasyonu](https://ieeexplore.ieee.org/document/488968) — 1995 PSO makalesi
- [Dorigo — Karınca Kolonisi Optimizasyonu](https://www.aco-metaheuristic.org/about.html) — 1992 ACO temelleri
- [LMPSO — Dil Modeli Parçacık Sürü Optimizasyonu](https://arxiv.org/abs/2504.09247) — Yapılandırılmış LLM çıktıları için PSO
- [Model Swarms — gradientücretsiz LLM uzman optimizasyonu](https://arxiv.org/abs/2410.11163) — model ağırlıklı alt uzayda PSO
- [AMRO-S — koloni karşıtı çoklu-agent yönlendirme](https://arxiv.org/abs/2603.12933) — kalite kapısıyla feromon güdümlü yönlendirme
