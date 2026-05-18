from agents.base_agent import BaseAgent
from core.config import settings

class PlacesAgent(BaseAgent):
    name = "places"

    async def fetch(self, state: dict) -> dict:
        weather_data = state.get("weather", {})
        lat = weather_data.get("lat", 0)
        lon = weather_data.get("lon", 0)

        # Guard against invalid location (ocean / coords not resolved yet)
        if lat == 0 or lon == 0:
            return {"attractions": [], "count": 0,
                    "note": "Could not resolve destination coordinates."}

        # Guard against missing API key — agent is optional
        if not settings.OPENTRIPMAP_API_KEY.strip():
            return {"attractions": [], "count": 0,
                    "note": "OPENTRIPMAP_API_KEY not set. Get free key at opentripmap.io"}

        # OpenTripMap: get top attractions within 20km
        places = await self.get(
            "https://api.opentripmap.com/0.1/en/places/radius",
            params={
                "radius": 20000,
                "lon": lon, "lat": lat,
                "kinds": "interesting_places,cultural,museums,natural",
                "rate": "3",           # only well-rated places
                "limit": 20,
                "apikey": settings.OPENTRIPMAP_API_KEY
            }
        )
        features = places.get("features", [])
        top = []
        for f in features[:15]:
            props = f["properties"]
            top.append({
                "name": props.get("name", "Unnamed"),
                "kinds": props.get("kinds", ""),
                "lat": f["geometry"]["coordinates"][1],
                "lon": f["geometry"]["coordinates"][0],
                "xid": props.get("xid")
            })
        return {"attractions": top, "count": len(top)}

