-- Enable required PostgreSQL extensions for Ride Deliva platform

-- PostGIS extension for geospatial data and operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- PostGIS topology extension for advanced spatial relationships
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- UUID generation extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fuzzy string matching extension for search functionality
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Full text search extension for content search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Verify extensions are installed
SELECT name, installed_version 
FROM pg_available_extensions 
WHERE name IN (
    'postgis', 
    'postgis_topology', 
    'uuid-ossp', 
    'pgcrypto', 
    'fuzzystrmatch', 
    'unaccent'
)
AND installed_version IS NOT NULL;
