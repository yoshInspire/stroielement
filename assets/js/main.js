/* АСЭНА ГРУПП — интерактив лендинга */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Шапка: фон при скролле ---------- */
  var hdr = document.getElementById('hdr');
  var onScrollHdr = function () {
    hdr.classList.toggle('is-stuck', window.scrollY > 40);
  };
  onScrollHdr();
  window.addEventListener('scroll', onScrollHdr, { passive: true });

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
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
    railx.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // вертикальное колесо сдвигает ленту, пока она не упёрлась в край
    railx.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var max = railx.scrollWidth - railx.clientWidth;
      var cur = railx.scrollLeft;
      // на краю отдаём прокрутку странице
      if ((e.deltaY > 0 && cur >= max - 1) || (e.deltaY < 0 && cur <= 0)) return;
      e.preventDefault();
      railx.scrollLeft = Math.max(0, Math.min(max, cur + e.deltaY));
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
})();
