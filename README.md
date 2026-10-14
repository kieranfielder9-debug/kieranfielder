# kieranfielder

A responsive fintech landing page template laid out like a modern payments homepage. It's plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

It also works on GitHub Pages as-is, because `index.html` sits at the repo root.

## Structure

```
index.html            page markup (all copy lives here)
assets/css/styles.css styles; design tokens at the top in :root
assets/js/main.js     menu, live counter, marquee, charts, globe, modal, scroll effects
```

## Page sections

1. **Header**: logo, desktop nav, and a hamburger menu on mobile
2. **Hero**: animated diagonal gradient, a live-ticking metric, a two-tone headline and two CTAs
3. **Logo strip**: an auto-scrolling marquee of customer logos
4. **Feature cards** (2-column grid on desktop, stacked on mobile). Each card has an expand button that opens a modal:
   - Payments: a card terminal plus a checkout form
   - Billing: a plan card, a usage meter and an animated bar chart
   - Agentic commerce: a chat with product cards
   - Card issuing: a tilted gradient card
   - Money movement: a dotted canvas globe with animated arcs
   - Platforms: an order summary plus a connected-accounts list
5. **Event banner**: a gradient promo with a "Watch now" CTA
6. **Stats**: a dark section with numbers that count up
7. **Enterprise**: copy, CTA and a case-study card
8. **Final CTA** and **footer**
9. A floating **back-to-top** button

## Customising

- **Brand colours and fonts**: edit the variables at the top of `styles.css` (`--accent`, `--ink`, `--g1`…`--g5` for the gradient, `--font`).
- **Name and copy**: search `index.html` for `Brandname` / `brandname`.
- **Logos and photos**: the logo strip uses text wordmarks, and the event banner and case study use CSS placeholders. Each has a comment showing where to drop in an `<img>`.
- **Modal text**: each feature card has a `<template class="modal-body">` holding the text its expand button shows.
- **Chart data**: edit the `usage` array in `main.js`.
- **Live counter**: set the `data-start`, `data-step` and `data-decimals` attributes on `[data-live-counter]`.
- **Stats**: set `data-count-to`, `data-prefix`, `data-suffix` and `data-decimals` on each `.stat-num`.

All motion turns off when the visitor has reduced motion enabled.
