import os
from transformers import AutoModel

# Ép HuggingFace lưu model vào thư mục /models của container (thực chất là lưu ra ngoài máy thật)
os.environ['HF_HOME'] = '/models'

# Chạy thử tải một model nhỏ
model = AutoModel.from_pretrained("gpt2")
