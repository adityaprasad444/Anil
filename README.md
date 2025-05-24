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

3. Create a `.env` file in the root directory with the following content:
```
MONGODB_URI=mongodb://localhost:27017/tracking
PORT=3001
SESSION_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=development
```

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