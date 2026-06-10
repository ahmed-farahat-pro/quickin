# QuickIn – Design Specifications
## Warm Boutique Booking Platform (Web & Mobile)

> Product goal: A calm, warm, experience-first booking platform.  
> Visual identity: Boutique hotel, travel journal, soft sunlight, emotional browsing.  
> NOT a techy SaaS dashboard. NOT trend-chasing.

---

## 1. Core Design Philosophy

- Warm, sepia-like aesthetic
- Human, calm, emotional browsing
- Discovery-first, not form-first
- Trust and clarity over visual tricks
- Soft, rounded, friendly UI
- Minimal, breathable layouts

**Guiding Rule:**
> If it floats → glass  
> If it holds content → solid

---

## 2. Color System

### Brand Primary
```
Burgundy / Wine Red
HEX: #5B0F16
```

---

### Backgrounds
```
Main Background (Cream Beige): #F6F1E6
Secondary Background:          #EFE6D8
```

---

### Cards
```
Solid White: #FFFFFF
```

---

### Text Colors
```
Primary Text: #2B2B2B
Muted Text:   #7A746A
```

---

### Borders & Dividers
```
Border:   #E2D8C8
Divider:  #D6CCBC
```

---

## 3. Glass UI (Selective Use Only)

### Allowed Glass Areas
- Search bar
- Sticky navbar
- Floating filters
- Modals
- Bottom sheets
- Quick action overlays

### Glass Recipe
```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(10px);
border: 1px solid rgba(255,255,255,0.35);
```

---

## 4. Border Radius System

```
Cards:        26–28px
Buttons:      20–22px
Inputs:       18px
Images:       20px
Modals:       28–32px
```

---

## 5. Buttons

### Primary CTA
```css
background: #5B0F16;
color: #F6F1E6;
border-radius: 20px;
padding: 14px 26px;
```

---

## 6. Cards (Listings)

```css
background: #FFFFFF;
border-radius: 28px;
box-shadow: 0 10px 30px rgba(0,0,0,0.06);
```

---

## 7. Typography

### Body Text
| Language | Font | Character |
|----------|------|-----------|
| English | DM Sans | Soft, rounded, friendly, modern but warm |
| Arabic | IBM Plex Arabic | Clean, calm, neutral, professional but not corporate |

### Hero Headlines ONLY
| Language | Font | Usage |
|----------|------|-------|
| English | Playfair Display | Hero headlines only |
| Arabic | Amiri | Hero headlines only |

> ⚠️ Use Playfair Display / Amiri ONLY for hero headlines. All other text uses DM Sans / IBM Plex Arabic.

---

## 8. UX Mental Model

> “Browsing a travel magazine, not filling a booking form.”

---

## 9. Explicit Non-Goals

- No dark mode
- No neon colors
- No SaaS dashboard visuals
