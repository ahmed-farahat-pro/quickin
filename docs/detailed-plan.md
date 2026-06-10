# Project Implementation Plan: Airbnb-Style Booking Platform

This document outlines the detailed implementation plan (English) based on the user's requirements for a local accommodation booking platform.

## 1. User Roles & Core Flows

### Host (Property Owner)
*   **Listing Management**:
    *   ability to create a new property listing.
    *   **Upload Photos**: Drag-and-drop interface for high-quality images.
    *   **Location**: Interactive map integration (Google Maps/Mapbox) to pin exact property location.
    *   **Pricing**: Set nightly rates, cleaning fees, and currency (EGP).
    *   **Details**: Add amenities, description, and house rules.

### Guest (Traveler)
*   **Search & Discovery**: Filter by location, price, dates, and amenities.
*   **Booking Process**:
    *   Select dates and view total breakdown.
    *   **Payment Gateway**: Secure checkout supporting local payment methods:
        *   Credit/Debit Cards
        *   **Vodafone Cash** (via payment processor integration or manual instruction flow).
        *   **InstaPay** (likely manual verification or QR code integration if API available).
*   **Funds Handling**:
    *   Payments are held in escrow (by the platform) initially, not sent directly to the host immediately.

## 2. Financial Workflow (Escrow System)

1.  **Guest Pays**: Money collects in the Platform's merchant account (Stripe/Paymob/etc.).
2.  **Hold Period**: Funds are held until the guest checks in.
3.  **Payout Trigger**: Upon successful check-in (or 24 hours after), the system triggers a payout.
4.  **Commission**: Platform automatically deducts its service fee (percentage) before transferring the remainder to the Host.
5.  **Host Payout**: Money is sent to the Host's wallet or bank account.

## 3. Admin Dashboard

A centralized control panel for platform administrators:
*   **Financial Management**:
    *   View total revenue and held funds.
    *   Manually approve/process payouts to Hosts (if automated payout isn't used).
    *   Verify manual payments (like receipts for Vodafone Cash/InstaPay if manual).
*   **User Management**: Ban/approve hosts or guests.
*   **Dispute Resolution**: Handle cancellations and refund requests.

## 4. AI Agent & Help Center

*   **Smart Help Center**:
    *   Knowledge base with FAQs (How to book, How to host, Payment issues).
*   **AI Agent Integration**:
    *   Chatbot powered by LLM (e.g., Gemini/OpenAI).
    *   **Capabilities**: Answer user queries, suggest listings based on preferences, assist with booking troubleshooting, and explain policies.

## 5. Reviews & Ratings

*   **Post-Stay**: Guests can rate cleanliness, accuracy, communication, location, and value.
*   **Comments**: Text reviews visible on the listing page.
*   **Host Ratings**: Aggregate score displayed on host profiles.

## 6. Location Services

*   **Interactive Map**: View searching results on a map.
*   **Nearby Amenities**: When viewing a listing, show proximity to:
    *   Restaurants/Cafes
    *   Public Transport
    *   Tourist Attractions
    *   Supermarkets

## 7. Localization (Arabic Support)

*   **RTL Support**: Full Right-to-Left layout adjustment for Arabic users.
*   **Language Toggle**: Switch between English and Arabic.
*   **Content**: UI labels, notifications, and emails must be bilingual.

## Technical Considerations

*   **Payment Provider**: Need a provider that supports Egypt-specific methods (Paymob, Fawry, or Stripe if applicable).
*   **Maps API**: Google Maps Platform or Mapbox.
*   **Frontend**: Next.js (already in use).
*   **Backend**: Supabase (already in use) for Auth and Database.
