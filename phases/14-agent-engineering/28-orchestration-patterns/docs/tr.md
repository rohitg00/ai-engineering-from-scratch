# Düzenleme Kalıpları: Denetleyici, Swarm, Hiyerarşik

> 2026 framework'larda dört düzenleme modeli tekrarlanıyor: yönetici-işçi, sürü / eşler arası, hiyerarşik, tartışma. Anthropic'in rehberliği: "Bu, ihtiyaçlarınıza uygun doğru sistemi oluşturmakla ilgilidir." Basit başlayın; topolojiyi yalnızca tek bir agent artı beş iş akışı modeli yetersiz olduğunda ekleyin.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 12 (İş Akışı Modelleri), Aşama 14 · 25 (Çoklu-Agent Tartışması)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Dört yinelenen orkestrasyon modelini ve her birinin ne zaman uyduğunu adlandırın.
- 2026 LangChain önerisini açıklayın: araç çağrısı tabanlı denetim ve denetleyici kitaplıkları karşılaştırması.
- Anthropic'in "doğru sistemi oluştur" kuralını ve bunun topoloji seçimini nasıl belirlediğini açıklayın.
- Dördünü de stdlib'de ortak kodlu bir LLM'ye karşı uygulayın.

## Sorun

Takımlar "multi-agent"'ye ihtiyaç duymadan ulaşır. framework'lar boyunca dört model tekrarlanıyor; Bunları adlandırabildiğinizde doğru olanı seçebilir veya topolojiyi tamamen atlayabilirsiniz.

## Konsept

### Denetçi-işçi

- Merkezi bir yönlendirme LLM'si uzman agent'lara gönderim yapar.
- Karar verir: kendine geri dön, uzmana devret, sonlandır.
- Uzmanlar birbirleriyle konuşmazlar; tüm yönlendirmeler denetleyiciden geçer.

Frameworks: LangGraph `create_supervisor`, Antropik orkestratör-işçiler, CrewAI Hiyerarşik Süreç.

**2026 LangChain önerisi:** denetimi `create_supervisor` yerine doğrudan araç çağrıları yoluyla yapın. Daha hassas bağlam mühendisliği kontrolü sağlar; her uzmanın tam olarak ne göreceğine siz karar verirsiniz.

### Sürü / eşler arası

- Agent'ler doğrudan paylaşılan bir araç yüzeyi aracılığıyla dağıtılır.
- Merkezi yönlendirici yok.
- Yöneticiye göre daha düşük gecikme (daha az atlama).
- Mantık yürütmek daha zor (tek bir kontrol noktası yok).

Frameworks: LangGraph sürü topolojisi, OpenAI Agent'nin SDK aktarımları (tüm agent'ler diğerlerinin tümüne aktarılabildiğinde).

### Hiyerarşik

- Çalışanları yöneten alt denetçileri yöneten amirler.
- LangGraph'ta iç içe alt grafikler olarak uygulandı; CrewAI'de iç içe geçmiş ekipler.
- Operasyonel karmaşıklık pahasına büyük agent popülasyonlara ölçeklenir.

İhtiyacınız olduğunda: Tek bir denetçinin bağlam bütçesi tüm uzmanların tanımlarını tutamadığında.

### Çekişme

- Paralel teklifçiler + yinelemeli çapraz eleştiri (Ders 25).
- Aslında düzenleme değil - daha fazla doğrulama - ancak framework saniyeler içinde bir topoloji seçeneği olarak ortaya çıkıyor.

### Otonom ekipler ve deterministik akışlar

CrewAI iki deployment modunu resmileştirir:

- Deterministik olaya dayalı otomasyon için **Akış** (üretim için önerilen başlangıç ​​noktası).
- Otonom rol tabanlı işbirliği için **Mürettebat**.

Bu, yukarıdaki dört modele diktir ancak topolojiyle eşleşir: Akış genellikle denetleyici veya hiyerarşiktir; Mürettebat genellikle bir LLM yönlendiricisine sahip süpervizördür.

### Antropik'in rehberliği

"Yüksek Lisans alanında başarı, en karmaşık sistemi oluşturmakla ilgili değildir. İhtiyaçlarınıza uygun doğru sistemi oluşturmakla ilgilidir."

Karar sırası:

1. Tek agent + iş akışı modelleri (Ders 12) — buradan başlayın.
2. Denetçi-işçi — 2-4 uzmanınız olduğunda.
3. Sürü — gecikmenin akıl yürütme netliğinden daha önemli olduğu durumlarda.
4. Hiyerarşik — yalnızca denetçi bağlam bütçesi başarısız olduğunda.
5. Tartışma – doğruluğun maliyetten daha önemli olduğu durumlarda.

### Bu modelin yanlış gittiği yer

- **Topoloji öncelikli düşünme.** Çoklu-agent'nin hangi sorunu çözdüğünü tanımlamadan önce "Çoklu-agent'ya ihtiyacımız var".
- **Sürü halinde zıplayan aktarımlar.** A -> B -> A -> B. Atlama sayaçlarını kullanın.
- **Sahte hiyerarşi.** Üç katman çünkü "kurumsal"; iki gerçek takım. Yıkılmak.

## İnşa Et

`code/main.py`, stdlib'deki dört modelin tümünü komut dosyasıyla yazılmış bir LLM'ye karşı uygular:

- `Supervisor` — merkezi yönlendirici.
- `Swarm` — doğrudan aktarımla eşler arası.
- `Hierarchical` — denetçilerin denetçileri.
- `Debate` — paralel öneride bulunanlar + eleştiri.

Her kalıp aynı üç amaçlı görevi yerine getirir (geri ödeme / hata / satış). İz şekilleri farklılık gösterir.

Çalıştır:

```
python3 code/main.py
```

Çıktı: desen başına izleme + işlem sayısı. Yönetici en temiz olanıdır; sürüsü en kısadır; hiyerarşik en derin olanıdır; Tartışma en pahalısıdır.

## Kullan onu

- Denetleyici ve hiyerarşik (iç içe alt grafikler) için **LangGraph**.
- **Araç olarak aktarım için OpenAI AgentSDK'sı** (yönetici şeklinde).
- Üretim belirleyiciliği için **CrewAI Flow**.
- Tartışma için veya tam kontrol istediğinizde **Özel**.

## Gönderin

`outputs/skill-orchestration-picker.md` bir topoloji seçer ve onu uygular.

## Egzersizler

1. Yönlendiriciyi kaldırarak bir süpervizör-çalışanı sürüye dönüştürün. Ne kırılıyor? Ne iyileşir?
2. Sürüye bir atlama sayacı ekleyin: 3 geçişten sonra reddedin. A->B->A'nın zıplamasını yakalıyor mu?
3. 12 uzmandan oluşan bir alan için iki seviyeli hiyerarşik bir sistem oluşturun. Bağlam bütçesi yuvalama olmadan nerede başarısız olur?
4. Üretime dayalı bir iş yükünde dört modelin profilini çıkarın. Hangi ölçümde hangisi kazanır (gecikme, maliyet, doğruluk, hata ayıklama yeteneği)?
5. Anthropic'in "Etkili Agent'lar Oluşturmak" yazısını okuyun. Üretim akışlarınızın her birini dördünden biriyle eşleştirin. Temiz bir şekilde haritalanmayan var mı?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Denetçi-işçi | "Yönlendirici + uzmanlar" | Merkezi LLM uzmanlara gönderim yapar; birbirleriyle konuşmuyorlar |
| sürüsü | "Eşler arası" | Paylaşılan araçlar aracılığıyla doğrudan aktarım; merkezi yönlendirici yok |
| Hiyerarşik | "Denetleyicilerin denetçileri" | Büyük popülasyonlar için iç içe geçmiş alt grafikler |
| Tartışma | "Teklif sahibi + eleştiri" | Paralel öneride bulunanlar, çapraz eleştiri (Ders 25) |
| Araç çağrısı tabanlı denetim | "Kütüphanesi olmayan yönetici" | Bağlam kontrolü için doğrudan araç çağrıları olarak denetleyiciyi uygulayın |
| Mürettebat | "Özerk ekip" | CrewAI'nin rol tabanlı işbirliği modu |
| Akış | "Deterministik iş akışı" | CrewAI'nin olay odaklı üretim modu |

## Daha Fazla Okuma

- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — beş model + agent vs iş akışı
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — gözetmen, sürü, hiyerarşik
- [CrewAI docs](https://docs.crewai.com/en/introduction) — Mürettebat ve Akış
- [Du ve diğerleri, Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — tartışma modeli
