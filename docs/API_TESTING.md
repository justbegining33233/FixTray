# API Testing Guide - Work Order System

Use these curl commands or import into Postman/Insomnia for testing.

## Customer Registration & Authentication

### Register Customer
```bash
curl -X POST http://localhost:3000/api/customers/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "555-1234",
    "company": "ABC Trucking"
  }'
```

### Customer Login
```bash
curl -X POST http://localhost:3000/api/customers/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Save the token from response
TOKEN="your-jwt-token-here"
```

### Get Customer Profile
```bash
curl http://localhost:3000/api/customers/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Update Customer Profile
```bash
curl -X PATCH http://localhost:3000/api/customers/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "555-5678"
  }'
```

## Shop Registration & Login

### Create Shop Application
```bash
curl -X POST http://localhost:3000/api/shops-db/pending \
  -H "Content-Type: application/json" \
  -d '{
    "username": "quickfix",
    "password": "shoppass123",
    "shopName": "Quick Fix Auto",
    "email": "shop@quickfix.com",
    "phone": "555-9999",
    "zipCode": "90210",
    "address": "123 Main St",
    "city": "Los Angeles",
    "state": "CA"
  }'
```

### List Pending Shops (Admin)
```bash
curl http://localhost:3000/api/shops-db/pending
```

### Approve Shop (Admin)
```bash
curl -X PATCH http://localhost:3000/api/shops-db/pending \
  -H "Content-Type: application/json" \
  -d '{
    "id": "shop-id-here",
    "action": "approve"
  }'
```

### Shop Login
```bash
curl -X POST http://localhost:3000/api/shops-db/accepted \
  -H "Content-Type: application/json" \
  -d '{
    "username": "quickfix",
    "password": "shoppass123"
  }'

# Save shop token
SHOP_TOKEN="shop-jwt-token-here"
```

### Complete Shop Profile
```bash
curl -X POST http://localhost:3000/api/shops-db/complete-profile \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "shop-id",
    "businessLicense": "BL123456",
    "insurancePolicy": "INS789",
    "shopType": "both",
    "dieselServices": ["Engine Diagnostics", "Brake System", "Oil Change"],
    "gasServices": ["Engine Diagnostics", "Transmission Service", "Oil Change"]
  }'
```

## Work Orders

### Create Work Order
```bash
curl -X POST http://localhost:3000/api/workorders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "shop-id",
    "vehicleType": "semi-truck",
    "serviceLocation": "roadside",
    "issueDescription": "Engine overheating, possible coolant leak",
    "repairs": [
      {
        "type": "engine",
        "description": "Check cooling system"
      }
    ],
    "maintenance": [],
    "partsMaterials": {
      "customerProvided": false,
      "techBringParts": true,
      "notes": "Need coolant and hoses"
    },
    "location": {
      "locationType": "address",
      "address": "I-5 Mile Marker 42",
      "city": "Bakersfield",
      "state": "CA",
      "zipCode": "93301"
    }
  }'
```

### List Work Orders (Paginated & Filtered)
```bash
# Customer's work orders
curl "http://localhost:3000/api/workorders?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "http://localhost:3000/api/workorders?status=pending&page=1" \
  -H "Authorization: Bearer $TOKEN"

# Search
curl "http://localhost:3000/api/workorders?search=engine&page=1" \
  -H "Authorization: Bearer $TOKEN"

# Sort
curl "http://localhost:3000/api/workorders?sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Work Order Details
```bash
curl http://localhost:3000/api/workorders/wo-123 \
  -H "Authorization: Bearer $TOKEN"
```

### Update Work Order (Add Estimate)
```bash
curl -X PUT http://localhost:3000/api/workorders/wo-123 \
  -H "Authorization: Bearer $SHOP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estimate": {
      "amount": 450.00,
      "subtotal": 400.00,
      "tax": 50.00,
      "lineItems": [
        {
          "description": "Engine Diagnostics",
          "quantity": 1,
          "unitPrice": 150.00,
          "total": 150.00
        },
        {
          "description": "Coolant System Repair",
          "quantity": 1,
          "unitPrice": 250.00,
          "total": 250.00
        }
      ]
    },
    "status": "waiting-estimate"
  }'
```

### Update Work Order Status
```bash
curl -X PUT http://localhost:3000/api/workorders/wo-123 \
  -H "Authorization: Bearer $SHOP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-progress",
    "statusReason": "Tech dispatched to location"
  }'
```

### Download Invoice
```bash
curl http://localhost:3000/api/workorders/wo-123/invoice \
  -H "Authorization: Bearer $TOKEN" \
  --output invoice.pdf
```

## Tech Management

### Create Tech
```bash
curl -X POST http://localhost:3000/api/techs \
  -H "Authorization: Bearer $SHOP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tech@quickfix.com",
    "password": "techpass123",
    "firstName": "Mike",
    "lastName": "Johnson",
    "phone": "555-7777",
    "role": "tech"
  }'
```

### List Shop Techs
```bash
curl http://localhost:3000/api/techs \
  -H "Authorization: Bearer $SHOP_TOKEN"
```

### Assign Tech to Work Order
```bash
curl -X POST http://localhost:3000/api/techs/assign \
  -H "Authorization: Bearer $SHOP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workOrderId": "wo-123",
    "techId": "tech-id"
  }'
```

## File Upload

### Upload Photo
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/photo.jpg" \
  -F "folder=work-orders"

# Returns: { "url": "https://cloudinary.com/...", "publicId": "..." }
```

## Payment

### Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/payment/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workOrderId": "wo-123"
  }'

# Returns: { "clientSecret": "pi_...", "amount": 450.00 }
# Use clientSecret with Stripe Elements on frontend
```

## Notifications

### Get Notifications
```bash
curl http://localhost:3000/api/notifications-db \
  -H "Authorization: Bearer $TOKEN"
```

### Mark Notification as Read
```bash
curl -X PATCH "http://localhost:3000/api/notifications-db?id=notif-123" \
  -H "Authorization: Bearer $TOKEN"
```

### Mark All as Read
```bash
curl -X PATCH "http://localhost:3000/api/notifications-db?action=markAllRead" \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Notification
```bash
curl -X DELETE "http://localhost:3000/api/notifications-db?id=notif-123" \
  -H "Authorization: Bearer $TOKEN"
```

## Admin Operations

### List All Shops
```bash
curl http://localhost:3000/api/shops-db/accepted
```

### Get Shop Profile
```bash
curl "http://localhost:3000/api/shops-db/complete-profile?shopId=shop-123"
```

## Testing Stripe Webhook Locally

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/payment/webhook

# Test payment
stripe trigger payment_intent.succeeded
```

## Environment Variables for Testing

```bash
# Set these in your .env file for testing

# Use Stripe test keys (start with sk_test_ and pk_test_)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Use Cloudinary test account
CLOUDINARY_CLOUD_NAME="test-cloud"

# Use Gmail app password or testing service like Ethereal Email
# https://ethereal.email for fake SMTP testing
EMAIL_HOST="smtp.ethereal.email"
EMAIL_USER="your-test@ethereal.email"
EMAIL_PASSWORD="test-password"
```

## Response Examples

### Successful Registration
```json
{
  "id": "cuid123",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Login Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "customer"
  }
}
```

### Work Orders Response
```json
{
  "workOrders": [
    {
      "id": "wo-123",
      "vehicleType": "semi-truck",
      "status": "pending",
      "issueDescription": "Engine overheating",
      "customer": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "shop": {
        "shopName": "Quick Fix Auto"
      },
      "createdAt": "2025-12-23T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

### Error Response
```json
{
  "error": "Unauthorized"
}
```

## Postman Collection

Import this JSON into Postman for a complete testing collection:

```json
{
  "info": {
    "name": "Work Order System API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "type": "string"
    },
    {
      "key": "token",
      "value": "",
      "type": "string"
    }
  ]
}
```

Save JWT tokens as environment variables in Postman for easier testing.
