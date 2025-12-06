# Database Storage Setup for Images/Videos

## Overview

The system now supports storing uploaded images and videos in the **database** instead of the file system. This enables multi-user access from different locations/servers without requiring shared file systems.

## Configuration

### Enable Database Storage

Set the environment variable in your `.env` file:

```bash
STORAGE_TYPE=database
```

### Storage Options

| Storage Type | Environment Variable | Use Case |
|--------------|---------------------|----------|
| **Database** | `STORAGE_TYPE=database` | Multi-user, distributed systems |
| **File System** | `STORAGE_TYPE=filesystem` (default) | Single server, local development |
| **S3/Cloud** | `STORAGE_TYPE=s3` (future) | Production, scalable, CDN support |

## How It Works

### Database Storage Flow

```
User uploads image/video
    ↓
POST /api/v1/editor/images (multipart/form-data)
    ↓
Multer stores file in memory (not disk)
    ↓
Binary data stored in: editor_images.data (BYTEA column)
    ↓
Metadata stored: filename, mimeType, size, storageType='database'
    ↓
Frontend receives URL: /api/v1/editor/images/{id}/file
    ↓
GET /api/v1/editor/images/{id}/file serves binary data from database
```

### File System Storage Flow (Default)

```
User uploads image/video
    ↓
POST /api/v1/editor/images (multipart/form-data)
    ↓
Multer saves file to: /uploads/editor-images/img-{timestamp}.{ext}
    ↓
Metadata stored: filename, path, mimeType, size, storageType='filesystem'
    ↓
Frontend receives URL: /uploads/editor-images/img-{timestamp}.{ext}
    ↓
Express static middleware serves file directly
```

## Database Schema Changes

### New Fields in `editor_images` Table

```sql
ALTER TABLE "editor_images" ADD COLUMN "data" BYTEA;           -- Binary file data (for database storage)
ALTER TABLE "editor_images" ADD COLUMN "storage_type" VARCHAR(50) DEFAULT 'filesystem';
```

### Storage Type Values

- `'filesystem'`: File stored on disk, `data` column is NULL
- `'database'`: File stored in `data` column (BYTEA)
- `'s3'`: File stored in cloud (future implementation)

## API Endpoints

### Upload Image/Video

**Endpoint:** `POST /api/v1/editor/images`

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/editor/images \
  -H "Authorization: Bearer {token}" \
  -F "image=@screenshot.png"
```

**Response:**
```json
{
  "data": {
    "image": {
      "id": "123",
      "filename": "img-1765000842581-808681192.JPG",
      "url": "/api/v1/editor/images/123/file",  // For database storage
      "storageType": "database",
      "mimeType": "image/jpeg",
      "size": 262144
    }
  }
}
```

### Serve File from Database

**Endpoint:** `GET /api/v1/editor/images/:imageId/file`

**Headers:**
- `Authorization: Bearer {token}` (required)
- Returns binary data with appropriate `Content-Type`

**Example:**
```html
<img src="/api/v1/editor/images/123/file" alt="Screenshot" />
```

### List Images

**Endpoint:** `GET /api/v1/editor/images`

Returns metadata for all images (doesn't include binary data for performance).

## Performance Considerations

### Database Storage

**Pros:**
- ✅ Centralized storage (works across servers)
- ✅ No shared file system needed
- ✅ Automatic backups with database
- ✅ Transactional consistency

**Cons:**
- ⚠️ Database size grows rapidly
- ⚠️ Slower queries (binary data in database)
- ⚠️ Memory intensive for large files
- ⚠️ Backup/restore becomes slow

**Recommendations:**
- Use for **small files** (< 5MB)
- Consider **object storage (S3)** for larger files
- Monitor database size
- Set up regular database maintenance

### File System Storage

**Pros:**
- ✅ Fast read/write
- ✅ Efficient for large files
- ✅ Database stays small

**Cons:**
- ❌ Requires shared file system for multi-server
- ❌ Backup strategy needed separately

## Migration from File System to Database

### Option 1: New Uploads Only

Simply set `STORAGE_TYPE=database` in `.env`. New uploads will go to database, existing files remain on disk.

### Option 2: Migrate Existing Files

Create a migration script to:
1. Read existing files from disk
2. Store binary data in database
3. Update `storageType` to 'database'
4. Optionally delete files from disk

## Best Practices

### For Multi-User/Multi-Server Setup

1. **Recommended:** Use **Object Storage (S3/Cloud Storage)**
   - Set `STORAGE_TYPE=s3`
   - Configure AWS credentials
   - Files stored in cloud, accessible from anywhere
   - CDN support for fast delivery

2. **Alternative:** Use **Database Storage**
   - Set `STORAGE_TYPE=database`
   - Works for small files (< 5MB)
   - Monitor database size

3. **Not Recommended:** File System for Multi-Server
   - Requires NFS or shared storage
   - Complex to set up and maintain

## Environment Variables

```bash
# Storage type: 'database', 'filesystem', or 's3'
STORAGE_TYPE=database

# For file system storage (if STORAGE_TYPE=filesystem)
UPLOAD_DIR=uploads
UPLOAD_BASE_URL=/uploads

# For S3 storage (if STORAGE_TYPE=s3) - Future
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_S3_BASE_URL=https://cdn.example.com  # Optional: CDN URL
```

## Testing

### Test Database Storage

1. Set `STORAGE_TYPE=database` in `.env`
2. Restart the server
3. Upload an image via the UI
4. Check database: `SELECT id, filename, storage_type, LENGTH(data) FROM editor_images;`
5. Access image: `GET /api/v1/editor/images/{id}/file`

### Test File System Storage

1. Set `STORAGE_TYPE=filesystem` in `.env` (or remove the variable)
2. Restart the server
3. Upload an image via the UI
4. Check file system: `ls -lh uploads/editor-images/`
5. Access image: `GET /uploads/editor-images/{filename}`

## Troubleshooting

### Issue: "Image not found" when accessing database-stored files

**Solution:** Ensure the image was uploaded with `STORAGE_TYPE=database` set. Check `storage_type` column in database.

### Issue: Database growing too large

**Solution:** 
- Consider migrating to object storage (S3)
- Archive old files
- Set file size limits

### Issue: Slow image loading

**Solution:**
- Use object storage with CDN
- Implement caching
- Consider file system for large files

## Summary

- **Database Storage**: Enabled with `STORAGE_TYPE=database`
- **Multi-User Access**: ✅ Works across different servers/locations
- **Performance**: ⚠️ Slower for large files, monitor database size
- **Recommended**: Use object storage (S3) for production

