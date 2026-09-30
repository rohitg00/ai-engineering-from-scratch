"""Choose a modeled policy; optionally verify one local Docker container boundary."""

import argparse, json, subprocess, tempfile
from pathlib import Path


def docker_args(image):
    if not image or image.startswith("-"):
        raise ValueError("explicit local image required")
    return [
        "docker",
        "run",
        "--rm",
        "--pull=never",
        "--network",
        "none",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "32",
        "--memory",
        "64m",
        "--cpus",
        "0.5",
        "--user",
        "65534:65534",
        image,
        "sh",
        "-c",
        'if touch /probe 2>/dev/null; then echo root_write=allowed; exit 2; else echo root_write=denied; fi; cat /proc/net/route; test -z "$(tail -n +2 /proc/net/route)" && echo default_route=absent',
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("requirements")
    parser.add_argument("--budget", type=int, default=3)
    parser.add_argument("--docker-image")
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="sandbox-plan-") as folder:
        binary = Path(folder) / "planner"
        subprocess.run(
            [
                "rustc",
                "--edition=2021",
                str(Path(__file__).with_name("cli.rs")),
                "-o",
                str(binary),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        run = subprocess.run(
            [str(binary), args.requirements, str(args.budget)],
            capture_output=True,
            text=True,
        )
        if run.returncode:
            raise ValueError(run.stderr.strip())
        result = {
            "schema_version": 1,
            "policy": run.stdout,
            "mode": "policy_simulation",
            "runtime_verified": False,
        }
        if args.docker_image:
            if "host_kernel=true" in args.requirements:
                raise ValueError(
                    "Docker probe cannot establish independent guest kernel"
                )
            result["command"] = docker_args(args.docker_image)
            if args.execute:
                subprocess.run(
                    ["docker", "image", "inspect", args.docker_image],
                    check=True,
                    capture_output=True,
                    timeout=10,
                )
                tested = subprocess.run(
                    result["command"], capture_output=True, text=True, timeout=20
                )
                result.update(
                    mode="docker_probe",
                    runtime_verified=tested.returncode == 0,
                    returncode=tested.returncode,
                    observed=tested.stdout,
                    errors=tested.stderr,
                    residual="shared kernel; these two probes are not escape-resistance proof",
                )
        elif args.execute:
            parser.error("--execute requires --docker-image")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
