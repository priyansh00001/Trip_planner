-- migrations/001_initial_schema.sql
-- Trip Planner Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- destinations table
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    state TEXT,
    region TEXT,
    lat NUMERIC(10, 7),
    lon NUMERIC(10, 7),
    description TEXT,
    category TEXT CHECK (category IN ('beach', 'heritage', 'mountains', 'wildlife', 'city', 'pilgrimage')),
    best_months INTEGER[],
    avg_trip_duration_days INTEGER,
    difficulty TEXT,
    avg_daily_budget_inr JSONB,
    nearest_airport_code TEXT,
    nearest_railway_station TEXT,
    flight_hours_from JSONB,
    is_active BOOLEAN DEFAULT true,
    data_quality_score INTEGER DEFAULT 0,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_destinations_category ON destinations(category);
CREATE INDEX idx_destinations_state ON destinations(state);
CREATE INDEX idx_destinations_is_active ON destinations(is_active);

-- places table
CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    lat NUMERIC(10, 7),
    lon NUMERIC(10, 7),
    address TEXT,
    entry_fee_inr INTEGER DEFAULT 0,
    duration_hours NUMERIC(4, 1),
    best_time_of_day TEXT,
    description TEXT,
    tips TEXT,
    tags TEXT[],
    is_verified BOOLEAN DEFAULT false,
    photo_refs JSONB DEFAULT '[]',
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(destination_id, name)
);

CREATE INDEX idx_places_destination_id ON places(destination_id);
CREATE INDEX idx_places_category ON places(category);

-- hotels table
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    locality TEXT,
    star_rating NUMERIC(2, 1),
    property_type TEXT,
    price_min_inr INTEGER,
    price_max_inr INTEGER,
    amenities TEXT[],
    rating NUMERIC(3, 2),
    review_count INTEGER,
    source TEXT,
    source_url TEXT,
    is_stale BOOLEAN DEFAULT false,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, destination_id, source)
);

CREATE INDEX idx_hotels_destination_id ON hotels(destination_id);
CREATE INDEX idx_hotels_price_min_inr ON hotels(price_min_inr);
CREATE INDEX idx_hotels_scraped_at ON hotels(scraped_at);

-- hotel_price_history table
CREATE TABLE hotel_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    price_inr INTEGER,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hotel_price_history_hotel_id ON hotel_price_history(hotel_id);
CREATE INDEX idx_hotel_price_history_check_in_date ON hotel_price_history(check_in_date);

-- flights table
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_iata TEXT NOT NULL,
    destination_iata TEXT NOT NULL,
    airline TEXT,
    price_inr INTEGER,
    duration_minutes INTEGER,
    departure_date DATE,
    source TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(origin_iata, destination_iata, airline, departure_date, source)
);

CREATE INDEX idx_flights_origin_iata ON flights(origin_iata);
CREATE INDEX idx_flights_destination_iata ON flights(destination_iata);
CREATE INDEX idx_flights_departure_date ON flights(departure_date);

-- local_events table
CREATE TABLE local_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_date DATE,
    end_date DATE,
    source_url TEXT,
    is_recurring BOOLEAN DEFAULT false,
    impact_on_travel TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(destination_id, name, start_date)
);

CREATE INDEX idx_local_events_destination_id ON local_events(destination_id);
CREATE INDEX idx_local_events_start_date ON local_events(start_date);

-- news_alerts table
CREATE TABLE news_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
    state TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    source_url TEXT,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_alerts_destination_id ON news_alerts(destination_id);
CREATE INDEX idx_news_alerts_severity ON news_alerts(severity);
CREATE INDEX idx_news_alerts_expires_at ON news_alerts(expires_at);

-- blogs_and_guides table
CREATE TABLE blogs_and_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE,
    source_name TEXT,
    content_summary TEXT,
    key_tips TEXT[] DEFAULT '{}',
    local_insights TEXT[] DEFAULT '{}',
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    content_hash TEXT
);

-- weather_cache table
CREATE TABLE weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL UNIQUE REFERENCES destinations(id) ON DELETE CASCADE,
    forecast_json JSONB,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- search_cache table
CREATE TABLE search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    result_json JSONB,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_search_cache_cache_key ON search_cache(cache_key);
CREATE INDEX idx_search_cache_expires_at ON search_cache(expires_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();