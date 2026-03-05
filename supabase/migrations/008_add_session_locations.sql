ALTER TABLE sessions ADD COLUMN user_locations JSONB DEFAULT '{}';
-- Format: { "user_id": { "lat": 0, "lng": 0, "timestamp": "" } }