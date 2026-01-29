# Design System & Vibe

## The Vibe
- **Aesthetic:** **Strictly Academic.** Clean, distraction-free, high-contrast.
- **Philosophy:** The UI should recede. Content (the assignment) is king. No unnecessary animations or gamification "fluff".
- **Target Audience:** Students (need clarity and focus) and Teachers (need data density and reliability).

## Visual Rules
- **Framework:** Raw CSS (BEM-lite naming convention).
- **Key Files:** - `css/styles.css`: Student assignment view (Stepper layout).
  - `dashboard/teacher.css`: Teacher dashboard (3-pane layout).
- **Typography:** System fonts (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, etc.) for maximum legibility and zero load time.

## Color Palette (Extracted from CSS)
- **Backgrounds:** `#f8f9fa` (Page/Sidebar), `#ffffff` (Cards/Content).
- **Text:** `#212529` (Body), `#495057` (Subtitles), `#6c757d` (Muted/Idle).
- **Primary Action:** `#007bff` (Standard Bootstrap Blue).
- **Success/Active:** `#28a745` (Green).
- **Error/Alert:** `#dc3545` (Red).
- **Presence Indicators (Teacher View):**
  - 🟢 **Active (< 30s):** `#28a745` (Pulse animation).
  - 🟡 **Recent (< 5m):** `#ffc107` (Yellow).
  - ⚫ **Idle/Offline:** `#6c757d` (Gray).

## UI Components
- **Stepper Sidebar:** Left-aligned navigation. Active step highlighted blue.
- **Quill Editor:** Standard snow theme. Minimal toolbar (`bold`, `italic`, `underline`, `lists`).
- **Teacher Dashboard:** 3-Pane Layout (Navigation | Student List | Detail View). Density is preferred over whitespace.