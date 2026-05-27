# Linear regression in Julia. Closed-form normal equation and batch
# gradient descent, plus multiple linear regression and a ridge penalty.
# Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/manual/types/
#   https://docs.julialang.org/en/v1/stdlib/Statistics/
#   https://docs.julialang.org/en/v1/stdlib/Random/

using Random
using Statistics
using Printf


function generate_simple_data(; n::Int=100, true_w::Float64=3.0, true_b::Float64=7.0,
                              noise::Float64=2.0, seed::Int=42)
    rng = MersenneTwister(seed)
    xs = [10.0 * rand(rng) for _ in 1:n]
    ys = [true_w * x + true_b + noise * randn(rng) for x in xs]
    return xs, ys
end


mutable struct GDLinearRegression
    w::Float64
    b::Float64
    lr::Float64
    history::Vector{Float64}
end


GDLinearRegression(lr::Float64) = GDLinearRegression(0.0, 0.0, lr, Float64[])


function predict(model::GDLinearRegression, xs::Vector{Float64})
    return [model.w * x + model.b for x in xs]
end


function cost(model::GDLinearRegression, xs::Vector{Float64}, ys::Vector{Float64})
    preds = predict(model, xs)
    return sum((preds .- ys) .^ 2) / length(ys)
end


function fit_gd!(model::GDLinearRegression, xs::Vector{Float64}, ys::Vector{Float64};
                epochs::Int=1000, print_every::Int=200)
    n = length(ys)
    for epoch in 0:(epochs - 1)
        preds = predict(model, xs)
        errs = preds .- ys
        dw = (2.0 / n) * sum(errs .* xs)
        db = (2.0 / n) * sum(errs)
        model.w -= model.lr * dw
        model.b -= model.lr * db
        c = cost(model, xs, ys)
        push!(model.history, c)
        if epoch % print_every == 0
            @printf("  epoch %4d  cost=%.4f  w=%.4f  b=%.4f\n", epoch, c, model.w, model.b)
        end
    end
    return model
end


function r_squared(ys::Vector{Float64}, preds::Vector{Float64})
    y_mean = mean(ys)
    ss_res = sum((ys .- preds) .^ 2)
    ss_tot = sum((ys .- y_mean) .^ 2)
    if ss_tot == 0.0
        return ss_res == 0.0 ? 1.0 : 0.0
    end
    return 1.0 - ss_res / ss_tot
end


function fit_normal_equation(xs::Vector{Float64}, ys::Vector{Float64})
    x_mean = mean(xs)
    y_mean = mean(ys)
    num = sum((xs .- x_mean) .* (ys .- y_mean))
    den = sum((xs .- x_mean) .^ 2)
    if den == 0.0
        return 0.0, y_mean
    end
    w = num / den
    b = y_mean - w * x_mean
    return w, b
end


mutable struct MultiLinearRegression
    weights::Vector{Float64}
    bias::Float64
    lr::Float64
end


MultiLinearRegression(n_features::Int, lr::Float64) =
    MultiLinearRegression(zeros(n_features), 0.0, lr)


function predict_multi(model::MultiLinearRegression, X::Vector{Vector{Float64}})
    return [sum(model.weights .* row) + model.bias for row in X]
end


function fit_multi!(model::MultiLinearRegression, X::Vector{Vector{Float64}},
                   ys::Vector{Float64}; epochs::Int=1000, print_every::Int=200)
    n = length(ys)
    n_features = length(X[1])
    for epoch in 0:(epochs - 1)
        preds = predict_multi(model, X)
        errs = preds .- ys
        for j in 1:n_features
            grad = (2.0 / n) * sum(errs[i] * X[i][j] for i in 1:n)
            model.weights[j] -= model.lr * grad
        end
        model.bias -= model.lr * ((2.0 / n) * sum(errs))
        if epoch % print_every == 0
            mse = sum(errs .^ 2) / n
            @printf("  epoch %4d  cost=%.4f\n", epoch, mse)
        end
    end
    return model
end


function standardize(X::Vector{Vector{Float64}})
    n_samples = length(X)
    n_features = length(X[1])
    means = [mean(X[i][j] for i in 1:n_samples) for j in 1:n_features]
    stds = Float64[]
    for j in 1:n_features
        v = sum((X[i][j] - means[j]) ^ 2 for i in 1:n_samples) / n_samples
        push!(stds, sqrt(v))
    end
    X_scaled = [Float64[
        stds[j] > 0 ? (X[i][j] - means[j]) / stds[j] : 0.0
        for j in 1:n_features
    ] for i in 1:n_samples]
    return X_scaled, means, stds
end


function generate_house_data(; n::Int=100, seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Float64[]
    for _ in 1:n
        size = 500 + 2500 * rand(rng)
        bedrooms = float(rand(rng, 1:5))
        age = 50 * rand(rng)
        price = 50 * size + 10000 * bedrooms - 1000 * age + 50000 + 20000 * randn(rng)
        push!(X, Float64[size, bedrooms, age])
        push!(ys, price)
    end
    return X, ys
end


mutable struct RidgeRegression
    weights::Vector{Float64}
    bias::Float64
    lr::Float64
    alpha::Float64
end


RidgeRegression(n_features::Int, lr::Float64, alpha::Float64) =
    RidgeRegression(zeros(n_features), 0.0, lr, alpha)


function predict_ridge(model::RidgeRegression, X::Vector{Vector{Float64}})
    return [sum(model.weights .* row) + model.bias for row in X]
end


function fit_ridge!(model::RidgeRegression, X::Vector{Vector{Float64}},
                   ys::Vector{Float64}; epochs::Int=1000, print_every::Int=200)
    n = length(ys)
    n_features = length(X[1])
    for epoch in 0:(epochs - 1)
        preds = predict_ridge(model, X)
        errs = preds .- ys
        mse_v = sum(errs .^ 2) / n
        reg = model.alpha * sum(model.weights .^ 2)
        for j in 1:n_features
            grad = (2.0 / n) * sum(errs[i] * X[i][j] for i in 1:n)
            grad += 2 * model.alpha * model.weights[j]
            model.weights[j] -= model.lr * grad
        end
        model.bias -= model.lr * ((2.0 / n) * sum(errs))
        if epoch % print_every == 0
            @printf("  epoch %4d  cost=%.4f  L2=%.4f\n", epoch, mse_v + reg, reg)
        end
    end
    return model
end


function demo_simple_regression()
    println("=" ^ 60)
    println("LINEAR REGRESSION (GRADIENT DESCENT)")
    println("=" ^ 60)
    xs, ys = generate_simple_data()
    @printf("\nGenerated %d samples, true y = 3x + 7 + noise\n", length(xs))
    model = GDLinearRegression(0.005)
    fit_gd!(model, xs, ys; epochs=1000, print_every=200)
    preds = predict(model, xs)
    @printf("\nLearned: y = %.4fx + %.4f\n", model.w, model.b)
    @printf("R^2: %.4f\n", r_squared(ys, preds))
    return xs, ys
end


function demo_normal_equation(xs::Vector{Float64}, ys::Vector{Float64})
    println("\n" * "=" ^ 60)
    println("LINEAR REGRESSION (NORMAL EQUATION)")
    println("=" ^ 60)
    w, b = fit_normal_equation(xs, ys)
    preds = [w * x + b for x in xs]
    @printf("\nClosed-form: y = %.4fx + %.4f\n", w, b)
    @printf("R^2: %.4f\n", r_squared(ys, preds))
end


function demo_multiple_regression()
    println("\n" * "=" ^ 60)
    println("MULTIPLE LINEAR REGRESSION (3 FEATURES)")
    println("=" ^ 60)
    X_raw, ys_raw = generate_house_data()
    X_scaled, _, _ = standardize(X_raw)
    y_mean = mean(ys_raw)
    y_std = std(ys_raw; corrected=false)
    ys_scaled = [(y - y_mean) / y_std for y in ys_raw]

    model = MultiLinearRegression(3, 0.01)
    fit_multi!(model, X_scaled, ys_scaled; epochs=1000, print_every=200)
    preds = predict_multi(model, X_scaled)
    @printf("\nStandardized weights: [%.4f, %.4f, %.4f]\n",
            model.weights[1], model.weights[2], model.weights[3])
    @printf("Standardized bias: %.4f\n", model.bias)
    @printf("R^2 (scaled space): %.4f\n", r_squared(ys_scaled, preds))
    return X_scaled, ys_scaled, model
end


function demo_ridge(X_scaled::Vector{Vector{Float64}}, ys_scaled::Vector{Float64},
                   plain_model::MultiLinearRegression)
    println("\n" * "=" ^ 60)
    println("RIDGE REGRESSION (L2)")
    println("=" ^ 60)
    ridge = RidgeRegression(3, 0.01, 0.1)
    fit_ridge!(ridge, X_scaled, ys_scaled; epochs=1000, print_every=200)
    @printf("\nRidge  weights: [%.4f, %.4f, %.4f]\n",
            ridge.weights[1], ridge.weights[2], ridge.weights[3])
    @printf("Plain  weights: [%.4f, %.4f, %.4f]\n",
            plain_model.weights[1], plain_model.weights[2], plain_model.weights[3])
    println("Ridge shrinks weights toward zero through the L2 penalty.")
end


function demo_train_test_split()
    println("\n" * "=" ^ 60)
    println("TRAIN/TEST SPLIT")
    println("=" ^ 60)
    xs, ys = generate_simple_data()
    split = Int(round(0.8 * length(xs)))
    xs_train = xs[1:split]
    xs_test = xs[(split + 1):end]
    ys_train = ys[1:split]
    ys_test = ys[(split + 1):end]
    model = GDLinearRegression(0.005)
    fit_gd!(model, xs_train, ys_train; epochs=1000, print_every=500)
    train_r2 = r_squared(ys_train, predict(model, xs_train))
    test_r2 = r_squared(ys_test, predict(model, xs_test))
    @printf("\nTrain R^2: %.4f\n", train_r2)
    @printf("Test  R^2: %.4f\n", test_r2)
end


function main()
    xs, ys = demo_simple_regression()
    demo_normal_equation(xs, ys)
    X_scaled, ys_scaled, plain_model = demo_multiple_regression()
    demo_ridge(X_scaled, ys_scaled, plain_model)
    demo_train_test_split()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
