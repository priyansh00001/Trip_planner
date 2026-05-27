# IMPLEMENTATION NOTE:
# Site configuration registry for the BrowserAgent.
# Defines how to navigate each travel website — no scraping logic here.
# Sorted by reliability descending for SmartScraper's site selection.
#
# FIX 3B — Holidify added as top-priority direct-URL source (reliability=10).
#           search_selector=None for all direct-URL sites: no search-box click needed.
#           Thrillophilia and Tripoto search_selector set to optional mode via
#           SmartScraper's search_and_extract fallback path.

from typing import Optional

SITE_CONFIGS: dict[str, dict] = {
    "wikipedia": {
        "name": "Wikipedia",
        "base_url": "https://en.wikipedia.org",
        "search_url": "https://en.wikipedia.org/wiki/{destination}",
        "search_selector": None,       # direct URL — no search box needed
        "reliability": 10,
        "data_types": ["places", "local_insights", "events", "best_months"],
        "scrape_interval_hours": 168,
        "timeout_seconds": 20,
    },
    # FIX 3B — Holidify: best single-page source for Indian destinations.
    # Direct slug URL returns attractions, hotels, budget, best months in one page.
    "holidify": {
        "name": "Holidify",
        "base_url": "https://www.holidify.com",
        "search_url": "https://www.holidify.com/places/{destination-slug}/",
        "search_selector": None,       # direct URL — no search box needed
        "reliability": 10,
        "data_types": ["places", "hotels", "best_months", "avg_daily_budget_inr"],
        "scrape_interval_hours": 48,
        "timeout_seconds": 30,
    },
    "thrillophilia": {
        "name": "Thrillophilia",
        "base_url": "https://www.thrillophilia.com",
        "search_url": "https://www.thrillophilia.com/places-to-visit-in-{destination-slug}",
        "search_selector": None,       # use direct URL rather than search box (avoids selector timeout)
        "reliability": 9,
        "data_types": ["places", "local_insights", "events"],
        "scrape_interval_hours": 24,
        "timeout_seconds": 25,
    },
    "tripoto": {
        "name": "Tripoto",
        "base_url": "https://www.tripoto.com",
        "search_url": "https://www.tripoto.com/{destination-slug}-trips",
        "search_selector": None,       # direct URL — avoids fragile search-box JS
        "reliability": 8,
        "data_types": ["places", "local_insights", "best_months"],
        "scrape_interval_hours": 24,
        "timeout_seconds": 25,
    },
    "hostelworld": {
        "name": "Hostelworld",
        "base_url": "https://www.hostelworld.com",
        "search_url": "https://www.hostelworld.com/search?search_keywords={destination}",
        "search_selector": "input[name='search_keywords']",
        "reliability": 7,
        "data_types": ["hotels"],
        "scrape_interval_hours": 6,
        "timeout_seconds": 25,
    },
}

# Pre-sorted by reliability desc (used by SmartScraper)
SITE_CONFIGS_SORTED: list[tuple[str, dict]] = sorted(
    SITE_CONFIGS.items(),
    key=lambda x: x[1]["reliability"],
    reverse=True,
)


def get_configs_for_data_types(data_types: Optional[list[str]] = None) -> list[dict]:
    """
    Return site configs filtered by data_types, sorted by reliability desc.
    If data_types is None, return all configs sorted by reliability.
    """
    configs = []
    for key, cfg in SITE_CONFIGS_SORTED:
        if data_types is None:
            configs.append({**cfg, "_key": key})
        else:
            # Include site if it provides ANY of the requested data types
            if any(dt in cfg["data_types"] for dt in data_types):
                configs.append({**cfg, "_key": key})
    return configs