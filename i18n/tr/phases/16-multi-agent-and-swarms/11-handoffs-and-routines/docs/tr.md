# Elveriler ve Düzenler  Ülkesiz Orkestrasyon

> OpenAI'nin Swarm (Oktyabr 2024) iki primitif'e çoklu ajan orkestrasyonu destil etti: **routines**(elçiye talimatlar + araçlar sistem uyarısı olarak) ve **handoffs**(Bir diğer ajanı geri getiren bir araç). Devlet makinesi yok, DSL'yi branş etmeyin. OpenAI Ajanlar SDK (Mart 2025) üretim varisi. Swarm kendisi en temiz kavramsal referans olarak kalır  tüm kaynağı birkaç yüz satırda yer alır. Şekil viral çünkü API yüzeyi yaklaşık olarak "agent = prompt + tools; handoff = function returning agent".

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Sorun

Her multi-agent çerçevesinde DSL'lerini öğrenmenizi ister: LangGraph düğümleri ve kenarları, CrewAI ekipleri ve görevleri, AutoGen GroupChat ve yöneticileri. DSL'ler gerçek soyutlamalardır, ancak bu şeyleri olması gerektiğinden daha ağır hissettirirler.

Swarm ters yöne doğru itmektedir: modelin zaten sahip olduğu araç çağrı yeteneğini kullanın. Elveriler araç çağrıları haline gelir. Orkestör şu anda konuşmayı tutan ajandır. Devlet makinesi ajanların sistem isteklerinde iç içindir.

## Anlam

### İki ilkel

**Routine.**Bir ajanın rolünü ve mevcut araçları belirleyen bir sistem uyarısı. "Sen bir triage ajanısın; kullanıcı geri ödeme hakkında sorarsa geri ödeme ajanına teslim et".

**Handoff.**Swarm çalıştırma süresi, Agent'in geri dönüş değerini algılar ve aktif ajanı bir sonraki dönüş için değiştirir.

Bütün soyutlama bu.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

Sıralama ajanının sistem istekleri, kullanıcı mesajına göre doğru teslimatı seçmesini sağlar. LLM'nin araç çağrısı yönlendirme yapar.

### Neden viral?

- **Small API.**Öğrenmek için iki kavram var.
- **Uses what the model already does.**Araç çağrısı zaten tedarikçiler arasında üretim derecesindedir.
- **No state-machine burden.**Grafiği tanımlamazsın, ajanların istekleri kime teslim ettiklerini anlatır.

### Ülkesiz ticaret

Swarm, çalışmalar arasında açıkça devletsizdir. Çerçeve bir çalışmalar sırasında bir mesaj tarihi tutar, ancak hiçbir şey kalmaz. Hatıra, süreklilik, uzun süreli görevler  tüm arayanın sorunu.

Üretim (OpenAI Agents SDK, Mart 2025) bu değişen ana şeylerden biriydi: SDK, teslimatın ilkel tutulduğu halde, yerleşik oturum yönetimi, koruma rayları ve izleme ekler.

### Swarm/Handoffs uygun olduğunda

- **Triage patterns.**Ön hattı ajanı, kullanıcıyı uzmanlara yönlendirir.
- **Skill-based handoffs.**"Eğer görev için kod gerekiyorsa kodleyicisi arayın; araştırma gerekiyorsa araştırmacıyı arayın".
- **Short, bounded conversations.**Müşteri desteği, FAQ-to-ticket, basit iş akışları.

### Swarm'ın mücadele ettiği zaman

- **Long sessions with shared memory.**Handoffs, konuşma durumunu yeni ajanın istek artı geçmişine geri koymuştur.
- **Parallel execution.**Handoff, aktif ajanın bir seferde  anahtarlarıdır. Paralelism, arayanın birden fazla Swarm çalışmasını orkestralamasını gerektirir.
- **Audit and replay.**Devletsiz koşular tam olarak tekrarlanması zordur; LLM'nin teslimat seçimi belirlenmez.

### OpenAI Ajanlar SDK (Mart 2025)

Üretim varisi şunları ekliyor:

- **Session state.**Çekilenler arasında sürekli bir iplik.
- **Guardrails.**Giriş/çıktı doğrulama kaçağı.
- **Tracing.**Her araç çağrısı ve teslimatı kayıtlıdır.
- **Handoff filters.**Ne bağlamı transfer ettiğini kontrol et.

Elverme ilkeleri hayatta kalır; üretim ergonomikleri etrafında eklenir.

### Swarm vs GroupChat

Her ikisi de LLM yönlendirme kullanır, ancak farklılıkları var **who picks next**- ...

- Grup Çat: bir seçiciler (fonksiyon veya LLM) sonraki konuşmayı dışarıdan seçer.
- Swarm: mevcut ajan, bir teslim aracı çağırarak halefini seçer.

Swarm "Agent neyin bir sonraki kararını verir"; GroupChat "menedjer neyin bir sonraki kararını verir". Swarm'ın kararı aktif ajanın araç çağrısında yaşar; GroupChat'ın hayatı `GroupChatManager`- Evet .

```figure
sw-handoff-routing
```

## Yapın

`code/main.py`Swarm'i sıfırdan uyguluyor: Bir ajan veri sınıfı, bir teslim mekanizması (üçüm geri verir ajan), ve ajan anahtarlarını algılayan bir çalıştırma döngüsü.

Demo: bir triage ajanı geri ödeme, satış veya destek uzmanları için yollar. Her uzmanın kendi araçları vardır.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

## Kullan

`outputs/skill-handoff-designer.md`Bu, belirli bir görev için bir transfer topolojisini tasarlar: hangi ajanlar var, hangi transferleri çağırabilirler, hangi bağlamı aktarır.

## Gönder

Kontrol listesini:

- **Handoff logging.**Her teslimat bir olayı izler ve ajanlardan ajanlara bağlamlı bir anlık görüntüler yazır.
- **Context transfer rules.**Neyi taşıyacağınızı belirleyin: tam geçmiş (maliyet), son N mesajları veya bir özet.
- **Guardrail on handoff.**Farklı araç yetkileri olan bir uzmanın teslimatı doğrulanmalıdır  aksi takdirde hızlı enjeksiyon istenmeyen teslimatları zorlayabilir.
- **Loop detection.**İki ajan ileri geri dönerken ortak bir başarısızlık olur. Son K yüzük kontrolü ile tespit edilir.
- **Fallback agent.**Eğer bir teslim hedef mevcut değilse, güvenli bir özürlüğe geri dönün.

## Egzersizler

1. Çık .`code/main.py`İkinci turun aktif ajanının geri ödeme yapıldığını onaylayın.
2. Bir döngü tespit kuralı ekleyin: Aynı iki ajan üç kez sırayla teslim olduysa, çıkış zorlayın.
3. OpenAI Agents SDK dosyalarını teslimat filtreleri üzerine okuyun. "Handov-on-Handoff" sürümünü uygulayın: giden ajan, gelen ajanın devralmasından önce bağlamı bir mermi özetine sıkıştırır.
4. Swarm'ın teslimatını GroupChatManager seçicisi ile karşılaştırın. Hangi desen hızlı enjeksiyonu kötüleştirir ve neden?
5. Swarm yemek kitabı okuyun.https://developers.openai.com/cookbook/examples/orchestrating_agents). Açık bir tasarım kararı belirleyin Swarm OpenAI Ajanları SDK'sinin değiştirildiğini veya korunulduğunu yapar.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Daha Fazla Okumak

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Referans kelime
- [OpenAI Swarm repo](https://github.com/openai/swarm) orijinal uygulanma, kavramsal referans olarak saklanır
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) Sessiyon ve izleme ile üretim halefi
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) Claude Code alt üyeleri nasıl bir teslimat biçimi kullanıyor `Task`
