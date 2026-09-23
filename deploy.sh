#!/bin/bash
set -e

# ==============================================================================
# Deployment Script for menu.webbea.qa
# Server: 178.128.127.61 (DigitalOcean Droplet)
# Target: /var/www/menu.webbea.qa
# ==============================================================================

DOMAIN="menu.webbea.qa"
TARGET_DIR="/var/www/menu.webbea.qa"
SERVER_IP="178.128.127.61"
EMAIL="admin@webbea.qa"

echo "=========================================="
echo "🚀 Starting Deployment for $DOMAIN"
echo "=========================================="

# Ensure target directory exists
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# 1. Setup production environment file if not already present
if [ ! -f .env ]; then
  echo "📝 Generating secure production .env..."
  JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)
  ENC_KEY=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  WEBHOOK_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40)
  DB_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)

  cat > .env <<EOF
NODE_ENV=production
DOMAIN=$DOMAIN
PORT=4000
POSTGRES_USER=zafran_admin
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=zafran_db
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CLIENT_URL=https://$DOMAIN
CORS_ORIGIN=https://$DOMAIN
PLATFORM_WEBHOOK_SECRET=$WEBHOOK_SECRET
INTEGRATION_ENC_KEY=$ENC_KEY
PUBLIC_URL=https://$DOMAIN
UPLOADS_DIR=/uploads
EOF
  echo "✅ Production .env created."
fi

# 2. Build and start Docker services
echo "🐳 Building and starting Docker containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.prod.yml up -d --build

# Wait for containers to become healthy
echo "⏳ Waiting for services to become healthy..."
sleep 8

# 3. Configure Host Nginx
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
echo "🌐 Configuring Nginx reverse proxy at $NGINX_CONF..."

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 25M;

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4050/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static uploads (menu photos, logo)
    location /uploads/ {
        proxy_pass http://127.0.0.1:4050/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.IO (Live Kitchen Display & Order Tracking)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4050/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Frontend Single Page App
    location / {
        proxy_pass http://127.0.0.1:3050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site in Nginx
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

# Test Nginx syntax
nginx -t

# Reload Nginx to activate HTTP site
systemctl reload nginx

# 4. Obtain and Configure SSL with Let's Encrypt (Certbot)
echo "🔒 Requesting SSL certificate from Let's Encrypt for $DOMAIN..."
if ! certbot certificates | grep -q "$DOMAIN"; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
else
  echo "✅ SSL certificate already exists for $DOMAIN. Ensuring Nginx is updated..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --reinstall || true
fi

# Final reload of Nginx
systemctl reload nginx

echo "=========================================="
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "🌐 URL: https://$DOMAIN"
echo "=========================================="
