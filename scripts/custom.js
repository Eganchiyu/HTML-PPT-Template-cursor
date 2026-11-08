/* ==========================================================================
   Custom Deck Controller:
   1. Reveal.js 1920x1080 Editorial Grid & Top Compass
   2. Spring Hover Full-Image Popout ("Duang~" Uncropped Elastic Preview)
   3. Click-to-Lock Fullscreen Lightbox (with Tall-Image Scroll Support)
   4. Authentic Cyber Swarm Multi-Cursor Intro (1:1 from eganchiyu.github.io)
   ========================================================================== */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Initialize Reveal.js (Structured Top-Aligned Editorial Canvas)
  // ==========================================================================
  const deck = new Reveal({
    width: 1920,
    height: 1080,
    margin: 0.02,
    minScale: 0.2,
    maxScale: 2.0,
    hash: true,
    center: false,
    controls: true,
    controlsLayout: 'bottom-right',
    progress: true,
    slideNumber: 'h.v',
    transition: 'fade',
    transitionSpeed: 'default',
    backgroundTransition: 'fade',
    plugins: typeof RevealNotes !== 'undefined' ? [RevealNotes] : []
  });

  // ==========================================================================
  // 2. Spring Hover Full-Image Popout ("Duang~" Elastic Uncropped Preview)
  // ==========================================================================
  const SpringHoverPopout = {
    layer: document.getElementById('hoverPopLayer'),
    card: document.getElementById('hoverPopCard'),
    img: document.getElementById('hoverPopImg'),
    caption: document.getElementById('hoverPopCaption'),
    activeTarget: null,
    enterTimer: null,
    hideTimer: null,
    lastOriginOffset: { dx: 0, dy: 0, scale: 0.7 },

    init() {
      if (!this.layer || !this.card || !this.img) return;
      const targets = document.querySelectorAll('img.popable');
      targets.forEach((imgEl) => {
        imgEl.addEventListener('mouseenter', () => this.scheduleShow(imgEl));
        imgEl.addEventListener('mouseleave', () => this.hide());
      });
    },

    scheduleShow(imgEl) {
      if (SwarmIntroManager.isRunning) return;
      const lb = document.getElementById('imageLightbox');
      if (lb && lb.classList.contains('open')) return;

      clearTimeout(this.enterTimer);
      clearTimeout(this.hideTimer);

      this.enterTimer = setTimeout(() => {
        this.show(imgEl);
      }, 65);
    },

    show(imgEl) {
      if (!imgEl || !imgEl.isConnected) return;
      const srcRect = imgEl.getBoundingClientRect();
      if (srcRect.width < 8 || srcRect.height < 8) return;

      this.activeTarget = imgEl;
      this.img.src = imgEl.src;
      this.img.alt = imgEl.alt || '';
      if (this.caption) {
        this.caption.textContent = imgEl.getAttribute('data-caption') || imgEl.alt || '';
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nw = imgEl.naturalWidth || srcRect.width;
      const nh = imgEl.naturalHeight || srcRect.height;
      const aspect = nw / Math.max(1, nh);

      // Compute full uncropped target size bounded comfortably within viewport
      const pad = 20;
      const maxImgW = Math.min(vw - 88, vw * 0.78, 1380);
      const maxImgH = Math.min(vh - 116, vh * 0.83, 880);

      // Avoid over-blowing tiny thumbnails while letting high-res / cropped / tall images expand fully
      const desiredW = Math.max(srcRect.width * 1.45, Math.min(maxImgW, nw * 1.85));
      const desiredH = Math.max(srcRect.height * 1.45, Math.min(maxImgH, nh * 1.85));

      let fitW = Math.min(maxImgW, desiredW);
      let fitH = fitW / aspect;
      if (fitH > Math.min(maxImgH, Math.max(desiredH, maxImgH * 0.92))) {
        fitH = Math.min(maxImgH, Math.max(desiredH, maxImgH * 0.92));
        fitW = fitH * aspect;
      }
      if (fitW > maxImgW) {
        fitW = maxImgW;
        fitH = fitW / aspect;
      }

      const cardW = Math.round(fitW + pad);
      const cardH = Math.round(fitH + pad);

      const srcCx = srcRect.left + srcRect.width * 0.5;
      const srcCy = srcRect.top + srcRect.height * 0.5;

      const marginX = 32;
      const marginTop = 28;
      const marginBottom = 56;
      const left = Math.round(Math.max(marginX, Math.min(vw - cardW - marginX, srcCx - cardW * 0.5)));
      const top = Math.round(Math.max(marginTop, Math.min(vh - cardH - marginBottom, srcCy - cardH * 0.5)));

      const destCx = left + cardW * 0.5;
      const destCy = top + cardH * 0.5;
      const dx = Math.round(srcCx - destCx);
      const dy = Math.round(srcCy - destCy);
      const startScale = Math.max(0.38, Math.min(0.84, Math.min(srcRect.width / cardW, srcRect.height / cardH)));

      this.lastOriginOffset = { dx, dy, scale: startScale };

      // FLIP start from source image position, then spring-bounce ("duang~") to full uncropped card
      this.layer.classList.remove('closing', 'active');
      this.card.style.transition = 'none';
      this.card.style.left = `${left}px`;
      this.card.style.top = `${top}px`;
      this.card.style.width = `${cardW}px`;
      this.card.style.height = `${cardH}px`;
      this.card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${startScale.toFixed(3)})`;

      void this.card.offsetWidth;
      this.card.style.transition = '';

      requestAnimationFrame(() => {
        if (this.activeTarget !== imgEl) return;
        this.layer.classList.add('active');
        this.card.style.transform = 'translate3d(0, 0, 0) scale(1)';
      });
    },

    hide() {
      clearTimeout(this.enterTimer);
      if (!this.activeTarget || !this.layer) return;
      this.activeTarget = null;

      const { dx, dy, scale } = this.lastOriginOffset;
      this.layer.classList.add('closing');
      this.layer.classList.remove('active');
      this.card.style.transform = `translate3d(${Math.round(dx * 0.55)}px, ${Math.round(dy * 0.55)}px, 0) scale(${Math.max(0.72, scale).toFixed(3)})`;

      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.layer.classList.remove('closing');
      }, 220);
    },

    hideImmediate() {
      clearTimeout(this.enterTimer);
      clearTimeout(this.hideTimer);
      this.activeTarget = null;
      if (this.layer) {
        this.layer.classList.remove('active', 'closing');
      }
    }
  };

  // ==========================================================================
  // 3. Click-to-Lock Fullscreen Lightbox (Supports Tall Screenshot Scrolling)
  // ==========================================================================
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImg');

  function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open', 'fit-screen');
  }

  document.addEventListener('click', (e) => {
    const popTarget = e.target.closest('img.popable');
    if (popTarget && lightbox && lightboxImg) {
      e.stopPropagation();
      SpringHoverPopout.hideImmediate();
      lightboxImg.src = popTarget.src;
      lightboxImg.alt = popTarget.alt || '';

      const nw = popTarget.naturalWidth || 800;
      const nh = popTarget.naturalHeight || 600;
      const isTall = nh / Math.max(1, nw) > 1.55;
      lightbox.classList.toggle('fit-screen', !isTall);
      lightboxImg.style.width = isTall ? 'min(680px, 88vw)' : '';

      const scrollWrap = lightbox.querySelector('.lightbox-scroll-wrap');
      if (scrollWrap) scrollWrap.scrollTop = 0;

      lightbox.classList.add('open');
      return;
    }

    if (lightbox && lightbox.classList.contains('open')) {
      closeLightbox();
    }
  });

  // ==========================================================================
  // 4. Authentic Cyber Swarm Intro (1:1 Migrated from eganchiyu.github.io)
  // ==========================================================================
  const SwarmIntroManager = {
    isRunning: false,
    speedMultiplier: 1,
    runId: 0,
    stage: null,
    hud: null,
    escHandler: null,
    autoHideTimer: null,

    // ────────────────────────────────────────────────────────────────
    // 主题配置 ①：开屏协作光标的词与颜色（4 只，与主题强绑定）
    // 必须按本次主题改写，不要保留通用词。词取主题里的四个核心概念，
    // 颜色取本次主题色板的三主色 + 一个点缀色，与 custom.css 的
    // --accent-* / --bg-base 同源。
    // 参考（mountain《绿水青山就是金山银山》）：
    //   { name: '绿水青山', color: '#10b981' }
    //   { name: '金山银山', color: '#d97706' }
    //   { name: '双场实证', color: '#0c8ce9' }
    //   { name: '绿色行动', color: '#8b5cf6' }
    // 数量保持 4 个：收尾由第 4 只光标完成，多于 4 只拖慢开屏。
    // ────────────────────────────────────────────────────────────────
    AGENTS_DATA: [
      { name: '问题', color: '#1d4ed8' },
      { name: '方法', color: '#4338ca' },
      { name: '数据', color: '#0284c7' },
      { name: '结论', color: '#0f766e' }
    ],

    easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    },

    easeInOutQuart(t) {
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    },

    ICONS: {
      arrow: (color) => `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path d="M4.5 3.5L11.5 20L14.2 13.8L20.5 11.2L4.5 3.5Z" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`,
      crosshair: (color) => `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M12 3V21M3 12H21" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
          <path d="M12 3V21M3 12H21" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
          <rect x="9.5" y="9.5" width="5" height="5" fill="none" stroke="${color}" stroke-width="1.5"/>
        </svg>`,
      ibeam: (color) => `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M8 4H16M8 20H16M12 4V20" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
          <path d="M8 4H16M8 20H16M12 4V20" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`,
      hand: (color) => `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M9 11V6a1.5 1.5 0 0 1 3 0v4m0-3a1.5 1.5 0 0 1 3 0v3m0-2a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.2 13.8a1.5 1.5 0 0 1 2.3-1.9L9 14V11Z" fill="${color}" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>`
    },

    isAlive(run) {
      return this.isRunning && this.runId === run;
    },

    collectTargets() {
      const structuralTasks = [];
      const detailTasks = [];

      const createTask = (el, type, metaLabel, parentTask = null) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return null;
        let resolveDone;
        const donePromise = new Promise((res) => {
          resolveDone = res;
        });
        return {
          el,
          type,
          metaLabel,
          cssWidth: el.offsetWidth,
          cssHeight: el.offsetHeight,
          cachedRect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          parentPromise: parentTask ? parentTask.donePromise : null,
          donePromise,
          markDone: resolveDone
        };
      };

      const pushStructural = (el, type, metaLabel) => {
        const t = createTask(el, type, metaLabel, null);
        if (t) structuralTasks.push(t);
        return t;
      };

      const pushDetail = (el, type, metaLabel, parentTask = null) => {
        const t = createTask(el, type, metaLabel, parentTask);
        if (t) detailTasks.push(t);
        return t;
      };

      // Wave 1: Cover Bento Outer Cards
      const mainCardTask = pushStructural(document.querySelector('.cover-main-card'), 'box', 'Hero-Card');
      const speakerCardTask = pushStructural(document.querySelector('.cover-speaker-card'), 'box', 'Speaker-Card');
      const frameworkCardTask = pushStructural(document.querySelector('.cover-framework-card'), 'box', 'Framework-Card');

      // Wave 2: Fine-Grained Elements Inside Each Card
      pushDetail(document.querySelector('.cover-event-kicker'), 'place', 'Event', mainCardTask);
      pushDetail(document.querySelector('.cover-heading'), 'type', 'Title', mainCardTask);
      pushDetail(document.querySelector('.cover-subheading'), 'type', 'Subtitle', mainCardTask);
      pushDetail(document.querySelector('.cover-summary'), 'place', 'Abstract', mainCardTask);
      document.querySelectorAll('.cover-domain-tag').forEach((tag, idx) => {
        pushDetail(tag, 'place', `Domain-${idx + 1}`, mainCardTask);
      });

      pushDetail(document.querySelector('.speaker-avatar-wrap'), 'box', 'Avatar', speakerCardTask);
      pushDetail(document.querySelector('.speaker-name'), 'type', 'Speaker', speakerCardTask);
      pushDetail(document.querySelector('.speaker-handle'), 'place', 'Handle', speakerCardTask);
      pushDetail(document.querySelector('.speaker-details'), 'place', 'Affiliation', speakerCardTask);
      pushDetail(document.querySelector('.speaker-blog-bar'), 'place', 'Blog-Link', speakerCardTask);

      pushDetail(document.querySelector('.framework-header'), 'place', 'Header', frameworkCardTask);
      document.querySelectorAll('.framework-row').forEach((row, idx) => {
        pushDetail(row, 'place', `Pillar-${idx + 1}`, frameworkCardTask);
      });

      return [...structuralTasks, ...detailTasks];
    },

    start() {
      const idx = deck.getIndices();
      if (idx.h !== 0 || idx.v !== 0) return;

      SpringHoverPopout.hideImmediate();
      if (this.isRunning) {
        this.cleanup(true);
      }

      this.runId = (this.runId || 0) + 1;
      const run = this.runId;
      this.isRunning = true;
      this.speedMultiplier = 1;

      const replayBtn = document.getElementById('swarmReplayBtn');
      if (replayBtn) {
        replayBtn.classList.remove('is-tilted', 'is-springing');
        replayBtn.classList.add('swarm-replay-pending');
      }

      const tasks = this.collectTargets();
      if (!tasks.length) {
        this.cleanup(true);
        return;
      }

      tasks.forEach((task) => {
        if (task.type === 'type') {
          if (!task.el.dataset.swarmOrigText) {
            task.el.dataset.swarmOrigText = task.el.textContent.trim();
          }
          task.origText = task.el.dataset.swarmOrigText;
          // Use unscaled internal CSS pixel dimensions inside Reveal canvas
          task.el.style.minHeight = `${Math.round(task.cssHeight)}px`;
          task.el.style.minWidth = `${Math.round(task.cssWidth)}px`;
          task.el.textContent = '';
          task.el.classList.add('swarm-target-hidden');
        } else {
          task.el.classList.add('swarm-target-hidden');
        }
      });

      this.buildStage();
      this.createAgents();

      this.escHandler = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.cleanup(true);
        }
      };
      window.addEventListener('keydown', this.escHandler, true);

      this.runTimeline(tasks, run);
    },

    buildStage() {
      this.stage = document.createElement('div');
      this.stage.className = 'swarm-stage';

      this.backdrop = document.createElement('div');
      this.backdrop.className = 'swarm-backdrop';
      this.stage.appendChild(this.backdrop);

      this.centerBadge = document.createElement('div');
      this.centerBadge.className = 'swarm-center-badge';
      // 主题配置 ②：开屏中心徽标（内联 SVG，按主题改图形与配色）
      // 换主题时整段替换；尺寸保持 64×64 viewBox，主色取主题主色。
      this.centerBadge.innerHTML = `
        <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-label="开屏中心徽标（占位，按主题替换）">
          <defs>
            <linearGradient id="emblemMain" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="55%" stop-color="#1d4ed8"/>
              <stop offset="100%" stop-color="#4338ca"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="#eff6ff"/>
          <circle cx="32" cy="32" r="28" stroke="url(#emblemMain)" stroke-width="2.4"/>
          <path d="M32 12L45 32L32 52L19 32L32 12Z" fill="url(#emblemMain)" opacity="0.9"/>
          <path d="M32 20L39 32L32 44L25 32L32 20Z" fill="#ffffff" opacity="0.92"/>
        </svg>
      `;
      this.stage.appendChild(this.centerBadge);

      this.guideV = document.createElement('div');
      this.guideV.className = 'swarm-guide-line guide-v';
      this.guideH1 = document.createElement('div');
      this.guideH1.className = 'swarm-guide-line guide-h';
      this.guideH2 = document.createElement('div');
      this.guideH2.className = 'swarm-guide-line guide-h';
      this.stage.appendChild(this.guideV);
      this.stage.appendChild(this.guideH1);
      this.stage.appendChild(this.guideH2);

      document.body.appendChild(this.stage);
      document.documentElement.classList.remove('intro-pending');

      this.hud = document.createElement('div');
      this.hud.className = 'swarm-hud';
      const dotColors = ['#38bdf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'];
      const dotsHtml = dotColors.map((c) => `<span class="swarm-hud-dot" style="background:${c}"></span>`).join('');

      this.hud.innerHTML = `
        <div class="swarm-hud-dots">${dotsHtml}</div>
        <div class="swarm-hud-status" id="swarmHudStatus">Initializing canvas...</div>
        <div class="swarm-hud-progress" id="swarmHudProgressWrap">
          <div class="swarm-hud-progress-bar" id="swarmHudBar"></div>
        </div>
        <div class="swarm-hud-actions">
          <button type="button" class="swarm-hud-btn" id="swarmSpeedBtn" title="切换构建倍速">1x</button>
          <button type="button" class="swarm-hud-btn is-primary" id="swarmHudReplayBtn" style="display:none;">Replay</button>
          <button type="button" class="swarm-hud-btn btn-close" id="swarmSkipBtn" title="跳过动画 (Esc)">×</button>
        </div>
      `;
      document.body.appendChild(this.hud);

      this.hudStatus = this.hud.querySelector('#swarmHudStatus');
      this.hudBar = this.hud.querySelector('#swarmHudBar');
      this.hudProgressWrap = this.hud.querySelector('#swarmHudProgressWrap');
      this.speedBtn = this.hud.querySelector('#swarmSpeedBtn');
      this.hudReplayBtn = this.hud.querySelector('#swarmHudReplayBtn');
      this.skipBtn = this.hud.querySelector('#swarmSkipBtn');

      this.speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speedMultiplier = this.speedMultiplier === 1 ? 2 : 1;
        this.speedBtn.textContent = `${this.speedMultiplier}x`;
      });

      this.hudReplayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.start();
      });

      this.skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cleanup(true);
      });

      requestAnimationFrame(() => {
        if (this.hud) this.hud.classList.add('is-visible');
        if (this.centerBadge) this.centerBadge.classList.add('is-visible');
      });
    },

    createAgents() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw * 0.5;
      const cy = vh * 0.46;

      this.agents = this.AGENTS_DATA.map((item, index) => {
        const angle = (index / this.AGENTS_DATA.length) * Math.PI * 2;
        const startDist = Math.max(vw, vh) * (0.42 + (index % 3) * 0.12);
        const startX = cx + Math.cos(angle) * startDist;
        const startY = cy + Math.sin(angle) * startDist;

        const el = document.createElement('div');
        el.className = 'swarm-cursor';
        el.style.setProperty('--agent-color', item.color);
        el.innerHTML = `
          <div class="swarm-cursor-icon">${this.ICONS.arrow(item.color)}</div>
          <div class="swarm-cursor-tag">
            <span>${item.name}</span>
            <span class="swarm-cursor-tag-meta" style="display:none;"></span>
          </div>
        `;
        this.stage.appendChild(el);

        const agent = {
          id: index,
          name: item.name,
          color: item.color,
          el,
          iconEl: el.querySelector('.swarm-cursor-icon'),
          metaEl: el.querySelector('.swarm-cursor-tag-meta'),
          x: startX,
          y: startY,
          angle,
          orbitRadius: 44 + (index % 4) * 22,
          orbitSpeed: (index % 2 === 0 ? 1 : -1) * (2.5 + (index % 3) * 0.45),
          speedFactor: 0.92 + (index % 4) * 0.1,
          tool: 'arrow',
          busy: false,
          retired: false
        };

        this.setAgentPos(agent, startX, startY);
        return agent;
      });
    },

    setAgentPos(agent, x, y) {
      if (agent.retired) return;
      agent.x = x;
      agent.y = y;
      agent.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },

    setAgentTool(agent, tool, metaText = '') {
      if (agent.retired) return;
      if (agent.tool !== tool) {
        agent.tool = tool;
        const renderer = this.ICONS[tool] || this.ICONS.arrow;
        agent.iconEl.innerHTML = renderer(agent.color);
      }
      if (metaText) {
        agent.metaEl.textContent = metaText;
        agent.metaEl.style.display = 'inline';
      } else {
        agent.metaEl.style.display = 'none';
      }
    },

    spawnRipple(x, y, color) {
      if (!this.stage) return;
      const r = document.createElement('div');
      r.className = 'swarm-ripple';
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      r.style.setProperty('--ripple-color', color);
      this.stage.appendChild(r);
      setTimeout(() => r.remove(), 600);
    },

    moveAgentTo(agent, targetX, targetY, durationMs, onUpdate, easingType = 'outQuart') {
      const run = this.runId;
      return new Promise((resolve) => {
        if (agent.retired) return resolve();
        const startX = agent.x;
        const startY = agent.y;
        const dx = targetX - startX;
        const dy = targetY - startY;
        const ctrlX = startX + dx * 0.46 - dy * 0.14;
        const ctrlY = startY + dy * 0.46 + dx * 0.14;

        let elapsed = 0;
        let lastTime = performance.now();
        const actualDuration = Math.max(20, durationMs / (agent.speedFactor || 1));

        const step = (now) => {
          if (!this.isAlive(run) || agent.retired) return resolve();
          const dt = (now - lastTime) * this.speedMultiplier;
          lastTime = now;
          elapsed += dt;

          const t = Math.min(1, elapsed / actualDuration);
          const ease =
            easingType === 'linear'
              ? t
              : easingType === 'inOutQuart'
              ? this.easeInOutQuart(t)
              : this.easeOutQuart(t);

          const inv = 1 - ease;
          const curX = inv * inv * startX + 2 * inv * ease * ctrlX + ease * ease * targetX;
          const curY = inv * inv * startY + 2 * inv * ease * ctrlY + ease * ease * targetY;

          this.setAgentPos(agent, curX, curY);
          if (onUpdate) onUpdate(ease, curX, curY, t);

          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },

    async retireAgent(agent) {
      if (!this.isRunning || agent.retired) return;
      this.setAgentTool(agent, 'arrow');
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const exitX = vw + 75 + (agent.id % 4) * 32;
      const exitY = vh + 65 + Math.floor(agent.id / 4) * 28;

      await this.moveAgentTo(
        agent,
        exitX,
        exitY,
        520 + (agent.id % 3) * 65,
        (ease) => {
          agent.el.style.opacity = Math.max(0, 1 - Math.pow(ease, 2)).toFixed(2);
        },
        'outQuart'
      );

      agent.retired = true;
      if (agent.el) agent.el.remove();
    },

    wait(ms) {
      const run = this.runId;
      return new Promise((resolve) => {
        let elapsed = 0;
        let last = performance.now();
        const tick = (now) => {
          if (!this.isAlive(run)) return resolve();
          elapsed += (now - last) * this.speedMultiplier;
          last = now;
          if (elapsed >= ms) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },

    async runTimeline(tasks, run) {
      const agents = this.agents;
      const startTime = performance.now();
      const totalLayers = Math.max(1, tasks.length);
      let completedLayers = 0;

      const updateHudProgress = () => {
        if (!this.hudStatus || !this.hudBar) return;
        const pct = Math.min(100, Math.round((completedLayers / totalLayers) * 100));
        this.hudStatus.innerHTML = `<strong>${agents.length} 羁绊</strong> · ${completedLayers} / ${totalLayers} layers`;
        this.hudBar.style.width = `${pct}%`;
      };

      // Phase 1: Vortex Convergence (0 ~ 660ms)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw * 0.5;
      const cy = vh * 0.46;

      await new Promise((resolve) => {
        let elapsed = 0;
        let last = performance.now();
        const duration = 660 * 3;

        const vortexStep = (now) => {
          if (!this.isAlive(run)) return resolve();
          const dt = (now - last) * this.speedMultiplier;
          last = now;
          elapsed += dt;
          const progress = Math.min(1, elapsed / duration);
          const ease = this.easeOutQuart(progress);

          agents.forEach((agent) => {
            const currentAngle = agent.angle + progress * agent.orbitSpeed * 2.1;
            const startR = Math.max(vw, vh) * 0.44;
            const r = startR * (1 - ease) + agent.orbitRadius * ease;
            const x = cx + Math.cos(currentAngle) * r;
            const y = cy + Math.sin(currentAngle) * r * 0.78;
            this.setAgentPos(agent, x, y);
          });

          if (this.hudBar) {
            this.hudBar.style.width = `${Math.round(progress * 10)}%`;
          }

          if (progress < 1) {
            requestAnimationFrame(vortexStep);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(vortexStep);
      });

      if (!this.isAlive(run)) return;

      // Phase 2 & 3: Simultaneous Dispersion + Figma Artboard & Layer Construction
      this.centerBadge.classList.remove('is-visible');
      this.centerBadge.classList.add('is-dispersing');
      this.backdrop.classList.add('is-fading');
      updateHudProgress();

      const contentGridEl = document.getElementById('coverBentoGrid') || document.body;
      const gridRect = contentGridEl.getBoundingClientRect();
      const abLeft = Math.round(gridRect.left);
      const abTop = Math.round(gridRect.top);
      const abWidth = Math.round(gridRect.width);
      const abHeight = Math.round(gridRect.height);

      this.guideV.style.left = `${abLeft}px`;
      this.guideH1.style.top = `${abTop}px`;
      this.guideH2.style.top = `${abTop + abHeight}px`;
      this.guideV.classList.add('is-active');
      this.guideH1.classList.add('is-active');
      this.guideH2.classList.add('is-active');

      const artboard = document.createElement('div');
      artboard.className = 'swarm-wireframe';
      artboard.style.setProperty('--wf-color', '#0c8ce9');
      artboard.innerHTML = `
        <span class="swarm-wf-handle-bl"></span>
        <span class="swarm-wf-handle-br"></span>
        <span class="swarm-wf-size" id="artboardSizeTag">0 × 0</span>
      `;
      this.stage.appendChild(artboard);
      const artboardTag = artboard.querySelector('#artboardSizeTag');

      const buildArtboardTask = async (leadAgent) => {
        leadAgent.busy = true;
        this.setAgentTool(leadAgent, 'crosshair', 'Artboard');
        await this.moveAgentTo(leadAgent, abLeft, abTop, 230 * 1.5);
        if (!this.isAlive(run)) return;
        await this.moveAgentTo(leadAgent, abLeft + abWidth, abTop + abHeight, 350 * 1.5, (ease) => {
          const curRect = contentGridEl.getBoundingClientRect();
          const curL = Math.round(curRect.left);
          const curT = Math.round(curRect.top);
          const curW = Math.max(20, Math.round(curRect.width * ease));
          const curH = Math.max(20, Math.round(curRect.height * ease));
          artboard.style.left = `${curL}px`;
          artboard.style.top = `${curT}px`;
          artboard.style.width = `${curW}px`;
          artboard.style.height = `${curH}px`;
          if (artboardTag) artboardTag.textContent = `${curW} × ${curH}`;
        });
        this.spawnRipple(abLeft + abWidth, abTop + abHeight, leadAgent.color);
        leadAgent.busy = false;
        this.setAgentTool(leadAgent, 'arrow');
        artboard.style.background = 'transparent';
        artboard.style.borderColor = 'rgba(12, 140, 233, 0.26)';
      };

      const executeTask = async (agent, task, isFirstTask = false) => {
        if (!this.isAlive(run)) {
          if (task.markDone) task.markDone();
          return;
        }
        agent.busy = true;
        const extraFlight = isFirstTask ? (agent.id % 6) * 40 : 0;

        const liveRect = task.el.getBoundingClientRect();
        const initRect = liveRect.width >= 4 ? liveRect : task.cachedRect;
        if (this.guideV && this.guideH2) {
          this.guideV.style.left = `${Math.round(initRect.left)}px`;
          this.guideH2.style.top = `${Math.round(initRect.bottom)}px`;
        }

        if (task.type === 'box') {
          this.setAgentTool(agent, 'crosshair', task.metaLabel);
          await this.moveAgentTo(agent, Math.round(initRect.left), Math.round(initRect.top), 270 * 2 + extraFlight);
          if (task.parentPromise) await task.parentPromise;
          if (!this.isAlive(run)) {
            if (task.markDone) task.markDone();
            return;
          }

          const wf = document.createElement('div');
          wf.className = 'swarm-wireframe';
          wf.style.setProperty('--wf-color', agent.color);
          wf.innerHTML = `
            <span class="swarm-wf-handle-bl"></span>
            <span class="swarm-wf-handle-br"></span>
            <span class="swarm-wf-size">0 × 0</span>
          `;
          this.stage.appendChild(wf);
          const sizeLabel = wf.querySelector('.swarm-wf-size');

          task.el.classList.add('swarm-target-building');
          task.el.classList.remove('swarm-target-hidden');

          const targetRect = task.el.getBoundingClientRect();
          await this.moveAgentTo(
            agent,
            Math.round(targetRect.right),
            Math.round(targetRect.bottom),
            360 * 2,
            (ease) => {
              const curRect = task.el.getBoundingClientRect();
              const l = Math.round(curRect.left);
              const t = Math.round(curRect.top);
              const w = Math.max(6, Math.round(curRect.width * ease));
              const h = Math.max(6, Math.round(curRect.height * ease));
              wf.style.left = `${l}px`;
              wf.style.top = `${t}px`;
              wf.style.width = `${w}px`;
              wf.style.height = `${h}px`;
              sizeLabel.textContent = `${w} × ${h}`;

              const clipRight = Math.max(0, 100 - ease * 100).toFixed(1);
              const clipBottom = Math.max(0, 100 - ease * 100).toFixed(1);
              task.el.style.clipPath = `inset(0 ${clipRight}% ${clipBottom}% 0)`;
              task.el.style.opacity = String(Math.min(1, ease * 1.2));

              if (this.guideV && this.guideH2) {
                this.guideV.style.left = `${l}px`;
                this.guideH2.style.top = `${t + h}px`;
              }
            },
            'outQuart'
          );

          task.el.style.clipPath = '';
          task.el.style.opacity = '';
          const endRect = task.el.getBoundingClientRect();
          this.spawnRipple(Math.round(endRect.right), Math.round(endRect.bottom), agent.color);

          wf.style.opacity = '0';
          setTimeout(() => wf.remove(), 220);
        } else if (task.type === 'type') {
          this.setAgentTool(agent, 'ibeam', 'Typing');
          await this.moveAgentTo(
            agent,
            Math.round(initRect.left + 4),
            Math.round(initRect.top + initRect.height * 0.5),
            (250 + extraFlight) * 2
          );
          if (task.parentPromise) await task.parentPromise;
          if (!this.isAlive(run)) {
            if (task.markDone) task.markDone();
            return;
          }

          task.el.classList.remove('swarm-target-hidden');
          task.el.classList.add('swarm-text-highlight');
          const fullText = task.origText || '';
          const len = fullText.length;
          const typeDuration = Math.min(1100, Math.max(380, len * 38)) * 2;

          const curRect = task.el.getBoundingClientRect();
          const spanWidth = Math.max(curRect.width, task.cachedRect ? task.cachedRect.width : 48);
          await this.moveAgentTo(
            agent,
            Math.round(curRect.left + spanWidth),
            Math.round(curRect.top + curRect.height * 0.5),
            typeDuration,
            (_ease, _cx, _cy, rawT) => {
              const charCount = Math.max(1, Math.round(len * rawT));
              task.el.textContent = fullText.slice(0, charCount);
            },
            'outQuart'
          );

          task.el.textContent = fullText;
          task.el.style.minHeight = '';
          task.el.style.minWidth = '';
          setTimeout(() => {
            task.el.classList.remove('swarm-text-highlight');
          }, 240);
        } else {
          this.setAgentTool(agent, 'hand', task.metaLabel);
          const targetX = Math.round(initRect.left + initRect.width * 0.5);
          const targetY = Math.round(initRect.top + initRect.height * 0.5);
          await this.moveAgentTo(agent, targetX, targetY, (240 + extraFlight) * 2);
          if (task.parentPromise) await task.parentPromise;
          if (!this.isAlive(run)) {
            if (task.markDone) task.markDone();
            return;
          }

          const curRect = task.el.getBoundingClientRect();
          const wf = document.createElement('div');
          wf.className = 'swarm-wireframe';
          wf.style.setProperty('--wf-color', agent.color);
          wf.style.left = `${Math.round(curRect.left)}px`;
          wf.style.top = `${Math.round(curRect.top)}px`;
          wf.style.width = `${Math.round(curRect.width)}px`;
          wf.style.height = `${Math.round(curRect.height)}px`;
          wf.innerHTML = `<span class="swarm-wf-size">${Math.round(curRect.width)} × ${Math.round(curRect.height)}</span>`;
          this.stage.appendChild(wf);

          agent.el.classList.add('is-clicking');
          this.spawnRipple(Math.round(curRect.left + curRect.width * 0.5), Math.round(curRect.top + curRect.height * 0.5), agent.color);
          task.el.classList.add('swarm-target-building');
          task.el.classList.remove('swarm-target-hidden');

          await this.wait(260);
          agent.el.classList.remove('is-clicking');
          wf.style.opacity = '0';
          setTimeout(() => wf.remove(), 200);
        }

        if (task.markDone) task.markDone();
        this.setAgentTool(agent, 'arrow');
        agent.busy = false;
        completedLayers++;
        updateHudProgress();
      };

      const taskQueue = [...tasks];
      const workerPromises = agents.map(async (agent, idx) => {
        let isFirst = true;
        if (idx === 1) {
          await buildArtboardTask(agent);
          isFirst = false;
        }
        while (this.isAlive(run) && taskQueue.length > 0) {
          const nextTask = taskQueue.shift();
          if (!nextTask) break;
          await executeTask(agent, nextTask, isFirst);
          isFirst = false;
        }
        await this.retireAgent(agent);
      });

      await Promise.all(workerPromises);
      if (!this.isAlive(run)) return;

      artboard.style.opacity = '0';
      this.guideV.classList.remove('is-active');
      this.guideH1.classList.remove('is-active');
      this.guideH2.classList.remove('is-active');

      // Finale: Cursor #13 ("爱") carries replay icon into slot & bumps it upright
      await this.playFinale(run);
      if (!this.isAlive(run)) return;

      const totalSeconds = ((performance.now() - startTime) / 1000).toFixed(1);
      if (this.hudStatus) {
        this.hudStatus.innerHTML = `Built by <strong>${agents.length} 羁绊</strong> in ${totalSeconds}s`;
      }
      if (this.hudProgressWrap) {
        this.hudProgressWrap.classList.add('is-collapsed');
        setTimeout(() => {
          if (this.hudProgressWrap) this.hudProgressWrap.style.display = 'none';
        }, 320);
      }
      if (this.speedBtn) this.speedBtn.style.display = 'none';
      if (this.hudReplayBtn) this.hudReplayBtn.style.display = 'inline-flex';

      await this.wait(260);
      if (!this.isAlive(run)) return;

      if (this.stage) {
        this.stage.remove();
        this.stage = null;
      }

      this.autoHideTimer = setTimeout(() => {
        this.cleanup(false);
      }, 3200);
    },

    async playFinale(run) {
      const replayBtn = document.getElementById('swarmReplayBtn');
      if (!this.stage || !replayBtn) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const color = '#f43f5e';
      const startX = vw + 90;
      const startY = vh * 0.58;

      const el = document.createElement('div');
      el.className = 'swarm-cursor';
      el.style.setProperty('--agent-color', color);
      el.innerHTML = `
        <div class="swarm-cursor-icon">${this.ICONS.arrow(color)}</div>
        <div class="swarm-cursor-tag"><span>爱</span><span class="swarm-cursor-tag-meta" style="display:none;"></span></div>
      `;
      el.style.opacity = '0';
      this.stage.appendChild(el);

      const agent = {
        id: 12,
        name: '爱',
        color,
        el,
        iconEl: el.querySelector('.swarm-cursor-icon'),
        metaEl: el.querySelector('.swarm-cursor-tag-meta'),
        x: startX,
        y: startY,
        speedFactor: 1.08,
        tool: 'arrow',
        retired: false
      };
      this.setAgentPos(agent, agent.x, agent.y);

      const carry = document.createElement('div');
      carry.className = 'swarm-carry-icon';
      carry.innerHTML = replayBtn.innerHTML;
      this.stage.appendChild(carry);
      const placeCarry = (x, y, rot, scale, alpha = 1) => {
        carry.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) rotate(${rot}deg) scale(${scale})`;
        carry.style.opacity = String(alpha);
      };
      placeCarry(agent.x + 16, agent.y + 6, 22, 1.05);

      const btnRect = replayBtn.getBoundingClientRect();
      const btnCx = btnRect.left + btnRect.width * 0.5;
      const btnCy = btnRect.top + btnRect.height * 0.5;

      requestAnimationFrame(() => {
        if (el.isConnected) el.style.opacity = '1';
      });
      await this.wait(80);
      if (!this.isAlive(run)) {
        carry.remove();
        el.remove();
        return;
      }

      await this.moveAgentTo(
        agent,
        Math.round(btnCx + 42),
        Math.round(btnCy + 10),
        580,
        (_ease, x, y) => placeCarry(x + 16, y + 6, 22, 1.05),
        'inOutQuart'
      );
      if (!this.isAlive(run)) {
        carry.remove();
        el.remove();
        return;
      }

      const fromX = agent.x + 16;
      const fromY = agent.y + 6;
      await new Promise((resolve) => {
        const duration = 210;
        const t0 = performance.now();
        const step = (now) => {
          if (!this.isAlive(run)) return resolve();
          const t = Math.min(1, (now - t0) / duration);
          const ease = this.easeOutQuart(t);
          placeCarry(
            fromX + (btnCx - fromX) * ease,
            fromY + (btnCy - fromY) * ease,
            22,
            1.05 - 0.3 * ease,
            1 - ease
          );
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      carry.remove();
      if (!this.isAlive(run)) return;

      replayBtn.classList.remove('swarm-replay-pending');
      replayBtn.classList.add('is-tilted');

      await this.moveAgentTo(agent, Math.round(btnCx + 135), Math.round(btnCy + 58), 380, null, 'inOutQuart');
      if (!this.isAlive(run)) return;
      await this.wait(100);
      if (!this.isAlive(run)) return;

      await this.moveAgentTo(agent, Math.round(btnCx + 12), Math.round(btnCy + 2), 180, null, 'inOutQuart');
      if (!this.isAlive(run)) return;
      el.classList.add('is-clicking');
      this.spawnRipple(Math.round(btnCx), Math.round(btnCy), color);
      replayBtn.classList.add('is-springing');
      replayBtn.classList.remove('is-tilted');

      await this.moveAgentTo(agent, Math.round(btnCx + 105), Math.round(btnCy + 88), 220, null, 'outQuart');
      el.classList.remove('is-clicking');
      if (!this.isAlive(run)) return;
      setTimeout(() => replayBtn.classList.remove('is-springing'), 420);

      await this.wait(280);
      if (!this.isAlive(run)) return;

      await this.moveAgentTo(
        agent,
        vw + 80,
        vh + 80,
        480,
        (ease) => {
          el.style.opacity = Math.max(0, 1 - Math.pow(ease, 2)).toFixed(2);
        },
        'outQuart'
      );
      agent.retired = true;
      el.remove();
    },

    cleanup(immediate = true) {
      this.isRunning = false;
      document.documentElement.classList.remove('intro-pending');
      if (this.autoHideTimer) {
        clearTimeout(this.autoHideTimer);
        this.autoHideTimer = null;
      }
      if (this.escHandler) {
        window.removeEventListener('keydown', this.escHandler, true);
        this.escHandler = null;
      }

      const replayBtn = document.getElementById('swarmReplayBtn');
      if (replayBtn) {
        replayBtn.classList.remove('swarm-replay-pending', 'is-tilted', 'is-springing');
      }

      document.querySelectorAll('.swarm-target-hidden, .swarm-target-building, .swarm-text-highlight').forEach((el) => {
        el.classList.remove('swarm-target-hidden', 'swarm-target-building', 'swarm-text-highlight');
        el.style.opacity = '';
        el.style.clipPath = '';
        el.style.minHeight = '';
        el.style.minWidth = '';
        if (el.dataset.swarmOrigText) {
          el.textContent = el.dataset.swarmOrigText;
        }
      });

      if (this.stage) {
        this.stage.remove();
        this.stage = null;
      }

      if (this.hud) {
        if (immediate) {
          this.hud.remove();
          this.hud = null;
        } else {
          const hudRef = this.hud;
          this.hud = null;
          hudRef.classList.remove('is-visible');
          setTimeout(() => hudRef.remove(), 350);
        }
      }
    }
  };

  // ==========================================================================
  // 5. Top Chapter Navigation, Keyboard Shortcuts & Boot
  // ==========================================================================
  const topbar = document.getElementById('deckTopbar');
  const compassItems = Array.from(document.querySelectorAll('.compass-item'));
  const branchHint = document.getElementById('branchHint');
  const chapterFirstSlideMap = {};

  function indexChapters() {
    const topSections = document.querySelectorAll('.reveal > .slides > section');
    topSections.forEach((sec, hIdx) => {
      const target = sec.hasAttribute('data-chapter')
        ? sec
        : sec.querySelector('section[data-chapter]');
      if (target) {
        const ch = target.getAttribute('data-chapter');
        if (ch && !(ch in chapterFirstSlideMap)) {
          chapterFirstSlideMap[ch] = hIdx;
        }
      }
    });
  }

  // Sliding pill that follows the active chapter
  let compassIndicator = null;
  if (topbar) {
    compassIndicator = document.createElement('span');
    compassIndicator.className = 'compass-indicator no-anim';
    compassIndicator.setAttribute('aria-hidden', 'true');
    topbar.insertBefore(compassIndicator, topbar.firstChild);
    topbar.classList.add('has-indicator');
  }

  let deckReady = false;
  function moveCompassIndicator() {
    if (!compassIndicator || !deckReady) return;
    const active = compassItems.find((item) => item.classList.contains('active'));
    if (!active) return;
    compassIndicator.style.width = `${active.offsetWidth}px`;
    compassIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
    if (compassIndicator.classList.contains('no-anim')) {
      requestAnimationFrame(() => requestAnimationFrame(() => compassIndicator.classList.remove('no-anim')));
    }
  }

  window.addEventListener('resize', () => {
    if (!compassIndicator) return;
    compassIndicator.classList.add('no-anim');
    moveCompassIndicator();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!compassIndicator) return;
      compassIndicator.classList.add('no-anim');
      moveCompassIndicator();
    });
  }

  function syncChrome(event) {
    SpringHoverPopout.hideImmediate();

    const currentSlide = event ? event.currentSlide : deck.getCurrentSlide();
    if (!currentSlide) return;

    const indices = deck.getIndices();
    const isCover = indices.h === 0 && indices.v === 0;

    if (!isCover && SwarmIntroManager.isRunning) {
      SwarmIntroManager.cleanup(true);
    }

    if (topbar) {
      topbar.classList.toggle('is-cover', isCover);
    }

    const chapter = currentSlide.getAttribute('data-chapter') || 'intro';
    compassItems.forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-target-chapter') === chapter);
    });
    moveCompassIndicator();

    if (branchHint) {
      const routes = deck.availableRoutes();
      branchHint.classList.toggle('visible', Boolean(routes && routes.down));
    }

    YukiTelemetryController.onSlide(currentSlide);
  }

  // ==========================================================================
  // 5. Project Yuki Empirical Telemetry Observatory Controller (Slide H2.3)
  // ==========================================================================
  const YukiTelemetryController = {
    board: null,
    readout: null,
    defaultReadout: '峰值 20:00 · 576 次回复 · 权重 w = 1.30',
    rafIds: [],
    initialized: false,

    init() {
      this.board = document.getElementById('yukiTelemetryBoard');
      if (!this.board || this.initialized) return;
      this.initialized = true;
      this.readout = document.getElementById('circadianReadout');

      const cols = this.board.querySelectorAll('.circ-col');
      cols.forEach((col) => {
        col.addEventListener('mouseenter', () => {
          if (!this.readout) return;
          const hr = col.getAttribute('data-hour') || '';
          const rep = col.getAttribute('data-replies') || '0';
          const dia = col.getAttribute('data-diaries') || '0';
          const wt = col.getAttribute('data-weight') || '0';
          this.readout.textContent = `${hr} · 回复 ${rep} 次 · 日记 ${dia} 条 · w=${wt}`;
        });
        col.addEventListener('mouseleave', () => {
          if (this.readout) this.readout.textContent = this.defaultReadout;
        });
      });

      const replayBtn = document.getElementById('telemetryReplayBtn');
      if (replayBtn) {
        replayBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.play();
        });
      }

      const slideSec = this.board.closest('section');
      if (slideSec) {
        const thesisItems = slideSec.querySelectorAll('.yuki-thesis-item[data-target-module]');
        thesisItems.forEach((item) => {
          const mod = item.getAttribute('data-target-module');
          item.addEventListener('mouseenter', () => {
            if (!mod || !this.board) return;
            this.board.classList.add('spotlight-active', `spotlight-${mod}`);
          });
          item.addEventListener('mouseleave', () => {
            if (!this.board) return;
            this.board.classList.remove('spotlight-active', 'spotlight-memory', 'spotlight-rhythm', 'spotlight-evolve', 'spotlight-token');
          });
        });
      }
    },

    cancelRafs() {
      this.rafIds.forEach((id) => cancelAnimationFrame(id));
      this.rafIds = [];
    },

    formatVal(val, decimals, useComma) {
      const fixed = val.toFixed(decimals);
      if (!useComma) return fixed;
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    },

    play() {
      if (!this.board) return;
      this.cancelRafs();

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const nums = this.board.querySelectorAll('.tkpi-num[data-count]');

      if (reduced) {
        this.board.classList.remove('is-animating');
        nums.forEach((el) => {
          const target = parseFloat(el.getAttribute('data-count') || '0');
          const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
          const comma = el.getAttribute('data-comma') === '1';
          el.textContent = this.formatVal(target, dec, comma);
        });
        return;
      }

      this.board.classList.remove('is-animating');
      void this.board.offsetWidth;
      this.board.classList.add('is-animating');

      const duration = 3360;
      const t0 = performance.now();

      nums.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-count') || '0');
        const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
        const comma = el.getAttribute('data-comma') === '1';

        const tick = (now) => {
          const p = Math.min(1, Math.max(0, (now - t0) / duration));
          const eased = 1 - Math.pow(1 - p, 4);
          el.textContent = this.formatVal(target * eased, dec, comma);
          if (p < 1) {
            this.rafIds.push(requestAnimationFrame(tick));
          } else {
            el.textContent = this.formatVal(target, dec, comma);
          }
        };
        this.rafIds.push(requestAnimationFrame(tick));
      });
    },

    onSlide(currentSlide) {
      if (!this.board || !currentSlide) return;
      if (currentSlide.contains(this.board)) {
        this.play();
      }
    }
  };

  compassItems.forEach((item) => {
    item.addEventListener('click', () => {
      const ch = item.getAttribute('data-target-chapter');
      if (ch && ch in chapterFirstSlideMap) {
        deck.slide(chapterFirstSlideMap[ch], 0);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('open')) {
      e.stopPropagation();
      e.preventDefault();
      closeLightbox();
      return;
    }
    if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
      const idx = deck.getIndices();
      if (idx.h === 0 && idx.v === 0) {
        SwarmIntroManager.start();
      }
    }
  }, true);

  deck.initialize().then(() => {
    indexChapters();
    SpringHoverPopout.init();
    YukiTelemetryController.init();
    deckReady = true;
    syncChrome();

    deck.on('slidechanged', syncChrome);

    const replayBtn = document.getElementById('swarmReplayBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SwarmIntroManager.start();
      });
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skipIntroParam = new URLSearchParams(window.location.search).get('no-intro') === '1';
    const idx = deck.getIndices();
    const willPlayIntro = !prefersReducedMotion && !skipIntroParam && idx.h === 0 && idx.v === 0;
    if (willPlayIntro) {
      setTimeout(() => SwarmIntroManager.start(), 140);
    } else {
      document.documentElement.classList.remove('intro-pending');
    }
  });
})();
