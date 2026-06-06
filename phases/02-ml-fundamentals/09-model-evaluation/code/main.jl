# Model evaluation in Julia. Train/val/test split, k-fold + stratified k-fold
# cross validation, classification metrics (accuracy, precision, recall, F1,
# ROC, AUC), and regression metrics (MSE, RMSE, MAE, R^2). Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/stdlib/Random/
#   https://docs.julialang.org/en/v1/stdlib/Statistics/
#   https://docs.julialang.org/en/v1/manual/functions/

using Random
using Statistics
using Printf


function train_val_test_split(X::Vector{Vector{Float64}}, ys::Vector{Int};
                             train_ratio::Float64=0.6, val_ratio::Float64=0.2,
                             seed::Int=42)
    rng = MersenneTwister(seed)
    n = length(X)
    indices = randperm(rng, n)
    train_end = Int(round(n * train_ratio))
    val_end = Int(round(n * (train_ratio + val_ratio)))
    train_idx = indices[1:train_end]
    val_idx = indices[(train_end + 1):val_end]
    test_idx = indices[(val_end + 1):end]
    return (X[train_idx], ys[train_idx],
            X[val_idx], ys[val_idx],
            X[test_idx], ys[test_idx])
end


function kfold_split(n::Int; k::Int=5, seed::Int=42)
    rng = MersenneTwister(seed)
    indices = randperm(rng, n)
    fold_size = n ÷ k
    folds = Vector{Tuple{Vector{Int}, Vector{Int}}}()
    for i in 1:k
        s = (i - 1) * fold_size + 1
        e = i < k ? i * fold_size : n
        val_idx = indices[s:e]
        train_idx = vcat(indices[1:(s - 1)], indices[(e + 1):end])
        push!(folds, (train_idx, val_idx))
    end
    return folds
end


function stratified_kfold_split(ys::Vector{Int}; k::Int=5, seed::Int=42)
    rng = MersenneTwister(seed)
    class_indices = Dict{Int, Vector{Int}}()
    for (i, label) in enumerate(ys)
        push!(get!(class_indices, label, Int[]), i)
    end
    for label in keys(class_indices)
        shuffle!(rng, class_indices[label])
    end
    train_lists = [Int[] for _ in 1:k]
    val_lists = [Int[] for _ in 1:k]
    for indices in values(class_indices)
        fold_size = length(indices) ÷ k
        for i in 1:k
            s = (i - 1) * fold_size + 1
            e = i < k ? i * fold_size : length(indices)
            val_part = indices[s:e]
            train_part = vcat(indices[1:(s - 1)], indices[(e + 1):end])
            append!(val_lists[i], val_part)
            append!(train_lists[i], train_part)
        end
    end
    return [(train_lists[i], val_lists[i]) for i in 1:k]
end


function confusion_matrix(y_true::Vector{Int}, y_pred::Vector{Int})
    tp = sum(1 for i in 1:length(y_true) if y_true[i] == 1 && y_pred[i] == 1)
    tn = sum(1 for i in 1:length(y_true) if y_true[i] == 0 && y_pred[i] == 0)
    fp = sum(1 for i in 1:length(y_true) if y_true[i] == 0 && y_pred[i] == 1)
    fn = sum(1 for i in 1:length(y_true) if y_true[i] == 1 && y_pred[i] == 0)
    return tp, tn, fp, fn
end


function accuracy(y_true::Vector{Int}, y_pred::Vector{Int})
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    total = tp + tn + fp + fn
    return total > 0 ? (tp + tn) / total : 0.0
end


function precision_score(y_true::Vector{Int}, y_pred::Vector{Int})
    tp, _, fp, _ = confusion_matrix(y_true, y_pred)
    return (tp + fp) > 0 ? tp / (tp + fp) : 0.0
end


function recall_score(y_true::Vector{Int}, y_pred::Vector{Int})
    tp, _, _, fn = confusion_matrix(y_true, y_pred)
    return (tp + fn) > 0 ? tp / (tp + fn) : 0.0
end


function f1_score(y_true::Vector{Int}, y_pred::Vector{Int})
    p = precision_score(y_true, y_pred)
    r = recall_score(y_true, y_pred)
    return (p + r) > 0 ? 2 * p * r / (p + r) : 0.0
end


function roc_curve(y_true::Vector{Int}, y_scores::Vector{Float64})
    thresholds = sort(unique(y_scores); rev=true)
    tpr_list = Float64[]
    fpr_list = Float64[]
    total_pos = sum(y_true)
    total_neg = length(y_true) - total_pos
    for t in thresholds
        y_pred = [s >= t ? 1 : 0 for s in y_scores]
        tp = sum(1 for i in 1:length(y_true) if y_true[i] == 1 && y_pred[i] == 1)
        fp = sum(1 for i in 1:length(y_true) if y_true[i] == 0 && y_pred[i] == 1)
        push!(tpr_list, total_pos > 0 ? tp / total_pos : 0.0)
        push!(fpr_list, total_neg > 0 ? fp / total_neg : 0.0)
    end
    return fpr_list, tpr_list, thresholds
end


function auc_roc(y_true::Vector{Int}, y_scores::Vector{Float64})
    fpr, tpr, _ = roc_curve(y_true, y_scores)
    pairs = sort(collect(zip(fpr, tpr)); by=first)
    fpr_sorted = [p[1] for p in pairs]
    tpr_sorted = [p[2] for p in pairs]
    area = 0.0
    for i in 2:length(fpr_sorted)
        width = fpr_sorted[i] - fpr_sorted[i - 1]
        height = (tpr_sorted[i] + tpr_sorted[i - 1]) / 2
        area += width * height
    end
    return area
end


function mse(y_true::Vector{Float64}, y_pred::Vector{Float64})
    n = length(y_true)
    return sum((y_true .- y_pred) .^ 2) / n
end


function rmse(y_true::Vector{Float64}, y_pred::Vector{Float64})
    return sqrt(mse(y_true, y_pred))
end


function mae(y_true::Vector{Float64}, y_pred::Vector{Float64})
    n = length(y_true)
    return sum(abs.(y_true .- y_pred)) / n
end


function r_squared(y_true::Vector{Float64}, y_pred::Vector{Float64})
    mean_y = mean(y_true)
    ss_res = sum((y_true .- y_pred) .^ 2)
    ss_tot = sum((y_true .- mean_y) .^ 2)
    return ss_tot == 0 ? 0.0 : 1.0 - ss_res / ss_tot
end


function sigmoid(z::Float64)
    z_clip = clamp(z, -500.0, 500.0)
    return 1.0 / (1.0 + exp(-z_clip))
end


mutable struct SimpleLogistic
    weights::Vector{Float64}
    bias::Float64
    lr::Float64
    epochs::Int
end


SimpleLogistic(lr::Float64, epochs::Int) = SimpleLogistic(Float64[], 0.0, lr, epochs)


function fit_simple!(model::SimpleLogistic, X::Vector{Vector{Float64}}, ys::Vector{Int})
    n_features = length(X[1])
    model.weights = zeros(n_features)
    model.bias = 0.0
    for _ in 1:model.epochs
        for i in 1:length(X)
            z = sum(model.weights .* X[i]) + model.bias
            p = sigmoid(z)
            err = ys[i] - p
            for j in 1:n_features
                model.weights[j] += model.lr * err * X[i][j]
            end
            model.bias += model.lr * err
        end
    end
    return model
end


function predict_proba_simple(model::SimpleLogistic, x::Vector{Float64})
    return sigmoid(sum(model.weights .* x) + model.bias)
end


predict_simple(model::SimpleLogistic, x::Vector{Float64}) =
    predict_proba_simple(model, x) >= 0.5 ? 1 : 0


function cross_validate(X::Vector{Vector{Float64}}, ys::Vector{Int},
                       model_fn::Function; k::Int=5,
                       metric_fn::Function=accuracy, stratified::Bool=false)
    n = length(X)
    folds = stratified ? stratified_kfold_split(ys; k=k) : kfold_split(n; k=k)
    scores = Float64[]
    for (train_idx, val_idx) in folds
        X_train = X[train_idx]
        ys_train = ys[train_idx]
        X_val = X[val_idx]
        ys_val = ys[val_idx]
        model = model_fn()
        fit_simple!(model, X_train, ys_train)
        preds = [predict_simple(model, x) for x in X_val]
        push!(scores, metric_fn(ys_val, preds))
    end
    return scores
end


function make_classification_data(n::Int=300; seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Int[]
    for _ in 1:n
        x1 = randn(rng)
        x2 = randn(rng)
        label = (x1 + x2 + 0.5 * randn(rng)) > 0 ? 1 : 0
        push!(X, Float64[x1, x2])
        push!(ys, label)
    end
    return X, ys
end


function make_regression_data(n::Int=200; seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Float64[]
    for _ in 1:n
        x1 = 10.0 * rand(rng)
        x2 = 5.0 * rand(rng)
        target = 3 * x1 + 2 * x2 + 2 * randn(rng)
        push!(X, Float64[x1, x2])
        push!(ys, target)
    end
    return X, ys
end


function make_imbalanced_data(n::Int=300; minority_ratio::Float64=0.05, seed::Int=42)
    rng = MersenneTwister(seed)
    X = Vector{Vector{Float64}}()
    ys = Int[]
    for _ in 1:n
        if rand(rng) < minority_ratio
            push!(X, Float64[3.0 + 0.5 * randn(rng), 3.0 + 0.5 * randn(rng)])
            push!(ys, 1)
        else
            push!(X, Float64[randn(rng), randn(rng)])
            push!(ys, 0)
        end
    end
    return X, ys
end


function demo_split_and_metrics()
    println("=" ^ 60)
    println("TRAIN / VAL / TEST SPLIT + METRICS")
    println("=" ^ 60)
    X, ys = make_classification_data(300)
    X_train, ys_train, X_val, ys_val, X_test, ys_test = train_val_test_split(X, ys)
    @printf("  Train: %d  Val: %d  Test: %d\n",
            length(X_train), length(X_val), length(X_test))
    @printf("  Train positive ratio: %.3f\n", sum(ys_train) / length(ys_train))
    @printf("  Val   positive ratio: %.3f\n", sum(ys_val) / length(ys_val))

    model = SimpleLogistic(0.1, 200)
    fit_simple!(model, X_train, ys_train)

    println("\n--- Classification metrics ---")
    y_pred = [predict_simple(model, x) for x in X_test]
    tp, tn, fp, fn = confusion_matrix(ys_test, y_pred)
    @printf("  Confusion: TP=%d  TN=%d  FP=%d  FN=%d\n", tp, tn, fp, fn)
    @printf("  Accuracy:  %.4f\n", accuracy(ys_test, y_pred))
    @printf("  Precision: %.4f\n", precision_score(ys_test, y_pred))
    @printf("  Recall:    %.4f\n", recall_score(ys_test, y_pred))
    @printf("  F1:        %.4f\n", f1_score(ys_test, y_pred))

    y_scores = [predict_proba_simple(model, x) for x in X_test]
    @printf("  AUC-ROC:   %.4f\n", auc_roc(ys_test, y_scores))
end


function demo_cross_validation()
    println("\n" * "=" ^ 60)
    println("K-FOLD CROSS VALIDATION")
    println("=" ^ 60)
    X, ys = make_classification_data(300)
    scores = cross_validate(X, ys, () -> SimpleLogistic(0.1, 200);
                            k=5, metric_fn=accuracy)
    m = mean(scores)
    s = std(scores; corrected=false)
    println("\nPlain k=5:")
    @printf("  Fold scores: [%s]\n",
            join([@sprintf("%.4f", v) for v in scores], ", "))
    @printf("  Mean: %.4f  (+/- %.4f)\n", m, s)

    strat = cross_validate(X, ys, () -> SimpleLogistic(0.1, 200);
                           k=5, metric_fn=accuracy, stratified=true)
    sm = mean(strat)
    ss = std(strat; corrected=false)
    println("\nStratified k=5:")
    @printf("  Fold scores: [%s]\n",
            join([@sprintf("%.4f", v) for v in strat], ", "))
    @printf("  Mean: %.4f  (+/- %.4f)\n", sm, ss)
end


function demo_imbalanced()
    println("\n" * "=" ^ 60)
    println("IMBALANCED DATA: WHY ACCURACY LIES")
    println("=" ^ 60)
    X, ys = make_imbalanced_data(300; minority_ratio=0.05)
    positives = sum(ys)
    @printf("\n  Class distribution: %d positive, %d negative (%.1f%% positive)\n",
            positives, length(ys) - positives, 100 * positives / length(ys))
    baseline = zeros(Int, length(ys))
    println("\n  Always-negative baseline:")
    @printf("    Accuracy:  %.4f\n", accuracy(ys, baseline))
    @printf("    Precision: %.4f\n", precision_score(ys, baseline))
    @printf("    Recall:    %.4f\n", recall_score(ys, baseline))
    @printf("    F1:        %.4f\n", f1_score(ys, baseline))
    println("  Accuracy lies; precision and recall expose the failure.")
end


function demo_regression_metrics()
    println("\n" * "=" ^ 60)
    println("REGRESSION METRICS")
    println("=" ^ 60)
    X, ys = make_regression_data(200)
    n_train = Int(round(0.8 * length(X)))
    y_pred = Float64[]
    y_true = ys[(n_train + 1):end]
    for i in (n_train + 1):length(ys)
        push!(y_pred, ys[i] + randn() * 0.5)
    end
    @printf("  MSE:  %.4f\n", mse(y_true, y_pred))
    @printf("  RMSE: %.4f\n", rmse(y_true, y_pred))
    @printf("  MAE:  %.4f\n", mae(y_true, y_pred))
    @printf("  R^2:  %.4f\n", r_squared(y_true, y_pred))

    mean_baseline = fill(mean(y_true), length(y_true))
    println("\n  Predict-the-mean baseline:")
    @printf("    MSE:  %.4f\n", mse(y_true, mean_baseline))
    @printf("    R^2:  %.4f\n", r_squared(y_true, mean_baseline))
end


function main()
    demo_split_and_metrics()
    demo_cross_validation()
    demo_imbalanced()
    demo_regression_metrics()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
