# Omni Modelleri: Qwen2.5-Omni ve Düşünen-Konuşan Ayrımı

> GPT-4o'nun Mayıs 2024'teki ürün demosu, temeldeki model nedeniyle değil, ürünün şekli nedeniyle çığır açıcıydı; sizin konuştuğunuz bir ses arayüzü, model, kameranın gördüklerini görüyor ve 250 ms'den kısa bir sürede tekrar konuşuyor. Açık ekosistem, 2024 ve 2025 yıllarının geri kalanını bu ürün yüzeyine ulaşmak için yarışarak geçirdi. Qwen2.5-Omni (Mart 2025), referans açık tasarımdır: bir Düşünen (büyük metin üreten transformer) artı bir Konuşmacı (paralel konuşma üreten transformer), konuşma akışı token'lerle birbirine bağlanır. Mini-Omni bunu basitleştirdi, Moshi gecikmesini eşleştirdi, GLM-4-Voice bunu Çince'ye kadar genişletti. Bu derste Düşünen-Konuşan mimarisi ve gerçek zamanlı diyalog akışının çalışmasını sağlayan gecikme bütçesi anlatılmaktadır.

**Tür:** Yapım
**Diller:** Python (stdlib, akış hattı gecikme simülatörü + VAD döngüsü)
**Önkoşullar:** Aşama 12 · 19 (ses Yüksek Lisansı), Aşama 12 · 16 (herhangi birinden herhangi birine)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- inference hattını Düşünen (metin akıl yürütme) ve Konuşan (konuşma sentezi) olarak ikiye bölün ve paralel akışın neden çalıştığını açıklayın.
- Bir konuşma etkileşimi için ilk ses baytına kadar geçen süre (TTFAB) bütçesini bileşen bileşen hesaplayın.
- Thinker içindeki görüntü, ses ve metin genelinde TMRoPE'nin zamana göre hizalanmış konum kodlamasını açıklayın.
- Üç gerçek zamanlı konuşma modelini adlandırın: yarı çift yönlü, sıra alma, tam çift yönlü.

## Sorun

Gerçek zamanlı bir sesli asistanın çok hızlı bir şekilde yapması gerekir:

1. Kullanıcıyı dinleyin. Gerçek zamanlı konuşma tokenizasyonu, konuşmanın ne zaman bittiğini bilmek için ses etkinliği algılama (VAD).
2. İsteğe bağlı olarak bkz. 2-4 FPS'de kamera girişi, sesin yanı sıra Thinker'a aktarıldı.
3. Düşünün. Konuşma geçmişine dayalı bir yanıt oluşturun.
4. Konuşun. Ses token'lerini sentezleyin, dalga formunun kodunu çözün, kullanıcının hoparlörlerine aktarın.

Her adım gecikmeyi artırır. Konuşma hissi, toplam gidiş-dönüş süresinin < 500 ms olmasını gerektirir; bunun altında kullanıcı gecikmeyi fark etmez. GPT-4o ~250ms olduğunu iddia ediyor. Moshi ~160ms. Qwen2.5-Çoklu ~350-500ms.

Her bileşenin akış sağlaması gerekir. Hiçbir şey "her şeyi topla, sonra kodunu çöz" olamaz.

## Konsept

### Düşünen ve Konuşan

Qwen2.5-Omni'nin ayrıştırması:

- Düşünür: 7B-80B metin üreten bir transformer. Aralıklı metin + resim + ses token'leri tüketir. Ne söyleneceğini temsil eden token metnini çıkarır.
- Konuşmacı: Konuşma üreten daha küçük bir transformer (200M-1B). Düşünür'ün metin çıktısı token'ları artı son konuşma bağlamı token'ları tüketir. Ayrık konuşma token'lerin (artık-VQ indeksleri) çıktısını verir.
- Konuşma kod çözücü: konuşma token'larını gerçek zamanlı olarak ses örneklerine alan bir akış dalga biçimi kod çözücü (SNAC, MoVQGAN ailesi).

Ayrılık önemli. Düşünürün iyi akıl yürütme için büyük olması gerekir. Konuşmacı küçük olabilir çünkü işi yereldir; metni konuşmaya dönüştürür tokens. Daha Büyük Konuşan daha anlamlı değildir; daha yavaş.

Her ikisini de paralel olarak çalıştırmak:

1. Düşünür token t_i metnini yayınlar.
2. Konuşmacı t_i'yi (akış yoluyla) tüketir ve tokens s_i, s_{i+1}, ..., s_{i+k} konuşmasını yayar.
3. Konuşma kod çözücü, konuşma token'larını geldikleri anda tüketir ve ses örnekleri yayar.
4. Düşünür token t_{i+3} mesajına ulaştığında Talker zaten t_0..t_{i+2} için ses akışını gerçekleştirmiştir.

### TMRoPE — zaman ayarlı çok modlu konumlar

Thinker'ın görüntü çerçevelerini (örneğin 4 FPS'ye ulaşan), ses çerçevelerini (saniyede 50 kareye ulaşan) ve konuşma geçmişindeki metni entegre etmesi gerekiyor. Saf bir sıralama sırası (tüm görüntüler, ardından tüm sesler, ardından metin) zamansal hizalamayı kaybeder.

TMRoPE her token'ye mutlak zaman damgaları atar. Vizyon token t=2,3s'de. Ses token, t=2,32s. Kullanıcıdan t=2,35s'de "dur" mesajı alın token. RoPE dikkati zaman damgasına göre yönlendirir; model bunları zamansal olarak eşzamanlı olarak görüyor.

Bu, "merhaba derken el salladı"nın işe yarayacağı altyapıdır; model, video çerçevesini ve sesi aynı kavramsal anda görür.

### Akışlı konuşma sentezi

Konuşma token'lar yayınlanmalıdır. Mini-Omni (Xie ve Wu, 2024) "dil modellerinin akışta düşünürken duyabildiğini, konuşabildiğini" tanıttı: Düşünen çıktı token'lar ve Konuşan çıktı token'ler aynı sırayla serpiştirilir. Düşünür bir sonraki metni token yazdığı anda konuşmacı ateşlenir. Parti sınırı yok.

Moshi (Défossez ve diğerleri, Ekim 2024) en hızlı açık uygulamadır. Tek bir A100'de 160 ms TTFAB. Mimari: düşünme akışını konuşma akışından ayıran bir "iç monolog" ile, alternatif konumlarda metin ve konuşma token'ler yayan tek bir 7B transformer. Bu, dikkatli bir eğitimle etkili bir şekilde Thinker + Talker'ın tek bir modelde birleştirilmesidir.

### VAD ve sıra alma

Ses etkinliği algılama giriş tarafında çalışır. İki desen:

- Yarı çift yönlü: kullanıcı konuşur, model dinler. Model konuşur, kullanıcı dinler. VAD sessizlik algılama (~200 ms) yoluyla geçişi temizleyin.
- Tam çift yönlü: her ikisi de aynı anda konuşabilir. Model geri kanallık yapabilir ("hı-hı") veya kesintiye uğrayabilir. Çok daha zor. Moshi bunu destekliyor.

Qwen2.5-Omni, varsayılan olarak, sessizlik eşiği aracılığıyla sıra alma özelliğiyle yarı çift yönlü desteği destekler. Tam çift yönlü, uygulama katmanı işlemeyi gerektirir.

### Qwen3-Omni (Kasım 2025)

Halefi. Qwen3-80B Düşünür, daha büyük Konuşmacı, geliştirilmiş TMRoPE-v2. Gecikme süresi GPT-4o'nun 250ms'sine yakın. Ağırlıkları açın. BenchmarkOmniBench'te Gemini 2.0 Live ile rekabet halinde.

### Üretim gecikme bütçesi

Tipik bir akış etkileşimi için:

- Mikrofon -> ses tokens: 40-80ms.
- Ön doldurma (prompt + geçmiş): 7B'de 100-200 ms, 70B'de çok daha fazlası.
- İlk Düşünür metni token: 40ms.
- Konuşmacı ilk metni token işler: 20 ms.
- İlk konuşmanın token kaydedilmesi: 40 ms.
- Artık-VQ kod çözme: 30 ms.
- Konuşma dalga biçimi kod çözme: 50-80 ms.

Toplam TTFAB: 7B'de 320-510 ms, 70B'de 600-900 ms. Sınır kalitesi genellikle 70B+ anlamına gelir; dolayısıyla sınır gecikme boşluğu.

### Token-oranlı matematik

50 Hz temel konuşma tokens ile 16kHz konuşmada, çıkışın saniyesi başına 50 konuşma tokens'ye ihtiyacınız vardır. Konuşmacının yetişmek için ≥50 tok/s yayması gerekir. Bir H100'de 30-80 tok/s'lik tipik bir LLM veriminde, küçük (200-300M) Konuşmacı yeterince hızlıdır; 7B Talker geride kalacaktır.

"Sadece ana modeli kullanmak" yerine küçük özel Konuşmacı modellerinin mevcut olmasının nedeni budur.

## Kullan onu

`code/main.py`:

- Sahte token-emisyon oranlarıyla Düşünen-Konuşan pipelinenı simüle eder.
- Yapılandırılabilir model boyutları ve mikrofon örnekleme hızları için TTFAB'yi hesaplar.
- VAD sessizlik eşiğiyle yarı çift yönlü dönüş almayı gösterir.

## Gönderin

Bu ders `outputs/skill-omni-streaming-budget.md` üretir. Gerçek zamanlı bir ses ürününün hedef TTFAB'si ve özellik seti (görüntü girişi, iki dilli, tam çift yönlü) göz önüne alındığında, Qwen2.5-Omni, Qwen3-Omni, Moshi veya Mini-Omni'yi seçer ve Düşünen/Konuşan'ı boyutlandırır.

## Egzersizler

1. Hedef TTFAB'niz 300 ms'dir. 7B Thinker ve 300M Talker'da her bileşenin gecikme süresini yazın.

2. Qwen2.5-Omni TMRoPE'yi kullanır. Kullanıcının t=1s'de konuşmaya başladığı ve kameranın t=1,2s'de bir hareketi yakaladığı bir prompt için modelin ne gördüğünü açıklayın.

3. Tam çift yönlü destek, modelin dinlerken ses çıkarmasını gerektirir. Bunu öğreten bir eğitim veri formatı önerin.

4. Moshi'nin makalesini okuyun 4. Bölüm. "İç monolog" ayrımını ve bunun Düşünen-Konuşan ayrımından neden kaçındığını açıklayın.

5. Çıkış bütçesini hesaplayın: Bir Konuşmacının 50 temel katman tokens/sn hızla 16kHz konuşmaya ayak uydurabilmesi için ne kadar hızlı tokens yayması gerekir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Düşünür | "Akıl yürüten beyin" | Ne söyleneceğini üreten büyük metin üreten transformer |
| Konuşmacı | "Konuşma üreten ağız" | Düşünür'ün metninden ayrı konuşmalar token'lar üreten küçük transformer |
| TTFAB | "Gecikme bütçesi" | İlk ses baytına kadar geçen süre: kullanıcı konuşmasının sonundan ilk ses örnek çıkışına kadar |
| TMRoPE | "Zaman ayarlı RoPE" | Görüntü, ses ve metin genelinde mutlak zaman damgalarını kullanarak kodlamayı konumlandırın |
| Yarı çift yönlü | "Sıra alma" | Kullanıcı ve model alternatifi; VAD sessizliği kullanıcı tarafından yapılan işlemleri algılar |
| Tam çift yönlü | "Eşzamanlı" | Model aynı anda konuşup dinleyebilir; arka kanal özellikli |
| İç monolog | "Moshi ayrılığı" | Düşünme akışının ve konuşma akışının birbirine karıştığı tek modelli tasarım |

## Daha Fazla Okuma

- [Xu ve ark. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Takımı — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie ve Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez ve ark. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng ve ark. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
