# Grup sohbetleri ve konuşmacı seçimi

> Paylaşılan konuşma orkestrasyonu, bir konuşmaya N ajanları yerleştirir; bir seçme fonksiyonu (LLM, yuvarlak-robin veya özel) sonraki konuşmayı seçer. Bu gelişen çoklu ajan konuşmasının arşetipi. Ajanlar statik bir grafikte rollerini bilmiyorlar, sadece paylaşılmış havuza tepki veriyorlar. AutoGen GroupChat ve AG2 GroupChat referans uygulamalardır: AutoGen v0.2'nin GroupChat semantikası AG2 çatalında korunmuştur; AutoGen v0.4 olay yönlendirici bir oyuncu modeli olarak yeniden yazdı. Microsoft, AutoGen'i 2026 Şubat'ta bakım moduna koydu ve Semantic Kernel ile Microsoft Agent Framework'e (RC Şubat 2026) birleştirdi. GroupChat primitif hem AG2 hem de Microsoft Agent Framework'ta hayatta kalır  bir kez öğrenin, her yerde kullanın.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Sorun

Statik grafikler (LangGraph) iş akışı bilinirken harika. Gerçek sohbetler statik değildir: bazen kodlayıcı eleştirmeni, bazen araştırmacıyı, bazen yazarı sorar. Her olası teslimatın sert kodlanması bir kenar patlaması yaratır. * Ajanların ortak bir havuza tepki göstermesini istersin*, bir fonksiyon sonra kimin konuştuğunu belirler.

İşte AutoGen GroupChat'ın yaptığı da bu.

## Anlam

### Şekil

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Her ajan her mesajı görür, sonra kim konuşacak seçmek için her dönüşte bir seçer fonksiyonu çağrılır.

### Üç seçen tatlı

**Round-robin.**Sıkılıklı bir döngü. Deterministik. Skalaları lineer olarak N'de ama bağlamı görmezden  bir kodlayıcı, konu yasal inceleme olduğunda bile dönüş alır.

**LLM-selected.**Son bir havuz okuyan ve en iyi bir sonraki konuşmayı geri veren bir LLM çağrısı. Kontext farkında ama yavaş: her dönüşte bir LLM çağrısı eklenir. AutoGen'in varsayılan.

**Custom.**Python fonksiyonu istediğiniz mantıkla. Tipik: Fallback kuralları ile LLM seçilen (örneğin, "her zaman doğrulayıcıya kodlayıcıyı takip et").

### Konuşulabilir Ajan API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`Bir ajan bir tur tamamladığında, yöneticisi seçeneği arar ve bu da bir sonraki ajanı geri gönderir.

### Sonlandırma

Üç ortak desen:

- **Max rounds.**Toplam dönüşlerde sert kapak.
- **"TERMINATE" token.**Ajanlar bir nöbetçi mesajı gönderebilir. Müdür ortaya çıktığında durur.
- **Goal-reached check.**Her dönüşü hafif bir doğrulayıcı çalışır ve konuşmayı bitirdiğinde durdurur.

### Soy: çatallar ve birleşmeler

2025'in başında Microsoft, AutoGen'in (v0.4) etkinlik odaklı bir oyuncu modeli etrafında büyük bir yeniden yazmaya başladı. Toplum, ilk kullanıcıların entegre ettiği API'yi koruyarak AutoGen v0.2'nin GroupChat semantikasını AG2 olarak kırdı.

Şubat 2026'da Microsoft, AutoGen'in bakım moduna geçeceğini, etkinlik odaklı aktör modelinin **Microsoft Agent Framework**GroupChat konsepti her iki pistte de hayatta kalır; uygulama detayları farklıdır. AG2 v0.2 uyumlu kod için tercih edilen yukarı kaynaktır.

### GroupChat uygun olduğunda

- **Emergent conversations.**Her olası sonraki hoparlörü önceden kablolamak istemezsin.
- **Role-mixing tasks.**Kodlayıcı araştırmacıdan, araştırmacı arşivciden, arşivci de kodlayıcıdan geri istiyor.
- **Exploratory problem-solving.**"Brainstorm toplantısı" düşün, "montaj hattı" değil.

### Başarısız olduğunda

- **Strict determinism.**LLM seçicisi aynı sürede, farklı çalışmalar, farklı konuşmacılar olabilir.
- **Sycophancy cascades.**Ajanlar en güvenle konuştuğu kişiye geri dönüyorlar.
- **Context bloat.**Her ajan her mesajı okuyor; 10 dönüşten sonra bağlam büyüktür. Görünümleri kapsamlamak için projeksiyonları kullanın (Deneyim 15).
- **Hot speakers.**Bir temsilci konuşmada egemenlik kazanır çünkü seçiciler kendi uzmanlıklarını tercih eder.

### Grup sohbetleri ve yöneticisi

Aynı ilkeller, farklı varsayımlar:

- Gözetmen: Bir ajan planlar yapar, diğerleri yürütür. Seçimci "planlayıcıya ne yapması gerektiğini sor".
- Grup sohbetleri: tüm ajanlar eşcinsidir; seçicisi paylaşılan havuz üzerinde bir fonksiyondur.

Her ikisi de Ders 04'ten dört ilksel kullanıyor. Grup sohbetleri standart olarak LLM seçtiği orkestrasyon ve tam bir havuz paylaşım durumuna kadar.

```figure
swarm-speaker
```

## Yapın

`code/main.py`Bu programın ilk başından itibaren, üç ajan (kodlayıcı, yorumcu, yöneticisi), grup ve LLM seçilen çeşitleri ve bir sonlandırma ile birlikte, bir`TERMINATE`- Bir işaret.

Demo, iki varians için konuşma transkripti ve seçicinin karar izini basar.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

## Kullan

`outputs/skill-groupchat-selector.md`belirli bir görev için GroupChat seçeneğini yapılandırır  round-robin vs LLM-seçilmiş vs özel, ve seçeneğin hangi girişlerini (son mesajlar, ajan uzmanlıkları, dönüş sayıları) kullanmak için.

## Gönder

Kontrol listesini:

- **Max rounds cap.**Her zaman. Tipik görevler için 10-20.
- **Speaker-balance metric.**İzleme aracı başına döner; dengesizlik bir eşiği aşırırken uyar.
- **Termination token.** `TERMINATE`veya özel bir doğrulama ajanı.
- **Projection or scoped memory.**~ 10 mesajdan sonra, bağlam şişmesini önlemek için her ajanı sadece bir kapsamlı görüntülemeyi düşünün.
- **Selector logging.**LLM seçilen variantlar için, seçicinin girişini ve seçimini kayıt edin. Aksi takdirde debugging imkansızdır.

## Egzersizler

1. Çık .`code/main.py`- Round-robin ve LLM seçilmişleri arasındaki konuşmayı karşılaştırın.
2. Seçicide "Agent başına maksimum konuşma" kuralını ekleyin.
3. Hedefine ulaşmış bir sonlama uygulayın: değerlendirici "tamklı" olarak döndüğünde durun.
4. GroupChat'ta AutoGen sabit belgeleri okuyun (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `GroupChatManager`- Evet .
5. AG2 repo'nu okuyun (https://github.com/ag2ai/ag2) ve v0.2 GroupChat'ı v0.4 olay yönlendirici sürümle karşılaştırın. v0.4 hangi spesifik özellikleri (sürümlilik, hata toleransı, komposabilite) ekler?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Daha Fazla Okumak

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) Referans uygulanması
- [AG2 repo](https://github.com/ag2ai/ag2) topluluk AutoGen v0.2 devamı
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) birleşmiş halefi, RC Şubat 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) olaylara dayalı aktör modelinin yeniden yazılması
