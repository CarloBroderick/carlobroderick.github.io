/* Embroidery Loader — dependency-free Canvas 2D component.
 * Carlo's copy (from embroidery_backgrounds_and_loader.zip, 2026-11-02) with three small additions: options.transparent
 * (no linen painted, so the page shows through), options.ringSize (ring scale in CSS px, number or fn(w,h), instead of
 * the canvas's shorter side), and no linen texture download when transparent. The StitchLoader wrapper is at the end.
 * Assets and motion values come from assets/manifest.json.
 * Exposes window.EmbroideryLoader; see COMPONENT.md for integration.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const MOTION = Object.freeze({
    ids: Object.freeze([1, 2, 3, 4, 8, 9, 15, 20]),
    loopSeconds: 8,
    exitSeconds: 5.5,
    accelerationSeconds: 0.85,
    exitRevolutionSeconds: 2.8,
    radiusFraction: 0.19,
    spriteBoxFraction: 0.095
  });
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const smoothstep = (s) => s * s * (3 - 2 * s);
  const positiveModulo = (value, modulus) => (value % modulus + modulus) % modulus;

  /** Pure motion sampler, shared by live rendering and deterministic exports. */
  function sampleMotion(width, height, loopSeconds, exitSeconds, capturedPhase, ringBasis) {
    const size = ringBasis || Math.min(width, height);
    const box = MOTION.spriteBoxFraction * size;
    const omega0 = TAU / MOTION.loopSeconds;
    const omega1 = TAU / MOTION.exitRevolutionSeconds;
    const exiting = exitSeconds !== null && exitSeconds !== undefined;
    const t = exiting ? Math.max(0, exitSeconds) : Math.max(0, loopSeconds);
    const progress = exiting ? clamp(t / MOTION.exitSeconds, 0, 1) : 0;
    const radius = MOTION.radiusFraction * size;
    const u = clamp(t / MOTION.accelerationSeconds, 0, 1);
    const integratedRamp = t < MOTION.accelerationSeconds
      ? MOTION.accelerationSeconds * (u ** 3 - 0.5 * u ** 4)
      : t - MOTION.accelerationSeconds / 2;
    const angularTravel = exiting
      ? omega0 * t + (omega1 - omega0) * integratedRamp : omega0 * t;
    const angularSpeed = exiting
      ? omega0 + (omega1 - omega0) * smoothstep(u) : omega0;
    const phase = exiting ? capturedPhase + angularTravel : angularTravel;
    return {
      width, height, radius, spriteBox: box, phase, progress, angularTravel, angularSpeed,
      poses: MOTION.ids.map((id, index) => {
        const alpha = (exiting ? capturedPhase : 0) + TAU * index / MOTION.ids.length;
        const theta = -Math.PI / 2 + alpha + angularTravel;
        let distanceToGate = positiveModulo(-alpha, TAU);
        if (distanceToGate < 1e-9 || TAU - distanceToGate < 1e-9) distanceToGate = 0;
        const onProcession = exiting && angularTravel >= distanceToGate;
        let x = width / 2 + Math.cos(theta) * radius;
        let y = height / 2 + Math.sin(theta) * radius;
        let pathDistance = 0;
        if (onProcession) {
          // Every figure passes the same top gate and follows the same path.
          // The tangent and speed agree with the orbit at the join.
          const a = angularTravel - distanceToGate;
          pathDistance = radius * a + 0.004 * width * a ** 3;
          const q = clamp(pathDistance / (2 * radius), 0, 1);
          const f = 2 * q ** 2 + 4 * q ** 3 - 9 * q ** 4 + 4 * q ** 5;
          x = width / 2 + pathDistance;
          y = height / 2 - radius + radius * f;
        }
        return {
          id,
          x, y,
          rotation: 0,
          size: box,
          theta,
          route: onProcession ? 'procession' : 'ring',
          distanceToGate,
          pathDistance
        };
      })
    };
  }

  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('An embroidery image could not be loaded.'));
      img.src = src;
    });
  }

  class EmbroideryLoader {
    constructor(canvas, options) {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError('EmbroideryLoader needs a canvas element.');
      }
      this.canvas = canvas;
      this.options = options || {};
      this.manifest = this.options.manifest;
      if (!this.manifest || !Array.isArray(this.manifest.characters)) {
        throw new TypeError('Pass the supplied manifest in the options.');
      }
      this._transparent = Boolean(this.options.transparent);
      this.context = canvas.getContext('2d', { alpha: this._transparent });
      if (!this.context) throw new Error('This browser does not support Canvas 2D.');
      this._now = this.options.now || (() => performance.now());
      this._destroyed = false;
      this._ready = false;
      this._raf = 0;
      this._mode = this.options.mode === 'wallpaper' ? 'wallpaper' : 'loading';
      this._images = new Map();
      this._texture = null;
      this._pattern = null;
      this._patternScale = -1;
      this._visibleHeight = Number(this.options.characterSize) || 72;
      this._loopStart = this._now();
      this._phaseOffset = 0;
      this._exitStart = 0;
      this._exitPhase = 0;
      this._completionPromise = null;
      this._resolveCompletion = null;
      this._queuedCompletion = null;
      this._media = global.matchMedia('(prefers-reduced-motion: reduce)');
      this._reducedMotion = this.options.reducedMotion === undefined
        ? this._media.matches : Boolean(this.options.reducedMotion);
      this._exitReducedMotion = this._reducedMotion;
      this._onResize = () => {
        if (this._destroyed) return;
        this._measure();
        this._render(this._now());
      };
      this._onMotionPreference = () => {
        if (this._destroyed || this.options.reducedMotion !== undefined) return;
        const now = this._now();
        const phase = this._phaseAt(now);
        this._reducedMotion = this._media.matches;
        this._phaseOffset = phase;
        this._loopStart = now;
        if (this._mode === 'exiting' && this._reducedMotion) this._finish();
        this._cancelFrame();
        this._render(now);
        this._requestFrame();
      };
      this._tick = () => {
        this._raf = 0;
        if (this._destroyed) return;
        if ((global.devicePixelRatio || 1) !== this._dpr) this._measure();
        this._render(this._now());
        this._requestFrame();
      };
      global.addEventListener('resize', this._onResize, { passive: true });
      if (global.visualViewport) global.visualViewport.addEventListener('resize', this._onResize, { passive: true });
      if (this._media.addEventListener) this._media.addEventListener('change', this._onMotionPreference);
      else this._media.addListener(this._onMotionPreference);
      if (global.ResizeObserver) {
        this._observer = new ResizeObserver(this._onResize);
        this._observer.observe(canvas);
      }
      this._measure();
      this._render(this._now());

      const supplied = this.options.imageSources || {};
      const resolvePath = (path) => this.options.assetBase
        ? new URL(path, this.options.assetBase).href : path;
      const imageTasks = this.manifest.characters.map((character) =>
        imageFrom(supplied[character.id] || resolvePath(character.path))
          .then((img) => this._images.set(character.id, img))
      );
      if (!this._transparent) imageTasks.push(imageFrom(this.options.textureSource || resolvePath(this.manifest.linen.path))
        .then((img) => { this._texture = img; }));
      this.ready = Promise.all(imageTasks).then(() => {
        if (this._destroyed) return this;
        this._ready = true;
        this._loopStart = this._now();
        this._render(this._loopStart);
        this._requestFrame();
        this._emit('ready', { mode: this._mode });
        return this;
      }).catch((error) => {
        this._emit('error', { error });
        throw error;
      });
    }

    get mode() { return this._mode; }
    get reducedMotion() { return this._reducedMotion; }

    _emit(type, detail) {
      this.canvas.dispatchEvent(new CustomEvent('embroidery:' + type, {
        bubbles: true,
        detail: Object.assign({ loader: this }, detail || {})
      }));
    }

    _measure() {
      const rect = this.canvas.getBoundingClientRect();
      this._width = Math.max(1, rect.width);
      this._height = Math.max(1, rect.height);
      this._dpr = global.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(this._width * this._dpr));
      const height = Math.max(1, Math.round(this._height * this._dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this._pattern = null;
      }
    }

    _phaseAt(now) {
      return this._phaseOffset + (this._reducedMotion ? 0 :
        (now - this._loopStart) / 1000 * TAU / MOTION.loopSeconds);
    }

    _requestFrame() {
      if (this._destroyed || !this._ready || this._raf) return;
      if (this._mode === 'exiting' || (this._mode === 'loading' && !this._reducedMotion)) {
        this._raf = global.requestAnimationFrame(this._tick);
      }
    }

    _cancelFrame() {
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    _paintLinen() {
      const ctx = this.context;
      ctx.globalAlpha = 1;
      if (this._transparent) { ctx.clearRect(0, 0, this._width, this._height); return; }
      ctx.fillStyle = '#f1ecdf';
      ctx.fillRect(0, 0, this._width, this._height);
      if (!this._texture) return;
      const cell = this._visibleHeight / this.manifest.figureVisibleHeightFraction;
      const scale = this._mode === 'wallpaper'
        ? cell / this.manifest.cell
        : Math.min(this._width, this._height) / 2160;
      if (!this._pattern || scale !== this._patternScale) {
        this._pattern = ctx.createPattern(this._texture, 'repeat');
        this._patternScale = scale;
        if (this._pattern && this._pattern.setTransform) {
          this._pattern.setTransform(new DOMMatrix().scale(scale));
        }
      }
      if (this._pattern && this._pattern.setTransform) {
        ctx.fillStyle = this._pattern;
        ctx.fillRect(0, 0, this._width, this._height);
      } else {
        const width = this._texture.width * scale;
        const height = this._texture.height * scale;
        for (let y = 0; y < this._height; y += height) {
          for (let x = 0; x < this._width; x += width) ctx.drawImage(this._texture, x, y, width, height);
        }
      }
    }

    _drawCharacter(id, x, y, box, rotation) {
      const image = this._images.get(id);
      if (!image) return;
      const ctx = this.context;
      ctx.save();
      ctx.translate(x, y);
      if (rotation) ctx.rotate(rotation);
      ctx.drawImage(image, -box / 2, -box / 2, box, box);
      ctx.restore();
    }

    _drawWallpaper() {
      const layout = this._wallpaperLayout();
      const order = this.manifest.patternOrder;
      const patternColumns = this.manifest.patternColumns;
      const patternRows = this.manifest.patternRows;
      const box = this._visibleHeight * this.manifest.spriteSize / this.manifest.spriteVisibleMaximum;
      for (let row = 0; row < layout.rows; row++) {
        for (let column = 0; column < layout.columns; column++) {
          const index = (row % patternRows) * patternColumns + column % patternColumns;
          this._drawCharacter(order[index], (column + 0.5) * layout.cell,
            (row + 0.5) * layout.cell, box, 0);
        }
      }
    }

    _wallpaperLayout() {
      const cell = this._visibleHeight / this.manifest.figureVisibleHeightFraction;
      return { cell, columns: Math.ceil(this._width / cell), rows: Math.ceil(this._height / cell),
        visibleCharacterHeight: this._visibleHeight };
    }

    _basis() {
      const r = this.options.ringSize;
      const v = typeof r === 'function' ? r(this._width, this._height) : r;
      return Number(v) > 0 ? Number(v) : 0;
    }

    _frameAt(now) {
      if (this._mode === 'exiting') {
        const elapsed = Math.max(0, (now - this._exitStart) / 1000);
        if (this._exitReducedMotion) {
          const frame = sampleMotion(this._width, this._height, this._exitPhase * MOTION.loopSeconds / TAU, null, 0, this._basis());
          frame.opacity = 1 - smoothstep(clamp(elapsed / 0.18, 0, 1));
          frame.done = elapsed >= 0.18;
          return frame;
        }
        const frame = sampleMotion(this._width, this._height, 0, elapsed, this._exitPhase, this._basis());
        frame.opacity = 1;
        frame.done = elapsed >= MOTION.exitSeconds;
        return frame;
      }
      const phase = this._phaseAt(now);
      const frame = sampleMotion(this._width, this._height, phase * MOTION.loopSeconds / TAU, null, 0, this._basis());
      frame.opacity = 1;
      frame.done = false;
      return frame;
    }

    _render(now) {
      if (this._destroyed) return;
      const ctx = this.context;
      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      this._paintLinen();
      if (!this._ready || this._mode === 'finished') return;
      if (this._mode === 'wallpaper') {
        this._drawWallpaper();
        return;
      }
      const frame = this._frameAt(now);
      if (frame.done) {
        this._finish();
        return;
      }
      ctx.globalAlpha = frame.opacity;
      for (const pose of frame.poses) this._drawCharacter(pose.id, pose.x, pose.y, pose.size, pose.rotation);
      ctx.globalAlpha = 1;
    }

    _cancelCompletion(reason) {
      if (this._resolveCompletion) this._resolveCompletion({ completed: false, reason });
      this._resolveCompletion = null;
      this._completionPromise = null;
      this._queuedCompletion = null;
    }

    _finish() {
      if (this._mode !== 'exiting') return;
      this._mode = 'finished';
      this._cancelFrame();
      const detail = { completed: true };
      if (this._resolveCompletion) this._resolveCompletion(detail);
      this._resolveCompletion = null;
      this._emit('statechange', { mode: this._mode });
      this._emit('complete', detail);
      if (typeof this.options.onComplete === 'function') this.options.onComplete(this);
    }

    /** Immediately unspool the current ring into one procession off the right edge. */
    complete() {
      if (this._destroyed) return Promise.resolve({ completed: false, reason: 'destroyed' });
      if (!this._ready) {
        if (!this._queuedCompletion) this._queuedCompletion = this.ready.then(() => this.complete());
        return this._queuedCompletion;
      }
      if (this._mode === 'finished') return this._completionPromise || Promise.resolve({ completed: true });
      if (this._mode === 'exiting') return this._completionPromise;
      if (this._mode !== 'loading') return Promise.resolve({ completed: false, reason: 'not-loading' });
      const now = this._now();
      this._exitPhase = this._phaseAt(now);
      this._exitStart = now;
      this._exitReducedMotion = this._reducedMotion;
      this._mode = 'exiting';
      this._completionPromise = new Promise((resolve) => { this._resolveCompletion = resolve; });
      this._render(now);
      this._requestFrame();
      this._emit('statechange', { mode: this._mode });
      return this._completionPromise;
    }

    /** Restart at the beginning of the loading loop. */
    restart() {
      if (this._destroyed) return this;
      this._cancelCompletion('restarted');
      this._cancelFrame();
      this._mode = 'loading';
      this._loopStart = this._now();
      this._phaseOffset = 0;
      this._render(this._loopStart);
      this._requestFrame();
      this._emit('statechange', { mode: this._mode });
      return this;
    }

    showWallpaper() {
      if (this._destroyed) return this;
      this._cancelCompletion('wallpaper');
      this._cancelFrame();
      this._mode = 'wallpaper';
      this._render(this._now());
      this._emit('statechange', { mode: this._mode });
      return this;
    }

    /** Set visible wallpaper figure height in CSS pixels; viewport size stays independent. */
    setCharacterSize(pixels) {
      const number = Number(pixels);
      if (!Number.isFinite(number)) throw new TypeError('Character size must be a finite number.');
      this._visibleHeight = clamp(number, 24, 180);
      this._pattern = null;
      if (this._mode === 'wallpaper') this._render(this._now());
      return this;
    }

    /** Read-only geometry snapshot, useful for integration or deterministic checks. */
    getSnapshot(now) {
      const time = now === undefined ? this._now() : now;
      const snapshot = { mode: this._mode, width: this._width, height: this._height,
        devicePixelRatio: this._dpr, reducedMotion: this._reducedMotion };
      if (this._mode === 'wallpaper') return Object.assign(snapshot, this._wallpaperLayout());
      if (this._mode === 'finished') return Object.assign(snapshot, { poses: [] });
      return Object.assign(snapshot, this._frameAt(time));
    }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      this._cancelFrame();
      this._cancelCompletion('destroyed');
      global.removeEventListener('resize', this._onResize);
      if (global.visualViewport) global.visualViewport.removeEventListener('resize', this._onResize);
      if (this._media.removeEventListener) this._media.removeEventListener('change', this._onMotionPreference);
      else this._media.removeListener(this._onMotionPreference);
      if (this._observer) this._observer.disconnect();
      this._images.clear();
      this._texture = null;
      this._pattern = null;
      this._mode = 'destroyed';
    }
  }

  EmbroideryLoader.motion = MOTION;
  EmbroideryLoader.sampleMotion = sampleMotion;
  global.EmbroideryLoader = EmbroideryLoader;
})(window);

/* StitchLoader — the overlay both of Carlo's sites use. show() puts a full-window layer over the page: a soft linen backdrop
 * (.stl-bg; a disc behind the ring, or the whole window with backdrop:'full') and a transparent canvas where the eight
 * figures circle. Nothing appears until the figures' artwork is in (if it isn't within artTimeout ms, it gives up quietly),
 * so nobody ever sees an empty linen screen. finish() fades the backdrop at once, so the page is readable straight away,
 * while the figures leave the ring one by one and walk off the right edge; the layer removes itself when the last one is gone.
 * While the full linen screen is opaque it swallows taps, so nobody clicks a link they can't see.
 * Sprites: <base>stitch-NN.webp (224px copies of the zip's 512px cutouts). Styles: stitch-loader.css. */
(function (global) {
  'use strict';
  const IDS = [1, 2, 3, 4, 8, 9, 15, 20];
  const manifest = (base) => ({ spriteSize: 512, spriteVisibleMaximum: 400, linen: { path: '' },
    characters: IDS.map((id) => ({ id, path: base + 'stitch-' + String(id).padStart(2, '0') + '.webp' })) });
  let warmed = null;
  function preload(base) {
    if (warmed) return warmed;
    warmed = Promise.all(IDS.map((id) => new Promise((done) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = img.onerror = done; img.src = base + 'stitch-' + String(id).padStart(2, '0') + '.webp';
    })));
    return warmed;
  }
  const GONE = { finish() {}, cancel() {}, get state() { return 'gone'; } };
  function show(opts) {
    opts = opts || {};
    const base = opts.base || 'stitch/';
    const host = document.createElement('div');
    host.className = 'stl' + (opts.backdrop === 'full' ? ' stl-full' : '') + (opts.className ? ' ' + opts.className : '');
    host.setAttribute('role', 'status');
    host.innerHTML = '<div class="stl-bg"></div><canvas class="stl-cv" aria-hidden="true"></canvas><span class="stl-sr">' + (opts.label || 'Loading') + '</span>';
    (opts.parent || document.body || document.documentElement).appendChild(host);
    const canvas = host.querySelector('canvas');
    const ringSize = opts.ringSize || ((w, h) => Math.min(w, h, 520));
    // the disc sits behind the ring: sized from the same ring scale (ring radius .19, figures .095 of it)
    const sizeDisc = () => {
      const r = canvas.getBoundingClientRect();
      const b = typeof ringSize === 'function' ? ringSize(r.width, r.height) : ringSize;
      host.style.setProperty('--stl-disc', Math.round(b * 0.58) + 'px');
    };
    sizeDisc();
    let loader = null, state = 'on', gone = false, shown = false;
    const remove = () => {
      if (gone) return; gone = true;
      clearTimeout(artTimer);
      global.removeEventListener('resize', sizeDisc);
      if (loader) loader.destroy();
      host.remove();
      if (typeof opts.onGone === 'function') opts.onGone();
    };
    const fadeAway = () => { state = 'leaving'; host.classList.add('stl-leaving', 'stl-done'); setTimeout(remove, 260); };
    try {
      loader = new global.EmbroideryLoader(canvas, { manifest: manifest(base), transparent: true, ringSize,
        onComplete: () => { host.classList.add('stl-done'); setTimeout(remove, 260); } });
    } catch (e) { remove(); return GONE; }
    // fade in only once the figures can be drawn; if the artwork is slow, don't bother
    const artTimer = setTimeout(() => { if (!shown) remove(); }, opts.artTimeout || 1500);
    loader.ready.then(() => {
      if (gone || state !== 'on') return;
      shown = true; clearTimeout(artTimer);
      requestAnimationFrame(() => { if (!gone) host.classList.add('stl-on'); });
    }, remove);
    global.addEventListener('resize', sizeDisc, { passive: true });
    return {
      get state() { return gone ? 'gone' : state; },
      // loading is over: backdrop fades now, the figures walk off to the right
      finish() {
        if (gone || state !== 'on') return;
        if (!shown || loader.mode !== 'loading') { remove(); return; }      // never seen: nothing worth watching
        state = 'leaving';
        host.classList.add('stl-leaving');
        loader.complete();
      },
      // drop it quietly (navigated away, gave up, a newer one is starting)
      cancel() { if (!gone) fadeAway(); }
    };
  }
  global.StitchLoader = { show, preload, ids: IDS };
})(window);
