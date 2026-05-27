import logging
from datetime import datetime, timezone, timedelta
from agents.base_agent import BaseAgent
from core.supabase_client import db

logger = logging.getLogger(__name__)

class CurrencyAgent(BaseAgent):
    name = "currency"

    async def fetch(self, state: dict) -> dict:
        cache_key = "currency_rates:USD"
        
        # 1. Try fetching from live Frankfurter API
        try:
            data = await self.get(
                "https://api.frankfurter.dev/v1/latest",
                params={"from": "USD", "to": "EUR,GBP,INR,JPY,AED,THB"}
            )
            if data and "rates" in data:
                rates_result = {
                    "base": "USD",
                    "rates": data.get("rates", {}),
                    "date": data.get("date"),
                    "cached_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Try saving to search_cache asynchronously
                try:
                    db.table("search_cache").upsert({
                        "cache_key": cache_key,
                        "result_json": rates_result,
                        "last_hit_at": datetime.now(timezone.utc).isoformat(),
                        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
                    }, on_conflict="cache_key").execute()
                except Exception as db_err:
                    logger.warning(f"CurrencyAgent: failed to save rates to cache: {db_err}")
                
                return rates_result
        except Exception as e:
            logger.warning(f"CurrencyAgent: Frankfurter API call failed ({e}), checking database cache...")

        # 2. Try fetching from Supabase database search_cache table (cached scraped data)
        try:
            res = db.table("search_cache").select("*").eq("cache_key", cache_key).execute()
            if res.data:
                cached_data = res.data[0]["result_json"]
                logger.info(f"CurrencyAgent: retrieved currency rates from cache database")
                # Increment hit count in background
                try:
                    db.table("search_cache").update({
                        "hit_count": res.data[0].get("hit_count", 0) + 1,
                        "last_hit_at": datetime.now(timezone.utc).isoformat()
                    }).eq("cache_key", cache_key).execute()
                except Exception:
                    pass
                return cached_data
        except Exception as db_err:
            logger.error(f"CurrencyAgent: failed to query database cache: {db_err}")

        # 3. If both API and database cache fail, raise an error to indicate no scraped currency data is available
        raise RuntimeError("No live or cached scraped currency data available.")
