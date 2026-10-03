/* WorldMeals — Google Play Billing for the Android app (Trusted Web Activity).
 *
 * Runs ONLY inside the Android app, where Chrome provides Google Play's Digital Goods API.
 * On iPhone/iPad (Apple StoreKit bridge present) and on the regular website it does nothing,
 * so the Apple subscription flow is never touched.
 *
 * It plugs into hooks the pages already have:
 *  - index.html calls window.WorldMealsIAP.purchase(productId) when there is no Apple bridge.
 *  - index.html and app.html already react to "worldmeals:iap" events (loading / success /
 *    cancelled / error / entitlements), so a Google Play purchase unlocks the plan exactly the
 *    way a StoreKit purchase does.
 *
 * Every purchase is verified and acknowledged by /api/play-verify (Google refunds purchases that
 * are not acknowledged within 3 days).
 */
(function () {
  'use strict';

  var PLAY_BILLING = 'https://play.google.com/billing';
  var PLANS = {
    'app.worldmeals.chef.monthly': 'chef',
    'app.worldmeals.chef.annual': 'chef',
    'app.worldmeals.passport.monthly': 'passport',
    'app.worldmeals.passport.annual': 'passport'
  };
  var RANK = { explorer: 0, chef: 1, passport: 2 };

  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.worldmeals.android';

  // Never run in the iPhone/iPad app (Apple StoreKit bridge).
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.worldMealsIAP) return;

  // Android phone/tablet WITHOUT Google Play Billing (e.g. the website opened in Chrome, or installed
  // from the website instead of the Play Store). Instead of the Apple-only message, point the person
  // to the WorldMeals app on Google Play. Desktop and iPhone browsers are not affected.
  function androidWebFallback() {
    if (!/Android/i.test(navigator.userAgent || '')) return;
    window.WorldMealsIAP = {
      provider: 'android-web',
      purchase: function () {
        // index.html marks the buttons busy before calling us; an "error" event releases them.
        window.dispatchEvent(new CustomEvent('worldmeals:iap', { detail: { status: 'error', message: ' ' } }));
        var el = document.getElementById('iapStatus');
        if (!el) { window.location.href = PLAY_STORE_URL; return; }
        el.dataset.state = 'error';
        el.textContent = 'On Android, subscriptions are available in the WorldMeals app from Google Play. ';
        var a = document.createElement('a');
        a.href = PLAY_STORE_URL;
        a.textContent = 'Get it on Google Play →';
        a.style.fontWeight = '800';
        a.style.textDecoration = 'underline';
        el.appendChild(a);
      }
    };
    // app.html's "Manage subscription" otherwise shows an App Store message.
    if (typeof window.wmManageSubscription === 'function') {
      window.wmManageSubscription = function () {
        window.location.href = 'https://play.google.com/store/account/subscriptions?package=app.worldmeals.android';
      };
    }
  }

  if (!('getDigitalGoodsService' in window) || !window.PaymentRequest) { androidWebFallback(); return; }

  var ENTITLEMENT_KEY = 'worldmeals.subscription.entitlement';
  function keepEntitlement(token) {
    try { if (token) localStorage.setItem(ENTITLEMENT_KEY, token); else localStorage.removeItem(ENTITLEMENT_KEY); } catch (e) {}
  }

  function emit(detail) {
    window.dispatchEvent(new CustomEvent('worldmeals:iap', { detail: detail }));
    // index.html's status line was written for Apple; reword it for Google Play.
    var el = document.getElementById('iapStatus');
    if (!el) return;
    if (detail.status === 'loading') el.textContent = 'Opening Google Play…';
    if (detail.status === 'entitlements' && detail.plan && detail.plan !== 'explorer') {
      el.textContent = 'Active Google Play plan: ' + (detail.plan === 'passport' ? 'Passport' : 'Chef') + '.';
    }
  }

  async function verify(productId, purchaseToken) {
    var res = await fetch('/api/play-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, purchaseToken: purchaseToken })
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || 'Could not confirm the purchase with Google Play.');
    return data; // { active, pending, plan, productId, expiryTime, isTrial, entitlement }
  }

  var servicePromise = window.getDigitalGoodsService(PLAY_BILLING).catch(function () { return null; });

  servicePromise.then(function (service) {
    if (!service) { androidWebFallback(); return; } // not the Play Store app: show the Google Play link on Android

    var busy = false;

    // Called by index.html's plan buttons (only when there is no Apple bridge).
    async function purchase(productId) {
      if (busy) return;
      if (!PLANS[productId]) { emit({ status: 'error', message: 'Unknown plan.' }); return; }
      busy = true;
      emit({ status: 'loading', productId: productId });
      var response = null;
      try {
        var request = new PaymentRequest(
          [{ supportedMethods: PLAY_BILLING, data: { sku: productId } }],
          { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }
        );
        response = await request.show();
        var token = response.details && response.details.purchaseToken;
        if (!token) throw new Error('Google Play did not return a purchase.');
        var result = await verify(productId, token);
        if (result.pending) {
          await response.complete('unknown');
          response = null;
          emit({ status: 'pending', message: 'Your payment is pending. Your plan unlocks as soon as Google Play confirms it.' });
          return;
        }
        if (!result.active) throw new Error('Google Play could not confirm an active subscription.');
        await response.complete('success');
        keepEntitlement(result.entitlement);
        emit({
          status: 'success',
          plan: result.plan,
          productId: result.productId,
          activeProductIds: [result.productId],
          isIntroductoryOffer: !!result.isTrial,
          trialEndDate: result.isTrial ? result.expiryTime : undefined
        });
      } catch (err) {
        if (response) { try { await response.complete('fail'); } catch (e) {} }
        if (err && err.name === 'AbortError') emit({ status: 'cancelled' });
        else emit({ status: 'error', message: (err && err.message) || 'The purchase could not be completed.' });
      } finally {
        busy = false;
      }
    }

    // Ask Google Play which subscriptions this user owns, confirm them with the server,
    // and unlock (or lock) the plan through the pages' existing "entitlements" handling.
    async function refreshEntitlements() {
      var purchases;
      try { purchases = await service.listPurchases(); } catch (e) { return; } // keep current plan if Play is unreachable
      var best = { plan: 'explorer', productId: null, isTrial: false, expiryTime: null, entitlement: null }, active = [];
      for (var i = 0; i < purchases.length; i++) {
        var p = purchases[i];
        if (!PLANS[p.itemId]) continue;
        try {
          var r = await verify(p.itemId, p.purchaseToken);
          if (r.active) {
            active.push(r.productId);
            if (RANK[r.plan] > RANK[best.plan]) best = r;
          }
        } catch (e) { return; } // server unreachable: don't change the plan
      }
      keepEntitlement(best.entitlement);
      emit({
        status: 'entitlements',
        plan: best.plan,
        productId: best.productId,
        activeProductIds: active,
        isIntroductoryOffer: !!best.isTrial,
        trialEndDate: best.isTrial ? best.expiryTime : undefined
      });
    }

    window.WorldMealsIAP = { purchase: purchase, restore: refreshEntitlements, provider: 'google-play' };

    // app.html's "Manage subscription" falls back to an App Store message when there is no Apple
    // bridge. On Android, open Google Play's subscription page for WorldMeals instead.
    if (typeof window.wmManageSubscription === 'function') {
      window.wmManageSubscription = function () {
        var pid = '';
        try { pid = localStorage.getItem('worldmeals.subscription.productId') || ''; } catch (e) {}
        var url = 'https://play.google.com/store/account/subscriptions?package=app.worldmeals.android' +
          (PLANS[pid] ? '&sku=' + encodeURIComponent(pid) : '');
        window.location.href = url;
      };
    }

    // On index.html, Restore Purchases is hidden unless Apple is present; show it for Google Play too.
    var restoreBtn = document.getElementById('restorePurchases');
    if (restoreBtn) {
      restoreBtn.classList.add('is-visible');
      restoreBtn.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        var el = document.getElementById('iapStatus');
        if (el) { el.textContent = 'Restoring Google Play purchases…'; delete el.dataset.state; }
        refreshEntitlements().then(function () {
          var plan = localStorage.getItem('worldmeals.subscription.plan') || 'explorer';
          if (el) el.textContent = plan === 'explorer' ? 'No active Google Play subscription found.' : 'Google Play purchases restored.';
        });
      }, true);
    }

    refreshEntitlements();
  });
})();
