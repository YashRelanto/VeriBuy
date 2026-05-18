from youtube_transcript_api import YouTubeTranscriptApi
from loguru import logger
import re
from app.guardrails import sanitize_untrusted_text


def _snippet_text(entry) -> str:
    """Support both dict snippets and FetchedTranscriptSnippet objects."""
    if hasattr(entry, "text"):
        return entry.text
    if isinstance(entry, dict):
        return entry.get("text", "")
    return ""


def extract_and_clean_transcript(video_id: str, max_chars: int = 12000) -> str:
    """
    Fetch transcript using the current youtube-transcript-api instance API.
    Tries English first, then Indian English and Hindi.
    Cleans up noise tags.
    """
    try:
        ytt_api = YouTubeTranscriptApi()
        pieces = ytt_api.fetch(video_id, languages=['en', 'en-IN', 'hi'])

        if not pieces:
            return ""

        full_text = " ".join(_snippet_text(entry) for entry in pieces)
        
        # Clean up noise tags like [Music], [Applause], \n
        full_text = re.sub(r'\[.*?\]', '', full_text)
        full_text = full_text.replace('\n', ' ')
        full_text = re.sub(r'\s+', ' ', full_text).strip()
        
        return sanitize_untrusted_text(full_text, max_chars=max_chars)
        
    except Exception as e:
        error_text = str(e).strip()
        if "blocking requests from your IP" in error_text or "RequestBlocked" in error_text:
            logger.warning(
                f"Transcript extraction blocked by YouTube for video {video_id}; "
                "using Serper video metadata fallback."
            )
        else:
            first_line = error_text.splitlines()[0] if error_text else "unknown error"
            logger.warning(f"Transcript extraction failed for video {video_id}: {first_line}")
        return ""
