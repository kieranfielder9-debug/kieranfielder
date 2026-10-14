(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) { toggle.setAttribute('aria-expanded', 'false'); menu.hidden = true; }
  });

  /* ---------- Live metric ticker ---------- */
  document.querySelectorAll('[data-live-counter]').forEach((el) => {
    let value = parseFloat(el.dataset.start);
    const step = parseFloat(el.dataset.step);
    const decimals = parseInt(el.dataset.decimals, 10);
    if (reduceMotion) return;
    setInterval(() => {
      value += step * (0.5 + Math.random());
      el.textContent = value.toFixed(decimals);
    }, 120);
  });

  /* ---------- Logo marquee: duplicate track for a seamless loop ---------- */
  document.querySelectorAll('.marquee').forEach((m) => {
    const track = m.querySelector('.marquee-track');
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    m.appendChild(clone);
  });

  /* ---------- Usage bar chart (edit the data array) ---------- */
  const usage = [4, 8, 15, 22, 31, 45, 28, 32, 12, 8, 33, 29, 41, 51, 42, 75, 100, 52, 40, 27, 33, 36, 31, 48, 59, 64, 75, 54, 40, 34, 39];
  const bars = document.querySelector('[data-bars]');
  if (bars) {
    usage.forEach((v) => {
      const b = document.createElement('span');
      b.dataset.h = v;
      bars.appendChild(b);
    });
  }

  /* ---------- Scroll reveal + one-time animations ---------- */
  const animateBars = (card) => {
    card.querySelectorAll('[data-bars] span').forEach((b, i) => {
      setTimeout(() => { b.style.height = b.dataset.h + '%'; }, reduceMotion ? 0 : i * 25);
    });
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      animateBars(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ---------- Stats count-up ---------- */
  const countUp = (el) => {
    const target = parseFloat(el.dataset.countTo);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const fmt = (n) => prefix + n.toFixed(decimals) + suffix;
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const dur = 1600;
    const frame = (t) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const statsIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      statsIO.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count-to]').forEach((el) => statsIO.observe(el));

  /* ---------- Stats background lines ---------- */
  const svg = document.querySelector('[data-stats-lines]');
  if (svg) {
    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', '0 0 1000 500');
    for (let i = 0; i < 70; i++) {
      const y = 40 + Math.random() * 460;
      const path = document.createElementNS(NS, 'path');
      const cx = 500 + (Math.random() - 0.5) * 400;
      path.setAttribute('d', `M -20 ${480 + Math.random() * 40} Q ${cx} ${y - 120} 1020 ${y}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(255,255,255,' + (0.15 + Math.random() * 0.35) + ')');
      path.setAttribute('stroke-width', '0.8');
      svg.appendChild(path);
    }
    for (let i = 0; i < 40; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', Math.random() * 1000);
      c.setAttribute('cy', 60 + Math.random() * 300);
      c.setAttribute('r', 1 + Math.random() * 1.6);
      c.setAttribute('fill', 'rgba(255,255,255,.8)');
      svg.appendChild(c);
    }
  }

  /* ---------- Dotted globe with animated arcs ---------- */
  const canvas = document.querySelector('[data-globe]');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    // Pseudo-continents: points on a sphere kept where a cheap noise function is high
    const noise = (lat, lon) =>
      Math.sin(lat * 3.1 + 1.3) * Math.cos(lon * 2.2) + Math.sin(lon * 4.7 + lat * 1.9) * 0.6 + Math.cos(lat * 6.3 - lon) * 0.3;
    const pts = [];
    for (let i = 0; i < 20000 && pts.length < 4500; i++) {
      const lat = Math.asin(2 * Math.random() - 1);
      const lon = Math.random() * Math.PI * 2;
      if (noise(lat, lon) > 0.2) pts.push([lat, lon]);
    }
    const arcs = [
      { from: [-0.9, 0.2], to: [0.05, 0.05] },
      { from: [-0.15, -0.55], to: [0.78, -0.25] },
      { from: [0.25, -0.7], to: [0.95, -0.1] },
    ];
    const arcColors = ['#8b7cf6', '#ff5fb7', '#ffb067'];
    let rot = 0;
    let w, h, dpr;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      const R = Math.max(w, h) * 0.62;
      const cx = w * 0.62, cy = h * 0.72;
      for (const [lat, lon] of pts) {
        const l = lon + rot;
        const x = Math.cos(lat) * Math.sin(l);
        const y = Math.sin(lat);
        const z = Math.cos(lat) * Math.cos(l);
        if (z < 0) continue;
        const px = cx + x * R, py = cy - y * R;
        if (px < 0 || px > w || py < 0 || py > h) continue;
        const hue = 270 + (px / w) * 70; // purple -> pink/orange across the globe
        ctx.fillStyle = `hsla(${hue}, 85%, 62%, ${0.25 + z * 0.65})`;
        ctx.fillRect(px, py, 1.6, 1.6);
      }
      // arcs in normalised screen space
      arcs.forEach((a, i) => {
        const x1 = a.from[0] * w * 0.5 + w * 0.5, y1 = h - (a.from[1] + 1) * h * 0.5;
        const x2 = a.to[0] * w * 0.5 + w * 0.5, y2 = h - (a.to[1] + 1) * h * 0.5;
        const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - h * 0.12;
        const p = reduceMotion ? 1 : ((t / 2600 + i * 0.33) % 1);
        ctx.strokeStyle = arcColors[i];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const steps = 60;
        let ex = x1, ey = y1;
        for (let s = 1; s <= steps * Math.min(p * 1.4, 1); s++) {
          const u = s / steps;
          ex = (1 - u) ** 2 * x1 + 2 * (1 - u) * u * mx + u * u * x2;
          ey = (1 - u) ** 2 * y1 + 2 * (1 - u) * u * my + u * u * y2;
          ctx.lineTo(ex, ey);
        }
        ctx.stroke();
        [[x1, y1], [ex, ey]].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = arcColors[i]; ctx.lineWidth = 2; ctx.stroke();
        });
      });
      if (!reduceMotion) { rot += 0.0015; requestAnimationFrame(draw); }
    };
    requestAnimationFrame(draw);
  }

  /* ---------- Feature card modal ---------- */
  const modal = document.getElementById('feature-modal');
  document.querySelectorAll('.feature-card .expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.feature-card');
      modal.querySelector('.modal-title').textContent = card.querySelector('h3').textContent;
      const body = card.querySelector('template.modal-body');
      const content = modal.querySelector('.modal-content');
      content.replaceChildren(body ? body.content.cloneNode(true) : '');
      modal.showModal();
    });
  });
  modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  /* ---------- Back to top ---------- */
  const topBtn = document.querySelector('.back-to-top');
  const onScroll = () => topBtn.classList.toggle('show', window.scrollY > 800);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
