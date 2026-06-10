## 2025-05-27 - Icon-Only Buttons Accessibility
**Learning:** Icon-only buttons often lack `aria-label` attributes, making them inaccessible to screen readers. In complex components like Search Bars with multiple variants (hero vs. default), these buttons can be duplicated, requiring careful inspection to ensure all instances are labeled.
**Action:** Always check all variants of a component when applying accessibility fixes. Use `grep` or search to find all instances of `size='icon'` buttons to ensure none are missed.
## 2026-03-29 - Added aria-labels to Chat Widget
**Learning:** Floating action buttons and icon-only close/submit buttons within chat interfaces often lack ARIA labels, making them inaccessible to screen readers.
**Action:** Ensure all `size="icon"` buttons, especially in dynamic floating widgets, have dynamic or static `aria-label` attributes derived from translations.
