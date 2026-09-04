using LinearAlgebra


function rotation_2d(theta)
    c, s = cos(theta), sin(theta)
    return [c -s; s c]
end


function rotation_3d_z(theta)
    c, s = cos(theta), sin(theta)
    return [c -s 0; s c 0; 0 0 1]
end


function rotation_3d_x(theta)
    c, s = cos(theta), sin(theta)
    return [1 0 0; 0 c -s; 0 s c]
end


function rotation_3d_y(theta)
    c, s = cos(theta), sin(theta)
    return [c 0 s; 0 1 0; -s 0 c]
end


function scaling_2d(sx, sy)
    return [sx 0; 0 sy]
end


function shearing_2d(kx, ky)
    return [1 kx; ky 1]
end


function demo_basic_transformations()
    println("=" ^ 60)
    println("BASIC TRANSFORMATIONS")
    println("=" ^ 60)

    point = [1.0, 0.0]
    theta = pi / 4

    rotated = rotation_2d(theta) * point
    println("\nRotate (1,0) by 45 deg: $(round.(rotated, digits=4))")

    scaled = scaling_2d(2, 3) * [1.0, 1.0]
    println("Scale (1,1) by (2,3): $(round.(scaled, digits=4))")

    sheared = shearing_2d(1, 0) * [1.0, 1.0]
    println("Shear (1,1) kx=1: $(round.(sheared, digits=4))")

    reflected = [-1 0; 0 1] * [2.0, 1.0]
    println("Reflect (2,1) across y-axis: $(round.(reflected, digits=4))")
end


function demo_unit_square()
    println("\n" * "=" ^ 60)
    println("TRANSFORMATIONS ON A UNIT SQUARE")
    println("=" ^ 60)

    square = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
    labels = ["origin", "right", "top-right", "top"]

    println("\nOriginal square:")
    for (label, pt) in zip(labels, square)
        println("  $label: $pt")
    end

    transforms = [
        ("Rotate 45 deg", rotation_2d(pi / 4)),
        ("Scale (2, 0.5)", scaling_2d(2, 0.5)),
        ("Shear kx=0.5", shearing_2d(0.5, 0)),
        ("Reflect y-axis", [-1 0; 0 1]),
    ]

    for (name, M) in transforms
        println("\n$name:")
        for (label, pt) in zip(labels, square)
            result = M * pt
            println("  $label: $pt -> $(round.(result, digits=4))")
        end
        println("  det = $(round(det(M), digits=4))")
    end
end


function demo_composition()
    println("\n" * "=" ^ 60)
    println("COMPOSITION OF TRANSFORMATIONS")
    println("=" ^ 60)

    R = rotation_2d(pi / 2)
    S = scaling_2d(2, 0.5)

    point = [1.0, 0.0]

    result1 = (S * R) * point
    result2 = (R * S) * point

    println("\nPoint: $point")
    println("Rotate 90 then scale (2, 0.5): $(round.(result1, digits=4))")
    println("Scale (2, 0.5) then rotate 90: $(round.(result2, digits=4))")
    println("Order matters.")

    println("\ndet(R) = $(round(det(R), digits=4))")
    println("det(S) = $(round(det(S), digits=4))")
    println("det(S * R) = $(round(det(S * R), digits=4))")
    println("det(S) * det(R) = $(round(det(S) * det(R), digits=4))")
end


function demo_3d_rotations()
    println("\n" * "=" ^ 60)
    println("3D ROTATIONS")
    println("=" ^ 60)

    point = [1.0, 0.0, 0.0]
    theta = pi / 2

    rz = rotation_3d_z(theta) * point
    rx = rotation_3d_x(theta) * point
    ry = rotation_3d_y(theta) * point

    println("\nPoint: $point")
    println("Rotate 90 around z: $(round.(rz, digits=4))")
    println("Rotate 90 around x: $(round.(rx, digits=4))")
    println("Rotate 90 around y: $(round.(ry, digits=4))")

    println("\ndet(Rz) = $(round(det(rotation_3d_z(theta)), digits=4))")
    println("det(Rx) = $(round(det(rotation_3d_x(theta)), digits=4))")
    println("det(Ry) = $(round(det(rotation_3d_y(theta)), digits=4))")
    println("All rotation determinants = 1.")
end


function demo_eigenvalues()
    println("\n" * "=" ^ 60)
    println("EIGENVALUES AND EIGENVECTORS")
    println("=" ^ 60)

    matrices = [
        ("Symmetric", [2 1; 1 2]),
        ("Upper triangular", [3 1; 0 2]),
        ("Scaling", [3 0; 0 5]),
        ("Rotation 90", [0 -1; 1 0]),
    ]

    for (name, A) in matrices
        vals = eigvals(A)
        vecs = eigvecs(A)
        println("\n$name: $A")
        println("  Eigenvalues: $vals")

        if all(isreal, vals)
            for i in 1:length(vals)
                v = real.(vecs[:, i])
                lam = real(vals[i])
                println("  lambda=$(round(lam, digits=4)), v=$(round.(v, digits=4))")
                println("    A * v = $(round.(A * v, digits=4))")
                println("    l * v = $(round.(lam * v, digits=4))")
            end
        else
            println("  Complex eigenvalues: pure rotation, no real eigenvectors.")
        end
    end
end


function demo_eigendecomposition()
    println("\n" * "=" ^ 60)
    println("EIGENDECOMPOSITION")
    println("=" ^ 60)

    A = Float64[3 1; 0 2]
    F = eigen(A)

    println("\nA = $A")
    println("Eigenvalues: $(F.values)")
    println("Eigenvectors (columns):")
    display(F.vectors)
    println()

    V = F.vectors
    D = Diagonal(F.values)
    reconstructed = V * D * inv(V)
    println("Reconstructed A = V * D * V^-1:")
    display(round.(reconstructed, digits=4))
    println()
end


function demo_determinant_meaning()
    println("\n" * "=" ^ 60)
    println("DETERMINANT AS VOLUME SCALING FACTOR")
    println("=" ^ 60)

    cases = [
        ("Rotation 45 deg", rotation_2d(pi / 4)),
        ("Scale (2, 3)", scaling_2d(2, 3)),
        ("Shear kx=1", shearing_2d(1, 0)),
        ("Reflect y-axis", [-1 0; 0 1]),
        ("Singular", [1 2; 2 4]),
    ]

    println()
    for (name, M) in cases
        d = det(M)
        if abs(d) < 1e-10
            meaning = "space collapses, irreversible"
        elseif d < 0
            meaning = "orientation flipped"
        elseif abs(d - 1.0) < 1e-10
            meaning = "area preserved"
        else
            meaning = "area scaled by $(round(abs(d), digits=1))x"
        end
        println("det($name) = $(round(d, digits=4))  ($meaning)")
    end
end


function demo_pca_preview()
    println("\n" * "=" ^ 60)
    println("PCA PREVIEW: EIGENVECTORS OF COVARIANCE MATRIX")
    println("=" ^ 60)

    cov = [2.0 1.0; 1.0 3.0]
    F = eigen(cov)

    println("\nCovariance matrix: $cov")
    println("Eigenvalues (variance along each PC): $(F.values)")
    println("Eigenvectors (principal components):")
    display(F.vectors)
    println()
    println("PCA picks eigenvectors with the largest eigenvalues.")
    println("Here, PC1 captures $(round(F.values[2] / sum(F.values) * 100, digits=1))% of variance.")
end


demo_basic_transformations()
demo_unit_square()
demo_composition()
demo_3d_rotations()
demo_eigenvalues()
demo_eigendecomposition()
demo_determinant_meaning()
demo_pca_preview()
