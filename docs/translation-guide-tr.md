# Türkçe Yerelleştirme Rehberi

Bu belge, **AI Engineering from Scratch** içeriğinin kişisel Türkçe sürümü için
editoryal standardı tanımlar. Amaç teknik İngilizceyi görünmez kılmak değil,
kavramları doğru İngilizce adlarıyla öğretirken açıklamaları doğal ve anlaşılır
Türkçe sunmaktır.

## Temel ilke

- Endüstride, kodda ve akademik kaynaklarda kullanılan yerleşik teknik terim
  İngilizce kalır.
- Terimin ilk kullanımında kısa Türkçe anlam veya açıklama verilir.
- Sonraki kullanımlarda İngilizce terim tek başına kullanılabilir.
- Kod, API adı, sınıf/fonksiyon adı, CLI komutu, dosya yolu ve protokol adı
  çevrilmez.
- Türkçe karşılığı teknik anlamı daraltıyor veya belirsizleştiriyorsa zorlama
  çeviri yapılmaz.

Önerilen ilk kullanım biçimi:

> **attention mechanism** (modelin girdinin ilgili bölümlerine farklı ağırlıklar
> vermesini sağlayan dikkat mekanizması)

## Yazım ve ton

- Profesyonel, açık ve doğrudan bir anlatım kullanılır.
- Türkçe cümle yapısı korunur; İngilizce kaynak cümle kelime kelime çevrilmez.
- “Yapay zekâ” genel alan adı olarak Türkçe yazılır; `AI` ürün, rol veya yerleşik
  bileşik terimin parçasıysa korunur.
- Ekler gerektiğinde kesmeyle ayrılır: `agent'ın`, `framework'ün`, `dataset'in`.
- Başlıklar Türkçeleştirilir; yerleşik alan adları başlıkta korunabilir:
  “Deep Learning — Derin Öğrenmenin Temelleri”.
- `Build It`, `Use It`, `Ship It` gibi müfredat etiketleri ilk kullanımda
  İngilizce ad + Türkçe açıklama ile verilir.

## Korunacak terimler

| İngilizce terim | İlk kullanımdaki Türkçe açıklama |
|---|---|
| AI Engineering | yapay zekâ sistemlerini tasarlama, geliştirme ve işletme disiplini |
| Machine Learning | veriden örüntü öğrenen sistemler geliştirme alanı |
| Deep Learning | çok katmanlı neural network'lere dayalı öğrenme yaklaşımı |
| neural network | birbirine bağlı matematiksel katmanlardan oluşan sinir ağı modeli |
| backpropagation | hatayı katmanlar boyunca geriye taşıyarak gradient hesaplama yöntemi |
| gradient | bir fonksiyonun en hızlı değişim yönünü gösteren türev vektörü |
| loss function | model hatasını sayısal olarak ölçen kayıp fonksiyonu |
| tokenizer | metni modelin işleyebileceği token'lara ayıran bileşen |
| token | modelin işlediği metin veya sembol birimi |
| embedding | bir öğeyi yoğun sayısal vektörle temsil etme yöntemi |
| attention mechanism | girdinin ilgili bölümlerine farklı ağırlıklar veren mekanizma |
| Transformer | attention temelli neural network mimarisi |
| Large Language Model (LLM) | büyük veri üzerinde eğitilmiş geniş ölçekli dil modeli |
| inference | eğitilmiş modelden çıktı üretme süreci |
| fine-tuning | önceden eğitilmiş modeli hedef veri veya göreve uyarlama |
| prompt | modele verilen görev, bağlam ve çıktı talimatı |
| context window | modelin tek istekte dikkate alabildiği token sınırı |
| agent | hedefe ulaşmak için model, araç ve kontrol döngüsü kullanan yazılım birimi |
| agent loop | agent'ın gözlem, karar, araç kullanımı ve sonuç değerlendirme döngüsü |
| tool calling | modelin tanımlı bir yazılım aracını yapılandırılmış biçimde çağırması |
| Retrieval-Augmented Generation (RAG) | üretimden önce dış kaynaktan ilgili bilgi getiren yaklaşım |
| vector database | embedding benzerliğine göre arama yapan veri deposu |
| framework | uygulama geliştirme yapısı ve çalışma kuralları sağlayan yazılım çatısı |
| deployment | bir uygulamayı çalışır ortama yayınlama süreci |
| observability | sistem davranışını log, metric ve trace üzerinden anlama yeteneği |
| benchmark | sistemleri aynı ölçütlerle karşılaştıran standart değerlendirme |
| dataset | eğitim veya değerlendirmede kullanılan veri kümesi |
| artifact | ders veya build sürecinin yeniden kullanılabilir çıktısı |

## Çevrilmeyecek içerik

- Fenced code block içerikleri ve inline code ifadeleri
- Değişken, fonksiyon, sınıf, paket ve model adları
- Terminal komutları ve çıktıları
- URL'ler, dosya yolları ve GitHub kullanıcı/depo adları
- Matematiksel gösterim ve semboller
- Resmî ürün, protokol ve standart adları

Kod yorumları, öğrenmeyi doğrudan destekliyorsa Türkçeleştirilebilir; ancak
identifier'lar ve teknik davranış değiştirilmez.

## Kalite kontrol listesi

1. Teknik anlam kaynakla aynı mı?
2. Yerleşik İngilizce terim ilk kullanımda korunup Türkçe açıklanmış mı?
3. Kod, bağlantı, denklem ve identifier'lar değişmeden kalmış mı?
4. Türkçe cümle doğal mı; kaynak dilin sözdizimini kopyalıyor mu?
5. Aynı terim bütün sayfalarda aynı biçimde mi kullanılmış?
6. Başlık, metadata, erişilebilirlik etiketi ve navigasyon metni çevrilmiş mi?
7. Sayfa dar ekran, klavye kullanımı ve screen reader akışında çalışıyor mu?

## Tekrarlanabilir çeviri iş akışı

Çeviri doğrudan kaynak dosyada yapılmaz. Aşağıdaki komut, ders veya aşama
kapsamındaki çevrilebilir satırları JSON paketi olarak çıkarır. Inline code,
URL, denklem ve identifier'lar `{{P0}}` biçiminde değişmez placeholder'lara
dönüştürülür; fenced code block'lar pakete hiç alınmaz.

```bash
python3 scripts/localize_curriculum.py prepare \
  --scope phases/00-setup-and-tooling/01-dev-environment \
  --output translation-tr.json
```

Paket içindeki yalnızca `translation` alanları çevrilir. Placeholder'ların
sırası ve yazımı değiştirilmez. Paket uygulandığında dersler `docs/tr.md`,
aşamalar ise `README.tr.md` olarak üretilir:

```bash
python3 scripts/localize_curriculum.py apply translation-tr.json
python3 scripts/localize_curriculum.py check --report coverage-tr.json
```

`check`, kaynak/çeviri çiftlerindeki kod, denklem, identifier ve URL
invariant'larını; ayrıca bu rehberdeki korunacak terimleri doğrular. Rapor,
503 ders ile aşama sayfalarının toplam ve çevrilmiş sayılarını, kapsam
yüzdesini ve ihlalleri JSON olarak verir. `coverage-tr.json` bir çalışma
çıktısıdır; repoya eklenmez.
