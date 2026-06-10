# Client Requirements & Platform Updates (Feb 2026)

This document outlines the new feature requests and requirements provided by the platform owners.

## 1. Best Offers System
**Goal**: Highlight specific listings as "Best Offers" upon Host request and Admin approval.

- **Workflow**:
    1.  **Host Request**: A host can request their listing be added to the "Best Offers" collection.
    2.  **Admin Approval**: Admins review requests and approve/reject them.
    3.  **Display**: Approved listings appear in a "Best Offers" list/filter.
    4.  **Filtering**: Users can filter search results to show only "Best Offers" (similar to filtering by location).

## 2. Managed Locations (Service Management)
**Goal**: Highlight specific villages or locations (e.g., "Marakia, North Coast") that are managed directly by the platform.

- **Feature**: A dynamic list of locations/villages managed by Admins.
- **Functionality**:
    - Admins can add/remove locations from this list.
    - Listings in these locations should display a distinct label or be grouped to indicate platform management/supervision.
    - **Note**: This is primarily a labeling/grouping feature, not a complex new management flow.

## 3. Social Authentication
**Goal**: Enable easier sign-in methods.
- **Providers**:
    - Sign in with Google.
    - Sign in with Apple (iCloud).

## 4. Identity Verification (KYC)
**Goal**: Mandatory identity verification for all users.
- **Scope**: Required for both **Hosts** and **Guests** during Sign-up.
- **Requirements**:
    - Upload ID Card Front.
    - Upload ID Card Back.
    - Upload Personal Photo (Selfie).

## 5. Reservation Codes
**Goal**: Easy reference for bookings.
- **Feature**: Generate unique, short, human-readable codes for every Reservation (similar to Listing codes).
- **Usage**: Allow searching by this code in Admin and Host dashboards for quick access to reservation details.

## 6. Enhanced Location Entry
**Goal**: Simplify location selection for Hosts.
- **Link Parsing**: Allow Hosts to paste a Google Maps Link, which the system should parse to auto-fill the location.
- **Address Search**: Integrate address autocomplete/search within the Map interface.

## 7. Listing Categories Revamp (Home vs. Service)
**Goal**: Split listings into two main types at the start of the creation process.

- **Step 1**: User selects Main Category: **Home** or **Service**.
- **Step 2**: User selects Sub-category based on Step 1.
    - **Home**: Villa, Apartment, Chalet, etc.
    - **Service**: Yacht, Event, Party, Beach Buggy, etc.
- **Context**: "Service" listings function similarly to Homes (price, days, photos, location) but represent experiences or rentals other than accommodation.

## 8. Price Modification Restrictions
**Goal**: Prevent conflicts with existing bookings.
- **Rule**: Hosts cannot modify the price of a specific date if that date is already reserved.

## 9. Listing Wizard Reordering
**Goal**: Prioritize pricing and conditions.
- **Change**: Move "Conditions" (House Rules/Policies) and "Weekend Pricing" steps to the beginning of the Listing Wizard (First Listing Steps).
