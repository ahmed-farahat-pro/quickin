# Updated Project Implementation Plan

**Airbnb-Style Booking Platform (Revised Requirements)**

This document updates and refines the original implementation plan based
on newly clarified functional requirements.

------------------------------------------------------------------------

## 1. User Types

The platform supports **three main user types**, all using a single
account system:

-   **Host** (property owner)\
-   **Guest** (traveler)\
-   **Platform Admin / Service Provider** (application owner)

Each user type has a **dedicated dashboard** with different permissions
and visibility.

------------------------------------------------------------------------

## 2. Host Features

### 2.1 Listing Management

A Host can: - Create a new property listing. - Upload property photos. -
Manage all existing listing details (description, amenities, rules,
etc.). - Each listing must have a **unique 4-digit listing code**
(auto-generated).

### 2.2 Availability & Pricing

-   The Host can:
    -   Define **available dates** using a calendar.
    -   Set a **daily price per date** (variable pricing, not a single
        fixed price).
-   The Host can configure listing rules, including:
    -   Minimum number of nights per booking.
    -   Special conditions (e.g. married couples only, or other custom
        rules).

### 2.3 Booking Requests

-   When a Guest submits a booking request:
    -   The Host receives a **booking request notification**.
    -   The Host can:
        -   Review request details (dates, total price).
        -   **Confirm or reject** the booking request.
-   If multiple booking requests exist, the Host chooses which request
    to confirm.

------------------------------------------------------------------------

## 3. Guest Features

### 3.1 Listing Discovery

-   The Guest can:
    -   Browse listings.
    -   View only **available dates**.
    -   View **per-day pricing** clearly before requesting a booking.

### 3.2 Booking Flow

-   The Guest:
    -   Selects desired dates.
    -   Submits a **booking request** (not an instant booking).
    -   Waits for Host confirmation before the booking becomes active.

### 3.3 Host Privacy

-   **Before booking confirmation**:
    -   Host personal details are hidden from the Guest.
    -   This includes:
        -   Host name
        -   Host phone number
-   Host details become visible **only after booking confirmation**.

------------------------------------------------------------------------

## 4. Admin / Platform Owner Dashboard

### 4.1 Listings & Hosts Management

-   Admin can:
    -   View all listings.
    -   View full listing details.
    -   View Host information related to each listing.

### 4.2 Financial Visibility

-   Admin dashboard shows:
    -   Host payout account details (used later for transferring funds).
    -   Booking-related financial data (for monitoring and payouts).

------------------------------------------------------------------------

## 5. Dashboards Summary

Each role has its own **dedicated dashboard**:

-   **Host Dashboard**
    -   Listings
    -   Availability & pricing
    -   Booking requests
-   **Guest Dashboard**
    -   Booking requests
    -   Confirmed bookings
-   **Admin Dashboard**
    -   Listings overview
    -   Host details
    -   Financial and payout-related data

------------------------------------------------------------------------

## 6. Notes & Clarifications

-   The booking system is **request-based**, not instant booking.
-   Availability and pricing are **date-based**, not static.
-   Privacy between Guest and Host is enforced until booking
    confirmation.
-   Admin has full visibility over all entities.

------------------------------------------------------------------------

If any clarification is needed before producing the final updated plan,
please ask.
