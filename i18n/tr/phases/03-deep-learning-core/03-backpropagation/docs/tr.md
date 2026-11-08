# İptalden Geriye Yayılma

> Geri yayılma öğrenmeyi mümkün kılan algoritmadır.

**Type:** Build
**Languages:** Python, Julia, Rust
**Prerequisites:** Lesson 03.02 (Multi-Layer Networks)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Bilgisayar grafikini oluşturan ve topolojik sıralama yoluyla gradientleri hesaplayan değer tabanlı bir otograd motoru uygulayın
- Zincir kuralını kullanarak ekleme, katılım ve sigmoid için geriye geçiş çıkar
- XOR ve çevreler sınıflandırması üzerinde çok katmanlı bir ağ eğitmek sadece sıfırdan geri yayılma motoru kullanarak
- Derin sigmoid ağlarda kaybolan gradient sorunu tespit edin ve gradientlerin neden eksponansiyel olarak küçüldüğünü açıklayın

## Sorun

Ağınızdaki gizli bir katman var. 768 giriş ve 3072 çıkış var. Bu 2.359.296 ağırlık. Yanlış bir tahmin yaptı. Hangi ağırlıklar hatayı neden etti? Her ağırlığı bireysel olarak test etmek 2.3 milyon ileri geçişi demektir. Geri yayılma tek bir geri geçişi içinde tüm 2.3 milyon gradient hesaplar. Bu bir optimizasyon değil. Bu eğitimlenebilir ve imkansız arasındaki fark.

Saçma yaklaşım: bir ağırlık al, onu küçük bir miktarla it, ileri geçiş tekrar çalış, kayıpın yükselmiş veya düşmüş olup olmadığını ölç. Bu size bu ağırlığın eğilimi verir. Şimdi bunu ağdaki her ağırlık için yapın. Binlerce eğitim adımıyla ve milyonlarca veri noktasıyla çoğaltın.

Geriye yayılma bunu çözüyor. Bir ileri geçiş, bir geri geçiş, tüm gradientler hesaplanmış. Hile, hesaplama kuralından gelen zincir kuralıdır, sistematik olarak bir hesaplama grafikine uygulanır. Bu derin öğrenmeyi pratik yapan algoritmadır.

## Anlaşım

### Ağlar için uygulanan zincir kuralı

01-ci aşamada zincir kuralını gördün. 5. Ders.$y = f(g(x))$O zaman ...$\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$- Dolayıları zincir boyunca çoğaltıyorsun.

Bir sinir ağında, " zincir " girişten kayba kadar işlemlerin sırasıdır. Her katman ağırlık uyguluyor, tarafsızlıklar ekliyor, bir etkinleştirme üzerinden geçiyor. Kayıp işlevi son çıkışı hedefe karşılaştırır. Geri yayılma bu zinciri geriye doğru izler ve her işlemin hataya nasıl katkıda bulunduğunu hesaplar.

### Hesaplama Grafikleri

Her ileri geçiş bir grafik oluşturur. Her düğüm bir işlemdir (çıkartmak, eklemek, sigmoid). Her kenar ileri bir değer ve geriye bir eğilimi taşır.

```mermaid
graph LR
    x["x"] --> mul["*"]
    w["w"] --> mul
    mul -- "z1 = w*x" --> add["+"]
    b["b"] --> add
    add -- "z2 = z1 + b" --> sig["sigmoid"]
    sig -- "a = sigmoid(z2)" --> loss["Loss"]
    y["target"] --> loss
```

Ön geçiş: değerler sola sağa akıyor. $x$ve $w$ürünler$z_1 = w x$Ekle .$b$Almak için$z_2$Sigmoid aktive eder .$a$- Ben de .$a$Hedef olarak$y$Kayıp fonksiyonunu kullanmak.

Geriye geçiş: eğrilikler sağdan sola akıyor.$\partial L/\partial a$(aktifikasyonla birlikte kayıpların değişimi).$\partial a/\partial z_2$Bu da verir.$\partial L/\partial z_2$- Bölünmüş .$\partial L/\partial b$(Bu da $\partial L/\partial z_2$, o zamandan beri$z_2 = z_1 + b$) ve $\partial L/\partial z_1$- O zaman ...$\partial L/\partial w = \partial L/\partial z_1 \cdot x$ve $\partial L/\partial x = \partial L/\partial z_1 \cdot w$- Evet .

Grafdaki her düğümün geriye geçiş sırasında bir işi vardır: yukarıdan gelen eğilimi alın, yerel türevine çarpın ve aşağıya geçin.

### Önde Geriye

```mermaid
graph TB
    subgraph Forward["Forward Pass"]
        direction LR
        f1["Input x"] --> f2["z = Wx + b"]
        f2 --> f3["a = sigmoid(z)"]
        f3 --> f4["Loss = (a - y)^2"]
    end
    subgraph Backward["Backward Pass"]
        direction RL
        b4["dL/dL = 1"] --> b3["dL/da = 2(a-y)"]
        b3 --> b2["dL/dz = dL/da * a(1-a)"]
        b2 --> b1["dL/dW = dL/dz * x\ndL/db = dL/dz"]
    end
    Forward --> Backward
```

Ön geçit her orta değerleri saklar: z, a, her katman girişleri. Geri geçit gradientleri hesaplamak için bu kaydedilen değerlere ihtiyaç duyar. Bu, geri geçitlerin kalbindeki bellek-bilgisayar pazarlamasıdır.

### Bir Ağ İçin Geçici Akış

Üç katmanlı bir ağ için, her katman boyunca gradient zinciri:

```mermaid
graph RL
    L["Loss"] -- "dL/da3" --> L3["Layer 3\na3 = sigmoid(z3)"]
    L3 -- "dL/dz3 = dL/da3 * sigmoid'(z3)" --> L2["Layer 2\na2 = sigmoid(z2)"]
    L2 -- "dL/dz2 = dL/da2 * sigmoid'(z2)" --> L1["Layer 1\na1 = sigmoid(z1)"]
    L1 -- "dL/dz1 = dL/da1 * sigmoid'(z1)" --> I["Input"]
```

Her katman, gradient sigmoid türevliyle çarpılır.$a(1 - a)$, en yüksek 0.25 ($a = 0.5$3 kat derinlikte, en fazla bir kat daha fazla merdiven çarpılmıştır.$0.25^3 = 0.0156$- 10 kat derinlik:$0.25^{10} = 0.000001$- Evet .

### Kaybolan Değillikler

Bu, kaybolan gradient sorunu. Sigmoid, çıkışını 0 ile 1 arasında sıkıştırır. Doğrulanması her zaman 0.25'ten daha azdır.

```
sigmoid(z):     Output range [0, 1]
sigmoid'(z):    Max value 0.25 (at z = 0)

After 5 layers:   gradient * 0.25^5 = 0.001x original
After 10 layers:  gradient * 0.25^10 = 0.000001x original
```

Bu nedenle derin sigmoid ağları eğitmek neredeyse imkansızdır. Bu düzeltme - ReLU ve onun çeşitleri - Ders 04'ün konusu. Şimdilik, arka destek mükemmel şekilde çalışır. Sorun, neyle çalıştığını anlamaktır.

### İki katmanlı ağ için gradiyent çıkarmak

Giriş ile bir ağ için beton matematik $x$Sigmoid ile gizli katman, sigmoid ile çıkış katman ve MSE kaybı.

Ön geçit:

```math
\begin{aligned}
z_1 &= W_1 x + b_1 \\
a_1 &= \text{sigmoid}(z_1) \\
z_2 &= W_2 a_1 + b_2 \\
a_2 &= \text{sigmoid}(z_2) \\
L &= (a_2 - y)^2
\end{aligned}
```

Geriye geçiş (çeşitli bir zincir kuralını adım adım uygulayarak):

```math
\begin{aligned}
\frac{\partial L}{\partial a_2} &= 2(a_2 - y) \\
\frac{\partial a_2}{\partial z_2} &= a_2 (1 - a_2) \\
\frac{\partial L}{\partial z_2} &= \frac{\partial L}{\partial a_2} \cdot \frac{\partial a_2}{\partial z_2} = 2(a_2 - y) \cdot a_2 (1 - a_2) \\[6pt]
\frac{\partial L}{\partial W_2} &= \frac{\partial L}{\partial z_2} \cdot a_1 \\
\frac{\partial L}{\partial b_2} &= \frac{\partial L}{\partial z_2} \\[6pt]
\frac{\partial L}{\partial a_1} &= \frac{\partial L}{\partial z_2} \cdot W_2 \\
\frac{\partial a_1}{\partial z_1} &= a_1 (1 - a_1) \\
\frac{\partial L}{\partial z_1} &= \frac{\partial L}{\partial a_1} \cdot \frac{\partial a_1}{\partial z_1} \\[6pt]
\frac{\partial L}{\partial W_1} &= \frac{\partial L}{\partial z_1} \cdot x \\
\frac{\partial L}{\partial b_1} &= \frac{\partial L}{\partial z_1}
\end{aligned}
```

Her gradient kayıptan sonra gelen yerel türevlerin bir ürünüdür.

```figure
backprop-vanishing
```

## Yapın

### Adım 1: Değer düğümü

Hesaplamalarımızdaki her sayı bir Değer olur. Verilerini, gradientlerini ve nasıl yaratıldığını saklar (böylece gradientleri geriye doğru nasıl hesaplayacağını bilir).

```python
class Value:
    def __init__(self, data, children=(), op=''):
        self.data = data
        self.grad = 0.0
        self._backward = lambda: None
        self._children = set(children)
        self._op = op

    def __repr__(self):
        return f"Value(data={self.data:.4f}, grad={self.grad:.4f})"
```

Henüz gradient yok (0.0). Henüz geriye doğru işlevi yok (op).`_children`Bu değerleri hangi değerler ürettiğini izleyelim. Böylece grafikleri topolojik olarak sıralayabiliriz.

### İkinci Adım: Geriye dönük İşlemler

Her işlem yeni bir değer oluşturur ve gradientlerin nasıl geriye doğru akıştığını tanımlar.

```python
def __add__(self, other):
    other = other if isinstance(other, Value) else Value(other)
    out = Value(self.data + other.data, (self, other), '+')

    def _backward():
        self.grad += out.grad
        other.grad += out.grad

    out._backward = _backward
    return out

def __mul__(self, other):
    other = other if isinstance(other, Value) else Value(other)
    out = Value(self.data * other.data, (self, other), '*')

    def _backward():
        self.grad += other.data * out.grad
        other.grad += self.data * out.grad

    out._backward = _backward
    return out
```

Ekleyici için: $\partial(a+b)/\partial a = 1$- Evet .$\partial(a+b)/\partial b = 1$Yani her iki giriş de çıkışın gradiyentiyi doğrudan alır.

Karıştırma için: $\partial(ab)/\partial a = b$- Evet .$\partial(ab)/\partial b = a$Her giriş diğerinin değerini çıkış gradiyentiyle çarpıyor.

- Evet .`+=`Bir değer birden fazla işlemde kullanılabilir.

### Adım 3: Sigmoid ve Kayıp

```python
import math

def sigmoid(self):
    x = self.data
    x = max(-500, min(500, x))
    s = 1.0 / (1.0 + math.exp(-x))
    out = Value(s, (self,), 'sigmoid')

    def _backward():
        self.grad += (s * (1 - s)) * out.grad

    out._backward = _backward
    return out
```

Sigmoid türevli: $\text{sigmoid}(x) \cdot (1 - \text{sigmoid}(x))$- Bilgisayar yaptık .$\text{sigmoid}(x) = s$- Ön geçiş sırasında tekrar kullan.

```python
def mse_loss(predicted, target):
    diff = predicted + Value(-target)
    return diff * diff
```

Tek çıkış için MSE: $(\text{predicted} - \text{target})^2$Kısıtlama, bir değerle eklenmiş bir değer olarak ifade edilir.

### Dördüncü Adım: Geriye Geç

Topolojik sınıflandırma, düğümleri doğru sırada işlemeyi sağlar. Bir düğümün gradiyenti, ondan yayılmadan önce tamamen toplanır.

```python
def backward(self):
    topo = []
    visited = set()

    def build_topo(v):
        if v not in visited:
            visited.add(v)
            for child in v._children:
                build_topo(child)
            topo.append(v)

    build_topo(self)
    self.grad = 1.0
    for v in reversed(topo):
        v._backward()
```

Kayıptan başlayın (gradiyent = 1.0, çünkü $dL/dL = 1$Arka tarafa doğru yürü, sıralanmış grafik boyunca.`_backward`Çocuklarına doğru eğilimi zorlar.

### Adım 5: Katman ve ağ

```python
import random

class Neuron:
    def __init__(self, n_inputs):
        scale = (2.0 / n_inputs) ** 0.5
        self.weights = [Value(random.uniform(-scale, scale)) for _ in range(n_inputs)]
        self.bias = Value(0.0)

    def __call__(self, x):
        act = sum((wi * xi for wi, xi in zip(self.weights, x)), self.bias)
        return act.sigmoid()

    def parameters(self):
        return self.weights + [self.bias]


class Layer:
    def __init__(self, n_inputs, n_outputs):
        self.neurons = [Neuron(n_inputs) for _ in range(n_outputs)]

    def __call__(self, x):
        out = [n(x) for n in self.neurons]
        return out[0] if len(out) == 1 else out

    def parameters(self):
        params = []
        for n in self.neurons:
            params.extend(n.parameters())
        return params


class Network:
    def __init__(self, sizes):
        self.layers = []
        for i in range(len(sizes) - 1):
            self.layers.append(Layer(sizes[i], sizes[i + 1]))

    def __call__(self, x):
        for layer in self.layers:
            x = layer(x)
            if not isinstance(x, list):
                x = [x]
        return x[0] if len(x) == 1 else x

    def parameters(self):
        params = []
        for layer in self.layers:
            params.extend(layer.parameters())
        return params

    def zero_grad(self):
        for p in self.parameters():
            p.grad = 0.0
```

Bir nöron girişleri alır, ağırlıklı toplam + tarafsızlığı hesaplar ve sigmoid uyguluyor.$\sqrt{2/n_{\text{inputs}}}$Bir katman nöronların bir listesidir. Bir ağ katmanların bir listesidir.`parameters()`Metod, öğrenilebilir değerleri toplar böylece onları güncelleyebiliriz.

### Adım 6: XOR'da tren

```python
random.seed(42)
net = Network([2, 4, 1])

xor_data = [
    ([0.0, 0.0], 0.0),
    ([0.0, 1.0], 1.0),
    ([1.0, 0.0], 1.0),
    ([1.0, 1.0], 0.0),
]

learning_rate = 1.0

for epoch in range(1000):
    total_loss = Value(0.0)
    for inputs, target in xor_data:
        x = [Value(i) for i in inputs]
        pred = net(x)
        loss = mse_loss(pred, target)
        total_loss = total_loss + loss

    net.zero_grad()
    total_loss.backward()

    for p in net.parameters():
        p.data -= learning_rate * p.grad

    if epoch % 100 == 0:
        print(f"Epoch {epoch:4d} | Loss: {total_loss.data:.6f}")

print("\nXOR Results:")
for inputs, target in xor_data:
    x = [Value(i) for i in inputs]
    pred = net(x)
    print(f"  {inputs} -> {pred.data:.4f} (expected {target})")
```

Rastgele tahminlerden XOR çıkışlarını düzeltmeye kadar, tamamen geri yayılma bilgisayar gradientleri ve doğru yönde ağırlıkların itirilmesi ile yönlendirilir.

### Adım 7: Çember sınıflandırması

Ders 02, çember sınıflandırması için ağırlıkları elle ayarladınız.

```python
random.seed(7)

def generate_circle_data(n=100):
    data = []
    for _ in range(n):
        x1 = random.uniform(-1.5, 1.5)
        x2 = random.uniform(-1.5, 1.5)
        label = 1.0 if x1 * x1 + x2 * x2 < 1.0 else 0.0
        data.append(([x1, x2], label))
    return data

circle_data = generate_circle_data(80)

circle_net = Network([2, 8, 1])
learning_rate = 0.5

for epoch in range(2000):
    random.shuffle(circle_data)
    total_loss_val = 0.0
    for inputs, target in circle_data:
        x = [Value(i) for i in inputs]
        pred = circle_net(x)
        loss = mse_loss(pred, target)
        circle_net.zero_grad()
        loss.backward()
        for p in circle_net.parameters():
            p.data -= learning_rate * p.grad
        total_loss_val += loss.data

    if epoch % 200 == 0:
        correct = 0
        for inputs, target in circle_data:
            x = [Value(i) for i in inputs]
            pred = circle_net(x)
            predicted_class = 1.0 if pred.data > 0.5 else 0.0
            if predicted_class == target:
                correct += 1
        accuracy = correct / len(circle_data) * 100
        print(f"Epoch {epoch:4d} | Loss: {total_loss_val:.4f} | Accuracy: {accuracy:.1f}%")
```

Burada online SGD kullanıyoruz. Tüm partiyi toplamak yerine her örnekten sonra ağırlıkları güncelleyelim. Bu simetriyi daha hızlı bozar ve tüm kayıp manzarasında sigmoid doymuşluğu önler. Verileri her dönemle karıştırmak ağın sırayı ezberlemesini engeller.

Bu, arka planlama gücünün bir parçasıdır: mimari, kayıp fonksiyonu ve verileri tanımlarsınız.

## Kullan

PyTorch yukarıdaki her şeyi birkaç satırla yapar. Temel fikir aynıdır. Autograd ileri geçiş sırasında bir hesaplama grafiği oluşturur ve geriye doğru gradient hesaplamak için izler.

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(2, 4),
    nn.Sigmoid(),
    nn.Linear(4, 1),
    nn.Sigmoid(),
)
optimizer = torch.optim.SGD(model.parameters(), lr=1.0)
criterion = nn.MSELoss()

X = torch.tensor([[0,0],[0,1],[1,0],[1,1]], dtype=torch.float32)
y = torch.tensor([[0],[1],[1],[0]], dtype=torch.float32)

for epoch in range(1000):
    pred = model(X)
    loss = criterion(pred, y)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

print("PyTorch XOR Results:")
with torch.no_grad():
    for i in range(4):
        pred = model(X[i])
        print(f"  {X[i].tolist()} -> {pred.item():.4f} (expected {y[i].item()})")
```

`loss.backward()`Senin mi ?`total_loss.backward()`- Evet .`optimizer.step()`Bu senin el kitabın mı?`p.data -= lr * p.grad`- Evet .`optimizer.zero_grad()`Senin mi ?`net.zero_grad()`PyTorch GPU hızlandırmasını, karışık hassaslığı, gradient kontrol noktasını ve yüzlerce katman türünü işliyor.

Eğitim ileri geçiş, sonra geri geçiş, sonra ağırlıkları güncelleştirir. İndirim sadece ileri geçiş yapar. - Ne de yükseltme, ne de güncelleme. Bu fark önemlidir çünkü sonuç üretimde olan şeydir. Claude veya GPT gibi bir API'yi aradığınızda, sonuç çıkarıyorsunuz. Cevap ağda ilerliyor ve tokenler diğer ucundan çıkıyor. Ağırlık değişmez. Arka tarafı anlamak önemlidir çünkü bu ağdaki her ağırlığı şekillendirdi.

## Gönder

Bu ders şunları ortaya çıkarır:
- `outputs/prompt-gradient-debugger.md`-- herhangi bir sinir ağında gradient sorunlarını (kayıp çıkmak, patlama, NaN) teşhis etmek için tekrar kullanılabilir bir istek.

## Egzersizler

1. Bir ekle`__sub__`Değer sınıfına yöntemi $(a - b = a + (-1 \cdot b))$Sonra bir `__neg__`Bu yöntem, gradientlerin doğru olup olmadığını basit bir ifade için el hesabı ile karşılaştırarak doğrulayabilir.$(a - b)^2$- Evet .

2. Bir ekle`relu`Değer (çıkış)$\max(0, x)$, türev 1 ise $x \gt 0$Sigmoid'i gizli katmanlarda relü ile değiştirin ve tekrar XOR'da çalıştırın.

3. A.`__pow__`Tam sayı güçleri için değer üzerinde yöntem.`mse_loss`- Evet.`(predicted - target) ** 2`Bu ifade, orijinal uygulamaya uygun olduğunu doğrula.

4. Eğitim döngüsüne gradient kesimi ekleyin: çağrıdan sonra `backward()`... tüm gradientleri [-1, 1'e] ayırın. Daha derin bir ağ (sigmoid ile 4+ katman) çalıştırın ve kayıp eğrilerini kesme ile ve kesmeden karşılaştırın. Bu patlama gradientlerine karşı ilk savunmanız.

5. Bir görselleştirme oluşturun: XOR üzerinde eğitim aldıktan sonra, ağdaki her parametrenin gradiyenti basın. En küçük gradiyenti olan katmanın kim olduğunu belirleyin. Bu, Konsep bölümünde okuduğunuz kaybolan gradiyenti sorunu gösterir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Backpropagation | "The network learns" | An algorithm that computes $\partial L/\partial w$ for every weight by applying the chain rule backward through the computational graph |
| Computational graph | "The network structure" | A directed acyclic graph where nodes are operations and edges carry values (forward) and gradients (backward) |
| Chain rule | "Multiply the derivatives" | If $y = f(g(x))$, then $\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$ -- the mathematical foundation of backpropagation |
| Gradient | "The direction of steepest ascent" | The partial derivative of the loss with respect to a parameter -- tells you how to change that parameter to reduce the loss |
| Vanishing gradient | "Deep networks don't learn" | Gradients shrink exponentially as they propagate through layers with saturating activations like sigmoid |
| Forward pass | "Running the network" | Computing the output from inputs by sequentially applying each layer's operations and storing intermediate values |
| Backward pass | "Computing gradients" | Traversing the computational graph in reverse, accumulating gradients at each node using the chain rule |
| Learning rate | "How fast it learns" | A scalar that controls the step size when updating weights: $w_{\text{new}} = w_{\text{old}} - \text{lr} \cdot \text{gradient}$ |
| Topological sort | "The right order" | An ordering of graph nodes where each node appears after all nodes it depends on -- ensures gradients are fully accumulated before propagation |
| Autograd | "Automatic differentiation" | A system that builds computational graphs during forward computation and automatically computes gradients -- what PyTorch's engine does |

## Daha Fazla Okumak

- Rumelhart, Hinton & Williams, "Back-propagation errors" (1986) - Back-propagation mainstream ve kilitlenmemiş çok katmanlı ağ eğitimi yapan makale
- 3Blue1Brown, "Nöral Ağlar" serisi (https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi) -- ağlardaki geri yayılma ve gradient akışının en iyi görsel açıklaması
