# Migros Watch & Save — iPad self-checkout prototype (v2)

A standalone, multi-screen **student concept** for the Digital Business Innovation course at the University of Zurich. It is **not** a product of Migros, and does not take payments, issue real vouchers or connect to Cumulus/POS systems.

## Start in VS Code

1. Extract the ZIP and copy its contents into your repository (or use as a new folder).
2. Copy your **own** `short.mp4` and `long.mp4` into the **same folder as `index.html`**. These MP4s are not included in this ZIP, since only you have those files.
3. Open `index.html` using **Live Server** (VS Code) for desktop testing. Opening it directly by double-click also works for selecting products, videos (usually), manual barcodes and offline coupon QR. Live Server is recommended.
4. On an iPad, host the app on **GitHub Pages** or another **HTTPS** host and open the URL in Safari. The project is all static files; no build or Node.js required.

Your folder should look like:

```
watchsave/
  index.html
  styles.css
  app.js
  catalog.js
  barcodes.js
  barcode-sheet.html
  demo-barcodes-A4.pdf       <-- ready-to-print labels
  short.mp4                 <-- add your own 30-second MP4
  long.mp4                  <-- add your own 60-second MP4
  vendor/
    qr-code.js
```

## Demo walkthrough

1. The shopping basket is empty. Tap a product, enter a 13-digit barcode, use a Bluetooth/USB keyboard scanner or activate the iPad camera scanner.
2. Press **Finish scanning**. Choose to watch an optional ad, or skip and pay normally.
3. Choose **30 seconds** (0.5% off, maximum CHF 5) or **60 seconds** (1% off, maximum CHF 10).
4. Watch `short.mp4` / `long.mp4` to completion. The video is muted by default. If the MP4 file is missing, use **Run timed demo instead**; the simulated commercial still lasts 30 or 60 seconds.
5. Choose an **immediate discount** or a **future coupon worth twice that discount**. The doubling is applied **after** the original maximum cap, so the maximum future coupon is CHF 10 / CHF 20.
6. Review the transaction and use the QR/print/save buttons for the future coupon, if chosen. **Pay** is a simulation.

## Scanning and printed barcode labels

Open `barcode-sheet.html` and print it on A4, **or print the included `demo-barcodes-A4.pdf` at 100% size**. **Only these ten generated EAN-13 barcodes work in the app.** If you bring real products, attach the corresponding printed barcode label to each item; the actual product barcode will probably not match the demo catalog. The prefix 29 is intended for restricted in-store-style identifiers, not international retail identification.

**Camera scanning:** The camera scanner is loaded from `html5-qrcode@2.3.8` on jsDelivr the first time the Scan with camera button is pressed. The iPad must have internet access to load it. Safari on iPad also requires **HTTPS** and camera permission. If you want a presentation with **no internet dependence**, use the built-in tap selection, type the barcodes manually, or connect a Bluetooth scanner acting as a keyboard. The QR _generator_ for coupons is bundled locally and works offline.

**Phone coupon QR:** When using the site from a public HTTPS address (e.g. GitHub Pages), scanning the generated QR on a smartphone opens a read-only digital demo coupon on that site. When run from `file://`, `localhost` or a local network HTTP address, the QR contains the voucher data as text instead, since the smartphone cannot access a desktop-only local address. The coupon is not secured or redeemable; no real backend or validation exists.

## Presentation shortcut

Open `index.html?presenter=1` on your hosted demo to show a **Presenter: finish now** button only during video playback. This is for rehearsing the screens quickly. Omit `?presenter=1` for audience-facing user testing so the complete video or timed simulation must run.

## Customize products and prices

All 10 demo products live in `catalog.js` (name, price, emoji, category, barcode). Change the names, prices, and emojis there; the product tiles, basket, and printable barcode sheet will automatically update. If you change a barcode, use a valid EAN-13 check digit.

## Calculation examples

- Basket CHF 50.00 + 30-sec ad: CHF 0.25 off now or a CHF 0.50 future coupon.
- Basket CHF 50.00 + 60-sec ad: CHF 0.50 off now or a CHF 1.00 future coupon.
- Basket CHF 1,500.00 + 30-sec ad: CHF 5.00 off now (cap) or a CHF 10.00 future coupon.
- Basket CHF 1,500.00 + 60-sec ad: CHF 10.00 off now (cap) or a CHF 20.00 future coupon.

Money is calculated in **integer centimes**, then rounded to the nearest centime before applying the cap. Swiss cash rounding to the nearest CHF 0.05 is **not** simulated (this is a payment UI demo, not a checkout system).

## Project notes

The advertised percentages and durations in this v2 differ from the original blueprint proposal (8 seconds / CHF 0.20 / item-specific). Update the business-model and financial sections of your university presentation to match the new mechanic. Assumptions about advertiser funding, consumer consent, and coupon legality still need independent validation.

The embedded QR-code module is based on Kazuhiko Arase's **QRCode for JavaScript** (MIT). The camera library `html5-qrcode` (Apache 2.0) is fetched from its public CDN only when scanning is requested. No analytics or customer data are sent by this demo; some library/CDN requests are made if the camera feature is activated.
