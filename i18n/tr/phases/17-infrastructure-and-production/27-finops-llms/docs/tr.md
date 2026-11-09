# LLM için FinOps  Birim Ekonomisi ve Çoklu Kiracı Atribuasyonu

> Geleneksel FinOps LLM harcamalarında kesimler. Maliyetler kaynak zaman değil, token işlemler. Etiketler haritalamıyor  bir API çağrısı bir işlemdir, bir varlık değil. Mühendislik kararları (sürekli tasarım, bağlam penceresi, çıkış uzunluğu) finansal kararlardır. 2026 oyun kitabı bir gün önce enstrüman için üç atribut boyutuna sahiptir: kullanıcı başına (`user_id`) yer fiyatlandırması ve genişlemesi için görev başına (`task_id`+ `route`) ürün yüzey maliyetleri ve öncelikleri için, kiracılık (`tenant_id`) için birim ekonomisi ve yenilenme. Dört token katmanı  prompt, araç, bellek, cevap  bir kova saklar harcamak. Çoklu kiracı ürünler için uygulanma merdivi: kiracı başına oran sınırı (2-3x beklenen zirve, net 429 + tekrar deneme sonrası); günlük harcama limiti (1.5-3x sözleşmiş tavan; hız sıkıştırmayı tetikler + uyarı); harcama z puanı > 4'te (otomatik ara + çağrı açılan sayfa) kesintiler. Atribusiyon kalıpları: etiketleme ve toplamlama, telemetri-birleştirme (izleme-ID → faturalama; en yüksek doğruluk), örnekleme ve ekstrapolasyon, model tabanlı tahsis, olay kaynaklı, gerçek zamanlı akış. Birim metrik: çözülen sorgu başına maliyet, üretilen eser başına maliyet  $/M tokens değil. Geriye dönük etiketleme her zaman eksik; istek üzerine oluşturma aracı.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Geleneksel FinOps'in (tag + seviyeler) LLM harcamaları neden kırıldığını ve üç yeni atribut boyutunu neden belirlediğini açıklayın.
- Dört token katmanını (sürekli, araç, bellek, yanıt) ve tek kutu faturalama neden maliyetleri gizlerse, listeleyin.
- Çoklu kiracı bir ürün için bir uygulama merdiveni (sıfı → harcama limitı → öldürme anahtarı) tasarlayın.
- $/M tokenleri yerine birim metrik ( çözülmüş sorgu / eser başına maliyet) seçin.

## Sorun

Hesabınızda 40.000 dolar yazıyor.
- Hangi kiracı harcadı?
- Hangi ürün özellikleri onu yönlendirdi.
- Kişisel bir kullanıcı kötüye kullanıyor mu?
- İster hızlı şişkinlik, ister alet çağrıları, isterse de hafıza güçlendirilmesi suçluydu.

Etiketler ve birleştirme, bulut kaynakları (EC2, S3) için hizmet sağlayıcı tarafında çalışır. Etiketler satır öğelerine yayılır. LLM API çağrıları otomatik olarak etiketlenmez.

## Anlaşım

### Üç atribut boyutu

**Per-user**(`user_id`): kim ne maliyet veriyor.Sit fiyatlarını belirler, genişleme konuşmaları yapar, elektrik kullanıcılarını tanımlar.

**Per-task**(`task_id`+ `route`): hangi ürün yüzeyi ne kadar maliyetlidir.

**Per-tenant**(`tenant_id`): hangi müşteri kârlı.

Üçü de ilk gün çağrı alanında.

### Dört simge katmanı

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

Dörtünü bir araya getirmek optimizasyonu kör eder.

### Yükleme merdiveni

1. **Rate limit**Kiracı başına. 2-3 kat beklenen zirve. 429'u geri getir.`Retry-After`Kiracı sürtüşmeyi görür, sürpriz hesabı yok.

2. **Daily spend cap**-Kartı: sıkılık oranı sınırı + müşteri başarısını uyarmak.

3. **Kill switch**İcatçı tabanına göre harcama z puanı > 4'e göre. Otomatik durak kiracı; çağrıda sayfa; operasyonlara tırman + CS.

### Atribu modelleri

- **Tag-and-aggregate**: metadata başlıkları; daha sonra toplayın.
- **Telemetry joiner**: izleri iz kimlikleri ile faturalama ile birleştirir. En yüksek doğruluk.
- **Sampling + extrapolation**%5-10% örnek, çarpma.
- **Model-based allocation**: geri dönüşü, maliyet sürücüsünü çıkarmak için.
- **Event-sourced**Bu nedenle, bu programın gerçek zamanlı olarak gerçekleşmesi için gerekli olan düzenlemeler de mevcuttur.
- **Real-time streaming**: tablo güncellemeleri alt saniye.

### X'e düşen maliyet birim metriktir

$/M tokenleri satıcı konuşuyor.

- Çözümlü destek biletinin fiyatı.
- Üretilen bir mal için maliyet.
- Başarılı bir ajan görevi için maliyet.
- Kullanıcı oturum dakikasındaki maliyet.

Ürün sonuçlarına maliyet bağlayın.

### Ücret atributı iz şekli

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Her çağrıda yayınlayın. Veriler gölünde saklayın. Boyut başına toplayın. 17 · 13 aşama gözlemlilik yığınında bu yerleşir.

### Toplu tasarruf yığınları

Stack: cache + batch + route + gateway.
- Kaş L2 (Fase 17 · 14): ~ 10 kat daha ucuz giriş.
- Satır (Fase 17 · 15): %50 indirim.
- Ucuz model için rota (Fase 17 · 16): %60 maliyet azaltımı.
- Geçit verimliliği (Fase 17 · 19): redundansi + tekrar deneme.

En iyi durum: saf başlangıç oranının %5-10'u. Çoğu takımda 2-3 kaldıraç kullanılır; birkaç kişi dörtünü de toplar.

### Hatırlamalısın numaralar

- Atribusiyon boyutları: kullanıcı başına, görev başına, kiracı başına.
- Dört token katmanı: prompt, araç, bellek, cevap.
- Öldürme düğmesi: z puanı> 4 kullan.
- Birim metrik: çözülen sorgu başına maliyet, $/M tokenleri değil.
- Yüklü optimizasyonlar: ~5-10% baseline mümkün.

```figure
i4-spend-ladder
```

## Kullan

`code/main.py`Üç katlı uygulama merdivenle çoklu kiracı bir LLM hizmetini simüle eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-finops-plan.md`. Ürün ve ölçek göz önüne alındığında, atribut şeması ve uygulanma merdiveni tasarlar.

## Egzersizler

1. Çık .`code/main.py`- Öldürücü ne zaman ateş eder?
2. Bir kiracı başına, görev başına maliyetle bir tablo tasarlayın.
3. En büyük kiracı ünite ekonomisi negatif.
4. Destek ürünü için çözülmüş bir bilet başına maliyet hesaplayın: 3M token/biletin, ~800 bilet/gün, tüm girişler GPT-5 önbelleğe kaydedilen oranla $0.125/M (başlatma listesi fiyatı; canlı oran kartını kontrol edin).
5. Geriye dönük etiketlemeyi ne zaman kabul edilebilir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Daha Fazla Okumak

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
