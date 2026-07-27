# Sunucusuz LLM'ler için Soğuk Başlatmanın Azaltılması

> 20 GB'lik bir model görüntüsünün soğuktan servise geçmesi 5-10 dakika (7B) ila 20+ dakika (70B) sürer. Gerçek sunucusuz bir dünyada bu bir ısınma değil, bir kesintidir. Azaltmalar beş katmanda çalışır: önceden tohumlanmış düğüm görüntüleri (AWS'de Bottlerocket, çift hacimli arşiv), model akışı (NVIDIA Run:ai Model Streamer, vLLM'de yerel), GPU bellek anlık görüntüleri (Modal kontrol noktaları, 10 kata kadar daha hızlı yeniden başlatma), sıcak havuzlar (`min_workers=1`), katmanlı yükleme (SunucusuzLLM'nin NVMe→DRAM→HBM ardışık düzeni, 10-200x) gecikme azalması) ve KV önbelleği (GB) yerine giriş token'leri (KB) taşıyan dinamik geçiş. Modal zemin olarak 2-4 saniyelik soğuk başlangıçlar yayınlıyor; Varsayılan olarak 5-10 saniye, ön ısınma ile saniyenin altında. Bu ders size beş katmanı ölçmeyi, bütçelemeyi ve istiflemeyi öğretir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak soğuk başlangıç yolu simülatörü)
**Önkoşullar:** Aşama 17 · 02 (Inference Platform Ekonomisi), Aşama 17 · 03 (GPU Otomatik Ölçeklendirme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Soğuk başlatmayı azaltmanın beş katmanını sıralayın ve her katmana bir araç veya desen adı verin.
- Bir 70B modeli için toplam soğuk başlatma süresini (düğüm provizyonu) + (ağırlıkların indirilmesi) + (ağırlıkların HBM'ye yüklenmesi) + (motor başlatma) toplamı olarak hesaplayın.
- Canlı geçişin neden KV önbelleğini (GB) değil de token (KB) girişini aktardığını ve cezanın ne olduğunu (yeniden hesaplama) açıklayın.
- Sıcak havuz takasını (boştaki GPU için ödeme yapın veya soğuk başlatma kuyruğunu kabul edin) ve `min_workers > 0`'nin zorunlu hale geldiği SLA eşiğini adlandırın.

## Sorun

Sunucusuz LLM uç noktanız bir gecede sıfıra ölçeklenir. 8 a.m adresinde. trafik artışları. İlk istek şu süre boyunca bekler:

1. Karpenter bir GPU düğümü hazırlıyor: 45-60 sn.
2. Kap, ağırlıkları 120-300 saniye olan 30 GB'lık bir görüntü çeker.
3. Motor, HBM'ye ağırlıkları yükler: model boyutuna ve depolama hızına bağlı olarak 45-120 saniye.
4. vLLM veya TRT-LLM, CUDA grafiklerini, KV önbellek havuzunu, tokenizer: 10-30s'yi başlatır.

Toplam: Bir token geri gelmeden önce 220-510 saniye (yaklaşık 3-8 dakika). SLA'nız 2 saniyedir. Bir sıcak havuz (`min_workers=1`) gönderiyorsunuz ve sorun ortadan kalkıyor gibi görünüyor - ancak şimdi 7x24 boşta kalan bir GPU için ödeme yapıyorsunuz. Hizmetinizde her biri bir sıcak kopyaya sahip 5 ürün varsa, tek bir kullanıcı arasa da aramasa da bu 5 × 24 × 30 = 3.600 GPU saati/ay demektir.

Soğuk başlatmayı azaltma, her zaman açık gecikme süresine yaklaşırken sunucusuz ekonominin nasıl korunacağıdır.

## Konsept

### Katman 1 — önceden tohumlanmış düğüm görüntüleri (Bottlerocket)

AWS'de Bottlerocket'in çift birimli mimarisi, işletim sistemini verilerden ayırır. Konteyner görüntünüz önceden çekilmiş olarak veri biriminin anlık görüntüsünü alın; `EC2NodeClass`'nizdeki anlık görüntü kimliğine bakın. Yeni düğümler, halihazırda yerel NVMe'de bulunan ağırlıklarla önyüklenir; 2. adım ve 3'ün bir kısmı kaybolur. Yerel olarak Karpenter ile çalışır. Tipik tasarruf: Büyük modeller için soğuk çalıştırma başına 2-4 dakika.

GCP'de eşdeğeri: önceden hazırlanmış kapsayıcı katmanlarına sahip özel VM görüntüleri. Azure'da: aynı düzene sahip yönetilen disk anlık görüntüleri.

### Katman 2 — model akışı (Çalıştır:ai Model Streamer)

İlk isteği yanıtlamadan önce tüm dosyayı yüklemek yerine, ağırlıkları GPU belleğine katman katman aktarın ve ilk transformer bloğu yerleşik hale gelir gelmez işleme başlayın. NVIDIA Run:ai Model Streamer, vLLM 2026'da yerel olarak gönderilir. S3, GCS ve yerel NVMe ile çalışır. G/Ç'yi bilgi işlem kurulumuyla örtüştürerek büyük modeller için ağırlık yükleme süresini kabaca yarı yarıya azaltır.

### Katman 3 — GPU belleği anlık görüntüleri (Modal)

Modal, ilk yüklemeden sonra GPU durumunun (ağırlıklar, CUDA grafikleri, KV önbellek bölgesi) bir kontrol noktasını alır. Sonraki yeniden başlatmalar, seri durumdan doğrudan HBM'ye çıkarılır; yeniden başlatmadan 10 kat daha hızlıdır. Bu, "sıcak bir GPU'nun 2 saniyede başlatılması"na en yakın şeydir. Takas: anlık görüntüler GPU topolojisine göredir; dolayısıyla Karpenter sizi farklı bir SKU'ya geçirirse yeniden kontrol noktası oluşturursunuz.

### Katman 4 — sıcak havuzlar (min_workers=1)

En basit önlem: Bir kopyayı her zaman hazır tutun. Maliyet, bir GPU'nun 7x24 saatlik ücretidir. Aritmetik, küçük modellerde acımasızdır (30'ların soğuk başlangıcını önlemek için saatte $0.85-$1,50 ödersiniz) ve büyük modellerde naziktir (5 dakikalık soğuk başlangıcı önlemek için saatte 4 dolar ödersiniz). Sıcak havuzların zorunlu hale geldiği SLA eşiği: 70B+ modelinde genellikle TTFT P99 < 60s.

### Katman 5 — katmanlı yükleme (SunucusuzLLM)

SunucusuzLLM, depolamayı bir hiyerarşi olarak ele alır: NVMe (hızlı ama büyük), DRAM (orta ancak katmanlı), HBM (küçük ama anlık). Ağırlıklar DRAM'e önceden yüklenmiştir; HBM'ye talep üzerine yükleme. Makale, saf diskten HBM'ye kıyasla soğuk yüklerde gecikme süresinin 10-200 kat azaldığını bildiriyor. Üretimin benimsenmesi henüz erken ancak vLLM ile entegrasyonlar mevcut.

### Katman 6 — canlı geçiş (bonus modeli)

Bir düğüm kullanılamaz hale geldiğinde (nokta tahliyesi, düğüm boşaltma), geleneksel model başka bir kopyaya soğuk başlatma ve istek kuyruğunu boşaltmadır. Canlı geçiş, giriş token'leri (kilobayt) modelin yüklü olduğu bir hedefe taşır ve hedefte KV önbelleğini yeniden hesaplar. Yeniden hesaplama, GB KV önbelleğinin ağ üzerinden aktarılmasından daha ucuzdur. Ayrıştırılmış deployment'ler için geçerlidir.

### Sıcak havuz matematiği

P99 TTFT SLA'sı 2 saniye olan bir hizmet için soru "sıcak havuz evet/hayır" değil, "kaç tane sıcak kopya ve bunları hangi yolların elde ettiği"dir.

- Yüksek değerli etkileşimli yollar (canlı sohbet, sesli agent): `min_workers=1-2`.
- Arka plan toplu yolları (gecelik sınıflandırma): sıfıra ölçeklendirme kabul edilir, 5-10 dakikalık soğuk başlatma tolere edilebilir.
- Premium katman: tahsis edilmiş kapasiteye sahip kiracı başına `min_workers`.

### Optimize etmeden önce ölçün

Yeni bir düğümdeki 70B modeli için soğuk başlatma anatomisi (açıklayıcı):

| Aşama | Zaman | Azaltma |
|-------|------|-----------|
| Düğüm provizyonu | 50'ler | Bottlerocket + önceden tohumlanmış görüntü, sıcak havuz |
| Resim çekme | 180'ler | Önceden eklenmiş veri hacmi (ortadan kaldırın) |
| Ağırlıklar - HBM | 75'ler | Model flama (yarım); GPU anlık görüntüsü (ortadan kaldırın) |
| Motor başlatma | 20'ler | Kalıcı CUDA grafik önbelleği |
| İlk ileri | 3'ler | Minimum doğal gecikme |
| **Tamamen soğuk** | **328'ler** | |
| **Azaltmalar dahil toplam** | **~15s** | 22 kat azalma |

### Hatırlamanız gereken sayılar

- Modal soğuk başlangıç: 2-4 saniye (GPU anlık görüntüleri ile).
- Varsayılan soğuk başlatmayı temel alın: 5-10s; ön ısınma ile saniyenin altında.
- Ham 70B soğuk başlatma: 3-8 dakika.
- Çalıştır:ai Model Streamer: ~2 kat ağırlık yükleme hızı artışı.
- SunucusuzLLM katmanlı yükleme: 10-200x gecikme azalması (kağıt sayıları).

## Kullan onu

`code/main.py`, her bir azaltmanın olduğu ve olmadığı bir soğuk başlangıç yolunu modeller. Toplam soğuk başlatma süresini, sıcak havuz maliyetini ve sıcak havuzun kendisini amorti ettiği başabaş noktası talep oranını raporlar.

## Gönderin

Bu ders `outputs/skill-cold-start-planner.md`'yi üretir. SLA, model boyutu ve trafik şekli göz önüne alındığında hangi azaltımların yığınlanacağını seçer.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Sıcak bir kopyanın, SLO'da ekstra talep kesintileri yoluyla soğuk başlangıç ​​vergisini ödemekten daha ucuz olduğu başabaş noktası talep oranını hesaplayın.
2. 3 saniyelik P99 TTFT SLA'ya sahip bir 13B modelini dağıtırsınız. Bunu başaran minimum azaltma yığınını (en az katman) seçin.
3. Şişe roketi ön tohumlama, görüntü çekmeyi ortadan kaldırır ancak ağırlıklar yine de anlık görüntüden HBM'ye yüklenir. Anlık görüntü destekli NVMe 7 GB/sn hızında okuyorsa 70B modeli için duvar saatini hesaplayın.
4. Sunucusuz sağlayıcınız GPU anlık görüntüleri (Modal) sunuyor ve ekibiniz "anlık görüntüler PII sızdırdığı" için reddediyor. Her iki tarafı da tartışın — gerçekçi risk nedir ve azaltma nedir (geçici anlık görüntüler, şifreleme, ad alanı izolasyonu)?
5. Katmanlı bir sıcak havuz politikası tasarlayın: Ücretli kullanıcılar, deneme kullanıcıları ve toplu iş yükleri için kaç tane sıcak kopya var? Matematiği göster.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Soğuk başlangıç ​​| "büyük duraklama" | Yeni bir kopyada istekten ilk token'ye kadar geçen süre |
| Sıcak havuz | "minimum düzeyde her zaman açık" | `min_workers >= 1` en az bir kopyayı hazır tutmak için |
| Önceden tohumlanmış görüntü | "pişmiş AMI" | Önceden yerleşik konteyner ağırlıklarına sahip düğüm görüntüsü |
| Şişe Roketi | "AWS düğüm işletim sistemi" | Çift birim anlık görüntü desteğine sahip AWS konteyner için optimize edilmiş işletim sistemi |
| Model flama | "akış yükü" | Bilgi işlem kurulumuyla G/Ç ağırlıklarını çakıştırın |
| GPU anlık görüntüsü | "HBM'ye kontrol noktası" | Yükleme sonrası GPU durumunu serileştirin; yeniden başlatıldığında seri durumdan çıkarma |
| Katmanlı yükleme | "NVMe + DRAM + HBM" | Depolama katmanlarının hiyerarşisi; talep üzerine yükleme |
| Canlı geçiş | "token'leri taşı" | Girişi (KB) aktarın, hedefte KV'yi yeniden hesaplayın |
| `min_workers` | "sıcak kopyalar" | Sunucusuz minimum canlı tutma sayısı |
| Sıfıra ölçeklendirme | "tam sunucusuz" | Boştayken maliyet yok; tam soğuk başlangıç ​​vergisini kabul edin |

## Daha Fazla Okuma

- [Modal — Soğuk başlatma performansı](https://modal.com/docs/guide/cold-start) — Modal'ın yayınlanmış benchmark'leri ve denetim noktası mimarisi.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — önceden hazırlanmış veri hacmi anlık görüntü modeli.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — hesaplama kurulumuyla ağırlık yükünü örtüştürür.
- [Baseten — Soğuk başlatmanın azaltılması](https://www.baseten.co/blog/cold-start-mitigation/) — ön ısıtma taktik kitabı.
- [SunucusuzLLM kağıdı (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — katmanlı yükleme tasarımı.
- [NVIDIA — Kubernetes üzerinde ayrıştırılmış LLM Inference](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — ayrıştırılmış deployment'ler için canlı geçiş.
