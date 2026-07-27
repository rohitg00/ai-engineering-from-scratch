# JAX'a Giriş

> PyTorch tensörleri mutasyona uğratır. TensorFlow grafikler oluşturur. JAX saf işlevleri derler. Bu sonuncusu deep learning hakkındaki düşüncelerinizi değiştiriyor.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 03 Dersler 01-10, temel NumPy
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- JAX'in işlevsel API'sini (jax.numpy, jax.grad, jax.jit, jax.vmap) kullanarak saf işlevli neural network kodunu yazın
- PyTorch'un istekli mutasyonu ile JAX'in işlevsel derleme modeli arasındaki temel tasarım farkını açıklayın
- Basit Python'a kıyasla eğitim döngülerini hızlandırmak için jit derlemesi ve vmap vektörizasyonunu uygulayın
- JAX'te basit bir ağ eğitin ve açık durum yönetimini PyTorch'un nesne yönelimli yaklaşımıyla karşılaştırın

## Sorun

PyTorch'ta neural network'lerin nasıl oluşturulacağını biliyorsunuz. Bir `nn.Module` tanımlarsınız, `.backward()`'yi çağırırsınız, optimize ediciyi adım atarsınız. İşe yarıyor. Milyonlarca insan kullanıyor.

Ancak PyTorch'un DNA'sında yer alan bir kısıtlama var: Python'da işlemleri teker teker hevesle takip ediyor. Her `tensor + tensor` ayrı bir çekirdek lansmanıdır. Her eğitim adımı aynı Python kodunu yeniden yorumlar. Bu, 2.048 TPU'da 540 milyar parametreli bir modeli eğitmeniz gerekene kadar işe yarar. O zaman genel gider seni öldürür.

Google DeepMind Gemini'yi JAX konusunda eğitiyor. Antropik, Claude'u JAX konusunda eğitti. Bunlar küçük operasyonlar değil; bunlar Dünya üzerindeki en büyük neural network eğitim çalışmalarıdır. JAX'ı seçtiler çünkü eğitim döngünüzü bir dizi Python çağrısı olarak değil, derlenebilir bir program olarak ele alıyor.

JAX, üç süper güce sahip NumPy'dir: otomatik farklılaştırma, XLA'ya JIT derlemesi ve otomatik vektörleştirme. Bir örneği işleyen bir fonksiyon yazarsınız. JAX size bir toplu işlemi işleyen, gradient'leri hesaplayan, makine kodunu derleyen ve birden fazla cihazda çalışan bir işlev sunar. Hepsi orijinal işlevi değiştirmeden.

## Konsept

### JAX Felsefesi

JAX işlevsel bir framework'dir. Sınıf yok, değiştirilebilir durum yok, `.backward()` yöntemi yok. Bunun yerine:

| PyTorch | JAX |
|---------|-----|
| Durumlu `nn.Module` sınıfı | Saf işlev: `f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| İstekli infaz | XLA aracılığıyla JIT derlemesi |
| `for x in batch:` manuel döngü | `jax.vmap(f)` otomatik vektörleştirme |
| `DataParallel` / `FSDP` | `jax.pmap(f)` otomatik paralellik |
| Değiştirilebilir `model.parameters()` | Dizilerin değişmez pytree'si |

Bu bir tarz tercihi değil. Bu bir derleyici kısıtlamasıdır. JIT derlemesi saf işlevler gerektirir; aynı girdiler her zaman aynı çıktıları üretir, yan etki olmaz. Bu kısıtlama, 100 kat hızlandırmayı mümkün kılan şeydir.

### jax.numpy: Tanıdık Yüzey

JAX, NumPy API'sini hızlandırıcılarda yeniden uygular:

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

Aynı işlev adları. Aynı yayın kuralları. Aynı dilimleme semantiği. Ancak diziler GPU/TPU'da bulunur ve her işlem derleyici tarafından izlenebilir.

Kritik bir fark: JAX dizileri değişmezdir. `a[0] = 5` yok. Bunun yerine: `a = a.at[0].set(5)`. Bu bir hafta boyunca garip geliyor, sonra işe yarıyor; `grad`, `jit` ve `vmap` gibi dönüşümleri şekillendirilebilir kılan şey değişmezliktir.

### jax.grad: İşlevsel Otomatik Fark

PyTorch, gradient'leri tensörlere (`.grad`) bağlar. JAX, gradient'leri işlevlere ekler.

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` bir işlevi alır ve gradient'yi hesaplayan yeni bir işlev döndürür. `.backward()` çağrısı yok. Tensörlerde saklanan hesaplama grafiği yok. gradient, çağırabileceğiniz, oluşturabileceğiniz veya JIT ile derleyebileceğiniz başka bir işlevdir.

Bu keyfi olarak oluşur:

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

İkinci türevler. Üçüncü türevler. Jakobenler. Hessianlılar. Tüm bunları `grad` oluşturarak yapın. PyTorch da bunu yapabilir (`torch.autograd.functional.hessian`), ancak cıvatalanmıştır. JAX'ta temeldir.

Kısıtlama: `grad` yalnızca saf işlevler üzerinde çalışır. İçeride yazdırma ifadesi yok (yürütme sırasında değil, izleme sırasında çalışırlar). Dış durumun mutasyonu yok. Açık anahtar yönetimi olmadan rastgele sayı üretimi yoktur.

### jit: XLA'ya derleyin

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

İlk çağrıda JAX işlevi izler; hangi işlemlerin gerçekleştiğini, bunları yürütmeden kaydeder. Daha sonra bu izi Google'ın TPU'lar ve GPU'lar için derleyicisi olan XLA'ya (Hızlandırılmış Doğrusal Cebir) aktarır. XLA işlemleri birleştirir, gereksiz bellek kopyalarını ortadan kaldırır ve optimize edilmiş makine kodu üretir.

Sonraki çağrılar Python'u tamamen atlar. Derlenen kod hızlandırıcıda C++ hızında çalışır.

JIT yardımcı olduğunda:
- Eğitim adımları (aynı hesaplama binlerce kez tekrarlandı)
- Inference (aynı model, farklı girişler)
- Benzer şekilli girdilerle birden fazla kez çağrılan herhangi bir işlev

JIT acıttığında:
- Değerlere bağlı Python kontrol akışına sahip işlevler (`if x > 0`, burada x izlenen bir dizidir)
- Tek seferlik hesaplamalar (derleme ek yükü çalışma süresini aşıyor)
- Hata ayıklama (izleme, gerçek yürütmeyi gizler)

Kontrol akışı kısıtlaması gerçektir. `jax.lax.cond`, `if/else`'nin yerine geçer. `jax.lax.scan`, `for` döngülerinin yerini alır. Bunlar isteğe bağlı değildir; bunlar derlemenin bedelidir.

### vmap: Otomatik Vektörleştirme

Bir örneği işleyen bir fonksiyon yazarsınız:

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` bir toplu işlemi işlemek için onu kaldırır:

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` şu anlama gelir: `params` (paylaşılan) üzerinde toplu işlem yapmayın, `x`'nin 0 ekseni üzerinde toplu iş yapmayın. Manuel `for` döngüsü yok. Yeniden şekillendirme yok. Toplu boyut iş parçacığı yok. JAX toplu iş boyutunu belirler ve tüm hesaplamayı vektörleştirir.

Bu sözdizimsel şeker değil. `vmap`, Python döngüsünden 10 ila 100 kat daha hızlı çalışan, kaynaştırılmış vektörleştirilmiş kod üretir. Ve `jit` ve `grad` ile oluşur:

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

Örnek başına gradient'ler. Bir satır. PyTorch'ta hack olmadan bu neredeyse imkansızdır.

### pmap: Cihazlar Arasında Veri Paralelliği

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap`, işlevi mevcut tüm cihazlara (GPU'lar/TPU'lar) kopyalar ve toplu işi böler. İşlev içinde, `jax.lax.pmean` ve `jax.lax.psum`, gradient'leri cihazlar arasında senkronize eder.

Google, Gemini'yi `pmap` (ve halefi `shard_map`) kullanarak binlerce TPU v5e yongası üzerinde eğitiyor. Programlama modeli: tek cihazlı sürümü yazın, `pmap` ile sarın, işlem tamam.

### Pytrees: Evrensel Veri Yapısı

JAX, "pytrees" (listelerin, dizilerin, dizinlerin ve dizilerin iç içe geçmiş kombinasyonları) üzerinde çalışır. Model parametreleriniz bir pytree'dir:

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

Her JAX dönüşümü (`grad`, `jit`, `vmap`) pytree'lerin nasıl geçileceğini bilir. `jax.tree.map(f, tree)`, `f`'yi her yaprağa uygular. Optimize ediciler tüm parametreleri aynı anda bu şekilde günceller:

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

`.parameters()` yöntemi yok. Parametre kaydı yok. Ağaç yapısı modeldir.

### İşlevsel ve Nesneye Yönelik

PyTorch, durumu nesnelerin içinde saklar:

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX, açık duruma sahip saf işlevleri kullanır:

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

Paramlar aktarılır. Hiçbir şey saklanmaz. Hiçbir şey mutasyona uğramadı. Bu, her fonksiyonun test edilebilir, birleştirilebilir ve derlenebilir olmasını sağlar. Bu aynı zamanda parametreleri kendiniz yöneteceğiniz veya Flax veya Equinox gibi bir kütüphane kullanacağınız anlamına da gelir.

### JAX Ekosistemi

JAX size ilkelleri verir. Kütüphaneler size ergonomi sağlar:

| Kütüphane | Rol | Stil |
|---------|------|-------|
| **Keten** (Google) | Neural network katmanları | Açık durumlu `nn.Module` |
| **Ekinoks** (Patrick Kidger) | Neural network katmanları | Pytree tabanlı, Pythonic |
| **Optax** (DeepMind) | Optimize Ediciler + LR programları | Şekillendirilebilir gradient dönüşümleri |
| **Orbax** (Google) | Kontrol Noktalama | Pytrees'i kaydet/geri yükle |
| **CLU** (Google) | Metrikler + günlük kaydı | Eğitim döngüsü yardımcı programları |

Optax standart optimize edici kütüphanesidir. gradient dönüşümünü (Adam, SGD, kırpma) parametre güncellemesinden ayırarak aşağıdakileri oluşturmayı önemsiz hale getirir:

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### JAX ve PyTorch Ne Zaman Kullanılmalı?

| Faktör | JAX | PyTorch |
|--------|-----|---------|
| TPU desteği | Birinci sınıf (her ikisini de Google oluşturdu) | Topluluk tarafından sürdürülen (torch_xla) |
| GPU desteği | İyi (XLA aracılığıyla CUDA) | Sınıfının en iyisi (yerel CUDA) |
| Hata ayıklama | Sert (izleme + derleme) | Kolay (hevesli, satır satır) |
| Ekosistem | Araştırma odaklı (Keten, Ekinoks) | Massive (HuggingFace, torchvision, vb.) |
| İşe alma | Niş (Google/DeepMind/Antropik) | Ana akım (her yerde) |
| Büyük ölçekli eğitim | Üstün (XLA, pmap, ağ) | İyi (FSDP, DeepSpeed) |
| Prototip oluşturma hızı | Daha yavaş (işlevsel ek yük) | Daha hızlı (mutasyona uğrayın ve gidin) |
| Üretim inference | TensorFlow Sunumu, Vertex AI | TorchServe, Triton, ONNX |
| Kim kullanıyor | DeepMind (İkizler), Antropik (Claude) | Meta (Llama), OpenAI (GPT), Kararlılık AI |

Dürüst cevap: JAX'i kullanmak için özel bir nedeniniz yoksa PyTorch'u kullanın. Bu nedenler şunlardır: TPU erişimi, örnek başına gradient'lere ihtiyaç, büyük ölçekte çoklu cihaz eğitimi veya Google/DeepMind/Anthropic'te çalışmak.

### JAX'ta Rastgele Sayılar

JAX'in küresel bir rastgele durumu yoktur. Her rastgele işlem açık bir PRNG anahtarı gerektirir:

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

Bu ilk başta can sıkıcıdır. Ancak cihazlar ve derlemeler arasında tekrarlanabilirliği garanti eder; bu, PyTorch'un `torch.manual_seed`'sinin çoklu GPU ayarlarında garanti edemediği bir özelliktir.

```figure
batchnorm-effect
```

## İnşa Et

### Adım 1: Kurulum ve Veriler

JAX ve Optax kullanarak MNIST üzerinde 3 katmanlı bir MLP eğiteceğiz. 784 giriş, 256 ve 128 nörondan oluşan iki gizli katman, 10 çıkış sınıfı.

```python
import jax
import jax.numpy as jnp
from jax import random
import optax

def get_mnist_data():
    from sklearn.datasets import fetch_openml
    mnist = fetch_openml('mnist_784', version=1, as_frame=False, parser='auto')
    X = mnist.data.astype('float32') / 255.0
    y = mnist.target.astype('int')
    X_train, X_test = X[:60000], X[60000:]
    y_train, y_test = y[:60000], y[60000:]
    return X_train, y_train, X_test, y_test
```

### Adım 2: Parametreleri Başlatın

Sınıf yok. Sadece bir pytree döndüren bir fonksiyon:

```python
def init_params(key):
    k1, k2, k3 = random.split(key, 3)
    scale1 = jnp.sqrt(2.0 / 784)
    scale2 = jnp.sqrt(2.0 / 256)
    scale3 = jnp.sqrt(2.0 / 128)
    params = {
        'layer1': {
            'w': scale1 * random.normal(k1, (784, 256)),
            'b': jnp.zeros(256),
        },
        'layer2': {
            'w': scale2 * random.normal(k2, (256, 128)),
            'b': jnp.zeros(128),
        },
        'layer3': {
            'w': scale3 * random.normal(k3, (128, 10)),
            'b': jnp.zeros(10),
        },
    }
    return params
```

Başlatma manuel olarak yapılır. Üç PRNG anahtarı bir tohumdan ayrıldı. Her ağırlık, iç içe geçmiş bir diktedeki değişmez bir dizidir.

### Adım 3: İleri Geçiş

```python
def forward(params, x):
    x = jnp.dot(x, params['layer1']['w']) + params['layer1']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer2']['w']) + params['layer2']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer3']['w']) + params['layer3']['b']
    return x

def loss_fn(params, x, y):
    logits = forward(params, x)
    one_hot = jax.nn.one_hot(y, 10)
    return -jnp.mean(jnp.sum(jax.nn.log_softmax(logits) * one_hot, axis=-1))
```

Saf işlevler. Paramlar içeri, tahmin dışarı. `self` yok, kayıtlı durum yok. `loss_fn` çapraz entropiyi sıfırdan hesaplar - softmax, log, negatif ortalama.

### Adım 4: JIT ile Derlenmiş Eğitim Adımı

```python
@jax.jit
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, params)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss

@jax.jit
def accuracy(params, x, y):
    logits = forward(params, x)
    preds = jnp.argmax(logits, axis=-1)
    return jnp.mean(preds == y)
```

`jax.value_and_grad`, tek geçişte hem kayıp değerini hem de gradient'leri döndürür. `@jax.jit` dekoratörü her iki işlevi de XLA'ya derler. İlk çağrıdan sonra her eğitim adımı Python'a dokunmadan çalışır.

### Adım 5: Eğitim Döngüsü

```python
optimizer = optax.adam(learning_rate=1e-3)

X_train, y_train, X_test, y_test = get_mnist_data()
X_train, X_test = jnp.array(X_train), jnp.array(X_test)
y_train, y_test = jnp.array(y_train), jnp.array(y_test)

key = random.PRNGKey(0)
params = init_params(key)
opt_state = optimizer.init(params)

batch_size = 128
n_epochs = 10

for epoch in range(n_epochs):
    key, subkey = random.split(key)
    perm = random.permutation(subkey, len(X_train))
    X_shuffled = X_train[perm]
    y_shuffled = y_train[perm]

    epoch_loss = 0.0
    n_batches = len(X_train) // batch_size
    for i in range(n_batches):
        start = i * batch_size
        xb = X_shuffled[start:start + batch_size]
        yb = y_shuffled[start:start + batch_size]
        params, opt_state, loss = train_step(params, opt_state, xb, yb)
        epoch_loss += loss

    train_acc = accuracy(params, X_train[:5000], y_train[:5000])
    test_acc = accuracy(params, X_test, y_test)
    print(f"Epoch {epoch + 1:2d} | Loss: {epoch_loss / n_batches:.4f} | "
          f"Train Acc: {train_acc:.4f} | Test Acc: {test_acc:.4f}")
```

10 dönem. ~%97 test doğruluğu. İlk dönem yavaştır (JIT derlemesi). 2-10 arası dönemler hızlıdır.

Neyin eksik olduğuna dikkat edin: `.zero_grad()` yok, `.backward()` yok, `.step()` yok. Güncellemenin tamamı, oluşturulmuş bir işlev çağrısıdır. Gradient'ler Adam tarafından hesaplanır, dönüştürülür ve parametrelere uygulanır; hepsi `train_step`'nin içindedir.

## Kullan onu

### Keten: Google Standardı

Keten en yaygın JAX neural network kütüphanesidir. `nn.Module`'yi geri ekler, ancak açık durum yönetimiyle:

```python
import flax.linen as nn

class MLP(nn.Module):
    @nn.compact
    def __call__(self, x):
        x = nn.Dense(256)(x)
        x = nn.relu(x)
        x = nn.Dense(128)(x)
        x = nn.relu(x)
        x = nn.Dense(10)(x)
        return x

model = MLP()
params = model.init(jax.random.PRNGKey(0), jnp.ones((1, 784)))
logits = model.apply(params, x_batch)
```

PyTorch ile aynı yapıdadır ancak `params` modelden farklıdır. `model.init()` parametreler oluşturur. `model.apply(params, x)` ileri pası çalıştırır. Model nesnesinin durumu yoktur.

### Ekinoks: Pythonic Alternatif

Equinox (Patrick Kidger tarafından) modelleri pytrees olarak temsil eder:

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

Modelin kendisi bir pytree'dir. `.apply()`'ye gerek yok. Parametreler yalnızca modelin yapraklarıdır. Bu, JAX'in düşüncesine daha yakın.

### Optax: Şekillendirilebilir Optimize Ediciler

Optax, gradient dönüşümünü güncellemeden ayırıyor:

```python
schedule = optax.warmup_cosine_decay_schedule(
    init_value=0.0, peak_value=1e-3,
    warmup_steps=1000, decay_steps=50000
)

optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adamw(learning_rate=schedule, weight_decay=0.01),
)
```

Gradient kırpma, öğrenme hızının ısınması, ağırlık azalması; bunların tümü bir dönüşüm zinciri olarak oluşur. Her dönüşüm gradient'leri görür, onları değiştirir ve bir sonrakine aktarır. Monolitik optimizer sınıfı yok.

## Gönderin

**Kurulum:**

```bash
pip install jax jaxlib optax flax
```

GPU desteği için:

```bash
pip install jax[cuda12]
```

TPU (Google Bulut) için:

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**Performans kazanımları:**

- İlk JIT çağrısı yavaştır (derleme). benchmarking'den önce ısın.
- JIT içindeki JAX dizileri üzerindeki Python döngülerinden kaçının. `jax.lax.scan` veya `jax.lax.fori_loop`'yi kullanın.
- `jax.debug.print()`, JIT'in içinde çalışır. Normal `print()` bunu yapmaz.
- `jax.profiler` veya TensorBoard'lu profil. XLA derlemesi darboğazları gizleyebilir.
- JAX, varsayılan olarak GPU belleğinin %75'ini önceden ayırır. `XLA_PYTHON_CLIENT_PREALLOCATE=false`'yi devre dışı bırakacak şekilde ayarlayın.

**Kontrol noktası oluşturma:**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**Bu ders şunları sağlar:**
- `outputs/prompt-jax-optimizer.md` -- doğru JAX optimize edici yapılandırmasını seçmek için bir prompt
- `outputs/skill-jax-patterns.md` - JAX'taki işlevsel kalıpları kapsayan bir beceri

## Egzersizler

1. MLP'ye bırakma ekleyin. JAX'te bırakma, bir PRNG anahtarı gerektirir; ileri geçişten bir anahtar geçirin ve onu her bırakma katmanı için bölün. Test doğruluğunu ile ve olmadan karşılaştırın.

2. 32 MNIST görüntüsünden oluşan bir grup için örnek başına gradient'leri hesaplamak için `jax.vmap`'yi kullanın. Her örnek için gradient normunu hesaplayın. Hangi örnekler en büyük gradient'lere sahiptir ve neden?

3. Manüel iletme işlevini, herhangi bir sayıda katman için çalışan genel bir `mlp_forward(params, x)` ile değiştirin. Derinliği otomatik olarak belirlemek için `jax.tree.leaves` kullanın.

4. Benchmark ile ve olmadan eğitim adımı`@jax.jit`. Her biri için 100 adımlık süre. Donanımınızdaki hızlanma ne kadar büyük? İlk aramadaki derleme yükü nedir?

5. `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` oluşturarak gradient kırpmayı uygulayın. Kırpma ile ve kesmeden eğitin. Etkiyi görmek için gradient normunu eğitim üzerine çizin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| XLA | "JAX'i hızlı yapan şey" | Hızlandırılmış Doğrusal Cebir - işlemleri birleştiren ve bir hesaplama grafiğinden optimize edilmiş GPU/TPU çekirdekleri üreten bir derleyici |
| JIT | "Tam zamanında derleme" | JAX, ilk çağrıda işlevi izler, XLA'ya derler, ardından derlenmiş sürümü sonraki çağrılarda çalıştırır |
| Saf fonksiyon | "Yan etkisi yok" | Çıktının yalnızca girdilere bağlı olduğu bir işlev - açık anahtarlar olmadan küresel durum yok, mutasyon yok, rastgelelik yok |
| sanal harita | "Otomatik gruplama" | Bir örneği işleyen bir işlevi, yeniden yazmaya gerek kalmadan bir toplu işlemi işleyen bir işleve dönüştürür |
| pmap | "Oto-paralellik" | Bir işlevi birden fazla cihazda çoğaltır ve giriş grubunu böler |
| Pytree | "Dizilerin iç içe diktesi" | JAX'in geçiş yapabileceği ve dönüştürebileceği herhangi bir iç içe geçmiş liste, veri kümesi, dizin ve dizi yapısı |
| İzleme | "Hesaplamayı kaydetme" | JAX, gerçek sonuçları hesaplamadan bir hesaplama grafiği oluşturmak için işlevi soyut değerlerle çalıştırır |
| Fonksiyonel otomatik fark | "bir fonksiyonun derecesi" | Türevleri, gradient depolama alanını tensörlere ekleyerek değil, fonksiyonları dönüştürerek hesaplamak |
| Optax | "JAX'in optimize edici kitaplığı" | gradient dönüşümlerinden oluşan şekillendirilebilir bir kitaplık (Adam, SGD, kırpma, planlama) birlikte zincirlenir |
| Keten | "JAX'in nn.Module'si" | Durumu açık tutarken katman soyutlamaları ekleyen Google'ın JAX için neural network kitaplığı |

## Daha Fazla Okuma

- JAX belgeleri: https://jax.readthedocs.io/ -- grad, jit ve vmap hakkında mükemmel eğitimler içeren resmi belgeler
- "JAX: Python+NumPy programlarının şekillendirilebilir dönüşümleri" (Bradbury ve diğerleri, 2018) -- tasarım felsefesini açıklayan orijinal makale
- Keten belgeleri: https://flax.readthedocs.io/ -- Google'ın JAX için neural network kitaplığı
- Patrick Kidger, "Equinox: çağrılabilir PyTrees ve filtrelenmiş dönüşümler yoluyla JAX'ta neural network'ler" (2021) -- Keten'e Pythonic alternatif
- DeepMind, "Optax: şekillendirilebilir gradient dönüşümü ve optimizasyonu" - standart optimize edici kitaplığı
- "JAX'i Bilmiyorsunuz" (Colin Raffel, 2020) -- T5 yazarlarından birinden JAX özellikleri ve kalıpları için pratik bir rehber
