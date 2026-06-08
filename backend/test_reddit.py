import requests
from loguru import logger
import sys

logger.remove()
logger.add(sys.stderr, level="INFO")

def test_fetch(url: str):
    clean_url = url.split('?')[0].rstrip('/')
    json_url = f"{clean_url}.json?sort=top"
    logger.info(f"Fetching: {json_url}")
    
    # Try browser headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }
    
    try:
        response = requests.get(json_url, headers=headers, timeout=10)
        logger.info(f"Status Code: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and len(data) > 1:
            comments = data[1].get("data", {}).get("children", [])
            logger.info(f"Successfully retrieved {len(comments)} comments.")
        else:
            logger.warning("Unexpected structure.")
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    test_fetch("https://www.reddit.com/r/IndianGaming/comments/18j1tfs/what_is_the_best_gaming_laptop_under_80k_right_now/")
