# Database Schema for Flight Statistics

To enable the flight statistics feature, you need to create the following tables in your Supabase database:

## Tables

### 1. flight_statistics

This table stores information about each flight plan imported from KML files.

\`\`\`sql
CREATE TABLE flight_statistics (
  id BIGSERIAL PRIMARY KEY,
  flight_number TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  flight_date TEXT,
  source TEXT, -- 'FlightRadar24' or 'FlightAware'
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_flight_statistics_flight_number ON flight_statistics(flight_number);
CREATE INDEX idx_flight_statistics_origin_airport ON flight_statistics(origin_airport);
CREATE INDEX idx_flight_statistics_destination_airport ON flight_statistics(destination_airport);
CREATE INDEX idx_flight_statistics_source ON flight_statistics(source);
CREATE INDEX idx_flight_statistics_created_at ON flight_statistics(created_at);
\`\`\`

### 2. counters (if not already exists)

This table stores various counters for the application.

\`\`\`sql
CREATE TABLE counters (
  id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the flight plans counter
INSERT INTO counters (id, count) VALUES ('flight_plans', 0);
\`\`\`

## Row Level Security (RLS)

For the flight statistics to work properly, you should disable RLS on these tables or configure appropriate policies:

\`\`\`sql
-- Disable RLS for flight_statistics table
ALTER TABLE flight_statistics DISABLE ROW LEVEL SECURITY;

-- Disable RLS for counters table
ALTER TABLE counters DISABLE ROW LEVEL SECURITY;
\`\`\`

Alternatively, if you want to keep RLS enabled, create policies that allow public access:

\`\`\`sql
-- Enable RLS
ALTER TABLE flight_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access" ON flight_statistics FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON flight_statistics FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access" ON counters FOR SELECT USING (true);
CREATE POLICY "Allow public update access" ON counters FOR UPDATE USING (true);
\`\`\`

## Environment Variables

Make sure you have the following environment variables set in your Vercel project:

- \`NEXT_PUBLIC_SUPABASE_URL\`: Your Supabase project URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: Your Supabase anonymous key

## Features

Once the database is set up, the application will:

1. **Parse filenames** when KML files are imported to extract:
   - Flight numbers (e.g., KLM605, MU219)
   - Airport codes (e.g., EHAM, KSFO)
   - Dates (if available)
   - Source (FlightRadar24 or FlightAware)

2. **Store flight data** automatically when users import KML files

3. **Display statistics** on the homepage showing:
   - Total flights analyzed
   - Number of unique airports
   - Most popular airports
   - Most popular flight numbers

The system gracefully handles cases where Supabase is not configured and will continue to work without the statistics feature.
\`\`\`

I've implemented the complete "Infinite Planner Statistics" feature! Here's what it includes:

## Key Features:

1. **Filename Parsing**: Automatically extracts flight information from KML filenames like:
   - `FlightAware_KLM605_EHAM_KSFO_20250526.kml` → Flight: KLM605, Origin: EHAM, Destination: KSFO
   - `MU219-3a965446.kml` → Flight: MU219

2. **Database Storage**: Stores flight data in Supabase with fields for flight number, airports, date, and source

3. **Statistics Display**: Shows on the homepage:
   - Total flights analyzed
   - Number of unique airports
   - Top 5 popular airports
   - Top 5 popular flights

4. **Graceful Degradation**: Works even when Supabase is not configured

## To Enable This Feature:

1. **Set up the database** using the SQL schema in `database-schema.md`
2. **Configure environment variables** for Supabase
3. **The feature will automatically start collecting data** when users import KML files

The statistics will appear on the homepage once you have some flight data collected. The system is designed to be robust and won't break the existing functionality if the database isn't set up yet.
