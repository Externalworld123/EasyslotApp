
# Tiered Subscription Access Control — Implementation Plan

## What Already Exists
- ✅ `plans` table with `name`, `price_monthly`, `max_centers`, `max_resources`, `max_users`, `features` (jsonb)
- ✅ `organizations` table with `plan_id`, `billing_status`, `subscription_start`, `subscription_end`
- ✅ Organization-level plan assignment

## Changes Required

### 1. Database Migration
**Extend `organizations` table:**
- `grace_period_days` (integer, default 7) — days of access after expiration
- `amount_agreed` (numeric) — custom pricing override per org
- `renew_date` (timestamptz) — next renewal date

**Extend `plans` table:**
- `allow_bookings` (boolean, default true) — master booking toggle
- `module_access` (jsonb) — granular feature map like `{"analytics": true, "api_access": false, "multi_user": true, "monthly_plans": true, "pricing_rules": false, "expenses": false}`

### 2. Validation Function (DB level)
- `is_subscription_valid(org_id)` — returns boolean, checks `subscription_end + grace_period_days >= now()`
- `org_has_module_access(org_id, module_key)` — returns boolean, checks plan's module_access

### 3. Frontend Access Guard
- `useSubscription()` hook — fetches org subscription status + plan features
- `<ModuleGuard module="analytics">` component — wraps pages/features, shows upgrade prompt if blocked
- Integrate into sidebar to grey out/hide locked modules

### 4. Edge Function Guard
- Add subscription validation to `start-session` and `public-booking` edge functions when `allow_bookings` is false

## Module Keys
`analytics`, `api_access`, `multi_user`, `monthly_plans`, `pricing_rules`, `expenses`, `reports`, `approvals`, `marshal_view`
