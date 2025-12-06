#!/bin/bash
# Script to add Promise<void> return types to all async route handlers

# Find all route files
find src/api/routes -name "*.ts" -type f | while read file; do
  # Add Promise<void> to async route handlers that don't have it
  sed -i '' 's/async (req, res) =>/async (req, res): Promise<void> =>/g' "$file"
  sed -i '' 's/async (req: Request, res: Response) =>/async (req: Request, res: Response): Promise<void> =>/g' "$file"
  sed -i '' 's/async (req: AuthRequest, res: Response) =>/async (req: AuthRequest, res: Response): Promise<void> =>/g' "$file"
done

echo "Fixed return types in all route files"

