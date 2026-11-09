# Lesson: Swarm Optimization: PSO and ACO (phase 16 / lesson 19)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md
# Run: julia code/main.jl

using Printf
using Random

mutable struct Particle
    x::Vector{Float64}
    v::Vector{Float64}
    p_best::Vector{Float64}
    p_best_fit::Float64
end

function fitness(x::Vector{Float64})
    cx, cy = 0.72, 0.40
    dx, dy = x[1] - cx, x[2] - cy
    dist2 = dx * dx + dy * dy
    ripple = 0.08 * (cos(8 * pi * dx) + cos(8 * pi * dy))
    return max(0.0, 1.0 - 6.0 * dist2 - ripple)
end

uniform(rng, a, b) = a + (b - a) * rand(rng)

function run_lmpso(; n_particles::Int=20, iterations::Int=30, seed::Int=0)
    rng = Xoshiro(seed)
    w, c1, c2 = 0.6, 1.2, 1.2
    bounds = ((0.0, 1.0), (0.0, 1.0))

    particles = Particle[]
    for _ in 1:n_particles
        x = [uniform(rng, bounds[1]...), uniform(rng, bounds[2]...)]
        v = [uniform(rng, -0.1, 0.1), uniform(rng, -0.1, 0.1)]
        f = fitness(x)
        push!(particles, Particle(copy(x), v, copy(x), f))
    end

    g_best = particles[argmax([p.p_best_fit for p in particles])]
    g_best_x = copy(g_best.p_best)
    g_best_fit = g_best.p_best_fit

    history = [g_best_fit]

    for _ in 1:iterations
        for p in particles
            r1, r2 = rand(rng), rand(rng)
            for d in 1:2
                cognitive = c1 * r1 * (p.p_best[d] - p.x[d])
                social = c2 * r2 * (g_best_x[d] - p.x[d])
                p.v[d] = w * p.v[d] + cognitive + social
                p.x[d] += p.v[d]
                p.x[d] = clamp(p.x[d], bounds[d][1], bounds[d][2])
            end
            f = fitness(p.x)
            if f > p.p_best_fit
                p.p_best = copy(p.x)
                p.p_best_fit = f
                if f > g_best_fit
                    g_best_x = copy(p.x)
                    g_best_fit = f
                end
            end
        end
        push!(history, g_best_fit)
    end

    return history
end

struct PheromoneRouter
    task_types::Vector{String}
    agents::Vector{String}
    decay::Float64
    reinforce::Float64
    quality_threshold::Float64
    pheromones::Dict{String,Dict{String,Float64}}
end

function PheromoneRouter(task_types, agents; decay=0.05, reinforce=0.2, quality_threshold=0.6)
    pher = Dict(t => Dict(a => 1.0 for a in agents) for t in task_types)
    return PheromoneRouter(task_types, agents, decay, reinforce, quality_threshold, pher)
end

function choose(router::PheromoneRouter, task_type::String, rng)
    table = router.pheromones[task_type]
    total = sum(table[a] for a in router.agents)
    r = rand(rng) * total
    upto = 0.0
    for a in router.agents
        upto += table[a]
        if r <= upto
            return a
        end
    end
    return router.agents[end]
end

function deposit!(router::PheromoneRouter, task_type::String, agent::String, quality::Float64)
    for a in router.agents
        router.pheromones[task_type][a] *= (1.0 - router.decay)
    end
    if quality >= router.quality_threshold
        router.pheromones[task_type][agent] += router.reinforce * quality
    end
end

const AGENTS = ["coder", "mathematician", "writer"]

const AGENT_TASK_AFFINITY = Dict(
    "coder" => Dict("code" => 0.9, "math" => 0.5, "writing" => 0.3, "planning" => 0.4),
    "mathematician" => Dict("code" => 0.4, "math" => 0.95, "writing" => 0.2, "planning" => 0.5),
    "writer" => Dict("code" => 0.2, "math" => 0.2, "writing" => 0.9, "planning" => 0.6),
)

function simulate_task(agent::String, task_type::String, rng)
    base = AGENT_TASK_AFFINITY[agent][task_type]
    return clamp(base + uniform(rng, -0.15, 0.15), 0.0, 1.0)
end

function run_amro_s(; n_tasks::Int=200, seed::Int=0)
    rng = Xoshiro(seed)
    task_types = ["code", "math", "writing", "planning"]
    agents = copy(AGENTS)

    router = PheromoneRouter(task_types, agents)
    random_router_quality = 0.0
    aco_quality = 0.0

    for i in 0:n_tasks-1
        tt = task_types[i%length(task_types)+1]

        rand_agent = rand(rng, agents)
        rq = simulate_task(rand_agent, tt, rng)
        random_router_quality += rq

        aco_agent = choose(router, tt, rng)
        aq = simulate_task(aco_agent, tt, rng)
        aco_quality += aq
        deposit!(router, tt, aco_agent, aq)
    end

    return random_router_quality / n_tasks, aco_quality / n_tasks, router
end

function print_pheromone_table(router::PheromoneRouter)
    println("  ", rpad("task_type", 12), " ", join([lpad(a, 14) for a in router.agents], " "))
    for tt in router.task_types
        row = [lpad(@sprintf("%.3f", router.pheromones[tt][a]), 14) for a in router.agents]
        println("  ", rpad(tt, 12), " ", join(row, " "))
    end
end

function main()
    println("="^72)
    println("LMPSO: 20 particles, 30 iterations, 2D parameter space")
    println("="^72)
    history = run_lmpso()
    for i in 0:5:length(history)-1
        bar = "#"^max(1, trunc(Int, history[i+1] * 40))
        @printf("  iter %3d  g_best=%.4f  %s\n", i, history[i+1], bar)
    end
    @printf("  final g_best=%.4f (optimum = 1.0000 at (0.72, 0.40))\n", history[end])

    println("\n", "="^72)
    println("AMRO-S: 200 tasks routed across 3 agents × 4 task-types")
    println("="^72)
    rand_quality, aco_quality, router = run_amro_s()
    @printf("  random routing avg quality: %.3f\n", rand_quality)
    @printf("  ACO routing    avg quality: %.3f\n", aco_quality)
    @printf("  improvement: %+.1f%%\n", (aco_quality - rand_quality) / rand_quality * 100)

    println("\n  final pheromone table (after 200 tasks):")
    print_pheromone_table(router)

    println("\nTakeaways:")
    println("  PSO converges to the fitness peak without gradients, using only fitness evals.")
    println("  ACO pheromone trails surface interpretable evidence for who routes where.")
    println("  quality-gated deposits (threshold=0.6) prevent fast-but-wrong agents from locking in.")
end

main()
