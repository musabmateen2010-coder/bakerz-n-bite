/* ==========================================================
   Bakerz Bite - "Bite Buddy" chat assistant
   - Reads products, merch, offers and FAQ straight from the page,
     so answers always match what the website shows.
   - Understands English and Roman Urdu (replies in the same language).
   - Can add items to the site's cart (window.bbAddToCart).
   - No server / API key needed: it runs fully in the browser.
   ========================================================== */
(function () {
  'use strict';
  if (window.__bbChatLoaded) return;
  window.__bbChatLoaded = true;

  var EMAIL = 'info@bakerzbite.com';
  var DELIVERY_FEE = 200;
  var state = { lang: 'en', open: false, busy: false };
  var ui = {};

  /* ---------------- small helpers ---------------- */
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function L(en, ur) { return state.lang === 'ur' ? ur : en; }
  function lc(v) { return v ? v.charAt(0).toLowerCase() + v.slice(1) : v; }
  function money(n) { return 'Rs. ' + n; }
  function mobile() { return window.innerWidth < 576; }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function stem(w) {
    if (/ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    if (/ie$/.test(w)) w = w.slice(0, -2) + 'y';
    return w;
  }
  function has(t, kw) { return (' ' + t + ' ').indexOf(' ' + kw + ' ') > -1; }

  var STOP = {};
  ('the a an and or of for to in on at is are was do does did you your yours i me my we our it this that with from by be can could would will please plz pls tell show give want need get have has any some what which how when where why who there here about into than then so very just also like if as but not no yes ok okay kya hai hain ka ki ke ko se ho mujhe chahiye aap apka apki apke mein mn ye wo bhi aur ya toh to')
    .split(' ').forEach(function (w) { STOP[w] = 1; });
  var GENERIC = { cake: 1, cooky: 1, pastry: 1, dessert: 1, sweet: 1, classic: 1, dream: 1, bakerz: 1, bite: 1, item: 1, price: 1, rate: 1, cost: 1 };
  var SYN = {
    choco: 'chocolate', chocolat: 'chocolate', chocolates: 'chocolate', macaroon: 'macaron', macaroons: 'macarons',
    macroon: 'macaron', eclairs: 'eclair', cinamon: 'cinnamon', strawbery: 'strawberry', stawberry: 'strawberry',
    kek: 'cake', keik: 'cake', biscuit: 'cookie', biscuits: 'cookie', crossant: 'croissant', croissants: 'croissant',
    velvet: 'velvet', brownies: 'brownie', cup: 'mug'
  };

  /* ---------------- site data (read live from the page) ---------------- */
  function getProducts() {
    return qa('.product-item').map(function (n) {
      var img = n.querySelector('.product-img');
      return {
        kind: 'product', node: n,
        name: n.getAttribute('data-name'), cat: n.getAttribute('data-category'),
        price: parseInt(n.getAttribute('data-price'), 10), rating: parseFloat(n.getAttribute('data-rating')),
        img: img ? img.getAttribute('src') : ''
      };
    }).filter(function (p) { return p.name && !isNaN(p.price); });
  }
  function getMerch() {
    return qa('.card-merch').map(function (n) {
      return {
        kind: 'merch', node: n, cat: 'Merchandise',
        name: n.getAttribute('data-name'), price: parseInt(n.getAttribute('data-price'), 10),
        rating: parseFloat(n.getAttribute('data-rating')), img: n.getAttribute('data-image') || '',
        desc: n.getAttribute('data-desc') || ''
      };
    }).filter(function (p) { return p.name && !isNaN(p.price); });
  }
  function getOffers() {
    return qa('.offer-card').map(function (n) {
      var t = function (s) { var e = n.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      return { badge: t('.badge'), title: t('h3'), desc: t('.desc'), valid: t('.valid') };
    }).filter(function (o) { return o.title; });
  }
  function getFaqs() {
    return qa('.faq-item').map(function (n) {
      var a = n.querySelector('.faq-question span'), b = n.querySelector('.faq-answer');
      return { q: a ? a.textContent.trim() : '', a: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' };
    }).filter(function (f) { return f.q && f.a; });
  }
  function faqAnswer(re) {
    var f = getFaqs().filter(function (x) { return re.test(x.q); })[0];
    return f ? f.a : '';
  }
  function describe(it) {
    if (it.kind === 'merch') return it.desc;
    var d = {
      Cakes: 'A soft, freshly baked cake made with rich cream and premium ingredients.',
      Pastries: 'A freshly baked pastry with a light texture and buttery flavour.',
      Cookies: 'Crispy, freshly baked cookies for a sweet little treat.',
      Desserts: 'A delicious dessert freshly prepared with love.'
    };
    return d[it.cat] || '';
  }

  /* ---------------- language detection ---------------- */
  var UR = ('kya hai hain kitna kitne kitni kitnay mujhe mujhay mjhe chahiye chahye nahi nahin kahan kahaan kab apka aapka apki aapki apke aapke ' +
    'batao bataiye btao karo karna krna krdo kardo hoga hota milta milega milti shukria shukriya salam assalam dikhao dikha dena dedo kaise kese ' +
    'kaisay konsa konsi sab kaun kon rabta ghar sasta paisay dalo daal kam').split(' ');
  function detectLang(t) {
    var w = t.split(' '), ur = w.some(function (x) { return UR.indexOf(x) > -1 && x !== 'kam'; }) || /\bse kam\b/.test(t);
    if (ur) state.lang = 'ur';
    else if (w.length >= 3) state.lang = 'en';
  }

  /* ---------------- item / category matching ---------------- */
  function tokensOf(t) {
    return t.split(' ').map(function (w) { return SYN[w] || w; }).filter(function (w) { return w.length >= 3 && !STOP[w]; }).map(stem);
  }
  function itemStems(it) { return norm(it.name).split(' ').map(function (w) { return stem(SYN[w] || w); }); }
  function findItems(t) {
    var toks = tokensOf(t);
    var distinct = toks.filter(function (w) { return !GENERIC[w]; });
    if (!distinct.length) return [];
    var generic = toks.filter(function (w) { return GENERIC[w]; });
    var best = 0, scored = [];
    getProducts().concat(getMerch()).forEach(function (it) {
      var st = itemStems(it), s = 0;
      distinct.forEach(function (w) { if (st.indexOf(w) > -1) s += 1; });
      if (s > 0) {
        var catSt = stem(norm(it.cat));
        generic.forEach(function (w) { if (st.indexOf(w) > -1 || catSt === w) s += 0.5; });
        scored.push({ it: it, s: s }); if (s > best) best = s;
      }
    });
    return scored.filter(function (x) { return x.s === best; }).map(function (x) { return x.it; });
  }
  var CAT = { cake: 'Cakes', cooky: 'Cookies', pastry: 'Pastries', dessert: 'Desserts', pie: 'Pies', beverage: 'Beverages', coffee: 'Beverages', drink: 'Beverages', chai: 'Beverages', tea: 'Beverages', juice: 'Beverages', shake: 'Beverages', latte: 'Beverages' };
  function findCategory(t) {
    var toks = tokensOf(t);
    for (var i = 0; i < toks.length; i++) if (CAT[toks[i]]) return CAT[toks[i]];
    return null;
  }
  function parseBudget(raw) {
    var t = norm(String(raw).replace(/(\d),(\d{3})/g, '$1$2'));
    var m = t.match(/(?:under|below|less than|within|upto|up to|budget|max|maximum|cheaper than)\s*(?:of\s*)?(?:rs|pkr|rupees)?\s*(\d{3,5})/);
    if (m) return +m[1];
    m = t.match(/(\d{3,5})\s*(?:rs|pkr|rupees)?\s*(?:se kam|tak|ke andar|k andar|se neeche|or less|and below|or below|below|under|max)/);
    return m ? +m[1] : null;
  }

  /* ---------------- page actions ---------------- */
  function scrollTo(sel) {
    var n = q(sel); if (!n) return;
    if (mobile()) closePanel();
    n.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function openCart() {
    var o = q('#cartOffcanvas');
    try {
      if (window.bootstrap && o) window.bootstrap.Offcanvas.getOrCreateInstance(o).show();
      else { var b = q('.carticon .cart'); if (b) b.click(); }
    } catch (e) { }
    if (mobile()) closePanel();
  }
  function viewItem(it) {
    var b = it.node && it.node.querySelector(it.kind === 'product' ? '.view-product' : '.btn-view');
    if (b) b.click(); else scrollTo(it.kind === 'product' ? '#products' : '#main');
  }
  function addItem(it, btn) {
    if (typeof window.bbAddToCart !== 'function') { viewItem(it); return; }
    window.bbAddToCart({ name: it.name, price: it.price, image: it.img });
    if (btn) {
      var old = btn.textContent; btn.textContent = L('Added', 'Add ho gaya'); btn.disabled = true;
      setTimeout(function () { btn.textContent = old; btn.disabled = false; }, 1400);
    }
    botSay([L('Added **' + it.name + '** to your cart.', '**' + it.name + '** cart mein add ho gaya.'), cartLine(),
      { btns: [{ label: L('Open my cart', 'Cart kholo'), fn: openCart }, { label: L('Keep browsing', 'Aur dekhein'), ghost: 1, fn: function () { send(L('Show menu', 'Menu dikhao')); } }] }], chipsDefault());
  }
  function cartData() {
    var c = (typeof window.bbGetCart === 'function' && window.bbGetCart()) || [];
    var n = 0, total = 0;
    c.forEach(function (i) { n += i.quantity; total += i.price * i.quantity; });
    return { items: c, count: n, total: total };
  }
  function cartLine() {
    var d = cartData();
    return L('Your cart: ' + d.count + (d.count === 1 ? ' item' : ' items') + ', ' + money(d.total) + ' (delivery ' + money(DELIVERY_FEE) + ' is added at checkout).',
      'Aap ke cart mein ' + d.count + ' items hain, ' + money(d.total) + ' (checkout par delivery ' + money(DELIVERY_FEE) + ' alag lagegi).');
  }

  /* ---------------- UI building ---------------- */
  function build() {
    var root = mk('div'); root.id = 'bbChat'; root.setAttribute('data-open', 'false');
    root.innerHTML =
      '<div class="bb-teaser" hidden role="button" tabindex="0"><span></span><button type="button" class="bb-teaser-x" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<button type="button" class="bb-fab" aria-label="Chat with Bite Buddy" aria-expanded="false" aria-controls="bbPanel"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i><span>Ask Bite Buddy</span></button>' +
      '<div class="bb-panel" id="bbPanel" role="dialog" aria-label="Bite Buddy chat assistant" hidden>' +
      '<div class="bb-head"><div class="bb-avatar" aria-hidden="true"><i class="fa-solid fa-cake-candles"></i></div>' +
      '<div class="bb-title"><div class="bb-name">Bite <em>Buddy</em></div><div class="bb-status"><span class="bb-dot"></span>Bakerz Bite assistant</div></div>' +
      '<button type="button" class="bb-iconbtn bb-reset" aria-label="Start a new chat" title="New chat"><i class="fa-solid fa-rotate-right"></i></button>' +
      '<button type="button" class="bb-iconbtn bb-close" aria-label="Close chat"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="bb-msgs" role="log" aria-live="polite"></div>' +
      '<div class="bb-chips" aria-label="Suggested questions"></div>' +
      '<form class="bb-form" autocomplete="off"><input class="bb-input" type="text" maxlength="200" placeholder="Ask about cakes, delivery, offers..." aria-label="Type your question"><button type="submit" class="bb-send" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></form>' +
      '<p class="bb-note">Answers come from this website. For custom orders, email ' + EMAIL + '.</p></div>';
    document.body.appendChild(root);
    ui.root = root; ui.fab = q('.bb-fab', root); ui.panel = q('.bb-panel', root); ui.msgs = q('.bb-msgs', root);
    ui.chips = q('.bb-chips', root); ui.form = q('.bb-form', root); ui.input = q('.bb-input', root);
    ui.teaser = q('.bb-teaser', root);

    ui.fab.addEventListener('click', function () { state.open ? closePanel() : openPanel(); });
    q('.bb-close', root).addEventListener('click', closePanel);
    q('.bb-reset', root).addEventListener('click', resetChat);
    ui.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ui.input.value.trim(); if (!v) return;
      ui.input.value = ''; send(v);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) { closePanel(); ui.fab.focus(); } });
    ui.teaser.addEventListener('click', function (e) { if (e.target.closest('.bb-teaser-x')) { hideTeaser(true); } else { openPanel(); } });
    ui.teaser.addEventListener('keydown', function (e) { if (e.key === 'Enter') openPanel(); });
  }

  function openPanel() {
    state.open = true; hideTeaser(true);
    ui.panel.hidden = false; ui.root.setAttribute('data-open', 'true'); ui.fab.setAttribute('aria-expanded', 'true');
    if (!ui.msgs.children.length) welcome();
    if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) ui.input.focus();
    toBottom();
  }
  function closePanel() {
    state.open = false; ui.panel.hidden = true; ui.root.setAttribute('data-open', 'false'); ui.fab.setAttribute('aria-expanded', 'false');
  }
  function resetChat() { ui.msgs.innerHTML = ''; state.lang = 'en'; welcome(); }
  function hideTeaser(remember) {
    ui.teaser.hidden = true;
    if (remember) { try { sessionStorage.setItem('bbTeaser', '1'); } catch (e) { } }
  }
  function maybeTeaser() {
    var seen = false; try { seen = sessionStorage.getItem('bbTeaser') === '1'; } catch (e) { }
    if (seen) return;
    setTimeout(function () {
      if (state.open) return;
      q('span', ui.teaser).textContent = 'Need help choosing a cake? Ask me!';
      ui.teaser.hidden = false;
    }, 8000);
  }
  function toBottom() { ui.msgs.scrollTop = ui.msgs.scrollHeight; }

  /* ---------------- rendering ---------------- */
  function rich(p, str) {
    String(str).split('**').forEach(function (seg, i) {
      if (!seg) return;
      if (i % 2) p.appendChild(mk('strong', '', seg)); else p.appendChild(document.createTextNode(seg));
    });
  }
  function renderCard(it) {
    var c = mk('div', 'bb-card');
    var img = mk('img'); img.alt = it.name; img.loading = 'lazy'; img.src = it.img; img.addEventListener('load', toBottom);
    var body = mk('div');
    body.appendChild(mk('div', 'bb-card-name', it.name));
    body.appendChild(mk('div', 'bb-card-meta', it.cat + ' \u00b7 \u2605 ' + it.rating));
    body.appendChild(mk('div', 'bb-card-price', money(it.price)));
    var act = mk('div', 'bb-card-actions');
    var add = mk('button', 'bb-btn', L('Add to cart', 'Cart mein dalo')); add.type = 'button';
    add.addEventListener('click', function () { addItem(it, add); });
    var view = mk('button', 'bb-btn bb-ghost', L('Details', 'Tafseel')); view.type = 'button';
    view.addEventListener('click', function () { viewItem(it); });
    act.appendChild(add); act.appendChild(view);
    body.appendChild(act); c.appendChild(img); c.appendChild(body);
    return c;
  }
  function renderParts(bubble, parts) {
    parts.forEach(function (p) {
      if (!p) return;
      if (typeof p === 'string') { var e = mk('p'); rich(e, p); bubble.appendChild(e); }
      else if (p.small) { bubble.appendChild(mk('p', 'bb-small', p.small)); }
      else if (p.ul) { var u = mk('ul'); p.ul.forEach(function (x) { var li = mk('li'); rich(li, x); u.appendChild(li); }); bubble.appendChild(u); }
      else if (p.cards) { var g = mk('div', 'bb-cards'); p.cards.forEach(function (it) { g.appendChild(renderCard(it)); }); bubble.appendChild(g); }
      else if (p.btns) {
        var d = mk('div', 'bb-btns');
        p.btns.forEach(function (b) {
          var x = mk('button', 'bb-btn' + (b.ghost ? ' bb-ghost' : ''), b.label); x.type = 'button';
          x.addEventListener('click', b.fn); d.appendChild(x);
        });
        bubble.appendChild(d);
      }
    });
  }
  function addRow(who, parts) {
    var row = mk('div', 'bb-row' + (who === 'me' ? ' bb-me' : ''));
    var b = mk('div', 'bb-bubble');
    if (who === 'me') b.textContent = parts; else renderParts(b, parts);
    row.appendChild(b); ui.msgs.appendChild(row); toBottom();
    return row;
  }
  function setChips(list) {
    ui.chips.innerHTML = '';
    (list || []).forEach(function (label) {
      var b = mk('button', 'bb-chip', label); b.type = 'button';
      b.addEventListener('click', function () { send(label); });
      ui.chips.appendChild(b);
    });
    ui.chips.scrollLeft = 0;
  }
  function botSay(parts, chips) { addRow('bot', parts.filter(Boolean)); setChips(chips); }
  function chipsDefault() {
    return state.lang === 'ur'
      ? ['Menu dikhao', 'Offers kya hain?', 'Sab se acha kya hai?', '1000 se kam', 'Delivery hai?', 'Timing kya hai?', 'Custom cake', 'Rabta kaise karein?']
      : ['Show menu', 'Offers', 'Best sellers', 'Under Rs. 1000', 'Delivery info', 'Opening hours', 'Custom cake', 'Contact us'];
  }
  function welcome() {
    botSay([L('Hi! I\u2019m **Bite Buddy**, the Bakerz Bite assistant. \ud83e\uddc1 Ask me about our cakes, pastries, prices, offers, delivery or opening hours.',
      'Assalam o alaikum! Main **Bite Buddy** hoon, Bakerz Bite ka assistant. Cakes, pastries, prices, offers, delivery ya timings ke baare mein poochiye.'),
      L('I understand English and Roman Urdu.', 'Aap English ya Roman Urdu mein likh sakte hain.')], chipsDefault());
  }

  /* ---------------- conversation flow ---------------- */
  function send(text) {
    if (state.busy) return;
    addRow('me', text);
    setChips([]);
    state.busy = true;
    var typing = mk('div', 'bb-row'), tb = mk('div', 'bb-bubble'), dots = mk('div', 'bb-typing');
    dots.setAttribute('aria-label', 'Bite Buddy is typing');
    dots.appendChild(mk('span')); dots.appendChild(mk('span')); dots.appendChild(mk('span'));
    tb.appendChild(dots); typing.appendChild(tb); ui.msgs.appendChild(typing); toBottom();
    var reply;
    try { reply = answer(text); } catch (e) { if (window.console) console.error("BiteBuddy:", e); reply = { parts: [L('Sorry, something went wrong. Please try again.', 'Maaf kijiye, kuch masla aa gaya. Dobara koshish karein.')], chips: chipsDefault() }; }
    var size = JSON.stringify(reply.parts.filter(Boolean).map(function (p) { return typeof p === 'string' ? p : (p.ul || p.small || ''); })).length;
    setTimeout(function () {
      typing.remove(); state.busy = false;
      botSay(reply.parts, reply.chips || chipsDefault());
      if (reply.run) reply.run();
    }, 350 + Math.min(900, size * 3));
  }
  window.bbChatAsk = function (text) { if (!state.open) openPanel(); send(String(text || '')); };

  /* ---------------- the "brain" ---------------- */
  var INTENTS = [
    ['who', ['real person', 'are you a person', 'are you a robot', 'is this ai', 'chatgpt', 'who are you', 'your name', 'are you a bot', 'are you human', 'are you ai', 'are you real', 'what are you', 'kaun ho', 'aap kaun', 'tum kaun', 'kya ho']],
    ['thanks', ['thanks', 'thank you', 'thx', 'tysm', 'shukria', 'shukriya', 'jazakallah']],
    ['bye', ['bye', 'goodbye', 'see you', 'allah hafiz', 'khuda hafiz', 'tata']],
    ['track', ['track', 'tracking', 'order status', 'where is my order', 'refund', 'cancel', 'cancellation', 'return', 'exchange', 'replace']],
    ['allergen', ['allergy', 'allergic', 'allergen', 'allergens', 'nut', 'nuts', 'peanut', 'gluten', 'vegan', 'eggless', 'egg free', 'dairy', 'lactose', 'halal', 'sugar free', 'diabetic', 'vegetarian', 'dietary']],
    ['custom', ['custom', 'customize', 'customise', 'customized', 'personalised', 'personalized', 'theme cake', 'photo cake', 'birthday', 'wedding', 'anniversary', 'celebration', 'party', 'gift', 'shaadi', 'salgirah']],
    ['hours', ['timing', 'timings', 'time', 'hours', 'open', 'opening', 'close', 'closing', 'closed', 'schedule', 'kab khulta', 'kab khulti', 'kab tak', 'khula', 'khulay', 'band', 'sunday', 'weekend']],
    ['delivery', ['delivery time', 'deliver', 'delivery', 'deliveries', 'shipping', 'ship', 'delivery charges', 'delivery fee', 'home delivery', 'doorstep', 'courier', 'ghar', 'free delivery']],
    ['payment', ['pay', 'payment', 'payments', 'cash', 'card', 'cards', 'debit', 'credit', 'cod', 'cash on delivery', 'bank transfer', 'easypaisa', 'jazzcash', 'online payment', 'paisay']],
    ['offers', ['weekend deal', 'weekend offer', 'family box', 'dessert box', 'cafe combo', 'coffee combo', 'birthday offer', 'birthday special', 'buy more save more', 'seasonal special', 'offer', 'offers', 'deal', 'deals', 'discount', 'discounts', 'promo', 'promotion', 'sale', 'coupon', 'voucher', 'combo', 'chhoot', 'chhut']],
    ['contact', ['contact', 'email', 'mail', 'phone', 'number', 'call', 'whatsapp', 'reach', 'rabta', 'raabta', 'talk to', 'speak to', 'human', 'support', 'complain', 'complaint', 'feedback']],
    ['location', ['where', 'address', 'location', 'located', 'branch', 'branches', 'map', 'directions', 'kahan', 'kahaan', 'pata', 'visit', 'store', 'shop', 'outlet', 'dukaan']],
    ['ingredients', ['ingredient', 'ingredients', 'made of', 'made with', 'butter', 'cream', 'flour', 'kis cheez se']],
    ['freshness', ['fresh', 'freshness', 'stale', 'baked today', 'batch', 'taza', 'tazah']],
    ['merch', ['merch', 'merchandise', 'souvenir']],
    ['howto', ['how to order', 'how do i order', 'place order', 'place an order', 'order kaise', 'order karna', 'order krna', 'order kese', 'checkout', 'check out', 'buy', 'purchase', 'order', 'ordering']],
    ['menu', ['menu', 'products', 'items', 'what do you sell', 'what do you have', 'what do you offer', 'categories', 'varieties', 'sell', 'available', 'kya milta', 'kya kya milta']],
    ['recommend', ['best', 'popular', 'top', 'recommend', 'recommendation', 'suggest', 'suggestion', 'favourite', 'favorite', 'bestseller', 'best seller', 'best sellers', 'must try', 'try', 'acha', 'achi', 'behtareen', 'konsa', 'konsi']],
    ['cheap', ['cheap', 'cheapest', 'affordable', 'lowest', 'sasta', 'sasti', 'low price', 'budget friendly']],
    ['prices', ['price list', 'all prices', 'prices', 'rates', 'price', 'kitne ka', 'kitnay ka', 'qeemat', 'keemat', 'kimat', 'kitna', 'kitne', 'how much', 'cost', 'rate']],
    ['about', ['about', 'story', 'history', 'about us', 'bakery', 'founded', 'apke baare']],
    ['theme', ['dark mode', 'light mode', 'theme', 'dark theme', 'light theme', 'night mode']],
    ['help', ['help', 'what can you do', 'how can you help', 'kya kar sakte', 'madad', 'commands']],
    ['greet', ['hi', 'hii', 'hello', 'hey', 'hiya', 'salam', 'assalam o alaikum', 'assalamualaikum', 'aoa', 'good morning', 'good evening', 'good afternoon']],
    ['compliment', ['nice', 'great', 'awesome', 'cool', 'good bot', 'amazing', 'wow', 'love it', 'zabardast', 'mast']]
  ];
  var SECTIONS = [
    ['#home', 'Home', ['home', 'top', 'hero'], 0], ['#about', 'About', ['about'], 0], ['#products', 'Products', ['products', 'menu'], 0],
    ['#main', 'Merchandise', ['merch', 'merchandise'], 0], ['#offers', 'Offers', ['offers'], 0], ['#gallery-wrap', 'Gallery', ['gallery', 'photos', 'pictures', 'images', 'tasveer'], 1],
    ['.kind-words', 'Reviews', ['review', 'reviews', 'testimonials', 'kind words'], 1], ['#faq', 'FAQ', ['faq', 'faqs'], 1], ['#contact', 'Contact', ['contact form', 'contact section'], 0]
  ];
  function scoreIntents(t) {
    var best = null, bs = 0;
    INTENTS.forEach(function (row) {
      var s = 0;
      row[1].forEach(function (kw) { if (has(t, kw)) s += kw.split(' ').length; });
      if (row[0] === 'greet' && t.split(' ').length > 4) s = 0;
      if (s > bs) { bs = s; best = row[0]; }
    });
    return { id: best, score: bs };
  }
  var NAVVERB = /\b(go to|take me|scroll|navigate|jump to|show me the|open the|section)\b/;
  function navTarget(t, sc) {
    var verb = NAVVERB.test(t), short = t.split(' ').length <= 2;
    for (var i = 0; i < SECTIONS.length; i++) {
      for (var j = 0; j < SECTIONS[i][2].length; j++) {
        if (!has(t, SECTIONS[i][2][j])) continue;
        if (verb || (SECTIONS[i][3] && (sc.score === 0 || short))) return SECTIONS[i];
      }
    }
    return null;
  }

  function cards(list, n) { return { cards: list.slice(0, n || 4) }; }
  function byRating(a, b) { return b.rating - a.rating || a.price - b.price; }

  function answer(raw) {
    var text = String(raw).replace(/(\d),(\d{3})/g, '$1$2');
    var t = norm(text);
    detectLang(t);
    var P = getProducts(), M = getMerch();

    /* cart actions */
    var wantsAdd = /\b(add|dalo|daal|dal do|buy|lena|le lo|khareed|rakh do|chahiye|chahye)\b/.test(t);
    var items = findItems(t);
    if (wantsAdd && items.length && !/\bhow\b/.test(t)) {
      if (items.length === 1) {
        var it = items[0];
        if (typeof window.bbAddToCart === 'function') {
          window.bbAddToCart({ name: it.name, price: it.price, image: it.img });
          return { parts: [L('Done! I added **' + it.name + '** (' + money(it.price) + ') to your cart.', 'Ho gaya! **' + it.name + '** (' + money(it.price) + ') cart mein add kar diya.'), cartLine(),
            { btns: [{ label: L('Open my cart', 'Cart kholo'), fn: openCart }] }], chips: [L('Show my cart', 'Cart dikhao'), L('Checkout help', 'Order kaise karein?')].concat(chipsDefault().slice(0, 4)) };
        }
      }
      return { parts: [L('Which one would you like to add?', 'Kaun sa add karna hai?'), cards(items, 4)], chips: chipsDefault() };
    }
    if (/\b(my cart|view cart|show cart|open cart|cart dikhao|cart kholo|basket)\b/.test(t) || t === 'cart') {
      var d = cartData();
      if (!d.count) return { parts: [L('Your cart is empty right now. Pick something sweet and I\u2019ll help you order!', 'Aap ka cart abhi khali hai. Kuch pasand karein, main order mein madad karta hoon!')], chips: chipsDefault() };
      return { parts: [L('Here\u2019s your cart:', 'Ye aap ka cart hai:'),
        { ul: d.items.map(function (i) { return '**' + i.name + '** x ' + i.quantity + ' - ' + money(i.price * i.quantity); }) },
        cartLine(), { btns: [{ label: L('Open cart & checkout', 'Cart kholo'), fn: openCart }] }], chips: chipsDefault() };
    }

    /* budget */
    var budget = parseBudget(text);
    if (budget) {
      var pool = items.length ? items : P;
      var ok = pool.filter(function (p) { return p.price <= budget; }).sort(byRating);
      if (!ok.length && items.length) {
        var alt = P.filter(function (p) { return p.price <= budget; }).sort(byRating);
        return { parts: [L('**' + items[0].name + '** is ' + money(items[0].price) + ', which is above ' + money(budget) + '.', '**' + items[0].name + '** ' + money(items[0].price) + ' ka hai, jo ' + money(budget) + ' se zyada hai.'),
          alt.length ? L('Options within your budget:', 'Aap ke budget mein ye options hain:') : null, alt.length ? cards(alt, 3) : null] };
      }
      if (!ok.length) {
        var cheapest = P.slice().sort(function (a, b) { return a.price - b.price; })[0];
        return { parts: [L('Nothing on the menu is at or below ' + money(budget) + '. Our most affordable item is **' + cheapest.name + '** at ' + money(cheapest.price) + '.',
          money(budget) + ' ya us se kam mein koi item nahi hai. Sab se sasta **' + cheapest.name + '** hai, ' + money(cheapest.price) + ' ka.'), cards([cheapest])] };
      }
      return { parts: [L('Top picks up to ' + money(budget) + ' (' + ok.length + ' items match):', money(budget) + ' tak ke behtareen options (' + ok.length + ' items):'), cards(ok, 4),
        ok.length > 4 ? { btns: [{ label: L('See all products', 'Saari products dekhein'), ghost: 1, fn: function () { scrollTo('#products'); } }] } : null] };
    }

    /* section navigation */
    var sc = scoreIntents(t);
    var nav = navTarget(t, sc);
    if (nav) {
      return { parts: [L('Taking you to **' + nav[1] + '**.', '**' + nav[1] + '** par le jaa raha hoon.')], chips: chipsDefault(), run: function () { scrollTo(nav[0]); } };
    }

    var SERVICE = { hours: 1, delivery: 1, payment: 1, custom: 1, allergen: 1, track: 1, contact: 1, location: 1, offers: 1, who: 1, thanks: 1, bye: 1, howto: 1, freshness: 1, ingredients: 1 };
    var onlyDrink = tokensOf(t).filter(function (w) { return !GENERIC[w]; }).every(function (w) { return CAT[w] === 'Beverages'; });
    if (findCategory(t) === 'Beverages' && onlyDrink && !(sc.id && SERVICE[sc.id] && sc.score >= 1)) return categoryReply('Beverages');
    if (items.length && !(sc.id && SERVICE[sc.id] && sc.score >= 1)) return itemReply(items, t);
    if (sc.id && sc.score >= 1) return intentReply(sc.id, t);

    var cat = findCategory(t);
    if (cat) return categoryReply(cat);

    /* fuzzy FAQ match */
    var qt = tokensOf(t), bestF = null, bestN = 0;
    getFaqs().forEach(function (f) {
      var st = tokensOf(norm(f.q + ' ' + f.a)), n = 0;
      qt.forEach(function (w) { if (st.indexOf(w) > -1) n++; });
      if (n > bestN) { bestN = n; bestF = f; }
    });
    if (bestF && (bestN >= 2 || (qt.length && bestN / qt.length >= 0.6))) return { parts: [bestF.a], chips: chipsDefault() };

    return { parts: [L('I\u2019m not sure I got that. I can help with our **menu, prices, offers, delivery, opening hours and custom cakes**.',
      'Mujhe ye samajh nahi aaya. Main **menu, prices, offers, delivery, timings aur custom cakes** ke baare mein bata sakta hoon.'),
      L('For anything else, the team is at ' + EMAIL + '.', 'Baaqi cheezon ke liye team se ' + EMAIL + ' par rabta karein.')] };
  }

  function itemReply(items, t) {
    if (items.length === 1) {
      var it = items[0], d = describe(it);
      return { parts: [L('**' + it.name + '** is ' + money(it.price) + ', rated ' + it.rating + ' out of 5.', '**' + it.name + '** ' + money(it.price) + ' ka hai, rating ' + it.rating + ' / 5.'),
        d ? { small: d } : null, cards([it]),
        it.kind === 'merch' ? L('Merchandise is also available in-store, subject to availability.', 'Merchandise store mein bhi mil jata hai (stock ke mutabiq).') : null],
        chips: [L('Show my cart', 'Cart dikhao'), L('Show menu', 'Menu dikhao'), L('Delivery info', 'Delivery hai?'), L('Best sellers', 'Sab se acha kya hai?')] };
    }
    return { parts: [L('I found ' + items.length + ' matches:', items.length + ' items mile:'), cards(items, 4)], chips: chipsDefault() };
  }
  function categoryReply(cat) {
    var list = getProducts().filter(function (p) { return p.cat === cat; });
    if (!list.length) {
      var combo = getOffers().filter(function (o) { return /combo|coffee|caf/i.test(o.title + o.desc); })[0];
      return { parts: [L('We don\u2019t have **' + cat.toLowerCase() + '** listed on the menu yet.', '**' + cat + '** abhi menu mein shamil nahi hain.'),
        cat === 'Beverages' && combo ? L('But our **' + combo.title + '** pairs a pastry with a handcrafted coffee (' + combo.badge + ', ' + lc(combo.valid) + ').', 'Lekin **' + combo.title + '** mein pastry ke saath handcrafted coffee milti hai (' + combo.badge + ', ' + combo.valid + ').') : null,
        L('You can ask the team at ' + EMAIL + '.', 'Team se ' + EMAIL + ' par pooch sakte hain.'),
        cat === 'Beverages' ? L('For coffee at home, see our merchandise:', 'Ghar par coffee ke liye hamari merchandise dekhein:') : null,
        cat === 'Beverages' ? cards(getMerch().filter(function (m) { return /tumbler|mug/i.test(m.name); }), 2) : null] };
    }
    return { parts: [L('Here are our **' + cat + '**:', 'Ye hain hamare **' + cat + '**:'), cards(list, 4)] };
  }

  function intentReply(id, t) {
    var P = getProducts(), M = getMerch(), O = getOffers();
    switch (id) {
      case 'greet': return { parts: [L('Hello! How can I help you today?', 'Assalam o alaikum! Kya madad kar sakta hoon?')] };
      case 'who': return { parts: [L('I\u2019m **Bite Buddy**, the Bakerz Bite chat assistant. I answer from the information on this website (menu, prices, offers, FAQ). I\u2019m an automated assistant, not a person.',
        'Main **Bite Buddy** hoon, Bakerz Bite ka chat assistant. Main is website ki maloomat (menu, prices, offers, FAQ) se jawab deta hoon. Main ek automatic assistant hoon, insaan nahi.'),
        L('For anything I can\u2019t answer, email ' + EMAIL + '.', 'Jo mujhe nahi pata uske liye ' + EMAIL + ' par email karein.')] };
      case 'thanks': return { parts: [L('You\u2019re welcome! Anything else I can help with?', 'Khushi hui! Aur kuch poochna ho to bataiye.')] };
      case 'bye': return { parts: [L('Goodbye! Come back soon and enjoy something sweet.', 'Allah hafiz! Phir milte hain, kuch meetha zaroor enjoy karein.')], chips: [] };
      case 'compliment': return { parts: [L('Thank you! That made my day. Can I help you pick something?', 'Shukriya! Kya main kuch pasand karne mein madad karun?')] };
      case 'help': return { parts: [L('I can help with:', 'Main in cheezon mein madad kar sakta hoon:'),
        { ul: [L('Menu, prices and recommendations', 'Menu, prices aur recommendations'), L('Offers and deals', 'Offers aur deals'), L('Delivery, payment and opening hours', 'Delivery, payment aur timings'),
          L('Custom cakes and celebrations', 'Custom cakes aur celebrations'), L('Adding items to your cart', 'Cart mein items dalna'), L('Contact details', 'Rabta ki tafseel')] }] };
      case 'theme': return { parts: [L('Use the sun / moon button in the top navbar to switch between light and dark themes. I follow the same theme.', 'Navbar mein sun / moon button se light aur dark theme badal sakte hain. Main bhi usi theme ko follow karta hoon.')] };
      case 'hours': {
        var on = null;
        try { var h = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Karachi' }).format(new Date()), 10); on = h >= 8 && h < 23; } catch (e) { }
        return { parts: [faqAnswer(/timing/i) || L('We\u2019re open daily from 8:00 AM to 11:00 PM.', 'Hum rozana subah 8:00 se raat 11:00 baje tak khule hain.'),
          on === null ? null : L(on ? 'Right now we should be open (Karachi time).' : 'Right now we should be closed (Karachi time).', on ? 'Is waqt hum khule hone chahiye (Karachi time).' : 'Is waqt hum band hone chahiye (Karachi time).')] };
      }
      case 'delivery': return { parts: [L('Yes, we deliver in **Karachi**. A delivery fee of ' + money(DELIVERY_FEE) + ' is added at checkout, where you can also leave your address and delivery notes.',
        'Ji haan, hum **Karachi** mein delivery karte hain. Checkout par ' + money(DELIVERY_FEE) + ' delivery fee lagti hai, wahin address aur delivery notes bhi likh sakte hain.'),
        { btns: [{ label: L('How to order', 'Order kaise karein?'), ghost: 1, fn: function () { send(L('How to order', 'Order kaise karein?')); } }] }] };
      case 'payment': return { parts: [faqAnswer(/payment/i) || L('We accept cash, major debit and credit cards, and popular digital payment methods.', 'Hum cash, debit/credit cards aur digital payment qubool karte hain.'),
        L('On the website checkout you can choose **Cash on Delivery** or **bank transfer** (confirmed separately).', 'Website checkout par **Cash on Delivery** ya **bank transfer** (alag se confirm) chun sakte hain.')] };
      case 'custom': {
        var bo = O.filter(function (o) { return /birthday/i.test(o.title); })[0];
        return { parts: [faqAnswer(/custom/i) || L('Yes, you can customize your cake for birthdays, weddings and special occasions.', 'Ji haan, birthday, shadi aur khaas mauqon ke liye cake customize ho sakta hai.'),
          L('Tell the team your occasion, flavour and size through the contact form or at ' + EMAIL + '.', 'Team ko apna occasion, flavour aur size contact form ya ' + EMAIL + ' par bata dein.'),
          bo ? L('Offer: **' + bo.badge + ' ' + bo.title + '** (' + lc(bo.valid) + ').', 'Offer: **' + bo.badge + ' ' + bo.title + '** (' + bo.valid + ').') : null,
          cards(P.filter(function (p) { return p.cat === 'Cakes'; }).sort(byRating), 2),
          { btns: [{ label: L('Open contact form', 'Contact form kholo'), fn: function () { scrollTo('#contact'); } }] }] };
      }
      case 'ingredients': return { parts: [L('We bake with **real butter, fresh cream, unbleached flour** and carefully selected ingredients.', 'Hum **real butter, fresh cream, unbleached flour** aur chuni hui ingredients se bake karte hain.'),
        { ul: [L('Cakes: fresh cream, premium flour, butter, sugar', 'Cakes: fresh cream, premium flour, butter, sugar'), L('Pastries: premium flour, butter, sugar', 'Pastries: premium flour, butter, sugar'), L('Cookies: flour, butter, sugar, chocolate', 'Cookies: flour, butter, sugar, chocolate')] }] };
      case 'freshness': return { parts: [faqAnswer(/fresh/i) || L('Our bakers produce in small batches throughout the day, with strict preparation and quality checks.', 'Hamare bakers din bhar chhote batches mein banate hain aur har cheez ki quality check hoti hai.')] };
      case 'allergen': return { parts: [L('The website doesn\u2019t list allergen or dietary details (for example nuts, gluten, eggs or halal/vegan options), so I can\u2019t confirm them.',
        'Website par allergen ya dietary tafseel (jaise nuts, gluten, eggs ya halal/vegan) likhi nahi, is liye main confirm nahi kar sakta.'),
        L('If you have an allergy, please ask the team before ordering: ' + EMAIL + '. Note that the Almond Danish contains almonds.', 'Agar allergy hai to order se pehle team se ' + EMAIL + ' par zaroor poochein. Almond Danish mein badaam hota hai.')] };
      case 'merch': return { parts: [L('Our merchandise:', 'Hamari merchandise:'), cards(M, 4), faqAnswer(/merch/i) || null] };
      case 'offers': {
        var sel = null, qt = tokensOf(t).filter(function (w) { return ['offer', 'deal', 'special', 'save', 'more', 'buy', 'discount', 'promo', 'combo'].indexOf(w) < 0 || w === 'combo'; });
        O.forEach(function (o) { var st = tokensOf(norm(o.title)); if (qt.some(function (w) { return w !== 'offer' && st.indexOf(w) > -1; })) sel = sel || o; });
        var list = sel ? [sel] : O;
        if (!list.length) return { parts: [L('Check the Offers section for our latest deals.', 'Taaza deals ke liye Offers section dekhein.')] };
        return { parts: [L(sel ? 'Here\u2019s that offer:' : 'Current offers:', sel ? 'Ye offer hai:' : 'Maujooda offers:'),
          { ul: list.map(function (o) { return '**' + o.badge + '** ' + o.title + ' - ' + o.desc + ' (' + o.valid + ')'; }) },
          { small: L('Offer terms are as shown on the site; please confirm when ordering.', 'Offers ki sharait website ke mutabiq hain; order ke waqt confirm kar lein.') },
          { btns: [{ label: L('See offers section', 'Offers section dekhein'), ghost: 1, fn: function () { scrollTo('#offers'); } }] }] };
      }
      case 'contact': return { parts: [L('You can reach the team here:', 'Team se yahan rabta karein:'),
        { ul: [L('Email: **' + EMAIL + '**', 'Email: **' + EMAIL + '**'), L('Location: Karachi, Pakistan', 'Jagah: Karachi, Pakistan'), L('Phone: the number isn\u2019t published on the site yet', 'Phone: number abhi website par shaya nahi hua')] },
        { btns: [{ label: L('Open contact form', 'Contact form kholo'), fn: function () { scrollTo('#contact'); } }] }] };
      case 'location': return { parts: [L('We\u2019re in **Karachi, Pakistan**. The full street address and map aren\u2019t published on the site yet (map coming soon).', 'Hum **Karachi, Pakistan** mein hain. Poora address aur map abhi website par nahi hai (map jald aa raha hai).'),
        L('For directions, email ' + EMAIL + '.', 'Directions ke liye ' + EMAIL + ' par email karein.'),
        { btns: [{ label: L('Open contact section', 'Contact section kholo'), ghost: 1, fn: function () { scrollTo('#contact'); } }] }] };
      case 'track': return { parts: [L('I can\u2019t see or change placed orders. For order status, changes, cancellations or refunds, please email **' + EMAIL + '**.', 'Main placed orders dekh ya badal nahi sakta. Order status, tabdeeli, cancel ya refund ke liye **' + EMAIL + '** par email karein.')] };
      case 'howto': return { parts: [L('Ordering is easy:', 'Order karna aasaan hai:'),
        { ul: [L('Choose an item and tap **Add to cart** (I can do it for you: say "add red velvet cake").', 'Item chunein aur **Add to cart** dabayein (main bhi kar sakta hoon: "red velvet cake add karo" likhein).'),
          L('Tap **View Cart** in the navbar and press checkout.', 'Navbar mein **View Cart** dabayein aur checkout karein.'),
          L('Fill in your name, phone, address and payment method. Delivery (' + money(DELIVERY_FEE) + ') is added automatically.', 'Naam, phone, address aur payment method likhein. Delivery (' + money(DELIVERY_FEE) + ') khud add ho jati hai.')] },
        { btns: [{ label: L('Open my cart', 'Cart kholo'), fn: openCart }] }], chips: [L('Show menu', 'Menu dikhao'), L('Delivery info', 'Delivery hai?'), L('Payment methods', 'Payment kaise karein?')] };
      case 'menu': {
        var counts = {}; P.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
        var cl = Object.keys(counts);
        return { parts: [L('We list **' + P.length + ' bakes** across ' + cl.length + ' categories, plus merchandise:', 'Hamare menu mein **' + P.length + ' items** ' + cl.length + ' categories mein hain, saath merchandise bhi:'),
          { ul: cl.map(function (c) { return '**' + c + '** (' + counts[c] + ')'; }) },
          { btns: [{ label: L('Open products section', 'Products section kholo'), ghost: 1, fn: function () { scrollTo('#products'); } }] }],
          chips: cl.map(function (c) { return c; }).concat([L('Merchandise', 'Merch dikhao'), L('Best sellers', 'Sab se acha kya hai?')]) };
      }
      case 'recommend': return { parts: [L('Our highest-rated picks:', 'Sab se zyada rating wali cheezein:'), cards(P.slice().sort(byRating), 3)] };
      case 'cheap': return { parts: [L('Our most affordable treats:', 'Sab se sasti cheezein:'), cards(P.slice().sort(function (a, b) { return a.price - b.price || b.rating - a.rating; }), 3)] };
      case 'prices': return { parts: [L('Our menu prices:', 'Menu ki prices:'), { ul: P.map(function (p) { return '**' + p.name + '** - ' + money(p.price); }) },
        { small: L('Ask about a specific item and I\u2019ll show it with a photo.', 'Kisi khaas item ke baare mein poochein, main photo ke saath dikha doonga.') }] };
      case 'about': return { parts: [L('Bakerz Bite is a warm neighbourhood bakery and caf\u00e9 in Karachi with 300+ baked varieties. Every batch starts with real butter, fresh cream and unbleached flour.', 'Bakerz Bite Karachi ki ek warm neighbourhood bakery aur caf\u00e9 hai jahan 300+ baked varieties milti hain. Har batch real butter, fresh cream aur unbleached flour se shuru hota hai.'),
        { btns: [{ label: L('Read our story', 'Hamari kahani'), ghost: 1, fn: function () { scrollTo('#about'); } }] }] };
    }
    return { parts: [L('Could you rephrase that?', 'Kya aap dobara likh sakte hain?')] };
  }

  /* ---------------- start ---------------- */
  function init() { build(); maybeTeaser(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
