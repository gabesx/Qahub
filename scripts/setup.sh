#!/bin/bash

# QaHub Setup Script
# This script helps set up the development environment

set -e

echo "🚀 QaHub Setup Script"
echo "===================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
  exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check npm version
echo "📦 Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 9 ]; then
  echo "⚠️  npm version 9 or higher is recommended. Current version: $(npm -v)"
fi
echo "✅ npm version: $(npm -v)"

# Check PostgreSQL
echo "🗄️  Checking PostgreSQL..."
if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL is installed"
  psql --version
else
  echo "⚠️  PostgreSQL not found. Please install PostgreSQL 14+"
  echo "   macOS: brew install postgresql@14"
  echo "   Ubuntu: sudo apt-get install postgresql-14"
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "📝 Creating .env file..."
  cp env.example .env
  echo "✅ Created .env file. Please edit it with your database credentials."
else
  echo "✅ .env file already exists"
fi

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

# Check if database exists
echo ""
echo "🗄️  Database setup..."
read -p "Do you want to create the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  read -p "Enter PostgreSQL username (default: postgres): " DB_USER
  DB_USER=${DB_USER:-postgres}
  
  read -p "Enter database name (default: qahub): " DB_NAME
  DB_NAME=${DB_NAME:-qahub}
  
  echo "Creating database '$DB_NAME'..."
  createdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || echo "Database might already exist or you need to create it manually."
  
  echo ""
  echo "✅ Database setup complete!"
  echo "   Update DATABASE_URL in .env:"
  echo "   DATABASE_URL=\"postgresql://$DB_USER:password@localhost:5432/$DB_NAME?schema=public\""
fi

# Run migrations
echo ""
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔄 Running database migrations..."
  npm run prisma:migrate
  echo "✅ Migrations complete!"
fi

# Seed database
echo ""
read -p "Do you want to seed the database with initial data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🌱 Seeding database..."
  npm run prisma:seed
  echo "✅ Database seeded!"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000/health to check the server"
echo ""
echo "Default credentials (if seeded):"
echo "  Email: admin@qahub.com"
echo "  Password: admin123"
echo ""

