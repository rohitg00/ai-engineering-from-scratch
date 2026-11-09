# Çift Pipe Paralellizmi

> DeepSeek-V3 2.048 H800 GPU'da eğitim almıştır. Tüm düğümler arası uzman, her hesaplama saatine 1 GPU-saat iletişim maliyeti. GPU'lar yarı zaman boştu. DualPipe (DeepSeek, Aralık 2024) ileri ve geri hesaplamaları tetikleyen tüm iletişimlerle üst-üstün dönen iki yönlü bir boru hattıdır. Bubbles düşüşü, üretim artışı ve iki model-parametr kopya (adını veren "ikili") tutmak, Expert Paralelism zaten uzmanları her şekilde sıralar arasında yaydığında ucuz. Bu ders, DualPipe'nin aslında ne yaptığını ve neden Sea AI Lab'in DualPipeV geliştirmesi, 2 kat daha sıkı bir balon masrafı karşılığında parametrelerin maliyetini düşürdüğünü öğrenme türü bir örnek.

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator), Rust
**Prerequisites:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- DualPipe'nin ileriye geriye doğru parçalarının dört bileşenini ve neden her birinin kendi üst üstelik penceresi olduğunu söyleyin.
- Bomba sorunu ölçeğinde ve "bombasız" ne anlama geldiğini pratikte pazarlama ile karşılaştırın.
- 8 PP sıra ve 16 mikro seri için bir DualPipe programını el ile takip edin ve ileri ve geri akışların birbirinin boş boşluklarını doldurduğunu onaylayın.
- DualPipeV'nin (Sea AI Lab, 2025) yaptığı pazarlama durumu belirtin: Expert Parallelism aktif olmadığı zaman biraz daha büyük bir balon masrafıyla 2x parametresi çoğaltmasını düşürür.

## Sorun

671B MoE modelini 2k H800 GPU'lar üzerinde eğitmek üç komplo boğazına rastlar:

1. **Memory pressure.**Her GPU'da modelin bir parçası vardır. 128 başlıkta 61 katman boyunca 8k dizide etkinleştirme belleği çok büyüktür.
2. **Pipeline bubbles.**Geleneksel boru hattı paralelliği (GPipe, 1F1B) GPU'ları aşama girişini veya gradiyentiyi beklerken hareketsiz bırakır. 8 aşamada, 1F1B programlamasıyla bile GPU zamanının yaklaşık% 12'si kabarcık olabilir.
3. **Cross-node all-to-all.**MoE uzman paralellik uzmanları düğümler arasında yayır. Her ileri geçiş, uzmanlarına jeton göndermek için bir tümü tetikler ve bir diğerini birleştirir. 2k GPU'larda bu kolayca 1:1 hesaplama-kommun oranına dönüşür.

Bunların her birinin ayrı çözümleri vardır: hafıza için gradient kontrol noktası, tüpüklü baloncuklar için sıfır kabarcık (Sea AI Lab, 2023) ve her şey için uzman paralel iletişim çekirdeği. DualPipe'in yaptığı, onları birlikte oynatmak. Zamanlama, hesaplama ve iletişim ile bir ön-geri parça içindeki bir üstlenme yapar, borunun her iki ucundan aynı anda mikro-batchler enjekte eder ve elde edilen zamanlama ile hesaplama pencerelerinin içinde her şeyi gizler.

Raporlanan sonuç: Pipeline balonlarının neredeyse ortadan kaldırılması, DeepSeek-V3'in 14.8T-token eğitim sürümünde% 95'ten fazla GPU kullanımı.

## Anlaşım

### Kök hattı paralelliği yenilenmesi

Bir N katman modeli P cihazlarına bölün.`i`katmanları tutar `i * N/P .. (i+1) * N/P - 1`. Bir mikro-batch, cihazlar 0 ile P-1 arasında ileriye, sonra P-1 ile 0 arasında geriye akıyor. Her cihaz sadece önceki cihaz çıkışını gönderdiğinde ileri aşamasını başlatabilir ve sadece aşağıdaki cihaz yukarıdaki gradiyenti gönderdiğinde geriye başlayabilir.

GPipe (Huang et al., 2019) bir seferde bir mikro-batch programlar, bu da çoğu GPU zamanını harcıyor. 1F1B (Narayanan et al., 2021) bir çok mikro parti için ileri ve geri geçişleri birbirine bağlar. Zero Bubble (Qi et al., 2023) geriye geçişini iki bölüme ayırır  geriye girme için giriş (B) ve geriye girme için ağırlıklar (W)  ve onları balonunu doldurmak için programlar. Zero Bubble'den sonra boru hattı neredeyse sıkı.

DualPipe bir sonraki adım.

### Fikir 1: parça parçalanması

Ön tarafta her parça dört parçaya ayrılmıştır:

- **Attention.**Q/K/V projeleri, dikkat, çıkış projeleri.
- **All-to-all dispatch.**Uzmanlarımıza sinyal gönderen düğümler arası iletişim.
- **MLP.**- MoE uzmanı hesaplama.
- **All-to-all combine.**Uzaylı çıkışları getiren çapraz iletişim.

Bir geriye doğru parça, bunların her birinin gradient sürümlerini ekler. DualPipe bunları programlar ki tüm tüm gönderim sonraki parça dikkat hesaplama ile paralel olarak gerçekleşir ve tüm tüm kombinasyon sonraki parça MLP hesaplama ile paralel olarak gerçekleşir.

### Fikir 2: İki yönlü programlama

Çoğu boru hattı programı, mikro-batchları 0 aşamasından enjekte eder ve P-1 aşamasına doğru akıyor. DualPipe, mikro-batchları İKİ uçtan enjekte eder. 0 aşamasında oradan gelen ileri mikro-batchlar görülür; P-1 aşamasında oradan gelen ileri mikro-batchlar da görülür.

Bu iş için, cihaz `i`Her iki katman da erken boru katmanını tutmalıdır.`i`Ve son boru katmanı.`P - 1 - i`Bu, DualPipe'nin "ikili" kısmıdır: her cihaz, hizmet etmek için ihtiyaç duyduğu model katmanlarının iki kopyasını (her yön için bir tane) tutar. DeepSeek-V3'ün ölçeğinde, bu 2x parametreler kopyalama maliyetidir.

Önemli olan, bir yönde ileri akım ve diğer yönde geri akım, balonların tek yönlü bir programda olduğu yerde örtüşür.

### Elden izlenen bir program

P = 4 sıra, 8 mikro-batch, 4 ileri / 4 geri bölünmüş düşünün. Zaman soldan sağa hareket eder; sıralar cihaz sıralarıdır.

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

"F4/F5R" notasyonunu okuyarak: 1 sıra aynı zaman aralığında mikro-batch 4'ün (kifeden sağdan sola doğru) ve mikro-batch 5'ün (sağdan sola doğru) önüne doğru ilerliyor.

2. sırada çapraz akımlar daha erken örtüşür, 0 ve P-1 sırada en son örtüşürler. Programın sabit orta aşamasında, her sırada X yönünün ileriye doğru Y yönünün geriye doğru örtüşür. Hesaplama meşgul. Önüme geçiş için tüm tüm gönderiler geriye doğru hesaplama içindedir. Tüm tümün içindeki kombinasyonlar ileri hesaplama içindedir. baloncuklar sıkıştırılır.

### Bubble muhasebe

Standart 1F1B boru hattı baloncuğu (sınıf başına zaman kaybı):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

DualPipe, stabil fazada, mikro-batch sayısının boru hattının derinliğinden 2 katı bölünürse sıfır bir balonluğa sahiptir.

Pazarlama terimlerinde: "bubble-free". Teknik terimlerde: mikro-batch sayısıyla kabarcıklar büyümüyor. Sea AI Lab'ın takip analizi (DualPipeV / Cut-in-half) tam sıfır kabarcıkı ancak Expert Parallelism botluğunun olmadığı zaman gösterir. EP yönlendirilmiş her şey için her şey, bazı programlama uzlaşması her zaman mevcuttur.

### DualPipeV  rafine

Sea AI Lab (2025) EP iletişim örtüşmesi konunun olmadığı zaman 2x parametresi çoğaltmasının boş olduğunu gözlemledi. DualPipeV programı iki yönlü enjeksiyonu tek bir parametre kopyasında çalışan "V şekli" bir programına katlar. Bubble DualPipe'den biraz daha büyük ama hafıza tasarrufu önemli. DeepSeek, açık kaynaklı DualPipe uygulamasında EP-off modu olarak DualPipeV'yi benimsemiştir.

- Çözüm:

| Feature | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| Param copies per device | 2 | 1 | 1 | 1 |
| Bubble vs micro-batches | constant | small growth | grows | grows |
| Compute-comm overlap | full | partial | minimal | partial |
| Use when | EP-heavy MoE | dense or EP-light | baseline | any pipeline |

### 14.8T-token çalışması için ne anlama geliyor?

DeepSeek-V3'ün öncesi eğitiminde yaklaşık 2.8M GPU saatinde 2.048 H800 GPU'da 14.8T token tüketildi. Naif 1F1B'de, bunun %12-15'ini tüp havuzuna kaybederlerdi. 340-420K GPU saatleri, 70B modelini eğitmek için yeterli. DualPipe, bunların çoğunu kurtarmış. İç kayıtlar olmadan doğrudan katkıyı ölçmek zordur, ancak makalede yapılan iddia eğitim boyunca ortalama %95'den fazla GPU kullanımıdır.

Daha küçük çalışmalar için (1k GPU'lardan daha az), DualPipe aşırı ölçekli  boru hattı kabarcıkları toplam maliyetlere göre daha küçüktür ve yoğun model eğitiminin nadiren tüm düğüm boğazına çarptığı görülür.

### - Yürüyüşte oturduğu yerde .

- Ek olarak **FSDP**FSDP, model parametrelerini sıralar arasında kısaltır; DualPipe hesaplamaları sıralar arasında programlar.
-  ile uyumlu**ZeRO-3**İki kopyalı kopyaların hesapları ZeRO'nun parçalanmış gradientleriyle işbirliği yapmalıdır.
- Gerekli **custom all-to-all kernels**DeepSeek'in açık kaynak çekirdekleri referans uygulanmasıdır.

```figure
expert-capacity
```

## Kullan

`code/main.py`Bu bir boru hattı programı simülatörü.`(P, n_micro_batches, schedule)`ve 1F1B, Zero Bubble, DualPipe ve DualPipeV'nin her biri için sabit faz kullanımı basıyor.

Simülatörün değeri: farklı P ve mikro-batch sayılarla çalıştırın ve 1F1B için kabarcık fraksiyonunun nasıl büyüdüğünü izleyin ama DualPipe için değil.

Gerçek bir eğitim süreci için entegrasyon düşünceleri:

- Mikro-batch sayınıza net şekilde bölünen bir boru hattı paralel derinliği seçin.
- Uzman paralel ağınızın iki yönlü tümüyle desteklendiğinden emin olun.
- İlk kez bir hafta boyunca programı düzeltmeyi bekle.
- DualPipe'in avantajı, geri kalanları sıkıştırmaktan gelir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-dualpipe-planner.md`. Eğitim klüsterinin özelliklerini (GPU sayımı, topoloji, bağlantı, model şekli) göz önüne alarak, bir boru hatt paralelliği stratejisi, kullanılacak programlama algoritması ve hedef ölçekte beklenen kabarcık bölümü önerir.

## Egzersizler

1. Çık .`code/main.py`- Evet .`(P=8, micro_batches=16, schedule=dualpipe)`ve `(P=8, micro_batches=16, schedule=1f1b)`GPU kullanım farkını hesaplayın ve bunu milyon bir eğitim tokeni başına geri alınmış GPU saatleri olarak ifade edin.

2.  için program tablosunu çiz`(P=4, micro_batches=8, schedule=dualpipe)`Her zaman aralığını mikro parti kimliği ve yönü ile işaretleyin.

3. DeepSeek-V3 teknik raporunun 5. resmini okuyun (arXiv:2412.19437). DualPipe'nin ön tarafı bir parçası içindeki her şeye gönderme için üst üstelik penceresini tanımlayın. Hesaplama programının bunu nasıl gizlediğini açıklayın.

4. DualPipe'nin P=8 boru hattı aşamaları olan 70B yoğun bir model için 2x parametresi üst ücreti ve P=16 boru hattı aşamaları olan 671B MoE modeli için 2x parametresi üst ücreti hesaplayın.

5. DualPipe ile Chimera'yı karşılaştırın (2021'den beri rekabetçi iki yönlü bir programlayıcı).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Pipeline bubble | "Idle time per rank" | GPU cycles wasted because a pipeline stage is waiting for its input or gradient |
| 1F1B | "Default pipeline schedule" | One forward / one backward interleaved scheduling; the baseline DualPipe beats |
| Zero Bubble | "Sea AI Lab 2023" | Splits backward into B (input gradient) and W (weight gradient); almost fully tightens the pipeline |
| DualPipe | "DeepSeek-V3 schedule" | Bidirectional pipeline + compute-comm overlap; bubbles do not grow with micro-batch count |
| DualPipeV | "Cut-in-half" | V-shape refinement that drops the 2x parameter replication at the cost of slightly larger bubbles |
| Chunk | "Unit of pipeline work" | A forward or backward pass of one micro-batch through one pipeline stage |
| All-to-all dispatch | "Send tokens to experts" | Cross-node comm that routes tokens to their assigned MoE experts |
| All-to-all combine | "Bring expert outputs back" | Cross-node comm that gathers expert outputs after the MLP |
| Expert Parallelism (EP) | "Experts across GPUs" | Shards MoE experts across ranks so different GPUs hold different experts |
| Pipeline Parallelism (PP) | "Layers across GPUs" | Shards model layers across ranks; the dimension DualPipe schedules |
| Bubble fraction | "Wasted GPU time" | (bubble_time / total_time); the fraction DualPipe drives toward zero |

## Daha Fazla Okumak

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) DualPipe'in ana referansı
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) DualPipeV (Yarıya Kes) modunu da içeren açık kaynak referans uygulaması
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) ZERO Bubble'in öncü
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) DeepSeek'in EP-off modunu bilgilendiren DualPipeV analizi
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) 1F1B programı DualPipe karşılaştırır
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) orijinal boru hattı paralelliği kağıt ve kabarcık sorunu
