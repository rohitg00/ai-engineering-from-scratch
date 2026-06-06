# Logistic regression in Julia. Sigmoid + binary cross-entropy gradient
# descent for two classes, plus multi-class softmax regression. Reports
# confusion-matrix metrics. Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/manual/mathematical-operations/
#   https://docs.julialang.org/en/v1/stdlib/Random/
#   https://docs.julialang.org/en/v1/stdlib/Statistics/

using Random
using Statistics
using Printf


function sigmoid(z::Float64)::Float64
    z_clip = clamp(z, -500.0, 500.0)
    return 1.0 / (1.0 + exp(-z_clip))
end


function generate_two_class_data(; n::Int=200, seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Int[]
    half = n ÷ 2
    for _ in 1:half
        push!(X, Float64[2.0 + randn(rng), 2.0 + randn(rng)])
        push!(ys, 0)
    end
    for _ in 1:half
        push!(X, Float64[5.0 + randn(rng), 5.0 + randn(rng)])
        push!(ys, 1)
    end
    perm = randperm(rng, length(X))
    return X[perm], ys[perm]
end


mutable struct LogisticRegression
    weights::Vector{Float64}
    bias::Float64
    lr::Float64
    history::Vector{Float64}
end


LogisticRegression(n_features::Int, lr::Float64) =
    LogisticRegression(zeros(n_features), 0.0, lr, Float64[])


function predict_proba(model::LogisticRegression, x::Vector{Float64})::Float64
    z = sum(model.weights .* x) + model.bias
    return sigmoid(z)
end


function predict_class(model::LogisticRegression, x::Vector{Float64};
                     threshold::Float64=0.5)::Int
    return predict_proba(model, x) >= threshold ? 1 : 0
end


function bce_loss(model::LogisticRegression, X::Vector{Vector{Float64}}, ys::Vector{Int})
    n = length(ys)
    total = 0.0
    for i in 1:n
        p = clamp(predict_proba(model, X[i]), 1e-15, 1 - 1e-15)
        total += ys[i] * log(p) + (1 - ys[i]) * log(1 - p)
    end
    return -total / n
end


function fit_logistic!(model::LogisticRegression, X::Vector{Vector{Float64}},
                      ys::Vector{Int}; epochs::Int=1000, print_every::Int=200)
    n = length(ys)
    n_features = length(X[1])
    for epoch in 0:(epochs - 1)
        dw = zeros(n_features)
        db = 0.0
        for i in 1:n
            p = predict_proba(model, X[i])
            err = p - ys[i]
            for j in 1:n_features
                dw[j] += err * X[i][j]
            end
            db += err
        end
        for j in 1:n_features
            model.weights[j] -= model.lr * (dw[j] / n)
        end
        model.bias -= model.lr * (db / n)
        loss = bce_loss(model, X, ys)
        push!(model.history, loss)
        if epoch % print_every == 0
            @printf("  epoch %4d  loss=%.4f  w=[%.3f, %.3f]  b=%.3f\n",
                    epoch, loss, model.weights[1], model.weights[2], model.bias)
        end
    end
    return model
end


function accuracy(model::LogisticRegression, X::Vector{Vector{Float64}}, ys::Vector{Int})
    correct = 0
    for i in 1:length(ys)
        if predict_class(model, X[i]) == ys[i]
            correct += 1
        end
    end
    return correct / length(ys)
end


struct ClassificationMetrics
    tp::Int
    tn::Int
    fp::Int
    fn::Int
end


function build_metrics(y_true::Vector{Int}, y_pred::Vector{Int})
    tp = sum(1 for i in 1:length(y_true) if y_true[i] == 1 && y_pred[i] == 1)
    tn = sum(1 for i in 1:length(y_true) if y_true[i] == 0 && y_pred[i] == 0)
    fp = sum(1 for i in 1:length(y_true) if y_true[i] == 0 && y_pred[i] == 1)
    fn = sum(1 for i in 1:length(y_true) if y_true[i] == 1 && y_pred[i] == 0)
    return ClassificationMetrics(tp, tn, fp, fn)
end


metric_accuracy(m::ClassificationMetrics) =
    (m.tp + m.tn + m.fp + m.fn) > 0 ? (m.tp + m.tn) / (m.tp + m.tn + m.fp + m.fn) : 0.0
metric_precision(m::ClassificationMetrics) =
    (m.tp + m.fp) > 0 ? m.tp / (m.tp + m.fp) : 0.0
metric_recall(m::ClassificationMetrics) =
    (m.tp + m.fn) > 0 ? m.tp / (m.tp + m.fn) : 0.0


function metric_f1(m::ClassificationMetrics)
    p = metric_precision(m)
    r = metric_recall(m)
    return (p + r) > 0 ? 2 * p * r / (p + r) : 0.0
end


function print_report(m::ClassificationMetrics)
    println("\n  Confusion Matrix:")
    println("                  Predicted")
    println("                  Pos   Neg")
    @printf("  Actual Pos     %4d  %4d\n", m.tp, m.fn)
    @printf("  Actual Neg     %4d  %4d\n", m.fp, m.tn)
    @printf("\n  Accuracy:  %.4f\n", metric_accuracy(m))
    @printf("  Precision: %.4f\n", metric_precision(m))
    @printf("  Recall:    %.4f\n", metric_recall(m))
    @printf("  F1 Score:  %.4f\n", metric_f1(m))
end


function softmax(scores::Vector{Float64})::Vector{Float64}
    m = maximum(scores)
    e = [exp(s - m) for s in scores]
    s = sum(e)
    return e ./ s
end


mutable struct SoftmaxRegression
    weights::Vector{Vector{Float64}}
    biases::Vector{Float64}
    lr::Float64
    n_features::Int
    n_classes::Int
end


function SoftmaxRegression(n_features::Int, n_classes::Int, lr::Float64)
    SoftmaxRegression(
        [zeros(n_features) for _ in 1:n_classes],
        zeros(n_classes),
        lr,
        n_features,
        n_classes,
    )
end


function predict_proba_softmax(model::SoftmaxRegression, x::Vector{Float64})::Vector{Float64}
    scores = [sum(model.weights[k] .* x) + model.biases[k] for k in 1:model.n_classes]
    return softmax(scores)
end


function predict_class_softmax(model::SoftmaxRegression, x::Vector{Float64})::Int
    probs = predict_proba_softmax(model, x)
    return argmax(probs) - 1
end


function fit_softmax!(model::SoftmaxRegression, X::Vector{Vector{Float64}},
                     ys::Vector{Int}; epochs::Int=1000, print_every::Int=200)
    n = length(ys)
    for epoch in 0:(epochs - 1)
        grad_w = [zeros(model.n_features) for _ in 1:model.n_classes]
        grad_b = zeros(model.n_classes)
        total_loss = 0.0
        for i in 1:n
            probs = predict_proba_softmax(model, X[i])
            for k in 1:model.n_classes
                target = ys[i] == (k - 1) ? 1.0 : 0.0
                err = probs[k] - target
                for j in 1:model.n_features
                    grad_w[k][j] += err * X[i][j]
                end
                grad_b[k] += err
            end
            true_prob = max(probs[ys[i] + 1], 1e-15)
            total_loss -= log(true_prob)
        end
        for k in 1:model.n_classes
            for j in 1:model.n_features
                model.weights[k][j] -= model.lr * (grad_w[k][j] / n)
            end
            model.biases[k] -= model.lr * (grad_b[k] / n)
        end
        if epoch % print_every == 0
            @printf("  epoch %4d  loss=%.4f\n", epoch, total_loss / n)
        end
    end
    return model
end


function generate_three_class_data(; seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Int[]
    centers = [(1.0, 1.0), (5.0, 1.0), (3.0, 5.0)]
    for (label, (cx, cy)) in enumerate(centers)
        for _ in 1:50
            push!(X, Float64[cx + 0.8 * randn(rng), cy + 0.8 * randn(rng)])
            push!(ys, label - 1)
        end
    end
    perm = randperm(rng, length(X))
    return X[perm], ys[perm]
end


function demo_binary_logistic()
    println("=" ^ 60)
    println("BINARY LOGISTIC REGRESSION")
    println("=" ^ 60)
    X, ys = generate_two_class_data()
    split = Int(round(0.8 * length(X)))
    X_train = X[1:split]
    X_test = X[(split + 1):end]
    ys_train = ys[1:split]
    ys_test = ys[(split + 1):end]

    @printf("\nSamples: %d  features: 2  classes: {0, 1}\n", length(X))
    @printf("Train: %d  Test: %d\n", length(X_train), length(X_test))

    model = LogisticRegression(2, 0.1)
    fit_logistic!(model, X_train, ys_train; epochs=1000, print_every=200)

    @printf("\nTrain accuracy: %.4f\n", accuracy(model, X_train, ys_train))
    @printf("Test  accuracy: %.4f\n", accuracy(model, X_test, ys_test))
    @printf("Weights: [%.4f, %.4f]\n", model.weights[1], model.weights[2])
    @printf("Bias:    %.4f\n", model.bias)

    y_pred = [predict_class(model, x) for x in X_test]
    metrics = build_metrics(ys_test, y_pred)
    print_report(metrics)
    return model, X_test, ys_test
end


function demo_decision_boundary(model::LogisticRegression)
    println("\n" * "=" ^ 60)
    println("DECISION BOUNDARY")
    println("=" ^ 60)
    w1, w2 = model.weights[1], model.weights[2]
    b = model.bias
    @printf("\nBoundary: %.4f*x1 + %.4f*x2 + %.4f = 0\n", w1, w2, b)
    if abs(w2) > 1e-10
        @printf("Solved for x2: x2 = %.4f*x1 + %.4f\n", -w1 / w2, -b / w2)
    end
    test_points = [Float64[3.0, 3.0], Float64[3.5, 3.5], Float64[4.0, 4.0],
                   Float64[2.5, 2.5], Float64[5.0, 5.0]]
    println("\nProbabilities near the boundary:")
    for point in test_points
        prob = predict_proba(model, point)
        pred = predict_class(model, point)
        @printf("  [%.2f, %.2f] -> prob=%.4f  class=%d\n",
                point[1], point[2], prob, pred)
    end
end


function demo_threshold_tuning(model::LogisticRegression,
                              X_test::Vector{Vector{Float64}}, ys_test::Vector{Int})
    println("\n" * "=" ^ 60)
    println("THRESHOLD TUNING")
    println("=" ^ 60)
    println("Default threshold 0.5. Lower = more recall, higher = more precision.\n")
    @printf("%10s %10s %10s %10s %10s\n",
            "Threshold", "Accuracy", "Precision", "Recall", "F1")
    println("-" ^ 54)
    for t in (0.3, 0.4, 0.5, 0.6, 0.7)
        y_pred_t = [predict_proba(model, x) >= t ? 1 : 0 for x in X_test]
        m = build_metrics(ys_test, y_pred_t)
        @printf("%10.1f %10.4f %10.4f %10.4f %10.4f\n",
                t, metric_accuracy(m), metric_precision(m),
                metric_recall(m), metric_f1(m))
    end
end


function demo_softmax_regression()
    println("\n" * "=" ^ 60)
    println("SOFTMAX (MULTI-CLASS) REGRESSION")
    println("=" ^ 60)
    X, ys = generate_three_class_data()
    split = Int(round(0.8 * length(X)))
    X_train = X[1:split]
    X_test = X[(split + 1):end]
    ys_train = ys[1:split]
    ys_test = ys[(split + 1):end]

    model = SoftmaxRegression(2, 3, 0.1)
    fit_softmax!(model, X_train, ys_train; epochs=1000, print_every=200)

    train_correct = sum(predict_class_softmax(model, X_train[i]) == ys_train[i]
                       for i in 1:length(ys_train))
    test_correct = sum(predict_class_softmax(model, X_test[i]) == ys_test[i]
                      for i in 1:length(ys_test))
    @printf("\nTrain accuracy: %.4f\n", train_correct / length(ys_train))
    @printf("Test  accuracy: %.4f\n", test_correct / length(ys_test))

    println("\nSample predictions:")
    for i in 1:5
        probs = predict_proba_softmax(model, X_test[i])
        pred = predict_class_softmax(model, X_test[i])
        @printf("  true=%d pred=%d probs=[%.3f, %.3f, %.3f]\n",
                ys_test[i], pred, probs[1], probs[2], probs[3])
    end
end


function demo_why_not_linear()
    println("\n" * "=" ^ 60)
    println("WHY LINEAR REGRESSION FAILS FOR CLASSIFICATION")
    println("=" ^ 60)
    hours = Float64[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    pass = Float64[0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
    n = length(hours)
    x_mean = mean(hours)
    y_mean = mean(pass)
    num = sum((hours .- x_mean) .* (pass .- y_mean))
    den = sum((hours .- x_mean) .^ 2)
    w_lin = num / den
    b_lin = y_mean - w_lin * x_mean
    @printf("\nLinear fit: y = %.4f*x + %.4f\n", w_lin, b_lin)
    @printf("%6s %8s %8s %8s\n", "Hours", "Actual", "Linear", "Sigmoid")
    for i in 1:n
        lin_pred = w_lin * hours[i] + b_lin
        sig_pred = sigmoid(3 * (hours[i] - 4.5))
        @printf("%6.0f %8.0f %8.3f %8.3f\n", hours[i], pass[i], lin_pred, sig_pred)
    end
    println("\nLinear regression can output values outside [0, 1].")
    println("Sigmoid keeps probabilities inside the valid range.")
end


function main()
    model, X_test, ys_test = demo_binary_logistic()
    demo_decision_boundary(model)
    demo_threshold_tuning(model, X_test, ys_test)
    demo_softmax_regression()
    demo_why_not_linear()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
