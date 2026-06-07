# Kameraad Haarsnijder — UAT Checklist (client acceptance)

> Run this against the **staging/preview deployment** (Vercel preview + a staging
> database) before the production cutover. Tick every box; record sign-off + date
> at the bottom. Items marked _(prod-only)_ are re-verified after go-live.
> Staging stays **noindex** (`NEXT_PUBLIC_ALLOW_INDEXING` unset).

## A. Public site — content & language
- [ ] Home loads on mobile (360px) and desktop; hero, barbers, services, next-slot preview, Book CTA, footer all present.
- [ ] Seasonal banner: when the admin activates a banner it appears on the home within ~60s (no redeploy); when inactive, no banner shows.
- [ ] Barber cards show the correct **confirmed** names, photos, bios; "Book with X" deep-links preselect that barber.
- [ ] Services list shows the **confirmed** names, descriptions, prices (€), durations.
- [ ] Walk-in is shown as info only (not bookable).
- [ ] Language switcher: NL / EN / FR / ES / Leuvens all work and preserve the current page.
- [ ] NL copy is final; EN/FR reviewed; **ES + Leuvens copy reviewed & approved** (currently DRAFT).
- [ ] About + Contact + Privacy pages render in all 5 locales with correct address/phone/hours/BTW.
- [ ] Footer shows address + privacy link, **no social links** (by design, FR-100).

## B. Booking flow (end-to-end)
- [ ] Book a haircut with a chosen barber → confirmation screen + confirmation email + `.ics` attachment _(prod-only for real email)_.
- [ ] Book with "No preference" → a barber is assigned and shown before confirm.
- [ ] Next-slot preview chip → lands on booking step 3 with service/date preselected.
- [ ] Empty day shows "no slots" + next-available shortcut.
- [ ] Two people booking the same slot → one succeeds, the other gets a friendly "slot just taken" (never an error page).
- [ ] Cancellation-policy + privacy checkboxes are required; policy text shows the live cancellation window.
- [ ] Cancel via the email link inside the window works; outside the window is blocked with an explanation.
- [ ] Reschedule via the email link moves the appointment; the old slot frees up; an updated `.ics` is sent.
- [ ] Preferences/unsubscribe link toggles the opt-ins.

## C. Localized URLs & redirects
- [ ] `/afspraak-maken` → 301 to `/nl/boeken`.
- [ ] `/en/book`, `/fr/reserver`, `/es/reservar` → 301 to the canonical `/{locale}/boeken` (query params preserved).
- [ ] Other confirmed legacy Webflow URLs redirect correctly _(pending the full harvested inventory — see PR)_.

## D. Admin (back-office, NL)
- [ ] Owner login works; barber login works; 6 failed logins lock the account _(threshold per FA = 5; confirm)_.
- [ ] Owner invites a barber → set-password link → that barber can log in.
- [ ] Day/week/month calendars show bookings; click → detail drawer with the right actions per role.
- [ ] Manual (walk-in/phone) booking can be added; no-email customers excluded from email.
- [ ] Admin cancel (with/without notify) + reschedule + no-show (after start) + complete all work.
- [ ] Hours editor + blocked-period editor; blocking over an appointment shows the conflict dialog (keep / cancel+notify).
- [ ] CRM search/detail; GDPR JSON export; GDPR purge with type-`VERWIJDER` removes all PII.
- [ ] Services editor, banner editor, settings, statistics, bulk mailing (marketing opt-out respected) — owner-only items hidden from barbers.

## E. SEO & performance _(staging values; re-confirm prod after indexing is enabled)_
- [ ] `/sitemap.xml` lists all public pages × locales with hreflang (x-default = nl).
- [ ] `/robots.txt` = **noindex/disallow** on staging; **allow** in production after go-live.
- [ ] JSON-LD passes the Google Rich Results Test (HairSalon).
- [ ] Lighthouse mobile (home + booking step 3): ≥ 90 performance, ≥ 95 SEO, ≥ 95 accessibility.
- [ ] No console errors; images load via `next/image`; no major layout shift.

## F. Data & privacy
- [ ] All **PROVISIONAL** data replaced with confirmed client values (hours, matrix, prices, copy).
- [ ] Privacy policy reviewed (ideally by the client's legal contact).
- [ ] EU data residency confirmed (DB region); daily backups enabled + a restore tested.

---

**UAT result:** ☐ Accepted ☐ Accepted with notes ☐ Rejected

Signed (client): __________________________  Date: ____________

Notes:
