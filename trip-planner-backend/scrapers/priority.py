"""
scrapers/priority.py — Destination priority tiers for the background scraper pipeline.

Tier 1 (HIGH)   → scrape every 6 hours   (top searched Indian destinations)
Tier 2 (MEDIUM) → scrape every 24 hours
Tier 3 (LOW)    → scrape every 48 hours  (niche / remote destinations)

Transport popular pairs → scraped every 12 hours.
"""

TIER_1_HIGH = [
    "goa-north", "goa-south", "manali", "jaipur", "udaipur",
    "shimla", "darjeeling", "kerala", "agra", "varanasi",
]

TIER_2_MEDIUM = [
    "jodhpur", "jaisalmer", "pushkar", "varkala", "kovalam",
    "munnar", "coorg", "hampi", "pondicherry", "dharamshala",
]

TIER_3_LOW = [
    "spiti-valley", "gangtok", "andaman-islands",
    "kaziranga", "ranthambore", "jim-corbett",
]

# Well-known origin→destination pairs for transport scraping.
# Ordered roughly by demand (most popular first).
TRANSPORT_POPULAR_PAIRS = [
    ("Delhi",     "Jaipur"),
    ("Delhi",     "Manali"),
    ("Delhi",     "Shimla"),
    ("Mumbai",    "Goa"),
    ("Mumbai",    "Pune"),
    ("Bangalore", "Coorg"),
    ("Bangalore", "Goa"),
    ("Chennai",   "Pondicherry"),
    ("Kolkata",   "Darjeeling"),
    ("Delhi",     "Agra"),
    ("Mumbai",    "Udaipur"),
    ("Delhi",     "Varanasi"),
]


def get_tier(slug: str) -> int:
    """Return priority tier (1=high, 2=medium, 3=low) for a destination slug."""
    if slug in TIER_1_HIGH:
        return 1
    if slug in TIER_2_MEDIUM:
        return 2
    return 3


def get_interval_hours(slug: str) -> int:
    """Return scrape interval in hours based on destination tier."""
    return {1: 6, 2: 24, 3: 48}[get_tier(slug)]
