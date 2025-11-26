# EventPulse

**EventPulse** — a real-time event router & webhook dispatcher built with Express + TypeScript.

Accepts events, persists them (Postgres + Prisma), pushes to Redis Streams, and reliably delivers webhooks using a dedicated dispatcher worker with HMAC-signed payloads and a retry/DLQ pipeline.

## Features

- **Event Ingestion API** (`/send-event`) with Zod validation
- **Webhook Registration** (`/register-webhook`) with automatic API key generation
- **Persistent Storage** - Events and delivery attempts stored in PostgreSQL (Prisma ORM)
- **Redis Streams** - Durable, high-throughput event delivery using XADD + XREADGROUP
- **Worker Service** - Signs payloads (HMAC SHA256) and delivers using Axios
- **Retry Pipeline** - BullMQ-powered retry mechanism with Dead Letter Queue (DLQ)
- **Prometheus Metrics** - Built-in metrics endpoint for monitoring
- **API Key Authentication** - Secure access control for protected endpoints

## Architecture

```
+--------------------+         XADD         +--------------------+    XREADGROUP    +--------------------+
|                    |  POST /send-event    |  API Gateway       |  --------------> | Dispatcher Worker  |
|   Client / App     | -------------------> |  (Express + TS)    |                  |  (streamWorker)    |
|                    |                      |  - validate        |                  |  - XREADGROUP      |
+--------------------+                      |  - store event DB  |                  |  - signPayload     |
                                            |  - XADD -> Redis   |                  |  - deliver (axios) |
                                            +--------------------+                  |  - log attempt     |
                                                                                   |  - on fail -> add  |
                                                                                   |    BullMQ job      |
                                                                                   +--------------------+
                                                                                             |
                                                                                             v
                                                                                   +--------------------+
                                                                                   |   BullMQ (Redis)   |
                                                                                   |   queue: delivery- |
                                                                                   |   retries          |
                                                                                   +--------------------+
                                                                                             |
                                                                                             v
                                                                                   +--------------------+
                                                                                   | Retry Worker       |
                                                                                   | (retryProcessor)   |
                                                                                   | - execute retry    |
                                                                                   | - log attempt      |
                                                                                   | - move to DLQ      |
                                                                                   +--------------------+
                                                                                             |
                                                                                             v
                                                                                   +--------------------+
                                                                                   | PostgreSQL (Prisma)|
                                                                                   | - Event            |
                                                                                   | - Webhook          |
                                                                                   | - DeliveryAttempt  |
                                                                                   | - DLQEntry         |
                                                                                   +--------------------+
```

## Quickstart (Local)

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose

### 1. Start Infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
cd infrastructure
docker compose up -d
```

This will start:

- PostgreSQL on port `5432`
- Redis on port `6379`

### 2. Setup Database

Run Prisma migrations to set up the database schema:

```bash
# From project root
npx prisma migrate dev
npx prisma generate
```

### 3. Start API Gateway

```bash
cd api-gateway
npm install
npm run dev
```

The API Gateway will start on `http://localhost:3000` (default).

### 4. Start Dispatcher Worker

In a separate terminal:

```bash
cd dispatcher-worker
npm install
npm run dev
```

The dispatcher worker will start on `http://localhost:4000` (default).

### 5. Test the System

Register a webhook and send an event (use [webhook.site](https://webhook.site) to inspect deliveries):

```bash
# Register a webhook
curl -X POST http://localhost:3000/register-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/<your-unique-id>"
  }'

# Response will include an apiKey - save it for the next step
# Example response:
# {
#   "ok": true,
#   "webhook": { ... },
#   "apiKey": "ep_live_..."
# }

# Send an event (use the returned apiKey)
curl -X POST http://localhost:3000/send-event \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key>" \
  -d '{
    "type": "order.created",
    "payload": {
      "orderId": "123",
      "amount": 99.99,
      "customer": "John Doe"
    }
  }'
```

## API Endpoints

### Public Endpoints

#### `POST /register-webhook`

Register a new webhook and receive an API key.

**Request Body:**

```json
{
  "name": "My Webhook",
  "url": "https://example.com/webhook"
}
```

**Response:**

```json
{
  "ok": true,
  "webhook": {
    "id": 1,
    "name": "My Webhook",
    "url": "https://example.com/webhook",
    "secret": "...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "apiKey": "ep_live_..."
}
```

### Protected Endpoints (Require `x-api-key` Header)

#### `POST /send-event`

Send an event to be delivered to your registered webhook.

**Headers:**

- `x-api-key`: Your API key (required)

**Request Body:**

```json
{
  "type": "order.created",
  "payload": {
    "orderId": "123",
    "amount": 99.99
  }
}
```

**Response:**

```json
{
  "ok": true,
  "event": {
    "id": 1,
    "type": "order.created",
    "payload": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `GET /events`

List recent events for your webhook.

**Headers:**

- `x-api-key`: Your API key (required)

**Response:**

```json
{
  "ok": true,
  "events": [
    {
      "id": 1,
      "type": "order.created",
      "payload": { ... },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `GET /events/:id/attempts`

Get delivery attempts for a specific event.

**Headers:**

- `x-api-key`: Your API key (required)

**Response:**

```json
{
  "ok": true,
  "attempts": [
    {
      "id": 1,
      "status": "success",
      "responseCode": 200,
      "responseBody": "...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `GET /dlq`

List dead-lettered events (failed after all retries).

**Headers:**

- `x-api-key`: Your API key (required)

**Response:**

```json
{
  "ok": true,
  "dlqEntries": [
    {
      "id": 1,
      "eventId": 123,
      "reason": "Max retries exceeded",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `POST /dlq/:dlqId/retry`

Requeue a dead-lettered event for retry.

**Headers:**

- `x-api-key`: Your API key (required)

**Response:**

```json
{
  "ok": true,
  "message": "DLQ entry requeued for retry"
}
```

### Health & Monitoring

#### `GET /health`

Health check endpoint (available on both API Gateway and Dispatcher Worker).

**Response:**

```json
{
  "status": "ok",
  "service": "api-gateway"
}
```

#### `GET /metrics` (Dispatcher Worker only)

Prometheus metrics endpoint.

## Project Structure

```
eventpulse/
├── api-gateway/          # Express API server
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Auth & validation
│   │   ├── utils/        # Prisma, Redis, HMAC utilities
│   │   └── validators/   # Zod schemas
│   └── package.json
│
├── dispatcher-worker/    # Background worker service
│   ├── src/
│   │   ├── workers/      # Stream & retry workers
│   │   ├── queue/        # BullMQ queue setup
│   │   └── utils/        # Prisma, HMAC utilities
│   └── package.json
│
├── infrastructure/       # Docker Compose setup
│   └── docker-compose.yml
│
├── prisma/              # Database schema & migrations
│   ├── schema.prisma
│   └── migrations/
│
└── README.md
```

## Database Schema

- **Webhook** - Registered webhook endpoints with secrets
- **APIKey** - API keys linked to webhooks for authentication
- **Event** - Ingested events with type and payload
- **DeliveryAttempt** - Records of webhook delivery attempts
- **DLQEntry** - Dead-lettered events that failed after retries

## Technologies

- **Runtime**: Node.js, TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Queue/Stream**: Redis Streams, BullMQ
- **Validation**: Zod
- **HTTP Client**: Axios
- **Security**: HMAC SHA256 signing
- **Monitoring**: Prometheus (prom-client)
- **Logging**: Winston

## Environment Variables

Create `.env` files in both `api-gateway/` and `dispatcher-worker/` directories:

```env
# Database
DATABASE_URL="postgresql://eventpulse:eventpulse@localhost:5432/eventpulse"

# Redis
REDIS_URL="redis://localhost:6379"

# Server Port (optional, defaults shown)
PORT=3000  # for api-gateway
PORT=4000  # for dispatcher-worker
```

## Development

### Running in Development Mode

Both services use `ts-node-dev` for hot-reloading:

```bash
# API Gateway
cd api-gateway
npm run dev

# Dispatcher Worker
cd dispatcher-worker
npm run dev
```

### Building for Production

```bash
# API Gateway
cd api-gateway
npm run build

# Dispatcher Worker
cd dispatcher-worker
npm run build
```

## How It Works

1. **Event Ingestion**: Client sends event to `/send-event` with API key
2. **Validation**: Request validated using Zod schema
3. **Persistence**: Event saved to PostgreSQL via Prisma
4. **Streaming**: Event pushed to Redis Stream (`eventpulse:events`)
5. **Consumption**: Dispatcher worker reads from stream using XREADGROUP
6. **Delivery**: Worker loads webhook secret, signs payload (HMAC), and delivers via HTTP POST
7. **Retry Logic**: Failed deliveries enqueued in BullMQ retry queue
8. **DLQ**: After max retries, events moved to Dead Letter Queue
9. **Monitoring**: All attempts logged in database, metrics exposed via Prometheus

## Webhook Security

All webhook payloads are signed with HMAC SHA256 using the webhook's secret. The signature is included in the `X-EventPulse-Signature` header:

```
X-EventPulse-Signature: sha256=<hex-encoded-hmac>
```

Receivers should verify the signature to ensure authenticity.

