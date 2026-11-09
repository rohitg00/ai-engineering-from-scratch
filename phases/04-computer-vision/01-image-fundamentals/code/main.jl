# Lesson: Image Fundamentals: Pixels, Channels, Color Spaces (phase 04 / lesson 01)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/04-computer-vision/01-image-fundamentals/docs/en.md
# Run: julia code/main.jl

using Random
using Statistics
using Printf

const IMAGENET_MEAN = Float32[0.485, 0.456, 0.406]
const IMAGENET_STD = Float32[0.229, 0.224, 0.225]

linspace(a, b, n) = n == 1 ? [Float64(a)] : [a + (b - a) * (i - 1) / (n - 1) for i in 1:n]

function synthetic_image(; height=128, width=192, seed=0)
    rng = Xoshiro(seed)
    ys = linspace(0, 1, height)
    xs = linspace(0, 1, width)
    noise = 6 .* randn(rng, height, width, 3)
    rgb = Array{UInt8}(undef, height, width, 3)
    for i in 1:height, j in 1:width
        yy, xx = ys[i], xs[j]
        channels = ((sin(xx * 6) * 0.5 + 0.5) * 255, yy * 255, (1 - yy) * xx * 255)
        for c in 1:3
            rgb[i, j, c] = trunc(UInt8, clamp(channels[c] + noise[i, j, c], 0, 255))
        end
    end
    return rgb
end

pyshape(a) = "(" * join(size(a), ", ") * ")"
pylist(v) = "[" * join(string.(v), ", ") * "]"
dtype(a) = eltype(a) == UInt8 ? "uint8" : eltype(a) == Float32 ? "float32" : string(eltype(a))

function inspect(arr; label="image")
    if ndims(arr) == 2
        @printf("[%s] dtype=%s shape=%s min=%s max=%s mean=%.2f\n", label, dtype(arr), pyshape(arr),
            minimum(arr), maximum(arr), mean(Float64.(arr)))
        return
    end
    means = [round(mean(Float64.(arr[:, :, c])); digits=2) for c in 1:size(arr, 3)]
    println("[$label] dtype=$(dtype(arr)) shape=$(pyshape(arr)) min=$(minimum(arr)) max=$(maximum(arr)) per-channel mean=$(pylist(means))")
end

hwc_to_chw(arr) = permutedims(arr, (3, 1, 2))
chw_to_hwc(arr) = permutedims(arr, (2, 3, 1))

function rgb_to_grayscale(rgb)
    w = Float32[0.299, 0.587, 0.114]
    f = Float32.(rgb)
    return trunc.(UInt8, f[:, :, 1] .* w[1] .+ f[:, :, 2] .* w[2] .+ f[:, :, 3] .* w[3])
end

function rgb_to_hsv(rgb)
    f = Float32.(rgb) ./ 255.0f0
    h, w, _ = size(f)
    out = zeros(Float32, h, w, 3)
    for i in 1:h, j in 1:w
        r, g, b = f[i, j, 1], f[i, j, 2], f[i, j, 3]
        cmax = max(r, g, b)
        cmin = min(r, g, b)
        delta = cmax - cmin
        hue = 0.0f0
        if delta > 0
            k = argmax((r, g, b))
            hue = k == 1 ? mod((g - b) / delta, 6.0f0) : k == 2 ? (b - r) / delta + 2 : (r - g) / delta + 4
        end
        out[i, j, 1] = hue * 60.0f0
        out[i, j, 2] = cmax > 0 ? delta / cmax : 0.0f0
        out[i, j, 3] = cmax
    end
    return out
end

function preprocess_imagenet(rgb_uint8)
    x = Float32.(rgb_uint8) ./ 255.0f0
    x = (x .- reshape(IMAGENET_MEAN, 1, 1, 3)) ./ reshape(IMAGENET_STD, 1, 1, 3)
    return permutedims(x, (3, 1, 2))
end

function deprocess_imagenet(chw)
    x = permutedims(chw, (2, 3, 1))
    x = x .* reshape(IMAGENET_STD, 1, 1, 3) .+ reshape(IMAGENET_MEAN, 1, 1, 3)
    return trunc.(UInt8, clamp.(x .* 255.0f0, 0, 255))
end

function resize_coordinates(source_length, target_length)
    target_length < 1 && throw(ArgumentError("target length must be positive"))
    source_length < 1 && throw(ArgumentError("source length must be positive"))
    target_length == 1 && return zeros(Float32, 1)
    return Float32.(linspace(0, source_length - 1, target_length))
end

to_pixel(v) = UInt8(clamp(round(v), 0, 255))

function nearest_resize(arr, th, tw)
    y = round.(Int, resize_coordinates(size(arr, 1), th)) .+ 1
    x = round.(Int, resize_coordinates(size(arr, 2), tw)) .+ 1
    return arr[y, x, :]
end

function bilinear_resize(arr, th, tw)
    y = resize_coordinates(size(arr, 1), th)
    x = resize_coordinates(size(arr, 2), tw)
    h, w, c = size(arr)
    src = Float32.(arr)
    out = similar(arr, th, tw, c)
    for i in 1:th, j in 1:tw
        y0 = floor(Int, y[i]); x0 = floor(Int, x[j])
        y1 = min(y0 + 1, h - 1); x1 = min(x0 + 1, w - 1)
        wy = y[i] - y0; wx = x[j] - x0
        for k in 1:c
            top = src[y0+1, x0+1, k] * (1 - wx) + src[y0+1, x1+1, k] * wx
            bottom = src[y1+1, x0+1, k] * (1 - wx) + src[y1+1, x1+1, k] * wx
            out[i, j, k] = to_pixel(top * (1 - wy) + bottom * wy)
        end
    end
    return out
end

function cubic_weight(distance; tension=-0.5f0)
    x = abs(distance)
    x <= 1 && return (tension + 2) * x^3 - (tension + 3) * x^2 + 1
    x < 2 && return tension * x^3 - 5 * tension * x^2 + 8 * tension * x - 4 * tension
    return 0.0f0
end

function cubic_taps(coords, limit)
    taps = Vector{NTuple{4,Tuple{Int,Float32}}}(undef, length(coords))
    for (n, c) in enumerate(coords)
        base = floor(Int, c)
        neighbors = base .+ (-1, 0, 1, 2)
        weights = cubic_weight.(c .- neighbors)
        weights = weights ./ sum(weights)
        taps[n] = ntuple(t -> (clamp(neighbors[t], 0, limit - 1) + 1, weights[t]), 4)
    end
    return taps
end

function bicubic_resize(arr, th, tw)
    h, w, c = size(arr)
    xt = cubic_taps(resize_coordinates(w, tw), w)
    yt = cubic_taps(resize_coordinates(h, th), h)
    src = Float32.(arr)
    horizontal = zeros(Float32, h, tw, c)
    for i in 1:h, j in 1:tw, k in 1:c, (idx, wt) in xt[j]
        horizontal[i, j, k] += src[i, idx, k] * wt
    end
    out = similar(arr, th, tw, c)
    for i in 1:th, j in 1:tw, k in 1:c
        acc = 0.0f0
        for (idx, wt) in yt[i]
            acc += horizontal[idx, j, k] * wt
        end
        out[i, j, k] = to_pixel(acc)
    end
    return out
end

function resize_compare(arr; scale=3)
    (scale isa Integer && scale >= 1) || throw(ArgumentError("scale must be a positive integer"))
    th, tw = size(arr, 1) * scale, size(arr, 2) * scale
    return [
        "nearest" => nearest_resize(arr, th, tw),
        "bilinear" => bilinear_resize(arr, th, tw),
        "bicubic" => bicubic_resize(arr, th, tw),
    ]
end

function local_roughness(x)
    f = Float32.(x)
    gy = diff(f; dims=1)
    gx = diff(f; dims=2)
    return Float64(mean(abs.(gy)) + mean(abs.(gx)))
end

channel_stats(x, f) = [Float64(Float32(round(f(Float64.(x[c, :, :])); digits=3))) for c in 1:size(x, 1)]

function main()
    arr = synthetic_image()
    println("source: deterministic synthetic RGB image (offline)")
    inspect(arr; label="raw")

    chw = hwc_to_chw(arr)
    println("HWC shape: $(pyshape(arr))   CHW shape: $(pyshape(chw))")

    gray = rgb_to_grayscale(arr)
    hsv = rgb_to_hsv(arr)
    println("grayscale shape: $(pyshape(gray))")
    @printf("hsv hue range:   [%.1f, %.1f] deg\n", minimum(hsv[:, :, 1]), maximum(hsv[:, :, 1]))
    @printf("hsv sat range:   [%.2f, %.2f]\n", minimum(hsv[:, :, 2]), maximum(hsv[:, :, 2]))
    @printf("hsv val range:   [%.2f, %.2f]\n", minimum(hsv[:, :, 3]), maximum(hsv[:, :, 3]))

    x = preprocess_imagenet(arr)
    println("preprocessed shape: $(pyshape(x))  dtype: $(dtype(x))")
    println("per-channel mean: ", pylist(channel_stats(x, mean)))
    println("per-channel std:  ", pylist(channel_stats(x, v -> std(v; corrected=false))))

    roundtrip = deprocess_imagenet(x)
    max_diff = maximum(abs.(Int.(roundtrip) .- Int.(arr)))
    println("roundtrip max pixel diff: $max_diff")

    for (name, out) in resize_compare(arr; scale=3)
        @printf("%8s  shape=%s  roughness=%6.2f\n", name, pyshape(out), local_roughness(out))
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
