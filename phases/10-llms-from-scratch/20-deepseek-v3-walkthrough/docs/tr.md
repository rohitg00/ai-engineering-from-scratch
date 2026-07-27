# DeepSeek-V3 Mimarisi Çözüm Yolu

> Aşama 10 · Ders 14, her açık modelin döndüğü altı mimari düğmeyi adlandırdı. DeepSeek-V3 (Aralık 2024, toplam 671 milyar parametre, 37 milyar aktif) altısını da döndürür ve dört tane daha ekler: Çok Kafalı Gizli Dikkat, yardımcı kayıpsız yük dengeleme, Çoklu Token Tahmin ve DualPipe eğitimi. Bu ders DeepSeek-V3'ün mimarisini baştan sona okur ve her parametre sayısını yayınlanan yapılandırmadan çıkarır. Sonunda 671B/37B oranının neden doğru bahis olduğunu ve neden MLA + MoE'nin birlikte sınırda her ikisini de tek başına yendiğini açıklayabilirsiniz.

**Tür:** Öğren
**Diller:** Python (stdlib, parametre hesaplayıcı)
**Önkoşullar:** Aşama 10 · 14 (açık model izlenecek yollar), Aşama 10 · 17 (NSA), Aşama 10 · 18 (MTP), Aşama 10 · 19 (DualPipe)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- DeepSeek-V3 yapılandırmasını yukarıdan aşağıya okuyun ve her alanı altı GPT-2 düğmesi artı dört DeepSeek'e özgü ekleme açısından açıklayın.
- Toplam parametre sayısını (671B), aktif parametre sayısını (37B) ve her birine katkıda bulunan bileşenleri türetin.
- 128k bağlamında MLA'nın KV önbellek ayak izini hesaplayın ve GQA'ya sahip aynı aktif parametre yoğun modelin ödeyeceği tutarla karşılaştırın.
- DeepSeek'e özgü dört yeniliği (MLA, MTP, yardımcı kayıpsız yönlendirme, DualPipe) belirtin ve her birinin mimarinin/eğitim yığınının hangi bölümünü hedeflediğini belirtin.

## Sorun

DeepSeek-V3, mimarisi Llama ailesinden anlamlı derecede farklı olan ilk sınır açık modeldir. Llama 3 405B, "altı düğme döndürülmüş GPT-2'dir." DeepSeek-V3, altı düğmenin tümü ve dört düğmeyle birlikte GPT-2'dir. Llama 3 yapılandırmasını okumak, DeepSeek yapılandırmasını okumak için bir ısınmadır, ancak derin yapı (dikkat bloğunun şekli, yönlendirme mantığı, eğitim süresi hedefi) ayrı bir adım adım ilerlemeye ihtiyaç duyacak kadar farklıdır.

Bunu öğrenmenin getirisi: DeepSeek-V3'ün açık ağırlık sürümü, açık modellerde "sınır yeteneği"nin anlamını değiştirdi. Mimari, birçok 2026 eğitim çalışmasının kopyaladığı plandır. Bunun, sınır LLM eğitimine veya inference'ye dokunan herhangi bir rol için masa bahisleri olduğunu anlamak.

## Konsept

### Yine değişmez çekirdek

DeepSeek-V3 hala otoregresiftir. Hala kod çözücü bloklarını istifliyor. Her blokta hâlâ dikkat artı MLP artı iki RMSNorm vardır. MLP'de hala SwiGLU kullanılıyor. Hala RoPE kullanıyor. Ön norm. Ağırlığa bağlı embedding'ler. Her Llama veya Mistral ile aynı temel çizgi.

### Değişiklik: GQA yerine MLA

Aşama 10 · 14'ten itibaren, GQA'nın K ve V'yi Q kafası grupları arasında paylaştırarak KV önbelleğini küçülttüğünü biliyorsunuz. Çok Kafalı Gizli Dikkat (MLA) daha da ileri gider: K ve V, paylaşılan düşük dereceli gizli bir temsile (`kv_lora_rank`) sıkıştırılır, ardından anında kişi başına sıkıştırması açılır. KV önbelleği yalnızca gizli olanı depolar - genellikle katman başına token başına 512 kayan nokta, 8 x 128 = 1024 kayan nokta değil.

128k bağlamında, MLA'lı DeepSeek-V3 (katman başına token başına bir paylaşılan gizli `c^{KV}`; K ve V'nin her ikisi de sonraki matmul'a absorbe edilebilecek yukarı projeksiyonlar yoluyla bu latentten türetilir):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Varsayımsal bir GQA temel çizgisi (Llama 3 70B şekli, 8 KV kafa, baş loş 128) şunları ödeyecektir:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA, 128k bağlamda Llama-3-70B tarzı GQA önbelleğinden 4 kat daha küçüktür.

Takas: MLA, dikkat hesaplaması başına (kafa başına) bir dekompresyon adımı ekler. Ekstra işlem, kaydedilen bant genişliğiyle karşılaştırıldığında küçüktür. Uzun bağlam inference için net kazanç.

### Yönlendirme: yardımcı kayıpsız yük dengeleme

MoE yönlendiricileri, her bir token'yi hangi üst düzey uzmanların işleyeceğine karar verir. Saf bir yönlendirici, birkaç uzmanın üzerinde çok fazla iş yoğunlaştırarak diğerlerini boşta bırakır. Standart düzeltme: Yük dengesizliğini cezalandıran bir yardımcı kayıp terimi ekleyin. Bu işe yarar ancak ana görev performansını biraz düşürür.

DeepSeek-V3 yardımcı kayıpsız bir şema sunar. Uzman başına önyargı terimleri, eğitim sırasında basit bir kuralla ayarlanan yönlendirici logitlerine eklenir: uzman `e` aşırı yüklenmişse, `bias_e`'yi azaltın; az yüklenmişse artırın. Ekstra kayıp süresi yoktur. Eğitim temiz kalır. Uzman yükü dengeli kalır.

Ana kayıp üzerindeki etkisi: Ölçülemez. MoE mimarisi üzerindeki etkisi: daha temiz, ayarlanacak yardımcı kayıp hiperparametresi yok.

### OTP: daha yoğun eğitim + ücretsiz taslak

Aşama 10 · 18'den itibaren DeepSeek-V3'ün, token'nin iki konum ilerisini tahmin eden D=1 MTP modülünü eklediğini biliyorsunuz. inference'de eğitimli modül, %80'den fazla kabulle spekülatif kod çözme taslağı olarak yeniden tasarlandı. Eğitimde, her gizli durum D+1 = 2 hedef üzerinde denetlenerek daha yoğun bir sinyal sağlanır.

Parametreler: 671B ana hattının üstünde 14B. Genel gider: %2,1.

### Eğitim: DualPipe

Aşama 10.19'dan itibaren DualPipe'ın ileri ve geri parçaları çapraz düğümler arası iletişimle üst üste bindiren çift yönlü bir boru hattı olduğunu biliyorsunuz. DeepSeek-V3'ün 2.048-H800 ölçeğinde, 1F1B'nin boru hattı balonları nedeniyle kaybedeceği kabaca 245.000 GPU saatini geri kazanır.

### Yapılandırma, alan alan

İşte DeepSeek-V3 yapılandırması (basitleştirilmiş):

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

Çözümleyin:

- `hidden_size=7168`: embedding boyutu.
- `num_hidden_layers=61`: toplam blok derinliği.
- `first_k_dense_layers=3`: ilk 3 blok 18432 boyutunda yoğun bir MLP kullanır. Geriye kalan 58 blok ise MoE kullanır.
- `num_attention_heads=128`: 128 sorgu başlığı.
- `kv_lora_rank=512`: K ve V bu gizli boyuta sıkıştırılır ve kafa başına sıkıştırılmış hali açılır.
- `num_experts=256, num_experts_per_tok=8`: Her MoE bloğunda 256 uzman vardır ve rotalar ilk 8'dedir.
- `shared_experts=1`: yönlendirilen 256 uzmanın yanı sıra, her zaman açık olan 1 uzman her token'ye katkıda bulunur. Bunu, her token'nin güvenilir bir şeye sahip olmasını sağlayan "yoğun bir zemin" olarak düşünün.
- `moe_intermediate_size=2048`: her uzmanın gizli MLP boyutu. Yoğun MLP'den daha küçüktür çünkü 256 adet vardır.

### Parametre hesaplaması

Hesaplamanın tamamı `code/main.py`'de bulunmaktadır. Başlık:

- Embedding: `vocab * hidden = 129280 * 7168 = ~0.93B`.
- İlk 3 yoğun blok: MLA (blok başına ~144M) + yoğun MLP (blok başına ~260M) + normlara dikkat edin. Toplamda yaklaşık 1,2 milyar.
- 58 MoE bloğu: MLA ile dikkat (~144M) + her biri 256 uzman (her biri 30M) + 1 paylaşılan uzman (30M) + norm. Tüm uzmanlar dahil blok başına toplam ~7,95 milyar. 58 MoE bloğu için toplam 461B.
- MTP modülü: 14B.

Genel toplam: Çekirdek mimari için ~476B + 14B MTP + açıkça yayınlanan 671B numarası, ek yapısal parametreleri (önyargı tensörleri, uzmana özel bileşenler, paylaşılan uzman ölçeklendirme vb.) açıklamaktadır. Hesap makinesinde ürettiğimiz sayı, yayınlanan sayının %3-5'i dahilindedir — delta, DeepSeek'in Bölüm 2 ekindeki ayrıntılı muhasebe rapor belgelerinden gelir.

İletim başına aktif parametreler:

- Dikkat: Katman başına 144M * 61 = 8,8B (tüm katmanlar ateşlenir).
- MLP aktif: ilk 3 katman yoğun (3 * 260M = 780M), her biri 8 yönlendirilmiş + 1 paylaşılan + yönlendirme yükü ile 58 MoE katmanı aktif. Aktif MLP katmanı başına: ~260M. Toplam: 3 * 260 Milyon + 58 * 260 Milyon = ~15,9 Milyon.
- Embedding + normlar: 1,2B.
- Toplam aktif: kabaca 26B çekirdek + 14B MTP (eğitimli ancak her zaman inference'de çalıştırılmıyor) ≈ 37B.

### 671B / 37B oranı

18x seyreklik oranı (aktif parametreler toplamın %5,5'idir). DeepSeek-V3, açık ağırlıklar gönderen en seyrek sınır MoE modelidir. 13/47 (%28) oranındaki Mixtral 8x7B çok daha yoğundur. 17B/400B (%4,25) oranıyla Lama 4 Maverick benzerdir. DeepSeek bahsi: Sınır ölçeğinde, daha düşük aktivasyon oranına sahip daha fazla uzman, aktif FLOP başına daha iyi kalite üretir.

### DeepSeek-V3'ün bulunduğu yer

| Modeli | Toplam | Aktif | Oran | Dikkat | Yeni fikirler |
|-------|------|-------|-------|-----------|-------------|
| Lama 3 70B | 70B | 70B | %100 | GQA 64/8 | — |
| Lama 4 Maverick | 400B | 17B | %4,25 | GQA | — |
| Karışımtral 8x22B | 141B | 39B | %27 | GQA | — |
| DeepSeek V3 | 671B | 37B | %5,5 | MLA 512 | MLA + MTP + yardımcısız + DualPipe |
| Qwen 2.5 72B | 72B | 72B | %100 | GQA 64/8 | YaRN uzantısı |

### Devam: R1, V4

DeepSeek-R1 (2025), V3 omurgası üzerinde yapılan bir muhakeme eğitimi çalışmasıdır. R1 aynı mimariyi kullanır. Değişen şey, eğitim öncesi mimari değil, eğitim sonrası tariftir (doğrulanabilir görevlerde büyük ölçekli RL).

DeepSeek-V4'ün (eğer gönderilirse) MLA + MoE + MTP'yi koruması ve Aşama 10 · 17'den itibaren NSA'nın halefi olan DSA'yı (DeepSeek Sparse Attention) eklemesi bekleniyor. Köken istikrarlı: mimari düzeyde yenilikler birikir; her versiyon ek düğmeleri döndürür.

```figure
moe-routing
```

## Kullan onu

`code/main.py`, DeepSeek-V3'ün şekline göre özelleştirilmiş parametre hesaplayıcıdır. Çalıştırın, çıktısını makaledeki sayılarla karşılaştırın ve varsayımsal değişkenler üzerinde kullanın (256 uzmana karşı 512, ilk 8'e karşı ilk 16, MLA sıralaması 512'ye karşı 1024).

Neye bakmalı:

- Yayınlanan 671B ile karşılaştırıldığında toplam parametre sayısı.
- Yayınlanan 37B'ye kıyasla aktif parametre sayımı.
- 128k bağlamda KV önbelleği — MLA ve GQA karşılaştırması.
- Parametre bütçesinin gerçekte nereye gittiğini görmek için katman başına döküm.

## Gönderin

Bu ders `outputs/skill-deepseek-v3-reader.md`'yi üretir. DeepSeek ailesi modeli (V3, R1 veya gelecekteki herhangi bir varyant) göz önüne alındığında, yapılandırmanın her alanını adlandıran, bileşene göre parametre sayımlarını türeten ve modelin DeepSeek'e özgü dört yenilikten hangisini kullandığını tanımlayan bileşen bileşenli bir mimari okuma üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Hesaplayıcının toplam parametre tahminini yayınlanan 671B ile karşılaştırın ve deltanın nereden geldiğini belirleyin. Makalenin 2. Bölümünde tam maddeler yer almaktadır.

2. Yapılandırmayı, 512 yerine MLA sıralaması 256'yı kullanacak şekilde değiştirin. Ortaya çıkan KV önbellek boyutunu 128k bağlamında hesaplayın. Yüzde ne kadar indirim satın alıyor ve kişi başına ifadenin maliyeti ne kadar?

3. DeepSeek-V3'ün (256 uzman, ilk 8) yönlendirmesini varsayımsal (512 uzman, ilk 8) değişkenle karşılaştırın. Toplam parametreler büyüyor; aktif parametreler aynı kalır. Ekstra uzman kapasitesi teoride ne satın alır ve inference'de maliyeti nedir?

4. MLA ile ilgili DeepSeek-V3 teknik raporunun (arXiv:2412.19437) Bölüm 2.1'ini okuyun. inference-zaman verimliliği için K ve V dekompresyon matrislerinin neden sonraki matmul'a "absorbe edilebileceğini" üç cümleyle açıklayın.

5. DeepSeek-V3 çoğu işlem için FP8 eğitimini kullanır. 671B ağırlıklarını depolamak için FP8'e karşı BF16'nın bellek tasarrufunu hesaplayın. Bu, 14.8T-token eğitim bütçesiyle nasıl kesişiyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MLA | "Çok Kafalı Gizli Dikkat" | K ve V'yi paylaşılan düşük dereceli bir latent (kv_lora_rank, tipik olarak 512) halinde sıkıştırın, anında kişi başına sıkıştırmayı açın; KV önbelleği yalnızca gizli |
| kv_lora_rank | "MLA sıkıştırma sönük" | K ve V için paylaşılan gizli boyutun boyutu; DeepSeek-V3 512 |
| İlk k yoğun katman | "Erken katmanlar yoğun kalır" | İlk birkaç MoE modeli katmanı MoE yönlendiricisini atlar ve kararlılık için yoğun bir MLP çalıştırır |
| num_experts_per_tok | "En iyi yönlendirme" | token başına kaç yönlendirilmiş uzmanın ateşlendiği; DeepSeek-V3 8 |
| Paylaşılan uzmanlar | "Her zaman açık uzmanlar" | Yönlendirmeden bağımsız olarak her token'yi işleyen uzmanlar; DeepSeek-V3 1 |
| Yardımcı kayıpsız yönlendirme | "Önyargı ayarlı yük dengesi" | Kayıp terimi eklemeden uzman yükünü dengede tutmak için eğitim sırasında uzman başına önyargı koşulları ayarlandı |
| MTP modülü | "Ekstra tahmin başlığı" | h^(1) ve E(t+1)'den t+2'yi tahmin eden Transformer bloğu; daha yoğun eğitim, ücretsiz spekülatif kod çözme taslağı |
| Çift Boru | "Çift yönlü boru hattı" | Düğümler arası tümden herkese ile ileri/geri bilgi işlemle örtüşen eğitim programı |
| Aktif parametre oranı | "Yetersizlik" | active_params / total_params; DeepSeek-V3 %5,5'e ulaştı |
| FP8 eğitimi | "8-bit eğitim" | FP8'de depolama ve birçok bilgi işlem işleminin eğitimi; BF16'ya kıyasla belleği küçük bir kalite maliyetiyle kabaca yarıya indirir |

## Daha Fazla Okuma

- [DeepSeek-AI — DeepSeek-V3 Teknik Raporu (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — tam mimari, eğitim ve sonuç belgesi
- [Sarılma Yüzünde DeepSeek-V3 model kartı](https://huggingface.co/deepseek-ai/DeepSeek-V3) — yapılandırma dosyaları ve deployment notları
- [DeepSeek-V2 kağıdı (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) — MLA'yı tanıtan öncül
- [DeepSeek-R1 makalesi (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — V3 mimarisindeki muhakeme eğitiminin halefi
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) — DeepSeek ailesi ilgisinin gelecekteki yönü
- [DualPipe deposu](https://github.com/deepseek-ai/DualPipe) — eğitim programı referansı
