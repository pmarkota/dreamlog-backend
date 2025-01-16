-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_premium BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- Dreams table
CREATE TABLE dreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT NOT NULL,
    dream_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_lucid BOOLEAN DEFAULT FALSE,
    clarity_level INTEGER CHECK (clarity_level BETWEEN 1 AND 5),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    dream_type VARCHAR(50)
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dream Tags junction table
CREATE TABLE dream_tags (
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (dream_id, tag_id)
);

-- Moods table
CREATE TABLE moods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dream Moods junction table
CREATE TABLE dream_moods (
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE,
    mood_id UUID REFERENCES moods(id) ON DELETE CASCADE,
    intensity INTEGER CHECK (intensity BETWEEN 1 AND 5),
    PRIMARY KEY (dream_id, mood_id)
);

-- Sleep Data table
CREATE TABLE sleep_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sleep_start TIMESTAMP WITH TIME ZONE,
    sleep_end TIMESTAMP WITH TIME ZONE,
    total_duration INTEGER, -- in minutes
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    data_source VARCHAR(50), -- e.g., 'fitbit', 'manual', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lucid Dream Challenges table
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    points INTEGER DEFAULT 0,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Challenges junction table
CREATE TABLE user_challenges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'in_progress', -- 'completed', 'in_progress', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, challenge_id)
);

-- Reality Check Reminders table
CREATE TABLE reality_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reminder_time TIME,
    is_active BOOLEAN DEFAULT TRUE,
    days_of_week INTEGER[], -- Array of days (1-7) when reminder should be active
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at triggers for relevant tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dreams_updated_at
    BEFORE UPDATE ON dreams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 


-- Dream Analysis table to store AI interpretations
CREATE TABLE dream_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- 'basic' or 'premium'
    themes TEXT[], -- Array of identified themes
    interpretation TEXT, -- AI interpretation
    symbols_detected TEXT[], -- Array of detected symbols
    sentiment_score FLOAT, -- Overall sentiment (-1 to 1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily Dream Prompts table
CREATE TABLE dream_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_text TEXT NOT NULL,
    category VARCHAR(50),
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active_date DATE UNIQUE -- Ensures one prompt per day
);

-- Add is_premium field to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Create index for faster dream analysis queries
CREATE INDEX IF NOT EXISTS idx_dream_analysis_dream_id ON dream_analysis(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_prompts_active_date ON dream_prompts(active_date);

-- Run these SQL commands in your Supabase SQL editor
ALTER TABLE dream_analysis 
ADD COLUMN IF NOT EXISTS personal_growth_insights TEXT,
ADD COLUMN IF NOT EXISTS lucid_dreaming_tips TEXT,
ADD COLUMN IF NOT EXISTS recurring_patterns TEXT,
ADD COLUMN IF NOT EXISTS psychological_analysis TEXT;