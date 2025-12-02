# QaHub Web Application

Next.js frontend for QaHub Quality Management System.

## Getting Started

### Install Dependencies

```bash
cd apps/web
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build

```bash
npm run build
npm start
```

## Features

- **Login Page**: Beautiful login interface matching QaHub branding
- **Dashboard**: Overview with stats and quick actions
- **Responsive Design**: Works on desktop and mobile
- **TypeScript**: Full type safety
- **Tailwind CSS**: Modern styling

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Project Structure

```
apps/web/
├── app/
│   ├── page.tsx          # Login page
│   ├── dashboard/
│   │   └── page.tsx     # Dashboard page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/           # Reusable components
├── lib/                 # Utilities and helpers
└── public/              # Static assets
```

