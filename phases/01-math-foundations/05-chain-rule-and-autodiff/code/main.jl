# Toy reverse-mode autodiff in Julia. Builds a computation graph from
# operator overloads on a mutable Value type, runs a topological sort,
# then walks backward applying local chain-rule closures.
# Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/manual/methods/
#   https://docs.julialang.org/en/v1/manual/constructors/
#   https://docs.julialang.org/en/v1/base/base/#Base.@kwdef

using Random
using Printf

import Base: +, -, *, /, ^


mutable struct Value
    data::Float64
    grad::Float64
    backward!::Function
    children::Vector{Value}
    op::String
end

Value(x::Real) = Value(Float64(x), 0.0, () -> nothing, Value[], "leaf")
Value(x::Real, children::Vector{Value}, op::String) =
    Value(Float64(x), 0.0, () -> nothing, children, op)


function Base.show(io::IO, v::Value)
    @printf(io, "Value(data=%.4f, grad=%.4f)", v.data, v.grad)
end


function +(a::Value, b::Value)
    out = Value(a.data + b.data, Value[a, b], "+")
    out.backward! = () -> begin
        a.grad += out.grad
        b.grad += out.grad
    end
    return out
end
+(a::Value, b::Real) = a + Value(b)
+(a::Real, b::Value) = Value(a) + b


function *(a::Value, b::Value)
    out = Value(a.data * b.data, Value[a, b], "*")
    out.backward! = () -> begin
        a.grad += b.data * out.grad
        b.grad += a.data * out.grad
    end
    return out
end
*(a::Value, b::Real) = a * Value(b)
*(a::Real, b::Value) = Value(a) * b


-(a::Value) = a * Value(-1.0)
-(a::Value, b::Value) = a + (-b)
-(a::Value, b::Real) = a + Value(-b)
-(a::Real, b::Value) = Value(a) + (-b)


function ^(a::Value, n::Real)
    nf = Float64(n)
    out = Value(a.data ^ nf, Value[a], "^$nf")
    out.backward! = () -> begin
        a.grad += nf * a.data ^ (nf - 1) * out.grad
    end
    return out
end


function /(a::Value, b::Value)
    return a * (b ^ -1)
end
/(a::Value, b::Real) = a * Value(1 / b)
/(a::Real, b::Value) = Value(a) * (b ^ -1)


function relu(a::Value)
    out = Value(max(0.0, a.data), Value[a], "relu")
    out.backward! = () -> begin
        a.grad += (out.data > 0 ? 1.0 : 0.0) * out.grad
    end
    return out
end


function _tanh(a::Value)
    t = tanh(a.data)
    out = Value(t, Value[a], "tanh")
    out.backward! = () -> begin
        a.grad += (1 - t * t) * out.grad
    end
    return out
end


function _exp(a::Value)
    e = exp(a.data)
    out = Value(e, Value[a], "exp")
    out.backward! = () -> begin
        a.grad += e * out.grad
    end
    return out
end


function _log(a::Value)
    out = Value(log(a.data), Value[a], "log")
    out.backward! = () -> begin
        a.grad += (1 / a.data) * out.grad
    end
    return out
end


function backward!(root::Value)
    topo = Value[]
    visited = Set{UInt}()
    function build_topo(v::Value)
        oid = objectid(v)
        if !(oid in visited)
            push!(visited, oid)
            for c in v.children
                build_topo(c)
            end
            push!(topo, v)
        end
    end
    build_topo(root)
    root.grad = 1.0
    for v in reverse(topo)
        v.backward!()
    end
end


function demo_basic()
    println("=== Basic: y = relu(x1 * x2 + 1) ===")
    x1 = Value(2.0)
    x2 = Value(3.0)
    y = relu(x1 * x2 + 1.0)
    backward!(y)
    println("  x1 = 2.0, x2 = 3.0")
    @printf("  y = %.4f\n", y.data)
    @printf("  dy/dx1 = %.4f  (expected 3.0)\n", x1.grad)
    @printf("  dy/dx2 = %.4f  (expected 2.0)\n", x2.grad)
    @assert abs(x1.grad - 3.0) < 1e-6
    @assert abs(x2.grad - 2.0) < 1e-6
    println("  PASSED\n")
end


function demo_power()
    println("=== Power: y = x^3, dy/dx at x=2 ===")
    x = Value(2.0)
    y = x ^ 3
    backward!(y)
    @printf("  x = 2.0\n")
    @printf("  y = %.4f  (expected 8.0)\n", y.data)
    @printf("  dy/dx = %.4f  (expected 12.0 = 3*x^2)\n", x.grad)
    @assert abs(x.grad - 12.0) < 1e-6
    println("  PASSED\n")
end


function demo_complex()
    println("=== Complex: f = relu(a*b + c) ===")
    a = Value(2.0)
    b = Value(-3.0)
    c = Value(10.0)
    f = relu(a * b + c)
    backward!(f)
    @printf("  a=2, b=-3, c=10\n")
    @printf("  f = %.4f  (expected 4.0)\n", f.data)
    @printf("  df/da = %.4f  (expected -3.0)\n", a.grad)
    @printf("  df/db = %.4f  (expected 2.0)\n",  b.grad)
    @printf("  df/dc = %.4f  (expected 1.0)\n",  c.grad)
    @assert abs(a.grad + 3.0) < 1e-6
    @assert abs(b.grad - 2.0) < 1e-6
    @assert abs(c.grad - 1.0) < 1e-6
    println("  PASSED\n")
end


function demo_neuron()
    println("=== Single neuron: y = relu(w1*x1 + w2*x2 + b) ===")
    w1 = Value(0.5)
    w2 = Value(-1.5)
    x1 = Value(3.0)
    x2 = Value(2.0)
    b = Value(0.1)
    y = relu(w1 * x1 + w2 * x2 + b)
    backward!(y)
    pre = w1.data * x1.data + w2.data * x2.data + b.data
    @printf("  w1=%.1f w2=%.1f x1=%.1f x2=%.1f b=%.1f\n", w1.data, w2.data, x1.data, x2.data, b.data)
    @printf("  pre_act = %.4f\n", pre)
    @printf("  y = %.4f\n", y.data)
    @printf("  dy/dw1=%.4f dy/dw2=%.4f dy/dx1=%.4f dy/dx2=%.4f dy/db=%.4f\n",
            w1.grad, w2.grad, x1.grad, x2.grad, b.grad)
    if pre > 0
        @assert abs(w1.grad - x1.data) < 1e-6
        @assert abs(b.grad - 1.0) < 1e-6
        println("  PASSED (relu active)\n")
    else
        @assert abs(w1.grad) < 1e-6
        println("  PASSED (relu inactive)\n")
    end
end


function demo_exp_log()
    println("=== Exp and Log operations ===")
    x = Value(2.0)
    y = _exp(x)
    backward!(y)
    @printf("  exp(2.0) = %.4f  (expected %.4f)\n", y.data, exp(2.0))
    @printf("  d/dx exp(x) at x=2 = %.4f  (expected %.4f)\n", x.grad, exp(2.0))
    @assert abs(x.grad - exp(2.0)) < 1e-4
    println("  PASSED\n")

    x = Value(3.0)
    y = _log(x)
    backward!(y)
    @printf("  log(3.0) = %.4f  (expected %.4f)\n", y.data, log(3.0))
    @printf("  d/dx log(x) at x=3 = %.4f  (expected %.4f)\n", x.grad, 1 / 3)
    @assert abs(x.grad - 1 / 3) < 1e-4
    println("  PASSED\n")
end


function gradient_check(build_expr, x_val::Float64; h::Float64=1e-7)
    x = Value(x_val)
    y = build_expr(x)
    backward!(y)
    autodiff_grad = x.grad

    y_plus = build_expr(Value(x_val + h)).data
    y_minus = build_expr(Value(x_val - h)).data
    numerical_grad = (y_plus - y_minus) / (2h)

    return autodiff_grad, numerical_grad, abs(autodiff_grad - numerical_grad)
end


function demo_gradient_check()
    println("=== Gradient Checking ===")
    cases = [
        ("x^3 + 2x + 1", x -> x ^ 3 + x * 2 + 1.0),
        ("tanh(x^2)", x -> _tanh(x ^ 2)),
        ("(x+1) / (x^2+1)", x -> (x + 1.0) * ((x ^ 2 + 1.0) ^ -1)),
        ("exp(x) * x", x -> _exp(x) * x),
        ("log(x^2 + 1)", x -> _log(x ^ 2 + 1.0)),
    ]
    @printf("  %-22s %12s %12s %12s\n", "Expression", "Autodiff", "Numerical", "Diff")
    println("  " * "-" ^ 60)
    all_passed = true
    for (name, expr) in cases
        ad, num, diff = gradient_check(expr, 0.5)
        status = diff < 1e-5 ? "OK" : "FAIL"
        if diff >= 1e-5
            all_passed = false
        end
        @printf("  %-22s %12.8f %12.8f %12.2e  %s\n", name, ad, num, diff, status)
    end
    println(all_passed ? "  ALL CHECKS PASSED\n" : "  SOME CHECKS FAILED\n")
end


# Tiny MLP using our autodiff.
struct Neuron
    w::Vector{Value}
    b::Value
end

function Neuron(n_inputs::Int)
    w = [Value(rand() * 2 - 1) for _ in 1:n_inputs]
    return Neuron(w, Value(0.0))
end

function (n::Neuron)(x::Vector{Value})
    act = n.b
    for i in eachindex(x)
        act = act + n.w[i] * x[i]
    end
    return _tanh(act)
end

parameters(n::Neuron) = vcat(n.w, [n.b])


struct Layer
    neurons::Vector{Neuron}
end

Layer(n_in::Int, n_out::Int) = Layer([Neuron(n_in) for _ in 1:n_out])
(l::Layer)(x::Vector{Value}) = [n(x) for n in l.neurons]
parameters(l::Layer) = vcat([parameters(n) for n in l.neurons]...)


struct MLP
    layers::Vector{Layer}
end

function MLP(sizes::Vector{Int})
    layers = Layer[]
    for i in 1:(length(sizes) - 1)
        push!(layers, Layer(sizes[i], sizes[i + 1]))
    end
    return MLP(layers)
end

function (m::MLP)(x::Vector{Value})
    out = x
    for layer in m.layers
        out = layer(out)
    end
    return length(out) == 1 ? out[1] : out
end

parameters(m::MLP) = vcat([parameters(l) for l in m.layers]...)


function demo_mlp_training()
    println("=== Mini MLP Training on XOR ===")
    Random.seed!(42)
    model = MLP(Int[2, 4, 1])

    xs = [[Value(0.0), Value(0.0)], [Value(0.0), Value(1.0)],
          [Value(1.0), Value(0.0)], [Value(1.0), Value(1.0)]]
    ys = Float64[-1.0, 1.0, 1.0, -1.0]

    for step in 0:99
        loss = Value(0.0)
        for (x, y) in zip(xs, ys)
            pred = model(x)
            diff = pred + Value(-y)
            loss = loss + diff * diff
        end

        for p in parameters(model)
            p.grad = 0.0
        end
        backward!(loss)

        lr = 0.05
        for p in parameters(model)
            p.data -= lr * p.grad
        end

        if step % 20 == 0 || step == 99
            @printf("  step %3d  loss = %.4f\n", step, loss.data)
        end
    end

    println("\n  Predictions after training:")
    for (x, y) in zip(xs, ys)
        pred = model(x)
        sign = pred.data > 0 ? "+" : "-"
        @printf("    input=[%.0f,%.0f]  target=%+.0f  pred=%+.3f (%s)\n",
                x[1].data, x[2].data, y, pred.data, sign)
    end
    println("  DONE\n")
end


function main()
    demo_basic()
    demo_power()
    demo_complex()
    demo_neuron()
    demo_exp_log()
    demo_gradient_check()
    demo_mlp_training()
    println("All demos passed.")
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
