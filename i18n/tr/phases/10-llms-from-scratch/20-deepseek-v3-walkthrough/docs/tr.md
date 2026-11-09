# DeepSeek-V3 Arsitektur Yürüyüşü

> 10 · Ders 14 her açık model dönerken altı mimari düğmeye isim verdi. DeepSeek-V3 (Aralık 2024, toplam 671B parametreleri, 37B aktif) altı tane de döndürür ve dört tane daha ekler: Çok Başlı Latent Dikkat, yardımcı kayıpsız yük dengeleme, Çok Token Tahminleri ve DualPipe eğitim. Bu ders DeepSeek-V3'ün mimarisini üstten aşağı okuyor ve yayınlanan yapılandırmadan her parametrelerin sayısını çıkarıyor. Sonuna kadar 671B/37B oranının neden doğru bahis olduğunu ve MLA + MoE'nin birlikte sınırda tek başına neden birbiriyle dövdüğünü açıklayabilirsiniz.

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- DeepSeek-V3 yapılandırmasını üstten aşağı okuyun ve her alanı altı GPT-2 düğmesi ve dört DeepSeek özel eklemle açıklayın.
- Toplam parametreler sayısını (671B), aktif parametreler sayısını (37B) ve her birine katkıda bulunan bileşenleri çıkarın.
- MLA'nın KV önbelleği izini 128k bağlamda hesaplayın ve GQA ile aynı aktif-param yoğun bir modelin neyi ödeyeceğini karşılaştırın.
- DeepSeek'e özgü dört yeniliği (MLA, MTP, yardımcı kayıpsız yönlendirme, DualPipe) ve mimarlık/öğretim yığınının her birinin hangi kısmını hedeflediğini belirtin.

## Sorun

DeepSeek-V3, mimarisi Llama ailesinden anlamlı bir şekilde farklı olan ilk açık sınır modeli. Llama 3 405B, "GPT-2 altı düğmeyle döndürülmüş". DeepSeek-V3, GPT-2'dir. Llama 3 yapılandırmasını okumak DeepSeek yapılandırmasını okumak için bir ısınma, ama derin yapısı  dikkat blokunun şekli, yönlendirme mantığı, eğitim zaman amacı  ayrı bir yürüyüş gerektirmek için yeterince farklıdır.

DeepSeek-V3'ün açık ağırlıklar serbest bırakılması açık modellerde "sıñır yeteneği" ne anlama geldiğini değiştirdi. Mimarlık, birçok 2026 eğitim koşusunun kopyaladığı bir plandır.

## Anlaşım

### Değişmeyen çekirdek, yine

DeepSeek-V3 hala autoregressive. Hâlâ dekoder bloklarını yığar. Her blokta hala dikkat artı MLP artı iki RMSNorms vardır. Hâlâ MLP'de SwiGLU kullanır. Hâlâ RoPE kullanır. Ön norm. Ağırlık bağlı gömülmeler. Her Llama veya Mistral ile aynı temel çizgi.

### Dönüş: GQA yerine MLA

10 · 14 aşamasından GQA'nın KV önbelleğini, K ve V'yi Q başlarının gruplarına bölüştürerek küçültdüğünü biliyorsunuz.`kv_lora_rank`KV önbelleği, sadece gizli 'yi depolar.

128k bağlamında, DeepSeek-V3 MLA ile (bir ortak gizli `c^{KV}`Bir katman başına bir token; K ve V her ikisi de sonraki matmul'e emlenebilen yukarı projeksiyonlar yoluyla bu gizliden çıkarılmıştır):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Bir hipotetik GQA temel çizgisi (Llama 3 70B şekli, 8 KV başı, başı 128) ödeyecektir:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA, Llama-3-70B tarzında 128k bağlamda GQA önbelleğinden 4 kat daha küçüktür.

Aradaki fark: MLA, dikkat hesaplama başına (baş başına) bir dekompresyon adımını ekler.

### Yol: Yardımcı kayıpsız yük dengeleme

MoE yönlendiricileri her bir token'ı hangi üst düzey uzmanlar işlediğini belirler. Saf bir yönlendiriciler çok fazla çalışmayı birkaç uzman üzerinde yoğunlaştırır ve diğerlerini boş bırakır. Standart düzeltme: yük dengesizliğini cezalandıran bir yardımcı kayıp terimini ekleyin. Bu çalışır ancak ana görev performansını hafifçe düşürür.

DeepSeek-V3 yardımcı kayıpsız bir şema tanıttı.`e`Aşırı yüklü, düşüştür.`bias_e`Eğer bu işlemi yaparsanız, daha fazla kayıp vermeyin.

Ana kayıp üzerindeki etkisi: ölçülebilir değil. MoE mimarisine etkisi: temizlik, ayarlanacak yardımcı kayıp hiperparametre yok.

### MTP: daha yoğun eğitim + ücretsiz çekim

10 · 18 aşamasından DeepSeek-V3'nin, simgeyi iki pozisyon önüne tahmin eden D=1 MTP modülü eklediğini biliyorsunuz. Sonuç olarak, eğitilmiş modül 80%+ kabul ile spekülasyonsal bir dekodeleme tasarı olarak yeniden kullanılır. Eğitim sırasında, her gizli durum D+1 = 2 hedeflerde denetlenir ve daha yoğun bir sinyal sağlar.

Parametre: 671B başının üstünde 14B. Genel maliyet: 2,1%.

### Eğitim: DualPipe

DualPipe'nin, DeepSeek-V3'ün 2.048-H800 ölçeğinde, 1F1B'nin boru hattı kabarcıklarına kaybettiği yaklaşık 245k GPU saatini geri kazanıyor.

### Konfig, alanlar halinde

İşte DeepSeek-V3 yapılandırması (sederletilmiş):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

Parse et .

- `hidden_size=7168`: yerleştirme boyutu.
- `num_hidden_layers=61`: toplam blok derinliği.
- `first_k_dense_layers=3`İlk 3 blok 18432 boyutlu yoğun bir MLP kullanır.
- `num_attention_heads=128`: 128 sorgu başlığı.
- `kv_lora_rank=512`K ve V bu gizli boyutlara kadar sıkıştırılır ve baş başına sıkıştırılır.
- `num_experts=256, num_experts_per_tok=8`Her bir MOE bloğunda 256 uzman var.
- `shared_experts=1`Bu, her bir token'ın güvenilir bir şey elde etmesini sağlayan "koyu bir zemin" olarak düşünün.
- `moe_intermediate_size=2048`Bu, her uzmanın gizli boyutunda olan MLP'den daha küçüktür çünkü 256 tane vardır.

### Parametre muhasebe

Tam hesaplamalar `code/main.py`Başlık:

- Ekleme: `vocab * hidden = 129280 * 7168 = ~0.93B`- Evet .
- İlk 3 yoğun blok: dikkat MLA ile (kalkülülatörün basitleştirilmiş sayısında blok başına ~84M) + yoğun SwiGLU MLP (`3 * 7168 * 18432 = ~396M`Bir blok başına) + normlar. Yaklaşık 1.4B toplam.
- 58 MOE blokları: MLA ile ilgilenme (~84M) + 256 yönlendirilmiş uzman (`3 * 7168 * 2048 = ~44M`Her bir uzmanı dahil olmak üzere blok başına yaklaşık 11.4B. 58 MoE blokları için yaklaşık 661B.
- MTP modülü: yayınlanan modül 14B. Hesap makinesi ~0.8B'nin yoğun bir stand-in kullanır.

Büyük toplam: hesap makinesi ana model için yayınlanan 671B'ye karşı ~664B'ye düşer. Hugging Face kontrol noktası 685B'dir çünkü 671B'nin üstüne 14B MTP modülü ekler. Geri kalan ~1% boşluk basitleştirmelerden gelir: hesap makinesi MLA'daki kopartılmış RoPE boyutlarını, bağlı olmayan çıkış başını ve birkaç küçük tenzorları atlar.

Önceki için aktif parametreler:

- Dikkat: Katman başına 84M * 61 = ~5.1B (tüm katmanlar ateşe giriyor).
- MLP aktif: ilk 3 katman yoğun (`3 * 396M = ~1.2B`), 58 MoE katmanı her biri aktif ve 8 yönlendirilmiş + 1 ortak uzman (`9 * 44M = ~396M`Bir katman başına toplam 23B.
- Ekleme + normlar: ~0.9B.
- Toplam aktif: ~30B'den hesap makinesi tarafından yayınlanan 37B'ye karşı. Çoğu boşluk dikkat: RoPE boyutları ve daha geniş sorgu ve anahtar başları ile tam MLA, basitleştirilmiş sayıdan daha büyüktür. MTP modülü 37B'ye doğru sayılmaz.

### 671B / 37B oranı

DeepSeek-V3 açık ağırlıklar gönderdi en nadir sınır MoE modelidir. Mixtral 8x7B oranında 13/47 (28%) çok daha yoğun. Llama 4 Maverick oranında 17B/400B (4.25%) karşılaştırılabilir. DeepSeek bahis: sınır ölçeğinde, daha düşük etkinlik oranı olan daha fazla uzman, aktif-FLOP başına daha iyi kalitede üretir.

### DeepSeek-V3'in oturduğu yer

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### Ardından: R1, V4

DeepSeek-R1 (2025) V3 omurgasında bir akıl yürütme-öğrenme koşusu. R1 aynı mimariyi kullanır.

DeepSeek-V4 (gelirse) MLA + MoE + MTP'yi koruyacak ve NSA'nın 10 · 17 aşamasından sonraki halefi olan DSA (DeepSeek Sparse Attention) ekleneceği bekleniyor.

```figure
moe-routing
```

## Kullan

`code/main.py`DeepSeek-V3'ün şekli için uzmanlaşmış parametre hesaplayıcıdır. Çalıştır, çıkışını kağıtın sayıları ile karşılaştır ve hipotetik variantlarda kullan (256 uzman vs. 512, üst 8 vs. üst-16, MLA sıra 512 vs. 1024).

Neye bakılır:

- Toplam parametre sayısı vs. yayınlanan 671B.
- Etkin parametreler sayımı vs. yayınlanan 37B.
- KV önbelleği 128k bağlamında  MLA vs GQA karşılaştırması.
- Parametre bütçesinin nereye gittiğini görmek için katmanlık bir ayrıntı.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-deepseek-v3-reader.md`. DeepSeek ailesinin bir modeli (V3, R1 veya herhangi bir gelecek variansı) verildiğinde, yapılandırmanın her alanının isimlerini belirleyen, bileşenler tarafından parametrelerin sayısını çıkaran ve modelin kullandığı dört DeepSeek özel yenilikten hangisini belirleyen bileşen-bizim bir mimari okuma üretir.

## Egzersizler

1. Çık .`code/main.py`- Hesap makinesi toplam parametresi tahminini yayınlanan 671B ile karşılaştırın ve delta'nın nereden geldiğini belirleyin.

2. MLA sıralamasını değiştirmek için MLA sıralamasını değiştirin.

3. DeepSeek-V3'ün (256 uzman, üst-8) yönlendirmeyi hipotetik bir (512 uzman, üst-8) varyana karşılaştırın. Toplam parametreler büyüyor; aktif parametreler aynı kalıyor. Teorik olarak ekstra uzman kapasitesi ne satın alır ve sonuçta ne kadar maliyetli olur?

4. MLA'ya ilişkin DeepSeek-V3 teknik raporunun (arXiv:2412.19437) 2.1. bölümünü okuyun. K ve V dekompresyon matrislerinin neden sonuçlama zaman verimliliği için sonraki matmul'e "sorb" edilebileceğini üç cümle ile açıklayın.

5. DeepSeek-V3 çoğu işlem için FP8 eğitimini kullanır. 671B ağırlıklarını depolamak için FP8 vs BF16 hafıza tasarrufu hesaplayın. Bu 14.8T-token eğitim bütçesi ile nasıl kesişmektedir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## Daha Fazla Okumak

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) Tam mimarlık, eğitim ve sonuç belgesi
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) yapılandırma dosyaları ve dağıtım notları
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) MLA'yı tanıtan öncü
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) V3 mimarisi üzerinde akıl yürütme eğitimi varisi
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) DeepSeek aile ilgisinin gelecekteki yönü
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) Eğitim programı referansı
