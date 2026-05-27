-- ============================================
-- AI Trip Planner — Unified Database Migration
-- ============================================
-- Compile of all schemas, tables, indices, triggers, and RLS policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL) to set up the complete schema.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Helper Functions & Triggers
-- ============================================

-- Function to update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 2. Destinations & Scraper Core Tables
-- ============================================

-- Destinations Table
CREATE TABLE IF NOT EXISTS destinations (
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

-- Destinations Indices
CREATE INDEX IF NOT EXISTS idx_destinations_category ON destinations(category);
CREATE INDEX IF NOT EXISTS idx_destinations_state ON destinations(state);
CREATE INDEX IF NOT EXISTS idx_destinations_is_active ON destinations(is_active);

-- Destinations Trigger
DROP TRIGGER IF EXISTS update_destinations_updated_at ON destinations;
CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Places Table
CREATE TABLE IF NOT EXISTS places (
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

-- Places Indices
CREATE INDEX IF NOT EXISTS idx_places_destination_id ON places(destination_id);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);


-- Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
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

-- Hotels Indices
CREATE INDEX IF NOT EXISTS idx_hotels_destination_id ON hotels(destination_id);
CREATE INDEX IF NOT EXISTS idx_hotels_price_min_inr ON hotels(price_min_inr);
CREATE INDEX IF NOT EXISTS idx_hotels_scraped_at ON hotels(scraped_at);


-- Hotel Price History Table
CREATE TABLE IF NOT EXISTS hotel_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    price_inr INTEGER,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotel Price History Indices
CREATE INDEX IF NOT EXISTS idx_hotel_price_history_hotel_id ON hotel_price_history(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_price_history_check_in_date ON hotel_price_history(check_in_date);


-- Flights Table
CREATE TABLE IF NOT EXISTS flights (
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

-- Flights Indices
CREATE INDEX IF NOT EXISTS idx_flights_origin_iata ON flights(origin_iata);
CREATE INDEX IF NOT EXISTS idx_flights_destination_iata ON flights(destination_iata);
CREATE INDEX IF NOT EXISTS idx_flights_departure_date ON flights(departure_date);


-- Local Events Table
CREATE TABLE IF NOT EXISTS local_events (
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

-- Local Events Indices
CREATE INDEX IF NOT EXISTS idx_local_events_destination_id ON local_events(destination_id);
CREATE INDEX IF NOT EXISTS idx_local_events_start_date ON local_events(start_date);


-- News Alerts Table
CREATE TABLE IF NOT EXISTS news_alerts (
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

-- News Alerts Indices
CREATE INDEX IF NOT EXISTS idx_news_alerts_destination_id ON news_alerts(destination_id);
CREATE INDEX IF NOT EXISTS idx_news_alerts_severity ON news_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_news_alerts_expires_at ON news_alerts(expires_at);


-- Blogs & Guides Table
CREATE TABLE IF NOT EXISTS blogs_and_guides (
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


-- Weather Cache Table
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL UNIQUE REFERENCES destinations(id) ON DELETE CASCADE,
    forecast_json JSONB,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);


-- Search Cache Table
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    result_json JSONB,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- Search Cache Indices
CREATE INDEX IF NOT EXISTS idx_search_cache_cache_key ON search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache(expires_at);


-- Transport Options Table
CREATE TABLE IF NOT EXISTS transport_options (
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

-- Transport Options Indices
CREATE INDEX IF NOT EXISTS idx_transport_options_search ON transport_options(origin_slug, destination_slug, mode);
CREATE INDEX IF NOT EXISTS idx_transport_options_scraped_at ON transport_options(scraped_at);


-- City Pairs Index Table
CREATE TABLE IF NOT EXISTS city_pairs_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_slug TEXT NOT NULL,
    destination_slug TEXT NOT NULL,
    last_scraped TIMESTAMPTZ,
    scrape_status TEXT DEFAULT 'pending',
    UNIQUE(origin_slug, destination_slug)
);

-- City Pairs Index Indices
CREATE INDEX IF NOT EXISTS idx_city_pairs_index_search ON city_pairs_index(origin_slug, destination_slug);


-- Disable RLS on Scraper/Core Tables for smooth backend/worker access
ALTER TABLE destinations DISABLE ROW LEVEL SECURITY;
ALTER TABLE places DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE flights DISABLE ROW LEVEL SECURITY;
ALTER TABLE local_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE news_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE blogs_and_guides DISABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE transport_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE city_pairs_index DISABLE ROW LEVEL SECURITY;


-- ============================================
-- 3. Frontend/API Google and AI Caches
-- ============================================

-- Places Cache (for Google Places API cache)
CREATE TABLE IF NOT EXISTS places_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  rating DECIMAL(3,1),
  user_ratings_total INT,
  address TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  price_level INT,
  types TEXT[],
  photo_refs TEXT[],
  opening_hours JSONB,
  editorial_summary TEXT,
  website TEXT,
  phone TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_city_category ON places_cache(city, category);


-- Photo Cache (for proxy Google Photo URLs)
CREATE TABLE IF NOT EXISTS photo_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_ref TEXT UNIQUE NOT NULL,
  photo_url TEXT NOT NULL,
  width INT,
  cached_at TIMESTAMPTZ DEFAULT now()
);


-- Stays Cache (for Hotel/Hostel search caches)
CREATE TABLE IF NOT EXISTS stays_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  rating DECIMAL(3,1),
  user_ratings_total INT,
  address TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  price_level INT,
  photo_refs TEXT[],
  website TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stays_city ON stays_cache(city);


-- AI Response Cache (to prevent duplicate LLM calls)
CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  route TEXT NOT NULL,
  destination TEXT NOT NULL,
  response JSONB NOT NULL,
  provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_route ON ai_cache(route, destination);


-- Enable RLS and setup permissive policies on caches (since backend/anon key calls them)
ALTER TABLE places_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write places_cache" ON places_cache;
CREATE POLICY "Allow public read/write places_cache" ON places_cache FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read/write photo_cache" ON photo_cache;
CREATE POLICY "Allow public read/write photo_cache" ON photo_cache FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read/write stays_cache" ON stays_cache;
CREATE POLICY "Allow public read/write stays_cache" ON stays_cache FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read/write ai_cache" ON ai_cache;
CREATE POLICY "Allow public read/write ai_cache" ON ai_cache FOR ALL USING (true);


-- ============================================
-- 4. Trips & User Preferences (Application Data)
-- ============================================

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    destination TEXT NOT NULL,
    origin_city TEXT,
    duration_days INTEGER NOT NULL,
    budget_range TEXT NOT NULL,
    preference TEXT,
    status TEXT DEFAULT 'generating_stays' CHECK (status IN (
        'generating', 
        'selecting_transport', 
        'generating_stays', 
        'selecting_stay', 
        'generating_itinerary', 
        'completed', 
        'completed_and_reviewed', 
        'failed'
    )),
    start_date DATE DEFAULT CURRENT_DATE,
    selected_transport JSONB,
    transport_cost_inr INTEGER,
    remaining_budget_inr INTEGER,
    plan_data JSONB,
    review_rating INTEGER,
    review_text TEXT,
    is_public BOOLEAN DEFAULT false
);

-- Trips RLS & Policies
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own trips" ON trips;
CREATE POLICY "Users can view their own trips" ON trips FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert their own trips" ON trips;
CREATE POLICY "Users can insert their own trips" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips" ON trips FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;
CREATE POLICY "Users can delete their own trips" ON trips FOR DELETE USING (auth.uid() = user_id);


-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    travel_style TEXT,
    pace TEXT,
    food_pref TEXT,
    budget_tier TEXT,
    UNIQUE(user_id)
);

-- User Preferences RLS & Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
