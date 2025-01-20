-- Waitlist table
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'converted', 'unsubscribed'
    converted_user_id UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb -- For any additional data we might want to store
); 