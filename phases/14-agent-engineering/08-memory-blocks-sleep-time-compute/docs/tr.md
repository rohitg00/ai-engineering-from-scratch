# Bellek Blokları ve Uyku Süresi Hesaplaması

> Modelin doğrudan düzenleyebileceği ayrık işlevsel bellek blokları ve birincil agent boştayken belleği eşzamansız olarak birleştiren bir uyku süresi agent. Bu iki fikir, hafızayı tek bir konuşmanın ötesine nasıl ölçeklendireceğinizdir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 07 (MemGPT)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Letta'nın kullandığı üç bellek katmanını (çekirdek, geri çağırma, arşiv) ve her birinin rolünü adlandırın.
- Bellek bloğu modelini açıklayın: Birinci sınıf yazılan nesneler olarak insan bloğu, Persona bloğu ve kullanıcı tanımlı bloklar.
- Uyku zamanı hesaplamasının ne olduğunu, neden kritik yolun dışında kaldığını ve neden birincil agent'dan daha güçlü bir model çalıştırabildiğini açıklayın.
- Birincil agent'nin yanıtları sunduğu ve uyku zamanı agent'nin sıralar arasındaki blokları birleştirdiği komut dosyasıyla yazılmış bir iki-agent loop uygulayın.

## Sorun

MemGPT (Ders 07) sanal bellek kontrol akışını çözdü. Üç üretim sorunu ortaya çıktı:

1. **Gecikme.** Her bellek işlemi kritik yolda bulunur. Kullanıcı beklerken agent'nin budaması, özetlemesi veya uzlaştırma yapması gerekiyorsa kuyruk gecikmesi artar.
2. **Bellek çürür.** Yazılar birikir. Çelişkili gerçekler varlığını sürdürüyor. Geri alma, eski içerikte boğulur.
3. **Yapı kaybı.** Düz bir arşiv deposu "İnsan bloğu her zaman prompt'dadır; Persona bloğu her zaman prompt'dedir; Görev bloğu oturum başına değişir." ifadesini ifade edemez.

Letta (letta.com), 2024'te benimsenen orijinal MemGPT projesinin platform adıdır - makalenin deseni MemGPT adını korur - ve 2026 Letta V1'in yeniden yazılması daha sonraki, ayrı bir adımdır. Bellek blokları yapıyı açık hale getirir; uyku zamanı hesaplaması, konsolidasyonu kritik yolun dışına taşır.

## Konsept

### Üç katman

| Seviye | Kapsam | Nerede yaşıyor | Yazan |
|------|-------|----------------|------------|
| Çekirdek | Her zaman görünür | Ana prompt içinde | Agent araç çağrısı + uyku zamanı yeniden yazma işlemleri |
| Geri Çağırma | Konuşma geçmişi | Geri Alınabilir | Otomatik dönüş kaydı |
| Arşiv | Keyfi gerçekler | Vektör + KV + grafiği | Agent araç çağrısı + uyku zamanı alımı |

Çekirdek MemGPT çekirdeğidir. Geri çağırma, kuyruğu çıkarılmış olan konuşma arabelleğidir. Arşiv harici depodur. Bölünme, MemGPT'nin iki katmanlı aşırı yüklemesini temizler.

### Bellek blokları

Blok, çekirdek katmanın yazılı, kalıcı ve düzenlenebilir bir bölümüdür. Orijinal MemGPT makalesi iki tanesini tanımladı:

- **İnsan engelleme** — kullanıcıyla ilgili gerçekler (isim, rol, tercihler, hedefler).
- **Kişilik bloğu** — agent'nin benlik kavramı (kimlik, üslup, kısıtlamalar).

Letta, isteğe bağlı kullanıcı tanımlı bloklara genelleme yapar: mevcut hedef için bir `Task` bloğu, kod temeli gerçekleri için bir `Project` bloğu, katı kısıtlamalar için bir {`Safety` bloğu. Her blokta bir `id`, `label`, `value`, `limit` (karakter sınırı), `description` bulunur (böylece model onu ne zaman düzenleyeceğini bilir).

Bloklar araç yüzeyi aracılığıyla düzenlenebilir:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` — sınırına yaklaşan bir bloğu yoğunlaştırır.

### Uyku zamanı hesaplaması

2025 Letta ilavesi: arka planda, kritik yolun dışında ikinci bir agent çalıştırın. Uyku zamanı agent'lar konuşma transkriptlerini ve kod tabanı bağlamını işler, paylaşılan bloklara `learned_context` yazar ve arşiv kayıtlarını birleştirir veya geçersiz kılar.

Ortaya çıkan özellikler:

- **Gecikme maliyeti yoktur.** Birincil yanıtlar bellek işlemlerini beklemez.
- **Daha güçlü modele izin verilir.** Uyku süresi agent, gecikme kısıtlaması olmadığı için daha pahalı ve daha yavaş bir model olabilir.
- **Doğal konsolidasyon penceresi.** Kullanıcı beklemediğinde çelişen gerçekleri tekilleştirin, özetleyin ve geçersiz kılın.

Şekli insanların çalışma şekliyle eşleşiyor: Görevi yaparsınız, üzerinde uyursunuz, uzun süreli hafıza bir gecede yerleşir.

### Yerel akıl yürütme

Letta V1 (`letta_v1_agent`, 2026), yerel akıl yürütme lehine `send_message`/kalp atışı ve satır içi {`Thought:` token'leri kullanımdan kaldırır. Yanıtlar API'si (OpenAI) ve genişletilmiş düşünceye (Antropik) sahip Mesajlar API'si, sıralar halinde geçirilen (üretimdeki sağlayıcılar arasında şifrelenmiş) ayrı bir kanalda akıl yürütme yayar. Kontrol döngüsü hala ReAct'tır. Düşünce izi prompt şeklinde değil yapısaldır.

### Bu modelin yanlış gittiği yer

- **Blok şişkinlik.** Sonsuz `block_append` sınıra hızla ulaşıyor. Kapağı iten yazmadan önce bir blok özetleyici bağlayın.
- **Sessiz sürüklenme.** Uyku zamanı agent bir bloğu yeniden yazar ve birincil agent bunu asla fark etmez. İzdeki sürüm blokları ve yüzey farklılıkları.
- **Zehirli birleştirme.** Uyku zamanı agent, saldırganların erişebileceği içeriği çekirdeğe işler. Ders 27 uyku zamanı yüzeyi için de geçerlidir.

## İnşa Et

`code/main.py` şunu uygular:

- `Block` — kimlik, etiket, değer, limit, açıklama.
- `BlockStore` — CRUD + `near_limit(label)` yardımcı.
- İki kodlu agents — `PrimaryAgent` bir dönüşe hizmet eder, `SleepTimeAgent` dönüşler arasında birleşir.
- Blok yazmalarla üç turluk bir konuşmayı ve ayrıca bir bloğu özetleyen ve eski bir gerçeği geçersiz kılan bir uyku zamanı geçişini gösteren bir iz.

Çalıştır:

```
python3 code/main.py
```

Transkript bölünmeyi gösteriyor: birincil dönüşler hızlıdır ve ham yazmalar üretir; uyku geçişi sıkıştırır ve temizler.

## Kullan onu

- Referans uygulaması için **Letta** (letta.com). Kendi kendine barındırılan veya yönetilen bulut.
- **Claude Agent SDK becerileri** blok şeklinde bilgi olarak — beceri, agent'nin talep üzerine yüklediği adlandırılmış, sürümlendirilmiş, geri alınabilir bir talimat bloğudur.
- Depolama arka ucu üzerinde kontrol sahibi olmak isteyen ekipler için **özel yapılar**. Daha sonra geçiş yapabilmek için Letta API sözleşmesini kullanın.

## Gönderin

`outputs/skill-memory-blocks.md`, güvenlik kuralları ve alıntı kabloları da dahil olmak üzere herhangi bir çalışma süresi için uyku zamanı kancalarına sahip Letta şeklinde bir blok sistemi oluşturur.

## Egzersizler

1. `near_limit` true değerini döndürdüğünde blok değerini model tarafından oluşturulan bir özet ile değiştiren bir `block_summarize` aracı ekleyin. Hangi tetikleme eşiği hem özetleme çağrılarını hem de blok taşmasını en aza indirir?
2. Arşivleme üzerinden uyku süresi tekilleştirmeyi uygulayın: metni >%90 token çakışan iki kayıt bire daraltılır. Bunu yalnızca uyku geçişinde yapın, asla kritik yolda yapmayın.
3. Sürüm blokları. Her yazma işleminde eski değeri ve farkı kaydedin. Operatörlerin "agent neden X'i unuttu?" hatalarını ayıklayabilmesi için `block_history(label)`'yi açığa çıkarın.
4. Uyku zamanı agent'larına güvenilmeyen yazarlar gibi davranın. Persona veya Güvenlik bloğuna dokunduklarında, taahhütte bulunmadan önce ikinci bir-agent inceleme iste.
5. Letta API'sini (`letta_v1_agent`) kullanmak için örneği taşıyın. Blok şemasında ne gibi değişiklikler olur ve yerel akıl yürütme iz şeklini nasıl değiştirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Bellek bloğu | "Düzenlenebilir prompt bölümü" | Çekirdek belleğin yazılı, kalıcı, LLM tarafından düzenlenebilir bölümü |
| İnsan bloğu | "Kullanıcı belleği" | Temelde sabitlenmiş kullanıcı hakkında gerçekler |
| Kişilik bloğu | "Agent kimliği" | Benlik kavramı, üslup, kısıtlamalar, özüne sabitlenmiş |
| Uyku zamanı hesaplaması | "Async bellek çalışması" | İkinci agent kritik yolun dışında konsolidasyon yapıyor |
| Çekirdek / Geri Çağırma / Arşivleme | "Kademeler" | Üç katmanlı bellek bölümü: her zaman görünür / konuşma / harici |
| Blok sınırı | "Kapak" | Blok başına karakter sınırı; kuvvetler özetleme |
| Yerel akıl yürütme | "Düşünme kanalı" | Sağlayıcı düzeyinde akıl yürütme çıktısı, prompt düzeyi `Thought:` değil |
| Öğrenilen bağlam | "Uyku çıkışı" | agent uyku zamanının paylaşılan bloklara yazdığı gerçekler |

## Daha Fazla Okuma

- [Letta, Bellek Blokları blogu](https://www.letta.com/blog/memory-blocks) — blok modeli
- [Letta, Uyku Zamanı Hesaplama blogu](https://www.letta.com/blog/sleep-time-compute) — eşzamansız birleştirme
- [Letta, Agent Loop](https://www.letta.com/blog/letta-v1-agent)'yi Yeniden Tasarlamak — yerel akıl yürütmenin yeniden yazılması
- [Packer ve diğerleri, MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — köken
