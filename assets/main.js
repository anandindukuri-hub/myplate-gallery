(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const GROUP = { fruit: 'Fruits', veg: 'Vegetables', grain: 'Grains', protein: 'Protein', dairy: 'Dairy', extra: 'Extras' };
  const hasIO = 'IntersectionObserver' in window;

  // fade sections in as they scroll into view
  const reveals = document.querySelectorAll('.reveal');
  if (hasIO) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // highlight the room you're in
  const nav = document.querySelector('.rooms-nav');
  const links = [...document.querySelectorAll('.rooms-nav a')];
  if (hasIO && nav) {
    const watch = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => {
          const on = !!e.target.id && a.getAttribute('href') === '#' + e.target.id;
          if (on) {
            a.setAttribute('aria-current', 'location');
            if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
          } else {
            a.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id], main > section.hero').forEach((s) => watch.observe(s));
  }

  // each room: dots on the photo, the reader card, and sorting onto the plate
  document.querySelectorAll('.exhibit').forEach((ex) => {
    const room = ex.dataset.room;
    const photo = ex.querySelector('.photo');
    const svg = ex.querySelector('.plate svg');
    const btn = ex.querySelector('.sort');
    const btnText = btn.querySelector('span');
    const tally = ex.querySelector('.tally');
    const reader = ex.querySelector('.reader');
    const dots = [...ex.querySelectorAll('.dot')];
    const cuts = [...ex.querySelectorAll('.cut')];
    const items = [...document.querySelectorAll(`.key[data-room="${room}"] li[data-n]`)];

    const slots = {};
    svg.querySelectorAll('.slot').forEach((s) => (slots[s.dataset.g] = slots[s.dataset.g] || []).push(s));
    const taken = {};
    cuts.forEach((c) => {
      const g = c.dataset.g;
      taken[g] = taken[g] || 0;
      c._slot = slots[g][taken[g]++];
    });

    let sorted = false;

    // where each cutout starts (over its dish) and where it lands (its slot on the plate)
    const place = () => {
      const box = ex.getBoundingClientRect();
      const pic = photo.getBoundingClientRect();
      const m = svg.getScreenCTM();
      if (!m) return;
      cuts.forEach((c) => {
        const [bx, by, bw] = c.dataset.box.split(',').map(Number);
        const x = pic.left - box.left + (bx / 100) * pic.width;
        const y = pic.top - box.top + (by / 100) * pic.height;
        const size = (bw / 100) * pic.width;
        c.style.left = x + 'px';
        c.style.top = y + 'px';
        c.style.width = size + 'px';
        c.style.height = size + 'px';
        const pt = svg.createSVGPoint();
        pt.x = +c._slot.getAttribute('cx');
        pt.y = +c._slot.getAttribute('cy');
        const p = pt.matrixTransform(m);
        const d = 2 * c._slot.getAttribute('r') * m.a;
        const k = d / size;
        c._to = `translate(${(p.x - box.left - d / 2 - x).toFixed(1)}px, ${(p.y - box.top - d / 2 - y).toFixed(1)}px) scale(${k.toFixed(4)})`;
        c.style.setProperty('--ring', (2.5 / k).toFixed(2) + 'px');
      });
    };

    const sort = (on) => {
      sorted = on;
      place();
      ex.classList.toggle('sorted', on);
      btnText.textContent = on ? 'Put it back on the table' : 'Sort onto MyPlate';
      tally.hidden = !on;
      const step = reduce.matches ? 0 : 55;
      const land = reduce.matches ? 0 : 950;
      cuts.forEach((c, i) => {
        const wait = i * step;
        c.style.transitionDelay = on ? `${wait}ms, 0ms, 0ms` : `${wait}ms, ${wait + land}ms, 0ms`;
        c.style.transform = on ? c._to : '';
      });
    };
    btn.addEventListener('click', () => sort(!sorted));

    let frame;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        ex.classList.add('still');
        place();
        if (sorted) cuts.forEach((c) => (c.style.transform = c._to));
        requestAnimationFrame(() => requestAnimationFrame(() => ex.classList.remove('still')));
      });
    };
    if ('ResizeObserver' in window) new ResizeObserver(refit).observe(ex);
    else window.addEventListener('resize', refit);
    if (document.fonts) document.fonts.ready.then(refit);

    const mark = (n, cls, on) => {
      dots.forEach((d) => d.dataset.n === n && d.classList.toggle(cls, on));
      items.forEach((li) => li.dataset.n === n && li.classList.toggle(cls, on));
    };
    const show = (n) => {
      const dot = dots.find((d) => d.dataset.n === n);
      const li = items.find((x) => x.dataset.n === n);
      if (!dot || !li) return;
      reader.classList.add('has');
      reader.dataset.g = dot.dataset.g;
      reader.querySelector('.r-num').textContent = n;
      reader.querySelector('.r-name').innerHTML =
        li.querySelector('.kt').innerHTML + `<span class="r-group">${GROUP[dot.dataset.g]}</span>`;
      reader.querySelector('.r-desc').textContent = li.querySelector('.kd').textContent;
    };

    let picked = null;
    dots.forEach((d) => {
      const n = d.dataset.n;
      d.addEventListener('mouseenter', () => { mark(n, 'hi', true); show(n); });
      d.addEventListener('mouseleave', () => { mark(n, 'hi', false); if (picked) show(picked); });
      d.addEventListener('focus', () => { mark(n, 'hi', true); show(n); });
      d.addEventListener('blur', () => mark(n, 'hi', false));
      d.addEventListener('click', () => {
        if (picked) mark(picked, 'picked', false);
        picked = picked === n ? null : n;
        if (picked) { mark(n, 'picked', true); show(n); }
      });
    });
    items.forEach((li) => {
      const n = li.dataset.n;
      li.addEventListener('mouseenter', () => mark(n, 'hi', true));
      li.addEventListener('mouseleave', () => mark(n, 'hi', false));
    });
  });

  // the composite plate: filter by kitchen, and point at a food from the list
  const comp = document.querySelector('.comp');
  if (comp) {
    const buttons = [...comp.querySelectorAll('.filters button')];
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      comp.dataset.show = b.dataset.c;
    }));
    comp.querySelectorAll('.grp li[data-id]').forEach((li) => {
      const food = comp.querySelector(`.cf[data-id="${li.dataset.id}"]`);
      if (!food) return;
      li.addEventListener('mouseenter', () => { food.classList.add('hi'); comp.classList.add('hovering'); });
      li.addEventListener('mouseleave', () => { food.classList.remove('hi'); comp.classList.remove('hovering'); });
    });
  }
})();
