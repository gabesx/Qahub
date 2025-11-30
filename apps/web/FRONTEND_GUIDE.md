# QaHub Frontend Guide

## 🎨 What's Been Created

### 1. **Login Page** (`/`)
- Matches your design with Qa-Hub branding
- Light green background (#f0fdf4)
- White card with rounded corners
- Email and password fields with icons
- Remember me checkbox
- Forgot password link
- Sign in button
- Copyright footer

### 2. **Dashboard Page** (`/dashboard`)
- Overview statistics cards
- Recent test runs
- Quick action buttons
- Responsive design
- Protected route (requires authentication)

### 3. **Forgot Password Page** (`/forgot-password`)
- Email input for password reset
- Success confirmation

## 🚀 Running the Application

### Start Backend (API Server)
```bash
# From project root
npm run dev
# Runs on http://localhost:3000
```

### Start Frontend (Next.js)
```bash
# From project root
npm run dev:web
# Or from apps/web directory
cd apps/web
npm run dev
# Runs on http://localhost:3001
```

## 🔐 Authentication Flow

1. **Login**: User enters email/password → API validates → Returns JWT token
2. **Token Storage**: Token stored in localStorage
3. **Protected Routes**: Dashboard checks for token, redirects to login if missing
4. **API Requests**: Token automatically added to request headers

## 📁 Project Structure

```
apps/web/
├── app/
│   ├── page.tsx              # Login page (home)
│   ├── dashboard/
│   │   └── page.tsx         # Dashboard page
│   ├── forgot-password/
│   │   └── page.tsx         # Forgot password page
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── lib/
│   └── api.ts               # API client with axios
└── components/              # (Future: reusable components)
```

## 🎨 Design Features

- **Color Scheme**: Green primary color (#22c55e) matching QaHub branding
- **Typography**: Clean, modern sans-serif fonts
- **Icons**: SVG icons for email, password, eye toggle
- **Responsive**: Works on mobile and desktop
- **Tailwind CSS**: Utility-first CSS framework

## 🔧 Configuration

### Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### API Integration

The frontend connects to the backend API at:
- Login: `POST /api/v1/auth/login`
- Verify: `GET /api/v1/auth/verify`

## 📝 Default Credentials (from seed)

- **Email**: `admin@qahub.com`
- **Password**: `admin123`

## 🛠️ Development

### Making Changes

1. Edit files in `apps/web/app/`
2. Changes hot-reload automatically
3. Check browser console for errors

### Adding New Pages

Create new files in `apps/web/app/`:
- `app/new-page/page.tsx` → `/new-page`

### Styling

- Use Tailwind CSS classes
- Custom colors defined in `tailwind.config.ts`
- Global styles in `app/globals.css`

## 🚧 Next Steps

1. **Connect Real API**: Update API endpoints when backend is ready
2. **Add More Pages**: Test cases, test runs, projects, etc.
3. **Add Components**: Reusable UI components
4. **Add State Management**: Redux/Zustand if needed
5. **Add Tests**: React Testing Library

---

**Happy Coding! 🎉**

