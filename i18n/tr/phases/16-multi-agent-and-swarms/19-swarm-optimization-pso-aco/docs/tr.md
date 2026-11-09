# LLM için Swarm Optimization (PSO, ACO)

> Bio-İnspire Optimizasyon, LLM'nin geri dönüşünü yapıyor. **LMPSO**(arXiv:2504.09247) her parçacığın hızının bir istek olduğu ve LLM'nin bir sonraki adayı oluşturduğu PSO kullanır; yapılandırılmış sıralama çıkışlarında (matematik ifadeler, programlar) iyi çalışır. **Model Swarms**(arXiv:2410.11163) her LLM uzmanını model ağırlığıyla bir çeşitlilik üzerinde bir PSO parçacığı olarak değerlendirir ve raporlar **13.3% average gain**Sadece 200 örnekle 9 veri kümesi üzerinde 12 temel çizgi. **SwarmPrompt**(ICAART 2025) hızlı optimizasyon için PSO + Grey Wolf hibridleştirir. **AMRO-S**(arXiv:2603.12933) çoklu ajan LLM yönlendirme için ACO-İnspire feromon uzmanları  **4.7x speedup**Bu ders, akıllıca parametre alanında PSO'yu ve ajan yönlendirme üzerinde ACO'yu uyguluyor, bu klasik algoritmaların LLM çağına neden ve ne zaman uymadığını ölçüyor.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Sorun

Görev değerlendirmesinde %62 puan alan bir istekiniz var. Onu geliştirmek istiyorsunuz. Saçma hareket, kötü ölçeklendiren gradientsiz manuel ayarlama. Güçlendirme öğrenimine ödül sinyalleri ve eğitime yeterli dağıtımlar gerekmektedir. İstekler aracılığıyla geri dönüş gerçekten mümkün değildir  istek ayrı bir dizilerdir, farklılaştırılabilir bir parametredir.

Klasik biyolojik ilhamlı optimizasyon  Sürekli arama alanları için PSO, ACO yol seçimi  tam olarak bu rejim için tasarlandı: gradientsiz, nüfus tabanlı, değerlendirme başına ucuz.

Aynı kalıplar, çoklu ajan sistemlerinde ajan * yönlendirme * için de geçerlidir. ACO tarzı feromon izini kaydeder. Hangi ajan hangi görev türünde en iyi çalıştı, yönlendirici izini kullanmasına izin verir ve feromonları bozarak rotaların yeniden keşfedilmesi mümkün olur.

## Anlam

### PSO yenilenmesi (Kennedy & Eberhart 1995)

Partikel Swarm Optimization: sürekli bir arama alanında parçacıkların nüfusu.`x_i`ve hız.`v_i`Her tekrar:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

Nerede ?`p_best`Partikelin kendi en iyisi.`g_best`Swarm'ın en iyisi.`w, c1, c2`İnerti + bilişsel + sosyal ağırlıklar,`r1, r2`- Bu rastgele faktörler.

### LLM çıkışları için PSO  LMPSO

ArXiv:2504.09247 LLM tarafından oluşturulan yapılandırılmış çıkışlar (matematika ifadeleri, programlar) için PSO'yu uyarlar. Her parçacık bir aday çıkıştır. Hızlılık, mevcut çıkışın kişisel / küresel en iyi yönüne nasıl değiştirildiğini açıklayan bir * prompt * dır. LLM, hızlı çıkıştan yeni çıkış oluşturur. Hızlılığın "inertisi" "küçük artışlı değişiklikler yap" gibi bir istisna.

Bu iyi çalışır:
- Çıktıran yapılandırılmış (parse edilebilir, değerlendirilebilir).
- Fitness otomatik (test çalışması, aritmetik değerlendirme).
- Nüfusu küçüktür (~ 10-30 parçacık), bu nedenle toplam LLM çağrıları yönetilebilir kalır.

Fitness'in insan tarafından incelemeye ihtiyacı olduğunda iyi çalışmaz.

### Model Swarms

ArXiv:2410.11163 PSO'yu çıkış katmanından *model* katmanına çıkarır. Her "partikel" bir uzman LLM (parametre) dir. Swarm, parametreleri gradientsiz bir güncelleme yoluyla toplu en iyi yönüne taşıyor.

Anahtar bir anlayış, LLM uzman modelleri zaten ortak bir parametre çeşitliliğinde (adapter ağırlıkları, LoRA deltas) yakınlarda bulunmaktadır.

### ACO yenilenmesi (Dorigo 1992)

Karınca Kolonisi Optimizasyon: Karıncalar bir grafik üzerinden geçer; her yolun feromon izleri vardır. Karıncalar olasılıkları feromon ağırlığı ile hareket eder. Görevyi tamamlayan karıncalar feromonları çözünürlük kalitesine orantılı olarak depolar. Feromonlar zamanla bozulur.

### AMRO-S  ACO ajan yönlendirme için

ArXiv:2603.12933 çoklu ajan yönlendirme için ACO kullanır. Her görev türü bir "yerleşme" dir; her ajan bir olası rota. Feromonlar iyi sonuçlar üreten yolları güçlendirir. Ana katkılar:

- **Interpretable routing evidence.**Feromon gücü insan tarafından okunur bir sinyaldir.
- **Quality-gated asynchronous update.**Feromonlar sadece kalite kontrollerinin geçmesinden sonra güncellenir ve sonuçları öğrenimden ayırır.
- **4.7x speedup**Çoklu ajan yönlendirme referans değerinde.

Kalite kapısı önemlidir: olmadan, hızlı ama yanlış ajanlar feromon biriktirir ve sistem kötü yollara kilitlenir.

### LLM için PSO / ACO ne zaman kullanılır

**Use PSO when:**
- Arama alanı sürekli veya sürekli parametrelere (sürekli yerleşimler, LoRA ağırlıkları, sayısal jenerasyon parametreleri) haritalar.
- Fitness ucuz ve otomatik.
- Nüfusu küçük olabilir (10-30).

**Use ACO when:**
- Yol seçimi veya yönlendirme sorunu var.
- Kararlar zamanla güçlenir (aynı görev türleri tekrarlanır).
- Yol kararları için yorumlanabilir kanıtlara ihtiyacın var.

**Do not use either when:**
- Fitness insan incelemesini gerektirir (her tekrar için çok pahalı).
- Arama alanı, PSO'nun kapsamadığı bir şekilde ayrı ve kombinatördür (genetik algoritmalar kullanın).
- Gerçek zamanlı kararlar sıkı gecikme süresi gerektirir (PSO/ACO tek geçiş heuristiklerine göre yavaşça birleşti).

### Neden biyo-İnspire hala kazanıyor

Gradyent tabanlı yöntemler farklılaşabilen sinyallere ihtiyaç duyar. LLM çıkışları ve yönlendirme kararları önemsiz olarak farklılaşamaz.

PSO ve ACO'nun sadece *evaluator* fonksiyonu gerekir. Eğer bir aday çıkışı veya yönlendirme kararı puanlayabilirseniz, boşluğu optimize edebilirsiniz. Bu da uygulanabilirlik çubuğunu çok daha düşük yapar.

### Pratik sınırlamalar

- **Population budget.**N parçacık × T tekrarlama × her değerden maliyet.$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20. Buna göre plan yapın.
- **Exploration vs exploitation.**Feromon bozulma oranı ve PSO inersiyası değişikliği; çok hızlı bozulma → çözümleri unutmak; çok yavaş → erken yerel optimuma sıkıştı.
- **Catastrophic drift.**Her iki algoritma da fitness manzarası değişirse bir araya gelebilir ve sonra farklılaşabilir (yeni veri dağıtım).

```figure
swarm-stigmergy
```

## Yapın

`code/main.py`Uygulamaları:

- `LMPSO` PSO sayısal önlem parametreleri ( sıcaklık, top_k ağırlıklar) üzerinde. Her parçacığın "LLM nesli" bir scriptli fitness fonksiyonu olarak simüle edilir. Algoritmi 30 iterasyon için çalıştırır ve g_best konverjensi gösterir.
- `AMRO_S` ACO tarzı yönlendirme. 3 ajan, 4 görev türü, feromon matrisi, 100 yönlendirilmiş görev.
- Benzer bir görev akışında rastgele yönlendirme ile ACO yönlendirme karşılaştırması. Kaliteli ve gecikmeyi ölçer.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen üretim:
- LMPSO: g_best fitness 30 tekrar üzerinde rastgeleden neredeyse optimal'e kadar iyileşir.
- AMRO-S: feromon tablosu görev türüne göre doğru ajan üzerinde istikrar kazanır; ACO yönlendirme kalitede rastgele %30-40'a kadar çarpır ve aynı zamanda gecikmeyi (sadece tekrar deneme) azaltır.

## Kullan

`outputs/skill-swarm-optimizer.md`LLM / ajan optimizasyonu sorunları için PSO, ACO, genetik algoritmalar ve gradient tabanlı optimizörler arasında seçim yapma konusunda yardımcı olur.

## Gönder

- **Start small.**10-20 parçacık, 20-50 iterasyon.
- **Log pheromones or g_best per iteration.**İzlemeden sürü optimizörlerini düzeltmek acı verici.
- **Quality-gate updates.**Özellikle ACO yönlendirme için: hızlı ve yanlış ajanlar feromon biriktirmemelidir.
- **Reset decay on distribution shift.**Evalü dağılımınız değişirken, yaşlı feromonlar eskisine kalmaz; bozulma oranını geçici olarak yeniden ayarlayın veya ikiye katlayın.
- **Cap the per-iteration cost.**İterasyon başına 500 dolarlık ve % 0,5 kazançlı bir PSO gönderilmez.

## Egzersizler

1. Çık .`code/main.py`LMPSO'nun yakınlaşmasını gözlemleyin. 5, 10, 20, 50 farklı nüfus boyutu.
2. "Kazadılı sürüş" deneyini uygulayın: 30'dan sonra fitness fonksiyonunu değiştirin. PSO ne kadar hızlı uyar?`p_best`Yardım mı?
3. AMRO-S'e bir kalite kapısı ekleyin: Feromon depozitosu sadece eval puanı > 0.7 olan çalışmalar için. Bu, kapalı olmayan sürümle karşılaştırıldığında nasıl dönüşüm değişir?
4. LMPSO'yu okuyun (arXiv:2504.09247). Kağıtın "hızlılığı bir istek olarak" sayısız hızınıza geri gönderin.
5. AMRO-S'i okuyun (arXiv:2603.12933). Asinkron feromon güncelleme ile koparılmamış "inference fast-path" uygulamasını uygulayın. Bu, sürekli yük altında sistem gecikmesini nasıl değiştirir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Daha Fazla Okumak

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) 1995 PSO kağıdı
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html)1992 ACO Vakfları
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) Struktürlü LLM çıkışları için PSO
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) Model ağırlığı alt alanındaki PSO
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) Kalite kapısı ile feromon yönlendirme
