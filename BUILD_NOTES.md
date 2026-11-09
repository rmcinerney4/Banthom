# Banthom prototype: build notes

**Prototype:** https://claude.ai/artifact/9DnWadW3Bp5YwyNExxh6Pu (private until shared)
**Source of truth:** `DESIGN_SPEC.md` v1.0 from the *Signal Terminal Complete Design Package* (Nov 6, 2026)
**Status:** Clickable front-end prototype on simulated data. Not production code, no backend.

## Decisions taken in the prototype

- **Brand:** Banthom replaces the provisional name “Signal Terminal”. Logo mark follows §3.6: three offset vertical ticks in a rounded square, legible at 16px.
- **Venues:** two fictional venues stand in for licensed feeds: *Arden Exchange (ARD)*, USD contracts, and *Brisa Markets (BRS)*, USDC shares. No real venue names, logos or prices appear.
- **Data:** a deterministic DEMO snapshot as of Nov 6, 2026, 2:15 PM ET. A simulated feed nudges prices every few seconds. Pausing it lets timestamps age into “Delayed”, so nothing is ever fabricated as fresh. Headlines and sources are fictional and labelled as such.
- **Theme:** dark only, as §3.2 makes dark the default and a light terminal a phase-2 item.
- **Demo scenarios** (switcher in the DEMO banner): Normal, Brisa feed delayed, New account (empty), Research sources unavailable. These exercise the stale, empty and AI-failure states from §6.3.

## What is built

- **Public site:** homepage with all 12 sections in §4.1, pricing (placeholder prices flagged), methodology, sign-up / log-in / password reset, 3-step onboarding. Every other public route in §2.1 resolves to a page that names its planned sections.
- **Terminal shell:** 232px sidebar with a 68px rail at 1024–1439px, a drawer on tablets and a bottom tab bar on phones. Top bar has breadcrumbs, source freshness and alerts. Command palette opens with ⌘K, Ctrl K or /.
- **Terminal screens:** Overview dashboard, Market Explorer (filters, presets, saved views, column picker, sorting, keyboard rows), market detail (quote strip, chart with gaps, event markers, overlay, Yes/No, table view, rules, order book, research panel), event intelligence, cross-venue compare list and detail (clause diff, modeled depth, payoff matrix, spread history), alerts with editor and history, watchlists, research feed and a cited report, settings (appearance), help.
- **Checked:** 23 routes at 1440, 1024, 768 and 390px with no console errors, no horizontal scroll and one H1 per page. A 30-step click-through covers search, filters, alerts, comparison, scenarios, sign-up and onboarding.

## Conflicts in the spec (resolve before production)

1. **Radius tokens:** `design-tokens.json` gives sm 4 / md 8 / lg 12 / xl 16; §3.5 gives xs 4 / sm 6 / md 10 / lg 14 / xl 20. The prototype follows §3.5.
2. **Mobile tab bar:** §5.1 lists Home, Markets, Compare, Research, More; §7.1 lists Overview, Markets, Watchlists, Alerts, More. The prototype follows §5.1.
3. **Sidebar width:** 232px in §3.4 and §5.1 vs 256px at ≥1440px in §7.1. The prototype uses 232px.
4. **Hero copy:** §4.1 (“See the probability. Understand the event.”) vs §9.2 (“A clearer view of what the world expects.”). The prototype uses §4.1.
5. **Phone gutters:** §7.1 allows 12px below 390px; the prototype keeps a 16px minimum.
6. **`accent.subtle` (#123847)** appears in §3.2 but not in `design-tokens.json`.

## Accessibility and chart adjustments

- **Chart colour 2** moved from #B39AF7 to #C58AF9. Next to chart-1 cyan, the original failed a deuteranopia separation check (ΔE 5.1). The new pair scores 6.4, and the series also carry dash patterns, as §5.6 asks.
- **Form-control outline:** new token `#5E7286` gives 3.4:1 against the surface. `border.strong` (#425365) gives 2.2:1, below the 3:1 that WCAG 1.4.11 requires for controls.
- **Text contrast:** every text token passes 4.5:1 on every surface. The lowest is `text.muted` on `accent.subtle`, at 4.77:1.
- **Chart behaviour:** charts never interpolate across feed gaps. Markers show timing, not cause. Every chart has a keyboard-readable crosshair and a data-table view.

## Not in the prototype

Production stack from §8 (Next.js, API, Postgres/Timescale, auth, billing), licensed feeds, column resize and reorder, workspaces canvas, analytics, admin and match-review tools, light theme, timezone picker, email and push delivery.
