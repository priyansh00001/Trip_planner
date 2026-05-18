from agents.base_agent import BaseAgent
from core.config import settings

class WeatherAgent(BaseAgent):
    name = "weather"

    async def fetch(self, state: dict) -> dict:
        req = state["request"]
        # Step 1: geocode destination
        geo = await self.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": req.destination, "format": "json", "limit": 1},
            headers={"User-Agent": "TripPlannerApp/1.0"}
        )
        lat, lon = geo[0]["lat"], geo[0]["lon"]

        # Step 2: fetch 7-day forecast (free OWM endpoint)
        forecast = await self.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={
                "lat": lat, "lon": lon,
                "appid": settings.OPENWEATHER_API_KEY,
                "units": "metric", "cnt": 40
            }
        )
        # Summarise by day
        days = {}
        for item in forecast["list"]:
            day = item["dt_txt"][:10]
            days.setdefault(day, []).append({
                "temp": item["main"]["temp"],
                "desc": item["weather"][0]["description"]
            })
        summary = {
            day: {
                "avg_temp": round(sum(x["temp"] for x in items) / len(items), 1),
                "condition": items[0]["desc"]
            }
            for day, items in list(days.items())[:7]
        }
        return {"location": req.destination, "lat": lat, "lon": lon, "forecast": summary}
