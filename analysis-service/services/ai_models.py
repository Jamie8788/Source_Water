"""
AI service — multi-provider free model routing. Zero user API keys ever.

Provider priority:
  1. Groq           (set GROQ_API_KEY in .env — free 14k req/day, ~800 tok/s)
  2. Pollinations   (zero config, zero key — proxies DeepSeek R1 / GPT-4o / Llama / Mistral)

Model routing by task:
  standard  → Llama 3.3 70B        (strong open-source, good for data analysis)
  pro       → DeepSeek R1          (best free reasoning model, great for complex analysis)
  doc       → GPT-4o / Llama 70B   (document comprehension)
  fast      → Mistral / Llama 8B   (quick fallback)
"""
import os
import httpx

POLLINATIONS_URL = "https://text.pollinations.ai/openai"
GROQ_URL         = "https://api.groq.com/openai/v1/chat/completions"
DEEPSEEK_URL     = "https://api.deepseek.com/chat/completions"

# Pollinations free models (no key needed)
POLLINATIONS_MODELS = {
    "fast":     "mistral",             # Mistral Large
    "standard": "llama",               # Llama 3.3 70B
    "pro":      "deepseek-reasoner",   # DeepSeek R1 — full reasoning model
    "doc":      "openai-large",        # GPT-4o — best for document Q&A
}

# Groq free-tier models (requires GROQ_API_KEY server-side — no user key)
GROQ_MODELS = {
    "fast":     "llama-3.1-8b-instant",          # ~800 tok/s
    "standard": "llama-3.3-70b-versatile",        # best all-round
    "pro":      "deepseek-r1-distill-llama-70b",  # DeepSeek R1 on Groq (fast!)
    "doc":      "llama-3.3-70b-versatile",
}

# Human-readable display names
DISPLAY_NAMES = {
    "mistral":                       "Mistral Large",
    "llama":                         "Llama 3.3 70B",
    "deepseek-reasoner":             "DeepSeek R1",
    "openai-large":                  "GPT-4o",
    "llama-3.1-8b-instant":          "Llama 3.1 8B (Groq)",
    "llama-3.3-70b-versatile":       "Llama 3.3 70B (Groq)",
    "deepseek-r1-distill-llama-70b": "DeepSeek R1 70B (Groq)",
}


class AIModelService:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=90.0)
        self.groq_key    = os.getenv("GROQ_API_KEY", "")
        self.deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

    # ── Groq ─────────────────────────────────────────────────────────────────
    async def _groq(self, messages: list, max_tokens: int, model_key: str) -> tuple[str | None, str]:
        if not self.groq_key:
            return None, ""
        model = GROQ_MODELS[model_key]
        try:
            resp = await self.http_client.post(
                GROQ_URL,
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                headers={
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if text.strip():
                    print(f"[AI] Groq/{model}")
                    return text, DISPLAY_NAMES.get(model, model)
        except Exception as e:
            print(f"[AI] Groq failed: {e}")
        return None, ""

    # ── Pollinations ─────────────────────────────────────────────────────────
    async def _pollinations(self, messages: list, max_tokens: int, model_key: str) -> tuple[str | None, str]:
        model = POLLINATIONS_MODELS[model_key]
        try:
            resp = await self.http_client.post(
                POLLINATIONS_URL,
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                headers={"Content-Type": "application/json"},
                timeout=75.0,
            )
            if resp.status_code == 200:
                text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if text.strip():
                    print(f"[AI] Pollinations/{model}")
                    return text, DISPLAY_NAMES.get(model, model)
        except Exception as e:
            print(f"[AI] Pollinations/{model} failed: {e}")
        return None, ""

    # ── DeepSeek ──────────────────────────────────────────────────────────────
    async def _deepseek(self, messages: list, max_tokens: int, use_pro: bool) -> tuple[str | None, str]:
        if not self.deepseek_key:
            return None, ""
        model = "deepseek-reasoner" if use_pro else "deepseek-chat"
        try:
            resp = await self.http_client.post(
                DEEPSEEK_URL,
                json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.3},
                headers={"Authorization": f"Bearer {self.deepseek_key}", "Content-Type": "application/json"},
                timeout=30.0,
            )
            if resp.status_code == 200:
                text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if text.strip():
                    display = "DeepSeek R1" if use_pro else "DeepSeek V3"
                    print(f"[AI] {display}")
                    return text, display
        except Exception as e:
            print(f"[AI] DeepSeek failed: {e}")
        return None, ""

    # ── Public API ────────────────────────────────────────────────────────────
    async def generate(self,
                       system_prompt: str,
                       user_prompt: str,
                       max_tokens: int = 1000,
                       use_pro: bool = False,
                       is_document: bool = False) -> str:
        """
        Generate AI response. No user API keys — server-side only.
        use_pro=True  → DeepSeek R1 (best reasoning)
        is_document=True → GPT-4o / Llama 70B (best comprehension)
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ]
        model_key = "doc" if is_document else ("pro" if use_pro else "standard")

        # 1. DeepSeek API (best quality, fast — needs DEEPSEEK_API_KEY)
        text, _ = await self._deepseek(messages, max_tokens, use_pro)
        if text:
            return text

        # 2. Groq (fast — needs GROQ_API_KEY)
        text, _ = await self._groq(messages, max_tokens, model_key)
        if text:
            return text

        # 2. Pollinations primary
        text, _ = await self._pollinations(messages, max_tokens, model_key)
        if text:
            return text

        # 3. Pollinations fast fallback
        if model_key != "fast":
            text, _ = await self._pollinations(messages, max_tokens, "fast")
            if text:
                return text

        return "Analysis unavailable — please try again."

    async def generate_with_model(self,
                                   system_prompt: str,
                                   user_prompt: str,
                                   max_tokens: int = 1000,
                                   use_pro: bool = False,
                                   is_document: bool = False) -> tuple[str, str]:
        """Same as generate() but also returns the model display name used."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ]
        model_key = "doc" if is_document else ("pro" if use_pro else "standard")

        text, name = await self._deepseek(messages, max_tokens, use_pro)
        if text:
            return text, name

        text, name = await self._groq(messages, max_tokens, model_key)
        if text:
            return text, name

        text, name = await self._pollinations(messages, max_tokens, model_key)
        if text:
            return text, name

        if model_key != "fast":
            text, name = await self._pollinations(messages, max_tokens, "fast")
            if text:
                return text, name

        return "Analysis unavailable — please try again.", "unknown"

    def get_model_display(self, use_pro: bool = False, is_document: bool = False) -> str:
        model_key = "doc" if is_document else ("pro" if use_pro else "standard")
        if self.groq_key:
            m = GROQ_MODELS[model_key]
        else:
            m = POLLINATIONS_MODELS[model_key]
        return DISPLAY_NAMES.get(m, m)

    async def close(self):
        await self.http_client.aclose()


# Singleton
ai_service = AIModelService()
