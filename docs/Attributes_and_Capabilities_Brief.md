# Attributes & Capabilities System – Design Brief

## Context

We are building an Airbnb-style accommodation platform, initially focused on **Egypt**, where many things that are assumed elsewhere (24/7 water, stable electricity, fast internet, natural gas) are **not guaranteed** and are highly valuable to users.

Because of this, the traditional distinction between **amenities vs features** is insufficient and culturally inaccurate.

Instead, we want a **unified system** that describes **what a place offers**, how reliable it is, and how much it can be trusted — while remaining searchable, filterable, and reviewable.

This document describes the **conceptual model and data direction** for that system.

---

## Core Insight

The real distinction is NOT:
- Amenity vs Feature

The real distinction IS:
- **Objective / computable**
- **Declarative but verifiable**
- **Subjective and review-backed**

The system must encode this distinction explicitly.

---

## Computed vs Claimed Attributes

### Computed (System-Derived)
These should NOT be host-entered.

Examples:
- Distance to city center
- Distance to downtown
- Distance to beach / POIs

Derived from:
- Listing latitude / longitude
- Known reference points

UI example:
> “0.8 km from Downtown”

Filtering example:
- Less than 1 km
- Less than 3 km

---

## Unified Attribute Model

Attributes = capabilities or characteristics a place offers.

Each attribute defines:
- Display behavior
- Filter behavior
- Verification needs
- Subjectivity level

---

## Attribute Categories (UI Grouping)

- infrastructure
- utilities
- comfort
- views
- access
- safety
- entertainment

Categories are organizational only.

---

## Capabilities & Conditions

Many attributes require conditions, not yes/no.

### Capability
What the place provides.

### Condition
How reliable or constrained it is.

Examples:
- Fresh water → 24/7 / limited
- Electricity → government / generator-backed
- Internet → fast / limited / weak
- Gas → natural gas / cylinder

---

## Data Model (Conceptual)

### attributes
- id
- code
- label
- category
- value_type (boolean / enum / number)
- is_filterable
- requires_verification

### attribute_values
- id
- attribute_id
- code
- label

### listing_attributes
- listing_id
- attribute_id
- value_boolean
- value_enum_id
- value_number

---

## Subjective Attributes

Examples:
- Sea view
- Mountain view

These are:
- Graded (full / partial)
- Host-reported
- Review-validated

---

## Reviews as Validation

Reviews:
- Flag mismatches
- Reduce trust on repetition
- Trigger admin action

They are validation, not enforcement.

---

## Why This Fits Egypt

- Infrastructure reliability matters
- Conditions matter more than presence
- Reduces disputes
- Encodes local reality

---

## Technical Notes

- Supabase-friendly
- Admin-managed attributes
- Host-managed listing attributes
- Public read access
- No traditional backend required

---

## Goal

Provide truthful, comparable, and culturally relevant information about listings.

Claude (and humans) are welcome to extend or refine this system.
