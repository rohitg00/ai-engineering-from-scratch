# Üretim Agent Çalışma Zamanları — Hızlı Örnek Oluşturma ve Yazılı İş Akışları

> Bir üretim agent çalışma zamanı, prototip oluşturma framework'ların göz ardı ettiği şeyleri optimize eder: örnekleme maliyeti, yazılı iş akışı yüzeyleri ve sunuma hazır bir arka uç. 2026 eşleştirmesi: Agno (Python), mikrosaniyelik agent örneklemeyi ve durum bilgisi olmayan FastAPI arka uçlarını hedefler. Mastra, Vercel AI SDK alt katmanı üzerinde agent'leri, araçları, iş akışlarını, birleştirilmiş model yönlendirmeyi ve bileşik depolamayı sunar.

**Tür:** Öğren
**Diller:** Python, TypeScript
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 13 (LangGraph)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Agno'nun performans hedeflerini ve bunların ne zaman önemli olduğunu belirleyin.
- Mastra'nın üç temel öğesini (Agent'ler, Araçlar, İş Akışları) ve desteklenen sunucu bağdaştırıcılarını adlandırın.
- Durum bilgisi olmayan, oturum kapsamlı bir FastAPI arka ucunun neden önerilen Agno üretim yolu olduğunu açıklayın.
- Belirli bir yığın için Agno ve Mastra'yı seçin (önce Python ve TypeScript ilk).

## Sorun

LangGraph, AutoGen, CrewAI framework-ağırdır. "Çalışma zamanımda yalnızca agent loop, hızlı, hızlı" isteyen takımlar Agno (Python) veya Mastra'ya (TypeScript) ulaşır. Her ikisi de framework'nin sahip olduğu temel öğelerin bir kısmını saf hız ve çevredeki yığına daha sıkı uyum karşılığında takas eder.

## Konsept

### Agno

- Python çalışma zamanı, eski adıyla Phi-data.
- "Grafikler, zincirler veya karmaşık desenler yok; yalnızca saf python."
- Dokümanlarından performans hedefleri: ~2μs agent örnekleme, agent başına ~3,75 KiB bellek, ~23 model sağlayıcı.
- Üretim yolu: durum bilgisi olmayan, oturum kapsamlı FastAPI arka ucu. Her istek yeni bir agent başlatır; oturum durumu bir DB'de yaşıyor.
- Yerel çok modlu (metin, resim, ses, video, dosya) ve agentic RAG.

Saniyede binlerce kısa ömürlü agent'niz (sohbet fanı girişi, değerlendirme ardışık düzenleri) olduğunda hız hedefleri önemlidir. Bir agent 10 dakika boyunca çalıştırıldığında daha az önem taşırlar.

### Mastra

- Vercel AI SDK üzerine kurulu TypeScript.
- Üç temel öğe: **Agents**, **Araçlar** (Zod tipi), **İş Akışları**.
- Birleşik Model Yönlendirici — 94 sağlayıcıda 3.300'den fazla model (Mart 2026).
- Bileşik depolama: bellek, iş akışları, farklı arka uçlara observability; ClickHouse observability için geniş ölçekte önerilir.
- Kaynakta kullanılabilir kurumsal lisans kapsamında `ee/` dizinlerine sahip Apache 2.0.
- Express, Hono, Fastify, Koa için sunucu adaptörleri; birinci sınıf Next.js ve Astro entegrasyonu.
- Hata ayıklama için Mastra Studio'yu (localhost:4111) gönderir.
- 22.000'den fazla GitHub yıldızı, 1.0'da (Ocak 2026) 300.000'den fazla haftalık npm indirme.

### Konumlandırma

İkisi de LangGraph olmaya çalışmıyor. Şu konularda yarışırlar:

- **Dil uyumu.** Python öncelikli ekipler için Agno; TypeScript için Mastra önceliklidir.
- **Çalışma zamanı ergonomisi.** Agno = sıfıra yakın genel gider; Mastra = Vercel ekosistemiyle entegre.
- **Observability.** Her ikisi de Langfuse/Phoenix/Opik (Ders 24) ile entegredir ancak Mastra Studio birinci taraftır.

### Her biri ne zaman seçilmeli

- **Agno** — Python arka ucu, birçok kısa ömürlü agent, güçlü performans gereksinimleri, FastAPI mağazası.
- **Mastra** — TypeScript arka ucu, Next.js / Vercel dağıtımı, birleştirilmiş çok sağlayıcılı model yönlendirme, Zod tipi araçlar.
- **LangGraph** (Ders 13) — Dayanıklı durum ve açık grafik muhakemesi ham hızdan daha önemli olduğunda.
- **OpenAI / Claude Agent SDK** — sağlayıcının ürünleştirilmiş şeklini istediğinizde (Ders 16–17).

### Bu modelin yanlış gittiği yer

- **Mükemmellik adına mükemmel.** Agno'yu seçmenin nedeni, iş yükünün istek başına bir yavaş agent çağrı olması durumunda "2μs" kulağa hoş geliyor. Tepegöz darboğaz değildir.
- **Ekosistemin kilitlenmesi.** Mastra'nın Vercel aromalı entegrasyonu Vercel'de bir artı, diğer yerlerde ise bir eksi.
- **Kurumsal lisans karışıklığı.** Mastra'nın `ee/` dizinleri Apache 2.0'da değil, kaynakta mevcuttur. Çatallamayı planlıyorsanız lisansları okuyun.

## İnşa Et

Bu ders öncelikle karşılaştırmalıdır; tek bir artifact kodu her iki framework'nin hakkını veremez. Yan yana bir oyuncak için bkz. `code/main.py`: minimum "bir agent çalıştır, çıktıyı aktar, oturumu sürdür" akışı iki kez uygulandı (bir kez Agno şeklinde, bir kez Mastra şeklinde).

Çalıştır:

```
python3 code/main.py
```

Yapısal olarak farklı ama işlevsel olarak eşdeğer iki iz.

## Kullan onu

- **Agno** — Hız ve FastAPI şekli gerektiren Python arka ucu.
- **Mastra** — Birçok sağlayıcı ve iş akışı temel öğesi içeren TypeScript arka ucu.
- Her ikisi de birinci taraf observability kancaları gönderir. Her ikisi de Langfuse ile entegredir.

## Gönderin

`outputs/skill-runtime-picker.md` yığın, gecikme bütçesi ve operasyonel şekle göre Agno, Mastra, LangGraph veya bir sağlayıcı SDK'sını seçer.

## Egzersizler

1. Agno'nun belgelerini okuyun. Stdlib ReAct döngüsünü (Ders 01) Agno'ya taşıyın. Ne kayboldu? Ne kaldı?
2. Mastra'nın belgelerini okuyun. Aynı döngüyü Mastra'ya taşıyın. Araç yazmada ne değişti (Zod vs hiçbir şey)?
3. Benchmark: yığınınızdaki agent örnekleme gecikmesini ölçün. Agno'nun 2μ'leri iş yükünüz açısından önemli mi?
4. Bir geçiş tasarlayın: CrewAI'yi Python'da çalıştırıyorsanız Agno'ya geçtiğinizde ne bozulur?
5. Mastra'nın `ee/` lisans koşullarını okuyun. Açık kaynak çatalını hangi kısıtlamalar etkiler?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agno | "Hızlı Python agent'lar" | Durum bilgisi olmayan oturum kapsamlı agent çalışma zamanı |
| Mastra | "Vercel AI SDK'sında TypeScript agent'ler" | Agent'lar + Araçlar + İş Akışları + Model Yönlendirici |
| Birleşik Model Yönlendirici | "Çoklu sağlayıcı erişimi" | 94 sağlayıcıda 3.300'den fazla model için tek istemci |
| Kompozit depolama | "Birden çok arka uç" | Bellek/iş akışları/observability her biri farklı bir mağazaya |
| Mastra Stüdyo | "Yerel hata ayıklayıcı" | localhost:4111 agent'ları incelemek için kullanıcı arayüzü |
| Kaynak mevcut | "OSS Değil" | Lisans, kaynak okumaya izin verir ancak ticari kullanımı kısıtlar |

## Daha Fazla Okuma

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) — performans hedefleri, FastAPI entegrasyonu
- [Mastra docs](https://mastra.ai/docs) — temel öğeler, sunucu bağdaştırıcıları, Model Yönlendirici
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — durum bilgisi olan grafik alternatifi
- [Comet Opik](https://www.comet.com/site/products/opik/) — Mastra entegrasyonları tarafından alıntılanan observability karşılaştırma
