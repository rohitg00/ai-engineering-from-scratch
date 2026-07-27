# Parçalama Stratejileri Karşılaştırıldığında

> Parçalama, av köpeğinizin neleri yüzeye çıkarabileceğine karar verir. Sınırları yanlış anlayın ve hiçbir embedding modeli, hiçbir yeniden sıralama, hiçbir LLM aşağı yöndeki hasarı onaramaz.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 11 dersleri 04 (embeddings), 06 (RAG), 07 (ileri düzey RAG); Aşama 19 B Yolunun temelleri (20-29. dersler)
**Süre:** ~90 dakika

## Öğrenme Hedefleri
- Beş parçalama stratejisini sıfırdan uygulayın: sabit pencere, cümle, özyinelemeli bölme, anlamsal kümeleme ve yapısal işaretleme başlıkları.
- Altın etiketli yanıt aralıklarına sahip bir fikstür derlemi üzerinde geri çağırma@k'yi ölçün ve düzyazıda neden bir stratejinin, teknik belgelerde ise farklı bir stratejinin kazandığını açıklayın.
- Parça uzunluğu dağılımını okuyun ve her stratejinin enjekte ettiği başarısızlık modlarını tanıyın: yetim cümleler, orta sembol kesmeleri, yalnızca başlık parçaları, anlamsal kayma.
- Üç özelliği inceleyerek benchmark'ı çalıştırmadan yeni bir derlem için bir varsayılan seçin: belge türü, ortalama paragraf uzunluğu ve formatın açık bir yapı taşıyıp taşımadığı.

## Sorun

Her RAG ardışık düzeni, kaynak belgelerini bir embedding modelinin sığabileceği kadar küçük ve her parçanın bağımsız bir fikir taşıyacağı kadar büyük parçalara bölerek başlar. Nerede kesileceği seçimi bir hiperparametre değildir. Bu, av köpeğinin geri dönebileceği miktarın üst sınırıdır.

"Bütçe iptal eşiği neye benziyor" diye soran bir sorgu, yalnızca iptal eşiğini tutan parçaya ulaşılabilir olması durumunda başarılı olabilir. Sabit pencere ayırıcının eşik değerini çevreleyen bağlamdan kesmesi durumunda, embedding farklı bir kümeye geçer, BM25 puanı düşer, yeniden sıralayanlar gürültü görür ve LLM'nin ürettiği yanıt yanlış olur. 2024 tarihli "LongRAG: Uzun Bağlamlı LLM'lerle Geri Alma-Artırılmış Üretimin Geliştirilmesi" başlıklı makale, yalnızca parçalama seçiminden kaynaklanan geri çağırmada yüzde 35'lik mutlak bir salınım ölçtü. Bağlamsal öbek başlıkları üzerine 2025'te yapılan takip çalışması boşluğu daralttı ancak kapatmadı.

Bu derste beş strateji yan yana oluşturuluyor, bunları altın etiketli cevap aralıklarına sahip bir fikstür derlemesinde çalıştırılıyor ve geri çağırma sayılarını kendiniz okumanıza olanak tanıyor.

## Konsept

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Sabit pencere

Kaba kuvvet temel çizgisi. Her N karakteri kesin. İsteğe bağlı olarak üst üste bindirme, böylece N konumunda kesilen bir cümle, N konumunda başlayan yığının içinde bütün olarak görünür - örtüşme. Hızlı, deterministik, sınırlarda berbat. Bunu varsayılan olarak değil, kontrol olarak kullanın.

### Cümle

Bir regex veya basit durum makinesiyle cümle sınırlarına bölün. Bir veya daha fazla cümleyi hedef karakter bütçesine kadar bir yığın halinde paketleyin. Kelimenin ortasında kesmeyi bırakır. Hala paragrafın ortasını ve bölümün ortasını kesiyor. Birçok eski RAG boru hattında varsayılan ve başka hiçbir yapıya sahip olmayan düzyazı için makul bir seçim.

### Özyinelemeli bölme

2023 dönemi kütüphaneleri tarafından popüler hale getirilen hiyerarşi stratejisi. Önce en güçlü ayırıcıya (çift yeni satır, paragraf) ayırmaya çalışın, sonrakine (tek yeni satır), ardından cümlelere ve ardından karakterlere geçin. Özyineleme, parça bütçeye uygun olduğunda sona erer. Bölgelere göre uyarlandığı için tutarsız yapıya sahip belgeler üzerinde güçlüdür.

### Anlamsal kümeleme

Her cümleyi gömün. Bir konu merkezini paylaşan bitişik cümleleri kümeleyin. Merkeze olan çalışma benzerliği bir eşiğin altına düştüğünde kesin. Sınırlar karakterleri değil anlamı yansıtır. Oluşturulması daha yavaştır ve embedding modeline bağımlıdır, ancak paragraf içinde konu değiştiren belgelere karşı dayanıklıdır.

### Yapısal işaretleme başlıkları

Açık bir yapı taşıyan belgeler için (markdown, reStructuredText, RFC tarzı numaralandırılmış bölümler), başlık sınırlarında kesin. Her parça, başlık artı onun altındaki her şey, aynı veya daha yüksek seviyedeki bir sonraki başlığa kadar olur. Konu başına en küçük parçalar, ancak yalnızca derlem iyi biçimlendirildiğinde kullanılabilir.

### Recall@k sınır seçimini nasıl ölçer?

Altın etiketli bir sorgu, kaynak belgenin içindeki yanıt aralığının tam karakter uzaklıklarını taşır. Parçalamadan sonra şunu sorarsınız: Retriever'ın geri getirdiği en iyi parçalardan herhangi biri altın aralığıyla örtüşüyor mu? Evetse, bu sorgu için geri çağırma@k 1'dir. Hayırsa, 0'dır. Sorgu kümesi genelinde ortalama. Her strateji için aynı değerlendirmeyi yaptığınızda, dağılım size hangi sınır politikasının sahip olduğunuz bütüncede ayakta kaldığını gösterir.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `fixed_window(text, size, overlap)` - taban çizgisi.
- `sentence_chunks(text, target)` - basit cümle paketleyici.
- `recursive_split(text, separators, target)` - hiyerarşik özyineleme.
- `semantic_chunks(text, similarity_threshold)` - deterministik bir örnek embedding üzerinde merkez merkezli kümeleme.
- `structural_markdown(text)` - başlığa duyarlı ayırıcı.
- `mock_embed(text, dim)` - karma tabanlı bir embedding, böylece döngü çevrimdışı çalışır.
- `DenseIndex` - Aşama 19 Parça B'nin karma geri getirme dersinde kullanılan şeklin aynısı.
- `eval_recall(strategy, corpus, queries, k)` - karşılaştırma döngüsü.
- Fikstür kümesindeki her stratejiyi çalıştıran ve bir geri çağırma@k tablosu yazdıran bir `main()` .

Çalıştır:

```bash
python3 code/main.py
```

Çıktı, strateji başına bir satır ve k başına bir sütun içeren küçük bir tablodur. Cümle yapılandırılmış fikstürde kaybeder. İndirim fikstüründe yapısal indirim kazanır. Özyineleme uyum sağladığı için özyinelemeli karma fikstürde kendine aittir. Anlamsal kümeleme, hiçbir yararlı yapısal ipucunun olmadığı düzyazı kurgusunda kazanır.

## Tablonun gizlemeyeceği arıza modları

**Yetim cümleler.** Cümle paketleme, konu cümlesini kaçıran parçalar üretir. embedding daha sonra yanlış kümeye işaret eder.

**Sembol ortası kesimleri.** Kod içindeki sabit pencere veya YAML, tanımlayıcıyı ikiye böler. İki yarım gürültüye karışıyor.

**Yalnızca başlık parçaları.** Yapısal işaretleme, `## Title` dışında hiçbir şey içermeyen bir yığın oluşturur. Bunları filtreleyin veya bir sonraki parçanın ilk paragrafını ekleyin.

**Anlamsal kayma.** Anlamsal kümelenme, bütünlük aynı şekilde konu üzerinde olduğunda eksik kalır. 5000 karakterlik bir yığın, birçok özel yanıtı tek bir dağınık embedding içinde paketler. Semantiği sert bir karakter başlığıyla birleştirin.

**Eski embeddings.** Anlamsal kümeleme bir embedding modelini kullanır. Modeli değiştirirseniz parçaları da değiştirirsiniz. Parça modelini alma modelinden ayrı olarak sabitleyin veya dizini birlikte yeniden oluşturun.

## benchmark çalıştırmadan varsayılanı seçme

Yeni bir derlem için varsayılan parçalayıcıya üç özellik karar verir.

| Emlak | Değer | Varsayılan |
|----------|-------|---------|
| Belge türü | Yapısız düzyazı | Özyinelemeli bölme, hedef 800 |
| Belge türü | Markdown / RFC / API belgeleri | Yapısal işaretleme |
| Belge türü | Kod | AST uyumlu (kapsam dışı; bkz. Aşama 19 ders 02) |
| Paragraf uzunluğu | Uzun, tek konu | Cümle, hedef 500 |
| Paragraf uzunluğu | Kısa, karışık konular | Anlamsal, eşik 0,6 |

Şüphe duyduğunuzda özyinelemeli bölmeyi seçin. En güçlü tek stratejili temeldir.

## Use It — Hazır Araçla Uygula

Üretim modelleri:

- Yeni bir boru hattını göndermeden önce değerlendirmeyi çalıştırın; Kitaplığınızın varsayılan olarak benimsediği stratejiye güvenmeyin.
- embedding modelini veya derlem karışımını değiştirdiğinizde değerlendirmeyi yeniden çalıştırın; kazanan külliyata bağımlıdır.
- Daha sonra regresyonları ilişkilendirebilmeniz için strateji adını her bir parçanın meta verilerinde tutun.

## Ship It — Kullanıma Sun

69. dersteki Track F uçtan uca RAG sistemi, burada seçilen parçalayıcıyı ilk aşaması olarak kullanır. 68. dersteki değerlendirme koşum takımı, bu derste `eval_recall` 'nin döndürdüğü şeklin aynısından geri çağırma@k'yi okur. Derleminizde kazanan stratejiyi seçin ve onu ileriye doğru besleyin.

## Egzersizler

1. Altıncı bir strateji ekleyin: Karakter sayıları yerine `tiktoken` kullanan token-pencere. Aynı fikstürdeki sabit pencereyle karşılaştırın.
2. Düzyazı fikstürüne yüzde 30 oranında kod blokları enjekte edin. Tabloyu yeniden çalıştırın. Yapısal işaretleme dışındaki her stratejinin neden hatırlanabilirliğini kaybettiğini açıklayın.
3. Deterministik embedding'yi projenizin gerçek sağlayıcısındakiyle değiştirin. Anlamsal kümeleme hatırlama deltasını ölçün. Stratejiler arasındaki farkın genişlediğini veya daraldığını bildirin.
4. Parça başına bir `summary` alanı ekleyin: tek cümlelik bir ağırlık merkezi açıklaması. Değerlendirmeyi yığın gövdesine eklenen özet ile yeniden çalıştırın. Geri çağırma artışını ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Geri çağırma@k | "Doğru parçayı aldık mı?" | En üstteki parçalardan herhangi birinin altın yanıt aralığıyla örtüştüğü sorguların oranı |
| Parça örtüşmesi | "Sürgülü pencere" | Önceki parçanın son N karakterini sonraki parçaya yeniden dahil et |
| Yapısal ayırıcı | "Başlığa duyarlı parçalar" | H1/H2/H3 sınırlarında kesin; başlık metni öbeğin bir parçasıdır |
| Anlamsal parçalayıcı | "Konuya duyarlı parçalar" | Cümleleri yerleştirme, benzerlik merkezine göre kümeleme, sapmayı kesme |
| Ağırlık merkezi kayması | "Konu değişimi" | Çalışan ortalama ile bir sonraki cümle arasındaki kosinüs benzerliği bir eşiği geçiyor |

## Daha Fazla Okuma

- [LongRAG: Uzun Bağlamlı LLM'lerle Erişimi Artırılmış Üretimi Geliştirme (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Antropik, Bağlamsal Erişim](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, RAG üretimi için parçalama stratejileri](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- Aşama 11 ders 06 - RAG temelleri
- Aşama 11 ders 07 - ileri RAG
- Aşama 19 ders 65 - burada üretilen parçaları sıralayan hibrit erişim
- Aşama 19 ders 68 - üretimde strateji seçimini puanlayan değerlendirme koşum takımı
