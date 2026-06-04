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

/* ---- Content tessellation background ---- */
(function () {
    'use strict';

    const canvas = document.getElementById('contentPattern');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const baseRgb = [178, 112, 255];
    const hotRgb = [224, 178, 255];
    const dotRgb = [198, 118, 255];
    const mouse = { x: -9999, y: -9999 };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let tile = 112;
    let basePath = null;
    let nodeX = new Float32Array();
    let nodeY = new Float32Array();
    let edgeA = new Int32Array();
    let edgeB = new Int32Array();
    let edgeLen = new Float32Array();
    let nodeEdges = [];
    let dots = [];
    let last = performance.now();

    // Build the 8-point star from two crossing squares, split at intersections.
    function tileSegments() {
        const r = tile / 2;
        const d = r * Math.SQRT1_2;
        const a = [[r, 0], [0, r], [-r, 0], [0, -r]];
        const b = [[d, d], [-d, d], [-d, -d], [d, -d]];
        const edgesA = [[a[0], a[1]], [a[1], a[2]], [a[2], a[3]], [a[3], a[0]]];
        const edgesB = [[b[0], b[1]], [b[1], b[2]], [b[2], b[3]], [b[3], b[0]]];
        const segs = [];
        splitGroup(edgesA, edgesB, segs);
        splitGroup(edgesB, edgesA, segs);
        return segs;
    }

    function splitGroup(group, others, out) {
        for (const [p, q] of group) {
            const ts = [0, 1];
            for (const [r, s] of others) {
                const t = segParam(p, q, r, s);
                if (t !== null) ts.push(t);
            }
            ts.sort((a, b) => a - b);
            for (let i = 0; i < ts.length - 1; i++) {
                if (ts[i + 1] - ts[i] > 1e-6) {
                    out.push([lerp(p, q, ts[i]), lerp(p, q, ts[i + 1])]);
                }
            }
        }
    }

    function lerp(p, q, t) {
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    }

    function segParam(p, q, r, s) {
        const dx1 = q[0] - p[0];
        const dy1 = q[1] - p[1];
        const dx2 = s[0] - r[0];
        const dy2 = s[1] - r[1];
        const den = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(den) < 1e-9) return null;

        const t = ((r[0] - p[0]) * dy2 - (r[1] - p[1]) * dx2) / den;
        const u = ((r[0] - p[0]) * dy1 - (r[1] - p[1]) * dx1) / den;
        return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? t : null;
    }

    function buildGraph() {
        const local = tileSegments();
        const nodeMap = new Map();
        const xs = [];
        const ys = [];
        const ea = [];
        const eb = [];
        const edgeSet = new Set();
        const cols = Math.ceil(w / tile) + 2;
        const rows = Math.ceil(h / tile) + 2;

        const key = (x, y) => Math.round(x * 2) + '_' + Math.round(y * 2);
        const nodeId = (x, y) => {
            const k = key(x, y);
            let id = nodeMap.get(k);
            if (id === undefined) {
                id = xs.length;
                xs.push(x);
                ys.push(y);
                nodeMap.set(k, id);
            }
            return id;
        };

        for (let row = -1; row < rows; row++) {
            for (let col = -1; col < cols; col++) {
                const cx = col * tile + tile / 2;
                const cy = row * tile + tile / 2;
                for (const [p, q] of local) {
                    const a = nodeId(cx + p[0], cy + p[1]);
                    const b = nodeId(cx + q[0], cy + q[1]);
                    if (a === b) continue;

                    const edgeKey = a < b ? a + '_' + b : b + '_' + a;
                    if (edgeSet.has(edgeKey)) continue;
                    edgeSet.add(edgeKey);
                    ea.push(a);
                    eb.push(b);
                }
            }
        }

        nodeX = Float32Array.from(xs);
        nodeY = Float32Array.from(ys);
        edgeA = Int32Array.from(ea);
        edgeB = Int32Array.from(eb);
        edgeLen = new Float32Array(ea.length);
        nodeEdges = Array.from({ length: xs.length }, () => []);
        basePath = new Path2D();

        for (let e = 0; e < ea.length; e++) {
            const a = ea[e];
            const b = eb[e];
            edgeLen[e] = Math.hypot(nodeX[a] - nodeX[b], nodeY[a] - nodeY[b]) || 1;
            nodeEdges[a].push(e);
            nodeEdges[b].push(e);
            basePath.moveTo(nodeX[a], nodeY[a]);
            basePath.lineTo(nodeX[b], nodeY[b]);
        }

        spawnDots();
    }

    function spawnDots() {
        dots = [];
        if (!edgeA.length || reduceMotion) return;

        const count = w < 700 ? 18 : 44;
        for (let i = 0; i < count; i++) {
            const edge = (Math.random() * edgeA.length) | 0;
            dots.push({
                edge,
                from: Math.random() < 0.5 ? edgeA[edge] : edgeB[edge],
                t: Math.random(),
                speed: 10 + Math.random() * 34,
                hist: []
            });
        }
    }

    function advanceDot(dot, dt) {
        let move = dot.speed * dt;
        let guard = 0;
        while (move > 0 && guard++ < 8) {
            const edge = dot.edge;
            const to = edgeA[edge] === dot.from ? edgeB[edge] : edgeA[edge];
            const remain = (1 - dot.t) * edgeLen[edge];
            if (move < remain) {
                dot.t += move / edgeLen[edge];
                break;
            }

            move -= remain;
            const opts = nodeEdges[to];
            let next = edge;
            if (opts.length > 1) {
                let tries = 0;
                do {
                    next = opts[(Math.random() * opts.length) | 0];
                } while (next === edge && ++tries < 6);
            }
            dot.edge = next;
            dot.from = to;
            dot.t = 0;
        }
    }

    function distToEdge(edge, px, py) {
        const ax = nodeX[edgeA[edge]];
        const ay = nodeY[edgeA[edge]];
        const bx = nodeX[edgeB[edge]];
        const by = nodeY[edgeB[edge]];
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    }

    function draw(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!basePath) return;

        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${baseRgb[0]},${baseRgb[1]},${baseRgb[2]},0.28)`;
        ctx.stroke(basePath);

        if (!reduceMotion) {
            const mouseRadius = 190;
            ctx.lineCap = 'round';
            for (let e = 0; e < edgeA.length; e++) {
                const a = edgeA[e];
                const b = edgeB[e];
                const mx = (nodeX[a] + nodeX[b]) * 0.5;
                const my = (nodeY[a] + nodeY[b]) * 0.5;
                if (Math.abs(mx - mouse.x) > mouseRadius || Math.abs(my - mouse.y) > mouseRadius) continue;

                const dist = distToEdge(e, mouse.x, mouse.y);
                if (dist > mouseRadius) continue;

                const glow = Math.pow(1 - dist / mouseRadius, 2);
                const cr = baseRgb[0] + (hotRgb[0] - baseRgb[0]) * glow;
                const cg = baseRgb[1] + (hotRgb[1] - baseRgb[1]) * glow;
                const cb = baseRgb[2] + (hotRgb[2] - baseRgb[2]) * glow;
                ctx.strokeStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${0.28 + 0.5 * glow})`;
                ctx.lineWidth = 1 + 1.2 * glow;
                ctx.beginPath();
                ctx.moveTo(nodeX[a], nodeY[a]);
                ctx.lineTo(nodeX[b], nodeY[b]);
                ctx.stroke();
            }

            ctx.globalCompositeOperation = 'lighter';
            for (const dot of dots) {
                advanceDot(dot, dt);
                drawDot(dot);
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        if (!reduceMotion) requestAnimationFrame(draw);
    }

    function drawDot(dot) {
        const edge = dot.edge;
        const fromX = nodeX[dot.from];
        const fromY = nodeY[dot.from];
        const to = edgeA[edge] === dot.from ? edgeB[edge] : edgeA[edge];
        const x = fromX + (nodeX[to] - fromX) * dot.t;
        const y = fromY + (nodeY[to] - fromY) * dot.t;
        const hist = dot.hist;

        hist.push(x, y);
        let total = 0;
        for (let i = hist.length - 2; i >= 2; i -= 2) {
            total += Math.hypot(hist[i] - hist[i - 2], hist[i + 1] - hist[i - 1]);
            if (total > 86) {
                hist.splice(0, i - 2);
                break;
            }
        }

        const n = hist.length / 2;
        if (n > 2) {
            let prevMx = hist[0];
            let prevMy = hist[1];
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            for (let i = 1; i < n; i++) {
                const cx = hist[i * 2];
                const cy = hist[i * 2 + 1];
                const mx = i < n - 1 ? (cx + hist[(i + 1) * 2]) * 0.5 : x;
                const my = i < n - 1 ? (cy + hist[(i + 1) * 2 + 1]) * 0.5 : y;
                const fade = i / (n - 1);
                ctx.strokeStyle = `rgba(${dotRgb[0]},${dotRgb[1]},${dotRgb[2]},${(0.58 * fade * fade).toFixed(3)})`;
                ctx.lineWidth = 0.5 + 1.3 * fade;
                ctx.beginPath();
                ctx.moveTo(prevMx, prevMy);
                ctx.quadraticCurveTo(cx, cy, mx, my);
                ctx.stroke();
                prevMx = mx;
                prevMy = my;
            }
        }

        ctx.shadowBlur = 9;
        ctx.shadowColor = `rgba(${dotRgb[0]},${dotRgb[1]},${dotRgb[2]},0.92)`;
        ctx.fillStyle = `rgba(${dotRgb[0]},${dotRgb[1]},${dotRgb[2]},0.92)`;
        ctx.beginPath();
        ctx.arc(x, y, 1.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        tile = w < 700 ? 88 : 112;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        buildGraph();
        if (reduceMotion) draw(performance.now());
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
        mouse.x = -9999;
        mouse.y = -9999;
    });

    resize();
    if (!reduceMotion) requestAnimationFrame(draw);
})();
