# 📦 AK Logistics - Package Tracking & Shipping Label Application

A modern, full-featured web application for tracking packages across multiple carriers and generating official A4 shipping labels. This system provides a seamless experience for customers to track their shipments and a powerful suite of tools for administrators to manage tracking IDs, courier providers, and shipping labels.

## ✨ Key Features

### 👤 Customer Features
*   **Real-time Tracking**: Instant updates on package location and delivery status.
*   **Visual Timeline**: A clean, modern timeline view of the shipment's journey.
*   **Multi-Carrier Support**: Track packages from various providers (FedEx, BlueDart, DTDC, Delhivery, Speed Post, etc.) in one place.
*   **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices.
*   **Direct Contact & WhatsApp**: Easy access to support via Phone and WhatsApp.

### 🛡️ Admin & Logistics Features
*   **Secure Dashboard**: Protected admin area (`/admin`) for full shipment management.
*   **Tracking Management**:
    *   Generate custom tracking IDs (Format: `ak{random}lg`).
    *   View detailed lists of all active shipments with search and filters.
    *   Manually update package statuses or delete entries.
    *   **Bulk Refresh**: Automatically update all tracking data from external APIs.
*   **🏷️ Official A4 Shipping Label Generator (`/labels`)**:
    *   **3-Step Guided Wizard**:
        *   **Step 1 (Sender)**: Select known sender or type custom name, phone, address, pincode, and state.
        *   **Step 2 (Recipient & Item)**: Enter recipient details with pincode auto-city lookup, item description, and actual item cost (₹).
        *   **Step 3 (Courier & Preview)**: Select courier provider, choose automated or custom manual tracking ID, and view real-time label preview.
    *   **Automated Pincode Lookup**: Automatically fetches city and state from 6-digit Indian pincodes.
    *   **Official A4 Label Template**: Features official logo (`/Logos/logo.jpeg`), 2-column Sender/Recipient address grid, and shipment item table (`Item Description` | `Weight (kg)` | `Value (₹)`).
    *   **Code128 Barcode & Website QR Code**: System-generated Code128 barcode image for tracking number and base64 QR Code for website URL (`https://aklogistics.org`).
    *   **2-Up Vertical A4 Printing**: Formatted for 2 pages per sheet printer settings, fitting two labels on a single A4 portrait page cleanly.
    *   **Instant PDF Export**: High-resolution client-side PDF downloads via `html2pdf.js`.
    *   **Generated Labels Repository**: View, print, download, or delete past generated labels with full history tracking.
*   **Provider Configuration (`/config`)**:
    *   Add, edit, or remove tracking providers via GUI.
    *   Configure API endpoints and request structures for automated data updates.
*   **🔄 Dynamic Home Page Contact Synchronization**:
    *   Centralized contact service (`contactService.js`) dynamically extracts contact info directly from the Home Page (`index.html`).

## 🛠️ Technology Stack

*   **Backend**: Node.js, Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Frontend**: HTML5, CSS3 (Vanilla CSS with custom properties & glassmorphism), Vanilla JavaScript
*   **Barcode & QR Generation**: `JsBarcode`, `qrcode-generator`
*   **PDF Generation**: `html2pdf.js`
*   **Security**: Helmet, CORS, bcrypt (password hashing), Session-based Auth
*   **Scheduling**: `node-cron` for background tracking status updates

## 📋 Prerequisites

*   Node.js (v14 or higher)
*   MongoDB (cloud Atlas or local instance)
*   NPM (Node Package Manager)

## 🚀 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/adityaprasad444/Anil.git
    cd Anil
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory:
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
    *   Public Home Page: `http://localhost:3001`
    *   Admin Dashboard: `http://localhost:3001/admin`
    *   Label Generator: `http://localhost:3001/labels`
    *   Provider Config: `http://localhost:3001/config`

## 📖 Usage Guide

### Generating Shipping Labels
1. Navigate to **Label Generator** (`/labels`).
2. **Step 1**: Enter Sender details (or select a saved sender chip).
3. **Step 2**: Enter Recipient details (pincode auto-populates city/state), item description, and cost value.
4. **Step 3**: Select Courier Provider and choose Automated or Manual Tracking ID mode.
5. Review the **Live Shipping Label Preview**.
6. Click **Confirm & Generate Label PDF** to automatically save to MongoDB, generate the PDF, and open the Generated Labels management tab.

## 📡 API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/login` | Admin login | No |
| **GET** | `/api/contact-info` | Get dynamic Contact Us info | No |
| **GET** | `/api/tracking/:id` | Get public tracking info | No |
| **GET** | `/api/tracking/list` | List all tracking entries | Yes |
| **POST** | `/api/tracking/generate`| Create new tracking ID | Yes |
| **PUT** | `/api/tracking/:id/status`| Update status manually | Yes |
| **GET** | `/api/label-templates` | List label templates | Yes |
| **POST** | `/api/label/generate` | Generate shipping label HTML | Yes |
| **GET** | `/api/generated-labels` | List saved generated labels | Yes |
| **POST** | `/api/generated-labels` | Save new generated label | Yes |

## 📂 Project Structure

```
Anil/
├── models/              # Mongoose Data Models (User, Provider, TrackingData, LabelTemplate, GeneratedLabel)
├── public/              # Static Frontend Files
│   ├── index.html       # Landing Page & Contact Us
│   ├── tracking.html    # Customer Tracking Results Page
│   ├── admin.html       # Admin Dashboard
│   ├── labels.html      # 3-Step Shipping Label Generator & Repository
│   ├── config.html      # Provider Config Page
│   ├── login.html       # Admin Login Page
│   └── Logos/           # Brand Assets (logo.jpeg)
├── scripts/             # Migration and utility scripts
├── services/            # Business Logic (trackingService.js, labelService.js, contactService.js, barcodeService.js)
├── tracker-app.js       # Main Application Entry Point
└── package.json         # Dependencies and Scripts
```

## 📞 Support & Contact

**AK Logistics**
*   📍 **Address**: Near BIG C, Beside Madhuri Readymades, Ring Road, Ravulapalem-533238
*   📞 **Phone**: [+91 9182228692](tel:+919182228692)
*   💬 **WhatsApp**: [+91 9182228692](https://wa.me/919182228692)
*   📧 **Support Email**: [aklogisticsravulapalem@gmail.com](mailto:aklogisticsravulapalem@gmail.com)
*   🌐 **Website**: [aklogistics.org](https://aklogistics.org)

---
*Built for fast, reliable, and modern package tracking & shipping label management.*