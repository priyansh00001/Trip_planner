-- ============================================
-- AI Trip Planner — Supabase Cache Tables
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================

-- 1. Places cache (for Google Places results later)
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

CREATE INDEX idx_places_city_category ON places_cache(city, category);

-- 2. Photo cache (proxy Google photos)
CREATE TABLE IF NOT EXISTS photo_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_ref TEXT UNIQUE NOT NULL,
  photo_url TEXT NOT NULL,
  width INT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Stays cache (hotels/hostels)
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

CREATE INDEX idx_stays_city ON stays_cache(city);

-- 4. AI response cache (eliminates repeat AI calls)
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

CREATE INDEX idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX idx_ai_cache_route ON ai_cache(route, destination);
