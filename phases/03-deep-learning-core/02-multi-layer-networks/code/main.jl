# Lesson: Multi-Layer Networks (phase 03 / lesson 02)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

sigmoid(x) = 1.0 / (1.0 + exp(-clamp(x, -500.0, 500.0)))

uniform(lo, hi) = lo + (hi - lo) * rand()

mutable struct Layer
    weights::Vector{Vector{Float64}}
    biases::Vector{Float64}
    last_input::Vector{Float64}
    last_output::Vector{Float64}
end

function Layer(n_inputs::Int, n_neurons::Int; weights=nothing, biases=nothing)
    w = weights === nothing ? [[uniform(-1, 1) for _ in 1:n_inputs] for _ in 1:n_neurons] : weights
    b = biases === nothing ? zeros(n_neurons) : biases
    return Layer(w, b, Float64[], Float64[])
end

function forward!(layer::Layer, inputs)
    layer.last_input = Float64.(inputs)
    layer.last_output = Float64[]
    for (neuron_idx, w) in enumerate(layer.weights)
        if length(w) != length(inputs)
            throw(ArgumentError("neuron $(neuron_idx - 1) expects $(length(w)) inputs, got $(length(inputs))"))
        end
        z = sum(w .* inputs) + layer.biases[neuron_idx]
        push!(layer.last_output, sigmoid(z))
    end
    return layer.last_output
end

struct Network
    layers::Vector{Layer}
end

function forward!(net::Network, inputs)
    current = inputs
    for layer in net.layers
        current = forward!(layer, current)
    end
    return current
end

count_parameters(net::Network) = sum(sum(length.(l.weights)) + length(l.biases) for l in net.layers)

with_commas(n::Int) = replace(string(n), r"(?<=\d)(?=(\d{3})+$)" => ",")

banner(title) = (println("="^60); println(title); println("="^60))

function main()
    banner("DEMO 1: XOR with hand-tuned 2-2-1 network")

    hidden = Layer(2, 2; weights=[[20.0, 20.0], [-20.0, -20.0]], biases=[-10.0, 30.0])
    output = Layer(2, 1; weights=[[20.0, 20.0]], biases=[-30.0])
    xor_net = Network([hidden, output])

    xor_data = [([0, 0], 0), ([0, 1], 1), ([1, 0], 1), ([1, 1], 0)]

    all_correct = true
    for (inputs, expected) in xor_data
        result = forward!(xor_net, inputs)
        predicted = result[1] >= 0.5 ? 1 : 0
        status = predicted == expected ? "OK" : "WRONG"
        predicted != expected && (all_correct = false)
        @printf("  %s -> %.6f (rounded: %d, expected: %d) %s\n", inputs, result[1], predicted, expected, status)
    end

    println("\nXOR solved: ", all_correct ? "True" : "False")
    println("Parameters: ", count_parameters(xor_net))

    println()
    banner("DEMO 2: Circle classification with 2-8-1 network")

    Random.seed!(42)
    data = Tuple{Vector{Float64},Int}[]
    for _ in 1:200
        x = uniform(-1, 1)
        y = uniform(-1, 1)
        label = x * x + y * y < 0.25 ? 1 : 0
        push!(data, ([x, y], label))
    end

    inside_count = count(d -> d[2] == 1, data)
    outside_count = length(data) - inside_count
    println("  Dataset: $(length(data)) points ($inside_count inside, $outside_count outside)")

    Random.seed!(7)
    circle_net = Network([Layer(2, 8), Layer(8, 1)])

    correct = 0
    for (inputs, expected) in data
        result = forward!(circle_net, inputs)
        predicted = result[1] >= 0.5 ? 1 : 0
        predicted == expected && (correct += 1)
    end

    @printf("  Accuracy with random weights: %d/%d (%.1f%%)\n", correct, length(data), 100 * correct / length(data))
    println("  Parameters: ", count_parameters(circle_net))
    println("  (Random weights give poor accuracy -- training needed)")

    println()
    banner("DEMO 3: Forward pass internals on XOR")

    for (inputs, expected) in xor_data
        forward!(xor_net, inputs)
        h = xor_net.layers[1].last_output
        o = xor_net.layers[2].last_output
        println("  Input: ", inputs)
        @printf("    Hidden: [%.6f, %.6f]\n", h[1], h[2])
        @printf("    Output: %.6f -> %s (expected: %d)\n", o[1], o[1] >= 0.5 ? "1" : "0", expected)
    end

    println()
    banner("DEMO 4: Parameter count for classic architectures")

    architectures = [
        ("2-3-1 (this lesson)", [2, 3, 1]),
        ("2-8-1 (circle)", [2, 8, 1]),
        ("784-256-128-10 (MNIST)", [784, 256, 128, 10]),
        ("784-512-256-128-10 (deep MNIST)", [784, 512, 256, 128, 10]),
    ]

    for (name, sizes) in architectures
        net = Network([Layer(sizes[i-1], sizes[i]) for i in 2:length(sizes)])
        println("  $name: $(with_commas(count_parameters(net))) parameters")
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
