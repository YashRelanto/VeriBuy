from ollama import chat

question = input("You: ")

response = chat(
    messages=[
        {"role": "user", "content": question}
    ],
    model="qwen3.5:4b",
    stream=False
)

print("Model: ", response)