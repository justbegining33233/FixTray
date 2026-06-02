# Cross-Role 10/10 Quality Standard

## Scope

This standard applies to every role and every page:
- admin
- superadmin
- shop
- manager
- tech
- customer
- public and marketing routes

## Scoring Framework

Use a 100-point score per page.

- Visual Consistency: 20
- Interaction Quality: 20
- Navigation Clarity: 15
- Mobile Handheld Behavior: 15
- Accessibility and Readability: 15
- Performance and Stability: 15

A page is considered release quality when:
- score >= 85
- no P1 issues
- no broken route or auth-loop behavior

A role is considered 10/10 ready when:
- role average >= 92
- no page below 85
- top 5 role workflows pass handheld QA

## Non-Negotiable Gates

1. No horizontal overflow on handheld widths.
2. No unreadable text contrast in primary workflow surfaces.
3. No dead-end navigation from core route paths.
4. No blocking interaction jank on open/close overlays.
5. No broken links in role nav and cross-role entry points.

## Shared System Requirements

1. Role pages must render inside the shared role route shell.
2. Mobile pages must use safe-area aware spacing and single-scroll behavior.
3. Accent usage must be consistent and intentional.
4. Surface elevation and border contrast must follow tokenized values.
5. Motion must respect reduced-motion user preferences.

## Operating Model

1. Run scripts/audit-cross-role-quality.js after major UI changes.
2. Review docs/reports/cross-role-quality-report.md.
3. Fix shared-shell issues first, then role-specific outliers.
4. Re-run audit and handheld QA until each role meets threshold.
