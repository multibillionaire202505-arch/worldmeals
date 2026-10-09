/* WorldMeals — Fridge Scan for the ANDROID app (and the website).
 * Does NOTHING on iPhone: if the native iPhone scanner bridge exists, this file stops on line 1.
 *
 * What it does on Android:
 *  1. After a fridge photo is taken (or picked from the gallery), it shrinks the photo on the phone,
 *     sends it to /api/android-scan (Passport only, daily limits on the server), and fills the
 *     "Detected / confirmed ingredients" box with what the AI sees. The user can still edit it.
 *  2. Adds a "Choose a photo from your gallery" button (more reliable on low-memory phones).
 *  3. If Android closes WorldMeals while the camera is open, the app reopens on Scan (not Browse).
 * To turn all of this off: remove the one <script src="/android-fridge-scan.js"> line in app.html.
 */
(function () {
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.worldMealsNative) return;

  var PENDING_KEY = 'wm_scan_pending';
  var PENDING_MAX_AGE = 10 * 60 * 1000;
  var MAX_SIDE = 1280;          // photo is resized to at most 1280px before upload
  var JPEG_QUALITY = 0.8;
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function setStatus(title, sub) {
    var box = $('scanResult');
    if (!box) return;
    box.innerHTML = '<div class="scan-summary"><div class="scan-summary-title"></div><div class="scan-summary-sub"></div></div>';
    box.querySelector('.scan-summary-title').textContent = title;
    box.querySelector('.scan-summary-sub').textContent = sub || '';
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
      var headers = { 'Content-Type': 'application/json', 'X-WM-Id': appId() };
      try { var pass = localStorage.getItem('worldmeals.subscription.entitlement'); if (pass) headers['X-WM-Entitlement'] = pass; } catch (e) {}
      var res = await fetch('/api/android-scan', { method: 'POST', headers: headers, body: JSON.stringify({ image: image }) });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        if (data.code === 'passport_required') setStatus('Passport needed for Fridge Scan', data.error);
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

    // Camera: the existing onchange shows the preview; this adds the AI scan.
    camera.addEventListener('click', function () { pending('set'); });
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
    if (!started || Date.now() - started > PENDING_MAX_AGE) return;
    if (typeof showPage === 'function') showPage('scan');
    setStatus("Your photo didn't come through 📷", 'Your phone closed WorldMeals while the camera was open. Tap "Choose a photo from your gallery" to pick the photo you just took.');
    if (typeof toast === 'function') toast("📷 Photo didn't come through. Choose it from your gallery.");
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
