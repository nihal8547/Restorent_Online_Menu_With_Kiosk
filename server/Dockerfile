FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install dependencies first for efficient layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm cache clean --force
RUN npx prisma generate

# Copy application source
COPY . .

# Ensure uploads directory exists
RUN mkdir -p /uploads

ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOADS_DIR=/uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
