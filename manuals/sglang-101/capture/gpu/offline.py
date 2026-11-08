import os

from huggingface_hub import hf_hub_download, snapshot_download

SHAREGPT_REPO = "anon8231489123/ShareGPT_Vicuna_unfiltered"
SHAREGPT_FILE = "ShareGPT_V3_unfiltered_cleaned_split.json"
MODEL_FILES = ["*.json", "*.safetensors", "*.txt", "*.model", "*.tiktoken", "*.py"]


def prefetch(models):
    for model in models:
        snapshot_download(model, allow_patterns=MODEL_FILES)
    dataset = os.environ.get("SGLANG_KIT_DATASET") or hf_hub_download(SHAREGPT_REPO, SHAREGPT_FILE, repo_type="dataset")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    return dataset


def with_dataset(args, dataset):
    if "random" in args and "--dataset-path" not in args:
        return [*args, "--dataset-path", dataset]
    return list(args)
