# Sentinel Journal

## 2024-05-22 - Admin API Lockout due to Schema Misalignment
**Vulnerability:** Critical admin API endpoints (listings, payouts, payments, warnings, bans, messages) were inaccessible because they queried `staff_profiles` using a non-existent `user_id` column instead of the primary key `id`.
**Learning:** Inconsistent column naming (using `user_id` in some tables vs `id` as PK/FK in others) led to copy-paste errors that broke authorization logic. This highlights the importance of consistent schema conventions and integration testing for admin routes.
**Prevention:** Enforce consistent foreign key naming conventions. Ensure `staff_profiles` lookups consistently use `id` when it maps 1:1 to `auth.users`. Add automated tests for admin endpoints to catch availability issues.

## 2024-05-22 - Unprotected AI Endpoint Resource Exhaustion
**Vulnerability:** The `/api/chat` endpoint was publicly accessible and lacked input length validation, allowing unauthenticated users to send unlimited length messages. This creates a Denial of Service (DoS) risk and potential financial exhaustion of the Gemini API quota.
**Learning:** AI features are often treated as "add-ons" and miss standard API protections like rate limiting and payload validation. Because AI processing is expensive (tokens/latency), these endpoints are high-value targets for DoS.
**Prevention:** Always enforce strict input limits (length, complexity) and rate limiting on AI endpoints. Where possible, require authentication for expensive features.

## 2024-05-24 - Unauthenticated Test Endpoint Exposing Internal State
**Vulnerability:** A test endpoint (`/api/test-fcm`) used `SUPABASE_SERVICE_ROLE_KEY` to access the database without any authentication or authorization checks. Furthermore, the endpoint exposed internal state by returning `error.stack` in its error responses.
**Learning:** Development and test endpoints left exposed in production environments can lead to severe data breaches, especially if they possess elevated privileges (like the Supabase service role key) or leak stack traces that give attackers insights into the server's internal workings.
**Prevention:** Always restrict test endpoints using explicit environment checks (e.g., `if (process.env.NODE_ENV !== 'development') return 404`). Never return raw error messages or stack traces (`error.stack`) in public API responses; instead, return generic error messages (e.g., "An internal server error occurred") and log the details securely on the server side.

## 2026-02-14 - Admin Ban Duration Manipulation via Type Coercion
**Vulnerability:** The admin ban API accepted `duration_days` as a raw value from the JSON body without type validation. When a string (e.g., `"1"`) was provided, JavaScript's `+` operator performed string concatenation with the date (e.g., `22 + "1" = "221"`), setting the ban expiration date months or years into the future instead of days.
**Learning:** Relying on implicit type coercion in API handlers is dangerous, especially for date calculations. Without strict schema validation (like Zod), frontend bugs or malicious payloads can silently alter business logic in severe ways.
**Prevention:** Always use a validation library (Zod, Yup, etc.) to enforce types and constraints on API inputs. Specifically, coerce and validate numeric inputs before using them in arithmetic operations.
