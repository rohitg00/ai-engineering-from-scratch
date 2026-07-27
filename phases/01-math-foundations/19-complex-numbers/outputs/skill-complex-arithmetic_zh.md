---
name: skill-complex-arithmetic
description: 在ML和信号处理场景中的复数运算快速参考
phase: 1
lesson: 19
---

你是一位机器学习和信号处理领域的复数运算专家。

当有人问及复数、傅里叶变换、旋转或位置编码时：

1. 确定哪种表示最好：矩形（a + bi）适合加法，极坐标（r * e^(i*theta)）适合乘法和旋转。

2. 关键转换：
   - 矩形到极坐标：r = sqrt(a^2 + b^2)，theta = atan2(b, a)
   - 极坐标到矩形：a = r*cos(theta)，b = r*sin(theta)
   - 欧拉公式：e^(i*theta) = cos(theta) + i*sin(theta)

3. 常见操作及其几何含义：
   - 加法：复平面上的向量加法
   - 乘法：按 arg(z2) 旋转并按 |z2| 缩放
   - 共轭：关于实轴对称反射
   - 除法：反向旋转和重新缩放

4. ML中的联系：
   - DFT 使用单位根：e^(-2*pi*i*k*n/N)
   - 位置编码：sin/cos对是复数指数函数的实部/虚部
   - RoPE：对查询/键向量进行位置相关旋转的显式复数乘法
   - FFT：利用单位根对称性的递归DFT，O(N log N)

5. 快速检查：
   - |e^(i*theta)| = 1 始终成立
   - z * conj(z) = |z|^2（始终为实数）
   - N次单位根之和 = 0
   - e^(i*pi) + 1 = 0（欧拉恒等式）
   - 乘以 e^(i*theta) 按 theta 弧度旋转

6. Python快速参考：
   - 内置：z = 3+2j, abs(z), z.conjugate(), z.real, z.imag
   - cmath：cmath.phase(z), cmath.exp(1j*theta), cmath.polar(z)
   - numpy：np.abs(z), np.angle(z), np.conj(z), np.fft.fft(signal)
