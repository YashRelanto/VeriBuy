from youtube_transcript_api import YouTubeTranscriptApi

try:
    t = YouTubeTranscriptApi.get_transcript("dQw4w9WgXcQ")
    print(f"Transcript works! Got {len(t)} segments")
    print(f"First segment: {t[0]['text']}")
except Exception as e:
    print(f"Error: {e}")
