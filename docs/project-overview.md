# Airbnb Clone - Project Overview

## 🎯 Vision
A modern, feature-rich vacation rental marketplace inspired by Airbnb, built with cutting-edge technologies for optimal performance, scalability, and developer experience.

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 14+ | Full-stack React framework with App Router |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **UI Components** | Shadcn/ui | Accessible, customizable component library |
| **State Management** | Zustand | Lightweight, flexible state management |
| **Backend/Database** | Supabase | PostgreSQL database, Auth, Storage, Real-time |
| **Validation** | Zod | TypeScript-first schema validation |
| **AI Assistant** | Google Gemini API | Intelligent user assistant & chat |

---

## 📁 Proposed Project Structure

```
airbnb-prototype/
├── docs/                    # Documentation & brainstorming
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Auth-related routes
│   │   ├── (main)/          # Main app routes
│   │   ├── api/             # API routes
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── ui/              # Shadcn components
│   │   ├── features/        # Feature-specific components
│   │   └── layout/          # Layout components
│   ├── lib/
│   │   ├── supabase/        # Supabase client & helpers
│   │   ├── gemini/          # Gemini AI client & prompts
│   │   ├── validations/     # Zod schemas
│   │   └── utils.ts         # Utility functions
│   ├── stores/              # Zustand stores
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript types
├── public/                  # Static assets
└── supabase/                # Supabase migrations & config
```

---

## 🚀 Core Features (MVP)

### 1. Authentication
- Email/password sign up & login
- OAuth providers (Google, GitHub)
- Protected routes
- User profile management

### 2. Listings
- Browse all listings with grid layout
- Detailed listing pages with image gallery
- Category-based filtering
- Location-based search
- Price range filters
- Date availability

### 3. Booking System
- Date range selection
- Guest count management
- Price calculation
- Booking confirmation
- Booking history

### 4. User Dashboard
- My listings (for hosts)
- My bookings (for guests)
- Favorites/wishlists
- Profile settings

### 5. Host Features
- Create new listings
- Upload images
- Set pricing & availability
- Manage bookings

### 6. AI Assistant (Gemini)
- Floating chat widget available app-wide
- Help with search queries & recommendations
- Answer questions about listings, amenities, locations
- Booking assistance & date suggestions
- Context-aware responses based on current page

---

## 🎨 Design Goals

- **Modern & Clean**: Minimalist aesthetic with thoughtful use of whitespace
- **Responsive**: Mobile-first approach, beautiful on all devices
- **Accessible**: WCAG compliant, keyboard navigable
- **Interactive**: Smooth animations and micro-interactions
- **Dark Mode**: Full dark mode support

---

## 📊 Database Schema (Supabase)

### Core Tables
- `profiles` - User profiles extending auth.users
- `listings` - Property listings
- `bookings` - Reservation records
- `reviews` - Guest reviews
- `favorites` - User wishlists
- `categories` - Listing categories
- `amenities` - Available amenities

---

## 🔮 Future Enhancements (Post-MVP)
- Real-time messaging between hosts and guests
- Advanced search with map view
- Payment integration (Stripe)
- Email notifications
- Admin dashboard
- Review & rating system
- Multi-language support
