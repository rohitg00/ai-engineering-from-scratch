using LinearAlgebra


function demo_vectors()
    println("=" ^ 60)
    println("VECTOR OPERATIONS")
    println("=" ^ 60)

    v = [3.0, 4.0]
    w = [1.0, 2.0]

    println("\nv = $v")
    println("w = $w")
    println("v + w = $(v + w)")
    println("v - w = $(v - w)")
    println("v * 2 = $(v * 2)")
    println("v . w = $(dot(v, w))")
    println("|v| = $(norm(v))")
    println("v normalized = $(normalize(v))")
    println("|v normalized| = $(norm(normalize(v)))")
end


function demo_basic_operations()
    println("\n" * "=" ^ 60)
    println("BASIC MATRIX OPERATIONS")
    println("=" ^ 60)

    A = [1 2; 3 4]
    B = [5 6; 7 8]

    println("\nA = $A")
    println("B = $B")
    println("A + B = $(A + B)")
    println("A - B = $(A - B)")
    println("A * 3 = $(A * 3)")
    println("A .* B (element-wise) = $(A .* B)")
    println("A * B (matrix multiply) = $(A * B)")
    println("A' (transpose) = $(A')")
end


function demo_determinant_inverse()
    println("\n" * "=" ^ 60)
    println("DETERMINANT AND INVERSE")
    println("=" ^ 60)

    A = [4 7; 2 6]
    println("\nA = $A")
    println("det(A) = $(det(A))")
    println("inv(A) = $(inv(A))")
    println("A * inv(A) = $(A * inv(A))")

    I3 = Matrix{Float64}(I, 3, 3)
    println("\nIdentity 3x3 = $I3")
end


function demo_broadcasting()
    println("\n" * "=" ^ 60)
    println("BROADCASTING")
    println("=" ^ 60)

    output = [1 2 3; 4 5 6]
    bias = [10 20 30]

    println("\nOutput = $output")
    println("Bias = $bias")
    println("Output .+ Bias = $(output .+ bias)")
end


function demo_neural_network_layer()
    println("\n" * "=" ^ 60)
    println("NEURAL NETWORK FORWARD PASS")
    println("=" ^ 60)

    input_size = 3
    hidden_size = 4
    output_size = 2

    x = [0.5, 0.8, 0.2]

    W1 = randn(hidden_size, input_size)
    b1 = zeros(hidden_size)
    W2 = randn(output_size, hidden_size)
    b2 = zeros(output_size)

    println("\nInput x: $(size(x))")
    println("W1: $(size(W1))")
    println("W2: $(size(W2))")

    z1 = W1 * x .+ b1
    h1 = max.(0, z1)
    println("\nHidden pre-activation z1 = $z1")
    println("Hidden post-ReLU h1 = $h1")

    z2 = W2 * h1 .+ b2
    println("Output z2 = $z2")

    println("\nLayer 1: ($hidden_size x $input_size) * ($input_size,) -> ($hidden_size,)")
    println("Layer 2: ($output_size x $hidden_size) * ($hidden_size,) -> ($output_size,)")
end


function demo_weight_matrix_intuition()
    println("\n" * "=" ^ 60)
    println("WEIGHT MATRIX INTUITION")
    println("=" ^ 60)

    W = [1.0 0.0 0.0;
         0.0 1.0 0.0;
         0.5 0.5 0.0]
    x = [0.8, 0.6, 0.1]

    println("\nWeight matrix W:")
    display(W)
    println("\n\nInput x = $x")
    println("W * x = $(W * x)")
    println("\nRow 1: [1,0,0] copies feature 1")
    println("Row 2: [0,1,0] copies feature 2")
    println("Row 3: [0.5,0.5,0] averages features 1 and 2")
end


function demo_julia_advantages()
    println("\n" * "=" ^ 60)
    println("JULIA MATRIX SYNTAX ADVANTAGES")
    println("=" ^ 60)

    A = [1 2; 3 4]
    println("\nMatrix literal: A = [1 2; 3 4]")
    println("Transpose: A' = $(A')")
    println("Matrix multiply: A * A = $(A * A)")
    println("Element-wise: A .* A = $(A .* A)")
    println("Element-wise function: sin.(A) = $(sin.(A))")

    println("\nEigenvalues: $(eigvals(A))")
    println("Rank: $(rank(A))")
    println("Trace: $(tr(A))")

    println("\nMatrix division (solve Ax = b):")
    b = [5.0, 11.0]
    x = A \ b
    println("A = $A, b = $b")
    println("x = A \\ b = $x")
    println("Verify: A * x = $(A * x)")
end


demo_vectors()
demo_basic_operations()
demo_determinant_inverse()
demo_broadcasting()
demo_weight_matrix_intuition()
demo_julia_advantages()
demo_neural_network_layer()
