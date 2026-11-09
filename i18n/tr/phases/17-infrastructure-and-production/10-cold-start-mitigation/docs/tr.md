# Serversiz LLM'ler için soğuk başlangıç azaltma

> Büyük bir model soğuktan servise geçmek için birkaç dakika alır: Yeni bir düğümde 70B modeli ilk token'dan yaklaşık 3-8 dakika önce. Gerçek bir sunucu olmayan dünyada, bu bir                                                                                                                                                                                                                                                            Yumuşaklaştırmalar beş katman üzerinde çalışır: önceden ekilmiş düğüm görüntüleri (AWS'de Bottlerocket, iki hacimli ark), model akışı (NVIDIA Run:ai Model Streamer, vLLM'de doğuşcu), GPU bellek anlık çekme (Modal kontrol noktaları, 10 kat daha hızlı yeniden başlatma), sıcak havuzlar (`min_workers=1`Bu ders size beş katı ölçmeyi, bütçeyi ve yığmayı öğretir. Bu ders, beş katı ölçmeyi, bütçeyi ve yığmayı öğretir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Soğuk başlangıç hafifletme sisteminin beş katmanını sıralayın ve her katman için bir araç veya model belirleyin.
- 70B modelinde toplam soğuk başlangıç zamanı (nod sağlanması) + (koşul yükleme ağırlıkları) + (koşul yükleme ağırlıkları) + (motor başlangıcı) toplamı olarak hesaplayın.
- Canlı göçün neden KV önbelleği değil girme jetonları (KB) aktardığını ve cezanın ne olduğunu (yağnadan hesaplama) açıklayın.
- Sıcak havuz pazarlama oranını (sürük GPU için ödeme veya soğuk başlangıç kuyruk kabul) ve SLA eşiğini belirtin.`min_workers > 0`İhtiyaclı olur.

## Sorun

Sunucusuz LLM son noktası gece içinde sıfıra yükselmiş.

1. Karpenter, GPU düğümünü 45-60s'a kadar sağlıyor.
2. Kontener, ağırlıkları olan 30 GB görüntü çekir: 120-300s.
3. Motorun ağırlıkları HBM'ye yüklenmesi: model boyutuna ve depolama hızına bağlı olarak 45-120s.
4. vLLM veya TRT-LLM CUDA grafiklerini initializer, KV önbelleği havuzu, tokenizer: 10-30s.

Toplam: 220-510s (yaklaşık 3-8 dakika) bir token geri gelmeden önce. SLA 2s.`min_workers=1`Bu yüzden, bu işlemler, bir kullanıcı tarafından yapılan veya yapılmayan bir işlem için kullanılır.

Soğuk başlangıç hafiflemesi, her zaman aktif olanların gecikmesini yaklaşırken sunucusuz ekonomisini nasıl koruyacağımızdır.

## Anlaşım

### Katman 1  önceden tohumlanmış düğüm görüntüleri (Bottlerocket)

AWS'de Bottlerocket'ın iki hacmelik mimarisi işletim sistemini verilerden ayırır.`EC2NodeClass`Yeni düğümler yerel NVMe'de ağırlıklarla başlatılır  adım 2 ve 3'ün bir kısmı ortadan kaybolur. Karpenter ile doğuştan çalışır. Tipik tasarruf: büyük modeller için soğuk başlangıç başına 2-4 dakika.

GCP'de eşdeğer: önceden pişirilmiş konteyner katmanları ile özel VM görüntüleri. Azure'da: aynı desenle yönetilen disk anlık görüntüleri.

### Katman 2  model akışı (Run:ai Model Streamer)

İlk talebi cevaplamadan önce tüm dosyayı yüklemek yerine, GPU bellek tabakasından tabakaya akış ağırlıklarını akışlatın ve ilk transformatör bloğu oturan olduğu anda işlem yapmaya başlayın. NVIDIA Run:ai Model Streamer vLLM 2026'da doğuştan gönderir. S3, GCS ve yerel NVMe ile çalışır.

### Katman 3  GPU hafıza anlık görüntüleri (Modal)

Modal, ilk yüklenmeden sonra GPU durumunun kontrol noktasını (koşmalar, CUDA grafikleri, KV önbelleği bölgesi) alır. Sonrasında yeniden başlatılan HBM  10x daha hızlı olarak doğrudan deserialize olur. Bu "sıcak bir GPU'yu 2 saniye içinde başlatmak" için en yakın şeydir.

### Katman 4  sıcak havuzlar (min_workers=1)

En basit hafifleme: her zaman bir kopya hazır tutun.$0.85-$1.50/saat 30s soğuk başlangıçtan kaçınmak için) ve büyük olanlara karşı kibar (5 dakikalık soğuk başlangıçtan kaçınmak için 4 $ / saat ödeyin).

### Katman 5  Katmanlı yükleme (ServerlessLLM)

ServerlessLLM depolama bir hiyerarşi olarak değerlendiriyor: NVMe (hızlı ama büyük), DRAM (ortaya ancak katlı), HBM (küçük ama anlık). Ağırlıklar önceden DRAM'a yüklenir; talep üzerine yükleme HBM'ye. Kağıt soğuk yüklerde naif disk-HBM'ye karşı 10-200x gecikme azaltımı rapor ediyor. Üretim kabulü erken ama vLLM ile entegrasyonlar var.

### Katman 6  canlı göç (bonus modeli)

Bir düğüm bulunmadığında (spot eviction, node drain), geleneksel bir örnektir soğuk başlatma ve başka bir kopya ve dren talep kuyruk. Canlı göç giriş jetonlarını (kilobit) model yüklenmiş bir hedefe taşıyor ve KV önbelleğini hedefte yeniden hesaplar. Yeniden hesaplama, ağ üzerinden GB KV önbelleğini aktarmaktan daha ucuz.

### Sıcak havuz matematikleri

P99 TTFT SLA'sı 2s'li bir servis için, soru "sıcak havuz evet/hayır" değil "ne kadar sıcak kopya ve hangi yollar onları alır".

- Yüksek değerli etkileşim yolları (canlı sohbet, sesli ajan): `min_workers=1-2`- Evet .
- Arka planlı parti yolları (gece sınıflandırması): ölçekle sıfır arasında kabul edilir, 5-10 dakika soğuk başlangıç kabul edilebilir.
- Premium seviye: `min_workers`Özel kapasiteye sahip kiracı başına.

### Optimize edilmeden önce ölçme

70B modeli için taze bir düğüm üzerinde soğuk başlangıç anatomisi (önergeci):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Hatırlamalısın numaralar

- Modal soğuk başlangıç: 2-4 saniye (GPU çabuk çekimleri ile).
- Baseten standart soğuk başlangıç: 5-10 saniye; ön ısınma ile alt saniye.
- Çiğ 70B soğuk başlangıç: 3-8 dakika.
- Run:ai Model Streamer: ~ 2x ağırlık yük hızlandırması.
- ServersizLLM katlı yükleme: 10-200 kat daha az gecikme (kağıt sayıları).

```figure
cold-start-pipeline
```

## Kullan

`code/main.py`Her bir hafifleme ile ve olmadan soğuk başlangıç yolunu modellemektedir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-cold-start-planner.md`SLA, model boyutu ve trafik şekli göz önüne alındığında, hangi hafiflemeleri toplayacağını seçer.

## Egzersizler

1. Çık .`code/main.py`SLO'da ek talep düşüşleri ile soğuk başlangıç vergisini ödemekten daha ucuz olan bir sıcak kopyasının karşılığı olarak, eşitlik oranını hesaplayın.
2. 3s'lik P99 TTFT SLA ile 13B modelini kullanın.
3. Bottlerocket öncesi çekim görüntü çekimi ortadan kaldırır, ancak ağırlıklar hala anlık hbm'den yüklenir. Anlık hbm'nin 7 GB/s'de okunması durumunda 70B modeli için duvar saati hesaplayın.
4. Sunucusuz sağlayıcı GPU anında görüntüler sunuyor (Modal) ve ekibiniz "anında görüntüler PII sızdırıyor" diye reddediyor.
5. Bir katlı sıcak havuz politikası tasarlayın: ücretli kullanıcılar, deneme kullanıcıları ve seri iş yükleri için kaç sıcak kopya? Matematik gösterin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Daha Fazla Okumak

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) Modal'ın yayınladığı referans değerleri ve kontrol nokta mimarisi.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) Önceden ekilen veri hacmi anında görüntüsü örneği.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) hesaplama ayarıyla birlikte örtüşen ağırlıklar yüklenir.
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts)                                                                                                                                                                                                                                                              
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) Dört katlı yükleme tasarımı.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) ayrıntılı yerleştirmeler için canlı göç.
