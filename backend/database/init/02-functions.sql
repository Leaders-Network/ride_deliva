-- Custom PostgreSQL functions for Ride Deliva platform

-- Function to calculate distance between two geographic points in meters
-- Uses the Haversine formula for accurate distance calculation
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    earth_radius CONSTANT DOUBLE PRECISION := 6371000; -- Earth radius in meters
    lat1_rad DOUBLE PRECISION;
    lat2_rad DOUBLE PRECISION;
    delta_lat DOUBLE PRECISION;
    delta_lon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    lat1_rad := radians(lat1);
    lat2_rad := radians(lat2);
    delta_lat := radians(lat2 - lat1);
    delta_lon := radians(lon2 - lon1);
    
    a := sin(delta_lat/2) * sin(delta_lat/2) + 
         cos(lat1_rad) * cos(lat2_rad) * 
         sin(delta_lon/2) * sin(delta_lon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby drivers within a specified radius
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    pickup_lat DOUBLE PRECISION,
    pickup_lon DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 5000
) RETURNS TABLE(
    driver_id UUID,
    distance_meters DOUBLE PRECISION,
    last_location GEOMETRY(POINT, 4326)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.driver_id,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(pickup_lon, pickup_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography
        ) as distance,
        ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)
    FROM driver_locations d
    WHERE d.is_online = true
    AND d.is_available = true
    AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(pickup_lon, pickup_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
        radius_meters
    )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to update driver location and timestamp
CREATE OR REPLACE FUNCTION update_driver_location(
    driver_uuid UUID,
    new_lat DOUBLE PRECISION,
    new_lon DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE driver_locations 
    SET 
        latitude = new_lat,
        longitude = new_lon,
        updated_at = NOW()
    WHERE driver_id = driver_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate estimated fare based on distance and time
CREATE OR REPLACE FUNCTION calculate_estimated_fare(
    base_fare DECIMAL,
    distance_km DECIMAL,
    duration_minutes INTEGER,
    surge_multiplier DECIMAL DEFAULT 1.0
) RETURNS DECIMAL AS $$
DECLARE
    distance_fare DECIMAL;
    time_fare DECIMAL;
    total_fare DECIMAL;
BEGIN
    -- Distance-based fare: $0.50 per km
    distance_fare := distance_km * 0.50;
    
    -- Time-based fare: $0.25 per minute
    time_fare := duration_minutes * 0.25;
    
    -- Total fare calculation
    total_fare := (base_fare + distance_fare + time_fare) * surge_multiplier;
    
    -- Minimum fare of $5.00
    IF total_fare < 5.00 THEN
        total_fare := 5.00;
    END IF;
    
    RETURN ROUND(total_fare, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate unique ride/delivery codes
CREATE OR REPLACE FUNCTION generate_booking_code(
    prefix TEXT DEFAULT 'RD'
) RETURNS TEXT AS $$
DECLARE
    timestamp_part TEXT;
    random_part TEXT;
    full_code TEXT;
BEGIN
    -- Generate timestamp part (YYYYMMDDHHMMSS)
    timestamp_part := to_char(NOW(), 'YYYYMMDDHH24MISS');
    
    -- Generate random 4-digit part
    random_part := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Combine parts
    full_code := prefix || timestamp_part || random_part;
    
    RETURN full_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
