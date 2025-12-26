require('dotenv').config();

module.exports = {
  // MongoDB configuration
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tracking',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  },

  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    environment: process.env.NODE_ENV || 'development'
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  },

  // Default admin credentials (should be changed after first login)
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123' // Change this in production!
  },

  // Default provider configuration
  defaultProviders: [
    {
      name: 'DTDC',
      trackingUrl: 'https://www.dtdc.in/tracking/tracking_results.asp?TranType=awbquery',
      apiConfig: {
        endpoint: 'https://dtdc.in/olp_api/trk_order_details',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        requestBodyTemplate: 'strCnno={trackingId}&strCanNo=&strAction=awbquery'
      }
    },
    {
      name: 'ICL Domestic',
      trackingUrl: 'https://www.iclexpress.in/tracking',
      apiConfig: {
        endpoint: 'https://eztrackwebapi159.softpal.in/V1/TrackingApiCommon_Softpal?ShipmentNo={trackingId}&HostId=3',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        requestBodyTemplate: ''
      }
    },
    {
      name: 'ICL International',
      trackingUrl: 'https://cloud.iclinternational.in/api/v1/Tracking/Tracking',
      apiConfig: {
        endpoint: 'https://cloud.iclinternational.in/api/v1/Tracking/Tracking',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        requestBodyTemplate: '{"UserID": "api", "Password": "api@98765", "AWBNo": "{trackingId}", "ShowAllFields": "Yes", "RequiredUrl": "Yes"}'
      }
    },
    {
      name: 'XpressBees',
      trackingUrl: 'https://www.xpressbees.com/shipment/tracking?awbNo={trackingId}',
      apiConfig: {
        endpoint: 'https://www.xpressbees.com/api/tracking/{trackingId}',
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'referer': 'https://www.xpressbees.com/shipment/tracking?awbNo={trackingId}',
          'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        },
        requestBodyTemplate: ''
      }
    }
  ]
};
