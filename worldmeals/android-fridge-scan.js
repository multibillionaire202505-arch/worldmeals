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
  var rescueItems = [];            // names found by the last Food Rescue scan

  function $(id) { return document.getElementById(id); }
  function setStatus(title, sub) {
    var box = $('scanResult');
    if (!box) return;
    box.innerHTML = '<div class="scan-summary" data-wm-scan="1"><div class="scan-summary-title"></div><div class="scan-summary-sub"></div></div>';
    box.querySelector('.scan-summary-title').textContent = title;
    box.querySelector('.scan-summary-sub').textContent = sub || '';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });   // keep the message on screen
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
      if (busy && !box.querySelector('[data-wm-scan]')) setStatus(SCANNING_TITLE, SCANNING_SUB);
    }).observe(box, { childList: true });
  }

  async function analyze(file) {
    if (!file || busy) return;
    if (!/^image\//.test(file.type || 'image/')) return;
    busy = true;
    var button = $('nativeFridgeScanButton');
    if (button) button.setAttribute('aria-busy', 'true');
    try {
      setStatus('Scanning your fridge… 🔍', 'WorldMeals is looking for ingredients in your photo. This takes a few seconds.');
      var image = await shrink(file);
      setStatus('Scanning your fridge… 🔍', 'WorldMeals is looking for ingredients in your photo. This takes a few seconds.');
      var out = await send(image, false);
      // Pass refused: refresh it with Google Play once and try again.
      if (out.res.status === 403 && out.data.code === 'passport_required') out = await send(image, true);
      var res = out.res, data = out.data;
      if (!res.ok) {
        if (data.code === 'passport_required') setStatus('Passport needed for Fridge Scan', data.error + (data.reason ? ' (code: ' + data.reason + (diag ? ' · ' + diag : '') + ')' : ''));
        else setStatus('Scan needs another try', (data.error || 'WorldMeals could not analyze that photo.') + ' You can also type your ingredients below.');
        return;
      }
      var names = (Array.isArray(data.ingredients) ? data.ingredients : [])
        .map(function (x) { return String(x.displayName || x.name || '').trim(); })
        .filter(Boolean);
      if (!names.length) {
        setStatus('No ingredients spotted yet', 'Try a brighter photo with the fridge door fully open, or type your ingredients below.');
        return;
      }
      var box = $('scanIngredients');
      if (box) box.value = names.join(', ');
      if (mode === 'rescue') {
        rescueItems = names.slice();
        showRescue(data.ingredients);
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setStatus('Fridge scan complete ✅ ' + names.length + ' ingredients found', 'Check the list (add or remove anything), then tap Find Meals From This.');
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      setStatus('Scan needs another try', 'Check your internet connection and try again, or type your ingredients below.');
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
    setStatus("Your photo didn't come through 📷", 'Your phone closed WorldMeals while the camera was open. Tap "Choose a photo from your gallery" to pick the photo you just took.');
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
        if (box && m[0] === 'rescue') setStatus('🥬 Food Rescue', 'Snap the food that needs to be used soon (or type it below). WorldMeals shows dishes that use it first, so nothing goes to waste.');
        else if (box) box.innerHTML = '';
      });
      bar.appendChild(b);
    });
    scanButton.insertAdjacentElement('beforebegin', bar);
    setMode('fridge');

    // "Find Meals From This": in Food Rescue, dishes that use the rescue items come first.
    var originalFind = window.scanFindMeals;
    var originalMatches = window.getChefMatches;
    if (typeof originalFind !== 'function' || typeof originalMatches !== 'function') return;
    window.scanFindMeals = function () {
      if (mode !== 'rescue') return originalFind.apply(this, arguments);
      var input = ($('scanIngredients') || {}).value || '';
      var rescueText = rescueItems.length ? rescueItems.join(', ') : input;
      var rescueTokens = typeof tokenizeIngredients === 'function' ? tokenizeIngredients(rescueText) : [];
      var sorted = [];
      window.getChefMatches = function (text) {
        var list = originalMatches(text).map(function (x, i) {
          var hits = (x.matched || []).filter(function (t) { return rescueTokens.indexOf(t) !== -1; });
          return { x: x, i: i, hits: hits };
        });
        var useful = list.filter(function (r) { return r.hits.length; });
        if (useful.length) list = useful;
        list.sort(function (a, b) { return b.hits.length - a.hits.length || a.i - b.i; });
        sorted = list;
        return list.map(function (r) { return r.x; });
      };
      try { originalFind.apply(this, arguments); }
      finally { window.getChefMatches = originalMatches; }
      var box = $('scanResult');
      var cards = box ? box.querySelectorAll('.chef-match-card') : [];
      if (!cards.length) return;
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
      banner.innerHTML = '<div class="scan-summary-title">🥬 Food Rescue</div><div class="scan-summary-sub">Dishes that use your rescue items come first: <b>' + esc(rescueTokens.slice(0, 6).join(', ')) + '</b></div>';
      box.insertBefore(banner, box.firstChild);
    };
  }

  function showRescue(ingredients) {
    var box = $('scanResult');
    if (!box) return;
    var chips = (Array.isArray(ingredients) ? ingredients : []).map(function (x) {
      var name = String(x.displayName || x.name || '').trim();
      if (!name) return '';
      var state = String(x.state || '').trim();
      return '<span class="scan-pill" style="display:inline-block;margin:0 6px 6px 0;background:#E8F7EF;border-color:#BFE3CF;color:#1F6B42">' +
        esc(name) + (state ? ' · ' + esc(state) : '') + '</span>';
    }).join('');
    box.innerHTML = '<div class="scan-summary" data-wm-scan="1">' +
      '<div class="scan-summary-title">🥬 Rescue these first (' + rescueItems.length + ')</div>' +
      '<div class="scan-summary-sub" style="margin-bottom:10px">Tap <b>Find Meals From This</b> to see dishes that use them. Add pantry basics you have (rice, eggs, oil…) for more ideas.</div>' +
      '<div>' + chips + '</div></div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
