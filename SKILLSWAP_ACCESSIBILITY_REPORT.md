# SkillSwap Accessibility and Responsive QA

Date: 2026-08-23

## Scope

Core public, authentication, dashboard, discovery, booking, chat, settings, safety, and admin structures were reviewed through browser semantic snapshots and source-level keyboard/focus inspection. Existing six-width evidence (1440, 1280, 1024, 768, 430, 390) was rechecked against the changed landing/dashboard layouts and breakpoint classes.

## Keyboard and Focus

- Navigation uses links/buttons with visible global `:focus-visible` treatment.
- Dialog primitives move focus, contain Tab/Shift+Tab, close with Escape, and restore the trigger.
- Forms have accessible labels and errors; tabs expose keyboard semantics.
- Chat attachment/share/call/report controls have accessible names. Messages use a polite live region.
- No newly introduced keyboard traps were found.

## Semantics

The updated dashboard has one H1, labeled priority and recommendation regions, ordered H2/H3 structure, status/error announcements, descriptive links, and decorative icons hidden from assistive technology. Images have alternatives. Loading states use `role=status` plus screen-reader text.

## Responsive Results

The landing and dashboard use single-column mobile flow, `min-w-0` where text competes with controls, wrapping actions, and desktop grids only at `lg`. The shell replaces the sidebar with a fixed five-item mobile navigation. Chat uses a capped conversation list above the thread on mobile. Tables are contained by responsive overflow wrappers. No fixed content width below the 320 px application minimum was introduced.

## Reduced Motion

`prefers-reduced-motion: reduce` disables smooth scrolling, transitions, and repeated animation. Skeleton animation reduces to a near-zero single iteration. Dashboard scrolling and chat updates do not require motion to convey state.

## Limitations

This is not a formal WCAG conformance claim. Automated axe coverage and real VoiceOver/NVDA sessions are not configured. WebRTC device permission dialogs and third-party browser UI were outside scope.
