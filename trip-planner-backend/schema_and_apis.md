# Backend Database Schema and API Reference

## Database Schema (Supabase)

The core data is stored in a Supabase PostgreSQL database. The schema leverages strict relational constraints and supports vector search via FAISS on the backend (not directly in Postgres).

### 1. `destinations`
Stores the top-level metadata for each travel destination.
- `id` (uuid, primary key)
- `slug` (string, unique, e.g., 'jaipur')
- `name` (string)
- `state` (string)
- `region` (string)
- `category` (string, e.g., 'heritage', 'beach', 'mountains')
- `lat` / `lon` (float)
- `description` (text)
- `best_months` (jsonb array of integers 1-12)
- `avg_trip_duration_days` (integer)
- `difficulty` (string)
- `avg_daily_budget_inr` (jsonb: `{budget, mid, premium}`)
- `nearest_airport_code` (string)
- `nearest_railway_station` (string)
- `flight_hours_from` (jsonb)
- `is_active` (boolean)
- `data_quality_score` (integer 0-100)
- `scraped_at` (timestamp)

### 2. `places`
Tourist attractions, monuments, viewpoints, and activities.
- `id` (uuid, primary key)
- `destination_id` (uuid, foreign key)
- `name` (string)
- `category` (string)
- `description` (text)
- `entry_fee_inr` (integer)
- `duration_hours` (float)
- `best_time` (string)
- `tips` (text)
- `lat` / `lon` (float)
- `source` (string)
- `is_verified` (boolean)
- `scraped_at` (timestamp)
*(Unique constraint on `destination_id` + `name`)*

### 3. `hotels`
Accommodation options (hostels, hotels, homestays).
- `id` (uuid, primary key)
- `destination_id` (uuid, foreign key)
- `name` (string)
- `locality` (string)
- `property_type` (string)
- `price_min_inr` / `price_max_inr` (integer)
- `rating` (float)
- `review_count` (integer)
- `amenities` (jsonb array of strings)
- `source` (string)
- `url` (string)
- `is_stale` (boolean)
- `scraped_at` (timestamp)
*(Unique constraint on `destination_id` + `name` + `source`)*

### 4. `local_events`
Festivals, concerts, and cultural events happening in the destination.
- `id` (uuid, primary key)
- `destination_id` (uuid, foreign key)
- `name` (string)
- `event_type` (string)
- `start_date` (timestamp)
- `end_date` (timestamp)
- `description` (text)
- `impact_on_travel` (text)
- `is_recurring` (boolean)
- `source` (string)
- `scraped_at` (timestamp)
*(Unique constraint on `destination_id` + `name` + `start_date`)*

### 5. `blogs_and_guides`
Unstructured tips and local insights extracted by the LLM from travel blogs.
- `id` (uuid, primary key)
- `destination_id` (uuid, foreign key)
- `title` (string)
- `url` (string)
- `author` (string)
- `content` (text)
- `key_tips` (jsonb array of strings)
- `local_insights` (jsonb array of strings)
- `scraped_at` (timestamp)
*(Unique constraint on `destination_id` + `url`)*


---

## API Endpoints (Frontend Integration)

The backend provides the following `FastAPI` endpoints for the frontend to consume.

### Destinations Router (`/destinations`)

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/destinations` | `category`, `state`, `budget_tier`, `best_month`, `min_days`, `max_days`, `search` | Returns a list of active destinations matching the filters. |
| `GET` | `/destinations/{slug}` | - | Returns full destination details, including `places`, `hotels`, `upcoming_events`, `active_news`, `blog_tips`, `local_insights`, and `weather_cache`. **Triggers an on-demand background scrape if the slug is unknown.** |
| `GET` | `/destinations/{slug}/scrape-status` | - | Poll this endpoint (every 5-10s) to check the progress of an on-demand background scrape. Returns `scraping_in_progress` (bool) and `data_quality_score`. |
| `GET` | `/destinations/compare` | `slugs` (comma separated string) | Returns a side-by-side comparison matrix for up to 3 destinations. |

### Plan Router (`/plan`)

| Method | Endpoint | Payload / Query Params | Description |
|---|---|---|---|
| `POST` | `/plan/generate` | JSON Payload (see below) | Generates a fully personalized, day-by-day travel itinerary using the RAG/LLM engine. |
| `POST` | `/plan/refine` | JSON Payload (see below) | Allows the user to provide conversational feedback to adjust a previously generated itinerary. |

**`/plan/generate` Payload Schema:**
```json
{
  "destination_slug": "jaipur",
  "start_date": "2026-10-15T00:00:00Z",
  "end_date": "2026-10-18T00:00:00Z",
  "travelers": {"adults": 2, "children": 0},
  "budget_tier": "mid",
  "interests": ["heritage", "food", "photography"],
  "pace": "medium"
}
```

### Scraper Admin Router (`/scraper`)

*Note: These are primarily for administrative or internal usage. They require the `X-Admin-Secret` header.*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/scraper/status` | Returns the current DB record count and timestamp for all destinations. |
| `POST`| `/scraper/trigger/{destination_slug}` | Manually forces the `SmartScraper` to run a fresh scrape for the specified destination. |
