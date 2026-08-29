from flask import Flask, jsonify
import platform
import torch

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        architecture=platform.machine(),
        pytorch=torch.__version__,
        cuda_available=torch.cuda.is_available(),
        device="cpu",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
