import re

class BotDetector:
    def __init__(self):
        # Fake hype signals
        self.bot_patterns = [
            r"exceeded all expectations",
            r"highly recommend",
            r"5/5 stars",
            r"best purchase ever",
            r"life changing",
            r"10/10",
        ]
        
        # Genuine signals
        self.genuine_patterns = [
            r"after \d+ months?",
            r"service center",
            r"battery drain",
            r"heating",
            r"customer support",
            r"issue",
            r"warranty",
            r"update",
            r"bloatware"
        ]

    def score_comment(self, comment_text: str) -> float:
        """
        Score a comment based on bot/shill patterns and genuine user patterns.
        Negative score indicates likely bot/shill.
        Positive score indicates likely genuine user.
        """
        score = 0.0
        text = comment_text.lower()
        
        # Penalize bot patterns
        for pattern in self.bot_patterns:
            if re.search(pattern, text):
                score -= 1.0
                
        # Reward genuine patterns
        for pattern in self.genuine_patterns:
            if re.search(pattern, text):
                score += 1.5
                
        # Length penalty for extremely long generic comments without genuine signals
        if len(text) > 400:
            # Check if it has any genuine signals, if not, penalize heavily
            has_genuine = any(re.search(pattern, text) for pattern in self.genuine_patterns)
            if not has_genuine:
                score -= 2.0
            
        return score
