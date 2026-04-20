using LinearAlgebra

println("=== Vectors ===")
a = [1.0, 2.0, 3.0]
b = [4.0, 5.0, 6.0]

println("a = ", a)
println("b = ", b)
println("a + b = ", a + b)
println("a - b = ", a - b)
println("a * 3 = ", a * 3)
println("a · b = ", a ⋅ b)
println("|a| = ", norm(a))
println("â = ", normalize(a))

cosine = (a ⋅ b) / (norm(a) * norm(b))
println("cosine_similarity(a, b) = ", round(cosine, digits=4))

println("\n=== Matrices ===")
rotation_90 = [0 -1; 1 0]
point = [3.0, 1.0]
rotated = rotation_90 * point
println("Rotate ", point, " by 90° → ", rotated)

println("\n=== Neural Network Layer ===")
W = randn(2, 3) * 0.1
x = [1.0, 0.5, -0.3]
output = W * x
println("Input (3D):  ", x)
println("Output (2D): ", output)
println("^ This is literally what a neural network layer does.")
