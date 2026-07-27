# Boru Hattı Paralel ve Kabarcık Analizi

> Tensör paralelliği matris çarpımını sıralar arasında böler. Boru hattı paralelliği, modeli her sıra için bir aşama olacak şekilde sıralara böler. Mikropartiler boru hattından akar. Başlangıçtaki ve bitişteki boş zaman balondur; bunu en aza indirmek tüm zanaattır.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 19 Bölüm C dersleri 42-49
**Süre:** ~90 dk

## Öğrenme Hedefleri

- Sıralı bir modeli N aşamaya bölün ve N aşama boyunca ileri bir boru hattını simüle edin.
- GPipe programını (yalnızca ileri dolum, sonra geri) kullanarak boru hattı boyunca M mikro partileri planlayın ve kabarcık fraksiyonunu hesaplayın.
- Balonu Megatron-LM ve PipeDream'de kullanılan aralıklı 1F1B planıyla karşılaştırın.
- Aşama atamasını savunun: Aşama başına eşit hesaplama, aşama başına eşit parametre sayısından daha önemlidir.

## Sorun

Fp16'daki 70B parametreli bir model yalnızca 140 GB parametreye ihtiyaç duyar. Hiçbir tüketici GPU'su bunu tutamaz. ZeRO-3, parametreleri aşamalar arasında parçalar, ancak yine de her ileri adım için tüm katmanı toplamak için her aşamaya ihtiyaç duyar ve katman başına log(N) atlama öder. Boru hattı paraleli farklı bir yol izler: modeli N aşamaya bölün ve her sıraya bir aşama yerleştirin. Katman 1'in ilerisi 0. sırada tamamlanır ve aktivasyon tensörünü 1. sıraya verir; sıralama 1, katman 2'yi çalıştırır ve sıralama 2'ye geçer; ve benzeri. Geriye doğru ters yönde akar. Bellek doğrusal olarak azalır çünkü her rütbe yalnızca bir aşamayı içerir; hesaplama sıralıdır, bu da kabarcık sorunudur.

Kabarcık, boru hattının başlangıcında (ilk mikro partinin son aşamaya ulaşmasının beklenmesi) ve sonunda (son mikro partinin geri akmasının beklenmesi) boşta geçen süredir. M mikro parti ve N aşamada, aşama başına kabarcık oranı (N-1)/(M+N-1)'dir. M=8'de N=4, yani %27. M=64, N=4'te %4,5'tir. Adım başına çok sayıda mikro seriniz olduğunda balon küçülür; bu, mikro parti başına küçük parti boyutları anlamına gelir; bu da mikro parti tasarımını yönlendiren kısıtlamadır.

## Konsept

```mermaid
flowchart LR
  R0[rank 0: stage 0 / layer 0] --> R1[rank 1: stage 1 / layer 1]
  R1 --> R2[rank 2: stage 2 / layer 2]
  R2 --> R3[rank 3: stage 3 / loss]
  R3 -.backward.-> R2
  R2 -.backward.-> R1
  R1 -.backward.-> R0
```

### GPipe programı

Geriye doğru başlamadan önce boru hattını tüm M mikro partilerle ileriye doğru doldurun; daha sonra ters yönde geriye doğru boşaltın. Her mikro serideki aktivasyonlar geriye gidene kadar tutulmalıdır, böylece bellek M ile doğrusal olarak büyür. İleriye doğru M+N-1 döngüsü alır, geriye doğru ise başka bir M+N-1 döngüsü alır. Aşama başına faydalı çalışma 2 milyon döngüdür; aşama başına kabarcık 2(N-1) döngüdür. Her ileri ve geri bir birim zaman aldığında kabarcık oranı (N-1)/(M+N-1) olur. M'nin N'den çok daha büyük seçilmesi balonu gizler.

### 1F1B programı

Interleave: Bir mikro partinin ilerisi son aşamaya ulaşır ulaşmaz, geri akışını başlatın ve geri akışına izin verin. Program, aşama başına bir ileri ve bir geri dönüşümlüdür. Kabarcık hala N-1'dir ancak aktivasyon belleği mikro parti sayısıyla değil boru hattı derinliğiyle sınırlıdır. Üretim hatları 1F1B (Megatron, PipeDream) kullanır. Ders, daha basit olduğu için öncelikle GPipe'ı ve alıştırma olarak 1F1B'yi uyguluyor.

### Aşama başına eşit bilgi işlem neden önemlidir?

Aşama 0 50 ms sürerse ve aşama 1 100 ms sürerse, her döngü aşama 1'e bağlanır. Diğer aşamalar, aşama 1'in serbest bırakılmasını beklerken döngü başına 50 ms boşta kalır. Eşit parametre sayımı yanlış eksendir: bir transformer'nin hesaplamasına dikkat artı katman başına MLP hakimdir ve embedding katmanlarında çok sayıda parametre vardır ancak çok az hesaplama vardır. Aşama ataması, aşama başına ağırlıkları değil, aşama başına FLOP'ları eşitlemelidir.

### Mikro parti ve toplu iş

Bir boru hattı, her biri B boyutunda M mikro seriyi çalıştırır. Etkin parti boyutu M*B'dir. Bir ardışık düzen adımının sonundaki gradient, birleştirilmiş M*B örneklerinde gradient'dir. Kabarcık fraksiyonu M'ye bağlıdır; optimizer M*B'yi görür. M'nin ayarlanması, mikro parti başına belleğe (GPipe için yüksek M ile daha yüksek aktivasyon belleği) karşı işlem balonu (yüksek M ile daha düşük) anlamına gelir.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `PipelineStage`: bir aşamanın parametrelerini tutan ve `forward(activation)`'yi ortaya çıkaran küçük bir `nn.Module` .
- `Pipeline(stages, num_microbatches)`: GPipe programını, sahne başına simüle edilmiş duvar saatini kullanarak simüle edilmiş sahnelerde düzenler.
- `bubble_fraction(num_stages, num_microbatches)`: kapalı form (N-1)/(M+N-1).
- Mikro parti başına izi ve ölçülen kabarcık fraksiyonunu yazdıran 4 aşamalı bir demo.

Çalıştır:

```bash
python3 code/main.py
```

Çıktı: adım adım bir Gantt grafiği ve kapalı form tahminine karşı kabarcık yüzdesi.

## Vahşi doğada üretim modelleri

Üç model, boru hattını nakliyeye yetecek kadar paralel olarak sertleştirir.

**Etkinleştirme kontrol noktası çiftleri ardışık düzen ile.** GPipe üzerinde M mikro toplu hareket halindeyken, etkinleştirme belleği M çarpı bir mikro topludur. Etkinleştirme kontrol noktası oluşturma, geri zamanda ileriyi yeniden hesaplar, hesaplamayı bellekle değiştirir; bu kombinasyon boru hattını uzun diziler için izlenebilir kılan şeydir.

**Sahne dengesi ölçülür, varsayılmaz.** Üretim ekipleri, hedef donanımdaki gerçek katman başına hesaplamayı (FLOP'lar ve duvar saati) ölçen bir profil oluşturma geçişi çalıştırır ve ardından bu ölçüme göre bölümlendirir. Megatron-LM `--num-layers-per-stage` bayrağı, aşamaların katman başına maliyeti farklı olduğunda eşit olmayan katman sayılarına izin veren bir listeyi kabul eder.

**Gönderme-alma planı kilitlenmeyi önlemelidir.** Almadan önce göndermenin her aşamasının kabloda kilitlenmelere sahip olduğu bir işlem hattı. Standart düzeltme, serpiştirmektir: çift sıralı aşamalar önce gönderilir, sonra alınır, tek sıralı aşamalar önce alınır ve sonra gönderilir. Ders programları açıkça sıralanır, böylece model görünür olur.

## Use It — Hazır Araçla Uygula

Üretim modelleri:

- **Megatron-LM.** Belirli ölçekte paralel boru hattı referansı. 1F1B'yi kullanır ve tensör + boru hattı + veri paralel birleşimini destekler.
- **DeepSpeed ​​Pipeline.** Zero ile entegre olur; ZeRO-1 + boru hattı, en büyük açık modeller için ortak bir kombinasyondur.
- **PyTorch Pipe.** `torch.distributed.pipeline.sync.Pipe` üzerine kurulu, PyTorch'a özgü ardışık düzen sarmalayıcı.

## Ship It — Kullanıma Sun

Ders 80, aşama başına parametre parçalarını parçalı kontrol noktasında saklar. Ders 81, uçtan uca demoda DDP + Sıfır + boru hattını oluşturur (ruh olarak; demo, boru hattını çalışma zamanı için simüle edilmiş halde tutar).

## Egzersizler

1. 1F1B'yi uygulayın ve kabarcık fraksiyonunun GPipe ile eşleştiğini ancak etkinleştirme belleğinin sınırlı olduğunu doğrulayın.
2. Daha derin bir modelde aşama başına gerçek zamanın profilini çıkarın ve aşamaları ölçülen duvar saati ile yeniden dengeleyin.
3. İşlem hattı mikro partileri arasında gradient birikimini ekleyin ve gradient'nin eşdeğer tam toplu ilerinin gradient değerine eşit olduğunu kontrol edin.
4. İşlem hattını etkinleştirme kontrol noktasıyla eşleştirin ve bellek düşüşünü işlem maliyetine göre ölçün.
5. İşlem hattını DDP ile birleştirin (her işlem hattı sıralaması bir veri paralel grubunda çoğaltılır) ve 2B zamanlama aracılığıyla mantık yürütün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Boru hattı | "Derinlik boyunca paralel model" | Derece başına bir aşama, aktivasyonlar aşamadan aşamaya doğru akar |
| Kabarcık | "Boru hattı boşta kalma süresi" | (N-1) bazı aşamalarda işin olmadığı başlangıç ​​+ bitiş adımları |
| Mikro parti | "Gruptan kesit" | Bir ileri/geri birimi; balon M büyüdükçe küçülür |
| GPipe | "Doldurun ve boşaltın" | Herhangi bir geriden önce tüm M ileri; yüksek aktivasyon hafızası |
| 1F1B | "Aralıklı program" | Aşama başına bir ileri bir geri; sınırlı etkinleştirme belleği |

## Daha Fazla Okuma

- [Huang ve diğerleri, GPipe: Dev Neural Network'ların Verimli Eğitimi](https://arxiv.org/abs/1811.06965)
- [Narayanan ve diğerleri, PipeDream: DNN Eğitimi için Genelleştirilmiş Boru Hattı Paralelliği](https://arxiv.org/abs/1806.03377)
- [Megatron-LM boru hattı paralel belgeleri](https://github.com/NVIDIA/Megatron-LM)
- Aşama 19 Ders 76 - programın kullandığı gönderme/alma temelleri
- Aşama 19 Ders 78 - Sıfır, boru hattına diktir ve sıklıkla birleştirilir
