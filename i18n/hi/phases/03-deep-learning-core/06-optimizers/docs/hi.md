# अनुकूलन

> ग्रेडिएंट डाउनसेन्ट आपको बताता है कि किस दिशा में आगे बढ़ना है, यह बताता है कि कितनी दूर या कितनी तेजी से। एसजीडी एक पैंपस है। एडम ट्रैफिक डेटा के साथ जीपीएस है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Lesson 03.05 (Loss Functions)
**Time:** ~75 minutes

## सीखने के लक्ष्य

- पायथन में स्क्रैच से SGD, गति के साथ SGD, एडम, और एडमडब्ल्यू अनुकूलक लागू करें
- बताएं कि आदम की पूर्वाग्रह सुधार प्रारंभिक प्रशिक्षण चरणों में शून्य-प्रारंभिक क्षण अनुमानों की भरपाई कैसे करती है
- यह प्रदर्शित करें कि क्यों एडमडब्ल्यू एक ही कार्य पर एल 2 नियमितता के साथ एडम की तुलना में बेहतर सामान्यीकरण का उत्पादन करता है
- ट्रांसफार्मर, सीएनएन, जीएएन और फाइन-ट्यूनिंग के लिए उपयुक्त अनुकूलक और डिफ़ॉल्ट हाइपरपैरामीटर चुनें

## समस्या

आप ग्रेडिएंट की गणना की है. आप जानते हैं कि वजन # 4,721 नुकसान को कम करने के लिए 0.003 से कम होना चाहिए. लेकिन 0.003 किस इकाइयों में? किस पैमाने पर? और क्या आप कदम 1 पर एक ही राशि को कदम 1,000 पर ले जाना चाहिए?

वैनिला ग्रेडिएंट गिरावट प्रत्येक चरण पर प्रत्येक पैरामीटर पर एक ही सीखने की दर लागू करता हैः $w = w - \text{lr} \cdot \text{gradient}$इससे तीन समस्याएं पैदा होती हैं जो तंत्रिका नेटवर्क को अभ्यास में दर्दनाक बनाती हैं।

पहले, घर्षण। नुकसान का परिदृश्य शायद ही कभी एक चिकनी कटोरे के रूप में आकार में होता है। यह एक लंबी, संकीर्ण घाटी की तरह है। ग्रिडिएंट घाटी के पार (ढीली दिशा) की ओर इंगित करता है, इसके साथ नहीं (छोटी दिशा) । संकीर्ण आयाम में ग्रिडिएंट उतार-चढ़ाव आगे-पीछे कूदता है जबकि उपयोगी आयाम के साथ छोटी प्रगति करता है। आपने देखा है कि नुकसान तेजी से गिरता है, इसलिए नहीं कि मॉडल एक साथ आता है, बल्कि इसलिए कि यह टहलता है।

दूसरे, सभी मापदंडों के लिए एक सीखने की दर गलत है। कुछ वजन को बड़े अपडेट की आवश्यकता होती है (वे शुरुआती, अनुचित चरण में हैं) । दूसरों को छोटे अपडेट की आवश्यकता होती है (वे अपने इष्टतम मूल्य के करीब हैं) । एक सीखने की दर जो पहले के लिए काम करती है, बाद के को नष्ट करती है, और इसके विपरीत।

तीसरा, सड़कों के बिंदु। उच्च आयामों में, हानि परिदृश्य में विशाल समतल क्षेत्र हैं जहां गिरावट शून्य के करीब है। वैनिला एसजीडी गिरावट की गति से इन के माध्यम से क्रॉल करता है, जो प्रभावी रूप से शून्य है। मॉडल फंस गया लगता है। यह फंस गया नहीं है - यह एक समतल क्षेत्र में है, दूसरी तरफ उपयोगी उतार-चढ़ाव के साथ। लेकिन एसजीडी में इसके माध्यम से धक्का देने की कोई तंत्र नहीं है।

एडम तीनों को हल करता है। यह प्रति पैरामीटर दो चलती औसत बनाए रखता है - औसत ग्रेडिएंट (मोमेंटम, हैंडल ओस्किलेशन) और औसत वर्ग ग्रेडिएंट (अनुकूली दर, विभिन्न पैमाने को संभालता है) । पहले कुछ चरणों के लिए पूर्वाग्रह सुधार के साथ संयुक्त, यह आपको एक एकल अनुकूलक देता है जो डिफ़ॉल्ट हाइपरपैरामीटर के साथ 80% समस्याओं पर काम करता है। यह सबक इसे खरोंच से बनाता है ताकि आप समझ सकें कि यह बाकी 20% पर कब और क्यों विफल रहता है।

## अवधारणा

### स्टोकास्टिक ग्रेडिएंट डाउनडेन्स (SGD)

सबसे सरल अनुकूलक. एक मिनी बैच पर ग्रेडिएंट की गणना और विपरीत दिशा में कदम.

```math
w = w - \text{lr} \cdot \text{gradient}
```

"स्टोकास्टिक" का मतलब है कि आप डेटा के एक यादृच्छिक उपसमूह (मिनी बैच) का उपयोग कर ग्रेडिएंट का अनुमान लगाने के लिए करते हैं, पूरे डेटा सेट के बजाय। यह शोर वास्तव में उपयोगी है - यह तेज स्थानीय न्यूनतम से बचने में मदद करता है। लेकिन शोर भी कंपन का कारण बनता है।

सीखने की दर एकमात्र बटन है। बहुत अधिकः नुकसान भिन्न होता है। बहुत कमः प्रशिक्षण हमेशा लेता है। इष्टतम मूल्य वास्तुकला, डेटा, बैच आकार और प्रशिक्षण के वर्तमान चरण पर निर्भर करता है। आधुनिक नेटवर्क पर वैनिला एसजीडी के लिए, विशिष्ट मान 0.01 से 0.1 तक होते हैं। लेकिन एक प्रशिक्षण रन के भीतर भी, आदर्श सीखने की दर बदलती है।

### गति

गेंद-रोलिंग-डाउनहिल एनालॉग का प्रयोग अधिक होता है लेकिन सटीक होता है. केवल ग्रेडिएंट से आगे बढ़ने के बजाय, आप एक गति बनाए रखते हैं जो पिछले ग्रेडिएंट को जमा करती है।

```math
\begin{aligned}
m_t &= \beta \, m_{t-1} + \text{gradient} \\
w &= w - \text{lr} \cdot m_t
\end{aligned}
```

बीटा (आमतौर पर 0.9) यह नियंत्रित करता है कि इतिहास को कितना रखना है।$\beta = 0.9$, गति लगभग पिछले 10 ग्रेडिएंट के औसत है ($1 / (1 - 0.9) = 10$) ।

इस प्रकार, एक ही दिशा में इंगित करने वाले ग्रेडिएंट जमा होते हैं। उस संकीर्ण घाटी में, "पार" घटक हर कदम को चिह्नित करता है और डम्बल हो जाता है। "साथ" घटक स्थिर रहता है और बढ़ जाता है। परिणाम उपयोगी दिशा में चिकनी त्वरण है।

वास्तविक संख्याः केवल खराब स्थिति में नुकसान परिदृश्य पर SGD 10,000 कदम ले सकता है।$\beta = 0.9$) आमतौर पर एक ही समस्या पर 3,000 से 5,000 कदम लेता है। गति सीमांत नहीं है।

### आरएमएसपीआरपी

पहली पैरामीटर प्रति अनुकूलन सीखने की दर विधि जो वास्तव में काम करती है। एक कोर्सरा व्याख्यान में हिंटन द्वारा प्रस्तावित (आधिकारिक रूप से कभी प्रकाशित नहीं किया गया) ।

```math
\begin{aligned}
s_t &= \beta \, s_{t-1} + (1 - \beta) \cdot \text{gradient}^2 \\
w &= w - \text{lr} \cdot \frac{\text{gradient}}{\sqrt{s_t} + \epsilon}
\end{aligned}
```

$s_t$एक बार जब एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक

यह "सभी मापदंडों के लिए एक सीखने की दर" समस्या को हल करता है. एक वजन जो पहले से ही बड़े अपडेट प्राप्त कर रहा है शायद अपने लक्ष्य के करीब है - इसे धीमा करें. एक वजन जो छोटे अपडेट प्राप्त कर रहा है शायद कम प्रशिक्षित है - इसे गति दें.

एप्सिलन (आमतौर पर 1e-8) शून्य से विभाजन को रोकता है जब किसी पैरामीटर को अपडेट नहीं किया गया है।

### एडमः गति + आरएमएसप्रॉप

एडम दोनों विचारों को जोड़ता है। यह प्रति पैरामीटर दो घातीय चलती औसत बनाए रखता हैः

```math
\begin{aligned}
m_t &= \beta_1 m_{t-1} + (1 - \beta_1) \cdot \text{gradient} && \text{(first moment: mean)} \\
v_t &= \beta_2 v_{t-1} + (1 - \beta_2) \cdot \text{gradient}^2 && \text{(second moment: variance)}
\end{aligned}
```

**Bias correction**यह मुख्य विवरण है अधिकांश स्पष्टीकरण छोड़. चरण 1, $m_1 = (1 - \beta_1) \cdot \text{gradient}$. के साथ $\beta_1 = 0.9$, यह है $0.1 \cdot \text{gradient}$-- दस गुना छोटा है. चलती औसत अभी तक गर्म नहीं हुआ है. पूर्वाग्रह सुधार मुआवजाः

```math
\begin{aligned}
\hat{m} &= \frac{m_t}{1 - \beta_1^t} \\
\hat{v} &= \frac{v_t}{1 - \beta_2^t}
\end{aligned}
```

 के साथ चरण 1 पर$\beta_1 = 0.9$$\hat{m} = m_1 / (1 - 0.9) = m_1 / 0.1 =$वास्तविक ग्रेडिएंट। चरण 100 परः $(1 - 0.9^{100})$यह लगभग 1.0 है, इसलिए सुधार गायब हो जाता है। पहले ~ 10 चरणों के लिए पूर्वाग्रह सुधार मायने रखता है और ~ 50 के बाद मायने नहीं रखता है।

अद्यतनः

```math
w = w - \text{lr} \cdot \frac{\hat{m}}{\sqrt{\hat{v}} + \epsilon}
```

एडम डिफ़ॉल्ट रूप सेः $\text{lr} = 0.001$,$\beta_1 = 0.9$,$\beta_2 = 0.999$,$\epsilon = 10^{-8}$. ये डिफ़ॉल्ट समस्याएं 80% समस्याओं के लिए काम करते हैं. जब वे नहीं करते हैं, पहले आईआर बदल. फिर$\beta_2$. . . लगभग कभी नहीं बदलता .$\beta_1$या $\epsilon$. .

### सही तरीके से किया गया वजन घटाने

L2 नियमितता जोड़ती है $\lambda w^2$वैनिला एसजीडी में यह वजन घटाने के बराबर है (घटाने के बाद)$\lambda w$आदम में यह समतुल्यता टूट जाती है।

लोश्चिलोव और हट्टर की अंतर्दृष्टिः जब आप L2 को हानि में जोड़ते हैं और फिर एडम ग्रेडिएंट को संसाधित करता है, तो अनुकूलन सीखने की दर नियमितता शब्द को भी स्केल करती है। बड़े ग्रेडिएंट भिन्नता वाले पैरामीटर कम नियमितता प्राप्त करते हैं। छोटे भिन्नता वाले पैरामीटर अधिक प्राप्त करते हैं। यह वह नहीं है जो आप चाहते हैं - आप ग्रेडिएंट सांख्यिकीय के बावजूद समान नियमितता चाहते हैं।

एडमडब्ल्यू एडम अपडेट के बाद वजन घटाने का सीधा उपयोग करके इसे ठीक करता हैः

```math
w = w - \text{lr} \cdot \frac{\hat{m}}{\sqrt{\hat{v}} + \epsilon} - \text{lr} \cdot \lambda w
```

वजन घटाने की अवधि ($\text{lr} \cdot \lambda w$) एडम के अनुकूलन कारक द्वारा स्केल नहीं किया जाता है. प्रत्येक पैरामीटर समान आनुपातिक संकुचन प्राप्त करता है।

यह एक मामूली विवरण की तरह लगता है. यह नहीं है. एडम + एल 2 नियमितकरण से बेहतर समाधानों के लिए लगभग हर कार्य पर एडम + एल 2 अभ्यस्त होता है. यह ट्रांसफार्मर, विसारण मॉडल और अधिकांश आधुनिक वास्तुकला के प्रशिक्षण के लिए पायटॉर्च में डिफ़ॉल्ट अनुकूलक है।

### सीखने की दरः सबसे महत्वपूर्ण हाइपरपरपैरामीटर

```mermaid
graph TD
    LR["Learning Rate"] --> TooHigh["Too high (lr > 0.01)"]
    LR --> JustRight["Just right"]
    LR --> TooLow["Too low (lr < 0.00001)"]

    TooHigh --> Diverge["Loss explodes<br/>NaN weights<br/>Training crashes"]
    JustRight --> Converge["Loss decreases steadily<br/>Reaches good minimum<br/>Generalizes well"]
    TooLow --> Stall["Loss decreases slowly<br/>Gets stuck in suboptimal minimum<br/>Wastes compute"]

    JustRight --> Schedule["Usually needs scheduling"]
    Schedule --> Warmup["Warmup: ramp from 0 to max<br/>First 1-10% of training"]
    Schedule --> Decay["Decay: reduce over time<br/>Cosine or linear"]
```

यदि आप एक हाइपरपरमैटर को समायोजित करते हैं, तो सीखने की दर को समायोजित करें। सीखने की दर में 10 गुना बदलाव किसी भी वास्तुकला निर्णय से अधिक मायने रखता है जिसे आप करेंगे। सामान्य डिफ़ॉल्टः

- SGD: lr = 0.01 से 0.1
- आदम/आदमडब्ल्यू: lr = 1e-4 से 3e-4
- परिष्कृत पूर्व-प्रशिक्षित मॉडलः lr = 1e-5 से 5e-5
- सीखने की दर में वृद्धिः पहले चरणों के 1-10% में रैखिक रैंप

### अनुकूलन तुलना

```mermaid
flowchart LR
    subgraph "Optimization Path"
        SGD_P["SGD<br/>Oscillates across valley<br/>Slow but finds flat minima"]
        Mom_P["SGD + Momentum<br/>Smoother path<br/>3x faster than SGD"]
        Adam_P["Adam<br/>Adapts per-parameter<br/>Fast convergence"]
        AdamW_P["AdamW<br/>Adam + proper decay<br/>Best generalization"]
    end
    SGD_P --> Mom_P --> Adam_P --> AdamW_P
```

### जब प्रत्येक अनुकूलक जीतता है

```mermaid
flowchart TD
    Task["What are you training?"] --> Type{"Model type?"}

    Type -->|"Transformer / LLM"| AdamW["AdamW<br/>lr=1e-4, wd=0.01-0.1"]
    Type -->|"CNN / ResNet"| SGD_M["SGD + Momentum<br/>lr=0.1, momentum=0.9"]
    Type -->|"GAN"| Adam2["Adam<br/>lr=2e-4, beta1=0.5"]
    Type -->|"Fine-tuning"| AdamW2["AdamW<br/>lr=2e-5, wd=0.01"]
    Type -->|"Don't know yet"| Default["Start with AdamW<br/>lr=3e-4, wd=0.01"]
```

```figure
optimizer-trajectory
```

## इसे बनाओ

### चरण 1: वैनिला एसजीडी

```python
class SGD:
    def __init__(self, lr=0.01):
        self.lr = lr

    def step(self, params, grads):
        for i in range(len(params)):
            params[i] -= self.lr * grads[i]
```

### चरण 2: गति के साथ एसजीडी

```python
class SGDMomentum:
    def __init__(self, lr=0.01, beta=0.9):
        self.lr = lr
        self.beta = beta
        self.velocities = None

    def step(self, params, grads):
        if self.velocities is None:
            self.velocities = [0.0] * len(params)
        for i in range(len(params)):
            self.velocities[i] = self.beta * self.velocities[i] + grads[i]
            params[i] -= self.lr * self.velocities[i]
```

### चरण 3: आदम

```python
import math

class Adam:
    def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grads):
        if self.m is None:
            self.m = [0.0] * len(params)
            self.v = [0.0] * len(params)

        self.t += 1

        for i in range(len(params)):
            self.m[i] = self.beta1 * self.m[i] + (1 - self.beta1) * grads[i]
            self.v[i] = self.beta2 * self.v[i] + (1 - self.beta2) * grads[i] ** 2

            m_hat = self.m[i] / (1 - self.beta1 ** self.t)
            v_hat = self.v[i] / (1 - self.beta2 ** self.t)

            params[i] -= self.lr * m_hat / (math.sqrt(v_hat) + self.epsilon)
```

### चरण 4: एडम

```python
class AdamW:
    def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8, weight_decay=0.01):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.weight_decay = weight_decay
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grads):
        if self.m is None:
            self.m = [0.0] * len(params)
            self.v = [0.0] * len(params)

        self.t += 1

        for i in range(len(params)):
            self.m[i] = self.beta1 * self.m[i] + (1 - self.beta1) * grads[i]
            self.v[i] = self.beta2 * self.v[i] + (1 - self.beta2) * grads[i] ** 2

            m_hat = self.m[i] / (1 - self.beta1 ** self.t)
            v_hat = self.v[i] / (1 - self.beta2 ** self.t)

            params[i] -= self.lr * m_hat / (math.sqrt(v_hat) + self.epsilon)
            params[i] -= self.lr * self.weight_decay * params[i]
```

### चरण 5: प्रशिक्षण तुलना

चारो अनुकूलक के साथ कक्षा 05 से सर्कल डेटासेट पर एक ही दो-परत नेटवर्क को प्रशिक्षित करें। अभिसरण की तुलना करें।

```python
import random

def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))

def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


class OptimizerTestNetwork:
    def __init__(self, optimizer, hidden_size=8):
        random.seed(0)
        self.hidden_size = hidden_size
        self.optimizer = optimizer

        self.w1 = [[random.gauss(0, 0.5) for _ in range(2)] for _ in range(hidden_size)]
        self.b1 = [0.0] * hidden_size
        self.w2 = [random.gauss(0, 0.5) for _ in range(hidden_size)]
        self.b2 = 0.0

    def get_params(self):
        params = []
        for row in self.w1:
            params.extend(row)
        params.extend(self.b1)
        params.extend(self.w2)
        params.append(self.b2)
        return params

    def set_params(self, params):
        idx = 0
        for i in range(self.hidden_size):
            for j in range(2):
                self.w1[i][j] = params[idx]
                idx += 1
        for i in range(self.hidden_size):
            self.b1[i] = params[idx]
            idx += 1
        for i in range(self.hidden_size):
            self.w2[i] = params[idx]
            idx += 1
        self.b2 = params[idx]

    def forward(self, x):
        self.x = x
        self.z1 = []
        self.h = []
        for i in range(self.hidden_size):
            z = self.w1[i][0] * x[0] + self.w1[i][1] * x[1] + self.b1[i]
            self.z1.append(z)
            self.h.append(max(0.0, z))

        self.z2 = sum(self.w2[i] * self.h[i] for i in range(self.hidden_size)) + self.b2
        self.out = sigmoid(self.z2)
        return self.out

    def compute_grads(self, target):
        eps = 1e-15
        p = max(eps, min(1 - eps, self.out))
        d_loss = -(target / p) + (1 - target) / (1 - p)
        d_sigmoid = self.out * (1 - self.out)
        d_out = d_loss * d_sigmoid

        grads = [0.0] * (self.hidden_size * 2 + self.hidden_size + self.hidden_size + 1)
        idx = 0
        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            d_h = d_out * self.w2[i] * d_relu
            grads[idx] = d_h * self.x[0]
            grads[idx + 1] = d_h * self.x[1]
            idx += 2

        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            grads[idx] = d_out * self.w2[i] * d_relu
            idx += 1

        for i in range(self.hidden_size):
            grads[idx] = d_out * self.h[i]
            idx += 1

        grads[idx] = d_out
        return grads

    def train(self, data, epochs=300):
        losses = []
        for epoch in range(epochs):
            total_loss = 0.0
            correct = 0
            for x, y in data:
                pred = self.forward(x)
                grads = self.compute_grads(y)
                params = self.get_params()
                self.optimizer.step(params, grads)
                self.set_params(params)

                eps = 1e-15
                p = max(eps, min(1 - eps, pred))
                total_loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
                if (pred >= 0.5) == (y >= 0.5):
                    correct += 1
            avg_loss = total_loss / len(data)
            accuracy = correct / len(data) * 100
            losses.append((avg_loss, accuracy))
            if epoch % 75 == 0 or epoch == epochs - 1:
                print(f"    Epoch {epoch:3d}: loss={avg_loss:.4f}, accuracy={accuracy:.1f}%")
        return losses
```

## इसका प्रयोग करें

PyTorch अनुकूलक पैरामीटर समूहों, ग्रेडिएंट क्लिपिंग, और सीखने की दर अनुसूची संभालते हैंः

```python
import torch
import torch.optim as optim

model = torch.nn.Sequential(
    torch.nn.Linear(784, 256),
    torch.nn.ReLU(),
    torch.nn.Linear(256, 10),
)

optimizer = optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)

scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)

for epoch in range(100):
    optimizer.zero_grad()
    output = model(torch.randn(32, 784))
    loss = torch.nn.functional.cross_entropy(output, torch.randint(0, 10, (32,)))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
    scheduler.step()
```

पैटर्न हमेशा हैः शून्य_ग्रेड, आगे, हानि, पीछे, (क्लिप), चरण, (अनुसूची) । इस क्रम को याद रखें। इसे गलत करना (जैसे, अनुसूचक.step() को ऑप्टिमाइज़र.step()) से पहले कॉल करना सूक्ष्म बग का एक आम स्रोत है।

सीएनएन के लिए, कई चिकित्सकों को अभी भी चरण या कॉसिन शेड्यूल के साथ एसजीडी + गति (एलआर = 0.1, गति = 0.9, वजन_बहेलना = 1 ई-4) पसंद है। एसजीडी को फ्लैटर न्यूनतम मिलता है, जो अक्सर बेहतर सामान्यीकरण करता है। ट्रांसफार्मर और एलएलएम के लिए, वार्मअप + कॉसिन बिगाड़ के साथ एडमडब्ल्यू सार्वभौमिक डिफ़ॉल्ट है। बिना एक मापा कारण के बिना सहमति से लड़ें नहीं।

## इसे भेजें

इस पाठ से उत्पन्न होता हैः
- `outputs/prompt-optimizer-selector.md`-- किसी भी वास्तुकला के लिए सही अनुकूलक और सीखने की दर चुनने के लिए एक निर्णय प्रम्प्ट

## व्यायाम

1. Nesterov गति लागू करें, जहां आप "Lookhead" स्थिति पर ग्रेडिएंट की गणना ($w - \text{lr} \cdot \beta v$सर्कल डेटासेट पर मानक गति के लिए अभिसरण की तुलना करें।

2. प्रशिक्षण चरणों के पहले 10% के दौरान 0 से अधिकतम तक रैखिक रैंप लागू करें, फिर कोसिन गिरावट को 0 तक करें। एडम + वार्मअप बनाम एडम के साथ प्रशिक्षण करें। सर्कल डेटासेट पर 90% सटीकता तक पहुंचने में कितने युग लगते हैं, इसका माप करें।

3. एडम प्रशिक्षण के दौरान प्रत्येक पैरामीटर के लिए प्रभावी सीखने की दर का ट्रैक करें।$\text{lr} \cdot \hat{m} / (\sqrt{\hat{v}} + \epsilon)$. 10, 50 और 200 चरणों के बाद प्रभावी दरों के वितरण का ग्राफ बनाएं. क्या सभी मापदंडों को एक ही गति से अपडेट किया जा रहा है?

4. ग्रेडिएंट क्लिपिंग (ग्लोबल नॉर्म द्वारा क्लिप) लागू करें। अधिकतम ग्रेडिएंट नॉर्म को 1.0 पर सेट करें। उच्च सीखने की दर (एलआर = 0.01 के लिए एडम) का उपयोग करके क्लिपिंग के साथ और बिना अभ्यास करें। गणना करें कि 10 यादृच्छिक बीज के साथ और बिना कितने रन विचलित होते हैं (हानि NaN में जाती है) ।

5. बड़े वजन वाले नेटवर्क पर एडम बनाम एडमडब्ल्यू की तुलना करें। सभी वजन को [-5, 5] (सामान्य से बहुत बड़ा) में यादृच्छिक मानों पर प्रारंभ करें। 200 काल के लिए वजन_बदल = 0.1 के साथ प्रशिक्षित करें। दोनों अनुकूलकों के लिए प्रशिक्षण के ऊपर वजन के L2 मानदंड को रेखांकित करें। एडमडब्ल्यू को वजन में तेजी से संकुचन दिखाना चाहिए।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Learning rate | "Step size" | The scalar multiplier on the gradient update; the single most impactful hyperparameter in training |
| SGD | "Basic gradient descent" | Stochastic gradient descent: update weights by subtracting $\text{lr} \cdot \text{gradient}$, computed on a mini-batch |
| Momentum | "Rolling ball analogy" | Exponential moving average of past gradients; dampens oscillation and accelerates consistent directions |
| RMSProp | "Adaptive learning rate" | Divides each parameter's gradient by the running RMS of its recent gradients; equalizes learning rates |
| Adam | "The default optimizer" | Combines momentum (first moment) and RMSProp (second moment) with bias correction for the initial steps |
| AdamW | "Adam done right" | Adam with decoupled weight decay; applies regularization directly to weights rather than through the gradient |
| Bias correction | "Warmup for running averages" | Dividing by $(1 - \beta^t)$ to compensate for the zero-initialization of Adam's moment estimates |
| Weight decay | "Shrink the weights" | Subtracting a fraction of the weight value at each step; a regularizer that penalizes large weights |
| Learning rate schedule | "Changing lr over time" | A function that adjusts the learning rate during training; warmup + cosine decay is the modern default |
| Gradient clipping | "Capping the gradient norm" | Scaling down the gradient vector when its norm exceeds a threshold; prevents exploding gradient updates |

## आगे पढ़ना

- किंगमा एंड बा, "एडमः स्टोकास्टिक अनुकूलन के लिए एक विधि" (2014) -- अभिसरण विश्लेषण और पूर्वाग्रह सुधार व्युत्पन्न के साथ मूल एडम पेपर
- लोश्चिलोव और हटर, "डिकोप्ल्ड वेट डेकेड रेगुलेरेशन" (2017) -- साबित किया कि एल 2 रेगुलेरेशन और वजन में गिरावट आदम में बराबर नहीं हैं, और प्रस्तावित एडमडब्ल्यू
- स्मिथ, "ट्रेनिंग न्यूरल नेटवर्क के लिए चक्रवर्ती सीखने की दरें" (2017) -- एलआर रेंज परीक्षण और चक्रवर्ती कार्यक्रम पेश किए जो एक निश्चित सीखने की दर को समायोजित करने की आवश्यकता को समाप्त करते हैं
- रुडर, "ग्रेडिएंट डेसेंट ऑप्टिमाइजेशन एल्गोरिदम का एक अवलोकन" (2016) - सभी ऑप्टिमाइज़र वेरिएंट के सर्वश्रेष्ठ एकल सर्वेक्षण, स्पष्ट तुलना और अंतर्दृष्टि के साथ
