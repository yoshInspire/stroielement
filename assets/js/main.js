/* АСЕНА ГРУПП — интерактив лендинга */
(function () {
  'use strict';

  /* ============================================================
     КУДА УХОДЯТ ЗАЯВКИ

     LEAD_ENDPOINT пустой — форма собирает письмо и открывает почтовую
     программу посетителя. Это работает на статичном хостинге без сервера,
     но часть людей письмо не отправит.

     Чтобы заявки приходили сами: завести приёмник форм (Formspree,
     Getform, собственный обработчик) и вписать его адрес в LEAD_ENDPOINT.
     Данные уйдут туда обычным POST в формате JSON, ничего больше
     менять не нужно.
     ============================================================ */
  var LEAD_ENDPOINT = '';
  var LEAD_EMAIL = 'stroy.element77@gmail.com';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Шапка: фон при скролле ---------- */
  var hdr = document.getElementById('hdr');
  var hasHero = !!document.getElementById('hero');
  if (hdr) {
    var onScrollHdr = function () {
      // на внутренних страницах фотографии во весь экран нет,
      // поэтому шапка непрозрачна всегда
      hdr.classList.toggle('is-stuck', !hasHero || window.scrollY > 40);
    };
    onScrollHdr();
    window.addEventListener('scroll', onScrollHdr, { passive: true });
  }

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = hdr.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        hdr.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Появление блоков ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Первый экран: смена кадров ---------- */
  var hero = document.getElementById('hero');
  if (hero) {
    var slides = [].slice.call(hero.querySelectorAll('.hero__slide'));
    var bars = [].slice.call(hero.querySelectorAll('.hero__bar'));
    var cap = hero.querySelector('.hero__cap');
    var HOLD = 3000;                 // столько же стоит в @keyframes heroBar
    var cur = 0, timer = null, swap = null, fade = null;
    var FADE = 1000;                 // столько же стоит в transition у .hero__slide

    var tick = function () {
      clearTimeout(timer);
      if (reduced || slides.length < 2) return;
      timer = setTimeout(function () { show(cur + 1); }, HOLD);
    };

    var show = function (n) {
      var prev = slides[cur];
      cur = (n + slides.length) % slides.length;

      slides.forEach(function (s, k) { s.classList.toggle('is-on', k === cur); });

      // предыдущий кадр держим видимым, пока новый не проявился полностью
      if (prev !== slides[cur]) {
        prev.classList.add('was-on');
        clearTimeout(fade);
        fade = setTimeout(function () {
          slides.forEach(function (s) {
            if (!s.classList.contains('is-on')) s.classList.remove('was-on');
          });
        }, FADE);
      }
      bars.forEach(function (b, k) {
        b.classList.remove('is-on');
        if (k === cur) { void b.offsetWidth; b.classList.add('is-on'); }  // перезапуск полосы
      });
      // подпись гаснет, меняется и возвращается
      cap.classList.remove('is-in');
      clearTimeout(swap);
      swap = setTimeout(function () {
        cap.querySelector('b').textContent = slides[cur].dataset.title;
        cap.querySelector('i').textContent = slides[cur].dataset.place;
        cap.classList.add('is-in');
      }, 240);

      tick();
    };

    bars.forEach(function (b, k) {
      b.addEventListener('click', function () { if (k !== cur) show(k); });
    });

    // свайп на телефоне
    var sx = 0, sy = 0;
    hero.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // на скрытой вкладке лента стоит
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else tick();
    });

    tick();
  }

  /* ---------- Фон: подсветка идёт за курсором ---------- */
  var bg = document.querySelector('.bg');
  if (bg && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    var tx = window.innerWidth / 2, ty = window.innerHeight * 0.4;
    var gx = tx, gy = ty, bgRaf = null;

    var follow = function () {
      gx += (tx - gx) * 0.045;          // сильное запаздывание, свет «густой»
      gy += (ty - gy) * 0.045;
      bg.style.setProperty('--mx', gx + 'px');
      bg.style.setProperty('--my', gy + 'px');
      bgRaf = (Math.abs(tx - gx) > 0.5 || Math.abs(ty - gy) > 0.5)
        ? requestAnimationFrame(follow)
        : null;
    };

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      tx = e.clientX; ty = e.clientY;
      bg.classList.add('is-live');
      if (!bgRaf) bgRaf = requestAnimationFrame(follow);
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      bg.classList.remove('is-live');
    });
  }

  /* ---------- Услуги: превью за курсором ---------- */
  var srv = document.getElementById('srv');
  var peek = document.getElementById('srvPeek');
  if (srv && peek && window.matchMedia('(hover: hover)').matches && !reduced) {
    var peekImg = peek.querySelector('img');
    var px = 0, py = 0, cx = 0, cy = 0, raf = null;
    var loop = function () {
      cx += (px - cx) * 0.14;
      cy += (py - cy) * 0.14;
      peek.style.left = cx + 'px';
      peek.style.top = cy + 'px';
      raf = requestAnimationFrame(loop);
    };
    srv.addEventListener('pointermove', function (e) {
      px = e.clientX + 185;
      py = e.clientY;
      if (!raf) { cx = px; cy = py; loop(); }
    });
    srv.querySelectorAll('.srv__i').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        var src = row.dataset.img;
        if (src && peekImg.getAttribute('src') !== src) peekImg.setAttribute('src', src);
        peek.classList.add('on');
      });
    });
    srv.addEventListener('pointerleave', function () {
      peek.classList.remove('on');
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    });
  }

  /* ---------- Проекты: горизонтальная лента ---------- */
  var railx = document.getElementById('railx');
  var bar = document.getElementById('railBar');
  if (railx) {
    var down = false, startX = 0, startL = 0, moved = 0;

    railx.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;      // тач — нативный скролл
      down = true; moved = 0;
      startX = e.clientX;
      startL = railx.scrollLeft;
      railx.classList.add('is-drag');
      railx.setPointerCapture(e.pointerId);
    });
    railx.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - startX;
      moved = Math.abs(d);
      railx.scrollLeft = startL - d;
    });
    var release = function (e) {
      if (!down) return;
      down = false;
      railx.classList.remove('is-drag');
      try { railx.releasePointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
    };
    railx.addEventListener('pointerup', release);
    railx.addEventListener('pointercancel', release);
    // после перетаскивания ленты кейс открываться не должен
    railx.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // вертикальное колесо сдвигает ленту, пока она не упёрлась в край
    railx.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var max = railx.scrollWidth - railx.clientWidth;
      var cur2 = railx.scrollLeft;
      // на краю отдаём прокрутку странице
      if ((e.deltaY > 0 && cur2 >= max - 1) || (e.deltaY < 0 && cur2 <= 0)) return;
      e.preventDefault();
      railx.scrollLeft = Math.max(0, Math.min(max, cur2 + e.deltaY));
    }, { passive: false });

    var syncBar = function () {
      if (!bar) return;
      var max = railx.scrollWidth - railx.clientWidth;
      var w = Math.max((railx.clientWidth / railx.scrollWidth) * 100, 8);
      bar.style.setProperty('--w', w + '%');
      var p = max > 0 ? railx.scrollLeft / max : 0;
      bar.style.setProperty('--x', (p * (100 / w * 100 - 100)) + '%');
    };
    syncBar();
    railx.addEventListener('scroll', syncBar, { passive: true });
    window.addEventListener('resize', syncBar);
  }

  /* ============================================================
     МОДАЛЬНЫЕ ОКНА
     Одна механика на оба окна: кейс объекта и заявка.
     ============================================================ */

  var openModal = null;     // окно, которое сейчас открыто
  var lastFocus = null;     // куда вернуть фокус после закрытия

  var lockScroll = function (on) {
    if (on) {
      // компенсируем ширину полосы прокрутки, иначе страница дёрнется
      var gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = gap > 0 ? gap + 'px' : '';
      document.body.classList.add('is-locked');
    } else {
      document.body.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  };

  var openWin = function (el) {
    if (openModal) closeWin();
    lastFocus = document.activeElement;
    el.hidden = false;
    lockScroll(true);
    openModal = el;
    var first = el.querySelector('input, textarea, button:not(.modal__x)');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  };

  var closeWin = function () {
    if (!openModal) return;
    openModal.hidden = true;
    // окно кейса переиспользуется, поэтому чистим содержимое и снимаем
    // с браузера загрузку фотографий закрытого объекта
    var body = openModal.querySelector('#caseBody');
    if (body) body.innerHTML = '';
    openModal.scrollTop = 0;
    openModal = null;
    lockScroll(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* элемент исчез */ } }
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openModal) closeWin();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeWin();
  });

  /* ---------- Окно кейса ---------- */
  var caseModal = document.getElementById('caseModal');
  var caseBody = document.getElementById('caseBody');

  var openCase = function (id) {
    var tpl = document.getElementById(id);
    if (!tpl || !caseModal || !caseBody) return;
    caseBody.innerHTML = '';
    caseBody.appendChild(tpl.content.cloneNode(true));
    openWin(caseModal);
    caseModal.scrollTop = 0;
  };

  document.addEventListener('click', function (e) {
    var host = e.target.closest('[data-case]');
    if (!host) return;
    e.preventDefault();
    openCase(host.dataset.case);
  });
  // карточка в портфолио открывается и с клавиатуры
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var host = e.target.closest && e.target.closest('.card[data-case]');
    if (!host) return;
    e.preventDefault();
    openCase(host.dataset.case);
  });

  /* ---------- Окно заявки ---------- */
  var leadModal = document.getElementById('leadModal');
  document.addEventListener('click', function (e) {
    var host = e.target.closest('[data-lead]');
    if (!host || !leadModal) return;
    e.preventDefault();
    var src = leadModal.querySelector('input[name="source"]');
    if (src) src.value = host.dataset.lead || 'Сайт';   // видно, с какой кнопки пришла заявка
    openWin(leadModal);
  });

  /* ============================================================
     ФОРМА ЗАЯВКИ
     Обязательны только имя и телефон: длинная анкета отпугивает.
     ============================================================ */

  var LABELS = {
    name: 'Имя', phone: 'Телефон', kind: 'Тип объекта', city: 'Город',
    area: 'Площадь', task: 'Задача', source: 'Откуда заявка'
  };

  /* ---------- Маски полей ----------
     Телефон приводится к виду +7 900 000 00 00 прямо во время ввода,
     площадь — к числу с разрядами. Курсор не прыгает: считаем, сколько
     цифр стояло левее него, и после переформатирования возвращаем
     каретку после того же количества цифр. */

  var digits = function (s) { return String(s).replace(/\D/g, ''); };

  // 8 900…, 7 900…, 900… — всё приводится к 7900…
  var phoneDigits = function (raw) {
    var d = digits(raw);
    if (!d) return '';
    d = (d.charAt(0) === '8' || d.charAt(0) === '7') ? '7' + d.slice(1) : '7' + d;
    return d.slice(0, 11);
  };

  var phoneFormat = function (d) {
    if (!d) return '';
    var out = '+7';
    if (d.length > 1) out += ' ' + d.slice(1, 4);
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += ' ' + d.slice(7, 9);
    if (d.length > 9) out += ' ' + d.slice(9, 11);
    return out;
  };

  // позиция каретки сразу после n-й цифры строки
  var caretAfterDigits = function (str, n) {
    if (n <= 0) return str.charAt(0) === '+' ? 1 : 0;
    var seen = 0;
    for (var i = 0; i < str.length; i++) {
      if (/\d/.test(str.charAt(i)) && ++seen === n) return i + 1;
    }
    return str.length;
  };

  var setCaret = function (el, pos) {
    try { el.setSelectionRange(pos, pos); } catch (e) { /* input может не поддерживать */ }
  };

  var maskPhone = function (el) {
    var pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    var before = digits(el.value.slice(0, pos)).length;
    var raw = digits(el.value).length;
    var d = phoneDigits(el.value);
    var val = phoneFormat(d);
    // если код 7 подставился сам, каретка должна уехать на цифру вперёд
    var shift = d.length - Math.min(raw, 11);
    el.value = val;
    setCaret(el, caretAfterDigits(val, before + (shift > 0 ? shift : 0)));
  };

  var maskArea = function (el) {
    var pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    var before = digits(el.value.slice(0, pos)).length;
    var val = digits(el.value).slice(0, 7).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    el.value = val;
    setCaret(el, caretAfterDigits(val, before));
  };

  // Backspace на разделителе должен стирать цифру слева, а не пробел
  var eatSeparator = function (e) {
    var el = e.target;
    if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd) return;
    var pos = el.selectionStart;
    if (pos === 0 || /\d/.test(el.value.charAt(pos - 1))) return;
    e.preventDefault();
    var p = pos - 1;
    while (p > 0 && !/\d/.test(el.value.charAt(p - 1))) p--;
    if (p === 0) return;
    el.value = el.value.slice(0, p - 1) + el.value.slice(p);
    setCaret(el, p - 1);
    (el.name === 'area' ? maskArea : maskPhone)(el);
  };

  [].forEach.call(document.querySelectorAll('form.lead input[name="phone"]'), function (el) {
    // в пустом поле сразу показываем код страны — так понятнее, что ждём
    el.addEventListener('focus', function () {
      if (!el.value) { el.value = '+7 '; setCaret(el, el.value.length); }
    });
    el.addEventListener('blur', function () {
      if (digits(el.value).length <= 1) el.value = '';
    });
    el.addEventListener('keydown', eatSeparator);
    el.addEventListener('input', function () { maskPhone(el); });
  });

  [].forEach.call(document.querySelectorAll('form.lead input[name="area"]'), function (el) {
    el.addEventListener('keydown', eatSeparator);
    el.addEventListener('input', function () { maskArea(el); });
  });

  var collect = function (form) {
    var out = [];
    [].forEach.call(form.elements, function (el) {
      if (!el.name || !el.value.trim()) return;
      out.push({ key: el.name, label: LABELS[el.name] || el.name, value: el.value.trim() });
    });
    return out;
  };

  // подпись под полем: пустая строка убирает и подсветку, и текст
  var fldErr = function (el, msg) {
    var fld = el.closest && el.closest('.fld');
    if (!fld) return;
    fld.classList.toggle('is-bad', !!msg);
    var box = fld.querySelector('.fld__err');
    if (!msg) { if (box) fld.removeChild(box); return; }
    if (!box) {
      box = document.createElement('span');
      box.className = 'fld__err';
      fld.appendChild(box);
    }
    box.textContent = msg;
  };

  var validate = function (form) {
    var first = null;
    [].forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'hidden') return;
      var msg = '';
      if (el.required && !el.value.trim()) msg = 'Заполните поле';
      else if (el.name === 'phone' && el.value.trim() && digits(el.value).length !== 11) {
        msg = 'Введите номер полностью: код и 10 цифр';
      }
      fldErr(el, msg);
      if (msg && !first) first = el;
    });
    if (first) first.focus();
    return !first;
  };

  var say = function (form, text) {
    var box = form.querySelector('.lead__done');
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
  };

  var send = function (form) {
    var data = collect(form);
    var btn = form.querySelector('.lead__send');

    if (LEAD_ENDPOINT) {
      // настроен приёмник заявок: отправляем данные в фоне
      var payload = {};
      data.forEach(function (f) { payload[f.key] = f.value; });
      btn.disabled = true;
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say(form, 'Заявка отправлена. Мы свяжемся с вами в рабочее время.');
      }).catch(function () {
        say(form, 'Не удалось отправить заявку. Позвоните нам: +7 910 423 82 55');
      }).then(function () {
        btn.disabled = false;
      });
      return;
    }

    // приёмник не настроен: собираем письмо и отдаём почтовой программе
    var subject = 'Заявка с сайта АСЕНА ГРУПП';
    var body = data.map(function (f) { return f.label + ': ' + f.value; }).join('\n');
    window.location.href = 'mailto:' + LEAD_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    say(form, 'Мы открыли письмо в вашей почте — осталось нажать «Отправить». Если письмо не открылось, позвоните: +7 910 423 82 55');
  };

  [].forEach.call(document.querySelectorAll('form.lead'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;
      send(form);
    });
    // подсветка и подпись об ошибке снимаются, как только человек начал вводить
    form.addEventListener('input', function (e) {
      fldErr(e.target, '');
    });
  });
})();
