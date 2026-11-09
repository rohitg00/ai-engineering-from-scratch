# Lesson: Convolutions from Scratch (phase 04 / lesson 02)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

function pad2d(x::Array{Float32,3}, p::Int)
    p == 0 && return x
    c, h, w = size(x)
    out = zeros(Float32, c, h + 2p, w + 2p)
    out[:, p+1:p+h, p+1:p+w] .= x
    return out
end

output_size(h_in, k, p, s) = fld(h_in + 2p - k, s) + 1

function conv2d_naive(x, w, b=nothing; stride=1, padding=0)
    c_in, h, w_in = size(x)
    c_out, c_in_w, kh, kw = size(w)
    @assert c_in == c_in_w
    x_pad = pad2d(x, padding)
    h_out = output_size(h, kh, padding, stride)
    w_out = output_size(w_in, kw, padding, stride)
    out = zeros(Float32, c_out, h_out, w_out)
    for oc in 1:c_out, i in 1:h_out, j in 1:w_out
        hs = (i - 1) * stride
        ws = (j - 1) * stride
        acc = 0.0f0
        for c in 1:c_in, u in 1:kh, v in 1:kw
            acc += x_pad[c, hs+u, ws+v] * w[oc, c, u, v]
        end
        out[oc, i, j] = acc
    end
    if b !== nothing
        out .+= reshape(b, :, 1, 1)
    end
    return out
end

function im2col(x, kh, kw; stride=1, padding=0)
    c_in, h, w = size(x)
    x_pad = pad2d(x, padding)
    h_out = output_size(h, kh, padding, stride)
    w_out = output_size(w, kw, padding, stride)
    cols = zeros(Float32, c_in * kh * kw, h_out * w_out)
    col = 1
    for i in 1:h_out, j in 1:w_out
        hs = (i - 1) * stride
        ws = (j - 1) * stride
        row = 1
        for c in 1:c_in, u in 1:kh, v in 1:kw
            cols[row, col] = x_pad[c, hs+u, ws+v]
            row += 1
        end
        col += 1
    end
    return cols, h_out, w_out
end

function conv2d_im2col(x, w, b=nothing; stride=1, padding=0)
    c_out, c_in, kh, kw = size(w)
    cols, h_out, w_out = im2col(x, kh, kw; stride=stride, padding=padding)
    w_flat = reshape(permutedims(w, (1, 4, 3, 2)), c_out, :)
    out = w_flat * cols
    b !== nothing && (out .+= b)
    return permutedims(reshape(out, c_out, w_out, h_out), (1, 3, 2))
end

function receptive_field(layers)
    rf = 1
    stride_prod = 1
    for (k, s) in layers
        rf += (k - 1) * stride_prod
        stride_prod *= s
    end
    return rf
end

const KERNELS = Dict(
    "identity" => Float32[0 0 0; 0 1 0; 0 0 0],
    "blur_3x3" => ones(Float32, 3, 3) ./ 9.0f0,
    "sharpen" => Float32[0 -1 0; -1 5 -1; 0 -1 0],
    "sobel_x" => Float32[-1 0 1; -2 0 2; -1 0 1],
    "sobel_y" => Float32[-1 -2 -1; 0 0 0; 1 2 1],
)

function apply_kernel(img2d, kernel)
    x = reshape(Float32.(img2d), 1, size(img2d)...)
    w = reshape(kernel, 1, 1, size(kernel)...)
    return conv2d_im2col(x, w; padding=1)[1, :, :]
end

function synthetic_step_image(size=16)
    img = zeros(Float32, 1, size, size)
    img[:, :, size÷2+1:end] .= 1.0f0
    return img
end

function test_against_naive()
    rng = Xoshiro(0)
    x = randn(rng, Float32, 3, 16, 16)
    w = randn(rng, Float32, 8, 3, 3, 3)
    b = randn(rng, Float32, 8)
    y_naive = conv2d_naive(x, w, b; padding=1)
    y_im2col = conv2d_im2col(x, w, b; padding=1)
    return size(y_naive), Float64(maximum(abs.(y_naive .- y_im2col)))
end

pyshape(t) = "(" * join(t, ", ") * ")"

function numpy_rows(m)
    cells = [string(round(Int, v)) * "." for v in m]
    width = maximum(length, cells)
    rows = [join(lpad.(cells[i, :], width), " ") for i in 1:size(m, 1)]
    return "[[" * join(rows, "]\n [") * "]]"
end

function main()
    shape, diff = test_against_naive()
    println("conv equivalence: naive vs im2col     shape=$(pyshape(shape))   max|diff|=$(@sprintf("%.2e", diff))")

    x = synthetic_step_image()
    y = apply_kernel(x[1, :, :], KERNELS["sobel_x"])
    println("\nsobel_x on a left/right step image (first five rows):")
    println(numpy_rows(round.(y[1:5, :]; digits=1)))

    println("\noutput size cheatsheet  (H=32):")
    for (k, p, s) in [(3, 0, 1), (3, 1, 1), (3, 1, 2), (2, 0, 2), (7, 3, 2)]
        println("  K=$k P=$p S=$s  ->  H_out=$(output_size(32, k, p, s))")
    end

    stacks = [
        [(3, 1)],
        [(3, 1), (3, 1)],
        [(3, 1), (3, 1), (3, 1)],
        [(3, 1), (3, 2), (3, 1), (3, 2)],
    ]
    println("\nreceptive field grows with depth:")
    for stack in stacks
        println("  layers=[", join(("($k, $s)" for (k, s) in stack), ", "), "]  ->  RF=$(receptive_field(stack))")
    end
end

main()
