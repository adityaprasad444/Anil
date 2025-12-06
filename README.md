# 📦 Package Tracking Application

A modern, full-featured web application for tracking packages across multiple carriers. This system provides a seamless experience for customers to track their shipments and a powerful dashboard for administrators to manage tracking IDs and providers.

## ✨ Key Features

### 👤 Customer Features
*   **Real-time Tracking**: Instant updates on package location and status.
*   **Visual Timeline**: A clean, modern timeline view of the shipment's journey.
*   **Multi-Carrier Support**: Track packages from various providers in one place.
*   **Responsive Design**: optimized for desktop, tablet, and mobile devices.
*   **Contact Support**: Easy access to support via Phone and WhatsApp.

### 🛡️ Admin Features
*   **Secure Dashboard**: Protected admin area (`/admin`) for managing the system.
*   **Tracking Management**:
    *   Generate custom tracking IDs (Format: `ak{random}lg`).
    *   View detailed lists of all active shipments.
    *   Manually update package statuses or delete entries.
    *   **Bulk Refresh**: Automatically update all tracking data from external APIs.
*   **Provider Configuration**:
    *   Add, edit, or remove tracking providers via the GUI (`/config`).
    *   Configure API endpoints and request structures for automated fetching.
*   **Data Visualization**: At-a-glance metrics (though primarily list-based currently).

## 🛠️ Technology Stack

*   **Backend**: Node.js, Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Frontend**: HTML5, CSS3 (Modern Variables & Flexbox/Grid), Vanilla JavaScript
*   **Security**: Helmet, CORS, bcrypt (password hashing), Session-based Auth
*   **Scheduling**: node-cron for background data updates

## 📋 Prerequisites

*   Node.js (v14 or higher)
*   MongoDB (cloud or local instance)
*   NPM (Node Package Manager)

## 🚀 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/adityaprasad444/Anil.git
    cd Tracking
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and add the following:
    ```env
    # Server Configuration
    PORT=3001
    NODE_ENV=development

    # Database
    MONGODB_URI=your_mongodb_connection_string

    # Security
    SESSION_SECRET=your_complex_session_secret
    
    # Optional
    CORS_ORIGIN=http://localhost:3001
    ```

4.  **Start the Server**
    *   For production:
        ```bash
        npm start
        ```
    *   For development (auto-reload):
        ```bash
        npm run dev
        ```

5.  **Access the Application**
    *   Public Home: `http://localhost:3001`
    *   Admin Login: `http://localhost:3001/login`

## 📖 Usage Guide

### Logging In as Admin
*   **URL**: `/login`
*   **Default Credentials**:
    *   Username: `admin`
    *   Password: `admin123` (Note: It is recommended to change this in production)

### Managing Tracking IDs
1.  Navigate to the **Dashboard**.
2.  Use the **"Generate New Tracking"** form.
3.  Select a **Provider** (e.g., FedEx, Bluedart).
4.  Enter the **Original Tracking ID** provided by the carrier.
5.  Click **"Generate ID"** to create a system-internal ID (e.g., `ak123456lg`).

### Configuring Providers
1.  Navigate to **Configuration** (`/config`).
2.  **Add Provider**: Enter the Provider Name and their public Tracking URL.
    *   Use `{trackingId}` as a placeholder in the URL (e.g., `https://example.com/track?id={trackingId}`).
3.  **API Integration** (Optional):
    *   Expand "API Configuration" to set up automated status fetching.
    *   Define Endpoint, Method (GET/POST), Headers, and Request Body.

## 📡 API Endpoints

| Method | Endpoint | Description | Auth Required |
|s :--- | :--- | :--- | :--- |
| **POST** | `/api/login` | Admin login | No |
| **GET** | `/api/tracking/:id` | Get public tracking info | No |
| **GET** | `/api/tracking/list` | List all tracking entries | Yes |
| **POST** | `/api/tracking/generate`| Create new tracking ID | Yes |
| **PUT** | `/api/tracking/:id/status`| Update status manually | Yes |
| **GET** | `/api/providers` | Get all providers | Yes |
| **POST** | `/api/providers` | Add new provider | Yes |

## 📂 Project Structure

```
Tracking/
├── models/              # Mongoose Data Models (User, Provider, TrackingData)
├── public/              # Static Frontend Files
│   ├── index.html       # Landing Page
│   ├── tracking.html    # Tracking Results Page
│   ├── admin.html       # Admin Dashboard
│   ├── config.html      # Provider Config Page
│   ├── login.html       # Login Page
│   └── Logos/           # Images/Assets
├── scripts/             # Data migration and utility scripts
├── services/            # Business Logic (trackingService.js)
├── tracker-app.js       # Main Application Entry Point
└── package.json         # Dependencies and Scripts
```

## 📞 Support & Contact

**Anil Kumar**
*   📍 **Address**: Beside BIG C, Ring Road, Ravulapalem-533238
*   📞 **Phone**: [+91 9912642444](tel:+919912642444)
*   💬 **WhatsApp**: [+91 9182228692](https://wa.me/919182228692)

---
*Built for fast, reliable, and modern package tracking.*