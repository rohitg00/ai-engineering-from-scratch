# EAGLE-3 Üretimde Spekülatif Kod Çözme

> Spekülatif kod çözme, hızlı taslak modeli hedef modelle eşleştirir. Taslak K token önermektedir; hedef tek bir ileri yönde doğrulanır; kabul edilen token'ler ücretsizdir. 2026'da, EAGLE-3 üretim sınıfı varyanttır; taslak kafasını ham token'ler yerine hedef modelin gizli durumları üzerinde eğiterek genel sohbette kabul oranı alfa'yı 0,6-0,8 bandına iter. Doğru soru "taslak ne kadar hızlı" değil, "trafiğimde alfa nedir?" Alfa ~0,55'in altına düşerse spekülatif kod çözme yüksek eşzamanlılıkta net olumsuzdur çünkü reddedilen her taslak ikinci bir hedef ileri geçişe mal olur. Bu ders size önce alfayı ölçmeyi, sonra bayrağı ters çevirmeyi öğretir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak kabul oranı simülatörü)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme), Aşama 10 · 18 (Çoklu Token Tahmini)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Spekülatif kod çözmenin üç neslini adlandırın ve EAGLE-3'ün EAGLE-2'den ve klasik taslak modelden neleri değiştirdiğini açıklayın.
- Kabul oranı alfa'yı tanımlayın, alfa ve K'den (taslak uzunluğu) beklenen hızı hesaplayın ve hedef eşzamanlılığınız için başa baş alfayı tanımlayın.
- vLLM 2026'da spekülatif kod çözmenin neden isteğe bağlı olduğunu (varsayılan değil) ve alfayı ölçmeden açmanın neden bir üretim anti-modeli olduğunu açıklayın.
- Bir ölçüm planı yazın: hangi benchmark, hangi prompt dağıtımı, hangi eşzamanlılık noktası, hangi metriğe geçilecek.

## Sorun

Kod çözme belleğe bağlıdır. Llama 3.3 70B FP8 çalıştıran bir H100'de, kodu çözülen her token ~140 GB/sn ağırlığı okur ve bir token yayar. GPU hesaplaması kod çözme sırasında neredeyse boştadır; darboğaz, matmul verimi değil, HBM bant genişliğidir.

Spekülatif kod çözme, boşluktan yararlanır. Ucuz bir taslak modelle K adayı token'ler oluşturun, ardından hedef modelden tek bir ileri geçişte tüm K'yı doğrulamasını isteyin. Doğrulanan her token fiilen ücretsizdir (her halükarda hedefin yapmak zorunda kalacağı bir K partisi halinde amortismana tabi tutulur).

Klasik taslak model yaklaşımı aynı ailenin daha küçük bir modelini kullanır (Llama 3.3 70B için Llama 3.2 1B taslağı hazırlama). İşe yarıyor ancak kabul oranı vasat; daha küçük model dağılımı hedeften sapıyor. EAGLE, ardından EAGLE-2 ve ardından EAGLE-3, hafif bir taslak kafasını doğrudan hedef modelin dahili durumları üzerinde eğitir, böylece taslağın dağıtımı hedefi çok daha yakından takip eder. Alfanın taslak modelde 0,4'ten EAGLE-3'te 0,6-0,8'e çıkmasının nedeni budur.

Önemli nokta: EAGLE-3, vLLM 2026'da isteğe bağlıdır. `speculative_config` açıkça ayarlanmalıdır. Bayrak yok, hızlanma yok. Gerçek trafiklerinde alfayı ölçmeden bu özelliği açan ekipler genellikle kuyruk gecikmesinin iyileşmek yerine daha da kötüleştiğini görür.

## Konsept

### Spekülatif kod çözme aslında neyi satın alır?

Özel kod çözme olmadan, token başına maliyet bir hedef ileridir. K taslak uzunluğundaki spesifikasyon kod çözme ve kabul alfa ile hedef başına beklenen token'ler `1 + K * alpha`'dir. Hızlanma, epsilon'un taslak artı doğrulama ek yükü olduğu `(1 + K * alpha) / (1 + epsilon)`'dir. K=5 için alfa=0,7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`. Gerçek dünyadaki sayılar 2-3 kat civarında kümeleniyor çünkü alfa üretim trafiğinde nadiren bu kadar yüksek oluyor ve epsilon yüksek parti boyutunda büyüyor.

### Neden önemli olan tek ölçüm alfadır?

Reddedilen token'ler kaybolmaz; ilk reddedilen token için ikinci bir hedefi ileri doğru zorlarlar. Alfanın 0,4'e düştüğü bir iş yükünde, taslak genel gider artı doğrulama artı yeniden kayıt ücreti ödersiniz. Yüksek eşzamanlılıkta (örneğin 256 eşzamanlı), kod çözme grubu zaten yeterince büyüktür ve "yalnız hedef" ile "doğrulamalı hedef" arasındaki bellek bant genişliği boşluğunu daraltır. Çoğu 2026 donanımında alfa 0,55'in altında, spesifikasyon kod çözme net negatiftir.

Alfa iş yüküne göre değişir. ShareGPT tarzı genel sohbette, ShareGPT'de eğitilen EAGLE-3 0,6-0,8'e ulaşır. Alana özgü trafikte (kod, tıbbi, hukuki) genel veriler konusunda eğitilmiş taslak başkanı 0,4-0,6'ya düşer. Etki alanına özgü bir taslak kafasını eğitmek alfayı kurtarır; hedef ince ayarıyla karşılaştırıldığında bu, hafif ve hızlı bir eğitim işidir.

### Bir bakışta KARTAL nesilleri

- **Klasik taslak model**: aynı ailenin küçük modeli. Alfa 0.3-0.5. Altyapı basit — iki model yüklendi, taslak ileri hedef başına K ileri doğru çalıştırılıyor.
- **EAGLE-1 (2024)**: Hedefin gizli durumları konusunda eğitilmiş tek taslak kafa (son katman). Alfa ~0.5-0.6. Hedefin üstündeki küçük parametre yükü.
- **EAGLE-2 (2025)**: uyarlanabilir draft uzunluğu ve ağaç tabanlı draftlar (tek hedef geçişte birden fazla dalı doğrulayın). Alfa ~0.6-0.7. Daha karmaşık taslak zamanlayıcı.
- **EAGLE-3 (2025-2026)**: taslak kafası birden fazla hedef katmanı (sadece son değil) üzerinde eğitilmiş, daha iyi hizalama. Genel sohbette alfa ~0,6-0,8.

### 2026 üretim tarifi

1. Gemi hedef modeli düz. Hedef eşzamanlılıkta temel TTFT, ITL ve verimi ölçün.
2. vLLM `speculative_config` aracılığıyla EAGLE-3 taslağını etkinleştirin. benchmark'yi yeniden çalıştırın.
3. Günlük kabul oranı alfa. vLLM V1 bunu `spec_decode_metrics.accepted_tokens_per_request` olarak bildirir. Alfa elde etmek için istenen taslak uzunluğuna bölün.
4. Üretim trafiği dağıtımında alfa < 0,55 ise, spesifikasyon kod çözümünü devre dışı bırakın veya alana özel bir EAGLE-3 taslağı eğitin.
5. Üretim eşzamanlılığında yeniden çalıştırın. P99 ITL'nin daha da kötüleşmediğini doğrulayın.

### Üretim tuzağı: P99 kuyruğu

Ortalama ITL, spesifikasyon kodu çözmeyle düşer. Ayarlama yapmazsanız P99 daha da kötüleşebilir. Reddedilen taslaklar iki geçişli bir diziyi tetikler (taslak + doğrulama-başarısız + yeniden kayıt). Tam toplu işlemde bu iki geçiş serileştirilir. P50'yi değil P99 ITL'yi izleyin.

### EAGLE-3'ün halihazırda konuşlandırılmış olduğu yerler

Google, 2025'te AI Genel Bakışlarında spekülatif kod çözmeyi uygulamaya koydu (aynı kalite, daha hızlı yanıt). vLLM V1, belgelenen arayüz olarak `speculative_config`'yi sunar; V1'deki N-gram GPU spekülatif kod çözme, parçalı önceden doldurmayla uyumlu varyanttır. SGLang, önek ağırlıklı iş yükleri için önerilen taslak yolu olarak EAGLE-3'ü destekler.

### Tek satırda başa baş matematik

Beklenen hızlanma: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`. `S = 1`'nin ayarlanması alfa için çözüm sağlar: `alpha_breakeven = verify_overhead / K`. Tipik valid_overhead için ~0,15 ve K=5: `alpha_breakeven = 0.03`. Ancak bu ham kod çözme matematiğidir. Yüksek eşzamanlılıkta, doğrulama ek yükü artar ve kod çözme grubu zaten diziler arasındaki bellek okumalarını amorti eder, böylece etkili alpha_breakeven pratikte ~0,45-0,55'e tırmanır.

### Spekülatif kod çözme ne zaman kullanılmamalıdır?

- Gecikmenin önemli olmadığı Batch-1 çevrimdışı oluşturma. Düz hedef kullanın.
- Çok kısa çıkışlar (50 token'nin altında). Genel masrafların taslağını çıkarın ve maliyetin hakim olduğunu doğrulayın.
- Alan eğitimi almış bir taslak başkanı olmayan özel alanlar. Alfa çok düşük.
- vLLM v0.18.0 artı taslak model spesifikasyon kod çözme artı `--enable-chunked-prefill`. Bu kombinasyon derlenmiyor. Belgelenen istisna, V1'deki N-gram GPU spesifikasyon kod çözmedir.

## Kullan onu

`code/main.py`, çeşitli alfa değerleri ve taslak uzunlukları K boyunca spekülatif kod çözme ile veya spekülatif kod çözme olmadan bir kod çözme döngüsünü simüle eder. Başabaş alfayı, ölçülen hızı ve kuyruk davranışını yazdırır. Spekülatif kod çözmenin tam olarak nerede ödeme yapmayı bıraktığını görmek için bunu birkaç (alfa, K) kombinasyon üzerinde çalıştırın.

## Gönderin

Bu ders `outputs/skill-eagle3-rollout.md`'yi üretir. Bir hedef model, trafik dağıtım açıklaması ve eşzamanlılık hedefi göz önüne alındığında, aşamalı bir EAGLE-3 kullanıma sunma planı üretir - benchmark taban çizgisi, yapılandırmayı etkinleştir, alfayı ölç, alfada kapı >= 0,55, P99 ITL'yi izle.

## Egzersizler

1. `code/main.py`'yi çalıştırın. K=5'te 2 kat hızlanma için hangi alfaya ihtiyacınız var? 3 kat hızlanma için mi? Verify_overhead için bu ne kadar hassas?
2. Üretim trafiğinin %70 genel sohbete, %30 koda bölündüğünü düşünün. Genel sohbet, ShareGPT'de eğitilmiş EAGLE-3 ile alfa 0,7'ye ulaştı; kod alfa 0.4'e ulaşır. Harmanlanmış alfa nedir ve spesifik kod çözme net pozitif midir?
3. vLLM `speculative_config` belgelerini okuyun. Üç modu (taslak model, EAGLE, N-gram) ve hangisinin parçalı önceden doldurmayla uyumlu olduğunu adlandırın.
4. EAGLE-3'ü etkinleştirdikten sonra ortalama ITL'nin %25 düştüğünü görüyorsunuz, ancak P99 ITL'si %15 arttı. Bir hafifletme teşhis edin ve önerin.
5. Llama 3.3 70B için EAGLE-3 taslak kafasının hafıza maliyetini hesaplayın. Llama 3.2 1B'yi klasik taslak olarak çalıştırmakla nasıl karşılaştırılır?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Spekülatif kod çözme | "taslak artı doğrulama" | Ucuz bir modelle K token önerin, tüm K'yi tek bir hedefte doğrulayın |
| Kabul oranı alfa | "özellik kabul oranı" | Hedef tarafından kabul edilen token taslağının kesri; önemli olan tek ölçüm |
| Taslak uzunluğu K | "özel k" | Taslağın ilerideki hedef başına kaç tane token önerdiği; tipik 4-8 ​​|
| Tepegöz epsilonunu doğrulayın | "özel ek yük" | Doğrulama ve yeniden kaydetmenin, düz hedefe ilerlemeye kıyasla ekstra maliyeti; toplu olarak büyüyor |
| KARTAL-3 | "en son KARTAL" | 2025-2026 çeşidi; taslak kafasını birden fazla hedef katman üzerinde eğitir; genel sohbette alfa 0.6-0.8 |
| `speculative_config` | "vLLM spesifikasyon yapılandırması" | vLLM V1'deki açık katılım; varsayılanın olmaması, hızlanmanın da olmadığı anlamına gelir |
| N-gram spesifikasyon kodunun çözülmesi | "N-gram taslak" | prompt'de N gram aramalarını kullanan GPU tarafı taslağı; parçalanmış önceden doldurma uyumlu |
| Başabaş alfa | "işlemsiz alfa" | Spesifikasyon kod çözme işleminin sıfır hızlanma sağladığı alfa; bunu üretim eşzamanlılığında izleyin |
| Reddedilen taslak iki geçişli | "yeniden kayıt maliyeti" | Taslaklar reddedildiğinde iki ileri hedef; P99 kuyruğunu çalıştırıyor |

## Daha Fazla Okuma

- [vLLM — Spekülatif Kod Çözme belgeleri](https://docs.vllm.ai/en/latest/features/spec_decode/) — `speculative_config` üzerinde yetkili kaynak ve V1'de parçalanmış önceden doldurma uyumluluğu.
- [vLLM Spekülatif Yapılandırma API'si](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — tam alan seti.
- [EAGLE kağıdı (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — orijinal EAGLE taslak kafası formülasyonu.
- [EAGLE-2 kağıdı (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — uyarlanabilir taslaklar ve ağaçlar.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — spekülatif kod çözme özelliğine sahip verimli LLM sistemi.
- [BentoML — Spekülatif Kod Çözme](https://bentoml.com/llm/inference-optimization/speculative-decoding) — üretime geçiş kontrol listesi.
