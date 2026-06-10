# Tech Stack Deep Dive

## Next.js 14+ (App Router)

### Why Next.js?
- **Server Components**: Better performance with reduced client-side JavaScript
- **App Router**: Modern routing with layouts, loading states, and error boundaries
- **Server Actions**: Simplified form handling and mutations
- **Image Optimization**: Built-in next/image for optimized images
- **SEO**: Excellent SEO support with metadata API

### Key Patterns
```typescript
// Server Component (default)
async function ListingPage({ params }) {
  const listing = await getListingById(params.id);
  return <ListingDetails listing={listing} />;
}

// Client Component (for interactivity)
'use client';
function BookingWidget({ listingId }) {
  const [dates, setDates] = useState(null);
  // ...
}
```

---

## Tailwind CSS

### Configuration
- Custom color palette matching Airbnb's brand
- Extended spacing and typography scales
- Custom animations for micro-interactions

### Custom Theme (tailwind.config.ts)
```typescript
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: '#FF385C', // Airbnb red
        // ... shades
      },
    },
  },
}
```

---

## Shadcn/ui

### Why Shadcn?
- **Not a component library** - Copy/paste components you own
- **Highly customizable** - Full access to source code
- **Accessible** - Built on Radix UI primitives
- **Beautiful defaults** - Looks great out of the box

### Components We'll Use
- Button, Input, Select, Dialog, Sheet
- Calendar, DatePicker
- Card, Avatar, Badge
- DropdownMenu, NavigationMenu
- Toast, Tooltip
- Carousel (for image galleries)

---

## Zustand

### Why Zustand?
- Minimal boilerplate
- TypeScript-first
- Works great with React Server Components
- No providers needed
- Simple persistence

### Store Examples

```typescript
// stores/useSearchStore.ts
interface SearchState {
  location: string;
  dates: DateRange | null;
  guests: number;
  setLocation: (location: string) => void;
  setDates: (dates: DateRange) => void;
  setGuests: (guests: number) => void;
  reset: () => void;
}

// stores/useAuthStore.ts
interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
}

// stores/useUIStore.ts
interface UIState {
  isSearchOpen: boolean;
  isAuthModalOpen: boolean;
  toggleSearch: () => void;
  toggleAuthModal: () => void;
}
```

---

## Supabase

### Features We'll Use
1. **Authentication**
   - Email/password
   - OAuth (Google, GitHub)
   - Session management

2. **Database (PostgreSQL)**
   - Relational data modeling
   - Row Level Security (RLS)
   - Real-time subscriptions

3. **Storage**
   - Listing images
   - User avatars
   - Secure file uploads

### Database Setup
```sql
-- Example: listings table
create table listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  price_per_night decimal(10,2) not null,
  location text not null,
  latitude decimal(10,8),
  longitude decimal(11,8),
  max_guests int default 1,
  bedrooms int default 1,
  bathrooms int default 1,
  category text,
  images text[],
  amenities text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table listings enable row level security;

-- Anyone can view listings
create policy "Listings are viewable by everyone"
  on listings for select using (true);

-- Only owners can modify
create policy "Users can manage their own listings"
  on listings for all using (auth.uid() = user_id);
```

---

## Zod

### Why Zod?
- TypeScript-first schema validation
- Infer types from schemas
- Works on both client and server
- Great error messages

### Schema Examples

```typescript
// lib/validations/listing.ts
import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  pricePerNight: z.number().positive('Price must be positive'),
  location: z.string().min(1, 'Location is required'),
  maxGuests: z.number().int().min(1).max(16),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  category: z.enum(['beach', 'mountain', 'city', 'countryside', 'tropical']),
  amenities: z.array(z.string()).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

// lib/validations/booking.ts
export const createBookingSchema = z.object({
  listingId: z.string().uuid(),
  checkIn: z.date(),
  checkOut: z.date(),
  guests: z.number().int().min(1),
}).refine(data => data.checkOut > data.checkIn, {
  message: 'Check-out must be after check-in',
  path: ['checkOut'],
});
```

---

## Integration Patterns

### Form Handling with Zod + Server Actions
```typescript
// Using react-hook-form + zod
const form = useForm<CreateListingInput>({
  resolver: zodResolver(createListingSchema),
});

// Server Action
async function createListing(data: CreateListingInput) {
  'use server';
  const validated = createListingSchema.parse(data);
  // Insert into Supabase
}
```

### Auth State with Zustand + Supabase
```typescript
// Sync Supabase auth with Zustand
useEffect(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setUser(session?.user ?? null);
  });
}, []);
```
