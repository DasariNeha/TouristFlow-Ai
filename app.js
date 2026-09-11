/* ============================================================
   TouristFlow AI — landing page behavior
   All data is mocked and timer-driven; nothing hits a network.
   ============================================================ */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* (Background is a static travel-poster skyline SVG in the HTML) */

  /* ---------- View manager: landing / auth / dashboard ---------- */

  const state = {
    view: "landing",        // 'landing' | 'auth' | 'dashboard'
    authMode: "login",      // 'login' | 'signup'
    currentLocation: "bengaluru",
    selectedDest: null,
    name: "",
    phone: "",
    loggedIn: false,
  };

  function showView(target) {
    const id = target.startsWith("view-") ? target : "view-" + target;
    state.view = id.replace("view-", "");
    const inApp = !["landing", "auth"].includes(state.view);
    document.body.classList.toggle("in-app", inApp);
    document.querySelectorAll(".view").forEach((v) =>
      v.classList.toggle("active", v.id === id));
    const tabbar = document.getElementById("app-tabbar");
    if (tabbar) {
      tabbar.hidden = !inApp;
      tabbar.querySelectorAll(".tab").forEach((t) =>
        t.classList.toggle("active", t.dataset.tabnav === state.view));
    }
    window.scrollTo(0, 0);
  }

  function openAuth(mode) {
    state.authMode = mode === "signup" ? "signup" : "login";
    setAuthMode(state.authMode);
    showView("auth");
  }

  /* ---------- Auth screen logic ---------- */

  const el = (id) => document.getElementById(id);
  const DEMO_OTP = "1234";
  let otpValue = "";
  let resendTimerId = null;
  let resendLeft = 0;

  function setAuthMode(mode) {
    const loginTab = el("tab-login");
    const signupTab = el("tab-signup");
    loginTab.classList.toggle("active", mode === "login");
    signupTab.classList.toggle("active", mode === "signup");
    loginTab.setAttribute("aria-selected", mode === "login");
    signupTab.setAttribute("aria-selected", mode === "signup");

    el("field-name").hidden = mode !== "signup";
    el("auth-title").textContent = mode === "signup" ? "Create your account" : "Welcome back";
    el("auth-sub").textContent =
      mode === "signup"
        ? "Two details and you're planning."
        : "Log in with your mobile number.";

    // back to entry step
    el("auth-entry").hidden = false;
    el("auth-otp").hidden = true;
    el("auth-success").hidden = true;
    clearOtp();
    stopResendTimer();
    hideError("entry-error");
    hideError("otp-error");
  }

  function maskPhone(phone) {
    const d = phone.replace(/\D/g, "");
    return "+91 ••••• ••" + d.slice(-2);
  }

  function showError(id, msg) {
    const e = el(id);
    if (msg) e.textContent = msg;
    e.hidden = false;
  }

  function hideError(id) {
    el(id).hidden = true;
  }

  function startResendTimer() {
    stopResendTimer();
    resendLeft = 30;
    const btn = el("btn-resend");
    btn.disabled = true;
    el("resend-count").textContent = resendLeft;
    resendTimerId = setInterval(() => {
      resendLeft -= 1;
      el("resend-count").textContent = resendLeft;
      if (resendLeft <= 0) {
        stopResendTimer();
        btn.disabled = false;
        btn.textContent = "Resend code";
      }
    }, 1000);
  }

  function stopResendTimer() {
    if (resendTimerId) {
      clearInterval(resendTimerId);
      resendTimerId = null;
    }
  }

  function clearOtp() {
    otpValue = "";
    document.querySelectorAll(".otp-box").forEach((b) => (b.value = ""));
    const first = document.querySelector(".otp-box");
    if (first) first.focus({ preventScroll: true });
  }

  function shakeOtp() {
    const row = el("otp-row");
    row.classList.remove("shake");
    void row.offsetWidth;
    row.classList.add("shake");
  }

  function enterOtpStep() {
    el("auth-entry").hidden = true;
    el("auth-otp").hidden = false;
    el("auth-success").hidden = true;
    el("otp-masked").textContent = maskPhone(state.phone);
    hideError("otp-error");
    clearOtp();
    startResendTimer();
  }

  function finishAuth() {
    stopResendTimer();
    el("auth-entry").hidden = true;
    el("auth-otp").hidden = true;
    el("auth-success").hidden = false;

    setTimeout(() => {
      state.loggedIn = true;
      showView("dashboard");
      renderExplore();
    }, 1100);
  }

  function initAuth() {
    // Wire every element that should open the auth screen
    document.querySelectorAll("[data-auth]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openAuth(a.dataset.auth);
      });
    });

    // Brand click inside auth goes back to landing
    document.querySelectorAll("[data-back]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        showView("landing");
      });
    });

    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.authMode = tab.dataset.tab;
        setAuthMode(state.authMode);
      });
    });

    // digits only in phone field
    el("input-phone").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });

    el("entry-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = el("input-phone").value.trim();
      if (state.authMode === "signup") {
        const name = el("input-name").value.trim();
        if (name.length < 2) {
          showError("entry-error", "Please enter your name.");
          return;
        }
        state.name = name;
      }
      if (phone.length !== 10) {
        showError("entry-error", "Enter a valid 10-digit mobile number.");
        return;
      }
      state.phone = phone;
      hideError("entry-error");
      enterOtpStep();
    });

    el("btn-edit-number").addEventListener("click", () => {
      stopResendTimer();
      el("auth-otp").hidden = true;
      el("auth-entry").hidden = false;
      el("input-phone").focus({ preventScroll: true });
    });

    el("btn-resend").addEventListener("click", () => {
      if (el("btn-resend").disabled) return;
      el("btn-resend").textContent = "Resend in ";
      // rebuild label with counter span
      el("btn-resend").innerHTML = 'Resend in <span id="resend-count">30</span>s';
      startResendTimer();
    });

    // OTP boxes: auto-advance, backspace, paste
    const boxes = [...document.querySelectorAll(".otp-box")];
    boxes.forEach((box, i) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        if (box.value && i < boxes.length - 1) boxes[i + 1].focus({ preventScroll: true });
        otpValue = boxes.map((b) => b.value).join("");
        if (otpValue.length === 4) el("otp-form").requestSubmit();
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && i > 0) {
          boxes[i - 1].focus({ preventScroll: true });
          boxes[i - 1].value = "";
          otpValue = boxes.map((b) => b.value).join("");
        }
      });
      box.addEventListener("paste", (e) => {
        e.preventDefault();
        const digits = (e.clipboardData.getData("text").match(/\d/g) || []).slice(0, 4);
        digits.forEach((d, j) => { if (boxes[j]) boxes[j].value = d; });
        if (digits.length) boxes[Math.min(digits.length, 3)].focus({ preventScroll: true });
        otpValue = boxes.map((b) => b.value).join("");
        if (otpValue.length === 4) el("otp-form").requestSubmit();
      });
    });

    el("otp-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (otpValue.length < 4) {
        showError("otp-error", "Enter all four digits.");
        shakeOtp();
        return;
      }
      if (otpValue === DEMO_OTP) {
        hideError("otp-error");
        finishAuth();
      } else {
        showError("otp-error", "Incorrect code, try again");
        shakeOtp();
        clearOtp();
      }
    });

    // Profile popover + logout: full reset back to landing
    el("avatar-btn").addEventListener("click", () => {
      const pop = el("profile-pop");
      pop.hidden = !pop.hidden;
      if (!pop.hidden) renderProfile();
    });

    document.addEventListener("click", (e) => {
      const pop = el("profile-pop");
      if (!pop.hidden && !pop.contains(e.target) && e.target.closest("#avatar-btn") === null) {
        pop.hidden = true;
      }
    });

    el("profile-pop").addEventListener("click", (e) => {
      if (e.target.closest("[data-logout]")) {
        state.loggedIn = false;
        state.name = "";
        state.phone = "";
        el("input-name").value = "";
        el("input-phone").value = "";
        el("profile-pop").hidden = true;
        setAuthMode("login");
        showView("landing");
      }
    });
  }

  /* ============================================================
     EXPLORE HOME — mocked data + rendering
     All API-shaped: swap these objects for fetches later.
     ============================================================ */

  const LOCATIONS = [
    { id: "bengaluru", city: "Bengaluru", region: "Karnataka", area: "Indiranagar", spotsNearby: 12 },
    { id: "delhi", city: "New Delhi", region: "Delhi", area: "Connaught Place", spotsNearby: 18 },
    { id: "jaipur", city: "Jaipur", region: "Rajasthan", area: "Pink City", spotsNearby: 15 },
    { id: "agra", city: "Agra", region: "Uttar Pradesh", area: "Taj Ganj", spotsNearby: 7 },
    { id: "mumbai", city: "Mumbai", region: "Maharashtra", area: "Colaba", spotsNearby: 11 },
  ];

  /* Coordinates are 0-100 percentages on the stylized map canvas */
  const DESTINATIONS = [
    {
      id: "bangalore-palace", near: "bengaluru",
      name: "Bangalore Palace", location: "Vasanth Nagar, Bengaluru", distance: "2.1 km away",
      crowd: "high", capacity: 87, vsAverage: +38,
      category: "Palace · Heritage", hours: "10:00 AM – 5:30 PM",
      description: "Sprawling 19th-century palace with Tudor-style architecture, wood carvings and a vast walled garden.",
      weather: { now: 29, cond: "Partly cloudy", feels: 32, forecast: [{ d: "12 PM", i: "⛅", t: 30 }, { d: "3 PM", i: "🌦️", t: 28 }, { d: "6 PM", i: "🌧️", t: 26 }] },
      events: [{ date: "Sat–Sun", name: "Bengaluru pet show, grounds open to ticket holders" }],
      facilities: ["♿ Wheelchair ramps", "🚻 Accessible toilets", "🍼 Feeding room"],
      pin: { x: 22, y: 30 },
    },
    {
      id: "lalbagh", near: "bengaluru",
      name: "Lalbagh Botanical Garden", location: "Mavalli, Bengaluru", distance: "4.3 km away",
      crowd: "moderate", capacity: 54, vsAverage: -15,
      category: "Garden · Nature", hours: "6:00 AM – 7:00 PM",
      description: "Centuries-old botanical garden with a glasshouse, ancient trees and a peaceful lake walk.",
      weather: { now: 29, cond: "Partly cloudy", feels: 32, forecast: [{ d: "12 PM", i: "⛅", t: 30 }, { d: "3 PM", i: "🌦️", t: 28 }, { d: "6 PM", i: "🌧️", t: 26 }] },
      events: [],
      facilities: ["♿ Wheelchair-friendly paths", "🚻 Accessible toilets", "🍼 Feeding room"],
      pin: { x: 46, y: 62 },
    },
    {
      id: "cubbon-park", near: "bengaluru",
      name: "Cubbon Park", location: "Sampangi Rama Nagara", distance: "3.0 km away",
      crowd: "low", capacity: 22, vsAverage: -31,
      category: "Park · Urban walk", hours: "Open 24 hours",
      description: "Lush 300-acre park with shaded avenues, heritage buildings and quiet morning trails.",
      weather: { now: 28, cond: "Clear", feels: 30, forecast: [{ d: "12 PM", i: "☀️", t: 30 }, { d: "3 PM", i: "⛅", t: 29 }, { d: "6 PM", i: "🌧️", t: 25 }] },
      events: [{ date: "Sunday", name: "Car-free day — cycling on main avenues" }],
      facilities: ["♿ Step-free entrances", "🚻 Accessible toilets"],
      pin: { x: 62, y: 22 },
    },
    {
      id: "vidhana-soudha", near: "bengaluru",
      name: "Vidhana Soudha", location: "Ambedkar Veedhi", distance: "3.4 km away",
      crowd: "moderate", capacity: 61, vsAverage: +9,
      category: "Landmark · Government", hours: "Exterior viewing anytime",
      description: "Neo-Dravidian landmark building, grandest when lit after sunset on Sundays.",
      weather: { now: 29, cond: "Partly cloudy", feels: 32, forecast: [{ d: "12 PM", i: "⛅", t: 30 }, { d: "3 PM", i: "☀️", t: 31 }, { d: "6 PM", i: "🌧️", t: 26 }] },
      events: [],
      facilities: ["♿ Step-free viewing point"],
      pin: { x: 74, y: 55 },
    },
    {
      id: "tipu-palace", near: "bengaluru",
      name: "Tipu Sultan's Summer Palace", location: "Chamrajpet", distance: "5.2 km away",
      crowd: "moderate", capacity: 48, vsAverage: -8,
      category: "Museum · Heritage", hours: "8:30 AM – 5:30 PM",
      description: "Teakwood palace of Tipu Sultan with carved arches, murals and a small museum.",
      weather: { now: 29, cond: "Partly cloudy", feels: 32, forecast: [{ d: "12 PM", i: "⛅", t: 30 }, { d: "3 PM", i: "🌦️", t: 28 }, { d: "6 PM", i: "🌧️", t: 26 }] },
      events: [],
      facilities: ["♿ Wheelchair ramps", "🚻 Accessible toilets"],
      pin: { x: 38, y: 82 },
    },
    {
      id: "red-fort", near: "delhi",
      name: "Red Fort", location: "Chandni Chowk, Delhi", distance: "1.8 km away",
      crowd: "high", capacity: 91, vsAverage: +42,
      category: "Fort · UNESCO", hours: "9:30 AM – 4:30 PM (closed Mondays)",
      description: "Mughal fortress of red sandstone with evening light shows and sprawling ramparts.",
      weather: { now: 34, cond: "Sunny", feels: 37, forecast: [{ d: "12 PM", i: "☀️", t: 35 }, { d: "3 PM", i: "☀️", t: 34 }, { d: "6 PM", i: "⛅", t: 31 }] },
      events: [{ date: "Aug 15", name: "Independence Day — site closed to visitors" }],
      facilities: ["♿ Wheelchair ramps", "🚻 Accessible toilets", "🍼 Feeding room"],
      pin: { x: 30, y: 28 },
    },
    {
      id: "qutub-minar", near: "delhi",
      name: "Qutub Minar", location: "Mehrauli, Delhi", distance: "14.2 km away",
      crowd: "moderate", capacity: 57, vsAverage: -6,
      category: "Minaret · UNESCO", hours: "7:00 AM – 5:00 PM",
      description: "73-metre victory tower from 1193, tallest brick minaret in the world, set in a sculpted complex.",
      weather: { now: 34, cond: "Sunny", feels: 37, forecast: [{ d: "12 PM", i: "☀️", t: 35 }, { d: "3 PM", i: "☀️", t: 34 }, { d: "6 PM", i: "⛅", t: 31 }] },
      events: [],
      facilities: ["♿ Wheelchair ramps", "🚻 Accessible toilets"],
      pin: { x: 68, y: 66 },
    },
    {
      id: "hawa-mahal", near: "jaipur",
      name: "Hawa Mahal", location: "Badi Choupad, Jaipur", distance: "0.9 km away",
      crowd: "moderate", capacity: 52, vsAverage: -12,
      category: "Palace · Landmark", hours: "9:00 AM – 4:30 PM",
      description: "The pink 'palace of winds' with 953 latticed windows, best photographed at first light.",
      weather: { now: 31, cond: "Clear", feels: 33, forecast: [{ d: "12 PM", i: "☀️", t: 33 }, { d: "3 PM", i: "☀️", t: 33 }, { d: "6 PM", i: "⛅", t: 29 }] },
      events: [{ date: "Mar", name: "Jaipur Literature Festival nearby — expect crowds" }],
      facilities: ["♿ Ground-floor access", "🚻 Accessible toilets"],
      pin: { x: 40, y: 30 },
    },
    {
      id: "amer-fort", near: "jaipur",
      name: "Amer Fort", location: "Devisinghpura, Jaipur", distance: "11.3 km away",
      crowd: "high", capacity: 84, vsAverage: +29,
      category: "Fort · UNESCO", hours: "8:00 AM – 5:30 PM",
      description: "Hilltop amber-hued fort with mirrored halls and a sweeping courtyard above Maota Lake.",
      weather: { now: 31, cond: "Clear", feels: 33, forecast: [{ d: "12 PM", i: "☀️", t: 33 }, { d: "3 PM", i: "☀️", t: 32 }, { d: "6 PM", i: "⛅", t: 29 }] },
      events: [],
      facilities: ["♿ Golf-cart shuttle", "🚻 Accessible toilets"],
      pin: { x: 70, y: 70 },
    },
    {
      id: "taj-mahal", near: "agra",
      name: "Taj Mahal", location: "Dharmapuri, Agra", distance: "2.4 km away",
      crowd: "high", capacity: 93, vsAverage: +51,
      category: "Mausoleum · UNESCO", hours: "Sunrise – sunset (closed Fridays)",
      description: "The ivory-white marble mausoleum and its charbagh gardens — arrive early or late for calm.",
      weather: { now: 33, cond: "Hazy sun", feels: 36, forecast: [{ d: "12 PM", i: "☀️", t: 34 }, { d: "3 PM", i: "☀️", t: 34 }, { d: "6 PM", i: "⛅", t: 30 }] },
      events: [{ date: "Fri", name: "Closed every Friday for prayers" }],
      facilities: ["♿ Golf-cart shuttle", "🚻 Accessible toilets", "🍼 Feeding room"],
      pin: { x: 50, y: 40 },
    },
    {
      id: "gateway-india", near: "mumbai",
      name: "Gateway of India", location: "Apollo Bandar, Mumbai", distance: "0.4 km away",
      crowd: "moderate", capacity: 64, vsAverage: +7,
      category: "Arch · Waterfront", hours: "Open 24 hours",
      description: "Basalt arch on the harbour front, gateway to Elephanta ferries and evening promenades.",
      weather: { now: 30, cond: "Humid", feels: 34, forecast: [{ d: "12 PM", i: "⛅", t: 31 }, { d: "3 PM", i: "🌦️", t: 29 }, { d: "6 PM", i: "🌧️", t: 27 }] },
      events: [],
      facilities: ["♿ Step-free promenade", "🚻 Accessible toilets"],
      pin: { x: 55, y: 58 },
    },
  ];

  const CROWD_LABEL = { low: "Low", moderate: "Moderate", high: "High" };

  const AI_RECOMMENDATIONS = [
    {
      tag: "Reschedule", confidence: 92, tone: "amber",
      headline: "Visit Bangalore Palace tomorrow morning instead",
      context: "Bangalore Palace, Bengaluru",
      reason: "Today's crowd is running 38% above usual, easing by tomorrow AM.",
      impact: "~40 min shorter queue",
      actions: ["Reschedule my visit", "Dismiss"],
    },
    {
      tag: "Alternative", confidence: 88, tone: "violet",
      headline: "Try Cubbon Park this afternoon",
      context: "3.0 km away · Park & nature",
      reason: "Shaded trails are 31% below their usual footfall right now.",
      impact: "Save ~35 min versus any busy site",
      actions: ["View alternative", "Dismiss"],
    },
    {
      tag: "Heads up", confidence: 84, tone: "green",
      headline: "Best window today: 4–6 PM",
      context: "Lalbagh Botanical Garden",
      reason: "Crowd thins noticeably after 3:30 PM as day-trippers leave.",
      impact: "Golden-hour walk, shortest gates",
      actions: ["Set reminder", "Dismiss"],
    },
  ];

  const EXPLORE_TILES = [
    { icon: "🧭", title: "Ready-made journeys", sub: "Curated multi-day trip bundles", glow: "violet" },
    { icon: "🎟️", title: "Skip-the-line entry", sub: "Monument & attraction tickets", glow: "amber" },
    { icon: "🚆", title: "Travel between cities", sub: "Trains, buses & flights", glow: "teal" },
    { icon: "🛺", title: "Rides & rentals", sub: "Cabs, self-drive and bikes", glow: "green" },
    { icon: "🛏️", title: "Stays near the sites", sub: "Hotels & homestays nearby", glow: "blue" },
    { icon: "🌤️", title: "When to go where", sub: "Season-by-season discovery", glow: "rose" },
  ];

  function heroImage(d) {
    return '<div class="s-hero" aria-hidden="true">' +
      '<svg viewBox="0 0 48 32"><path d="M24 4c-7 4-12 9-12 16h24c0-7-5-12-12-16z" fill="rgba(255,255,255,0.75)"/><path d="M10 20h28v3H10z" fill="rgba(255,255,255,0.75)"/><path d="M24 1.5v2" stroke="rgba(255,255,255,0.75)" stroke-width="1.6"/><circle cx="24" cy="1.5" r="1.4" fill="rgba(255,255,255,0.8)"/></svg>' +
      '</div>';
  }

  function crowdBadge(crowd) {
    return '<span class="cl-badge cl-' + crowd + '">' +
      '<span class="cl-dot" aria-hidden="true"></span>' + CROWD_LABEL[crowd] + '</span>';
  }

  function capacityBar(capacity) {
    const tone = capacity >= 80 ? "bar-high" : capacity >= 50 ? "bar-mid" : "bar-low";
    return '<div class="cap-row"><div class="cap-track"><div class="cap-fill ' + tone + '" style="width:' +
      capacity + '%"></div></div><span class="cap-num">' + capacity + '%</span></div>';
  }

  function vsFootfall(v) {
    const up = v >= 0;
    return '<span class="vs ' + (up ? "vs-up" : "vs-down") + '">' +
      (up ? "▲ +" : "▼ −") + Math.abs(v) + "% vs usual</span>";
  }

  function eventsBlock(d) {
    if (!d.events.length) return "";
    return d.events.map(ev =>
      '<div class="mp-ev"><span class="ev-date">' + ev.date + '</span>' + ev.name + '</div>'
    ).join("");
  }

  function facilitiesBlock(d) {
    if (!d.facilities.length) return "";
    return '<div class="mp-facils">' + d.facilities.map(f => '<span class="chip">' + f + '</span>').join("") + '</div>';
  }

  function weatherBlock(d) {
    return '<div class="mp-wx"><span class="wx-now"><strong>' + d.weather.now + '°C</strong> ' + d.weather.cond +
      '</span><span class="wx-fc">' + d.weather.forecast.map(f => f.d + " " + f.i + " " + f.t + "°").join(" · ") + '</span></div>';
  }

  /* ---------- Renderers ---------- */

  function renderExplore() {
    renderExploreGrid();
    renderLocationUI();
    renderSpotlight();
    renderAI();
  }

  function renderExploreGrid() {
    document.getElementById("explore-grid").innerHTML = EXPLORE_TILES.map(t =>
      '<button class="tile glow-' + t.glow + '" type="button">' +
        '<span class="tile-ic" aria-hidden="true">' + t.icon + '</span>' +
        '<span class="tile-title">' + t.title + '</span>' +
        '<span class="tile-sub">' + t.sub + '</span>' +
      '</button>'
    ).join("");
  }

  function renderLocationUI() {
    const loc = LOCATIONS.find(l => l.id === state.currentLocation) || LOCATIONS[0];
    document.getElementById("loc-main").textContent = loc.city + ", " + loc.region;
    document.getElementById("loc-sub").textContent = loc.area + " · " + loc.spotsNearby + " spots nearby";
    document.getElementById("loc-menu").innerHTML =
      '<p class="loc-menu-title">Change location</p>' +
      LOCATIONS.map(l =>
        '<button type="button" class="loc-opt' + (l.id === loc.id ? " current" : "") + '" data-loc="' + l.id + '">' +
          '<span>' + l.city + ', ' + l.region + '</span><span class="loc-opt-sub">' + l.area + '</span>' +
        '</button>'
      ).join("");
  }

  function destCard(d) {
    return '<article class="s-card" data-dest="' + d.id + '">' +
      heroImage(d) +
      '<div class="s-body">' +
        '<div class="s-top"><h3>' + d.name + '</h3>' + crowdBadge(d.crowd) + '</div>' +
        '<p class="s-loc">' + d.location + ' · ' + d.distance + '</p>' +
        capacityBar(d.capacity) +
        vsFootfall(d.vsAverage) +
      '</div></article>';
  }

  function renderSpotlight() {
    const loc = LOCATIONS.find(l => l.id === state.currentLocation) || LOCATIONS[0];
    const feed = document.getElementById("spot-feed");
    const list = DESTINATIONS.filter(d => d.near === loc.id);
    feed.innerHTML = list.length
      ? list.map(destCard).join("")
      : '<p class="s-empty">No tracked spots near ' + loc.city + ' yet — try another location.</p>';
    renderMap();
  }

  function renderMap() {
    const loc = LOCATIONS.find(l => l.id === state.currentLocation) || LOCATIONS[0];
    const list = DESTINATIONS.filter(d => d.near === loc.id);
    const canvas = document.getElementById("map-canvas");
    canvas.innerHTML =
      '<div class="map-roads" aria-hidden="true">' +
        '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
          '<path d="M0 38 C30 42 60 30 100 44" /><path d="M0 72 C35 64 55 80 100 66" /><path d="M18 0 C22 35 14 65 26 100" /><path d="M58 0 C52 30 66 70 60 100" />' +
        '</svg></div>' +
      list.map(d =>
        '<button class="mp-pin p-' + d.crowd + (d.id === state.selectedDest ? " selected" : "") +
          '" style="left:' + d.pin.x + '%;top:' + d.pin.y + '%" data-pin="' + d.id +
          '" type="button" aria-label="' + d.name + ' — ' + CROWD_LABEL[d.crowd] + ' crowd">' +
          '<span class="pin-dot"></span></button>'
      ).join("") +
      '<div class="map-legend" aria-hidden="true">' +
        '<span class="lg"><i class="lg-dot lg-green"></i>Low</span>' +
        '<span class="lg"><i class="lg-dot lg-yellow"></i>Moderate</span>' +
        '<span class="lg"><i class="lg-dot lg-red"></i>High</span>' +
      '</div>';
    renderMapPanel();
  }

  function renderMapPanel() {
    const panel = document.getElementById("map-panel");
    const d = DESTINATIONS.find(x => x.id === state.selectedDest);
    if (!d) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML =
      heroImage(d) +
      '<div class="mp-body">' +
        '<div class="s-top"><h3>' + d.name + '</h3>' + crowdBadge(d.crowd) + '</div>' +
        '<p class="s-loc">' + d.location + '</p>' +
        capacityBar(d.capacity) +
        vsFootfall(d.vsAverage) +
        '<p class="mp-desc">' + d.description + '</p>' +
        '<div class="mp-meta"><span>' + d.category + '</span><span>·</span><span>' + d.hours + '</span></div>' +
        weatherBlock(d) +
        eventsBlock(d) +
        facilitiesBlock(d) +
        '<div class="mp-actions"><button type="button" class="btn btn-pill btn-primary">Plan this visit</button>' +
        '<button type="button" class="mp-close" data-panel-close>Close</button></div>' +
      '</div>';
  }

  function renderAI() {
    document.getElementById("ai-list").innerHTML = AI_RECOMMENDATIONS.map((r, idx) =>
      '<article class="ai-card tone-' + r.tone + '">' +
        '<div class="ai-top"><span class="ai-tag">' + r.tag + '</span><span class="ai-conf">' + r.confidence + '%</span></div>' +
        '<h3 class="ai-headline">' + r.headline + '</h3>' +
        '<p class="ai-context">' + r.context + '</p>' +
        '<p class="ai-reason">' + r.reason + '</p>' +
        '<p class="ai-impact"><span>Expected impact</span>' + r.impact + '</p>' +
        '<div class="ai-actions"><button type="button" class="btn btn-pill btn-primary" data-ai="' + idx + ':0">' + r.actions[0] + '</button>' +
        '<button type="button" class="ai-dismiss" data-ai="' + idx + ':1">' + r.actions[1] + '</button></div>' +
      '</article>'
    ).join("");
  }

  function renderProfile() {
    const initial = state.name ? state.name.trim().charAt(0).toUpperCase() : "G";
    document.querySelector(".avatar-ring").textContent = initial;
    document.getElementById("profile-pop").innerHTML =
      '<p class="pf-name">' + (state.name ? state.name : "Guest session") + '</p>' +
      '<p class="pf-phone">' + (state.phone ? "+91 " + state.phone : "") + '</p>' +
      '<div class="pf-stats">' +
        '<div class="pf-stat"><strong>4</strong><span>Trips taken</span></div>' +
        '<div class="pf-stat"><strong>17</strong><span>Places visited</span></div>' +
        '<div class="pf-stat"><strong>6</strong><span>Saved spots</span></div>' +
      '</div>' +
      '<button type="button" class="pf-logout" data-logout>Log out</button>';
  }

  /* ---------- Interactions ---------- */

  function initExplore() {
    const stage = document.getElementById("spot-map");
    if (!stage) return;

    // Feed ↔ map toggle
    document.getElementById("map-toggle").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const toMap = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", toMap);
      document.getElementById("spot-feed").hidden = toMap;
      stage.hidden = !toMap;
      if (toMap) renderMap();
    });

    // Location dropdown
    document.getElementById("loc-btn").addEventListener("click", () => {
      const menu = document.getElementById("loc-menu");
      menu.hidden = !menu.hidden;
    });

    document.getElementById("loc-menu").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-loc]");
      if (!opt) return;
      state.currentLocation = opt.dataset.loc;
      state.selectedDest = null;
      renderLocationUI();
      renderSpotlight();
      document.getElementById("loc-menu").hidden = true;
    });

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("loc-menu");
      if (!menu.hidden && !e.target.closest("#loc-btn") && !e.target.closest("#loc-menu")) {
        menu.hidden = true;
      }
    });

    // Pin selection
    document.getElementById("map-canvas").addEventListener("click", (e) => {
      const pin = e.target.closest("[data-pin]");
      if (!pin) return;
      state.selectedDest = pin.dataset.pin;
      renderMap();
    });

    document.getElementById("map-panel").addEventListener("click", (e) => {
      if (e.target.closest("[data-panel-close]")) {
        state.selectedDest = null;
        renderMapPanel();
      }
    });

    // AI recommendation actions
    document.getElementById("ai-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ai]");
      if (!btn) return;
      const [idx, action] = btn.dataset.ai.split(":").map(Number);
      const rec = AI_RECOMMENDATIONS[idx];
      if (action === 1) {
        btn.closest(".ai-card").classList.add("ai-gone");
        setTimeout(() => { btn.closest(".ai-card").remove(); }, 250);
      } else {
        openGuideSheet(
          "On it — " + rec.headline.toLowerCase() +
          (rec.tag === "Heads up" ? ". I'll remind you when the window opens." : ".")
        );
      }
    });

    // Tour Guide FAB + sheet
    const fab = document.getElementById("tg-fab");
    const tip = document.getElementById("fab-tip");
    if (!sessionStorage.getItem("tf-fab-tip-seen")) {
      tip.hidden = false;
      setTimeout(() => { tip.hidden = true; sessionStorage.setItem("tf-fab-tip-seen", "1"); }, 4000);
    }
    fab.addEventListener("click", () => {
      const sheet = document.getElementById("tg-sheet");
      sheet.hidden = !sheet.hidden;
      if (!sheet.hidden && !sheet.dataset.started) {
        sheet.dataset.started = "1";
        startGuideChat();
      }
    });
    document.getElementById("tg-close").addEventListener("click", () => {
      document.getElementById("tg-sheet").hidden = true;
    });
  }

  /* ---------- Tour Guide sheet chat (looping demo) ---------- */

  function startGuideChat() {
    const body = document.getElementById("tg-sheet-body");
    let step = 0;

    function push(m) {
      const div = document.createElement("div");
      div.className = "chat-msg " + m.who;
      if (m.html) div.innerHTML = m.html;
      else div.textContent = m.text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    function next() {
      if (!document.body.classList.contains("in-app")) return;
      if (step === 0) body.innerHTML = "";
      const m = CHAT_SCRIPT[step];
      if (m.who === "bot") {
        const t = document.createElement("div");
        t.className = "typing";
        t.innerHTML = "<span></span><span></span><span></span>";
        body.appendChild(t);
        setTimeout(() => {
          t.remove();
          push(m);
          step = (step + 1) % CHAT_SCRIPT.length;
          setTimeout(next, step === 0 ? 6000 : 1800);
        }, 1300);
      } else {
        setTimeout(() => {
          push(m);
          step = (step + 1) % CHAT_SCRIPT.length;
          next();
        }, 900);
      }
    }
    next();
  }

  function openGuideSheet(confirmText) {
    const sheet = document.getElementById("tg-sheet");
    sheet.hidden = false;
    if (!sheet.dataset.started) {
      sheet.dataset.started = "1";
      startGuideChat();
    }
    const body = document.getElementById("tg-sheet-body");
    const div = document.createElement("div");
    div.className = "chat-msg bot";
    div.textContent = confirmText;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- Nav background on scroll ---------- */

  function initNavScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const update = () => header.classList.toggle("scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------- Live monitoring: counter ---------- */

  const COUNTER_START = 12847;

  function initCounter() {
    const el = document.getElementById("redirect-counter");
    if (!el) return;
    let value = COUNTER_START;
    el.textContent = value.toLocaleString("en-IN");
    setInterval(() => {
      value += Math.floor(Math.random() * 4) + 1;
      el.textContent = value.toLocaleString("en-IN");
    }, 2200);
  }

  /* ---------- Live monitoring: ticker ---------- */

  const TICKER_ITEMS = [
    "Red Fort → 42 visitors redirected to Purana Qila in the last hour",
    "Taj Mahal → east gate queue at 90 min; 61 visitors guided to Mehtab Bagh",
    "Gateway of India → Yellow; 28 visitors rerouted to Worli Sea Face promenade",
    "Amer Fort → 37 visitors moved to Panna Meena ka Kund before the midday surge",
    "Marine Drive → Green; 19 visitors shifted here from Colaba Causeway",
    "Jantar Mantar → 24 visitors redirected to Kingdom of Dreams earlier today",
  ];

  function initTicker() {
    const el = document.getElementById("ticker-text");
    if (!el) return;
    let i = 0;
    setInterval(() => {
      el.classList.add("fading");
      setTimeout(() => {
        i = (i + 1) % TICKER_ITEMS.length;
        el.textContent = TICKER_ITEMS[i];
        el.classList.remove("fading");
      }, 500);
    }, 4200);
  }

  /* ---------- Live monitoring: status badges ---------- */

  const BADGE_DATA = [
    { name: "Taj Mahal", status: "yellow" },
    { name: "Red Fort", status: "green" },
    { name: "Hawa Mahal", status: "green" },
    { name: "Gateway of India", status: "red" },
    { name: "Amer Fort", status: "yellow" },
    { name: "Marine Drive", status: "green" },
  ];

  const STATUS_CLASS = {
    green: ["b-green", "s-green", "c-green"],
    yellow: ["b-yellow", "s-yellow", "c-yellow"],
    red: ["b-red", "s-red", "c-red"],
  };

  const ALL_STATUS_CLASSES = Object.values(STATUS_CLASS).flat();

  function initBadges() {
    const wrap = document.getElementById("live-badges");
    if (!wrap) return;

    const badges = BADGE_DATA.map((d) => {
      const b = document.createElement("span");
      b.className = "badge";
      b.innerHTML =
        '<span class="status-dot" aria-hidden="true"></span>' +
        '<span class="badge-name"></span>' +
        '<span class="badge-status"></span>';
      b.querySelector(".badge-name").textContent = d.name;
      b.querySelector(".badge-status").textContent =
        d.status.charAt(0).toUpperCase() + d.status.slice(1);
      wrap.appendChild(b);
      return { el: b, dot: b.querySelector(".status-dot"), status: d.status };
    });

    const apply = (b) => {
      const [border, dot] = STATUS_CLASS[b.status];
      b.el.classList.remove(...ALL_STATUS_CLASSES);
      b.el.classList.add(border);
      b.dot.classList.remove(...ALL_STATUS_CLASSES);
      b.dot.classList.add(dot);
      const statusEl = b.el.querySelector(".badge-status");
      statusEl.className = "badge-status " + border;
      statusEl.textContent =
        b.status.charAt(0).toUpperCase() + b.status.slice(1);
    };

    badges.forEach(apply);

    // Occasionally a destination flips status — the network feels alive
    setInterval(() => {
      const b = badges[Math.floor(Math.random() * badges.length)];
      const options = Object.keys(STATUS_CLASS).filter((s) => s !== b.status);
      b.status = options[Math.floor(Math.random() * options.length)];
      apply(b);
    }, 5000);
  }

  /* ---------- Itinerary: highlight the swap ---------- */

  function initSwapPulse() {
    const swap = document.getElementById("swap-stop");
    if (!swap || reduceMotion) return;
    setInterval(() => {
      swap.classList.remove("highlight");
      void swap.offsetWidth; // restart animation
      swap.classList.add("highlight");
    }, 6000);
  }

  /* ---------- Tour Guide chat loop ---------- */

  const CHAT_SCRIPT = [
    { who: "user", text: "How crowded is the Taj Mahal right now?" },
    {
      who: "bot",
      html:
        'Currently <span class="crowd c-yellow">Yellow</span> — about a 75-minute wait at the east gate. ' +
        "If you go after 3:30 pm it drops to Green, or I can reroute you to Mehtab Bagh across the river now.",
    },
    { who: "user", text: "Can we push Agra Fort to tomorrow morning instead?" },
    {
      who: "bot",
      html:
        "Done. Agra Fort moves to tomorrow 9:00 am — predicted <span class=\"crowd c-green\">Green</span>. " +
        "I've filled today's gap with a stepwell café locals love, 15 minutes away.",
    },
  ];

  function initChat() {
    const body = document.getElementById("chat-body");
    if (!body) return;

    let step = 0;

    function addTyping() {
      const t = document.createElement("div");
      t.className = "typing";
      t.setAttribute("aria-label", "Tour Guide is typing");
      t.innerHTML = "<span></span><span></span><span></span>";
      body.appendChild(t);
      return t;
    }

    function addMessage(m) {
      const div = document.createElement("div");
      div.className = "chat-msg " + m.who;
      if (m.html) div.innerHTML = m.html;
      else div.textContent = m.text;
      body.appendChild(div);
    }

    function clearChat() {
      body.innerHTML = "";
    }

    function playNext() {
      if (step === 0) clearChat();

      const m = CHAT_SCRIPT[step];

      if (m.who === "bot") {
        const t = addTyping();
        setTimeout(() => {
          t.remove();
          addMessage(m);
          step = (step + 1) % CHAT_SCRIPT.length;
          setTimeout(playNext, step === 0 ? 6000 : 1800);
        }, 1300);
      } else {
        setTimeout(() => {
          addMessage(m);
          step = (step + 1) % CHAT_SCRIPT.length;
          playNext();
        }, 900);
      }
    }

    playNext();
  }

  /* ---------- Stats count-up on scroll ---------- */

  function animateCount(el, target, suffix, duration) {
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.round(target * eased).toLocaleString("en-IN") + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initStats() {
    const stats = document.querySelectorAll(".stat-value[data-count]");
    if (!stats.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      stats.forEach((el) => {
        el.textContent =
          Number(el.dataset.count).toLocaleString("en-IN") + (el.dataset.suffix || "");
      });
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          animateCount(el, Number(el.dataset.count), el.dataset.suffix || "", 1600);
        });
      },
      { threshold: 0.4 }
    );

    stats.forEach((el) => io.observe(el));
  }

  /* ---------- Boot ---------- */

  function init() {
    initNavScroll();
    initAuth();
    initExplore();
    initSubpages();
    initCounter();
    initTicker();
    initBadges();
    initSwapPulse();
    initChat();
    initStats();
  }

  /* ============================================================
     EXPLORE SUB-PAGES — packages / tickets / transport
     Data is API-shaped; swap for fetches later.
     ============================================================ */

  const PKG_TYPES = ["Hill station", "City", "Beach", "Pilgrimage"];

  const PACKAGES = [
    { id: "coorg", name: "Coorg Coffee Country", type: "Hill station", days: 4, nights: 3, price: 8499,
      hook: "Misty hills, coffee estates, and a slower pace",
      includes: ["Stay", "Transport", "Breakfast", "Guide", "Sightseeing"],
      gallery: ["Abbey Falls", "Raja's Seat", "Dubare Elephant Camp"],
      itinerary: [
        { day: 1, plan: "Arrive in Madikeri, check in, evening at Raja's Seat" },
        { day: 2, plan: "Abbey Falls, Abbey Falls viewpoint, coffee estate walk with tasting" },
        { day: 3, plan: "Dubare elephant camp river experience, Talakaveri and Bhagamandala" },
        { day: 4, plan: "Local market stroll, brunch, departure" },
      ],
      inclusions: ["3 nights stay in a plantation stay", "AC cab for all transfers", "Daily breakfast", "Local guide on days 2-3", "All entry tickets"],
      exclusions: ["Lunch and dinner", "Personal expenses", "Travel insurance"],
    },
    { id: "hyderabad", name: "Hyderabad Heritage & Biryani", type: "City", days: 3, nights: 2, price: 7299,
      hook: "Charminar, Nizam palaces and food that runs deep",
      includes: ["Stay", "Transport", "Meals", "Guide", "Sightseeing"],
      gallery: ["Charminar", "Golconda Fort", "Chowmahalla Palace"],
      itinerary: [
        { day: 1, plan: "Old city walk, Charminar and Mecca Masjid, evening at Hussain Sagar" },
        { day: 2, plan: "Golconda Fort, Qutb Shahi tombs, Chowmahalla Palace, biryani trail dinner" },
        { day: 3, plan: "Salar Jung Museum, Laad Bazaar shopping, departure" },
      ],
      inclusions: ["2 nights 4-star stay", "Airport transfers", "Breakfast + 2 food-walk meals", "Heritage guide", "All entry tickets"],
      exclusions: ["Personal shopping", "Tips", "Anything not listed"],
    },
    { id: "gokarna", name: "Gokarna Beach Escape", type: "Beach", days: 4, nights: 3, price: 9499,
      hook: "Quiet coves, cliff walks and shacks by the sand",
      includes: ["Stay", "Transport", "Meals", "Sightseeing"],
      gallery: ["Om Beach", "Kudle Beach", "Mirjan Fort"],
      itinerary: [
        { day: 1, plan: "Arrive, settle into a beach hut, sunset at Kudle Beach" },
        { day: 2, plan: "Mahabaleshwar temple, boat to Om and Half Moon beaches" },
        { day: 3, plan: "Cliff trek to Paradise Beach, bonfire evening" },
        { day: 4, plan: "Mirjan Fort visit, brunch, departure" },
      ],
      inclusions: ["3 nights beach hut stay", "Transfers from Goa", "Breakfast", "Beach trek guide"],
      exclusions: ["Water sports", "Dinners", "SCUBA add-ons"],
    },
    { id: "tirupati", name: "Tirupati Pilgrimage", type: "Pilgrimage", days: 3, nights: 2, price: 6899,
      hook: "Darshan assistance with a calm, unhurried plan",
      includes: ["Stay", "Transport", "Meals", "Guide"],
      gallery: ["Sri Venkateswara Temple", "Talakona", "Chandragiri Fort"],
      itinerary: [
        { day: 1, plan: "Arrive, evening darshan assistance at Tirumala" },
        { day: 2, plan: "Morning darshan, Talakona waterfall and forest temple" },
        { day: 3, plan: "Sri Kalahasti temple, departure" },
      ],
      inclusions: ["2 nights stay near Tirumala", "AC transport", "Darshan queue guidance", "Breakfast"],
      exclusions: ["Special darshan tickets", "Lunch and dinner", "Donations"],
    },
    { id: "shimla", name: "Shimla & Kufri Hills", type: "Hill station", days: 5, nights: 4, price: 12499,
      hook: "Colonial promenades, pine slopes and toy-train views",
      includes: ["Stay", "Transport", "Meals", "Guide", "Sightseeing"],
      gallery: ["The Ridge", "Kufri", "Christ Church"],
      itinerary: [
        { day: 1, plan: "Toy train from Kalka, check in, evening on The Ridge" },
        { day: 2, plan: "Kufri fun park and Himalayan Nature Park" },
        { day: 3, plan: "Jakhoo temple and Viceregal Lodge" },
        { day: 4, plan: "Day trip to Chail, Mall Road shopping" },
        { day: 5, plan: "Christ Church, brunch, departure" },
      ],
      inclusions: ["4 nights stay", "Toy train tickets", "Breakfast + dinner", "Local guide"],
      exclusions: ["Ski rentals", "Personal expenses"],
    },
    { id: "puri", name: "Puri & Konark Coast", type: "Pilgrimage", days: 4, nights: 3, price: 7999,
      hook: "Temple town mornings and a sun-kissed coast",
      includes: ["Stay", "Transport", "Meals", "Sightseeing"],
      gallery: ["Jagannath Temple", "Konark Sun Temple", "Chandrabhaga Beach"],
      itinerary: [
        { day: 1, plan: "Arrive, beach evening, temple town walk" },
        { day: 2, plan: "Jagannath Temple darshan, evening at Swargadwar" },
        { day: 3, plan: "Konark Sun Temple, Chandrabhaga beach" },
        { day: 4, plan: "Raghurajpur artisan village, departure" },
      ],
      inclusions: ["3 nights sea-view stay", "All transfers", "Breakfast", "Artisan village visit"],
      exclusions: ["Puja offerings", "Meals except breakfast"],
    },
  ];

  const ATTRACTIONS = [
    { id: "bangalore-palace", name: "Bangalore Palace", city: "Bengaluru", cat: "Monument", distance: 2.1, priceIn: 250, priceFx: 500, hours: "10:00 AM – 5:30 PM", openNow: true, closes: "5:30 PM", crowd: "high", desc: "Tudor-style royal palace with wood carvings and walled gardens." },
    { id: "lalbagh", name: "Lalbagh Botanical Garden", city: "Bengaluru", cat: "Park", distance: 4.3, priceIn: 30, priceFx: 60, hours: "6:00 AM – 7:00 PM", openNow: true, closes: "7:00 PM", crowd: "moderate", desc: "Historic garden with a glasshouse, lake and ancient trees." },
    { id: "visvesvaraya", name: "Visvesvaraya Museum", city: "Bengaluru", cat: "Museum", distance: 3.2, priceIn: 85, priceFx: 400, hours: "9:30 AM – 6:00 PM", openNow: true, closes: "6:00 PM", crowd: "low", desc: "Hands-on science museum with engine hall and space gallery." },
    { id: "tipu-palace", name: "Tipu Sultan's Summer Palace", city: "Bengaluru", cat: "Monument", distance: 5.2, priceIn: 20, priceFx: 200, hours: "8:30 AM – 5:30 PM", openNow: true, closes: "5:30 PM", crowd: "moderate", desc: "Teakwood palace with carved arches and murals." },
    { id: "cubbon-shetty", name: "Government Museum", city: "Bengaluru", cat: "Museum", distance: 3.0, priceIn: 15, priceFx: 250, hours: "9:00 AM – 5:00 PM", openNow: false, reopens: "Tomorrow 9:00 AM", crowd: "low", desc: "One of India's oldest museums with rare antiquities." },
    { id: "charminar", name: "Charminar", city: "Hyderabad", cat: "Monument", distance: 570, priceIn: 25, priceFx: 300, hours: "9:30 AM – 5:30 PM", openNow: true, closes: "5:30 PM", crowd: "moderate", desc: "1794 landmark mosque-tower in the old city." },
    { id: "golconda", name: "Golconda Fort", city: "Hyderabad", cat: "Fort", distance: 575, priceIn: 25, priceFx: 300, hours: "9:00 AM – 5:30 PM", openNow: false, reopens: "Tomorrow 9:00 AM", crowd: "low", desc: "Acoustic marvel fortress with a light show after dark." },
    { id: "om-beach", name: "Om Beach", city: "Gokarna", cat: "Beach", distance: 460, priceIn: 0, priceFx: 0, hours: "Open 24 hours", openNow: true, closes: "—", crowd: "low", desc: "Palm-fringed cove shaped like the Om symbol." },
  ];

  const TICKET_SLOTS = [
    { t: "9:00 AM", crowd: "low", note: "Recommended — lower crowd" },
    { t: "11:00 AM", crowd: "moderate", note: "" },
    { t: "1:00 PM", crowd: "high", note: "" },
    { t: "3:00 PM", crowd: "moderate", note: "" },
    { t: "5:00 PM", crowd: "low", note: "Recommended — lower crowd" },
  ];

  const TRANSPORT = {
    flight: [
      { id: "f1", airline: "IndiGo", dep: "06:20", arr: "07:50", dur: "1h 30m", stops: "Non-stop", price: 3890, from: "BLR", to: "GOI" },
      { id: "f2", airline: "Akasa Air", dep: "09:10", arr: "10:45", dur: "1h 35m", stops: "Non-stop", price: 4120, from: "BLR", to: "GOI" },
      { id: "f3", airline: "Air India", dep: "14:05", arr: "17:35", dur: "3h 30m", stops: "1 stop · HYD", price: 3240, from: "BLR", to: "GOI" },
      { id: "f4", airline: "IndiGo", dep: "19:40", arr: "21:05", dur: "1h 25m", stops: "Non-stop", price: 4510, from: "BLR", to: "GOI" },
    ],
    train: [
      { id: "t1", name: "Vasco Express", num: "17311", dep: "14:20", arr: "23:05", dur: "8h 45m", classes: [{ c: "3A", price: 1245, seats: 18 }, { c: "SL", price: 480, seats: 62 }, { c: "2A", price: 1780, seats: 0 }] },
      { id: "t2", name: "Poorna Express", num: "11097", dep: "21:05", arr: "07:40", dur: "10h 35m", classes: [{ c: "SL", price: 425, seats: 124 }, { c: "3A", price: 1120, seats: 6 }] },
      { id: "t3", name: "Goa Sampark Kranti", num: "12653", dep: "10:55", arr: "19:25", dur: "8h 30m", classes: [{ c: "2A", price: 1685, seats: 24 }, { c: "3A", price: 1180, seats: 41 }, { c: "SL", price: 455, seats: 0 }] },
    ],
    bus: [
      { id: "b1", op: "VRL Travels", type: "AC Sleeper", dep: "20:30", arr: "06:15", dur: "9h 45m", seats: 14, price: 1150 },
      { id: "b2", op: "Orange Tours", type: "AC Seater", dep: "22:00", arr: "08:30", dur: "10h 30m", seats: 31, price: 890 },
      { id: "b3", op: "KSRTC Airavat", type: "AC Sleeper", dep: "18:45", arr: "04:50", dur: "10h 05m", seats: 6, price: 1250 },
      { id: "b4", op: "Neeta Travels", type: "Non-AC Seater", dep: "19:30", arr: "06:40", dur: "11h 10m", seats: 22, price: 650 },
    ],
  };

  /* ---------- helpers ---------- */

  const fmtINR = (n) => "₹" + n.toLocaleString("en-IN");

  const CROWD_WORD = { low: "Low", moderate: "Moderate", high: "High" };

  function crowdChip(c) {
    return '<span class="cl-badge cl-' + c + '"><span class="cl-dot" aria-hidden="true"></span>' + CROWD_WORD[c] + '</span>';
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("show");
    setTimeout(() => { t.classList.remove("show"); t.hidden = true; }, 2600);
  }

  /* ---------- navigation wiring ---------- */

  const SUB_VIEWS = { "Ready-made journeys": "view-packages", "Skip-the-line entry": "view-tickets", "Travel between cities": "view-transport" };

  function initSubpages() {
    document.addEventListener("click", (e) => {
      const tile = e.target.closest(".tile");
      if (tile) {
        const title = tile.querySelector(".tile-title").textContent;
        const target = SUB_VIEWS[title];
        if (target) showView(target);
        return;
      }
      if (e.target.closest("[data-sub-back]")) { showView("view-dashboard"); return; }
      const nav = e.target.closest("[data-tabnav]");
      if (nav && !nav.classList.contains("active")) { showView("view-" + nav.dataset.tabnav); return; }
      if (e.target.closest(".tab[data-tabnav='dashboard']")) showView("view-dashboard");
    });
    showTabbarIfInApp();
    renderPackages();
    initPackageEvents();
    renderTickets();
    initTicketEvents();
    initTransport();
  }

  function showTabbarIfInApp() {
    document.getElementById("app-tabbar").hidden = !document.body.classList.contains("in-app");
  }

  /* ============================================================
     PAGE 1 — TOUR PACKAGES
     ============================================================ */

  const pkgState = { type: "any", dur: "any", price: "any", sort: "pop" };

  function renderPackageFilters() {
    document.getElementById("pkg-type-chips").innerHTML =
      '<button type="button" class="fchip' + (pkgState.type === "any" ? " active" : "") + '" data-ptype="any">All</button>' +
      PKG_TYPES.map((t) => '<button type="button" class="fchip' + (pkgState.type === t ? " active" : "") + '" data-ptype="' + t + '">' + t + '</button>').join("");
  }

  function filteredPackages() {
    let list = PACKAGES.filter((p) => {
      if (pkgState.type !== "any" && p.type !== pkgState.type) return false;
      if (pkgState.dur === "short" && p.nights > 3) return false;
      if (pkgState.dur === "mid" && (p.nights < 4 || p.nights > 5)) return false;
      if (pkgState.dur === "long" && p.nights < 6) return false;
      if (pkgState.price === "lt10k" && p.price >= 10000) return false;
      if (pkgState.price === "10to20k" && (p.price < 10000 || p.price > 20000)) return false;
      if (pkgState.price === "gt20k" && p.price <= 20000) return false;
      return true;
    });
    if (pkgState.sort === "plow") list.sort((a, b) => a.price - b.price);
    if (pkgState.sort === "phigh") list.sort((a, b) => b.price - a.price);
    if (pkgState.sort === "dur") list.sort((a, b) => a.days - b.days);
    return list;
  }

  function renderPackages() {
    renderPackageFilters();
    const grid = document.getElementById("pkg-grid");
    if (!grid) return;
    const list = filteredPackages();
    grid.innerHTML = list.length ? list.map((p) =>
      '<article class="pkg-card" data-pkg="' + p.id + '">' +
        '<div class="pkg-hero pkg-' + p.id + '"><span class="pkg-type">' + p.type + '</span></div>' +
        '<div class="pkg-body">' +
          '<h3>' + p.name + '</h3>' +
          '<p class="pkg-hook">' + p.hook + '</p>' +
          '<p class="pkg-dur">' + p.days + ' Days / ' + p.nights + ' Nights</p>' +
          '<div class="chip-row">' + p.includes.map((i) => '<span class="chip">' + i + '</span>').join("") + '</div>' +
          '<div class="pkg-foot">' +
            '<span class="pkg-price">' + fmtINR(p.price) + '<small> / person</small></span>' +
            '<button type="button" class="btn btn-pill btn-primary pkg-open" data-pkg-open="' + p.id + '">View package</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    ).join("") : '<p class="s-empty">No packages match those filters.</p>';
  }

  function openPackageDetail(id) {
    const p = PACKAGES.find((x) => x.id === id);
    const card = document.getElementById("pkg-detail-card");
    card.innerHTML =
      '<div class="pkg-detail-hero pkg-' + p.id + '">' +
        '<button class="pd-close" id="pd-close" type="button" aria-label="Close">×</button>' +
        '<span class="pkg-type">' + p.type + '</span>' +
      '</div>' +
      '<div class="pd-body">' +
        '<h2>' + p.name + '</h2>' +
        '<p class="pkg-dur">' + p.days + ' Days / ' + p.nights + ' Nights</p>' +
        '<div class="pd-gallery">' + p.gallery.map((g) => '<div class="pd-g-item">' + g + '</div>').join("") + '</div>' +
        '<h3 class="pd-h3">Day-by-day itinerary</h3>' +
        '<ol class="pd-itin">' + p.itinerary.map((d) => '<li><span class="pd-day">Day ' + d.day + '</span>' + d.plan + '</li>').join("") + '</ol>' +
        '<div class="pd-cols">' +
          '<div><h3 class="pd-h3">What\'s included</h3><ul class="pd-list">' + p.inclusions.map((i) => '<li>✓ ' + i + '</li>').join("") + '</ul></div>' +
          '<div><h3 class="pd-h3">Not included</h3><ul class="pd-list pd-ex">' + p.exclusions.map((i) => '<li>✕ ' + i + '</li>').join("") + '</ul></div>' +
        '</div>' +
        '<div class="pd-pricebox">' +
          '<div><span class="pd-big">' + fmtINR(p.price) + '</span><small> per person</small>' +
          '<span class="pd-note">+' + fmtINR(Math.round(p.price * 0.05)) + ' taxes & fees</span></div>' +
          '<button type="button" class="btn btn-pill btn-primary" id="pd-book">Book this package</button>' +
        '</div>' +
      '</div>';
    document.getElementById("pkg-detail").hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("pd-close").addEventListener("click", closePackageDetail);
    document.getElementById("pd-book").addEventListener("click", () => {
      closePackageDetail();
      toast("Package enquiry started — our planner will call you");
    });
  }

  function closePackageDetail() {
    document.getElementById("pkg-detail").hidden = true;
    document.body.style.overflow = "";
  }

  function initPackageEvents() {
    document.getElementById("pkg-grid").addEventListener("click", (e) => {
      const open = e.target.closest("[data-pkg-open]");
      if (open) openPackageDetail(open.dataset.pkgOpen);
    });
    document.getElementById("pkg-type-chips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-ptype]");
      if (chip) { pkgState.type = chip.dataset.ptype; renderPackages(); }
    });
    document.getElementById("pkg-duration").addEventListener("change", (e) => { pkgState.dur = e.target.value; renderPackages(); });
    document.getElementById("pkg-price").addEventListener("change", (e) => { pkgState.price = e.target.value; renderPackages(); });
    document.getElementById("pkg-sort").addEventListener("change", (e) => { pkgState.sort = e.target.value; renderPackages(); });
    document.getElementById("pkg-detail").addEventListener("click", (e) => {
      if (e.target.id === "pkg-detail") closePackageDetail();
    });
  }

  /* ============================================================
     PAGE 2 — ENTRY TICKETS
     ============================================================ */

  const tkState = { q: "", city: "any", cat: "any" };

  function renderTickets() {
    const citySel = document.getElementById("tk-city");
    const catSel = document.getElementById("tk-cat");
    const cities = [...new Set(ATTRACTIONS.map((a) => a.city))];
    const cats = [...new Set(ATTRACTIONS.map((a) => a.cat))];
    if (citySel.options.length <= 1) {
      cities.forEach((c) => citySel.add(new Option(c, c)));
      cats.forEach((c) => catSel.add(new Option(c, c)));
    }
    const list = ATTRACTIONS.filter((a) => {
      if (tkState.city !== "any" && a.city !== tkState.city) return false;
      if (tkState.cat !== "any" && a.cat !== tkState.cat) return false;
      if (tkState.q && !(a.name + " " + a.city + " " + a.cat).toLowerCase().includes(tkState.q)) return false;
      return true;
    }).sort((a, b) => a.distance - b.distance);
    const open = list.filter((a) => a.openNow);
    const closed = list.filter((a) => !a.openNow);
    document.getElementById("tk-open-list").innerHTML = open.length ? open.map(attractionCard).join("") :
      '<p class="s-empty">Nothing matching near you right now.</p>';
    document.getElementById("tk-closed-list").innerHTML = closed.length ? closed.map(attractionCard).join("") :
      '<p class="s-empty">Nothing is currently closed near you.</p>';
  }

  function attractionCard(a) {
    const priceTxt = a.priceIn === 0 ? "Free entry" :
      fmtINR(a.priceIn) + " (Indian)" + (a.priceFx ? " / " + fmtINR(a.priceFx) + " (Foreign national)" : "");
    return '<article class="tk-card' + (a.openNow ? "" : " tk-closed") + '">' +
      '<div class="tk-hero"><span class="tk-cat">' + a.cat + '</span></div>' +
      '<div class="tk-body">' +
        '<div class="s-top"><h3>' + a.name + '</h3>' + crowdChip(a.crowd) + '</div>' +
        '<p class="s-loc">' + a.city + ' · ' + a.distance + ' km away</p>' +
        '<p class="tk-status">' + (a.openNow
          ? 'Open · closes ' + a.closes
          : '<span class="cl-badge cl-high">Closed now</span> · opens ' + a.reopens) + '</p>' +
        '<p class="tk-price">' + priceTxt + '</p>' +
        (a.openNow
          ? '<button type="button" class="btn btn-pill btn-primary tk-book" data-tk-book="' + a.id + '">Book ticket</button>'
          : '<button type="button" class="btn btn-pill btn-ghost tk-notify" data-tk-notify="' + a.id + '">Notify when open</button>') +
      '</div>' +
    '</article>';
  }

  function openTicketModal(id) {
    const a = ATTRACTIONS.find((x) => x.id === id);
    const card = document.getElementById("ticket-modal-card");
    card.innerHTML =
      '<div class="modal-head"><h2>Book · ' + a.name + '</h2><button class="pd-close" id="tm-close" type="button" aria-label="Close">×</button></div>' +
      '<div class="modal-body">' +
        '<label class="tm-field"><span>Date</span><input type="date" id="tm-date" /></label>' +
        '<div class="tm-label">Time slot</div>' +
        '<div class="slot-grid" id="slot-grid">' +
          TICKET_SLOTS.map((s, i) =>
            '<button type="button" class="slot sl-' + s.crowd + (i === 0 ? " selected" : "") + '" data-slot="' + s.t + '">' +
              '<strong>' + s.t + '</strong>' +
              '<span class="slot-crowd">' + CROWD_WORD[s.crowd] + '</span>' +
              (s.note ? '<em>' + s.note + '</em>' : "") +
            '</button>').join("") +
        '</div>' +
        '<div class="tm-row">' +
          '<label class="tm-field"><span>Visitors</span><input type="number" id="tm-pax" min="1" max="10" value="2" /></label>' +
          '<label class="tm-field"><span>Ticket type</span><select id="tm-type"><option value="in">Indian ' + (a.priceIn ? "(" + fmtINR(a.priceIn) + ")" : "") + '</option>' +
            (a.priceFx ? '<option value="fx">Foreign national (' + fmtINR(a.priceFx) + ')</option>' : "") + '</select></label>' +
        '</div>' +
        '<div class="tm-summary" id="tm-summary"></div>' +
        '<button type="button" class="btn btn-pill btn-primary btn-block" id="tm-confirm">Confirm booking</button>' +
      '</div>';
    document.getElementById("ticket-modal").hidden = false;
    document.body.style.overflow = "hidden";
    let slot = TICKET_SLOTS[0].t;
    const update = () => {
      const pax = Math.max(1, parseInt(document.getElementById("tm-pax").value) || 1);
      const type = document.getElementById("tm-type").value;
      const unit = type === "in" ? a.priceIn : a.priceFx;
      document.getElementById("tm-summary").innerHTML =
        '<div><span>Tickets × ' + pax + ' · ' + slot + '</span><strong>' + fmtINR(unit * pax) + '</strong></div>' +
        '<div><span>Convenience fee</span><strong>' + fmtINR(Math.round(unit * pax * 0.02)) + '</strong></div>' +
        '<div class="tm-total"><span>Total</span><strong>' + fmtINR(Math.round(unit * pax * 1.02)) + '</strong></div>';
    };
    document.getElementById("slot-grid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-slot]");
      if (!b) return;
      document.querySelectorAll(".slot").forEach((s) => s.classList.remove("selected"));
      b.classList.add("selected");
      slot = b.dataset.slot;
      update();
    });
    document.getElementById("tm-pax").addEventListener("input", update);
    document.getElementById("tm-type").addEventListener("change", update);
    document.getElementById("tm-close").addEventListener("click", closeTicketModal);
    document.getElementById("tm-confirm").addEventListener("click", () => {
      closeTicketModal();
      toast("Tickets booked for " + a.name + " at " + slot + " — check Trips");
    });
    update();
  }

  function closeTicketModal() {
    document.getElementById("ticket-modal").hidden = true;
    document.body.style.overflow = "";
  }

  function initTicketEvents() {
    document.getElementById("tk-search").addEventListener("input", (e) => { tkState.q = e.target.value.trim().toLowerCase(); renderTickets(); });
    document.getElementById("tk-city").addEventListener("change", (e) => { tkState.city = e.target.value; renderTickets(); });
    document.getElementById("tk-cat").addEventListener("change", (e) => { tkState.cat = e.target.value; renderTickets(); });
    document.getElementById("tk-open-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tk-book]");
      if (b) openTicketModal(b.dataset.tkBook);
    });
    document.getElementById("tk-closed-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tk-notify]");
      if (b) { b.textContent = "We'll notify you ✓"; b.disabled = true; toast("We'll ping you when it opens"); }
    });
    document.getElementById("ticket-modal").addEventListener("click", (e) => {
      if (e.target.id === "ticket-modal") closeTicketModal();
    });
  }

  /* ============================================================
     PAGE 3 — TRANSPORT BOOKING
     ============================================================ */

  const trState = { mode: "flight", sort: "price" };

  function durMin(d) {
    const m = d.match(/(\d+)h\s*(\d+)?m?/);
    return m ? parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0) : 9999;
  }

  function sortedTransport() {
    const list = [...TRANSPORT[trState.mode]];
    if (trState.sort === "price") list.sort((a, b) => modePrice(a) - modePrice(b));
    if (trState.sort === "dur") list.sort((a, b) => durMin(a.dur) - durMin(b.dur));
    if (trState.sort === "dep") list.sort((a, b) => a.dep.localeCompare(b.dep));
    return list;
  }

  function modePrice(r) {
    if (r.classes) return Math.min(...r.classes.filter((c) => c.seats > 0).map((c) => c.price), Infinity) || r.classes[0].price;
    return r.price;
  }

  function renderTransport() {
    const from = document.getElementById("tr-from").value || "Bengaluru";
    const to = document.getElementById("tr-to").value || "Goa";
    document.getElementById("tr-results-title").textContent =
      (trState.mode === "flight" ? "Flights" : trState.mode === "train" ? "Trains" : "Buses") + " · " + from + " → " + to;
    document.getElementById("tr-list").innerHTML = sortedTransport().map((r) =>
      '<article class="tr-card" data-tr="' + r.id + '">' +
        '<div class="tr-main">' +
          '<div class="tr-times"><strong>' + r.dep + '</strong><span class="tr-dur">' + r.dur + '</span><strong>' + r.arr + '</strong></div>' +
          '<div class="tr-mid">' +
            (r.airline ? '<h3>' + r.airline + '</h3><p>' + r.stops + '</p>' :
             r.name ? '<h3>' + r.name + '</h3><p>#' + r.num + '</p>' :
             '<h3>' + r.op + '</h3><p>' + r.type + '</p>') +
          '</div>' +
          '<div class="tr-right">' +
            '<span class="tr-price">' + fmtINR(modePrice(r)) + '</span>' +
            (r.seats !== undefined ? '<span class="tr-seats">' + r.seats + ' seats left</span>' :
             r.classes ? '<span class="tr-seats">' + r.classes.map((c) => c.c).join(" · ") + '</span>' : '') +
          '</div>' +
        '</div>' +
        (r.classes ? '<div class="tr-classrow">' + r.classes.map((c) =>
          '<span class="cls' + (c.seats === 0 ? " full" : "") + '">' + c.c + ' ' + fmtINR(c.price) +
          '<em>' + (c.seats === 0 ? "Waitlist" : c.seats + ' seats') + '</em></span>').join("") + '</div>' : "") +
      '</article>'
    ).join("") || '<p class="s-empty">No results — try a different search.</p>';
    renderCompare();
  }

  function renderCompare() {
    const strip = document.getElementById("compare-strip");
    if (strip.hidden) return;
    const best = (mode) => {
      const l = [...TRANSPORT[mode]];
      const cheap = l.reduce((a, b) => (modePrice(b) < modePrice(a) ? b : a));
      const fast = l.reduce((a, b) => (durMin(b.dur) < durMin(a.dur) ? b : a));
      return { cheap, fast };
    };
    strip.innerHTML = ["flight", "train", "bus"].map((m) => {
      const { cheap, fast } = best(m);
      return '<div class="cmp-card"><h4>' + (m === "flight" ? "✈️ Flight" : m === "train" ? "🚆 Train" : "🚌 Bus") + '</h4>' +
        '<p><strong>Cheapest</strong> ' + fmtINR(modePrice(cheap)) + '</p>' +
        '<p><strong>Fastest</strong> ' + fast.dur + '</p>' +
        '<button type="button" class="btn btn-pill btn-ghost" data-cmp="' + m + '">See options</button></div>';
    }).join("");
  }

  function openTransportModal(id) {
    const r = TRANSPORT[trState.mode].find((x) => x.id === id);
    const title = r.airline || r.name || r.op;
    const sub = trState.mode === "train"
      ? r.classes.map((c) => c.c).join(" / ")
      : (r.stops || r.type);
    const card = document.getElementById("tr-modal-card");
    card.innerHTML =
      '<div class="modal-head"><h2>' + title + '</h2><button class="pd-close" id="trm-close" type="button" aria-label="Close">×</button></div>' +
      '<p class="tr-sub">' + r.dep + ' → ' + r.arr + ' · ' + r.dur + (sub ? " · " + sub : "") + '</p>' +
      '<div class="modal-body">' +
        (trState.mode === "train"
          ? '<div class="tm-label">Class</div><div class="slot-grid" id="cls-grid">' +
            r.classes.map((c, i) => '<button type="button" class="slot sl-' + (c.seats === 0 ? "high" : c.seats > 20 ? "low" : "moderate") + (i === 0 && c.seats > 0 ? " selected" : "") +
              '" data-cls="' + c.c + '" ' + (c.seats === 0 ? "disabled" : "") + '><strong>' + c.c + '</strong><span class="slot-crowd">' + fmtINR(c.price) + '</span><em>' + (c.seats === 0 ? "Waitlist" : c.seats + " seats") + '</em></button>').join("") + '</div>'
          : "") +
        '<div class="tm-row">' +
          '<label class="tm-field"><span>Travelers</span><input type="number" id="trm-pax" min="1" max="6" value="' + (document.getElementById("tr-pax").value || 1) + '" /></label>' +
          '<label class="tm-field"><span>Lead traveler</span><input type="text" placeholder="Full name" /></label>' +
        '</div>' +
        '<div class="tm-summary" id="trm-summary"></div>' +
        '<button type="button" class="btn btn-pill btn-primary btn-block" id="trm-confirm">Confirm booking</button>' +
      '</div>';
    document.getElementById("tr-modal").hidden = false;
    document.body.style.overflow = "hidden";
    let cls = r.classes ? (r.classes.find((c) => c.seats > 0) || r.classes[0]) : null;
    const update = () => {
      const pax = Math.max(1, parseInt(document.getElementById("trm-pax").value) || 1);
      const unit = cls ? cls.price : r.price;
      document.getElementById("trm-summary").innerHTML =
        '<div><span>' + (cls ? cls.c : r.type || "Fare") + ' × ' + pax + '</span><strong>' + fmtINR(unit * pax) + '</strong></div>' +
        '<div><span>Booking fee</span><strong>' + fmtINR(49 * pax) + '</strong></div>' +
        '<div class="tm-total"><span>Total</span><strong>' + fmtINR(unit * pax + 49 * pax) + '</strong></div>';
    };
    if (r.classes) {
      document.getElementById("cls-grid").addEventListener("click", (e) => {
        const b = e.target.closest("[data-cls]");
        if (!b || b.disabled) return;
        document.querySelectorAll("#cls-grid .slot").forEach((s) => s.classList.remove("selected"));
        b.classList.add("selected");
        cls = r.classes.find((c) => c.c === b.dataset.cls);
        update();
      });
    }
    document.getElementById("trm-pax").addEventListener("input", update);
    document.getElementById("trm-close").addEventListener("click", closeTransportModal);
    document.getElementById("trm-confirm").addEventListener("click", () => {
      closeTransportModal();
      toast(title + " booked — " + document.getElementById("tr-from").value + " → " + document.getElementById("tr-to").value);
    });
    update();
  }

  function closeTransportModal() {
    document.getElementById("tr-modal").hidden = true;
    document.body.style.overflow = "";
  }

  function initTransport() {
    document.getElementById("tr-date").value = new Date().toISOString().slice(0, 10);
    document.querySelectorAll(".mode-tab").forEach((t) => t.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      trState.mode = t.dataset.mode;
      renderTransport();
    }));
    document.getElementById("tr-swap").addEventListener("click", () => {
      const f = document.getElementById("tr-from");
      const t = document.getElementById("tr-to");
      [f.value, t.value] = [t.value, f.value];
      renderTransport();
    });
    document.getElementById("tr-search").addEventListener("submit", (e) => { e.preventDefault(); renderTransport(); });
    document.getElementById("tr-sort").addEventListener("change", (e) => { trState.sort = e.target.value; renderTransport(); });
    document.getElementById("compare-btn").addEventListener("click", () => {
      const strip = document.getElementById("compare-strip");
      strip.hidden = !strip.hidden;
      if (!strip.hidden) renderCompare();
    });
    document.getElementById("compare-strip").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cmp]");
      if (!b) return;
      const mode = b.dataset.cmp;
      document.querySelectorAll(".mode-tab").forEach((x) => x.classList.toggle("active", x.dataset.mode === mode));
      trState.mode = mode;
      renderTransport();
    });
    document.getElementById("tr-list").addEventListener("click", (e) => {
      const card = e.target.closest("[data-tr]");
      if (card) openTransportModal(card.dataset.tr);
    });
    document.getElementById("tr-modal").addEventListener("click", (e) => {
      if (e.target.id === "tr-modal") closeTransportModal();
    });
    renderTransport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
