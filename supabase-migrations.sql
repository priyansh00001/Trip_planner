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

-- ============================================
-- 5. Trips & User Preferences Tables
-- ============================================

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    destination TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    budget_range TEXT NOT NULL,
    preference TEXT,
    status TEXT DEFAULT 'generating_stays' CHECK (status IN (
        'generating', 'generating_stays', 'selecting_stay', 
        'generating_itinerary', 'completed', 'completed_and_reviewed', 'failed'
    )),
    start_date DATE DEFAULT CURRENT_DATE,
    plan_data JSONB,
    is_public BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Policies for trips
DROP POLICY IF EXISTS "Users can view their own trips" ON trips;
DROP POLICY IF EXISTS "Users can insert their own trips" ON trips;
DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;

CREATE POLICY "Users can view their own trips" ON trips FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert their own trips" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trips" ON trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trips" ON trips FOR DELETE USING (auth.uid() = user_id);

-- Create user_preferences table
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

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for user_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

CREATE POLICY "Users can view their own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

