document.documentElement.classList.add('js');
(function () {
  var body = document.body;

  // A/B-test: varje besökare får en stabil variant via localStorage.
  var ab = body.getAttribute('data-ab');
  if (ab && ab !== 'off') {
    var variant = null;
    try { variant = window.localStorage.getItem('temply-ab'); } catch (error) {}
    if (!variant) {
      variant = Math.random() < 0.5 ? 'a' : 'b';
      try { window.localStorage.setItem('temply-ab', variant); } catch (error) {}
    }
    body.setAttribute('data-ab-variant', variant);
    if (variant === 'b') {
      var headline = body.getAttribute('data-ab-headline');
      var cta = body.getAttribute('data-ab-cta');
      if (ab === 'hero' && headline) {
        var title = document.querySelector('[data-hero-title]');
        if (title) title.textContent = headline;
      }
      if ((ab === 'cta' || ab === 'hero') && cta) {
        var button = document.querySelector('[data-hero-cta]');
        if (button) button.textContent = cta;
      }
      if (ab === 'layout') body.classList.add('ab-layout-b');
      if (ab === 'colors') body.classList.add('ab-colors-b');
    }
  }

  // Nedräkning: tickar lokalt mot kampanjens sluttid.
  document.querySelectorAll('[data-countdown]').forEach(function (timer) {
    var end = new Date(timer.getAttribute('data-countdown')).getTime();
    if (!end) return;
    var units = {
      days: timer.querySelector('[data-unit="days"]'),
      hours: timer.querySelector('[data-unit="hours"]'),
      minutes: timer.querySelector('[data-unit="minutes"]'),
      seconds: timer.querySelector('[data-unit="seconds"]')
    };
    var pad = function (value) { return String(value).padStart(2, '0'); };
    var tick = function () {
      var left = Math.max(0, end - Date.now());
      if (units.days) units.days.textContent = pad(Math.floor(left / 86400000));
      if (units.hours) units.hours.textContent = pad(Math.floor((left % 86400000) / 3600000));
      if (units.minutes) units.minutes.textContent = pad(Math.floor((left % 3600000) / 60000));
      if (units.seconds) units.seconds.textContent = pad(Math.floor((left % 60000) / 1000));
      if (left <= 0 && timer._interval) { clearInterval(timer._interval); timer._interval = null; }
    };
    tick();
    timer._interval = setInterval(tick, 1000);
  });

  // Fri frakt-bar uppdateras mot kundkorgen.
  document.querySelectorAll('[data-shipbar]').forEach(function (bar) {
    var threshold = parseInt(bar.getAttribute('data-threshold'), 10);
    if (!threshold) return;
    fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (cart) {
        var progress = Math.min(100, Math.round((cart.total_price / threshold) * 100));
        var fill = bar.querySelector('[data-shipbar-progress]');
        if (fill) fill.style.width = progress + '%';
        var label = bar.querySelector('[data-shipbar-text]');
        if (label) {
          var rest = threshold - cart.total_price;
          label.textContent = rest <= 0 ? label.getAttribute('data-done') || label.textContent.replace(/om.*/, 'uppnådd') : label.textContent;
        }
      })
      .catch(function () {});
  });

  // Sticky add-to-cart visas när köpknappen scrollat ur bild.
  var sticky = document.querySelector('[data-sticky-atc]');
  if (sticky) {
    var trigger = document.querySelector('.product__form button[type="submit"]');
    var onScroll = function () {
      if (!trigger) { sticky.hidden = false; return; }
      var rect = trigger.getBoundingClientRect();
      sticky.hidden = rect.bottom > 0 && rect.top < window.innerHeight;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Exit intent-popup med GDPR-samtycke.
  var popup = document.querySelector('[data-exit-popup]');
  if (popup) {
    var seen = false;
    try { seen = window.localStorage.getItem('temply-exit-intent') === '1'; } catch (error) {}
    var open = function () {
      if (seen) return;
      popup.hidden = false;
      seen = true;
      try { window.localStorage.setItem('temply-exit-intent', '1'); } catch (error) {}
    };
    document.addEventListener('mouseout', function (event) {
      if (event.clientY <= 0 && !event.relatedTarget) open();
    });
    var close = popup.querySelector('[data-popup-close]');
    if (close) close.addEventListener('click', function () { popup.hidden = true; });
  }

  // Nyligen visade produkter sparas lokalt och renderas utan extra anrop.
  var recentBox = document.querySelector('[data-recently-viewed]');
  var productData = document.querySelector('[data-product-id]');
  var storageKey = 'temply-recently-viewed';
  var readRecent = function () {
    try { return JSON.parse(window.localStorage.getItem(storageKey) || '[]'); } catch (error) { return []; }
  };
  if (productData) {
    var item = {
      title: productData.getAttribute('data-product-title'),
      url: productData.getAttribute('data-product-url'),
      price: productData.getAttribute('data-product-price'),
      handle: productData.getAttribute('data-product-handle')
    };
    var list = readRecent().filter(function (entry) { return entry.handle !== item.handle; });
    list.unshift(item);
    try { window.localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 8))); } catch (error) {}
  }
  if (recentBox) {
    var currentHandle = productData ? productData.getAttribute('data-product-handle') : null;
    var entries = readRecent().filter(function (entry) { return entry.handle !== currentHandle; }).slice(0, 4);
    var target = recentBox.querySelector('[data-recently-viewed-list]');
    if (entries.length && target) {
      target.innerHTML = entries.map(function (entry) {
        return '<a class="card" href="' + entry.url + '"><div class="card__info"><h3 class="card__title">' + entry.title + '</h3><p class="card__price">' + entry.price + '</p></div></a>';
      }).join('');
      recentBox.hidden = false;
    }
  }
})();
(function () {
  var items = document.querySelectorAll('.reveal');
  var animate = document.body.getAttribute('data-animate') !== 'false';
  if (!animate || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  items.forEach(function (el) { observer.observe(el); });
})();
