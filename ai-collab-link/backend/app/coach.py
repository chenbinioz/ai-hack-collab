import os


def generate_coach_response(prompt: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "Coach API key is not configured."

    return f"This is a placeholder coach response for: {prompt}"
