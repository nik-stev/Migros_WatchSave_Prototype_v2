/* Migros Watch & Save · Independent student demo
 * 10 demo products. Videos short.mp4 / long.mp4 next to index.html.
 * QR coupons are mock vouchers, not Migros-issued or redeemable.
 */
(() => {
  "use strict";
  const products = window.WATCHSAVE_PRODUCTS;
  const productByCode = new Map(products.map((p) => [p.code, p]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const basket = new Map();
  const $ = (id) => document.getElementById(id);
  const money = (c) => `CHF ${(c / 100).toFixed(2)}`;
  const cents = (n) => Math.round(n * 100);
  const config = {
    short: { file: "short.mp4", seconds: 30, rate: 0.005, cap: 500 },
    long: { file: "long.mp4", seconds: 60, rate: 0.01, cap: 1000 },
  };
  let page = "shopping",
    selectedLength = null,
    rewardChoice = "skip";
  let unlocked = false,
    coupon = null,
    scanner = null,
    scanning = false,
    lastScan = 0;
  let playbackMode = null,
    fallbackTimer = null,
    fallbackStart = 0;
  let soundEnabled = true; // Play MP4 with audio by default; the shopper can mute it.
  let toastTimer;
  const presenter =
    new URLSearchParams(location.search).get("presenter") === "1";

  // Coupon-only page for phones, when the QR is scanned on a hosted deployment.
  const params = new URLSearchParams(location.search);
  if (params.has("coupon")) {
    const amount = Number(params.get("amount"));
    const code = params.get("coupon") || "";
    if (
      /^WS-DEMO-[A-Z0-9]{6,18}$/.test(code) &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      amount <= 20
    ) {
      $("appShell").classList.add("hidden");
      $("phoneCoupon").classList.remove("hidden");
      $("phoneCouponAmount").textContent = `CHF ${amount.toFixed(2)}`;
      $("phoneCouponCode").textContent = code;
      $("phoneCouponQr").innerHTML = qrSVG(
        `WATCHSAVE DEMO | ${code} | CHF ${amount.toFixed(
          2
        )} | NOT VALID IN STORES`
      );

      $("phoneDownloadCoupon").addEventListener("click", downloadPhoneCoupon);

      return;
    }
  }

  function qrSVG(content, size = 190) {
    const qr = new window.WatchSaveQR(-1, 1);
    qr.addData(content);
    qr.make();
    const data = qr.modules,
      count = data.length,
      quiet = 4,
      unit = 1,
      total = count + quiet * 2;
    let bits = "";
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++) {
        if (data[y][x])
          bits += `<rect x="${x + quiet}" y="${
            y + quiet
          }" width="${unit}" height="${unit}"/>`;
      }
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code for demo voucher" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#172e41">${bits}</g></svg>`;
  }

  function downloadPhoneCoupon() {
    const params = new URLSearchParams(location.search);
    const code = params.get("coupon");
    const amount = Number(params.get("amount"));

    if (
      !/^WS-DEMO-[A-Z0-9]{6,18}$/.test(code || "") ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 20
    )
      return;

    const qr = qrSVG(
      `WATCHSAVE DEMO | ${code} | CHF ${amount.toFixed(
        2
      )} | NOT VALID IN STORES`,
      260
    );

    const image = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="500" height="720" viewBox="0 0 500 720">
  
        <rect width="500" height="720" fill="#fffaf5"/>
  
        <text x="250" y="90" text-anchor="middle"
              font-family="Arial" font-size="32"
              font-weight="bold" fill="#17334d">
          WATCH &amp; SAVE
        </text>
  
        <text x="250" y="145" text-anchor="middle"
              font-family="Arial" font-size="17"
              fill="#596b7a">
          FUTURE DEMO COUPON
        </text>
  
        <text x="250" y="250" text-anchor="middle"
              font-family="Arial" font-size="58"
              font-weight="bold" fill="#d85610">
          CHF ${amount.toFixed(2)}
        </text>
  
        <svg x="120" y="305" width="260" height="260"
             viewBox="0 0 260 260">
          ${qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}
        </svg>
  
        <text x="250" y="615" text-anchor="middle"
              font-family="Arial" font-size="19"
              fill="#17334d">
          ${code}
        </text>
  
        <text x="250" y="660" text-anchor="middle"
              font-family="Arial" font-size="12"
              fill="#8a9aa5">
          ACADEMIC DEMO - NOT REDEEMABLE
        </text>
      </svg>
    `;

    const blob = new Blob([image], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `watch-save-${code}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toast(message) {
    const t = $("toast");
    t.textContent = message;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 3600);
  }
  function itemCount() {
    return Array.from(basket.values()).reduce((a, n) => a + n, 0);
  }
  function subtotalCents() {
    let total = 0;
    for (const [id, qty] of basket)
      total += cents(productById.get(id).price) * qty;
    return total;
  }
  function savingsFor(length) {
    const opt = config[length];
    return Math.min(opt.cap, Math.round(subtotalCents() * opt.rate));
  }
  function rewardCents() {
    return selectedLength ? savingsFor(selectedLength) : 0;
  }
  function currentTotalCents() {
    return Math.max(
      0,
      subtotalCents() - (rewardChoice === "now" ? rewardCents() : 0)
    );
  }
  function hasCoupon() {
    return rewardChoice === "coupon" && unlocked && coupon !== null;
  }

  function go(next) {
    if (page === "video" && next !== "video") stopPlayback();
    document
      .querySelectorAll("section.screen")
      .forEach((el) => el.classList.add("hidden"));
    $("page-" + next).classList.remove("hidden");
    page = next;
    const stages = {
      shopping: ["01 / 05 · Shopping", 20],
      offer: ["02 / 05 · Your choice", 40],
      duration: ["03 / 05 · Video length", 60],
      video: ["03 / 05 · Advertisement", 60],
      reward: ["04 / 05 · Your reward", 80],
      summary: ["05 / 05 · Checkout", 100],
      paid: ["05 / 05 · Complete", 100],
    };
    $("stepLabel").textContent = stages[next][0];
    $("stepFill").style.width = stages[next][1] + "%";
    if (next === "offer") renderReview("reviewOffer");
    if (next === "duration") renderDuration();
    if (next === "reward") renderReward();
    if (next === "summary") renderSummary();
    if (next === "video") initVideoPage();
    if (next === "paid") renderPaid();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // Product list; SVG-style category backgrounds work without outside images.
  function drawCatalog() {
    $("productGrid").innerHTML = products
      .map(
        (p) => `
      <button type="button" class="product-tile" data-product="${
        p.id
      }" aria-label="Add ${p.name}">
        <span class="product-art" style="background:${p.tint}"><span>${
          p.emoji
        }</span></span>
        <span class="product-tile-name">${
          p.name
        }</span><span class="product-tile-detail">${p.detail}</span>
        <span class="product-tile-bottom"><strong class="product-price">${money(
          cents(p.price)
        )}</strong><span class="tile-plus">+</span></span>
        <span class="product-qty-badge hidden" data-qty-for="${p.id}">0</span>
      </button>`
      )
      .join("");
    $("productGrid").addEventListener("click", (event) => {
      const tile = event.target.closest("[data-product]");
      if (tile) addProduct(tile.dataset.product);
    });
  }
  function addProduct(id) {
    const p = productById.get(id);
    if (!p) return;
    basket.set(id, (basket.get(id) || 0) + 1);
    renderBasket();
    toast(`${p.name} added · ${money(cents(p.price))}`);
  }
  function adjustQuantity(id, delta) {
    const count = (basket.get(id) || 0) + delta;
    if (count <= 0) basket.delete(id);
    else basket.set(id, count);
    renderBasket();
  }
  function renderBasket() {
    const count = itemCount();
    $("basketCount").textContent = count;
    $("basketSubtotal").textContent = money(subtotalCents());
    $("checkoutButton").disabled = count === 0;
    $("basketItems").innerHTML = count
      ? Array.from(basket)
          .map(([id, qty]) => {
            const p = productById.get(id);
            return `<div class="basket-item">
        <span class="basket-item-art" style="background:${p.tint}">${
              p.emoji
            }</span>
        <div class="basket-item-main"><div class="basket-item-name">${
          p.name
        }</div><div class="basket-item-detail">${p.detail}</div></div>
        <div class="basket-item-end"><strong>${money(
          cents(p.price) * qty
        )}</strong><div class="qty-controls">
          <button type="button" data-change="-1" data-id="${id}" aria-label="Remove one ${
              p.name
            }">−</button><span>${qty}</span>
          <button type="button" data-change="1" data-id="${id}" aria-label="Add one ${
              p.name
            }">+</button>
        </div></div></div>`;
          })
          .join("")
      : `<div class="empty-cart"><div class="empty-icon">🛍️</div><strong>Your basket is empty</strong><span>Scan or select a product to begin.</span></div>`;
    for (const p of products) {
      const badge = document.querySelector(`[data-qty-for="${p.id}"]`);
      const qty = basket.get(p.id) || 0;
      badge.textContent = qty;
      badge.classList.toggle("hidden", qty === 0);
    }
  }
  $("basketItems").addEventListener("click", (event) => {
    const button = event.target.closest("[data-change]");
    if (button)
      adjustQuantity(button.dataset.id, Number(button.dataset.change));
  });

  function addByBarcode(code) {
    const clean = String(code).replace(/\D/g, "");
    if (!window.WatchBarcodes.valid(clean)) {
      toast("Not a valid 13-digit EAN barcode. Use the demo barcode sheet.");
      return false;
    }
    const p = productByCode.get(clean);
    if (!p) {
      toast("Barcode not found in the 10 demo products.");
      return false;
    }
    addProduct(p.id);
    $("barcodeInput").value = "";
    return true;
  }
  $("barcodeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addByBarcode($("barcodeInput").value);
  });
  // HID / Bluetooth barcode readers typically type into a focused field and send Enter.

  // Camera uses html5-qrcode, loaded only if user chooses to scan; iOS Safari compatible.
  let cameraLibraryPromise;
  function loadCameraLibrary() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (!cameraLibraryPromise)
      cameraLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
        script.onload = () =>
          window.Html5Qrcode
            ? resolve()
            : reject(new Error("Scanner not available"));
        script.onerror = () =>
          reject(
            new Error(
              "Could not load camera scanning library (internet required)"
            )
          );
        document.head.appendChild(script);
      }).catch((error) => {
        cameraLibraryPromise = null;
        throw error;
      });
    return cameraLibraryPromise;
  }
  async function stopScanner() {
    if (scanner) {
      try {
        if (scanning) await scanner.stop();
      } catch (error) {
        console.warn("Stop camera:", error);
      }
      try {
        scanner.clear();
      } catch (_) {}
    }
    scanner = null;
    scanning = false;
    $("cameraPanel").classList.add("hidden");
    $("reader").innerHTML = "";
  }
  $("openCamera").addEventListener("click", async () => {
    if (scanning) return;
    $("cameraPanel").classList.remove("hidden");
    $("cameraStatus").textContent = "Preparing the rear camera…";
    if (!window.isSecureContext) {
      $("cameraStatus").textContent =
        "On iPad, open the site over HTTPS for camera access. You can still select or enter products.";
      return;
    }
    try {
      await loadCameraLibrary();
      scanner = new Html5Qrcode("reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
        verbose: false,
      });
      await scanner.start(
        { facingMode: { exact: "user" } },
        {
          fps: 12,
          qrbox: (w, h) => ({
            width: Math.min(310, Math.max(120, w - 40)),
            height: Math.min(145, Math.max(90, h - 28)),
          }),
        },
        (decoded) => {
          const now = Date.now();
          if (now - lastScan < 1700) return;
          lastScan = now;
          if (addByBarcode(decoded)) {
            $("cameraStatus").textContent =
              "Product added. Hold another barcode up to scan again.";
          }
        },
        () => {}
      );
      scanning = true;
      $("cameraStatus").textContent =
        "Hold a demo EAN-13 barcode inside the highlighted frame.";
    } catch (error) {
      $("cameraStatus").textContent = `Camera unavailable: ${
        error.message || error
      }. Use manual entry or product buttons instead.`;
      try {
        if (scanner) scanner.clear();
      } catch (_) {}
      scanner = null;
    }
  });
  $("closeCamera").addEventListener("click", stopScanner);

  // Offer, length selection and video completion.
  function renderReview(target) {
    const rows = Array.from(basket, ([id, qty]) => ({
      p: productById.get(id),
      qty,
    }));
    $(
      target
    ).innerHTML = `<span class="eyebrow">SHOPPING OVERVIEW</span><h2>Your basket</h2>
      ${rows
        .map(
          ({ p, qty }) =>
            `<div class="review-item"><span>${qty}× ${
              p.name
            }</span><strong>${money(cents(p.price) * qty)}</strong></div>`
        )
        .join("")}
      <div class="review-total"><span>Subtotal</span><strong>${money(
        subtotalCents()
      )}</strong></div>
      <div class="review-note">✦ Your reward is calculated on your basket subtotal. Maximum caps apply.</div>`;
  }
  function renderDuration() {
    $("previewShortNow").textContent = money(savingsFor("short"));
    $("previewShortFuture").textContent = money(2 * savingsFor("short"));
    $("previewLongNow").textContent = money(savingsFor("long"));
    $("previewLongFuture").textContent = money(2 * savingsFor("long"));
  }
  function renderReward() {
    $("rewardNowAmount").textContent = money(rewardCents());
    $("rewardCouponAmount").textContent = money(rewardCents() * 2);
  }
  function stopPlayback() {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
    const video = $("adVideo");
    video.pause();
    playbackMode = null;
  }
  function setVideoProgress(elapsed, total) {
    const clamp = Math.min(Math.max(elapsed, 0), total);
    const clock = (v) =>
      `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(
        Math.floor(v % 60)
      ).padStart(2, "0")}`;
    $("videoProgressBar").style.width =
      ((clamp / total) * 100).toFixed(2) + "%";
    $("videoProgressText").textContent = `${clock(clamp)} / ${clock(total)}`;
  }
  function updateSoundButton() {
    const video = $("adVideo");
    // iPad Safari supports muting, but its volume may be controlled by device buttons.
    video.muted = !soundEnabled;
    video.defaultMuted = !soundEnabled;
    const button = $("toggleSound");
    button.textContent = soundEnabled ? "🔊 Sound on" : "🔇 Sound off";
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute(
      "aria-label",
      soundEnabled ? "Mute advertisement sound" : "Turn on advertisement sound"
    );
  }
  function initVideoPage() {
    unlocked = false;
    const opt = config[selectedLength];
    $("videoTitle").textContent = `Your ${opt.seconds}-second ad is ready.`;
    $("videoRewardText").textContent = `Reward: ${money(
      savingsFor(selectedLength)
    )} today`;
    $("videoStartOverlay").classList.remove("hidden");
    $("fallbackVideo").classList.add("hidden");
    $("simulateVideo").classList.add("hidden");
    $("missingVideo").classList.add("hidden");
    $("presenterFinish").classList.toggle("hidden", !presenter);
    $("missingFilename").textContent = opt.file;
    $(
      "videoOverlayMessage"
    ).textContent = `Tap to start your ${opt.seconds}-second video.`;
    const video = $("adVideo");
    video.pause();
    video.removeAttribute("src");
    video.src = opt.file;
    updateSoundButton();
    video.controls = false;
    video.load();
    setVideoProgress(0, opt.seconds);
    renderReview("reviewVideo");
  }
  function videoError() {
    if (page !== "video" || unlocked) return;
    $("missingVideo").classList.remove("hidden");
    $("simulateVideo").classList.remove("hidden");
    $("videoOverlayMessage").textContent =
      "MP4 unavailable. You can use the timed demonstration instead.";
  }
  $("adVideo").addEventListener("error", videoError);
  $("adVideo").addEventListener("timeupdate", () => {
    if (page === "video" && playbackMode === "file")
      setVideoProgress(
        $("adVideo").currentTime,
        config[selectedLength].seconds
      );
  });
  $("adVideo").addEventListener("ended", () => {
    if (page === "video" && playbackMode === "file") completeVideo();
  });
  async function playVideo() {
    if (page !== "video" || playbackMode) return;
    const video = $("adVideo");
    try {
      video.currentTime = 0;
      await video.play();
      playbackMode = "file";
      $("videoStartOverlay").classList.add("hidden");
    } catch (error) {
      videoError();
      toast("Video could not start. Check the MP4 files or use timed demo.");
    }
  }
  function simulateVideo() {
    if (page !== "video" || playbackMode) return;
    $("adVideo").pause();
    $("videoStartOverlay").classList.add("hidden");
    $("fallbackVideo").classList.remove("hidden");
    $("simulateVideo").classList.add("hidden");
    $("missingVideo").classList.add("hidden");
    playbackMode = "fallback";
    fallbackStart = performance.now();
    const total = config[selectedLength].seconds;
    fallbackTimer = setInterval(() => {
      const elapsed = (performance.now() - fallbackStart) / 1000;
      setVideoProgress(elapsed, total);
      if (elapsed >= total) completeVideo();
    }, 120);
  }
  function completeVideo() {
    if (page !== "video" || !playbackMode) return;
    unlocked = true;
    stopPlayback();
    go("reward");
  }
  function skipOffer() {
    rewardChoice = "skip";
    unlocked = false;
    selectedLength = null;
    coupon = null;
    go("summary");
  }

  function generateCoupon() {
    const bytes = new Uint8Array(6);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
    const serial = Array.from(bytes, (b) =>
      (b % 36).toString(36).toUpperCase()
    ).join("");
    return { code: `WS-DEMO-${serial}`, amountCents: rewardCents() * 2 };
  }
  function chooseReward(choice) {
    if (!unlocked || page !== "reward") return;
    rewardChoice = choice;
    coupon = choice === "coupon" ? generateCoupon() : null;
    go("summary");
  }
  function renderSummary() {
    $("summarySubtotal").textContent = money(subtotalCents());
    $("summaryTotal").textContent = money(currentTotalCents());
    $("payAmount").textContent = money(currentTotalCents());
    $("summaryLines").innerHTML = Array.from(basket, ([id, qty]) => {
      const p = productById.get(id);
      return `<div class="summary-line"><span>${
        p.name
      } <span class="qty-label">× ${qty}</span></span><strong>${money(
        cents(p.price) * qty
      )}</strong></div>`;
    }).join("");
    const savingsRow = $("summarySavingsRow");
    savingsRow.classList.toggle("hidden", rewardChoice !== "now");
    $("summarySavings").textContent = `− ${money(rewardCents())}`;
    const message = $("summaryChoice");
    if (rewardChoice === "now") {
      $("summaryIntro").textContent =
        "Your Watch & Save saving has been applied. Review your basket.";
      message.innerHTML = `<div class="choice-feedback"><strong>✓ Discount applied to this purchase</strong>You saved ${money(
        rewardCents()
      )} by watching the sponsored video.</div>`;
    } else if (hasCoupon()) {
      $("summaryIntro").textContent =
        "Your double-value coupon is ready. Today you pay the regular basket price.";
      message.innerHTML = `<div class="choice-feedback coupon-feedback"><strong>🎟️ Future coupon: ${money(
        coupon.amountCents
      )}</strong>Your coupon is for a later demo purchase. It does not reduce today's total.<br><button class="button button-primary" id="getCoupon" type="button">Get coupon · QR / Print →</button></div>`;
      $("getCoupon").addEventListener("click", openCoupon);
    } else {
      $("summaryIntro").textContent =
        "You skipped the commercial. Checkout stays exactly as normal.";
      message.innerHTML = "";
    }
  }
  function renderPaid() {
    $("paidTotal").textContent = money(currentTotalCents());
    $("paidDescription").textContent = hasCoupon()
      ? "Your simulated purchase is complete. Your demo future coupon remains available."
      : "Your fictional payment has been completed.";
    $("paidCouponButton").classList.toggle("hidden", !hasCoupon());
  }
  function couponPayload() {
    if (location.protocol === "https:" && location.hostname !== "localhost") {
      const link = new URL(location.href);
      link.search = `?coupon=${encodeURIComponent(coupon.code)}&amount=${(
        coupon.amountCents / 100
      ).toFixed(2)}`;
      link.hash = "";
      return link.href;
    }
    return `WATCH & SAVE DEMO VOUCHER | ${coupon.code} | ${money(
      coupon.amountCents
    )} | NOT REDEEMABLE AT MIGROS`;
  }
  function openCoupon() {
    if (!hasCoupon()) return;
    $("couponDisplayValue").textContent = money(coupon.amountCents);
    $("couponDisplayCode").textContent = coupon.code;
    $("couponQr").innerHTML = qrSVG(couponPayload());
    $("couponHelp").textContent =
      location.protocol === "https:" && location.hostname !== "localhost"
        ? "Scan with a smartphone to open a digital copy of this demo coupon."
        : "Scan with a phone to read the demo coupon details. To open a digital coupon page, host this site on HTTPS (e.g. GitHub Pages).";
    $("couponModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeCoupon() {
    $("couponModal").classList.add("hidden");
    document.body.style.overflow = "";
  }
  function reset() {
    closeCoupon();
    stopPlayback();
    stopScanner();
    basket.clear();
    selectedLength = null;
    rewardChoice = "skip";
    unlocked = false;
    coupon = null;
    soundEnabled = true;
    renderBasket();
    go("shopping");
    toast("New checkout ready.");
  }

  // Navigation and interactions.
  $("checkoutButton").addEventListener("click", () => {
    if (itemCount()) {
      stopScanner();
      go("offer");
    }
  });
  $("startOverTop").addEventListener("click", reset);
  $("offerBack").addEventListener("click", () => go("shopping"));
  $("offerYes").addEventListener("click", () => go("duration"));
  $("offerNo").addEventListener("click", skipOffer);
  $("durationBack").addEventListener("click", () => go("offer"));
  $("durationSkip").addEventListener("click", skipOffer);
  document.querySelectorAll("[data-length]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedLength = button.dataset.length;
      rewardChoice = "skip";
      go("video");
    })
  );
  $("playVideo").addEventListener("click", playVideo);
  $("toggleSound").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
  });
  $("simulateVideo").addEventListener("click", simulateVideo);
  $("presenterFinish").addEventListener("click", () => {
    playbackMode = "presenter";
    completeVideo();
  });
  $("skipVideo").addEventListener("click", skipOffer);
  $("rewardNow").addEventListener("click", () => chooseReward("now"));
  $("rewardCoupon").addEventListener("click", () => chooseReward("coupon"));
  $("payButton").addEventListener("click", () => go("paid"));
  $("summaryReset").addEventListener("click", reset);
  $("paidReset").addEventListener("click", reset);
  $("paidCouponButton").addEventListener("click", openCoupon);
  $("couponBackdrop").addEventListener("click", closeCoupon);
  $("closeCoupon").addEventListener("click", closeCoupon);
  $("printCoupon").addEventListener("click", () => window.print());
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !$("couponModal").classList.contains("hidden")
    )
      closeCoupon();
  });
  drawCatalog();
  renderBasket();
  go("shopping");
})();
