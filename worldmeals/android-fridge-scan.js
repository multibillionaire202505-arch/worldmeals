/* WorldMeals — Fridge Scan for the ANDROID app (and the website).
 * Does NOTHING on iPhone: if the native iPhone scanner bridge exists, this file stops on line 1.
 *
 * What it does on Android:
 *  1. After a fridge photo is taken (or picked from the gallery), it shrinks the photo on the phone,
 *     sends it to /api/android-scan (Passport only, daily limits on the server), and fills the
 *     "Detected / confirmed ingredients" box with what the AI sees. The user can still edit it.
 *  2. Adds a "Choose a photo from your gallery" button (more reliable on low-memory phones).
 *  3. If Android closes WorldMeals while the camera is open, the app reopens on Scan (not Browse).
 *  4. FOOD RESCUE: two choices at the top of Scan ("Scan Fridge" / "Food Rescue"). In Food Rescue,
 *     the user snaps food that is getting old; WorldMeals shows "Rescue these first" and puts the
 *     dishes that use those items at the top. (See the FOOD RESCUE section at the bottom.)
 * To turn all of this off: remove the one <script src="/android-fridge-scan.js"> line in app.html.
 */
(function () {
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.worldMealsNative) return;

  var PENDING_KEY = 'wm_scan_pending';
  var PENDING_MAX_AGE = 10 * 60 * 1000;
  var MAX_SIDE = 1280;          // photo is resized to at most 1280px before upload
  var JPEG_QUALITY = 0.8;
  var busy = false;
  var MODE_KEY = 'wm_scan_mode';   // 'fridge' or 'rescue' (Food Rescue)
  var mode = 'fridge';
  var kidsOnly = false;
  var kidsAge = '';                // Kids dishes: '6-12m', '1-2y', '3-5y', '6-8y' or '9-12y'            // Food Rescue: true = search only the kids dishes
  var rescueItems = [];            // names found by the last Food Rescue scan

  function $(id) { return document.getElementById(id); }
  // Scan feedback colors: orange blinking while scanning, green when food is found, red blinking when it fails.
  (function addScanToneStyle() {
    if (document.getElementById('wmScanToneStyle')) return;
    var st = document.createElement('style'); st.id = 'wmScanToneStyle';
    st.textContent =
      '#scanResult .scan-summary.wm-tone-scan{border:2px solid #F28C28;border-radius:22px;animation:wmScanPulse 1.1s ease-in-out infinite}' +
      '#scanResult .scan-summary.wm-tone-scan .scan-summary-title{color:#D9630B;animation:wmScanBlink 1.1s ease-in-out infinite}' +
      '@keyframes wmScanPulse{0%,100%{background:#FFF8EF;box-shadow:0 0 0 0 rgba(242,140,40,.45)}50%{background:#FFE7CC;box-shadow:0 0 0 8px rgba(242,140,40,0)}}' +
      '@keyframes wmScanBlink{0%,100%{opacity:1}50%{opacity:.4}}' +
      '#scanResult .scan-summary.wm-tone-ok{border:2px solid #2E9E5B;border-radius:22px;animation:wmScanOk .5s ease-in-out 2}' +
      '#scanResult .scan-summary.wm-tone-ok .scan-summary-title{color:#1F7A45}' +
      '@keyframes wmScanOk{50%{background:#D3F0DD;box-shadow:0 0 0 6px rgba(46,158,91,.18)}}' +
      '#scanResult .scan-summary.wm-tone-fail{border:2px solid #E0453A;border-radius:22px;background:#FDEDEC;animation:wmScanFail .5s ease-in-out 5}' +
      '#scanResult .scan-summary.wm-tone-fail .scan-summary-title{color:#C0392B}' +
      '@keyframes wmScanFail{50%{background:#F8C6C1;box-shadow:0 0 0 6px rgba(224,69,58,.20)}}' +
      '@media (prefers-reduced-motion:reduce){#scanResult .scan-summary,#scanResult .scan-summary-title{animation:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  })();
  function setStatus(title, sub, stay, tone) {
    var box = $('scanResult');
    if (!box) return;
    box.innerHTML = '<div class="scan-summary' + (tone ? ' wm-tone-' + tone : '') + '" data-wm-scan="1"><div class="scan-summary-title"></div><div class="scan-summary-sub"></div></div>';   // tone: 'scan' (orange), 'ok' (green), 'fail' (red)
    box.querySelector('.scan-summary-title').textContent = title;
    box.querySelector('.scan-summary-sub').textContent = sub || '';
    if (!stay && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });   // keep the message on screen
  }
  function pending(action) {
    try {
      if (action === 'set') localStorage.setItem(PENDING_KEY, String(Date.now()));
      else if (action === 'clear') localStorage.removeItem(PENDING_KEY);
      else { var t = Number(localStorage.getItem(PENDING_KEY)) || 0; localStorage.removeItem(PENDING_KEY); return t; }
    } catch (e) {}
    return 0;
  }
  function appId() {
    if (window.wmDeviceId && /^dev_[A-Za-z0-9-]{16,64}$/.test(window.wmDeviceId)) return window.wmDeviceId;
    return typeof getAnonId === 'function' ? getAnonId() : '';
  }

  // The verified Google Play pass expires (at most 24 hours, and within minutes for Play test
  // subscriptions). If it is missing or expired, ask Google Play for a fresh one before scanning.
  function readPass() { try { return localStorage.getItem('worldmeals.subscription.entitlement') || ''; } catch (e) { return ''; } }
  function passExpired(pass) {
    try {
      var data = JSON.parse(atob(pass.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
      return !(data.exp * 1000 > Date.now() + 30000);
    } catch (e) { return true; }
  }
  var diag = '';   // short note on what Google Play said, shown only if Passport is refused
  async function freshPass(force) {
    var pass = readPass();
    if (force || !pass || passExpired(pass)) {
      if (!(window.WorldMealsIAP && typeof window.WorldMealsIAP.restore === 'function')) {
        diag = 'play_billing_not_ready';
      } else {
        var seen = [];
        var listen = function (e) { var d = e.detail || {}; seen.push(d.status + (d.plan ? ':' + d.plan : '')); };
        window.addEventListener('worldmeals:iap', listen);
        try { await window.WorldMealsIAP.restore(); } catch (e) { seen.push('restore_error'); }
        window.removeEventListener('worldmeals:iap', listen);
        pass = readPass();
        diag = (seen.length ? 'play=' + seen.join(',') : 'play=no_answer') + (pass ? ',pass_ok' : ',no_pass');
      }
    }
    return pass;
  }
  async function send(image, force) {
    var headers = { 'Content-Type': 'application/json', 'X-WM-Id': appId() };
    var pass = await freshPass(force);
    if (pass) headers['X-WM-Entitlement'] = pass;
    var res = await fetch('/api/android-scan', { method: 'POST', headers: headers, body: JSON.stringify({ image: image }) });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    return { res: res, data: data };
  }

  // Shrink the photo on the phone so it uploads fast (and costs less to analyze).
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This photo could not be opened.')); };
      img.src = url;
    });
  }

  // The app's existing photo preview writes "Photo added ✅" a moment after the photo loads.
  // While a scan is running, put the "Scanning your fridge…" message back if that happens.
  var SCANNING_TITLE = 'Scanning your fridge… 🔍';
  var SCANNING_SUB = 'WorldMeals is looking for ingredients in your photo. This takes a few seconds.';
  function guardStatus() {
    var box = $('scanResult');
    if (!box || !window.MutationObserver) return;
    new MutationObserver(function () {
      if (busy && !box.querySelector('[data-wm-scan]')) setStatus(SCANNING_TITLE, SCANNING_SUB, false, 'scan');
    }).observe(box, { childList: true });
  }

  async function analyze(file) {
    if (!file || busy) return;
    if (!/^image\//.test(file.type || 'image/')) return;
    busy = true;
    var button = $('nativeFridgeScanButton');
    if (button) button.setAttribute('aria-busy', 'true');
    try {
      setStatus('Scanning your fridge… 🔍', 'WorldMeals is looking for ingredients in your photo. This takes a few seconds.', false, 'scan');
      var oldList = $('scanIngredients');   // new photo: clear the last scan's ingredients right away
      if (oldList) oldList.value = '';
      rescueItems = [];
      var image = await shrink(file);
      setStatus('Scanning your fridge… 🔍', 'WorldMeals is looking for ingredients in your photo. This takes a few seconds.', false, 'scan');
      var out = await send(image, false);
      // Pass refused: refresh it with Google Play once and try again.
      if (out.res.status === 403 && out.data.code === 'passport_required') out = await send(image, true);
      var res = out.res, data = out.data;
      if (!res.ok) {
        if (data.code === 'passport_required') setStatus('Passport needed for Fridge Scan', data.error + (data.reason ? ' (code: ' + data.reason + (diag ? ' · ' + diag : '') + ')' : ''), false, 'fail');
        else setStatus('Scan needs another try', (data.error || 'WorldMeals could not analyze that photo.') + ' You can also type your ingredients below.', false, 'fail');
        return;
      }
      var names = (Array.isArray(data.ingredients) ? data.ingredients : [])
        .map(function (x) { return String(x.displayName || x.name || '').trim(); })
        .filter(Boolean);
      if (!names.length) {
        setStatus('No ingredients spotted yet', 'Try a brighter photo with the fridge door fully open, or type your ingredients below.', false, 'fail');
        return;
      }
      var box = $('scanIngredients');
      if (box) box.value = names.join(', ');
      if (mode === 'rescue') {
        var found = rescueList(data.ingredients);
        // Dishes are ranked by the "use soon" items when there are any, otherwise by everything found.
        rescueItems = (found.urgent.length ? found.urgent : found.food.filter(function (x) { return !x.unsafe; }))
          .map(function (x) { return x.name; });
        if (box) box.value = found.food.filter(function (x) { return !x.unsafe; }).map(function (x) { return x.name; }).join(', ');
        showRescue(found);
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setStatus('Fridge scan complete ✅ ' + names.length + ' ingredients found', 'Check the list (add or remove anything), then tap Find Meals From This.', false, 'ok');
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      setStatus('Scan needs another try', 'Check your internet connection and try again, or type your ingredients below.', false, 'fail');
    } finally {
      busy = false;
      if (button) button.removeAttribute('aria-busy');
    }
  }

  function setup() {
    var camera = $('fridgePhotoInput');
    var scanButton = $('nativeFridgeScanButton');
    if (!camera || !scanButton) return;
    guardStatus();
    var subtitle = $('nativeFridgeScanSubtitle');
    if (subtitle) subtitle.textContent = 'Take a photo and WorldMeals finds your ingredients';

    // Gallery option
    var gallery = document.createElement('input');
    gallery.type = 'file'; gallery.accept = 'image/*'; gallery.id = 'fridgeGalleryInput'; gallery.style.display = 'none';
    gallery.addEventListener('change', function (event) {
      pending('clear');
      if (typeof handleFridgePhoto === 'function') handleFridgePhoto(event);   // existing photo preview
      analyze(event.target.files && event.target.files[0]);
      gallery.value = '';
    });
    var galleryButton = document.createElement('button');
    galleryButton.type = 'button'; galleryButton.className = 'scan-btn secondary'; galleryButton.id = 'fridgeGalleryButton';
    galleryButton.style.cssText = 'width:100%;margin-top:10px';
    galleryButton.textContent = '🖼️ Choose a photo from your gallery';
    galleryButton.addEventListener('click', function () {
      if (typeof wmRequirePlan === 'function' && !wmRequirePlan('passport', 'Camera & Fridge Scan')) return;
      gallery.click();
    });
    scanButton.insertAdjacentElement('afterend', galleryButton);
    galleryButton.insertAdjacentElement('afterend', gallery);
    setupRescue(scanButton);

    // Camera: the existing onchange shows the preview; this adds the AI scan.
    camera.addEventListener('click', function () { pending('set'); saveMode(); });
    camera.addEventListener('change', function (event) {
      pending('clear');
      analyze(event.target.files && event.target.files[0]);
      camera.value = '';
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') setTimeout(function () { pending('clear'); }, 2000);
    });

    // App was restarted while the camera was open: reopen Scan instead of Browse.
    var started = pending('take');
    var savedMode = takeMode();
    if (!started || Date.now() - started > PENDING_MAX_AGE) return;
    if (savedMode === 'rescue') setMode('rescue');
    if (typeof showPage === 'function') showPage('scan');
    setStatus("Your photo didn't come through 📷", 'Your phone closed WorldMeals while the camera was open. Tap "Choose a photo from your gallery" to pick the photo you just took.', false, 'fail');
    if (typeof toast === 'function') toast("📷 Photo didn't come through. Choose it from your gallery.");
  }

  /* ===================== FOOD RESCUE ===================== */
  var MODES = {
    fridge: { kicker: '', title: '', icon: '📸', button: 'Tap to scan your fridge', sub: 'Take a photo and WorldMeals finds your ingredients' },
    rescue: { kicker: '🥬 FOOD RESCUE', title: 'Rescue food before it goes to waste', icon: '🥬', button: 'Snap the food you want to rescue', sub: 'Wilting veggies, ripe fruit, leftovers, opened packs…' }
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function saveMode() { try { localStorage.setItem(MODE_KEY, mode); } catch (e) {} }
  function takeMode() { var m = ''; try { m = localStorage.getItem(MODE_KEY) || ''; localStorage.removeItem(MODE_KEY); } catch (e) {} return m; }

  function setMode(next) {
    mode = next === 'rescue' ? 'rescue' : 'fridge';
    var cfg = MODES[mode];
    var kicker = document.querySelector('#page-scan .scan-kicker');
    var title = document.querySelector('#page-scan .scan-title');
    if (kicker) kicker.textContent = cfg.kicker || kicker.getAttribute('data-wm-orig');
    if (title) title.textContent = cfg.title || title.getAttribute('data-wm-orig');
    var icon = document.querySelector('#nativeFridgeScanButton .scan-upload-icon');
    var btnTitle = document.querySelector('#nativeFridgeScanButton .scan-upload-title');
    var sub = $('nativeFridgeScanSubtitle');
    if (icon) icon.textContent = cfg.icon;
    if (btnTitle) btnTitle.textContent = cfg.button;
    if (sub) sub.textContent = cfg.sub;
    ['fridge', 'rescue'].forEach(function (m) {
      var b = $('wmMode-' + m);
      if (!b) return;
      var on = m === mode;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.background = on ? '#167A5A' : '#FFF7ED';
      b.style.color = on ? '#fff' : '#8A4B13';
      b.style.borderColor = on ? '#167A5A' : '#E8D3B8';
    });
    if (mode === 'fridge') rescueItems = [];
    var forBar = $('wmRescueFor');
    if (forBar) forBar.style.display = mode === 'rescue' ? 'flex' : 'none';
    var ageBar = $('wmRescueAge');
    if (ageBar) ageBar.style.display = (mode === 'rescue' && kidsOnly) ? 'flex' : 'none';
  }

  function setupRescue(scanButton) {
    var kicker = document.querySelector('#page-scan .scan-kicker');
    var title = document.querySelector('#page-scan .scan-title');
    if (kicker) kicker.setAttribute('data-wm-orig', kicker.textContent);
    if (title) title.setAttribute('data-wm-orig', title.textContent);

    var bar = document.createElement('div');
    bar.id = 'wmScanModes';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Choose a scan');
    bar.style.cssText = 'display:flex;gap:10px;margin-bottom:12px';
    [['fridge', '📸 Scan Fridge'], ['rescue', '🥬 Food Rescue']].forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'wmMode-' + m[0]; b.textContent = m[1];
      b.style.cssText = 'flex:1;min-height:48px;border-radius:14px;border:1.5px solid #E8D3B8;font-family:inherit;font-size:14px;font-weight:900;line-height:1.2;cursor:pointer';
      b.addEventListener('click', function () {
        if (mode === m[0]) return;
        setMode(m[0]);
        var box = $('scanResult');
        if (box && m[0] === 'rescue') setStatus('🥬 Food Rescue', 'Snap the food that needs to be used soon (or type it below). WorldMeals shows dishes that use it first, so nothing goes to waste.', true);
        else if (box) box.innerHTML = '';
      });
      bar.appendChild(b);
    });
    scanButton.insertAdjacentElement('beforebegin', bar);

    // Food Rescue only: parents choose who the dishes are for.
    var forBar = document.createElement('div');
    forBar.id = 'wmRescueFor';
    forBar.setAttribute('role', 'group');
    forBar.setAttribute('aria-label', 'Dishes for');
    forBar.style.cssText = 'display:none;gap:8px;margin:-2px 0 12px';
    function paintFor() {
      [['adult', false], ['kids', true]].forEach(function (k) {
        var b = $('wmFor-' + k[0]);
        if (!b) return;
        var on = kidsOnly === k[1];
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.style.background = on ? '#FFF1E0' : '#fff';
        b.style.borderColor = on ? '#E8A04A' : '#E8D3B8';
        b.style.color = on ? '#8A4B13' : '#7A6B5D';
      });
    }
    [['adult', '🍽️ Grown-up dishes', false], ['kids', '🧒 Kids dishes', true]].forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'wmFor-' + k[0]; b.textContent = k[1];
      b.style.cssText = 'flex:1;min-height:42px;border-radius:999px;border:1.5px solid #E8D3B8;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;background:#fff';
      b.addEventListener('click', function () {
        if (kidsOnly === k[2]) return;
        kidsOnly = k[2];
        paintFor();
        var ageBar = $('wmRescueAge');
        if (ageBar) ageBar.style.display = kidsOnly ? 'flex' : 'none';
        try { localStorage.setItem('wm_rescue_for', kidsOnly ? 'kids' : 'adult'); } catch (e) {}
        var box = $('scanResult');
        if (box && box.querySelector('.chef-match-card') && typeof window.scanFindMeals === 'function') window.scanFindMeals();
      });
      forBar.appendChild(b);
    });
    try { kidsOnly = localStorage.getItem('wm_rescue_for') === 'kids'; } catch (e) {}
    bar.insertAdjacentElement('afterend', forBar);
    paintFor();

    // Kids dishes are organized by age; dishes for one age can be unsafe for a younger child,
    // so parents pick the age and only that age's dishes are searched.
    var AGES = [['6-12m', '👶 6–12 mo'], ['1-2y', '🧒 1–2 yrs'], ['3-5y', '🧒 3–5 yrs'], ['6-8y', '🧒 6–8 yrs'], ['9-12y', '🧑 9–12 yrs']];
    var ageBar = document.createElement('div');
    ageBar.id = 'wmRescueAge';
    ageBar.setAttribute('role', 'group');
    ageBar.setAttribute('aria-label', "Child's age");
    ageBar.style.cssText = 'display:none;flex-wrap:wrap;gap:6px;margin:-4px 0 12px';
    function paintAge() {
      AGES.forEach(function (a) {
        var b = $('wmAge-' + a[0]);
        if (!b) return;
        var on = kidsAge === a[0];
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.style.background = on ? '#167A5A' : '#fff';
        b.style.borderColor = on ? '#167A5A' : '#E8D3B8';
        b.style.color = on ? '#fff' : '#7A6B5D';
      });
    }
    AGES.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'wmAge-' + a[0]; b.textContent = a[1];
      b.style.cssText = 'flex:1 1 30%;min-height:38px;border-radius:999px;border:1.5px solid #E8D3B8;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:#fff;white-space:nowrap';
      b.addEventListener('click', function () {
        kidsAge = a[0];
        paintAge();
        try { localStorage.setItem('wm_rescue_for_age', kidsAge); } catch (e) {}
        var input = String(($('scanIngredients') || {}).value || '').trim();
        if (input && typeof window.scanFindMeals === 'function') window.scanFindMeals();
      });
      ageBar.appendChild(b);
    });
    try { var savedAge = localStorage.getItem('wm_rescue_for_age') || ''; if (AGES.some(function (a) { return a[0] === savedAge; })) kidsAge = savedAge; } catch (e) {}
    forBar.insertAdjacentElement('afterend', ageBar);
    paintAge();
    setMode('fridge');

    // "Find Meals From This": in Food Rescue, dishes that use the rescue items come first.
    var originalFind = window.scanFindMeals;
    var originalMatches = window.getChefMatches;
    if (typeof originalFind !== 'function' || typeof originalMatches !== 'function') return;
    window.scanFindMeals = function () {
      if (mode !== 'rescue') return originalFind.apply(this, arguments);
      var self = this, args = arguments;
      if (!String(($('scanIngredients') || {}).value || '').trim()) return originalFind.apply(this, arguments);
      if (kidsOnly && !kidsAge) {
        setStatus("🧒 Choose your child's age", 'Pick an age above to see kids dishes that are right for that age.', true);
        var ages = $('wmRescueAge');
        if (ages && ages.scrollIntoView) ages.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!rescueRunning) {
        rescueRunning = true;
        setStatus('🥬 Finding dishes to rescue your food…', 'One moment.');
        setTimeout(function () {
          try { rescueFind.apply(self, args); } finally { rescueRunning = false; }
        }, 60);
      }
    };
    var rescueRunning = false;
    function rescueFind() {
      var input = ($('scanIngredients') || {}).value || '';
      var rescueText = rescueItems.length ? rescueItems.join(', ') : input;
      var rescueTokens = typeof tokenizeIngredients === 'function' ? tokenizeIngredients(rescueText) : [];
      var sorted = [];
      window.getChefMatches = function (text) {
        // Fast path: only score dishes that mention a rescue item (scoring all 1000+ dishes is slow
        // on phones), then put dishes that use the most rescue items first.
        var tokens = typeof tokenizeIngredients === 'function' ? tokenizeIngredients(text) : [];
        var keys = [];
        rescueTokens.forEach(function (tok) {
          String(tok).toLowerCase().split(/\s+/).forEach(function (w) { if (w.length > 2 && keys.indexOf(w) === -1) keys.push(w); });
        });
        var kids = (typeof KIDS_MEALS !== 'undefined' && Array.isArray(KIDS_MEALS)) ? KIDS_MEALS : (window.WORLD_KIDS_MEALS || []);
        if (kidsOnly) kids = kids.filter(function (m) { return (m.tags || []).indexOf('kids-' + kidsAge) !== -1; });
        var meals = kidsOnly ? kids : ((typeof MEALS !== 'undefined' && Array.isArray(MEALS)) ? MEALS : []);
        var pool = {}, order = [];
        var quick = [];
        meals.forEach(function (meal) {
          var words = (meal.ingredients || []).join(' ').toLowerCase();
          var n = 0;
          keys.forEach(function (k) { if (words.indexOf(k) !== -1) n++; });
          if (n) quick.push({ meal: meal, n: n, size: (meal.ingredients || []).length, words: words });
        });
        // Keep the most promising dishes (most rescue items, fewest other ingredients),
        // plus the best few for EACH rescue item so none is left out.
        quick.sort(function (a, b) { return b.n - a.n || a.size - b.size; });
        var keep = quick.slice(0, 100);
        keys.forEach(function (k) {
          quick.filter(function (q) { return q.words.indexOf(k) !== -1; }).slice(0, 15).forEach(function (q) {
            if (keep.indexOf(q) === -1) keep.push(q);
          });
        });
        keep.forEach(function (q) {
          var meal = q.meal;
          var full = mealMatchScore(meal, tokens);
          if (!full.matched || !full.matched.length || full.confidence < 8) return;
          pool[meal.id] = Object.assign({ meal: meal }, full);
          order.push(meal.id);
        });
        var list = order.map(function (id, i) {
          var x = pool[id];
          var hits = (x.matched || []).filter(function (t) { return rescueTokens.indexOf(t) !== -1; });
          return { x: x, i: i, hits: hits };
        }).filter(function (r) { return r.hits.length; });
        list.sort(function (a, b) { return b.hits.length - a.hits.length || b.x.score - a.x.score || a.i - b.i; });
        // Variety: the many look-alike "<Country> Chicken ... Bowl" dishes, smoothies and salads would
        // otherwise fill every spot, so keep at most 2 bowls, 1 smoothie and 2 salads.
        var LIMIT = { bowl: 2, smoothie: 1, salad: 2 }, kinds = {};
        function kindOf(meal) {
          var n = String(meal.name || '');
          if (/smoothie/i.test(n)) return 'smoothie';
          if (/salad/i.test(n)) return 'salad';
          if (/bowl\s*$/i.test(n) && (/weight[- ]loss|protein/i.test(n) || /^\S+(an|ese|ish|i|ic|ch)\s/i.test(n))) return 'bowl';
          return '';
        }
        function fits(r) { var k = kindOf(r.x.meal); return !k || (kinds[k] || 0) < LIMIT[k]; }
        function take(r) { var k = kindOf(r.x.meal); if (k) kinds[k] = (kinds[k] || 0) + 1; used[r.x.meal.id] = 1; picked.push(r); }
        var picked = [], used = {};
        rescueTokens.forEach(function (t) {            // at least one dish for every rescue item
          var r = list.find(function (r) { return r.hits.indexOf(t) !== -1 && !used[r.x.meal.id] && fits(r); });
          if (r) take(r);
        });
        list.forEach(function (r) { if (picked.length < 9 && !used[r.x.meal.id] && fits(r)) take(r); });
        if (!picked.length) list.slice(0, 9).forEach(take);
        picked.sort(function (a, b) { return b.hits.length - a.hits.length || b.x.score - a.x.score; });
        sorted = picked;
        return picked.map(function (r) { return r.x; });
      };
      try { originalFind.apply(this, arguments); }
      finally { window.getChefMatches = originalMatches; }
      var box = $('scanResult');
      var cards = box ? box.querySelectorAll('.chef-match-card') : [];
      if (!cards.length) {
        if (kidsOnly && box) {
          var label = ($('wmAge-' + kidsAge) || {}).textContent || 'this age';
          setStatus('No ' + label.replace(/^\S+\s/, '') + ' dishes use these items yet', 'Try another age, switch to Grown-up dishes, or add pantry basics you have (rice, eggs, oil…).');
        }
        return;
      }
      cards.forEach(function (card, i) {
        var r = sorted[i];
        if (!r || !r.hits.length) return;
        var tag = document.createElement('div');
        tag.className = 'chef-missing';
        tag.style.cssText = 'color:#1F6B42;background:#E8F7EF;margin-top:6px';
        tag.textContent = '🥬 Rescues: ' + r.hits.slice(0, 3).join(', ');
        (card.querySelector('.chef-match-body') || card).appendChild(tag);
      });
      var banner = document.createElement('div');
      banner.className = 'scan-summary';
      banner.innerHTML = '<div class="scan-summary-title">🥬 Food Rescue' + (kidsOnly ? ' · ' + (($('wmAge-' + kidsAge) || {}).textContent || '🧒 Kids') : '') + '</div><div class="scan-summary-sub">' + (kidsOnly ? 'Kids dishes' : 'Dishes') + ' that use your rescue items come first: <b>' + esc(rescueTokens.slice(0, 6).join(', ')) + '</b></div>';
      box.insertBefore(banner, box.firstChild);
    };
  }

  // Short, generic names match dishes better: "Pasta Sauce (Great Value, with Meat)" -> "tomato sauce",
  // "Organic Reduced Fat Milk (Simply Nature)" -> "milk". Drinks are listed but not used to pick dishes.
  var DRINK = /\b(juice|soda|water|sparkling|seltzer|cola|lemonade|kombucha|wine|beer|coffee|tea|energy drink|smoothie)\b/i;
  var FILLER = /\b(organic|reduced[- ]fat|low[- ]fat|fat[- ]free|non[- ]fat|skim|whole|2%|1%|fresh|natural|store[- ]brand|great value|simply nature|kirkland|family size|large|small|medium|opened|leftover|cooked|dark)\b/gi;
  function cleanName(raw) {
    var n = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (/\b(pasta|spaghetti)\s+sauce\b/.test(n)) n = 'tomato sauce';
    return n;
  }
  // Only states that mean "use soon" matter for Food Rescue ("in clear container" does not).
  var AGING = /\b(opened|open|cut|sliced|halved|half[- ]used|partly used|wilting|wilted|limp|soft|overripe|very ripe|ripe|bruised|brown(?:ing|ed)?|spotted|wrinkled|sprouting|cooked|leftovers?|thawed|defrosted|expiring|near expiry|past date|mushy|stale|moldy|mould(?:y)?|mold|slimy|spoiled|rotten)\b/gi;
  var UNSAFE = /mold|mould|slimy|spoiled|rotten/i;
  function cleanState(raw) {
    var words = String(raw || '').toLowerCase().match(AGING) || [];
    var out = [];
    words.forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); });
    return out.join(', ');
  }
  function rescueList(ingredients) {
    var food = [], drinks = [], seen = {};
    (Array.isArray(ingredients) ? ingredients : []).forEach(function (x) {
      var raw = String(x.displayName || x.name || '').trim();
      var name = cleanName(raw);
      if (!name || seen[name]) return;
      seen[name] = 1;
      var state = cleanState(x.state);
      var item = { name: name, state: state, urgent: !!state, unsafe: UNSAFE.test(state) };
      (DRINK.test(raw) ? drinks : food).push(item);
    });
    food.sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0); });   // "use soon" first
    var urgent = food.filter(function (x) { return x.urgent && !x.unsafe; });
    return { food: food, drinks: drinks, urgent: urgent };
  }

  function chip(x, strong) {
    var label = esc(x.name.charAt(0).toUpperCase() + x.name.slice(1)) + (x.state ? ' · ' + esc(x.state) : '');
    if (x.unsafe) return '<span class="scan-pill" style="display:inline-block;margin:0 6px 6px 0;background:#FDECEA;border-color:#F3C2BC;color:#A33A2A">🚫 ' + label + ' · check before eating</span>';
    if (strong) return '<span class="scan-pill" style="display:inline-block;margin:0 6px 6px 0;background:#FFF1E0;border-color:#F2C58F;color:#8A4B13">⚠️ ' + label + '</span>';
    return '<span class="scan-pill" style="display:inline-block;margin:0 6px 6px 0;background:#E8F7EF;border-color:#BFE3CF;color:#1F6B42">' + label + '</span>';
  }

  function showRescue(found) {
    var box = $('scanResult');
    if (!box) return;
    var urgentAll = found.food.filter(function (x) { return x.urgent; });
    var others = found.food.filter(function (x) { return !x.urgent; });
    var html = '';
    if (urgentAll.length) {
      html += '<div class="scan-summary-title">🥬 Rescue these first (' + found.urgent.length + ')</div>' +
        '<div class="scan-summary-sub" style="margin-bottom:10px">These look like they should be used soon. Tap <b>Find Meals From This</b>: dishes that use them come first.</div>' +
        '<div>' + urgentAll.map(function (x) { return chip(x, true); }).join('') + '</div>';
      if (others.length) html += '<div class="scan-summary-sub" style="margin:8px 0 6px"><b>Also spotted (' + others.length + ')</b></div><div>' + others.map(function (x) { return chip(x, false); }).join('') + '</div>';
    } else if (found.food.length) {
      html += '<div class="scan-summary-title">🥬 Food Rescue: ' + found.food.length + ' items found</div>' +
        '<div class="scan-summary-sub" style="margin-bottom:10px">Nothing looks old yet. 👍 Tip: snap only the food that needs to be used soon (opened, soft, leftovers) for better rescue ideas. You can still tap <b>Find Meals From This</b>.</div>' +
        '<div>' + others.map(function (x) { return chip(x, false); }).join('') + '</div>';
    } else {
      html += '<div class="scan-summary-title">No food to rescue spotted yet</div>' +
        '<div class="scan-summary-sub">Try a closer photo of the food that needs to be used soon, or type it below.</div>';
    }
    if (found.drinks.length) html += '<div class="scan-summary-sub" style="margin-top:4px">🥤 Drinks to enjoy soon: ' + esc(found.drinks.map(function (d) { return d.name; }).join(', ')) + '</div>';
    box.innerHTML = '<div class="scan-summary wm-tone-ok" data-wm-scan="1">' + html + '</div>';   // food found: green
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
