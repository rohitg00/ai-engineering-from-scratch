# Motorun İç Parçalarına Hizmet Verme — PagedAttention, Sürekli Gruplama, Parçalı Önceden Doldurma

> Modern servis motoru verimi tek bir hileye değil, üç bileşik varsayılana dayanır. PagedAttention her zaman açıktır. Sürekli toplu işlem, kod çözme yinelemeleri arasında etkin toplu iş içine yeni istekler enjekte eder. Parçalı önceden doldurulmuş dilimler uzun promptsn, böylece kod çözme token'lar asla aç kalmaz. Üçünü de açın ve bir H100 SXM5 üzerindeki Llama 3.3 70B FP8, 128 eş zamanlı hızda 2.200-2.400 tok/s hıza ulaşıyor; bu, vLLM'nin kendi varsayılan değerinin kabaca %25 üzerinde ve saf bir PyTorch döngüsünün 3-4 katı kadar. Bu ders, vLLM'nin (üç tekniğin tamamı için referans motoru) zamanlayıcısını ve dikkat çekirdeğini şematize edebileceğiniz bir düzeyde okur ve vLLM'nin yaptığı gibi ön doldurmayı planlayan ve kodunu çözen `code/main.py` 'deki oyuncak sürekli gruplayıcıyla sona erer.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak sürekli toplu işlem planlayıcısı)
**Önkoşullar:** Aşama 17 · 01 (Model Sunumu), Aşama 11 (LLM Mühendisliği)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Bir KV önbellek ayırıcısı olarak PagedAttention'ı açıklayın: bloklar, blok tabloları ve üretim yükünde parçalanmanın neden %4'ün altında kaldığı.
- Yineleme seviyesinde sürekli gruplama diyagramı: bitmiş dizilerin partiden nasıl ayrıldığı ve yenilerinin boşalmadan nasıl katıldığı.
- Parçalı ön doldurmayı tek bir cümleyle açıklayın ve koruduğu gecikme ölçüsünü adlandırın (ipucu: bu TTFT kuyruğudur, ortalama aktarım hızı değil).
- Her optimizasyonu aynı anda mümkün kılan ekipleri rahatsız eden 2026 vLLM v0.18.0 sonucunu adlandırın.

## Sorun

Saf bir PyTorch hizmet döngüsü, her seferinde bir isteği çalıştırır: tokenize, önceden doldurma, EOS'a kadar kodu çözme, geri dönüş. Bir kullanıcıda bu işe yarar. Yüzde ise sabırlı insanlardan oluşan bir kuyruk var. Açıkça görülen düzeltme - statik gruplama - her isteği penceredeki en uzun prompt'a doldurur, her kod çözmeyi beklenen en uzun çıktıya doldurur ve tüm partiyi en yavaş sırada durdurur. Hiç kullanmadığınız dolgu için para ödersiniz ve hızlı istekler, yavaş istekleri bekler.

vLLM aynı anda üç sorunu çözer. PagedAttention, klasik bitişik ayırmanın yaptığı gibi KV önbellek parçalanmasının GPU belleğinin %60-80'ini tüketmesini engeller. Sürekli toplu işlem, her kod çözme yinelemesi arasında isteklerin toplu işlere katılmasına ve toplu işten ayrılmasına olanak tanır, böylece toplu iş her zaman gerçek çalışmalarla dolu olur. Parçalanmış önceden doldurma, 32k-token prompt'u kod çözmeyle birlikte eklenen ~512-token dilime böler, böylece uzun bir prompt, GPU'daki her kod çözme token'ı dondurmaz.

2026 üretim varsayılanının üçü de açık. Her birinin ne yaptığını anlamalısınız çünkü arıza modlarının tümü modelde değil, zamanlayıcıdadır.

## Konsept

### Sanal bellek sistemi olarak PagedAttention

Bir KV önbelleği dizi başına `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element` 'tır. 8192 tokens'deki Llama 3.3 70B için bu, BF16'daki dizi başına kabaca 1,25 GB'dir. Her istek için 8192 yuvayı önceden ayırırsanız ancak ortalama istek yalnızca 1500 tokens kullanırsa, ayırdığınız HBM'nin kabaca %82'sini boşa harcarsınız. Klasik gruplama bu israfı karşılar.

PagedAttention, fikri işletim sistemi sanal belleğinden ödünç alıyor. KV önbelleği dizi başına bitişik değildir. Sabit boyutlu bloklar halinde tahsis edilir (varsayılan 16 tokens). Her dizi, mantıksal token konumlarını fiziksel blok kimlikleriyle eşleştiren bir blok tablosuna sahiptir. Bir dizi tahsis edilen blokları aştığında bir blok daha eklenir. Bittiğinde blokları havuza geri döner.

Parçalanma %60-80'den (klasik) %4'ün altına (PagedAttention) düşer. PagedAttention'ı bir bayrakla etkinleştirmezsiniz; bu, vLLM'nin gönderdiği tek ayırıcıdır. Düğme `--gpu-memory-utilization` 'dır (varsayılan 0,9), bu, vLLM'ye ağırlıklar ve aktivasyonlar yüklendikten sonra KV blokları için ne kadar HBM rezerve edilmesi gerektiğini bildirir.

### Yineleme düzeyinde sürekli toplu işlem

Eski "dinamik gruplama", bir partiyi doldurmak için bir pencerenin (örneğin 10 ms) olmasını bekledi, ardından her sekans bitene kadar ön doldurma + kod çözme + kod çözme + kod çözme komutunu çalıştırdı. Hızlı diziler erkenden bırakıldı ve boşta kaldı, GPU ise yavaş olanları tamamladı.

Sürekli gruplama, her kod çözme adımı arasında çalışır. Çalışan diziler kümesini `RUNNING` listesi olarak adlandırın. Her yinelemede:

1. `RUNNING` 'da EOS'a veya max_tokens'ye ulaşan herhangi bir dizi kaldırılır.
2. Zamanlayıcı bekleme kuyruğuna bakar. Boş KV blokları varsa yeni dizileri kabul eder (önceden doldurulmuş veya devam ettirilmiş).
3. İleri geçiş, dizi başına yeni bir token yayarak, şu anda `RUNNING`'da ne varsa onu çalıştırır.

Toplu iş boyutu hiçbir zaman sabit bir sayıya kadar doldurulmaz. Çıktılarında farklı konumlardaki diziler ileriye doğru kaynaşmış bir tanesini paylaşır. 2026 vLLM'de buna `V1 scheduler` adı verilir. Anahtar değişmez: zamanlayıcı, istek başına bir kez değil, kod çözme yinelemesi başına bir kez çalışır.

### Parçalı önceden doldurma TTFT kuyruğunu korur

Önceden doldurma hesaplamaya bağlıdır. Llama 3.3 70B'deki bir 32k-token prompt, bir H100'de ~800 ms saf ön doldurma gerektirir. Ön doldurma çalışırken, toplu beklemedeki her diğer dizi için token'larin kodunu çözün. Bir sunum döngüsünde, bir uzun prompt'un ilk-token gecikmesi (TTFT), düzinelerce diğer kullanıcı için ara-token gecikme (ITL) kesintisi haline gelir.

Parçalanmış önceden doldurma, önceden doldurmayı sabit boyutlu parçalara (varsayılan 512 tokens) böler ve her parçayı bir birim olarak planlar. Parçalar arasında zamanlayıcı kod çözme dizilerini bir token ilerletebilir. Çok daha düşük kod çözme süresi titreşimi karşılığında küçük bir mutlak ön doldurma gecikme vuruşunu (parça başına birkaç ms) değiştirirsiniz. Karışık yük altında P99 ITL, yayınlanan benchmarks'de ~50 ms'den ~15 ms'ye düşer.

### Üç varsayılan etkileşimde bulunur

Her üç özellik de birbirini varsayar. PagedAttention, planlayıcıya işlem yapabileceği ayrıntılı bir KV kaynağı sağlar. Sürekli toplu işleme, bu ince taneli kaynağa ihtiyaç duyar; dolayısıyla yeni bir sıranın kabul edilmesi, genel bir yeniden karıştırmayı zorlamaz. Parçalı önceden doldurma, zamanlayıcının aynı `RUNNING` listesinde verdiği bir karardır; ayrı bir sistem değil, başka bir zamanlayıcı politikasıdır.

Her bayrağı bilmenize gerek yok. Zamanlayıcının neyi optimize ettiğini bilmeniz gerekir: KV blok bütçesi altında iyi girdi, parçalı ön dolum dilimlemeye tabidir.

### 2026 v0.18.0 yakaladım

vLLM v0.18.0 'de, `--enable-chunked-prefill` 'yi taslak model spekülatif kod çözme (`--speculative-model`) ile birleştiremezsiniz. Belgelenen istisna, V1 zamanlayıcıdaki N-gram GPU spekülatif kod çözmedir. Sürüm notlarını okumadan her bayrağı açan ekipler, başlangıçta yumuşak bir gerileme değil, çalışma zamanı hatası alıyor. Spekülatif kazancınız yığınlanmış ön doldurmayı etkinleştirmeye değerse, seçimi tekrar ziyaret edin - 2026'daki doğru cevap genellikle parçalanmış ön doldurma olmadan EAGLE-3'tür, taslak model artı derlenmeyen parçalanmış ön doldurma değil.

### Hatırlamanız gereken sayılar

- Llama 3.3 70B FP8, H100 SXM5, 128 eşzamanlı, üçü de açık: 2.200-2.400 tok/s.
- Aynı model, varsayılan vLLM (parçalanmış önceden doldurma yok): ~1.800 tok/s.
- Aynı model, saf PyTorch ileri döngüsü: ~600 tok/s.
- Üretim yükünde PagedAttention kapsamında KV parçalanma atığı: <%4.
- P99 ITL karışık yük altında: ~15 ms, parçalanmış önceden doldurmayla, ~50 ms olmadan.

### Zamanlayıcı neye benziyor

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py` , stdlib Python'daki sahte token sayımları ve sahte ileri gecikme süresiyle tam olarak bu döngüdür. Bunu çalıştırmak, parçalı ön doldurmanın, uzun bir ön doldurma sırasında kod çözme dizilerini nasıl canlı tuttuğunu gösterir.

```figure
tensor-parallel
```

## Use It — Hazır Araçla Uygula

`code/main.py` , değiştirilebilir özelliklere sahip vLLM tarzı bir zamanlayıcıyı simüle eder. Görmek için çalıştırın:

- `NAIVE` modu: aynı anda bir istek, toplu işlem yok.
- `STATIC` modu: tuşlayın ve bekleyin, klasik toplu işlem.
- `CONTINUOUS` modu: yineleme düzeyinde kabul ve serbest bırakma.
- `CONTINUOUS + CHUNKED` modu: kod çözme ile serpiştirilmiş dilimleri önceden doldurun.

Çıkış, toplam verimi (sanal saniye başına tokens), TTFT ortalamasını ve P99 ITL'yi gösterir. Karışık trafikte `CONTINUOUS + CHUNKED` satırı baskın olmalıdır.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-vllm-scheduler-reader.md` üretir. Bir sunum yapılandırması (toplu iş boyutu, KV bellek kullanımı, parçalanmış önceden doldurma boyutu, spekülatif yapılandırma) göz önüne alındığında, üç varsayılandan hangisinin darboğaz oluşturduğunu ve neyin ayarlanması gerektiğini belirten bir zamanlayıcı teşhisi üretir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Kısa ve uzun isteklerin karışık olduğu bir iş yükünde `STATIC` ile `CONTINUOUS` 'yi karşılaştırın. Verim açığı nereden geliyor: ön doldurma verimliliği, kod çözme verimliliği veya kuyruk gecikmesi?
2. `--max-num-batched-tokens` eklemek için oyuncak zamanlayıcıyı değiştirin. Llama 3.3 70B FP8 çalıştıran bir H100 için doğru değer nedir? (İpucu: ham HBM'nin değil, KV blok boyutunun ve boş blok sayısının bir fonksiyonudur.)
3. vLLM v0.18.0 sürüm notlarını yeniden okuyun. Hangi bayrak kombinasyonları birbirini dışlar? Onları listeleyin.
4. (a) maksimum 8192'de istek başına bitişik tahsis, (b) 16-token bloklu PagedAttention altında, ortalama 1.500 çıkış tokens, std 600 tokens ile 1.000 isteğin izi için KV önbellek parçalanma israfını hesaplayın.
5. Parçalanmış önceden doldurmanın neden P99 ITL'ye yardımcı olduğunu ancak tek başına verim sağlamadığını bir paragrafta açıklayın. Verimlilik kazanımı pratikte nereden geliyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| PagedDikkat | "KV numarası" | KV önbellek için sabit boyutlu blok ayırıcı; parçalanma <%4 |
| Blok tablosu | "sayfa tablosu" | Mantıksal token konumundan fiziksel KV bloğuna dizi başına harita |
| Sürekli gruplama | "dinamik toplu işlem, ancak doğru" | Her kod çözme yinelemesinde alınan kabul/bırakma kararları |
| Parçalanmış ön dolum | "önceden doldurma bölme" | Uzun ön dolguyu, kod çözme ile serpiştirilmiş 512-token dilime bölün |
| TTFT | "ilk token kez" | Önceden doldurma + kuyruk + ağ; uzun promptsn süren önceden doldurmanın hakimiyetinde |
| ITL | "inter-token gecikme" | Ardışık kod çözme tokens arasındaki süre; parti büyüklüğü hakimdir |
| İyi girdi | "SLO'yu karşılayan verim" | Tokens/sn; her istek hâlâ TTFT ve ITL hedeflerine ulaşıyor |
| V1 zamanlayıcı | "yeni planlayıcı" | vLLM'nin 2026 zamanlayıcısı; N-gram spesifikasyon kod çözme, parçalanmış önceden doldurmayla uyumlu yoldur |
| `--gpu-memory-utilization` | "bellek düğmesi" | Ağırlıklar ve aktivasyonlardan sonra KV blokları için ayrılan HBM oranı |

## Daha Fazla Okuma

- [vLLM belgeleri — Spekülatif Kod Çözme](https://docs.vllm.ai/en/latest/features/spec_decode/) — parçalanmış önceden doldurma ve spekülatif kod çözme uyumluluğuna ilişkin resmi kaynak.
- [vLLM Sürüm Notları (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 sürüm temposu ve sürüme özgü davranış.
- [vLLM Blogu — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — tahsis edici hakkında nasıl düşünülmesi gerektiğini hâlâ tanımlayan orijinal yazı.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — parçalanma analizi ve zamanlayıcı tasarımı.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — alev grafikleriyle ayrıntılı V1 zamanlayıcı kılavuzu.
