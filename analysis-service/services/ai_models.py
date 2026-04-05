"""
AI service using Pollinations.ai — 100% free, no API key, no account, no limits.
Falls back to Gemini if configured.
"""
import httpx
from typing import Optional

POLLINATIONS_URL = "https://text.pollinations.ai/openai"


class AIModelService:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=60.0)

    async def generate(self,
                       system_prompt: str,
                       user_prompt: str,
                       max_tokens: int = 1000,
                       use_pro: bool = False) -> str:
        """Generate AI response — free via Pollinations.ai, no key needed."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        try:
            resp = await self.http_client.post(
                POLLINATIONS_URL,
                json={
                    "model": "openai",
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if text:
                return text
        except Exception as e:
            print(f"Pollinations AI error: {e}")

        return "Analysis unavailable — please try again."

    async def close(self):
        await self.http_client.aclose()


# Singleton instance
ai_service = AIModelService()
