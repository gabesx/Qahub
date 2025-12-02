# Real-Time Notifications System

## Overview

The QaHub real-time notification system uses **Server-Sent Events (SSE)** to push notifications to clients instantly when they are created, updated, or deleted. This provides a seamless user experience without requiring polling.

## Architecture

### Server-Sent Events (SSE)

SSE was chosen over WebSocket because:
- **Simpler implementation** - No additional dependencies
- **One-way communication** - Perfect for notifications (server → client)
- **Automatic reconnection** - Built into browser EventSource API
- **HTTP-based** - Works through firewalls and proxies
- **Lower overhead** - Less complex than WebSocket

### Components

1. **SSE Route Handler** (`src/api/routes/notifications-sse.ts`)
   - Manages active SSE connections
   - Broadcasts notifications to connected clients
   - Handles connection lifecycle (connect, disconnect, cleanup)

2. **Notification Routes** (`src/api/routes/notifications.ts`)
   - Integrated SSE broadcasting on create/update/delete operations
   - Automatically pushes updates to connected clients

## API Endpoints

### SSE Stream Endpoint

```
GET /api/v1/notifications/stream
Authorization: Bearer <token>
```

**Response:** Server-Sent Events stream

**Events:**
- `connected` - Sent when client connects
- `notification` - New notification received
- `stats` - Notification statistics updated
- `recent` - Recent unread notifications (on connect)
- `heartbeat` - Keep-alive ping (every 30 seconds)

**Example Client Usage (JavaScript):**

```javascript
const eventSource = new EventSource('/api/v1/notifications/stream', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected:', data);
});

eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
  // Update UI with new notification
});

eventSource.addEventListener('stats', (event) => {
  const stats = JSON.parse(event.data);
  console.log('Stats updated:', stats);
  // Update notification badge count
});

eventSource.addEventListener('recent', (event) => {
  const data = JSON.parse(event.data);
  console.log('Recent notifications:', data.notifications);
  // Display recent notifications
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // Handle reconnection
};
```

**Note:** The standard `EventSource` API doesn't support custom headers. For authentication, you may need to:
1. Use a library that supports headers (e.g., `eventsource` npm package)
2. Pass token as query parameter: `/api/v1/notifications/stream?token=<token>`
3. Use a cookie-based authentication

### Connection Monitoring

```
GET /api/v1/notifications/stream/connections
Authorization: Bearer <token>
```

Returns information about active SSE connections:
- Total connections
- User's active connections
- Connections by user (for monitoring)

## Event Types

### 1. Connected Event

Sent immediately when client connects.

```json
{
  "clientId": "123-1234567890-abc123",
  "userId": "456",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. Notification Event

Sent when a new notification is created for the user.

```json
{
  "id": "uuid-here",
  "type": "test_run_completed",
  "data": "Test run #123 completed",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

### 3. Stats Event

Sent when notification statistics change (read/unread counts).

```json
{
  "total": 10,
  "unread": 3,
  "read": 7
}
```

### 4. Recent Event

Sent on connection with recent unread notifications.

```json
{
  "notifications": [
    {
      "id": "uuid-1",
      "type": "test_run_completed",
      "data": "Test run #123 completed",
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

### 5. Heartbeat

Sent every 30 seconds to keep connection alive.

```
: heartbeat
```

## Automatic Broadcasting

The system automatically broadcasts events when:

1. **Notification Created** - New notification is created for a user
2. **Notification Updated** - Notification is marked as read/unread
3. **Notification Deleted** - Notification is deleted
4. **Bulk Operations** - Multiple notifications are marked as read or deleted

## Connection Management

### Client Lifecycle

1. **Connect** - Client opens SSE connection
2. **Initial Data** - Server sends connection confirmation, stats, and recent notifications
3. **Heartbeat** - Server sends keep-alive every 30 seconds
4. **Events** - Server pushes notifications and stats updates
5. **Disconnect** - Client closes connection or connection is lost

### Server Cleanup

- Automatic cleanup of disconnected clients every 30 seconds
- Connection tracking by unique client ID
- Per-user connection management

## Security

- **Authentication Required** - All SSE endpoints require valid JWT token
- **User Isolation** - Users only receive their own notifications
- **Connection Validation** - User must be authenticated and active

## Performance Considerations

### Scalability

- **In-Memory Storage** - SSE connections stored in memory (Map)
- **Horizontal Scaling** - For multiple servers, use Redis pub/sub or message queue
- **Connection Limits** - Monitor active connections per user

### Optimization

- **Heartbeat Interval** - 30 seconds (configurable)
- **Cleanup Interval** - 30 seconds (configurable)
- **Initial Data Limit** - Recent notifications limited to 10

## Future Enhancements

1. **Redis Pub/Sub** - For multi-server deployments
2. **WebSocket Support** - For bidirectional communication needs
3. **Notification Preferences** - User-configurable notification types
4. **Delivery Guarantees** - At-least-once delivery with acknowledgment
5. **Message Queue** - For high-volume notification systems

## Example Frontend Integration

```typescript
// React Hook Example
import { useEffect, useState } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

export function useNotifications(token: string) {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, read: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSourcePolyfill(
      '/api/v1/notifications/stream',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    eventSource.addEventListener('connected', (event) => {
      setConnected(true);
    });

    eventSource.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);
      setNotifications((prev) => [notification, ...prev]);
    });

    eventSource.addEventListener('stats', (event) => {
      const stats = JSON.parse(event.data);
      setStats(stats);
    });

    eventSource.addEventListener('recent', (event) => {
      const data = JSON.parse(event.data);
      setNotifications(data.notifications);
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  return { notifications, stats, connected };
}
```

## Testing

### Manual Testing

1. Open SSE connection:
```bash
curl -N -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/notifications/stream
```

2. Create a notification (in another terminal):
```bash
curl -X POST http://localhost:3001/api/v1/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test",
    "notifiableType": "user",
    "notifiableId": "1",
    "data": "Test notification"
  }'
```

3. Observe SSE stream receiving the notification event

## Troubleshooting

### Connection Issues

- **401 Unauthorized** - Check token is valid and not expired
- **Connection Drops** - Check network stability, SSE will auto-reconnect
- **No Events** - Verify user ID matches notification recipient

### Performance Issues

- **High Memory** - Monitor active connections, implement connection limits
- **Slow Updates** - Check database query performance
- **Connection Leaks** - Ensure proper cleanup on component unmount

