# Servis Motor İçleri  PagedAtention, Sürekli Batching, parçalanmış Prefill

> Modern servis motorlarının üretimi üç komplo etkisiyle yapılır, tek bir numara değil. PagedAttention her zaman açık. Sürekli serileme, yeni istekleri çözme iterasyonları arasında aktif seriye enjekte eder. Parça dolandırıcılık parçaları uzun ipuçları böylece kodlama tokenleri asla açlıktan ölmez. Üçünü de açarsanız, bir H100 SXM5'de Llama 3.3 70B FP8'in 128 eşzamanlı 'de 2.200-2.400 tok/s'i harekete geçiriyor. Bu ders, vLLM'nin programlayıcı ve dikkat çekirdeğini okuyor  üç tekniğin referans motorunu  bir düzeyde çizim yapabileceğiniz bir seviyede ve bir oyuncak sürekli batcher ile sona erer `code/main.py`Programlar vLLM'nin yaptığı gibi önceden doldurulur ve çözülür.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- PagedAttention'u KV önbelleği tahsiscisi olarak açıklayın: bloklar, blok tabloları ve neden parçalanma üretim yükünde% 4'ten düşük kalır.
- İterasyon düzeyinde sürekli serileme diyalogu: bitmiş dizilerin seriyi nasıl terk ettiğini ve yeni dizilerin boşaltılmadan nasıl birleştiğini gösterir.
- Bir cümle ve isimde parçalanmış prefill'i tanımlayın ve hangi gecikme metrikini korur (söyleyin: aynı anda decode edilenlerin ITL kuyrukudur, geçiş anlamına gelmez).
- Her optimizasyonu bir anda etkinleştirmeden önce, vLLM özellik kombinasyonunu sürümünüz için uyumluluk matrisine karşı kontrol edin.

## Sorun

Saf bir PyTorch servis döngüsü bir seferde bir istek çalışır: tokenize, prefill, EOS'a kadar dekode, geri. Bir kullanıcı için bu işe yarıyor. Yüzde, sabırlı insanların bir kuyrukları. Açıkça görülen düzeltme  statik parti  her talebi penceredeki en uzun çağrısına, her dekodunu en uzun beklenen çıkışa kapatır ve tüm partiyi en yavaş dizide durdurur. Hiç kullanmadığın dolgu için para ödüyorsun ve hızlı talepler yavaş talepler için bekliyor.

VLLM üç sorunu bir anda çözer. PagedAttention, KV önbelleğinin parçalanmasını, klasik bir arada tahsis edilme gibi GPU belleğinin %60-80'ini tüketmekten alıkoyar. Sürekli serileme, isteklerin her dekodlama iterasyonu arasında bir araya gelmesine ve partiyi terk etmesine izin verir, bu nedenle parti her zaman gerçek işle dolu olur. Parça dolandırıcılığı, 32k işaretli bir işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli işaretli olarak bölgeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeyeye

2026 üretim standartı üçü de çalıştırılmış. Her birinin ne yaptığını anlamalısınız çünkü başarısızlık modları tümüyle planlamacıda, modelde değil.

## Anlaşım

### PagedAttention sanal bellek sistemi olarak

KV önbelleği .`num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`Llama 3.3 70B için 8192 token, yani BF16'da yaklaşık 1.25 GB bir dizi. Eğer her talebe 8192 slot önceden rezervasyon yaparsanız ancak ortalama talebe sadece 1500 token kullanırsanız, rezervasyon yaptığınız HBM'nin yaklaşık %82'ini harcıyorsunuz. Klasik parti bu harcamaları öder.

PagedAttention, bu fikri OS sanal bellekinden ödünç alır. KV önbelleği dizi başına bitişik değildir. Sıkı boyutlu bloklara (öntemli 16 token) tahsis edilir. Her dizi, mantıklı token konumlarını fiziksel blok kimliklerine harcayacak bir blok tablosuna sahiptir. Bir dizi tahsis edilen blokların ötesinde büyüdüğünde, bir blok daha eklenir. Bitirdiğinde, blokları havuza geri döner.

Fragmentasyon %60-80%'den (klasik) %4'ten (PagedAttention) aşağıya düşüyor.`--gpu-memory-utilization`(devay 0.9), vLLM'ye yükleme ağırlıkları ve etkinleştirmelerinden sonra KV blokları için ne kadar HBM rezervasyonu yapması gerektiğini söyler.

### Sürekli iterasyon düzeyinde serileme

Eski "dinamik parti" bir parti doldurmak için bir pencereyi (deyelim 10 ms) bekledi, sonra her dizisi bitene kadar önceden doldur + dekode + dekode + dekode çalıştı.

Her dekodlama aşamasında sürekli seri çalışması yürütülür.`RUNNING`listesi. her iterasyonda:

1. Herhangi bir sırada .`RUNNING`EOS'u vurmak veya max_tokens kaldırılır.
2. Programlayıcı bekleme sırasına bakıyor. Eğer ücretsiz KV blokları varsa, yeni diziler kabul eder (öncelme veya yeniden başlatılır).
3. Ön geçit şimdi ne varsa üzerinde geçer .`RUNNING`, her sekvense yeni bir token gönderir.

İsteğe bağlı olarak, bir seri seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, bir seri olarak, 2026 vLLM olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir dizi olarak, bir olarak, bir olarak, bir olarak,`V1 scheduler`Anahtar değişmezliği: programlayıcı, her dekodlama iterasyonunda bir kez çalıştırılır, istek için değil.

### Parçalama prefill, ITL kuyrukunu korur.

Prefill hesaplama bağlıdır. Llama 3.3 70B'de 32k-token istek bir H100'de ~800 ms saf prefill alır. Prefill çalışırken, seri bekleyen diğer her dizi için tokenleri çözün. Bir servis döngüsünde, bir uzun istek için ilk token gecikmesi (TTFT) onlarca diğer kullanıcı için inter-token gecikme (ITL) blip olur.

Çüklü prefill, sabit boyutlu parçalara bölünür (devay 512 token) ve her parçayı bir birim olarak programlar. Çükler arasında programlayıcı dekod dizilerini bir token ile ileriye atabilir. Yayınlanan referanslarda çok daha düşük dekod zaman jitter için küçük mutlak prefill latency hit (bir parça başına birkaç ms) değiştirirsiniz.

### Üç defalarca etkileşime giren

Tüm üç özellik birbirini kabul eder. PagedAttention programcıya ticaret için ince tohumlu bir KV kaynağı verir. Sürekli serileme bu ince tohumlu kaynağa ihtiyaç duyar, bu nedenle yeni bir dizini kabul etmek küresel bir yeniden düzenleme zorlamaz.`RUNNING`list  bu bir programcı politika daha, ayrı bir sistem değil.

Her bayrağı bilmenize gerek yok.Sedülerin neyi optimize ettiğini bilmelisiniz: KV blok bütçesine uygun, parçalara ayırılmış prefill slicing'e tabi.

### Uygunluk matrisini kontrol edin

Her özellik kombinasyonunu vLLM sürümünüz için uyumluluk matrisine karşı kontrol edin, çünkü tümünü bir anda etkinleştirmeden önce, yayınlar arasında değişiklikler yapılır. V0.18.0'da özellik matrisi spekülasyonsal çözümü parçalara ayık prefill ve prefix önbelleği ile uyumlu olarak işaretler ve spekülasyonsal çözümü sayfasında bilinen iki uyumsuzluk listesi bulunur: v0.15.0'den yoluyla boru paralelliği ve v0.10.0'dan yoluyla taslak model spekülasyonu. Özetleme yönteminin kendisi için, 2026'da belirlenmiş durum genellikle EAGLE-3 (`"method": "eagle3"`), 17 · 05. aşamada kapsamlıdır.

### Hatırlamalısın numaralar

- Llama 3.3 70B FP8, H100 SXM5, 128 eşzamanlı, üçü de: 2.200-2.400 tok/s.
- Aynı model, varsayılan vLLM (çıkılmış ön doldurma yok): ~1,800 tok/s.
- Aynı model, saf PyTorch ileri döngüsü: ~600 tok/s.
- KV parçalanması atıkları: %4
- Karışık yük altında P99 ITL: ~ 15 ms parçalı prefill ile, ~ 50 ms olmadan.

### Programcı nasıl görünüyor?

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

`code/main.py`Stdlib Python'da sahte token sayıları ve sahte ileri gecikme ile aynı döngüdür.

```figure
tensor-parallel
```

## Kullan

`code/main.py`vLLM tarzı bir programcı simüle eder.

- `NAIVE`Mod: Tek seferde bir talep, serileme yapılmıyor.
- `STATIC`Mod: bekleme ve bekleme, klasik parti.
- `CONTINUOUS`Mod: İterasyon düzeyinde kabul ve serbest bırakma.
- `CONTINUOUS + CHUNKED`Mod: Decode ile birbirine karışmış prefill parçalar.

Çıktı toplam geçiş (virtual saniyede tokenler), TTFT ortalaması ve P99 ITL gösterir.`CONTINUOUS + CHUNKED`sıra karışık trafikte baskın olmalıdır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-vllm-scheduler-reader.md`. Bir servis yapılandırmasını (batch boyutu, KV bellek kullanımı, parçalanmış prefill boyutu, spekülatör yapılandırması) göz önüne alındığında, üç standarttan hangisinin şişek boynuzlu olduğunu ve hangi ayarlanacağını belirleyen bir planlamacı teşhisini üretir.

## Egzersizler

1. Çık .`code/main.py`- Ben de .`STATIC`- ...`CONTINUOUS` Prefill verimliliği, dekode verimliliği veya kuyruğu gecikmeliliği ile birlikte, geçiş boşluğu nereden geliyor?
2. Eklemek için oyuncak programlayıcısını değiştir `--max-num-batched-tokens`Llama 3.3 70B FP8 çalışan bir H100 için doğru değer nedir? (İpucu: KV blok boyutunun ve serbest blokların sayısının, ham HBM değil, fonksiyonu.)
3. VLLM v0.18.0'un açıklama notlarını tekrar okuyun. Hangi bayrak kombinasyonları karşılıklı dışı?
4. KV önbelleği parçalanma atıklarını, ortalama 1.500 çıkış tokeni, std 600 tokeni ile 1000 talebinin izini hesaplayın, a) talep başına 8192 maksimum, b) 16 token bloklu PagedAttention altında.
5. Bir paragrafda, parçalanmış prefill'in neden P99 ITL'ye yardımcı olduğunu, ancak özelleştirilmiş olarak üretimi yapmadığını açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Daha Fazla Okumak

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) parçalı prefill ve spekülatör dekodlama uyumluluğu hakkında resmi kaynak.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026'da yayın cadence ve sürüm spesifik davranış.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) hala tahsisci hakkında nasıl düşünüleceğini belirleyen orijinal yazısı.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) parçalanma analizi ve programlayıcı tasarımı.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) V1 programlayıcısı, alev grafikleriyle ayrıntılı bir şekilde yürüyüşe devam ediyor.
