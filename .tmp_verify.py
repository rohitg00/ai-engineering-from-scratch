import cmath, math

# 4-point DFT of x = [1, 0, -1, 0]
x = [1, 0, -1, 0]
N = 4
X = [sum(x[n] * cmath.exp(-2j * math.pi * k * n / N) for n in range(N)) for k in range(N)]
print("DFT", [complex(round(z.real, 6), round(z.imag, 6)) for z in X])

# circular convolution length 2
x2 = [1, 2]
h2 = [1, 1]
print("circ", [sum(h2[k] * x2[(n - k) % 2] for k in range(2)) for n in range(2)])

# path P4 laplacian, Fiedler check
v = [math.cos(math.pi * (2 * j - 1) / 8) for j in range(1, 5)]
lam = 2 - math.sqrt(2)
print("fiedler raw", [round(a, 4) for a in v], "lambda", round(lam, 4))
Lv = [v[0] - v[1], 2 * v[1] - v[0] - v[2], 2 * v[2] - v[1] - v[3], v[3] - v[2]]
print("Lv", [round(a, 4) for a in Lv])
print("lam*v", [round(lam * a, 4) for a in v])

# triangle A^2
A = [[0, 1, 1], [1, 0, 1], [1, 1, 0]]
A2 = [[sum(A[i][k] * A[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
print("A^2", A2)

# weather chain
P = [[0.7, 0.1, 0.2], [0.3, 0.4, 0.3], [0.4, 0.2, 0.4]]
pi = [6 / 11, 2 / 11, 3 / 11]
print("pi P", [sum(pi[i] * P[i][j] for i in range(3)) for j in range(3)])
p1 = [0.7, 0.1, 0.2]
p2 = [sum(p1[i] * P[i][j] for i in range(3)) for j in range(3)]
print("after2", [round(a, 4) for a in p2])

print("langevin", 2 - 0.1 * 2 + math.sqrt(2 * 1 * 0.1) * 0.5)
print("0.8^10", 0.8 ** 10)
print("exp-0.5", math.exp(-0.5))
print("sqrt2", math.sqrt(2), math.pi / 4)
print("3+4i over 1-2i", complex(3, 4) / complex(1, -2))
print("(1+2i)(3+i)", complex(1, 2) * complex(3, 1))
print("(3+4i)*i", complex(3, 4) * 1j)

# two disjoint edges laplacian eigenvalues
print("two edges L rows sum", [[1, -1, 0, 0], [-1, 1, 0, 0], [0, 0, 1, -1], [0, 0, -1, 1]])

# message passing on path 0-1-2
feat = [[1, 0], [0, 1], [2, 2]]
A3 = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
out = []
for i in range(3):
    s = sum(A3[i])
    out.append([round(sum(A3[i][j] * feat[j][c] for j in range(3)) / s, 4) for c in range(2)])
print("mp", out)

# newton
print("f(2)", 4 - 8 + 7, "step", 16 / 2)
print("5x^2+y^2 lr .1: y factor", 1 - 0.1 * 2)
