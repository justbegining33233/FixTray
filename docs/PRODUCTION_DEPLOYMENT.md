# 🚀 Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (recommended for production)
- Redis (optional, for session storage)
- Domain name and SSL certificate
- Stripe account (for payments)
- SMTP service (for emails)

## 1. Environment Setup

### Copy Environment Template
```bash
cp .env.example .env
```

### Configure Production Environment Variables

#### Required Variables
```env
# Database (PostgreSQL recommended for production)
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT Security (Generate strong secrets)
JWT_SECRET="your-secure-jwt-secret-here"
JWT_EXPIRES_IN="7d"

# Application URLs
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"
```

#### Optional Services
```env
# Stripe Payments
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email Service (Gmail, SendGrid, etc.)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# File Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Socket.IO (for real-time features)
NEXT_PUBLIC_SOCKET_URL="wss://your-socket-server.com"
```

## 2. Database Migration

### For PostgreSQL Production
```bash
# Update schema.prisma datasource
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# Run migrations
npx prisma migrate deploy
npx prisma generate
```

### Seed Initial Data
```bash
# Create admin user
node scripts/create-admin.js

# Create test shops and technicians
node scripts/setup-test-data.js
```

## 3. Build and Deploy

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
# Using Next.js built-in server
npm run start

# Or using custom server with Socket.IO
npm run start:full
```

## 4. Web Server Configuration

### Nginx Configuration (recommended)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO path
    location /api/socket {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. SSL Certificate

### Using Let's Encrypt (free)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (runs twice daily)
sudo systemctl status certbot.timer
```

## 6. Monitoring & Maintenance

### Health Checks
- Visit `https://yourdomain.com/api/health` for system status
- Monitor database connections and response times
- Set up uptime monitoring (UptimeRobot, Pingdom)

### Backups
```bash
# Database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql

# Automated backups with cron
0 2 * * * /path/to/backup-script.sh
```

### Log Management
```bash
# View application logs
tail -f logs/application.log

# Monitor error rates
grep "ERROR" logs/application.log | wc -l
```

## 7. Performance Optimization

### Database Indexing
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_workorders_status ON workorders(status);
CREATE INDEX CONCURRENTLY idx_workorders_shop_id ON workorders(shop_id);
CREATE INDEX CONCURRENTLY idx_workorders_created_at ON workorders(created_at DESC);
```

### Caching Strategy
- Implement Redis for session storage
- Use Next.js ISR for static content
- Cache API responses where appropriate

## 8. Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (256-bit)
- [ ] Enable HTTPS everywhere
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Regular security updates
- [ ] Database backups encrypted
- [ ] Monitor for vulnerabilities

## 9. Scaling Considerations

### Horizontal Scaling
- Use Redis for session storage
- Implement database connection pooling
- Consider CDN for static assets
- Load balancer for multiple app instances

### Database Scaling
- Read replicas for heavy queries
- Database sharding if needed
- Connection pooling (PgBouncer)

## 10. Troubleshooting

### Common Issues

**Build Failures:**
```bash
rm -rf .next node_modules
npm install
npm run build
```

**Database Connection Issues:**
```bash
# Test connection
npx prisma db push --preview-feature
```

**Socket.IO Connection Issues:**
```bash
# Check socket server logs
tail -f logs/socket-server.log
```

## Support

For production deployment assistance, check:
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Prisma Production Guide](https://www.prisma.io/docs/guides/production)
- [Socket.IO Scaling](https://socket.io/docs/v4/scaling/)