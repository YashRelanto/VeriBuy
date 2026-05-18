"""Search Service — DDGS + BeautifulSoup for product search and scraping."""

import asyncio
import re
import requests
from urllib.parse import parse_qs, urlparse
from bs4 import BeautifulSoup
from loguru import logger
from app.config import get_settings
from app.guardrails import is_suspicious_url, sanitize_untrusted_text


def extract_inr_price(text: str) -> float:
    """Extract the first plausible INR retail price from search text."""
    if not text:
        return 0

    patterns = [
        r"(?:₹|rs\.?|inr)\s*([0-9][0-9,\s]*(?:\.\d{1,2})?)",
        r"([0-9][0-9,\s]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            raw = re.sub(r"[,\s]", "", match.group(1))
            try:
                price = float(raw)
            except ValueError:
                continue
            if price >= 100:
                return price
    return 0


def _extract_platform(url: str) -> str:
    lower_url = (url or "").lower()
    if "amazon." in lower_url:
        return "Amazon"
    if "flipkart." in lower_url:
        return "Flipkart"
    if "croma." in lower_url:
        return "Croma"
    if "reliancedigital." in lower_url:
        return "Reliance Digital"
    return url


def _scrape_page_text(url: str, max_chars: int = 5000) -> str:
    """Scrape visible text from a webpage using BeautifulSoup."""
    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove unwanted tags
        for tag in soup(["script", "style", "noscript", "nav", "footer", "header"]):
            tag.decompose()

        text = " ".join(soup.stripped_strings)
        return text[:max_chars]
    except Exception as e:
        logger.warning(f"Scrape failed for {url}: {e}")
        return ""


async def search_products(
    query: str,
    min_price: float = 0,
    max_price: float = 999999,
    num_results: int = 15
) -> list[dict]:
    """Search for products using DuckDuckGo and scrape results with BeautifulSoup.

    Returns list of raw product data dicts from search results.
    """
    settings = get_settings()
    logger.info(f"Searching products via Serper API: {query}")
    
    if not settings.serper_api_key:
        logger.warning("SERPER_API_KEY is not set. Search will fail.")
        return []

    try:
        search_query = f"{query} price INR (site:amazon.in OR site:flipkart.com OR site:croma.com)"

        def fetch_serper(endpoint: str, payload: dict):
            url = f"https://google.serper.dev/{endpoint}"
            headers = {
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json"
            }
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        def fetch_all_serper():
            payload = {
                "q": search_query,
                "gl": "in",
                "num": num_results
            }
            shopping_payload = {
                "q": query,
                "gl": "in",
                "num": num_results
            }
            search_data = fetch_serper("search", payload)
            try:
                shopping_data = fetch_serper("shopping", shopping_payload)
            except Exception as e:
                logger.warning(f"Serper Shopping API unavailable: {e}")
                shopping_data = {}
            return search_data, shopping_data

        loop = asyncio.get_event_loop()
        data, shopping_data = await loop.run_in_executor(None, fetch_all_serper)
        
        organic_results = data.get("organic", [])
        
        products = []
        seen_urls = set()

        shopping_results = (
            shopping_data.get("shopping")
            or shopping_data.get("shoppingResults")
            or []
        )

        for item in shopping_results:
            url = item.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            title = item.get("title", "Unknown Product")
            price_text = str(item.get("price", ""))
            price = extract_inr_price(price_text)
            if price == 0:
                price = extract_inr_price(" ".join([title, price_text]))

            if is_suspicious_url(url):
                continue

            products.append({
                "name": title,
                "brand": "",
                "model": "",
                "price": price,
                "currency": "INR",
                "platform": item.get("source") or _extract_platform(url),
                "specs": {},
                "rating": item.get("rating"),
                "review_count": item.get("ratingCount"),
                "url": url,
                "availability": "in_stock",
                "image_url": item.get("imageUrl", None),
                "description": sanitize_untrusted_text(item.get("delivery", ""), max_chars=800),
                "scraped_content": ""
            })

        for item in organic_results:
            url = item.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            title = item.get("title", "Unknown Product")
            snippet = item.get("snippet", "")
            item_text = " ".join([
                title,
                snippet,
                " ".join(item.get("attributes", []) or []),
                str(item.get("richSnippet", "")),
            ])
            price = extract_inr_price(item_text)
            if is_suspicious_url(url):
                continue

            products.append({
                "name": title,
                "brand": "",
                "model": "",
                "price": price,
                "currency": "INR",
                "platform": _extract_platform(url),
                "specs": {},
                "rating": None,
                "review_count": None,
                "url": url,
                "availability": "in_stock",
                "image_url": item.get("imageUrl", None),
                "description": sanitize_untrusted_text(snippet, max_chars=800),
                "scraped_content": ""  
            })

        priced_count = sum(1 for product in products if product.get("price", 0) > 0)
        logger.info(f"Serper API returned {len(products)} results ({priced_count} with parsed prices).")
        return products

    except Exception as e:
        logger.error(f"Serper Search error: {e}")
        return []

async def search_deals_for_product(product_name: str, num_results: int = 8) -> list[dict]:
    """Search for the best deals for a specific product across ALL platforms."""
    settings = get_settings()
    if not settings.serper_api_key:
        return []

    try:
        def fetch_serper():
            url = "https://google.serper.dev/search"
            payload = {
                "q": f'"{product_name}" price buy India',
                "gl": "in",
                "num": num_results
            }
            headers = {
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json"
            }
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, fetch_serper)

        results = []
        for item in data.get("organic", []):
            link = item.get("link", "")
            results.append({
                "title": sanitize_untrusted_text(item.get("title", ""), max_chars=300),
                "url": link,
                "snippet": sanitize_untrusted_text(item.get("snippet", ""), max_chars=800),
            })
        
        logger.info(f"Deal search returned {len(results)} results for '{product_name}'")
        return results

    except Exception as e:
        logger.error(f"Deal search error: {e}")
        return []


async def search_reddit_threads(query: str, subreddits: list[str], num_results: int = 5) -> list[dict]:
    """Search for relevant Reddit threads using Serper API."""
    settings = get_settings()
    if not settings.serper_api_key:
        return []

    try:
        def fetch_serper():
            url = "https://google.serper.dev/search"
            site_query = " OR ".join([f"site:reddit.com/r/{sub}" for sub in subreddits])
            payload = {
                "q": f"{query} ({site_query})",
                "gl": "in",
                "num": num_results
            }
            headers = {
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json"
            }
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, fetch_serper)
        
        organic_results = data.get("organic", [])
        threads = []
        for item in organic_results:
            link = item.get("link", "")
            if "reddit.com" in link and "/comments/" in link:
                threads.append({
                    "title": sanitize_untrusted_text(item.get("title", ""), max_chars=300),
                    "url": link,
                    "snippet": sanitize_untrusted_text(item.get("snippet", ""), max_chars=800)
                })
        return threads
    except Exception as e:
        logger.error(f"Reddit Serper Search error: {e}")
        return []

async def search_youtube_videos(query: str, channels: list[str], num_results: int = 5) -> list[dict]:
    """Search and rank long-form YouTube videos using Serper API."""
    settings = get_settings()
    if not settings.serper_api_key:
        return []

    try:
        def extract_video_id(url: str) -> str:
            parsed = urlparse(url)
            if parsed.hostname and "youtu.be" in parsed.hostname:
                return parsed.path.strip("/")
            if parsed.hostname and "youtube.com" in parsed.hostname:
                return parse_qs(parsed.query).get("v", [""])[0]
            return ""

        def score_video(title: str, snippet: str, channel: str) -> tuple[int, list[str]]:
            text = f"{title} {snippet}".lower()
            channel_lower = channel.lower()
            score = 0
            reasons = []

            for term in ["long term", "after", "months", "detailed", "full review"]:
                if term in text:
                    score += 3
                    reasons.append(term)

            for term in ["review", "comparison", "best", "buying guide", "tested"]:
                if term in text:
                    score += 2
                    reasons.append(term)

            if any(trusted.lower() in channel_lower or trusted.lower() in text for trusted in channels):
                score += 4
                reasons.append("trusted channel")

            if "shorts" in text or "/shorts/" in text:
                score -= 10

            return score, reasons[:4]

        def fetch_serper(endpoint: str, payload: dict):
            url = f"https://google.serper.dev/{endpoint}"
            headers = {
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json"
            }
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        def fetch_all_serper():
            q = (
                f"{query} long form review comparison buying guide "
                f"long term detailed tested site:youtube.com/watch"
            )
            payload = {
                "q": q,
                "gl": "in",
                "num": num_results
            }
            try:
                videos_data = fetch_serper("videos", payload)
            except Exception as e:
                logger.warning(f"Serper Videos API unavailable: {e}")
                videos_data = {}
            search_data = fetch_serper("search", payload)
            return videos_data, search_data

        loop = asyncio.get_event_loop()
        videos_data, search_data = await loop.run_in_executor(None, fetch_all_serper)

        raw_results = []
        raw_results.extend(videos_data.get("videos", []) or [])
        raw_results.extend(search_data.get("organic", []) or [])

        videos = []
        seen_ids = set()

        for item in raw_results:
            link = item.get("link") or item.get("url", "")
            if "youtube.com/watch" not in link and "youtu.be/" not in link:
                continue
            if "/shorts/" in link:
                continue

            video_id = extract_video_id(link)
            if not video_id or video_id in seen_ids:
                continue
            seen_ids.add(video_id)

            title = item.get("title", "")
            snippet = sanitize_untrusted_text(item.get("snippet") or item.get("description", ""), max_chars=1000)
            channel = item.get("channel") or item.get("source") or ""
            score, reasons = score_video(title, snippet, channel)

            videos.append({
                "title": title,
                "url": link,
                "video_id": video_id,
                "snippet": snippet,
                "channel": channel,
                "duration": item.get("duration", ""),
                "rank_score": score,
                "rank_reasons": reasons
            })

        videos.sort(key=lambda video: video["rank_score"], reverse=True)
        logger.info(f"Serper YouTube search returned {len(videos)} ranked videos for '{query}'")
        return videos
    except Exception as e:
        logger.error(f"YouTube Serper Search error: {e}")
        return []
