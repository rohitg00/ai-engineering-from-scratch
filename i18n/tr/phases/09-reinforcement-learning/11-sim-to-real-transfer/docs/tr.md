# Sim-Real Transfer

> Hardware'da başarısız olan bir simülatörde eğitilen bir politika, simülatörü ezberleyen bir politikadır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## Sorun

Gerçek bir robot eğitimi yavaş, tehlikeli ve pahalıdır. Bir iki ayaklı yürümeyi öğrenmek için milyonlarca eğitim bölümünü alır; gerçek bir iki ayaklı donanımı parçaladığında bile düşen gerçek bir robot. Simülasyon size sınırsız yeniden ayarlamalar, belirleyici yeniden üretilebilirlik, paralel ortamlar ve fiziksel hasar olmaması sağlar.

Simülatörler yanlış. Doldurmalar MuJoCo modellerinden daha fazla sürtünme sahiptir. Kameralar lens çarpıtmasına sahiptir. Simülatör içermez. Motorlar gecikmeler, tepki ve doymuşluklara sahiptir. Sim modellerinin% 99'u atlıyor. Rüzgar, toz ve değişken aydınlatma steril renderiye eğitilmiş bir politika sabote eder.**reality gap**Sim dağıtım ve gerçek dağıtım arasındaki sistematik fark robotlar için yerleştirilen RL'nin merkezi sorunu.

* Sim-real dağıtım değişikliğine dayanıklı bir politika ihtiyacınız var. Üç tarihsel yaklaşım: simülatörü rastgeleleştirmek (domain rastgeleleştirilmesi), politikayı biraz gerçek veriyle uyarlamak (domain uyarlanması / ince ayarlama), veya gerçek sistemin parametrelerini tanımlamak ve onlarla eşleştirmek (sistem tanımlaması). 2026'da baskın reçete, üçü de büyük paralel simülasyonla birleştirir (Isaac Sim, Isaac Lab, Mujoco MJX GPU'da).

## Anlaşım

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**Tobin et al. 2017, Peng et al. 2018'de. Eğitim sırasında gerçek robot üzerinde farklı olabilecek her sim parametresini rastgele yapın: kütleler, sürtünme katılıkları, motor PD kazançları, sensör gürültüsü, kamera pozisyonu, aydınlatma, dokular, temas modelleri. Politika "bugün hangi simde" bir koşullu dağılım öğrenir ve tüm alan boyunca genelleştirir. Eğer gerçek robot eğitim zarfına girerse, politika işe yarar.

- **Upside:**Gerçek verilere gerek yok.
- **Downside:**Çok rastgele eğitim "üneyet" ama çok dikkatli bir politika üretir.

**System Identification (SI).**Simülatörün parametrelerini eğitimden önce gerçek dünya verilerine ayarlayın. Eğer gerçek robotta kol-kol sürtüşmesini ölçebilirseniz, onu simleme bağlayın. Sonra bu değerleri bekleyen bir politika eğitiniz. Gerçek sisteme erişime ihtiyaç duyar ama gerçeklik boşluğunu doğrudan azaltır.

- **Upside:**- Tam, düşük gürültülü eğitim hedefi.
- **Downside:**modelin kalan hatası politikaya görünmez; küçük belirlenmeyen etkileri (örneğin motor ölü bandı) hala dağıtımını bozar.

**Domain Adaptation.**Sim yaparak, az miktarda gerçek veriyle ince ayarlama yaparak.

- **Real2Sim2Real:**Geri kalan simülatörü öğrenin .$f(s, a, z) - f_{\text{sim}}(s, a)$Gerçek devreye girişimleri kullanarak, düzeltilmiş simletimde çalıştırmak.
- **Observation adaptation:**Öğrenilmiş bir özellik çıkarıcı (örneğin, GAN pikselden piksel) aracılığıyla gerçek obs → sim benzeri obs haritasını yapan bir politika eğitmek.

**Privileged learning / teacher-student.**Miki et al. 2022 (Yeni dörtlü). * öğretmen *'yi simülasyonda eğit, böylece özel bilgilere erişebilir (yerin gerçeği sürtünmesi, arazi yüksekliği, IMU sürüklenmesi). * Öğrenci *'yi sadece gerçek sensör gözlemlerini gören bir *isteden ayırın. Öğrenci, fiziksel parametreler arasında sağlam olan özel özellikleri tarihten çıkarmayı öğrenir.

**Massively parallel simulation.**20242026. Isaac Lab, Mujoco MJX, Brax hepsi binlerce paralel robotları tek bir GPU'da çalıştırabilir. 4.096 paralel humanoid olan PPO, saatler içinde yıllarca deneyim toplar. Eğitim dağıtımının genişleştiği gibi "gerçeklik boşluğu" azalır; DR, bu 4.096 envs'lerin her birinin farklı rastgele parametreleri olduğunda neredeyse serbest hale gelir.

**The real-world 2026 recipe (quadruped walking example):**

1. Domen rastgele çekim, sürtünme, motor kazançları, yararlı yük ile büyük bir paralel sim.
2. Öğretmen politikaları ayrıcalıklı bilgilerle eğitilmiştir (yer haritası, vücut hızı, yer gerçeği).
3. Öğrenci politikası sadece proprioception (ayak eklem kodlayıcıları) kullanarak öğretmenden destillenmiştir.
4. Gerçek IMU'da otomatik kodlayıcı ile gözlem uyarlaması.
5. 10+ ortamda sıfır çekim yapın. Başarısız olursa, güvenlik kısıtlılığı olan PPO ile gerçek dünyadaki dakikalar boyunca ince ayarlama yapın.

```figure
f3-reality-gap
```

## Yapın

Bu dersin kodu * gürültülü * geçişlerle bir GridWorld'de domen rastlantısının küçük bir göstergesidir. "sim"de rastgele kayma olasılıklarını deneyimleyen ve eğitim sırasında hiç görmediği kayma seviyesine sahip "gerçek" değerlendiren bir politika eğitiriyoruz. Şekil doğrudan MuJoCo'ya donanımlı aktarım için haritasını yapar.

### Adım 1: parametre sim

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`Gerçek robotlarda, sürtünme, kütle, motor kazancı sim ve gerçek arasında değişen herhangi bir şey olabilir.

### Adım 2: DR ile tren

Her bölümün başında, örnek`slip ~ Uniform[0.0, 0.4]`PPO / Q öğrenme / her şeyi eğit.

### Adım 3: "gerçek" kartlarda sıfır atış değerlendirin

Değerlendirin `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`İlk dört öğrenci eğitim desteği alanında bulunmaktadır.`0.5`ve `0.7`DR eğitimli bir politika, iç destekte neredeyse optimal kalmalı ve dışarıda zarif bir şekilde azalmalıdır.

### 4. adım: dar eğitimle karşılaştırın

İkinci bir politika oluşturmak için `slip = 0.0`Aynı şekilde değerlendirilir.`slip`Gerçek sıfırdan sonra felaket düşüşü görmelisiniz.

## Tuzaklar

- **Too much randomization.**Trene devam ediyor .`slip ∈ [0, 0.9]`* Beklenen* gerçek dünya dağılımına uygun, "Her şey olabilir" değil.
- **Too little randomization.**Uygulama, ince bir parça üzerinde çalıştırılır ve politika genelleşemez.
- **Misidentified parameter space.**Yanlış şeyi rastgeleleştir (gerçek boşluk motor gecikmesi olduğunda kamera rengi) ve DR yardımcı olmaz.
- **Privileged info leakage.**Sadece gözlemler değil, küresel durumu eylemler için kullanan bir öğretmen, takip edemeyecek bir öğrenci üretebilir. Öğretmenin politikasının gözlem tarihini verilen öğrenci tarafından gerçekleştirilebilir olmasını sağlayın.
- **Sim-to-sim transfer failure.**Eğer politikası daha zor bir sim varianti için sağlam değilse, gerçek dünyaya de sağlam olmayacaktır.
- **No real-world safety envelope.**Düşük düzeyde güvenlik kalkanı olmadan simde çalışan ve "gerçekte çalışan" bir politika hala donanımları kırabilir.

## Kullan

2026 sim-real yığın:

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

Tüm ölçeklerde kontrol için iş akışı tutarlıdır: simgeyi mümkün olduğunca uyumlu hale getirin, uyumlu olamadığınız şeyleri rastgele yapın, devasa politikalar uygulayın, destil edin, bir güvenlik kalkanıyla dağıtın.

## Gönder

- Kaydet .`outputs/skill-sim2real-planner.md`- ...

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## Egzersizler

1. **Easy.**Bir Q-öğrenme ajanını sabit kaydırma GridWorld'da eğit (slip=0.0).$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$- Plan geri dönüşü vs. kayış.
2. **Medium.**DR Q öğrenme ajanı örneklemesini eğit `slip ~ Uniform[0, 0.3]`DR'nin dağıtım dışı fiyatı 0,5'dir.
3. **Hard.**Bir eğitim programı uygulayın: slip=0.0 ile başlayın, politikaların %90'a ulaştığında DR aralığını genişletin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## Daha Fazla Okumak

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) orijinal DR kağıdı (robotlar için vizyon).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) D.R. dinamik, dörtlü hareket.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl, ölçekte ADR.
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) ANYmal için öğretmen-öğrenci.
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) 2025  2026 dağıtımlarını yönlendiren büyük paralel sim.
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) ADR eğitim programı yöntemi.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) modern sim-real boru hattlarının temelini oluşturan Dyna çerçevesini (planlama + dağıtım için bir model kullanın).
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) Benchmark sonuçları ile sim-to-real yöntemlerin taksonomisi.
