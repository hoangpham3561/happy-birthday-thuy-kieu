(() => {
  const cfg = window.BIRTHDAY_CONFIG;
  if (!cfg) return;

  const $ = (s, r = document) => r.querySelector(s);

  const scenes = {
    pass: $('[data-scene="pass"]'),
    intro: $('[data-scene="intro"]'),
    cake: $('[data-scene="cake"]'),
    letter: $('[data-scene="letter"]'),
    fall: $('[data-scene="fall"]'),
  };

  const passForm = $("#passForm");
  const passInput = $("#passInput");
  const passError = $("#passError");
  const introText = $("#introText");
  const introSub = $("#introSub");
  const introRule = $("#introRule");
  const cakeStage = $("#cakeStage");
  const cakeNext = $("#cakeNext");
  const cakeCaption = $("#cakeCaption");
  const surpriseBtn = $("#surpriseBtn");
  const fallLayer = $("#fallLayer");
  const fallStage = $("#fallStage");
  const fallWorld = $("#fallWorld");
  const fallHint = $("#fallHint");
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImg");
  const musicBtn = $("#musicBtn");
  const bgMusic = $("#bgMusic");
  const canvas = $("#fx");
  const ctx = canvas.getContext("2d");
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let current = "pass";
  let introToken = 0;
  let musicOn = false;
  let particles = [];
  let particleMode = "hearts";
  let galleryRot = { x: 10, y: 0 };
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let autoOrbit = false;

  // ===== Scenes =====
  function showScene(name) {
    Object.entries(scenes).forEach(([key, el]) => {
      el.classList.toggle("is-active", key === name);
    });
    current = name;

    if (name === "intro") runIntro();
    if (name === "cake") runCake();
    if (name === "letter") {
      particleMode = "hearts";
      seedHearts(16);
    }
    if (name === "fall") {
      particleMode = "spark";
      seedSparks(40);
      startFinale();
    }
  }

  // ===== Content =====
  function initContent() {
    $("#passName").textContent = cfg.nickname || cfg.name;
    $("#wishStamp").textContent = cfg.letter.stamp;
    $("#wishGreeting").textContent = cfg.letter.greeting;
    $("#wishSign").textContent = cfg.letter.sign;
    $("#wishImg").src = cfg.letterPhoto || cfg.photos[0];

    const top = $("#wishCopyTop");
    const bottom = $("#wishCopyBottom");
    top.innerHTML = "";
    bottom.innerHTML = "";
    const paras = cfg.letter.paragraphs || [];
    if (paras[0]) {
      const p = document.createElement("p");
      p.textContent = paras[0];
      top.appendChild(p);
    }
    paras.slice(1).forEach((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      bottom.appendChild(p);
    });

    if (cfg.music) {
      // Kiểm tra file nhạc tồn tại rồi hiện nút
      fetch(cfg.music, { method: "HEAD" })
        .then((r) => {
          if (!r.ok) throw new Error("no");
          bgMusic.src = cfg.music;
          musicBtn.hidden = false;
        })
        .catch(() => {
          // Fallback: thử gán src trực tiếp (một số host không hỗ trợ HEAD)
          bgMusic.src = cfg.music;
          bgMusic.addEventListener(
            "canplaythrough",
            () => {
              musicBtn.hidden = false;
            },
            { once: true }
          );
          bgMusic.addEventListener(
            "error",
            () => {
              musicBtn.hidden = true;
            },
            { once: true }
          );
          bgMusic.load();
        });
    }
  }

  // ===== Password =====
  passForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (passInput.value || "").trim();
    if (val === String(cfg.password)) {
      passError.hidden = true;
      await tryPlayMusic();
      showScene("intro");
    } else {
      passError.hidden = false;
      passInput.value = "";
      passInput.focus();
      passBoxShake();
    }
  });

  function passBoxShake() {
    const box = $(".pass-box");
    box.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320 }
    );
  }

  // ===== Intro =====
  function runIntro() {
    introToken += 1;
    const token = introToken;
    const lines = cfg.intro || [];
    let i = 0;

    const step = () => {
      if (token !== introToken || current !== "intro") return;
      if (i >= lines.length) {
        window.setTimeout(() => {
          if (token === introToken) showScene("cake");
        }, 900);
        return;
      }

      introText.classList.remove("is-in");
      introSub.classList.remove("is-in");
      introRule.classList.remove("is-in");

      window.setTimeout(() => {
        if (token !== introToken || current !== "intro") return;
        introText.textContent = lines[i];
        introSub.textContent = i === lines.length - 1 ? "DÀNH CHO EM" : "THUÝ KIỀU";
        introText.classList.add("is-in");
        introRule.classList.add("is-in");
        introSub.classList.add("is-in");
        i += 1;
        window.setTimeout(step, 2400);
      }, 140);
    };

    step();
  }

  // ===== Cake from photo tiles =====
  /**
   * Layout bánh kem bằng các ô ảnh:
   * - Tầng dưới (rộng): 4 ô
   * - Tầng giữa: 3 ô
   * - Tầng trên: 2 ô
   * - Nến trên cùng
   */
  function cakeLayout(w, h) {
    const gap = 6;
    const bottomY = h * 0.72;
    const midY = h * 0.48;
    const topY = h * 0.28;
    const tileH = h * 0.2;
    const slots = [];

    const pushRow = (count, y, rowW) => {
      const tw = (rowW - gap * (count - 1)) / count;
      const startX = (w - rowW) / 2;
      for (let i = 0; i < count; i++) {
        slots.push({
          x: startX + i * (tw + gap),
          y,
          w: tw,
          h: tileH,
        });
      }
    };

    pushRow(4, bottomY, w * 0.96);
    pushRow(3, midY, w * 0.74);
    pushRow(2, topY, w * 0.5);

    return {
      slots,
      candle: {
        x: w / 2 - 5,
        y: topY - 42,
        w: 10,
        h: 36,
      },
    };
  }

  function runCake() {
    cakeStage.innerHTML = "";
    cakeNext.hidden = true;
    cakeCaption.textContent = "Đang làm bánh cho em…";

    const w = cakeStage.clientWidth;
    const h = cakeStage.clientHeight;
    const { slots, candle } = cakeLayout(w, h);
    const photos = cfg.photos;

    slots.forEach((slot, i) => {
      const tile = document.createElement("div");
      tile.className = "cake-tile";
      tile.style.width = `${slot.w}px`;
      tile.style.height = `${slot.h}px`;
      tile.style.left = `${slot.x}px`;
      tile.style.top = `${slot.y}px`;
      tile.style.setProperty("--spin", `${(Math.random() * 40 - 20).toFixed(1)}deg`);

      const img = document.createElement("img");
      img.src = photos[i % photos.length];
      img.alt = cfg.nickname;
      tile.appendChild(img);
      cakeStage.appendChild(tile);

      window.setTimeout(() => {
        tile.classList.add("is-placed");
      }, 280 + i * 220);
    });

    const candleEl = document.createElement("div");
    candleEl.className = "cake-candle-block";
    candleEl.style.left = `${candle.x}px`;
    candleEl.style.top = `${candle.y}px`;
    candleEl.style.setProperty("--spin", "12deg");
    cakeStage.appendChild(candleEl);

    const doneAt = 280 + slots.length * 220 + 700;
    window.setTimeout(() => {
      candleEl.classList.add("is-placed");
      cakeCaption.textContent = "Bánh sinh nhật của Thuý Kiều 🎂";
      cakeNext.hidden = false;
    }, doneAt);
  }

  cakeNext.addEventListener("click", () => showScene("letter"));
  surpriseBtn.addEventListener("click", () => showScene("fall"));

  // ===== Finale: mưa chữ/ảnh + gallery kéo xoay =====
  let fallTimer = null;

  function applyGalleryTransform() {
    fallWorld.style.transform = `rotateX(${galleryRot.x}deg) rotateY(${galleryRot.y}deg)`;
  }

  function startFinale() {
    buildOrbitGallery();
    startFallRain();
  }

  /** Ảnh + chữ rơi vào vòng 3D, rồi kéo xoay được */
  function buildOrbitGallery() {
    fallWorld.innerHTML = "";
    galleryRot = { x: 10, y: 0 };
    applyGalleryTransform();
    autoOrbit = false;
    fallHint.textContent = "Ảnh đang rơi xuống…";

    const photos = cfg.photos;
    const texts = cfg.fallingTexts || [];
    const items = [];

    // Mỗi ảnh 1 polaroid
    photos.forEach((src, i) => {
      items.push({ type: "photo", src, i });
    });
    // Thêm chữ hồng xen kẽ
    texts.slice(0, 6).forEach((t, i) => {
      items.push({ type: "text", text: t, i: photos.length + i });
    });

    const n = items.length;
    const cards = [];

    items.forEach((item, i) => {
      const card = document.createElement(item.type === "photo" ? "button" : "div");
      if (item.type === "photo") card.type = "button";
      card.className = "orbit-card";

      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
      const cx = 50 + Math.cos(angle) * (radius / window.innerWidth) * 105;
      const cy = 46 + Math.sin(angle) * (radius / window.innerHeight) * 88;
      const baseRot = ((i % 7) - 3) * 8;
      const z = ((i % 4) - 1.5) * 55;

      card.style.left = `calc(${cx}% - 70px)`;
      card.style.top = `calc(${cy}% - 90px)`;
      card.style.setProperty("--base-rot", `${baseRot}deg`);
      card.style.setProperty("--z", `${z}px`);
      card.style.setProperty("--spin", `${(Math.random() * 50 - 25).toFixed(1)}deg`);

      if (item.type === "photo") {
        const shot = document.createElement("span");
        shot.className = "shot";
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = cfg.nickname;
        img.draggable = false;
        shot.appendChild(img);
        card.appendChild(shot);
        card.addEventListener("click", () => {
          if (card.dataset.dragged === "1") {
            card.dataset.dragged = "0";
            return;
          }
          openLightbox(item.src);
        });
      } else {
        const glow = document.createElement("span");
        glow.className = "glow";
        glow.textContent = item.text;
        card.appendChild(glow);
      }

      fallWorld.appendChild(card);
      cards.push(card);

      window.setTimeout(() => {
        card.classList.add("is-in");
      }, 100 + i * 140);
    });

    const doneAt = 100 + n * 140 + 950;
    window.setTimeout(() => {
      cards.forEach((c, i) => {
        const baseRot = c.style.getPropertyValue("--base-rot");
        const z = c.style.getPropertyValue("--z");
        c.classList.remove("is-in");
        c.style.transform = `rotate(${baseRot}) translateZ(${z})`;
        c.classList.add("is-float");
        c.style.animationDelay = `${-(i * 0.28)}s`;
      });
      fallHint.textContent = "Kéo để xoay · Chạm ảnh để phóng to";
      autoOrbit = true;
    }, doneAt);
  }

  function startFallRain() {
    fallLayer.innerHTML = "";
    if (fallTimer) window.clearInterval(fallTimer);

    for (let i = 0; i < 12; i++) spawnFallItem(i * 120);

    fallTimer = window.setInterval(() => {
      if (current !== "fall") return;
      spawnFallItem(0);
    }, 520);
  }

  function spawnFallItem(delay) {
    // Nền chủ yếu là chữ hồng, ít ảnh hơn (gallery đã có ảnh)
    const isPhoto = Math.random() > 0.72;
    const el = document.createElement("div");
    el.className = `fall-item ${isPhoto ? "fall-photo" : "fall-text"}`;

    const left = 1 + Math.random() * 88;
    const dur = 8 + Math.random() * 10;
    const rot = Math.random() * 60 - 30;
    const spin = Math.random() * 70 - 35;
    const drift = (Math.random() - 0.5) * 120;
    const scale = isPhoto ? 0.5 + Math.random() * 0.45 : 0.75 + Math.random() * 0.5;

    el.style.left = `${left}%`;
    el.style.zIndex = String(Math.floor(Math.random() * 3));
    el.style.setProperty("--rot", `${rot}deg`);
    el.style.setProperty("--spin", `${spin}deg`);
    el.style.setProperty("--drift", `${drift}px`);
    el.style.animationDuration = `${dur}s`;
    el.style.animationDelay = `${delay}ms`;
    el.style.transform = `scale(${scale})`;

    if (isPhoto) {
      const img = document.createElement("img");
      img.src = cfg.photos[Math.floor(Math.random() * cfg.photos.length)];
      img.alt = "";
      el.appendChild(img);
    } else {
      const texts = cfg.fallingTexts || [];
      el.textContent = texts[Math.floor(Math.random() * texts.length)] || "Yêu em";
    }

    fallLayer.appendChild(el);
    window.setTimeout(() => el.remove(), delay + dur * 1000 + 200);
  }

  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }

  $("#lightboxClose").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  function onPointerDown(e) {
    if (current !== "fall") return;
    dragging = true;
    autoOrbit = false;
    const p = e.touches ? e.touches[0] : e;
    lastPointer = { x: p.clientX, y: p.clientY };
    fallStage.classList.add("is-dragging");
  }

  function onPointerMove(e) {
    if (!dragging || current !== "fall") return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - lastPointer.x;
    const dy = p.clientY - lastPointer.y;
    lastPointer = { x: p.clientX, y: p.clientY };
    galleryRot.y += dx * 0.28;
    galleryRot.x = Math.max(-28, Math.min(28, galleryRot.x - dy * 0.22));
    applyGalleryTransform();
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      $$(".orbit-card").forEach((el) => (el.dataset.dragged = "1"));
    }
    e.preventDefault();
  }

  function onPointerUp() {
    dragging = false;
    fallStage.classList.remove("is-dragging");
    window.setTimeout(() => {
      if (current === "fall") autoOrbit = true;
    }, 1500);
  }

  fallStage.addEventListener("mousedown", onPointerDown);
  fallStage.addEventListener("touchstart", onPointerDown, { passive: false });
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("touchend", onPointerUp);

  // ===== Music =====
  async function tryPlayMusic() {
    if (!cfg.music || musicBtn.hidden) return;
    try {
      await bgMusic.play();
      musicOn = true;
      musicBtn.classList.remove("is-off");
    } catch {
      musicOn = false;
      musicBtn.classList.add("is-off");
    }
  }

  musicBtn.addEventListener("click", () => {
    if (musicOn) {
      bgMusic.pause();
      musicOn = false;
      musicBtn.classList.add("is-off");
    } else {
      bgMusic.play().catch(() => {});
      musicOn = true;
      musicBtn.classList.remove("is-off");
    }
  });

  // ===== Particles (hearts / sparks) =====
  function resizeCanvas() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function seedHearts(n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "heart",
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 10 + Math.random() * 18,
        vy: -0.25 - Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.4,
        a: 0.2 + Math.random() * 0.4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.02,
      });
    }
  }

  function seedSparks(n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "spark",
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.8 + Math.random() * 1.8,
        a: 0.2 + Math.random() * 0.6,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  function tickFx() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Gallery tự xoay khi không kéo
    if (current === "fall" && autoOrbit && !dragging) {
      galleryRot.y += 0.1;
      applyGalleryTransform();
    }

    const show =
      current === "letter" || current === "fall" || current === "pass" || current === "cake";

    if (show) {
      if (particleMode === "hearts" && Math.random() < 0.06) {
        particles.push({
          kind: "heart",
          x: Math.random() * window.innerWidth,
          y: window.innerHeight + 12,
          r: 10 + Math.random() * 16,
          vy: -0.35 - Math.random() * 0.7,
          vx: (Math.random() - 0.5) * 0.5,
          a: 0.35 + Math.random() * 0.4,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.03,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.kind === "heart") {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          p.a -= 0.0012;
          if (p.a <= 0 || p.y < -30) {
            particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.fillStyle = "#d45a6a";
          ctx.font = `${p.r}px serif`;
          ctx.textAlign = "center";
          ctx.fillText("♥", 0, 0);
          ctx.restore();
        } else {
          p.tw += 0.05;
          ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin(p.tw));
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (particles.length > 80) particles.splice(0, particles.length - 80);
    }

    requestAnimationFrame(tickFx);
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (current === "cake") runCake();
    if (current === "fall") buildOrbitGallery();
  });

  // Boot
  initContent();
  resizeCanvas();
  seedHearts(12);
  tickFx();
  passInput.focus();
})();
