# Ride Deliva API Reference

## Base Information

- **Base URL**: `https://api.ridedeliva.com/api/v1`
- **Authentication**: Bearer Token (JWT)
- **Content-Type**: `application/json`
- **API Version**: v1

## Authentication

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "phone": "+2348012345678",
  "firstName": "John",
  "lastName": "Doe",
  "userType": "customer" // or "driver"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. OTP sent to phone number.",
  "data": {
    "user": {
      "id": "uuid",
      "phone": "+2348012345678",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "customer",
      "status": "pending"
    }
  }
}
```

### Verify OTP
```http
POST /auth/verify-otp
```

**Request Body:**
```json
{
  "phone": "+2348012345678",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully.",
  "data": {
    "user": {
      "id": "uuid",
      "phone": "+2348012345678",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "customer",
      "status": "active"
    },
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  }
}
```

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "phone": "+2348012345678",
  "password": "password123"
}
```

### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

### Logout
```http
POST /auth/logout
```
**Headers:** `Authorization: Bearer {token}`

## User Management

### Get Current User
```http
GET /users/me
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phone": "+2348012345678",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "customer",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Update User Profile
```http
PUT /users/me
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "profileImage": "base64-image-string"
}
```

### Upload Profile Image
```http
POST /users/me/avatar
```
**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Form Data:**
- `avatar`: File (image)

## Driver Management

### Get Driver Profile
```http
GET /drivers/me/profile
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "licenseNumber": "ABC123456",
      "vehicleType": "sedan",
      "vehicleModel": "Toyota Corolla",
      "vehicleYear": 2020,
      "plateNumber": "LAG 123 XY",
      "verificationStatus": "approved",
      "rating": 4.8,
      "totalTrips": 150,
      "documents": {
        "license": "url",
        "insurance": "url",
        "vehicle": "url"
      }
    }
  }
}
```

### Update Driver Profile
```http
PUT /drivers/me/profile
```
**Headers:** `Authorization: Bearer {token}`

### Upload Driver Documents
```http
POST /drivers/me/documents
```
**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Form Data:**
- `documentType`: string (license, insurance, vehicle)
- `document`: File

### Update Driver Location
```http
POST /drivers/me/location
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "latitude": 6.5244,
  "longitude": 3.3792,
  "heading": 45.5,
  "speed": 30.0
}
```

### Set Driver Availability
```http
POST /drivers/me/availability
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "available": true
}
```

## Order Management

### Create Ride Order
```http
POST /orders/rides
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "pickupLocation": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "address": "Victoria Island, Lagos"
  },
  "destinationLocation": {
    "latitude": 6.4281,
    "longitude": 3.4219,
    "address": "Lekki Phase 1, Lagos"
  },
  "vehicleType": "economy", // economy, comfort, premium, xl
  "scheduledTime": "2024-01-01T12:00:00Z", // optional
  "notes": "Please wait at the main gate" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "customerId": "uuid",
      "orderType": "ride",
      "status": "pending",
      "pickupLocation": {
        "latitude": 6.5244,
        "longitude": 3.3792,
        "address": "Victoria Island, Lagos"
      },
      "destinationLocation": {
        "latitude": 6.4281,
        "longitude": 3.4219,
        "address": "Lekki Phase 1, Lagos"
      },
      "vehicleType": "economy",
      "estimatedFare": 2500.00,
      "estimatedDistance": 5.2,
      "estimatedDuration": 12,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Get Order Details
```http
GET /orders/:orderId
```
**Headers:** `Authorization: Bearer {token}`

### Get User Orders
```http
GET /orders/me?type=ride&status=completed&page=1&limit=10
```
**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `type`: ride, delivery, food, shopping
- `status`: pending, accepted, in_progress, completed, cancelled
- `page`: pagination page (default: 1)
- `limit`: items per page (default: 10)

### Cancel Order
```http
POST /orders/:orderId/cancel
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

### Rate Order
```http
POST /orders/:orderId/rating
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Great service!",
  "tips": 500.00 // optional
}
```

## Driver Order Management

### Get Available Orders
```http
GET /drivers/orders/available?lat=6.5244&lng=3.3792&radius=5
```
**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `lat`: driver latitude
- `lng`: driver longitude
- `radius`: search radius in km

### Accept Order
```http
POST /drivers/orders/:orderId/accept
```
**Headers:** `Authorization: Bearer {token}`

### Update Order Status
```http
POST /drivers/orders/:orderId/status
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "status": "driver_arrived", // driver_arrived, in_progress, completed
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}
```

### Get Driver Active Orders
```http
GET /drivers/orders/active
```
**Headers:** `Authorization: Bearer {token}`

## Payment Management

### Get Wallet Balance
```http
GET /payments/wallet/balance
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 25450.00,
    "currency": "NGN",
    "lastUpdated": "2024-01-01T00:00:00Z"
  }
}
```

### Add Funds to Wallet
```http
POST /payments/wallet/topup
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "amount": 5000.00,
  "paymentMethod": "card", // card, bank_transfer, ussd
  "reference": "payment-reference"
}
```

### Get Transaction History
```http
GET /payments/transactions?page=1&limit=20&type=all
```
**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page`: pagination page
- `limit`: items per page
- `type`: all, credit, debit

### Process Payment
```http
POST /payments/process
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "orderId": "uuid",
  "amount": 2500.00,
  "paymentMethod": "wallet", // wallet, card
  "cardDetails": { // if paymentMethod is card
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123"
  }
}
```

## Notification Management

### Get Notifications
```http
GET /notifications?page=1&limit=20&unread_only=false
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "Ride Completed",
        "message": "Your ride to Lekki has been completed",
        "type": "ride_update",
        "isRead": false,
        "createdAt": "2024-01-01T00:00:00Z",
        "data": {
          "orderId": "uuid"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### Mark Notification as Read
```http
PUT /notifications/:notificationId/read
```
**Headers:** `Authorization: Bearer {token}`

### Mark All Notifications as Read
```http
PUT /notifications/read-all
```
**Headers:** `Authorization: Bearer {token}`

### Update Push Token
```http
POST /notifications/push-token
```
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "token": "fcm-push-token",
  "platform": "android" // android, ios
}
```

## Location Services

### Geocode Address
```http
GET /location/geocode?address=Victoria Island, Lagos
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "address": "Victoria Island, Lagos State, Nigeria",
        "latitude": 6.4281,
        "longitude": 3.4219,
        "placeId": "google-place-id"
      }
    ]
  }
}
```

### Reverse Geocode
```http
GET /location/reverse?lat=6.4281&lng=3.4219
```
**Headers:** `Authorization: Bearer {token}`

### Get Route
```http
GET /location/route?origin=6.5244,3.3792&destination=6.4281,3.4219&mode=driving
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "distance": 5.2,
      "duration": 12,
      "polyline": "encoded-polyline-string",
      "steps": []
    }
  }
}
```

### Search Places
```http
GET /location/places?query=restaurant&lat=6.5244&lng=3.3792&radius=1000
```
**Headers:** `Authorization: Bearer {token}`

## Admin Endpoints

### Get System Stats
```http
GET /admin/stats
```
**Headers:** `Authorization: Bearer {admin-token}`

### Get All Users
```http
GET /admin/users?page=1&limit=50&type=all&status=all
```
**Headers:** `Authorization: Bearer {admin-token}`

### Verify Driver
```http
POST /admin/drivers/:driverId/verify
```
**Headers:** `Authorization: Bearer {admin-token}`

**Request Body:**
```json
{
  "status": "approved", // approved, rejected
  "notes": "All documents verified"
}
```

### Get Platform Analytics
```http
GET /admin/analytics?period=7d&metrics=rides,revenue,users
```
**Headers:** `Authorization: Bearer {admin-token}`

## WebSocket Events

### Connection
```javascript
// Connect to WebSocket
const socket = io('ws://api.ridedeliva.com', {
  auth: {
    token: 'jwt-access-token'
  }
});
```

### Customer Events

#### Listen for ride updates
```javascript
socket.on('ride:status_changed', (data) => {
  console.log('Ride status:', data.status);
  console.log('Order ID:', data.orderId);
});

socket.on('ride:driver_assigned', (data) => {
  console.log('Driver assigned:', data.driver);
  console.log('ETA:', data.eta);
});

socket.on('ride:driver_location', (data) => {
  console.log('Driver location:', data.location);
});
```

#### Emit customer location
```javascript
socket.emit('customer:location_update', {
  orderId: 'order-uuid',
  location: {
    latitude: 6.5244,
    longitude: 3.3792
  }
});
```

### Driver Events

#### Listen for new ride requests
```javascript
socket.on('ride:new_request', (data) => {
  console.log('New ride request:', data.order);
});

socket.on('ride:customer_location', (data) => {
  console.log('Customer location:', data.location);
});
```

#### Emit driver location updates
```javascript
socket.emit('driver:location_update', {
  location: {
    latitude: 6.5244,
    longitude: 3.3792,
    heading: 45.5,
    speed: 30.0
  }
});
```

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error information"
  }
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `429`: Too Many Requests
- `500`: Internal Server Error

### Common Error Codes
- `INVALID_CREDENTIALS`: Login failed
- `TOKEN_EXPIRED`: JWT token expired
- `VALIDATION_ERROR`: Input validation failed
- `USER_NOT_FOUND`: User doesn't exist
- `ORDER_NOT_FOUND`: Order doesn't exist
- `INSUFFICIENT_FUNDS`: Wallet balance too low
- `DRIVER_UNAVAILABLE`: No drivers available
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limiting

### Default Limits
- **Authentication endpoints**: 5 requests per minute
- **General API**: 100 requests per minute
- **Location updates**: 60 requests per minute
- **File uploads**: 10 requests per minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

### Request Parameters
```http
GET /endpoint?page=1&limit=20&sort=createdAt&order=desc
```

### Response Format
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## SDKs and Code Examples

### JavaScript/TypeScript
```javascript
// Initialize client
const api = new RideDelivaAPI({
  baseURL: 'https://api.ridedeliva.com/api/v1',
  timeout: 10000
});

// Authenticate
await api.auth.login('+2348012345678', 'password');

// Create ride
const ride = await api.rides.create({
  pickupLocation: { lat: 6.5244, lng: 3.3792 },
  destinationLocation: { lat: 6.4281, lng: 3.4219 },
  vehicleType: 'economy'
});
```

### Flutter/Dart
```dart
// Initialize client
final api = RideDelivaAPI(
  baseUrl: 'https://api.ridedeliva.com/api/v1',
);

// Authenticate
final authResult = await api.auth.login(
  phone: '+2348012345678',
  password: 'password',
);

// Create ride
final ride = await api.rides.create(
  CreateRideRequest(
    pickupLocation: Location(lat: 6.5244, lng: 3.3792),
    destinationLocation: Location(lat: 6.4281, lng: 3.4219),
    vehicleType: VehicleType.economy,
  ),
);
```