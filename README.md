# DreamLog Backend

Backend service for DreamLog - Your Dream Journal and Lucid Dreaming Assistant.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Then edit `.env` with your Supabase credentials and other configuration.

3. Set up Supabase:

- Create a new Supabase project
- Run the SQL queries from `supabase_schema.sql` in your Supabase SQL editor
- Copy your project URL and keys to the `.env` file

## Development

Start the development server:

```bash
npm run dev
```

The server will run on `http://localhost:5000` by default.

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers (will be implemented)
│   ├── middleware/     # Custom middleware (will be implemented)
│   ├── routes/         # API routes (will be implemented)
│   ├── services/       # Business logic (will be implemented)
│   └── index.js        # App entry point
├── .env.example        # Example environment variables
├── .gitignore         # Git ignore rules
├── package.json       # Project dependencies and scripts
└── supabase_schema.sql # Database schema
```

## API Endpoints (To Be Implemented)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/dreams` - Get user's dreams
- `POST /api/dreams` - Create new dream
- `GET /api/tags` - Get available tags
- `GET /api/moods` - Get available moods
- `GET /api/challenges` - Get lucid dreaming challenges

## Technologies Used

- Node.js
- Express.js
- Supabase (PostgreSQL)
- JSON Web Tokens (JWT)
- Express Validator
- Helmet (Security)
