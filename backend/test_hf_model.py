import os
import requests
from app.config import get_settings

settings = get_settings()
token = settings.huggingface_api_key

headers = {"Authorization": f"Bearer {token}"}
url = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct"

response = requests.get(url, headers=headers)
print("meta-llama/Llama-3.1-8B-Instruct:", response.status_code, response.json())

url2 = "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct"
response2 = requests.get(url2, headers=headers)
print("meta-llama/Meta-Llama-3.1-8B-Instruct:", response2.status_code, response2.json())
