# Acurast Processor Management Backend

A management backend for processors on Acurast that allows for storing and retrieving battery percentages and other processor status information. This service provides an API for managing processor check-ins, monitoring battery levels, and tracking processor statuses across the Acurast network.

## Features

- Processor check-in management
- Battery level tracking
- Processor status monitoring
- Network type tracking
- Battery health monitoring
- Temperature readings
- Web interface for processor management
- Swagger API documentation

## API Documentation

The API is documented using Swagger/OpenAPI specification. You can access the interactive API documentation at `http://localhost:9001/api` when the server is running. The documentation includes:

- Detailed request/response schemas
- Authentication requirements
- Example requests and responses
- Available endpoints and their parameters
- Response codes and error messages

### API Endpoints

### Web Interface

- **GET** `/` - Overview
- **GET** `/api` - API Documentation
- **GET** `/processor/web/list` - Processor list view
- **GET** `/processor/web/:address/status` - Processor status view
- **GET** `/processor/web/:address/history` - Processor history view
- **GET** `/processor/web/:address/graph` - Processor graph view

#### Processor Status

- **GET** `/processor/api/:address/status`
  - Parameters:
    - `address`: Processor address (path parameter)
  - Returns: `{ processorStatus: ProcessorStatus }`
  - Response Codes:
    - 200: Processor status retrieved successfully
    - 404: Processor not found

#### Processor History

- **GET** `/processor/api/:address/history`
  - Parameters:
    - `address`: Processor address (path parameter)
    - `limit`: Number of history entries to return (query parameter, optional, default: 10)
  - Returns: `{ history: ProcessorStatus[] }`
  - Response Codes:
    - 200: Processor history retrieved successfully
    - 404: Processor not found

#### Bulk Processor Status

- **GET** `/processor/api/status/bulk`
  - Parameters:
    - `addresses`: Comma-separated list of device addresses (query parameter)
  - Returns: `{ processorStatuses: Record<string, ProcessorStatus> }`
  - Response Codes:
    - 200: Processor statuses retrieved successfully

```bash
# Example
/processor/api/status/bulk?addresses=addr1,addr2,addr3
```

#### Processor Check-in (done by processor)

- **POST** `/processor/check-in`
  - Headers: `X-Device-Signature` (required)
  - Body:
    ```json
    {
      "deviceAddress": "string",
      "platform": "number (0 = Android, 1 = iOS)",
      "timestamp": "number",
      "batteryLevel": "number",
      "isCharging": "boolean",
      "batteryHealth": "string (optional)",
      "temperatures": {
        "battery": "number (optional)",
        "ambient": "number (optional)",
        "forecast": "number (optional)"
      },
      "networkType": "string",
      "ssid": "string (optional)"
    }
    ```
  - Returns: `{ success: boolean, refreshIntervalInSeconds: number }`
  - Response Codes:
    - 200: Check-in successful
    - 403: Processor not whitelisted
    - 401: Invalid signature

### Data Types

#### ProcessorStatus

```typescript
interface ProcessorStatus {
  address: string; // Processor address
  timestamp: number; // Unix timestamp of the status update
  batteryLevel: number; // Battery level percentage (0-100)
  isCharging: boolean; // Whether the processor is currently charging
  batteryHealth?: string; // Battery health state
  temperatures?: {
    // Temperature readings
    battery?: number; // Battery temperature
    ambient?: number; // Ambient temperature
    forecast?: number; // Forecast temperature
  };
  networkType: NetworkTypeEnum; // Network connection type
  ssid?: string; // Network SSID
}

enum NetworkTypeEnum {
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  USB = 'usb',
  UNKNOWN = 'unknown',
}
```

## Building and Running Locally

### Prerequisites

- Node.js 20 or later
- PostgreSQL 13 or later
- npm or yarn

### Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd acurast-processor-management-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:

   ```
   PORT=9001
   ENVIRONMENT=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=acurast_processor_management_backend
   DB_USER=acurast_processor_management_backend
   DB_PASSWORD=your_password
   ```

4. Run database migrations:

   ```bash
   npm run typeorm:run-migrations
   ```

5. Build the project:

   ```bash
   npm run build
   ```

6. Start the server:

   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run start:prod
   ```

The server will start on port 9001 by default. You can access:

- API documentation at `http://localhost:9001/api`
- Web interface at `http://localhost:9001/processor/web/list`

## Development

### Available Scripts

- `npm run build` - Build the project
- `npm run start:dev` - Start in development mode with hot reload
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start in production mode
- `npm run test` - Run tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run linter
- `npm run format` - Format code

### Docker Support

The project includes Docker support for both development and production environments. Use the provided Dockerfile and docker-compose.yml for containerized deployment.

## License

UNLICENSED
