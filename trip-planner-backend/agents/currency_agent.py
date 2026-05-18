from agents.base_agent import BaseAgent

class CurrencyAgent(BaseAgent):
    name = "currency"

    async def fetch(self, state: dict) -> dict:
        # Frankfurter is free, no API key, very reliable
        # Updated to use new API endpoint (old one redirects)
        data = await self.get(
            "https://api.frankfurter.dev/v1/latest",
            params={"from": "USD", "to": "EUR,GBP,INR,JPY,AED,THB"}
        )
        return {
            "base": "USD",
            "rates": data.get("rates", {}),
            "date": data.get("date")
        }
