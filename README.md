# Package Tracking Application

A web application for tracking packages across multiple carriers.

## Features

- Public tracking page for customers
- Admin dashboard for generating tracking IDs
- Support for multiple carriers (Bluedart, ICL, FedEx, DHL)
- Secure authentication system
- MongoDB database integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tracking-app
```

2. Install dependencies:
```bash
npm install
```

3. Environment Setup:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration:
     ```
     MONGODB_URI=your_mongodb_connection_string
     PORT=3001
     SESSION_SECRET=your_secret_key
     NODE_ENV=development
     CORS_ORIGIN=http://localhost:3001
     ```
   - For production deployment, set these environment variables in your hosting platform

4. Create the admin user:
```bash
node create-admin.js
```

## Running the Application

1. Start MongoDB:
```bash
mongod
```

2. Start the application:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

## Deployment

When deploying to production:

1. Set up environment variables in your hosting platform:
   - MONGODB_URI: Your production MongoDB connection string
   - SESSION_SECRET: A strong, unique secret key
   - NODE_ENV: Set to 'production'
   - CORS_ORIGIN: Your production domain
   - PORT: Your desired port (if not using platform default)

2. Common hosting platforms:
   - Heroku: Use `heroku config:set` command
   - AWS: Use Elastic Beanstalk environment variables
   - DigitalOcean: Use App Platform environment variables
   - VPS: Set in system environment or process manager

## Usage

### Public Tracking
- Visit `http://localhost:3001`
- Enter a tracking ID to view package status

### Admin Access
- Visit `http://localhost:3001/login`
- Login with the following credentials:
  - Username: `admin`
  - Password: `admin123`
- Generate new tracking IDs in the admin dashboard

## API Endpoints

### Authentication
- `POST /api/login` - Login
- `POST /api/logout` - Logout

### Tracking
- `GET /api/tracking/:trackingId` - Get tracking information
- `POST /api/tracking/generate` - Generate new tracking ID (admin only)

## Security

- Passwords are hashed using bcrypt
- Session-based authentication
- CORS protection
- Helmet security headers
- Environment variable configuration

## Development

The application uses:
- Express.js for the backend
- MongoDB with Mongoose for the database
- Session-based authentication
- Modern ES6+ JavaScript

## License

MIT 