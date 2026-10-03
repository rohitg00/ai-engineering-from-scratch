include(joinpath(@__DIR__, "..", "main.jl"))
function expect_metrics(y_true, y_pred, expected)
    metrics = build_metrics(y_true, y_pred)
    observed = (metrics.tp, metrics.tn, metrics.fp, metrics.fn)
    @assert observed == expected
    return metrics
end
expect_metrics(Int[0, 1], Int[0, 0], (0, 1, 0, 1))
expect_metrics(Int[0, 1], Int[1, 1], (1, 0, 1, 0))
expect_metrics(Int[0, 0], Int[0, 1], (0, 1, 1, 0))
expect_metrics(Int[1, 1], Int[1, 0], (1, 0, 0, 1))
empty_metrics = expect_metrics(Int[], Int[], (0, 0, 0, 0))
@assert metric_accuracy(empty_metrics) == 0.0
@assert metric_precision(empty_metrics) == 0.0
@assert metric_recall(empty_metrics) == 0.0
@assert metric_f1(empty_metrics) == 0.0
