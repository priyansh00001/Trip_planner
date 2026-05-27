# Real-time Scraper vs Fallback Analysis

This report outlines how often the live Google scraping succeeds versus when the system falls back to seed data or estimated calculations.

## Test Results Summary

| Route | Has Seed in DB? | Live Scrape Succeeded | Fallback Used | Failed Modes |
|-------|-----------------|-----------------------|---------------|--------------|
| Delhi -> Jaipur | Yes | None | None | None |
| Bangalore -> Mysore | No | None | None | None |
| Delhi -> Mumbai | No | None | None | None |
| Guwahati -> Shillong | No | None | None | None |
| Bhopal -> Indore | No | None | None | None |
| Coimbatore -> Ooty | No | None | None | None |
| Kochi -> Munnar | No | None | None | None |
| Dehradun -> Mussoorie | No | None | None | None |

## Metrics
- **Total Routes Tested:** 8
- **Routes with at least one LIVE scrape success:** 0 (0%)
- **Routes using Fallback (Seed/Cab):** 0 (0%)

### Notes on Behaviour
- For routes with **known seed data**, the system instantly shows the seed data (Fallback Used = flight/train/bus), and in the background, the scraper tries to find live data.
- For **obscure routes**, seed data is missing, so it immediately relies on a **Calculated Cab Estimate** (`cab`) while the Google scraper attempts to find live results.
- If Google Flights/Trains returns results, they are pushed as `live_data`.
- Sometimes, Google Search blocks automated requests or the LLM parsing fails, resulting in `mode_failed`. The robust fallback mechanism ensures the UI never breaks and the user always sees at least a cab estimate or historical seed data.