-- migrations/003_transport.sql
-- Transport options table

CREATE TABLE transport_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_city TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    origin_slug TEXT NOT NULL,
    destination_slug TEXT NOT NULL,
    mode TEXT NOT NULL,
    operator TEXT,
    duration_minutes INTEGER,
    price_min_inr INTEGER NOT NULL,
    price_max_inr INTEGER NOT NULL,
    departure_times TEXT[],
    frequency TEXT,
    booking_url TEXT,
    source TEXT,
    scraped_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(origin_slug, destination_slug, mode, operator)
);

CREATE TABLE city_pairs_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_slug TEXT NOT NULL,
    destination_slug TEXT NOT NULL,
    last_scraped TIMESTAMPTZ,
    scrape_status TEXT DEFAULT 'pending',
    UNIQUE(origin_slug, destination_slug)
);

CREATE INDEX idx_transport_options_search ON transport_options(origin_slug, destination_slug, mode);
CREATE INDEX idx_transport_options_scraped_at ON transport_options(scraped_at);
CREATE INDEX idx_city_pairs_index_search ON city_pairs_index(origin_slug, destination_slug);

-- Alter trips Table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin_city TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS selected_transport JSONB;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS transport_cost_inr INTEGER;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS remaining_budget_inr INTEGER;

-- Update trips_status_check constraint
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check CHECK (status IN (
    'generating', 'selecting_transport', 'generating_stays', 'selecting_stay', 
    'generating_itinerary', 'completed', 'completed_and_reviewed', 'failed'
));
