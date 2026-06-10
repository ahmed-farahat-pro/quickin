# Dynamic Banners Management Specification

## Overview
This document outlines the architectural and technical design for replacing the static `PromoBanner` with a dynamic `BannersStack` system. Admins will be able to manage, reorder, style, and toggle multiple banners via the Site Settings.

## 1. Database Schema Updates

### `site_settings` Table
- Add a new column `banners_config` of type `JSONB` to store an array of banner objects.
- **Data Structure:**
  ```json
  [
    {
      "id": "uuid",
      "text": { "en": "Best Offers of the Week...", "ar": "أفضل عروض الأسبوع..." },
      "preset": "primary", // 'primary', 'destructive', 'muted', 'custom'
      "advanced_classes": "", // Optional Tailwind classes
      "icon": "tag", // Lucide icon name (optional)
      "link": "/?bestOffer=true", // Optional URL
      "is_closable": true,
      "is_active": true
    }
  ]
  ```

## 2. Admin UI (`/admin/settings/site`)

### Banners Manager Tab
- Add a new "Banners" tab alongside "General Settings" and "Custom Pages".
- **Widget Engine:** Leverage the existing `@dnd-kit` setup from the custom pages feature to allow dragging and dropping banners to change their display order.
- **Banner Editor:**
  - **Content:** English/Arabic text inputs.
  - **Styling (Hybrid):** A dropdown for predefined presets (Primary, Destructive, Muted) and an input field for "Advanced Tailwind Classes".
  - **Interactivity:** Toggles for `is_active` and `is_closable`. Optional inputs for an `icon` name and a destination `link`.

## 3. Frontend Implementation

### `BannersStack` Component
- Replace the existing `<PromoBanner />` in `src/app/(main)/layout.tsx` with `<BannersStack />`.
- **Fetching:** The layout will fetch `site_settings` (which includes `banners_config`) and pass it to the component.
- **Rendering:** It maps over the active banners and renders them sequentially.
- **State Management:** 
  - For closable banners, it will track dismissed banners using `sessionStorage` (so they remain hidden for the session but reappear on next visit) or React state.
- **Styling Engine:** It merges the base preset classes with any `advanced_classes` provided by the admin using `tailwind-merge` (`cn` utility).