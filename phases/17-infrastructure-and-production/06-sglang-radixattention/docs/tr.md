# Önek-Önbellek Sunumu — RadixAttention ve KV'nin Yeniden Kullanımı

> KV önbelleğine bir sayı tabanı ağacında depolanan birinci sınıf, yeniden kullanılabilir bir kaynak olarak davranın ve değişiklikleri onunla zamanlayın: vLLM zamanlamalarında FCFS (ilk gelen, ilk hizmet alır) yerine, önbellek bilincine sahip bir zamanlayıcı, daha uzun paylaşılan öneklere sahip isteklere öncelik verir - etkili bir şekilde derinlik öncelikli bir taban geçişi böylece sıcak dalların HBM'de yerleşik kalmasını sağlar. SGLang, bu fikir etrafında hizmet veren bir motordur. ShareGPT benzeri 1K prompt'lere sahip Llama 3.1 8B'de SGLang, ~%29'luk bir avantajla vLLM'nin ~12.500'üne ~16.200 tok/s'ye ulaşıyor. Ön ek ağırlıklı RAG iş yüklerinde avantaj 6,4 kata ulaşır. Ses klonlama şeklindeki iş yüklerinde önbellek isabet oranı %86 oranında temizlendi. 2026'da xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS genelinde 400.000'den fazla GPU'ya dağıtıldı. Sonuç olarak, önek sıralaması tutarsız olduğunda 6,4x sayısı buharlaşır; sıralama mühendisin koludur.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak radix ağacı önbelleği + önbelleğe duyarlı zamanlayıcı)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Parçalarına Hizmet Verme), Aşama 14 (Agentic RAG)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Diyagram RadixAttention: öneklerin bir sayı tabanı ağacında nasıl depolandığı ve KV bloklarının aynı dalda köklenen diziler arasında nasıl paylaşıldığı.
- Önbelleğe duyarlı planlamayı ve FCFS'nin önek yoğun trafik için neden yanlış olduğunu açıklayın.
- Önek önbellek isabet oranı ve prompt uzunluk dağılımı verilen bir iş yükü için beklenen hızı hesaplayın.
- 6,4x rakamını gerçek hale getiren ve kaybedilen yükselişi sağlayan prompt sıralama disiplinini adlandırın.

## Sorun

Klasik sunum, her isteğin prompt'sini opak olarak ele alır. 5.000 RAG isteğinin tümü aynı 2.000-token sistemi prompt artı aynı alma girişiyle başlasa bile, vLLM bu 2.000-token önekini 5.000 kez önceden doldurur. GPU aynı işi defalarca yapıyor.

Gözlem: agentic ve RAG iş yüklerindeki prompt'ler neredeyse her zaman uzun önekleri paylaşır. Sistem prompt, araç şemaları, birkaç örnek örnek, alma başlıkları, konuşma geçmişi — hepsi istekler arasında tekrarlanır. Bu önek için KV önbelleğini bir kez saklayıp yeniden kullandıysanız, onu tekrar önceden doldurmazsınız.

RadixAttention tam olarak bunu yapıyor. Token'ler bir sayı tabanı ağacında indekslenir; her düğüm, kök yolundaki token dizisi için KV bloklarına sahiptir. Ağaçta yeni bir istek dolaşır: token eşleşen herhangi bir düğüm, o düğümün KV bloklarını yeniden kullanır. Ön doldurma maliyeti prompt'nin tamamıyla değil, "yeni" son ekle orantılı hale gelir.

Buradaki zorluk planlamadır. İki istek 2.000-token önekini paylaşıyorsa ve üçüncüsü aynı önekten yalnızca 200 token paylaşıyorsa, uzun önekin HBM'de kalması için uzun süredir paylaşılan iki isteği birlikte sunmak istersiniz. FCFS bunun tersini yapar; ilk gelene hizmet eder ve potansiyel olarak bir sonraki uzun önek isteği gerçekleşmeden önce etkin şubeyi tahliye eder.

## Konsept

### KV dizini olarak taban ağacı

Bir sayı tabanı ağacı (kompakt trie) token dizilerini saklar. Her düğüm bir token aralığına ve bu aralık için hesaplanan KV bloklarına sahiptir. Çocuklar diziyi bir veya daha fazla token uzatır.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

prompt + "Bağlam: <doc A>" + "Soru: Carol" sistemiyle yeni bir istek gelir. Zamanlayıcı çalışır: sistem öneki eşleşir (124 blok yeniden kullanılır), doc-A şubesi eşleşir (31 blok yeniden kullanılır), ardından yeni blokları yalnızca "Soru: Carol" (4 blok) için ayırır. Ön doldurma maliyeti: 4 blok yeni token. Ağaçsız: 160 blok. Önceden doldurmada ~40 kat tasarruf.

### Önbelleğe duyarlı planlama

Önbellek bozulursa Radix ağacı destekli yeniden kullanımın bir anlamı yoktur. İki temel politika:

1. **Derinlik öncelikli gönderim**. Kuyruktan bir sonraki isteği seçerken, geçerli çalışan kümeyle aynı dalda köklenen istekleri tercih edin. Bu sıcak dalı sabit tutar.
2. **LRU blok düzeyinde değil, şube düzeyinde**. Tek tek bloklar yerine tüm dalları (en kısa kullanılan yapraklardan başlayarak) çıkarın, böylece önbellek şekli taban şekliyle eşleşir.

FCFS her ikisini de ihlal ediyor. 2.000 token'yi paylaşan bir istek, 50'yi paylaşan bir isteğin arkasında yer alır, ardından 2.000-token şubesi, 50-token'yi kabul etmek için tahliye edilir.

### Ezberlemeniz gereken Benchmark numaraları

- Llama 3.1 8B, H100, ShareGPT 1K prompts: SGLang ~16.200 tok/s vs vLLM ~12.500 (~%29 kenar).
- Önek ağırlıklı RAG (aynı sistem + aynı belge, değişen soru): SGLang'da 6,4x'e kadar.
- Ses klonlama iş yükleri: %86,4 önek önbellek isabet oranı.
- SGLang müşterileri genelinde üretim isabet oranları: prompt disiplinine bağlı olarak %50-99.
- 2026'da 400.000'den fazla GPU'ya dağıtıldı.

### Siparişi yakaladım

6,4x sayısı tutarlı prompt şablon sıralamasına dayanır. İstemciniz prompt'leri bazı isteklerde `[system, tools, context, history, question]` ve diğerlerinde `[system, context, tools, history, question]` olarak oluşturursa ağaç paylaşılan öneki bulamaz. Bir insana ait ortak bir önek gibi görünen şey, kök ağacının iki farklı dizisidir.

Mühendisin kolu: prompt şablonunuz bir önbellek anahtarıdır. Siparişi düzeltin. Değişmez olan her şeyi (sistem, araçlar, şemalar) ilk sıraya koyun. Geri alma içeriğini bir sonraki sıraya koyun. Kullanıcı sorusunu en sona koyun. Ön eke dinamik içerik eklemeyin.

Araştırmadan gerçek örnek: Dinamik içeriği önbelleğe alınabilir önekten çıkarmak, tek bir değişiklikle deployment'nin önbellek isabet oranını %7'den %74'e çıkardı.

### RadixAttention'ın kazandığı ve kaybettiği yer

Kazanılanlar:
- RAG (aynı geri getirme girişi, değişen soru).
- Agent'ler (aynı araç şemaları, değişen sorgu).
- Uzun sistem prompt ile sohbet edin.
- Tekrarlanan başlangıçlara sahip ses/görüntü iş yükleri.

Kaybeder (vLLM düzeyindeki verime geri döner):
- Benzersiz prompt'lerle tek çekim oluşturma (kod tamamlama, prompt sistemi olmadan açık uçlu sohbet).
- Her isteğin öneke benzersiz içerik eklediği dinamik prompt'ler.

### Bu neden yalnızca bir çekirdek sorunu değil de bir zamanlayıcı sorunudur?

KV'nin yeniden kullanımını bir çekirdek numarası olarak uygulayabilirsiniz. SGLang'ın görüşü, yeniden kullanımın yalnızca zamanlayıcının sıcak şubeyi yerleşik tutması durumunda kazanç sağladığı yönündedir. Saf bir "varsa yeniden kullanma" politikası, önbelleği karışık yük altında çalkalayacaktır. Taban ağacı indeksli zamanlayıcı, çekirdek numarasını %29 üretim avantajına dönüştüren şeydir.

### vLLM ile etkileşim

İki sistem sıkı rakipler değil. 2026'da vLLM, önek önbelleğe alma (`--enable-prefix-caching`) ve önbelleğe duyarlı bir yönlendirici (Rust'ta vLLM Router) ekledi. Boşluk kapandı ancak tamamen ortadan kaybolmadı - SGLang'ın tüm yığını taban birincisindedir; vLLM bunu aşıladı. Önek yeniden kullanımının hakim olduğu iş yükleri için SGLang varsayılan olarak kalır. Güçlü önek kalıpları olmadan genel amaçlı hizmet için vLLM eşit veya daha iyi kalır.

```figure
roofline
```

## Kullan onu

`code/main.py`, oyuncak bir radix-tree KV önbelleğinin yanı sıra iki politikaya sahip bir zamanlayıcı uygular: FCFS ve önbelleğe duyarlı. Her ikisinde de aynı iş yükünü çalıştırır, önek önbellek isabet oranını ve aktarım hızı deltasını bildirir. Daha sonra 6,4x çöküşü göstermek için "karışık sıralama" iş yükünü çalıştırır.

## Gönderin

Bu ders `outputs/skill-radix-scheduler-advisor.md`'yi üretir. Bir iş yükü açıklaması verildiğinde (prompt-şablon şekli, alma modeli, eşzamanlı kiracıların sayısı), bir prompt sipariş reçetesi ve SGLang'ın benimsenmesi için bir git/geçme durumu üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Aynı iş yükünde FCFS ile önbellek tanımayı karşılaştırın. Delta nereden geliyor; ön doldurma tasarrufları, kod çözme tasarrufları veya kuyruk gecikmesi?
2. İş yükünü, prompt'lerin `[system, tools, context]`'ye rastgele izin verecek şekilde değiştirin. Yeniden çalıştırın. İsabet oranına ne olur? Neden?
3. 2.000-token sistemini prompt yerleşik olarak Llama 3.1 8B'de bir radix şubesi olarak tutmanın HBM maliyetini hesaplayın. Ön ekin yeniden kullanılmadığı 16 sıralı bir partinin maliyetini karşılaştırın.
4. SGLang RadixAttention makalesini okuyun. Ağaç şeklindeki LRU tahliyesinin neden ağır yük öneki altında blok şeklindeki LRU'dan daha iyi olduğunu üç cümleyle açıklayın.
5. Bir müşteri yalnızca %8 önbellek isabet oranı bildiriyor. Üç olası nedeni ve her biri için uygulayacağınız tanılamayı belirtin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| RadixDikkat | "SGLang olayı" | KV önbelleği bir radix ağacı olarak indekslendiğinden, paylaşılan önekler blokları yeniden kullanır |
| Radix ağacı | "kompakt üçlü" | Her düğümün bir token aralığına ve onun KV bloklarına sahip olduğu ağaç |
| Önbelleğe duyarlı zamanlayıcı | "önce sıcak dal" | Yerleşik şubeyi paylaşma isteklerini tercih eden zamanlayıcı |
| Önek-önbellek isabet oranı | "prompt'nizin ne kadarı bedavaydı" | Yeniden kullanılan KV bloklarından sunulan prompt token'lerin oranı |
| FCFS | "ilk gelen alır" | Önek konumunu bozan varsayılan planlama |
| Şube düzeyinde LRU | "yaprağı çıkar" | Tahliye politikası taban şekliyle eşleşti |
| Prompt şablon siparişi | "önbellek anahtarı" | prompt'nin bileşen sırası ağacın neyi paylaşabileceğini belirler |
| Sistem prompt sabitleme | "yerleşik önek" | Tahliye karmaşasını önlemek için değişmez sistem kısmını sabit tutun |

## Daha Fazla Okuma

- [SGLang GitHub](https://github.com/sgl-project/sglang) — kaynak ve dokümanlar.
- [SGLang belgeleri](https://sgl-project.github.io/) — RadixAttention ve planlama ayrıntıları.
- [SGLang makalesi — Büyük Dil Modellerini Verimli Şekilde Programlama (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — tasarım referansı.
- [LMSYS blogu — RadixAttention ile SGLang](https://www.lmsys.org/blog/2024-01-17-sglang/) — benchmark sayıları ve zamanlayıcı mantığı.
- [vLLM — Önek Önbelleğe Alma](https://docs.vllm.ai/en/latest/features/prefix_caching.html) — Karşılaştırma amacıyla vLLM'nin kendi sayı tabanı benzeri uygulaması.
