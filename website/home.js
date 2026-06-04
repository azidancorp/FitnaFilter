/* ============================================================
   FitnaFilter — homepage interactions
   ============================================================ */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Sticky nav state ---- */
    const nav = document.getElementById('nav');
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ---- Scroll reveal ---- */
    const revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window && !reduceMotion) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e, i) => {
                if (e.isIntersecting) {
                    // small stagger for siblings entering together
                    e.target.style.transitionDelay = (Math.min(i, 4) * 70) + 'ms';
                    e.target.classList.add('is-in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealEls.forEach((el) => io.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add('is-in'));
    }

    /* ---- Animated counters ---- */
    const counters = document.querySelectorAll('[data-count]');
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const formatNum = (el, value) => {
        const divide = parseFloat(el.dataset.divide || '1');
        const suffix = el.dataset.suffix || '';
        const shown = Math.round(value / divide);
        el.textContent = shown.toLocaleString() + suffix;
    };
    const runCount = (el) => {
        const target = parseFloat(el.dataset.count);
        if (reduceMotion) { formatNum(el, target); return; }
        const dur = 1500;
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            formatNum(el, target * easeOut(p));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
        const co = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); }
            });
        }, { threshold: 0.6 });
        counters.forEach((el) => co.observe(el));
    } else {
        counters.forEach((el) => formatNum(el, parseFloat(el.dataset.count)));
    }

    /* ---- Hero parallax (subtle) ---- */
    const heroImg = document.getElementById('heroImg');
    if (heroImg && !reduceMotion) {
        let raf = null;
        window.addEventListener('mousemove', (ev) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                const dx = (ev.clientX / window.innerWidth - 0.5) * 12;
                const dy = (ev.clientY / window.innerHeight - 0.5) * 8;
                heroImg.style.transform = `scale(1.04) translate(${-dx}px, ${-dy}px)`;
                raf = null;
            });
        }, { passive: true });
    }

    /* ---- Card spotlight follow ---- */
    if (!reduceMotion) {
        document.querySelectorAll('.card').forEach((card) => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });
    }

    /* ---- Before / After slider ---- */
    const stage = document.getElementById('baStage');
    const before = document.getElementById('baBefore');
    const handle = document.getElementById('baHandle');
    if (stage && before && handle) {
        let dragging = false;
        const setPos = (clientX) => {
            const r = stage.getBoundingClientRect();
            let pct = ((clientX - r.left) / r.width) * 100;
            pct = Math.max(4, Math.min(96, pct));
            before.style.width = pct + '%';
            handle.style.left = pct + '%';
            handle.setAttribute('aria-valuenow', Math.round(pct));
        };
        const start = () => { dragging = true; stage.style.cursor = 'grabbing'; };
        const end = () => { dragging = false; stage.style.cursor = 'ew-resize'; };
        const move = (clientX) => { if (dragging) setPos(clientX); };

        handle.addEventListener('pointerdown', (e) => { start(); handle.setPointerCapture(e.pointerId); });
        stage.addEventListener('pointerdown', (e) => { start(); setPos(e.clientX); });
        window.addEventListener('pointerup', end);
        window.addEventListener('pointermove', (e) => move(e.clientX));

        handle.addEventListener('keydown', (e) => {
            const cur = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
            if (e.key === 'ArrowLeft') { e.preventDefault(); apply(cur - 4); }
            if (e.key === 'ArrowRight') { e.preventDefault(); apply(cur + 4); }
        });
        const apply = (pct) => {
            pct = Math.max(4, Math.min(96, pct));
            before.style.width = pct + '%';
            handle.style.left = pct + '%';
            handle.setAttribute('aria-valuenow', Math.round(pct));
        };

        // gentle auto-demo nudge on first reveal
        if (!reduceMotion && 'IntersectionObserver' in window) {
            const demo = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (!en.isIntersecting) return;
                    demo.unobserve(en.target);
                    let p = 50, dir = -1, frames = 0;
                    const id = setInterval(() => {
                        p += dir * 1.4; frames++;
                        if (p <= 32) dir = 1;
                        if (p >= 50 && frames > 26) { apply(50); clearInterval(id); return; }
                        apply(p);
                    }, 24);
                });
            }, { threshold: 0.5 });
            demo.observe(stage);
        }
    }

    /* ---- Smooth-scroll for in-page anchors (respects reduced motion) ---- */
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (id === '#' || id === '#top') return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
    });

    const scrollToInitialHash = () => {
        if (!window.location.hash || window.location.hash === '#top') return;
        const target = document.querySelector(window.location.hash);
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    };
    window.addEventListener('load', scrollToInitialHash);
    setTimeout(scrollToInitialHash, 100);
})();

/* ============================================================
   OVERBOARD PASS — extra interactions
   ============================================================ */
(function () {
    'use strict';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Scroll progress bar ---- */
    const bar = document.getElementById('scrollbar');
    if (bar) {
        const update = () => {
            const h = document.documentElement;
            const max = h.scrollHeight - h.clientHeight;
            bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
    }

    /* ---- Cursor glow ---- */
    const glow = document.getElementById('cursorGlow');
    if (glow && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
        let gx = 0, gy = 0, raf = null;
        window.addEventListener('mousemove', (e) => {
            gx = e.clientX; gy = e.clientY;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
                raf = null;
            });
        }, { passive: true });
    }

    /* ---- Hero drift chips ---- */
    const drift = document.getElementById('heroDrift');
    if (drift && !reduceMotion) {
        const words = ['casino.bet', 'tracker.ad', 'phish.login', 'malware.host', 'popup.redirect', 'scam.gift', 'miner.js', 'spyware.kit'];
        for (let i = 0; i < 9; i++) {
            const s = document.createElement('span');
            s.className = 'drift';
            s.textContent = words[i % words.length];
            s.style.top = (18 + Math.random() * 68) + '%';
            const dur = 8 + Math.random() * 6;
            s.style.animationDuration = dur + 's';
            s.style.animationDelay = (-Math.random() * dur) + 's';
            drift.appendChild(s);
        }
    }

    /* ---- Portal flowing chips ---- */
    const pIn = document.getElementById('portalIn');
    const pPass = document.getElementById('portalPass');
    const pOut = document.getElementById('portalOut');
    const spawnChips = (host, count, categories = []) => {
        if (!host || reduceMotion) return;
        for (let i = 0; i < count; i++) {
            const c = document.createElement('span');
            const category = categories[i % categories.length];
            c.className = 'portal__chip' + (category ? ' portal__chip--' + category : '');
            c.style.top = (18 + Math.random() * 64) + '%';
            const dur = 3.4 + Math.random() * 2.6;
            c.style.animationDuration = dur + 's';
            c.style.animationDelay = (-Math.random() * dur) + 's';
            host.appendChild(c);
        }
    };
    spawnChips(pIn, 9, ['vice', 'hazard', 'distraction']);
    spawnChips(pPass, 5, ['safe-green', 'safe-purple']);
    spawnChips(pOut, 7);

    /* ---- Ayah reminder rail ---- */
    const ayahTrack = document.getElementById('ayahTrack');
    if (ayahTrack) {
        const ayahGroup = ayahTrack.querySelector('.ayah-group');
        if (ayahGroup) {
            const clone = ayahGroup.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            ayahTrack.appendChild(clone);
        }
        if (reduceMotion) ayahTrack.classList.add('is-still');
    }

    /* ---- Copy command buttons ---- */
    const copyWithTextarea = (text) => {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
        const copied = document.execCommand('copy');
        input.remove();
        return copied;
    };
    document.querySelectorAll('[data-copy-command]').forEach((button) => {
        const label = button.querySelector('span');
        const originalLabel = label ? label.textContent : '';
        button.addEventListener('click', async () => {
            const command = button.dataset.copyCommand || '';
            try {
                let copied = false;
                if (navigator.clipboard && window.isSecureContext) {
                    try {
                        await navigator.clipboard.writeText(command);
                        copied = true;
                    } catch {
                        copied = false;
                    }
                }
                if (!copied) copied = copyWithTextarea(command);
                if (!copied) throw new Error('Copy failed');
                button.classList.add('is-copied');
                if (label) label.textContent = 'Copied';
                window.setTimeout(() => {
                    button.classList.remove('is-copied');
                    if (label) label.textContent = originalLabel;
                }, 1600);
            } catch {
                if (label) label.textContent = 'Retry';
            }
        });
    });

    /* ---- Live playground ---- */
    const grid = document.getElementById('pgGrid');
    if (grid) {
        const variants = ['a', 'b', 'c'];
        // spice = likelihood of being flagged (higher = flagged sooner)
        const spices = [9, 2, 7, 4, 8, 1, 6, 3, 5];
        const tiles = spices.map((spice, i) => {
            const t = document.createElement('div');
            t.className = 'pgtile pgtile--' + variants[i % 3];
            t.dataset.spice = spice;
            t.innerHTML =
                '<div class="pgtile__img"></div>' +
                '<span class="pgtile__bar"></span>' +
                '<span class="pgtile__tag">flagged</span>' +
                '<div class="pgtile__cover"></div>';
            grid.appendChild(t);
            return t;
        });

        const sensVal = document.getElementById('pgSens');
        const sensLabel = document.getElementById('pgSensVal');
        const hint = document.getElementById('pgHint');
        const labels = { 1: 'Relaxed', 2: 'Balanced', 3: 'Strict' };
        const flaggedByLevel = { 1: 2, 2: 4, 3: 6 };

        const applySensitivity = (level) => {
            const count = flaggedByLevel[level];
            // rank tiles by spice, flag the top `count`
            const ranked = [...tiles].sort((a, b) => b.dataset.spice - a.dataset.spice);
            tiles.forEach((t) => { t.classList.remove('pgtile--flag', 'is-revealed'); });
            ranked.slice(0, count).forEach((t) => t.classList.add('pgtile--flag'));
            grid.className = 'pg__grid level-' + level + (grid.classList.contains('is-protected') ? ' is-protected' : '');
            if (sensLabel) sensLabel.textContent = labels[level];
            updateHint();
        };
        const updateHint = () => {
            const flagged = grid.querySelectorAll('.pgtile--flag').length;
            const on = grid.classList.contains('is-protected');
            if (hint) hint.textContent = on
                ? flagged + ' of 9 images flagged · click a covered tile to reveal'
                : 'protection off · all images shown raw';
        };

        // init
        const startLevel = parseInt(sensVal ? sensVal.value : '2', 10);
        grid.classList.add('is-protected');
        applySensitivity(startLevel);

        if (sensVal) sensVal.addEventListener('input', () => applySensitivity(parseInt(sensVal.value, 10)));

        // protection toggle
        const toggle = document.getElementById('pgToggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const on = toggle.classList.toggle('is-on');
                toggle.setAttribute('aria-checked', on ? 'true' : 'false');
                toggle.querySelector('.toggle__state').textContent = on ? 'ON' : 'OFF';
                grid.classList.toggle('is-protected', on);
                tiles.forEach((t) => t.classList.remove('is-revealed'));
                updateHint();
            });
        }

        // swatches
        const swatches = document.getElementById('pgSwatches');
        if (swatches) {
            swatches.addEventListener('click', (e) => {
                const b = e.target.closest('.swatch');
                if (!b) return;
                swatches.querySelectorAll('.swatch').forEach((s) => s.classList.remove('is-sel'));
                b.classList.add('is-sel');
                grid.style.setProperty('--filter-paint', b.dataset.paint);
            });
        }

        // click-to-reveal
        grid.addEventListener('click', (e) => {
            const tile = e.target.closest('.pgtile');
            if (!tile || !tile.classList.contains('pgtile--flag')) return;
            if (!grid.classList.contains('is-protected')) return;
            tile.classList.toggle('is-revealed');
        });
    }
})();
