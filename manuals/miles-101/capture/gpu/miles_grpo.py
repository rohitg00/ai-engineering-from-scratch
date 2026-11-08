import os
import sys

MILES_HOME = os.environ.get("MILES_HOME", "/root/miles")
if os.path.isdir(MILES_HOME):
    sys.path.insert(0, MILES_HOME)

from miles.utils.external_utils import command_utils

LAB = os.environ.get("MILES_LAB", "/root/lab")
MODEL_NAME = os.environ.get("MILES_MODEL", "Qwen3-0.6B")
TRUE_ON_POLICY = os.environ.get("MILES_TRUE_ON_POLICY", "0") == "1"
NUM_ROLLOUT = int(os.environ.get("MILES_NUM_ROLLOUT", "12"))
RUN = os.environ.get("MILES_RUN", "true-on-policy" if TRUE_ON_POLICY else "plain")
SGLANG_ATTENTION = os.environ.get("MILES_SGLANG_ATTENTION", "fa3")
FSDP_ATTENTION = os.environ.get("MILES_FSDP_ATTENTION", "flash_attention_3")
SEED = os.environ.get("MILES_SEED")


def prepare():
    U = command_utils.default_config().create_backend()
    U.exec_command_cpu(f"mkdir -p {LAB}/models {LAB}/datasets")
    if not os.path.exists(f"{LAB}/models/{MODEL_NAME}/config.json"):
        U.exec_command_cpu(f"hf download Qwen/{MODEL_NAME} --local-dir {LAB}/models/{MODEL_NAME}")
    if not os.path.exists(f"{LAB}/datasets/gsm8k/train.parquet"):
        U.exec_command_cpu(f"hf download --repo-type dataset zhuzilin/gsm8k --local-dir {LAB}/datasets/gsm8k")


def execute():
    U = command_utils.default_config().create_backend()
    args = (
        f"--hf-checkpoint {LAB}/models/{MODEL_NAME} "
        f"--prompt-data {LAB}/datasets/gsm8k/train.parquet "
        "--input-key messages --label-key label --apply-chat-template --rollout-shuffle --rm-type math "
        f"--num-rollout {NUM_ROLLOUT} --rollout-batch-size 32 --n-samples-per-prompt 8 "
        "--rollout-max-response-len 1024 --rollout-temperature 1 --global-batch-size 256 "
        "--advantage-estimator grpo --kl-loss-coef 0.00 --kl-loss-type low_var_kl --kl-coef 0.00 "
        "--entropy-coef 0.00 --eps-clip 0.2 --eps-clip-high 0.28 "
        "--optimizer adam --lr 1e-6 --lr-decay-style constant --weight-decay 0.1 --adam-beta1 0.9 --adam-beta2 0.98 "
        "--rollout-num-gpus-per-engine 1 --sglang-decode-log-interval 1000 --sglang-enable-metrics "
        "--sglang-mem-fraction-static 0.4 --update-weight-buffer-size 536870912 "
        "--actor-num-nodes 1 --actor-num-gpus-per-node 1 --colocate --train-backend fsdp "
        f"--save-debug-event-data {LAB}/runs/{RUN}/events "
    )
    if SEED:
        args += f"--seed {SEED} --rollout-seed {SEED} "
    args += os.environ.get("MILES_EXTRA_ARGS", "") + " "
    env = {}
    if TRUE_ON_POLICY:
        args += (
            "--sglang-enable-deterministic-inference --sglang-rl-on-policy-target fsdp "
            f"--sglang-attention-backend {SGLANG_ATTENTION} --attn-implementation {FSDP_ATTENTION} "
            "--deterministic-mode --true-on-policy-mode "
        )
        env.update({"NCCL_ALGO": "allreduce:tree", "NVTE_ALLOW_NONDETERMINISTIC_ALGO": "0", "CUBLAS_WORKSPACE_CONFIG": ":4096:8"})
    U.execute_train(train_args=args, num_gpus_per_node=1, megatron_model_type=None, extra_env_vars=env)


if __name__ == "__main__":
    prepare()
    execute()
