# Image Storage Architecture Explanation

## Current Implementation: File System Storage

### Why Images Are Stored in File System, Not Database

The current architecture stores uploaded images/videos in the **file system** (`/uploads/editor-images/`) rather than in the database. This is a **standard and recommended practice** for several important reasons:

## Architecture Overview

```
User uploads image/video
    ↓
POST /api/v1/editor/images (multipart/form-data)
    ↓
Multer saves file to: /uploads/editor-images/img-{timestamp}-{random}.{ext}
    ↓
Database stores METADATA only:
  - filename: "img-1765000842581-808681192.JPG"
  - path: "uploads/editor-images/img-1765000842581-808681192.JPG"
  - mimeType: "image/jpeg"
  - size: 262144 (bytes)
  - uploadedBy: user_id
    ↓
Frontend receives URL: "/uploads/editor-images/img-1765000842581-808681192.JPG"
    ↓
Express static middleware serves file: app.use('/uploads', express.static('uploads'))
```

## Why File System Instead of Database?

### 1. **Performance & Scalability**

**File System:**
- ✅ Fast read/write operations
- ✅ Efficient for large files (images, videos)
- ✅ No database bloat
- ✅ Can use CDN for static file serving
- ✅ Database remains lightweight

**Database (BLOB/BYTEA):**
- ❌ Slower queries (large binary data in every query)
- ❌ Database size grows rapidly
- ❌ Backup/restore becomes slow and large
- ❌ Memory intensive for large files
- ❌ Poor performance for serving files

### 2. **Database Size Management**

**Example:**
- 10 images × 2MB each = 20MB in file system
- Same 10 images in database = 20MB + overhead + indexes
- With 1000 images: 2GB in file system vs 2GB+ in database

**File System Benefits:**
- Database stays small and fast
- Easy to archive old files
- Can move files to object storage (S3, Cloud Storage) later

### 3. **Industry Standard Practice**

**Common Patterns:**
- **Small files (< 1MB)**: Sometimes stored in database
- **Large files (> 1MB)**: Always stored in file system or object storage
- **Images/Videos**: Almost always file system or object storage (S3, Cloud Storage, etc.)

**Examples:**
- GitHub: Stores files in Git, metadata in database
- WordPress: Files in `wp-content/uploads/`, metadata in database
- Jira: Files in file system or object storage
- TestRail: Files in file system

### 4. **What IS Stored in Database**

The database stores **metadata** about the file:

```sql
CREATE TABLE editor_images (
  id BIGSERIAL PRIMARY KEY,
  filename VARCHAR(255),           -- "img-1765000842581-808681192.JPG"
  original_name VARCHAR(255),      -- "screenshot.png"
  path VARCHAR(500),                -- "uploads/editor-images/img-..."
  mime_type VARCHAR(100),           -- "image/jpeg"
  size INTEGER,                      -- 262144 (bytes)
  uploaded_by BIGINT,                -- user_id
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Benefits:**
- ✅ Fast queries (no binary data)
- ✅ Searchable metadata
- ✅ Audit trail (who uploaded, when)
- ✅ File management (list, delete, search)

### 5. **Current Implementation Details**

**File Storage:**
- Location: `uploads/editor-images/`
- Naming: `img-{timestamp}-{random}.{ext}`
- Max size: 50MB (for videos)
- Supported: Images (JPEG, PNG, GIF, WebP, SVG) and Videos (MP4, MOV, AVI, WebM)

**Database Storage:**
- Table: `editor_images`
- Stores: filename, path, mimeType, size, uploadedBy
- Links to: `test_run_attachments` table (stores URL reference)

**Serving Files:**
```javascript
// Express static middleware
app.use('/uploads', express.static('uploads'));

// File accessible at:
// http://localhost:3001/uploads/editor-images/img-1765000842581-808681192.JPG
```

## Alternative: Database Storage (Not Recommended)

If you wanted to store files in the database, you would:

```sql
CREATE TABLE editor_images (
  id BIGSERIAL PRIMARY KEY,
  filename VARCHAR(255),
  data BYTEA,  -- Binary data stored here
  mime_type VARCHAR(100),
  ...
);
```

**Problems:**
1. **Database bloat**: 2GB of images = 2GB+ database size
2. **Slow queries**: Every SELECT includes binary data
3. **Memory issues**: Loading images into memory for every query
4. **Backup size**: Database backups become huge
5. **No CDN**: Can't easily use CDN for static files
6. **Migration difficulty**: Hard to move to object storage later

## Best Practices & Future Improvements

### Current Setup (Good for Development)
- ✅ File system storage
- ✅ Database metadata
- ✅ Static file serving via Express

### Production Recommendations

**Option 1: Object Storage (Recommended)**
- Use AWS S3, Google Cloud Storage, or Azure Blob Storage
- Files stored in cloud
- CDN for fast global delivery
- Automatic backups and redundancy

**Option 2: Hybrid Approach**
- Small files (< 1MB): Database or file system
- Large files (> 1MB): Object storage
- Metadata always in database

**Option 3: Keep File System (For Small Scale)**
- Use file system (current approach)
- Add backup strategy
- Consider moving to object storage when scaling

## Migration Path (If Needed)

If you want to move to object storage later:

1. **Keep current structure**: Database metadata stays the same
2. **Change upload logic**: Upload to S3 instead of file system
3. **Update path field**: Store S3 URL instead of file path
4. **No frontend changes**: URLs still work the same way

## Summary

| Aspect | File System (Current) | Database Storage |
|--------|----------------------|------------------|
| **Performance** | ✅ Fast | ❌ Slow |
| **Scalability** | ✅ Excellent | ❌ Poor |
| **Database Size** | ✅ Small | ❌ Large |
| **Backup Speed** | ✅ Fast | ❌ Slow |
| **CDN Support** | ✅ Easy | ❌ Difficult |
| **Industry Standard** | ✅ Yes | ❌ No |

**Conclusion**: The current file system storage approach is **correct and follows industry best practices**. The database stores metadata (which is searchable and manageable), while the actual files are stored efficiently in the file system.

## Files in Your Upload Directory

Based on the attached folder, you have:
- **10 files** totaling ~40MB
- Mix of images (JPG, PNG) and videos (MOV, MP4)
- All properly stored in `uploads/editor-images/`
- Metadata stored in `editor_images` database table
- URLs stored in `test_run_attachments` table

This is the **correct architecture** for handling file uploads! 🎯

