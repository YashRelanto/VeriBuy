"""LLM Service — LangChain + ChatOllama integration."""

import json
import httpx
from loguru import logger
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from app.config import get_settings
from app.guardrails import GUARDRAILS_SYSTEM_PROMPT


def get_llm(temperature: float = 0.2) -> ChatHuggingFace:
    """Create a ChatHuggingFace instance using LLaMA 3.1 8B Instruct."""
    settings = get_settings()
    
    if not settings.huggingface_api_key:
        logger.warning("HUGGINGFACE_API_KEY is not set. LLM calls will fail.")
        
    llm = HuggingFaceEndpoint(
        repo_id="meta-llama/Meta-Llama-3-8B-Instruct",
        task="text-generation",
        huggingfacehub_api_token=settings.huggingface_api_key,
        temperature=temperature,
        max_new_tokens=1024,
        return_full_text=False
    )
    return ChatHuggingFace(llm=llm)


def create_chain(system_prompt: str, temperature: float = 0.2):
    """Create a LangChain chain: prompt → LLM → string output.

    Usage:
        chain = create_chain("You are a helpful assistant. ...")
        raw_json_str = await chain.ainvoke({"input": "user message"})
        parsed = json.loads(raw_json_str)
        validated = MyPydanticModel(**parsed)
    """
    llm = get_llm(temperature)

    guarded_system_prompt = f"{GUARDRAILS_SYSTEM_PROMPT}\n\nTask instructions:\n{system_prompt}"

    prompt = ChatPromptTemplate.from_messages([
        ("system", guarded_system_prompt),
        ("human", "{input}")
    ])

    chain = prompt | llm | StrOutputParser()
    return chain


def parse_and_validate(raw_response: str, model_class: type[BaseModel]) -> BaseModel:
    """Parse JSON string from LLM and validate with a Pydantic model.

    Handles common issues like extra text around JSON,
    nested objects, and missing optional fields.
    """
    import re
    
    # Step 1: Extract JSON block from response
    text = raw_response.strip()
    
    # Remove markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    
    # Try to find the outermost JSON object
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group()
    
    # Step 2: Try direct parse
    try:
        parsed = json.loads(text)
        return model_class(**parsed)
    except (json.JSONDecodeError, Exception):
        pass
    
    # Step 3: Try to repair common LLM JSON mistakes
    try:
        repaired = text
        # Fix trailing commas before } or ]
        repaired = re.sub(r',\s*([}\]])', r'\1', repaired)
        # Fix missing commas between key-value pairs
        repaired = re.sub(r'"\s*\n\s*"', '",\n"', repaired)
        # Truncate at last valid closing brace if JSON is incomplete
        brace_count = 0
        last_valid = -1
        for i, c in enumerate(repaired):
            if c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
                if brace_count == 0:
                    last_valid = i
                    break
        if last_valid > 0:
            repaired = repaired[:last_valid + 1]
        
        parsed = json.loads(repaired)
        return model_class(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"JSON repair failed: {e}")
        raise ValueError(f"Could not parse JSON from LLM response: {raw_response[:300]}")


async def check_huggingface_health() -> bool:
    """Check if HuggingFace API key is configured."""
    settings = get_settings()
    return bool(settings.huggingface_api_key)
