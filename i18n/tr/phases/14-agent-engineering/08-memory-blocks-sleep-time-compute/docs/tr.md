# Hatıra Blokları ve Uyku Zamanı Bilgisayarı

> Modelin doğrudan düzenleyebileceği ayrıntılı fonksiyonel hafıza blokları ve ana ajan boşken hafıza asinkron bir şekilde konsolidasyon yapan uyku-zaman ajanı.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Letta'nın kullandığı üç hafıza katmanının (core, recall, archival) ve her birinin rolünün adını verin.
- Hatırlama blok örneğini açıklayın: İnsan blok, Persona blok ve kullanıcı tanımlı bloklar birinci sınıf tiplenen nesneler olarak.
- Uyku zamanı hesaplaması nedir, neden kritik yoldan uzakta kalıyor ve neden ana ajanından daha güçlü bir model kullanabilir.
- Birincil ajanın cevapları hizmet verdiği ve uyku zamanı ajanının dönüşler arasında blokları birleştirdiği bir iki ajanlı bir skriptlü döngü uygulayın.

## Sorun

MemGPT (Desin 07) sanal hafıza kontrol akışını çözdü.

1. **Latency.**Her bellek işleminin kritik yol üzerinde olması durumunda, eğer ajan kullanıcı beklerken kesmek, özetlemek veya uzlaştırmak zorunda kalırsa, kuyruğu gecikme patlar.
2. **Memory rot.**Yazılar birikip, çelişkili gerçekler kalır, bulma, eski içeriğe batır.
3. **Structure loss.**Düz bir arşiv mağazası "İnsan bloku her zaman isteklendirme içinde; Persona bloku her zaman isteklendirme içinde; Görev blokları seans başına değişir" ifadesini ifade edemez.

Letta (letta.com) platform adı orijinal MemGPT projesi 2024 yılında kabul edildi. Kağıtın örneği MemGPT adını tutar. 2026 Letta V1 yeniden yazılması daha sonraki, ayrı bir adımdır. Hatırlama blokları yapıyı açık yapar; uyku zamanı hesaplama konsolidasyonu kritik yoldan çıkarır.

## Anlaşım

### Üç kat

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

MemGPT çekirdeği, arşiv dışı depo, MemGPT'nin iki katlı yüklenmesini temizler.

### Hatırlama blokları

Bir blok, temel katmanın bir türden, sürekli, düzenlenebilir bölümdür.

- **Human block** Kullanıcı hakkındaki gerçekler (ad, rol, tercihler, hedefler).
- **Persona block** ajanın kendi kavramı (kimlik, ton, kısıtlamalar).

Letta , keyfi kullanıcı tanımlı bloklara genelleştirir: a `Task`Şu anki hedefi bloke etmek için,`Project`Kod tabanlı gerçekler için blok,`Safety`Her blokta zor kısıtlamalar için bir blok vardır.`id`- Evet .`label`- Evet .`value`- Evet .`limit`(karakter kapalı), `description`(Bu yüzden model ne zaman düzenleneceğini biliyor).

Blotlar araç yüzeyi üzerinden düzenlenebilir:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` sınırına yakın bir blok toplayın.

### Uyku zamanı hesaplama

2025 Letta eklemesi: kritik yoldan uzak bir ikinci ajanı çalıştırın.`learned_context`Ortak bloklara dönüştürülür ve arşiv kayıtlarını birleştirir veya geçersiz kılar.

Kaybolan özellikler:

- **No latency cost.**Ana cevaplar hafıza operasyonlarını beklemez.
- **Stronger model allowed.**Uyku zamanı ajanı daha pahalı, daha yavaş bir model olabilir çünkü gecikme kısıtlaması yoktur.
- **Natural consolidation window.**Kullanıcı beklemiyorsa, çelişkili gerçekleri dedup, özetleyip geçersiz kıl.

Şekil, insanların çalışma şekline uymaktadır: Görevyi yaparsınız, üzerinde uyursunuz, uzun süreli hafızamız bir gecede yer alır.

### Doğal düşünce

Letta V1 (`letta_v1_agent`, 2026) iptal ediliyor `send_message`Kalp atışı ve iç çizgi`Thought:`Bu yöntemler, kendiliğinden bir şekilde kullanılır ve kendiliğinden bir şekilde kullanılır. Bu yöntemler, kendiliğinden bir şekilde kullanılır. Bu yöntemler, kendiliğinden bir şekilde kullanılır.

### Bu kalıp yanlış gittiğinde

- **Block bloat.**Sonsuzluk .`block_append`Son sınırı hızlıca vur.
- **Silent drift.**Uyku zamanı ajanı bir blok yazıyor ve ana ajan hiç fark etmiyor.
- **Poisoned consolidation.**Uyku zamanı ajanı saldırganın erişilebilir içeriğini çekirdeğe dönüştürür.

```figure
memory-blocks
```

## Yapın

`code/main.py`Uygulamaları:

- `Block` id, etiket, değer, sınır, açıklama.
- `BlockStore` CRUD + `near_limit(label)`Yardımcı.
- İki senaryolu ajan`PrimaryAgent`Bir dönüş yapar.`SleepTimeAgent`Dönüşler arasında birleştirilmektedir.
- Block ile üç kez konuşulan bir iz yazıyor. Ayrıca bir blokun özetini ve eski bir gerçeği geçersiz kılan bir uyku zamanı geçiş.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Transkript bölünmeyi gösteriyor: Ana dönüşler hızlı ve çiğ yazılar üretir; uyku geçişi kompakt ve temizler.

## Kullan

- **Letta**(letta.com) referans uygulaması için.
- **Claude Agent SDK skills**blok şeklinde bilgi olarak  bir beceri, ajanın talep üzerine yüklediği isimli, versiyonlu, geri alabilir talimat blokudur.
- **Custom builds**Letta API sözleşmesini kullanın böylece daha sonra göç edebilirsiniz.

## Gönder

`outputs/skill-memory-blocks.md`Güvenlik kuralları ve istek kablosu dahil olmak üzere herhangi bir çalıştırma zamanı için uyku zamanı hakları ile Letta şeklinde bir blok sistemi üretir.

## Egzersizler

1. Bir ekle`block_summarize`blok değerini model oluşturulan bir özetle değiştiren bir araç .`near_limit`Hangi tetikleme eşiği hem toplama çağrılarını hem de blok aşırı akışını en aza indirir?
2. Arşiv üzerinde uyku zamanının düşüşünü uygulayın: metninin %90'dan fazla bir üst üste olduğu iki kayıt tek birine düşer.
3. Her yazış kaydındaki eski değer ve bir farkı göster.`block_history(label)`Operatörler "Agent neden X'i unuttu" sorusunu çözebilir.
4. Uyku zamanı ajanlarına güvenilmeyen yazarlar gibi davranın.
5. Letta API'si kullanmak için örnekleri aktar (`letta_v1_agent`Blok şemasındaki değişiklikler nelerdir ve yerli düşünce nasıl iz şeklini değiştirir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## Daha Fazla Okumak

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) blok örneği
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) Asynchronize konsolidasyonu
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) Doğal mantık yeniden yazma
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) Kaynak
