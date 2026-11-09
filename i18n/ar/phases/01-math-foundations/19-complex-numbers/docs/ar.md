# الأرقام المعقدة لذكاء الذكاء الاصطناعي

> الجذر التربيعي من -1 ليس خيالي. إنه مفتاح التناوبات، والترددات، ونصف معالجة الإشارات.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04 (linear algebra, calculus)
**Time:** ~60 minutes

## أهداف التعلم

- أداء الحسابات المعقدة (اضافة، مضاعفة، تقسيم، مضافية) في كل من الشكل المستطيل والقطبي
- تطبيق صيغة أولر لتحويل بين المعارض المعقدة والظروف الثلاثية
- تنفيذ تحويل فوريه المميز باستخدام جذور معقدة من الوحدة
- شرح كيفية الدوران المعقدة التي تتمثل في رمزات المواقع الصناعية في المتحولات

## المشكلة

فتحت ورقة حول تحويلات فوريير وهناك`i`في كل مكان. تنظر إلى ترانسفورمات التشفير الموضعي وترى`sin`و`cos`في ترددات مختلفة -- الأجزاء الحقيقية والخيالية من المكثفات المعقدة.

يبدو الأرقام المعقدة مجردة. يبدو أن نظام الأرقام المبني على الجذر التربيعي من -1 يبدو مثل خدعة رياضية. لكنه ليس خدعة. إنه اللغة الطبيعية للدورات والتذبذب. في كل مرة تدور فيها شيء أو تتأرجح أو تتذبذب، الأرقام المعقدة هي الأداة الصحيحة.

بدون فهم الأرقام المعقدة، لا يمكنك فهم تحويل فوريه المختلف. لا يمكنك فهم FFT. لا يمكنك فهم كيفية عمل RoPE (إدراج الموقف المتحرك) في نماذج اللغة الحديثة. لا يمكنك فهم لماذا تشفيرات الموقف السينوسيدال في ورقة المحول الأصلية تستخدم تردداتها.

هذه الدروس تبني الرياضيات المعقدة من الصفر، وتربطها بالهندسة، وتريك بالضبط أين تظهر الأرقام المعقدة في التعلم الآلي.

## المفهوم

### ما هو الرقم المعقد؟

عدد معقد يحتوي على جزءين: جزء حقيقي و جزء خيالي.

```
z = a + bi

where:
  a is the real part
  b is the imaginary part
  i is the imaginary unit, defined by i^2 = -1
```

هذا هو الأمر. تمد خط الأعداد إلى مستوى. الأرقام الحقيقية تقع على محور واحد. الأرقام الخيالية تقع على الآخر. كل عدد معقد هو نقطة في هذا المستوى.

### الحساب المعقد

**Addition.**أضف الأجزاء الحقيقية معاً، أضف الأجزاء الخيالية معاً.

```math
\begin{aligned}
(a + bi) + (c + di) &= (a + c) + (b + d)i \\[4pt]
\text{Example: } (3 + 2i) + (1 + 4i) &= 4 + 6i
\end{aligned}
```

**Multiplication.**استخدم قانون التوزيع وتذكر ذلك$i^2 = -1$. . .

```math
\begin{aligned}
(a + bi)(c + di) &= ac + adi + bci + bdi^2 \\
&= ac + adi + bci - bd \\
&= (ac - bd) + (ad + bc)i \\[8pt]
\text{Example: } (3 + 2i)(1 + 4i) &= 3 + 12i + 2i + 8i^2 \\
&= 3 + 14i - 8 \\
&= -5 + 14i
\end{aligned}
```

**Conjugate.**أعدّ علامة الجزء الخيالي

```math
\text{conjugate of } (a + bi) = a - bi
```

إن نسبة عدد معقد ومجموعه هو دائمًا حقيقي:

```math
(a + bi)(a - bi) = a^2 + b^2
```

**Division.**مضاعفة العداد والسماسرة بموجب المكونات من السماسرة.

```math
\frac{a + bi}{c + di} = \frac{(a + bi)(c - di)}{c^2 + d^2}
```

هذا يزيل الجزء الخيالي من المُعنى، مما يعطي رقمًا معقدًا نظيفًا.

### الطائرة المعقدة

الطائرة المعقدة ترسم كل رقم معقد إلى نقطة ثنائية الأبعاد. المحور الأفقي هو المحور الحقيقي، والمحور الرأسي هو المحور الخيالي.

```
z = 3 + 2i  corresponds to the point (3, 2)
z = -1 + 0i corresponds to the point (-1, 0) on the real axis
z = 0 + 4i  corresponds to the point (0, 4) on the imaginary axis
```

عدد معقد هو في نفس الوقت نقطة و متجه من الأصل. هذا التفسير المزدوج هو ما يجعل الأرقام المعقدة مفيدة للجيومétrie.

### شكل قطبي

يمكن وصف أي نقطة في المسطح عن طريق مسافةها من المنشأ و زاويته من المحور الحقيقي الإيجابي.

```math
\begin{aligned}
z &= r (\cos\theta + i \sin\theta) \\[4pt]
\text{where: } r &= |z| = \sqrt{a^2 + b^2} \quad \text{(magnitude, or modulus)} \\
\theta &= \mathop{\mathrm{atan2}}(b, a) \quad \text{(phase, or argument)}
\end{aligned}
```

شكل مستطيل$(a + bi)$هو جيد للضم.$(r, \theta)$هو جيد للضرب.

**Multiplication in polar form.**ضرب الكبيرة، أضف الزوايا.

```math
\begin{aligned}
z_1 &= r_1 e^{i\theta_1} \\
z_2 &= r_2 e^{i\theta_2} \\[4pt]
z_1 z_2 &= (r_1 r_2) \, e^{i(\theta_1 + \theta_2)}
\end{aligned}
```

هذا هو السبب في أن الأرقام المعقدة مثالية للدورات. مضاعفة عدد معقد مع الحجم 1 هو دوران نقي.

### صيغة أولر

الجسر بين المكثفين المعقدين والتغنومترية:

```math
e^{i\theta} = \cos\theta + i \sin\theta
```

هذه هي أهم صيغة في هذه الدروس$\theta = \pi$:

```math
\begin{aligned}
e^{i\pi} &= \cos\pi + i \sin\pi = -1 + 0i = -1 \\[4pt]
\text{Therefore: } e^{i\pi} + 1 &= 0
\end{aligned}
```

خمسة ثابتات أساسية ($e$،$i$،$\pi$، 1 ، 0) مرتبطة في معادلة واحدة.

### لماذا صيغة أويلر مهمة ل ML

صيغة (أولر) تقول ذلك$e^{i\theta}$تتبع دائرة الوحدة$\theta$يختلف.$\theta = 0$، أنت في$(1, 0)$في$\theta = \pi/2$، أنت في$(0, 1)$في$\theta = \pi$، أنت في$(-1, 0)$في$\theta = 3\pi/2$، أنت في$(0, -1)$. الدوران الكامل هو$\theta = 2\pi$. . .

هذا يعني أن المُعَدّيات المعقدة هي دورانات، والدورات موجودة في كل مكان في معالجة الإشارات و ML.

### اتصال مع الدوران الثنائي الأبعاد

مضاعفة العدد المعقد $(x + yi)$من$e^{i\theta}$يدور النقطة$(x, y)$بالزاوية$\theta$حول الأصل

```math
\begin{aligned}
&\text{Rotation via complex multiplication:} \\
&\quad (x + yi)(\cos\theta + i \sin\theta) = (x \cos\theta - y \sin\theta) + (x \sin\theta + y \cos\theta)i \\[8pt]
&\text{Rotation via matrix multiplication:} \\
&\quad \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x \\ y \end{bmatrix} = \begin{bmatrix} x \cos\theta - y \sin\theta \\ x \sin\theta + y \cos\theta \end{bmatrix}
\end{aligned}
```

يُنتجون نتائج متطابقة. المضاعفة المعقدة هي الدوران في 2D. المصفوفة الدورانية هي مجرد مضاعفة معقدة مكتوبة في علامة المصفوفة.

```mermaid
graph TD
    subgraph "Complex Multiplication = 2D Rotation"
        A["z = x + yi<br/>Point (x, y)"] -->|"multiply by e^(i*theta)"| B["z' = z * e^(i*theta)<br/>Point rotated by theta"]
    end
    subgraph "Equivalent Matrix Form"
        C["vector [x, y]"] -->|"multiply by rotation matrix"| D["[x cos theta - y sin theta,<br/> x sin theta + y cos theta]"]
    end
    B -.->|"same result"| D
```

### الفازورات والإشارات المتناوبة

معقدة تعريفة$e^{i\omega t}$هو نقطة تدور حول دائرة الوحدة في تردد زاوي $\omega$. كما$t$يزيد النقطة تتبع الدائرة

الجزء الحقيقي من هذه النقطة المدارية هو$\cos(\omega t)$الجزء الخيالي هو$\sin(\omega t)$إشارة سينوسوايدل هي ظل عدد معقد يتناوب

```math
\begin{aligned}
e^{i\omega t} &= \cos(\omega t) + i \sin(\omega t) \\[4pt]
\text{Real part: } & \cos(\omega t) \quad \text{-- a cosine wave} \\
\text{Imaginary part: } & \sin(\omega t) \quad \text{-- a sine wave}
\end{aligned}
```

هذه هي تمثيل الفازور. بدلاً من تتبع موجة سينوسية متذبذبة، تتبع سهمًا يتناوب بسلاسة. تحولات المراحل تصبح تعويضات الزاوية. تغيرات الضمنية تصبح تغيرات الكبيرة. إضافة الإشارات تصبح إضافة متجهة.

### جذور الوحدة

- نعم$N$-أصول الوحدة هي$N$النقاط المتنافسة على مسافة متساوية على دائرة الوحدة:

```math
w_k = e^{2\pi i k/N} \quad \text{for } k = 0, 1, 2, \ldots, N-1
```

لأجل$N = 4$، الجذور هي: $1, i, -1, -i$(أربعة نقاط الخريطة)
لأجل$N = 8$، تحصل على أربعة نقاط البوصلة بالإضافة إلى أربعة شوارع.

جذور الوحدة هي أساس تحويل فوريه المميز. يقوم DFT بتفكيك الإشارة إلى مكونات في هذه$N$ترددات مساوية

### اتصال مع DFT

تحويل إشارة فوريه المفصلة$x[0], x[1], \ldots, x[N-1]$هو:

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N}
```

كل واحد$X[k]$يُقيّم مدى ارتباط الإشارة مع الـ$k$-أصل الوحدة-- سينوسيد معقد في التردد$k$. DFT يقطع إشارة إلى$N$وتخبرك بمدى ومرحلة كل منها

### لماذا أنا لست خيالي

كلمة "خيالية" هي حادث تاريخي استخدمها ديكارتس بشكل مرفوض$i$لا تكون الأرقام السلبية أكثر خيالاً مما كانت عليه عندما رفض الناس لأول مرة. الأرقام السلبية تجيب على "ما الذي يمكنك إزالة 5 من 3 للحصول عليه؟" الوحدة الخيالية تجيب على "ما الذي يمكنك التربيعه للحصول على -1؟"

أكثر فائدة:$i$هو عامل دوران 90 درجة. ضرب عدد حقيقي ب $i$مرة واحدة، تدور 90 درجة إلى المحور الخيالية.$i$مرة أخرى ($i^2$و تدور في 90 درجة أخرى -- الآن أنت تُشير في الاتجاه الحقيقي السلبي.$i^2 = -1$ليس غامضًا، إنه نصف جولة بنيت من أربع جولتين

هذا هو السبب في أن الأرقام المعقدة موجودة في كل مكان في الهندسة. أي شيء يتناور -- موجات كهرومغناطيسية، وحالات كمية، تذبذبات الإشارة، تشفير المواقع -- يتم وصفها بطبيعة الحال بأرقام معقدة.

### المعقدة المعروضات مقابل وظائف التغنومترية

قبل صيغة (أويلر) ، كتب المهندسون إشارات مثل$A \cos(\omega t + \phi)$-- الطول$A$, التردد$\omega$، مرحلة$\phi$هذا يعمل لكن يجعل الحساب مؤلم إضافة كوزينز مع مراحل مختلفة تتطلب هويات تثريجية

مع تعدد المعايير المعقدة، نفس الإشارة هي$A e^{i(\omega t + \phi)}$إضافة إشارات اثنين هو مجرد إضافة اثنين من الأرقام المعقدة. ضرب (تجديد) هو مجرد ضرب الكبرى وإضافة الزوايا. تحولات المرحلة تصبح إضافة الزاوية. تحولات التردد تصبح مضاعفات بالفازورات.

انتقلت مجال معالجة الإشارات بأكمله إلى علامة تعريضية معقدة لأن الرياضيات أكثر نظافة. "الإشارة الحقيقية" هي دائمًا الجزء الحقيقي من التمثيل المعقد. يتم حمل الجزء الخيالي معًا كحاسبة ، مما يجعل جميع الجبر يعمل بشكل طبيعي.

### اتصال مع المحولات

**Sinusoidal positional encodings**(ورقة "تنسفورمير" الأصلية):

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d}\right)
\end{aligned}
```

أزواج الخطيئة والجسم هي الأجزاء الحقيقية والخيالية من المضادات المعقدة في ترددات مختلفة. كل تردد يوفر "قرار" مختلف لموقف التشفير. تتغير ترددات منخفضة ببطء (موقف قاسي). تتغير ترددات عالية بسرعة (موقف جيد). معاً يعطي كل موقف بصمة أصابع تردد فريدة.

**RoPE (Rotary Position Embedding)**يزيد هذا الأمر. يضاعف صراحة المتجهات السائدة والكليدية بواسطة ماتريسيات دوران معقدة. يصبح الموقف النسبي بين رموزين زاوية دوران. يتم حساب الاهتمام باستخدام هذه المتجهات المدوجة ، مما يجعل النموذج حساسًا للموقف النسبي من خلال مضاعفة معقدة.

| Operation | Algebraic Form | Geometric Meaning |
|-----------|---------------|-------------------|
| Addition | $(a+c) + (b+d)i$ | Vector addition in the plane |
| Multiplication | $(ac-bd) + (ad+bc)i$ | Rotate and scale |
| Conjugate | $a - bi$ | Reflect over real axis |
| Magnitude | $\sqrt{a^2 + b^2}$ | Distance from origin |
| Phase | $\mathop{\mathrm{atan2}}(b, a)$ | Angle from positive real axis |
| Division | multiply by conjugate | Reverse rotation and rescale |
| Power | $r^n e^{in\theta}$ | Rotate $n$ times, scale by $r^n$ |

```mermaid
graph LR
    subgraph "Unit Circle"
        direction TB
        U1["e^(i*0) = 1"] -.-> U2["e^(i*pi/2) = i"]
        U2 -.-> U3["e^(i*pi) = -1"]
        U3 -.-> U4["e^(i*3pi/2) = -i"]
        U4 -.-> U1
    end
    subgraph "Applications"
        A1["Euler's formula:<br/>e^(i*theta) = cos + i*sin"]
        A2["DFT uses roots of unity:<br/>e^(2*pi*i*k/N)"]
        A3["RoPE uses rotation:<br/>q * e^(i*m*theta)"]
    end
    U1 --> A1
    U1 --> A2
    U1 --> A3
```

```figure
roots-of-unity
```

## بناءها

### الخطوة الأولى: فئة معقدة

بناء فئة أرقام معقدة تدعم الحساب والحجم والمرحلة والتحويل بين الأشكال المستقيمة والقطبي.

```python
import math

class Complex:
    def __init__(self, real, imag=0.0):
        self.real = real
        self.imag = imag

    def __add__(self, other):
        return Complex(self.real + other.real, self.imag + other.imag)

    def __mul__(self, other):
        r = self.real * other.real - self.imag * other.imag
        i = self.real * other.imag + self.imag * other.real
        return Complex(r, i)

    def __truediv__(self, other):
        denom = other.real ** 2 + other.imag ** 2
        r = (self.real * other.real + self.imag * other.imag) / denom
        i = (self.imag * other.real - self.real * other.imag) / denom
        return Complex(r, i)

    def magnitude(self):
        return math.sqrt(self.real ** 2 + self.imag ** 2)

    def phase(self):
        return math.atan2(self.imag, self.real)

    def conjugate(self):
        return Complex(self.real, -self.imag)
```

### الخطوة الثانية: التحويل القطبي وصيغة أولر

```python
def to_polar(z):
    return z.magnitude(), z.phase()

def from_polar(r, theta):
    return Complex(r * math.cos(theta), r * math.sin(theta))

def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))
```

التحقق من: `euler(theta).magnitude()`يجب أن يكون دائما 1.0. `euler(0)`يجب أن يعطي (1, 0). `euler(pi)`يجب أن يعطي (-1, 0).

### الخطوة الثالثة: التناوب

تدور نقطة$(x, y)$بالزاوية$\theta$هو مضاعفة معقدة واحدة:

```python
point = Complex(3, 4)
rotated = point * euler(math.pi / 4)
```

الحجم يبقى نفسه فقط الزاوية تتغير

### الخطوة الرابعة: DFT من الرياضيات المعقدة

```python
def dft(signal):
    N = len(signal)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            total = total + Complex(signal[n], 0) * euler(angle)
        result.append(total)
    return result
```

هذا هو$O(N^2)$كل إصدار$X[k]$هو مجموع عينات الإشارة مضاعفة بأصله من الوحدة.

### الخطوة 5: DFT العكسية

يقوم DFT العكسي بإعادة تشكيل الإشارة الأصلية من طيفها. التغييرات الوحيدة من DFT الأمامية: قم بتعديل الإشارة في المُعبر وتقسمها ب $N$. . .

```python
def idft(spectrum):
    N = len(spectrum)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            total = total + spectrum[k] * euler(angle)
        result.append(Complex(total.real / N, total.imag / N))
    return result
```

هذا يعطيك إعادة بناء مثالية. تطبيق DFT، ثم IDFT، وتحصل على إشارة الأصلية إلى دقة الآلة. لا يوجد معلومات ضائعة.

### الخطوة السادسة: جذور الوحدة

```python
def roots_of_unity(N):
    return [euler(2 * math.pi * k / N) for k in range(N)]
```

التحقق من اثنين من الخصائص:
- كل جذور لها حجم بالضبط 1.
- مجموع كل شيء$N$الجذور هي صفر (إنها تُلغي بالتناظر).

هذه الخصائص هي ما يجعل DFT قابلة للتحويل. جذور الوحدة تشكل أساساً متقاطعًا للمجال المتردد.

## استخدمها

بايثون لديه دعم متكامل للأرقام المعقدة.`j`يمثل الوحدة الخيالية

```python
z = 3 + 2j
w = 1 + 4j

print(z + w)
print(z * w)
print(abs(z))

import cmath
print(cmath.phase(z))
print(cmath.exp(1j * cmath.pi))
```

بالنسبة للمصفوفات، يتعامل numpy بالأرقام المعقدة بشكل طبيعي:

```python
import numpy as np

z = np.array([1+2j, 3+4j, 5+6j])
print(np.abs(z))
print(np.angle(z))
print(np.conj(z))
print(np.real(z))
print(np.imag(z))

signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 128))
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(128, d=1/128)
```

## أرسله

أركض`code/complex_numbers.py`أو`npx tsx code/complex_numbers.ts`لإنتاج`outputs/skill-complex-arithmetic.md`. . .

## التمارين

1. **Complex arithmetic by hand.**الحساب$(2 + 3i)(4 - i)$و التحقق من ذلك باستخدام الرمز ثم الحساب$(5 + 2i) / (1 - 3i)$رسم كلتا النتائج على المستوى المعقد وتحقق من أن الضربة تدور وتحقيق النطاق الأول.

2. **Rotation sequence.**ابدأ بالنقطة$(1, 0)$. مضاعفة بـ$e^{i\pi/6}$اثني عشر مرة تأكد من عودتك$(1, 0)$بعد 12 مضاعفة، طبع الإحداثيات في كل خطوة وتأكد أنها تتبع 12 غون عادية.

3. **DFT of a known signal.**إخلق إشارة هي مجموع $\sin(2\pi \cdot 3t)$و$0.5 \sin(2\pi \cdot 7t)$قم بتشغيل DFT، تحقق أن الطيف الكبير لديه قمم في ترددات 3 و 7, مع ذروة في 7 هو نصف ارتفاع ذروة في 3.

4. **Roots of unity visualization.**احسب الجذر الثامن من الوحدة، تحقق ان مجموعها الى الصفر، تحقق ان مضاعفة أي جذور بالجذر البدائي$e^{2\pi i/8}$يعطي الجذر التالي

5. **Rotation matrix equivalence.**لـ 10 زوايا عشوائية و 10 نقاط عشوائية، تحقق من أن مضاعفة معقدة تعطى نفس النتيجة مثل مضاعفة المصفوفة المتجهة مع المصفوفة الدورانية 2x2. طبع أقصى فرق عددي.

### إشارات

**Exercise 1.**توسيع المنتج مع $i^2 = -1$، ثم تقسيم من خلال مضاعفة الجزء العلوي والسفل بالخليط$1 + 3i$تحقق من المنتج مع`Complex(2, 3) * Complex(4, -1)`: هي`magnitude()`يجب أن يكون مساويا لمربع الحجمين، و`phase()`يجب أن يكون مساوياً لمجموع المراحل.

**Exercise 2.**قم بالخطوة مع`euler(math.pi / 6)`و تضاعف 12 مرة. في كل خطوة، تحقق من أن الحجم يبقى 1 وأن الزاوية تزداد 30 درجة. يجب أن تكون النقطة النهائية داخل 1e-12 من (1, 0).

**Exercise 3.**قم بتحديد النقاط الزمنية$t = n/32$و اتصل`dft`انظر فقط إلى القمامة 0 إلى 15 لأن النصف العلوي هو صورة مرآة.$k$لخدّة من التوسع$A$هو$AN/2$، لذا توقع حوالي 16 في السطح 3 و حوالي 8 في السطح 7.

**Exercise 4.**اتصل`roots_of_unity(8)`و أضف الجذور: يجب أن يكون حجم المجموع قريب من 0. تقسيم كل جذر بالجذر السابق وتحقق من أن كل نتيجة متساوية `euler(2 * math.pi / 8)`. . .

**Exercise 5.**المصفوفة الدورانية هي [cos t، -sin t، [sin t، cos t]. لكل زاوية ونقطة، الحساب `euler(t) * Complex(x, y)`و المربع المنتج، ثم تسجيل أكبر الفرق المطلق.$10^{-15}$. . .

## الشروط الرئيسية

| Term | What it means |
|------|---------------|
| Complex number | A number $a + bi$ where $a$ is the real part, $b$ is the imaginary part, and $i^2 = -1$ |
| Imaginary unit | The number $i$, defined by $i^2 = -1$. Not imaginary in the philosophical sense -- it is a rotation operator |
| Complex plane | The 2D plane where the x-axis is real and the y-axis is imaginary. Also called the Argand plane |
| Magnitude (modulus) | The distance from the origin: $\sqrt{a^2 + b^2}$. Written as $\lvert z \rvert$ |
| Phase (argument) | The angle from the positive real axis: $\mathop{\mathrm{atan2}}(b, a)$. Written as $\arg(z)$ |
| Conjugate | The mirror image across the real axis: conjugate of $a + bi$ is $a - bi$ |
| Polar form | Expressing $z$ as $r e^{i\theta}$ instead of $a + bi$. Makes multiplication easy |
| Euler's formula | $e^{i\theta} = \cos\theta + i \sin\theta$. Connects exponentials to trigonometry |
| Phasor | A rotating complex number $e^{i\omega t}$ representing a sinusoidal signal |
| Roots of unity | The $N$ complex numbers $e^{2\pi i k/N}$ for $k = 0$ to $N-1$. $N$ equally spaced points on the unit circle |
| DFT | Discrete Fourier Transform. Decomposes a signal into complex sinusoidal components using roots of unity |
| RoPE | Rotary Position Embedding. Uses complex multiplication to encode relative position in transformer attention |

## المزيد من القراءة

- [Visual Introduction to Euler's Formula](https://betterexplained.com/articles/intuitive-understanding-of-eulers-formula/)- يُبني الحس البدني الهندسي دون علامات ثقيلة
- [Su et al.: RoFormer (2021)](https://arxiv.org/abs/2104.09864)- الورقة التي تعرضت إدخال الموقف الدواري باستخدام الدوران المعقد
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- ورقة "ترانسفارمر" الأصلية مع تشفيرات موقفية سينوسيدالية
- [3Blue1Brown: Euler's formula with introductory group theory](https://www.youtube.com/watch?v=mvmuCPvRoWQ)- شرح بصري لسبب$e^{i\pi} = -1$
- [Needham: Visual Complex Analysis](https://global.oup.com/academic/product/visual-complex-analysis-9780198534464)- أفضل معالجة بصرية للأرقام المعقدة، مليئة بالبصيرة الهندسية
- [Strang: Introduction to Linear Algebra, Ch. 10](https://math.mit.edu/~gs/linearalgebra/)- الأرقام المعقدة في سياق الجبر الخطوي والقيم الخاصة
