// Mobile navigation toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

// Close mobile nav after clicking a link
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
  });
});



// "Show more" buttons expand the extra text in project cards
document.querySelectorAll(".show-more").forEach((button) => {
  const moreText = document.getElementById(button.getAttribute("aria-controls"));

  button.addEventListener("click", () => {
    const isOpen = moreText.classList.toggle("open");
    moreText.setAttribute("aria-hidden", String(!isOpen));
    button.setAttribute("aria-expanded", String(isOpen));
    button.textContent = isOpen ? "Show less" : "Show more";
  });
});

// Automatically update footer year
const yearElement = document.getElementById("year");
yearElement.textContent = new Date().getFullYear();

// Hero animation: twinkling stars, a rotating Earth, and a CubeSat in orbit
// scanning the ground with an infrared beam (a nod to CySat's fire detection mission)
const heroCanvas = document.getElementById("heroCanvas");

if (heroCanvas) {
  const ctx = heroCanvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ORBIT_TILT = -0.28;
  const ORBIT_SPEED = 0.35; // radians per second
  const EARTH_SPIN = 0.05;

  let width = 0;
  let height = 0;
  let stars = [];
  let earth = { x: 0, y: 0, r: 0 };
  let shootingStar = null;
  let time = 2;
  let lastTime = 0;
  let running = false;
  let heroVisible = true;
  const mouse = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };

  // Seeded random so the continents look the same on every visit
  let seed = 42;
  const seededRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Continents and clouds are blobs placed on a sphere (longitude/latitude in radians)
  const landColors = ["#2f6f4a", "#3a7d4f", "#4d7c3a", "#6b7a45"];
  const land = [];
  for (let c = 0; c < 6; c++) {
    // Each continent is a random walk of small overlapping blobs
    let lon = seededRandom() * Math.PI * 2;
    let lat = (seededRandom() - 0.5) * 1.4;
    const count = 14 + Math.floor(seededRandom() * 14);
    for (let i = 0; i < count; i++) {
      lon += (seededRandom() - 0.5) * 0.22;
      lat = Math.max(-1.2, Math.min(1.2, lat + (seededRandom() - 0.5) * 0.2));
      land.push({
        lon,
        lat,
        size: 0.025 + seededRandom() * 0.055,
        color: landColors[Math.floor(seededRandom() * landColors.length)],
        fire: seededRandom() < 0.04,
      });
    }
  }

  // Clouds are short streaks of faint puffs
  const clouds = [];
  for (let s = 0; s < 10; s++) {
    const lon = seededRandom() * Math.PI * 2;
    const lat = (seededRandom() - 0.5) * 2;
    for (let i = 0; i < 5; i++) {
      clouds.push({
        lon: lon + i * 0.07,
        lat: lat + (seededRandom() - 0.5) * 0.06,
        size: 0.02 + seededRandom() * 0.04,
      });
    }
  }

  // Convert a point on the globe to screen coordinates
  const project = (lon, lat, rotation) => {
    const angle = lon + rotation;
    return {
      x: earth.x + earth.r * Math.sin(angle) * Math.cos(lat),
      y: earth.y - earth.r * Math.sin(lat),
      facing: Math.cos(angle) * Math.cos(lat),
      squashX: Math.cos(angle),
      squashY: Math.cos(lat),
    };
  };

  // Position on the tilted elliptical orbit; front > 0 means in front of Earth
  const orbitPoint = (angle) => {
    const ox = Math.cos(angle) * earth.r * 1.35;
    const oy = Math.sin(angle) * earth.r * 0.42;
    return {
      x: earth.x + ox * Math.cos(ORBIT_TILT) - oy * Math.sin(ORBIT_TILT),
      y: earth.y + ox * Math.sin(ORBIT_TILT) + oy * Math.cos(ORBIT_TILT),
      front: Math.sin(angle),
    };
  };

  const resize = () => {
    const rect = heroCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    heroCanvas.width = Math.round(width * dpr);
    heroCanvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Earth sits to the right of the text on wide screens, and peeks up from the bottom on phones
    if (width >= 768) {
      const r = Math.min(width * 0.26, height * 0.5);
      earth = { r, x: width - r * 0.45, y: height * 0.62 };
    } else {
      const r = width * 0.45;
      earth = { r, x: width * 0.75, y: height - r * 0.3 };
    }

    const starCount = Math.round((width * height) / 3500);
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.2 + 0.2,
      depth: Math.random() * 0.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 1.5 + 0.5,
    }));

    draw();
  };

  const drawStars = () => {
    for (const star of stars) {
      const drift = time * 4 * star.depth;
      const x = (((star.x - drift + parallax.x * 12 * star.depth) % width) + width) % width;
      const y = star.y + parallax.y * 8 * star.depth;
      ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.twinkle + star.phase));
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const updateShootingStar = (dt) => {
    if (!shootingStar && Math.random() < dt * 0.08) {
      shootingStar = {
        x: width * (0.3 + Math.random() * 0.7),
        y: Math.random() * height * 0.4,
        vx: -(400 + Math.random() * 300),
        vy: 150 + Math.random() * 100,
        life: 1,
      };
    }
    if (shootingStar) {
      shootingStar.x += shootingStar.vx * dt;
      shootingStar.y += shootingStar.vy * dt;
      shootingStar.life -= dt * 1.2;
      if (shootingStar.life <= 0) shootingStar = null;
    }
  };

  const drawShootingStar = () => {
    if (!shootingStar) return;
    const { x, y, vx, vy, life } = shootingStar;
    const tailX = x - vx * 0.15;
    const tailY = y - vy * 0.15;
    const gradient = ctx.createLinearGradient(x, y, tailX, tailY);
    gradient.addColorStop(0, `rgba(226, 232, 240, ${life})`);
    gradient.addColorStop(1, "rgba(226, 232, 240, 0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  };

  const drawBlob = (point, size, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      size * earth.r * Math.max(point.squashX, 0.1),
      size * earth.r * Math.max(point.squashY, 0.3) * 0.9,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  };

  const drawEarth = () => {
    const { x, y, r } = earth;
    const rotation = time * EARTH_SPIN;

    // Atmosphere glow
    const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.25);
    glow.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    glow.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Oceans
    const ocean = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    ocean.addColorStop(0, "#1d6fb8");
    ocean.addColorStop(0.6, "#0b2a5b");
    ocean.addColorStop(1, "#061633");
    ctx.fillStyle = ocean;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // Continents
    for (const blob of land) {
      const point = project(blob.lon, blob.lat, rotation);
      if (point.facing <= 0) continue;
      ctx.globalAlpha = 0.3 + 0.6 * point.facing;
      drawBlob(point, blob.size, blob.color);
    }

    // Wildfire hotspots the CubeSat is looking for
    for (const blob of land) {
      if (!blob.fire) continue;
      const point = project(blob.lon, blob.lat, rotation);
      if (point.facing <= 0.15) continue;
      const pulse = 0.6 + 0.4 * Math.sin(time * 3 + blob.lon * 5);
      const glowSize = r * 0.05 * pulse;
      const fire = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowSize);
      fire.addColorStop(0, "rgba(253, 186, 116, 1)");
      fire.addColorStop(0.4, "rgba(249, 115, 22, 0.8)");
      fire.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.globalAlpha = point.facing;
      ctx.fillStyle = fire;
      ctx.beginPath();
      ctx.arc(point.x, point.y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds drift a little faster than the ground
    for (const cloud of clouds) {
      const point = project(cloud.lon, cloud.lat, rotation * 1.4);
      if (point.facing <= 0) continue;
      ctx.globalAlpha = 0.16 * point.facing;
      drawBlob(point, cloud.size, "#f8fafc");
    }
    ctx.globalAlpha = 1;

    // Night-side shading (sunlight comes from the upper left)
    const shade = ctx.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.2, x - r * 0.45, y - r * 0.5, r * 2.1);
    shade.addColorStop(0, "rgba(2, 6, 23, 0)");
    shade.addColorStop(0.5, "rgba(2, 6, 23, 0.15)");
    shade.addColorStop(1, "rgba(2, 6, 23, 0.9)");
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();

    // Thin rim of atmosphere
    ctx.strokeStyle = "rgba(125, 211, 252, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  // Draw half of the orbit path (back half before Earth, front half after)
  const drawOrbit = (startAngle, endAngle, alpha) => {
    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const point = orbitPoint(startAngle + ((endAngle - startAngle) * i) / 60);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Infrared scan beam from the satellite down toward the planet
  const drawScanBeam = (sat) => {
    const dx = earth.x - sat.x;
    const dy = earth.y - sat.y;
    const distance = Math.hypot(dx, dy);
    const length = distance - earth.r * 0.6;
    if (length <= 0) return;

    const dirX = dx / distance;
    const dirY = dy / distance;
    const sweep = Math.sin(time * 2) * earth.r * 0.08;
    const spread = earth.r * 0.14;
    const endX = sat.x + dirX * length - dirY * sweep;
    const endY = sat.y + dirY * length + dirX * sweep;

    const beam = ctx.createLinearGradient(sat.x, sat.y, endX, endY);
    beam.addColorStop(0, `rgba(251, 146, 60, ${0.45 * sat.front})`);
    beam.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(sat.x, sat.y);
    ctx.lineTo(endX - dirY * spread, endY + dirX * spread);
    ctx.lineTo(endX + dirY * spread, endY - dirX * spread);
    ctx.closePath();
    ctx.fill();
  };

  const drawSatellite = (sat) => {
    const scale = 0.8 + 0.25 * (sat.front + 1);
    const u = Math.max(earth.r * 0.055, 8) * scale;

    ctx.save();
    ctx.translate(sat.x, sat.y);
    ctx.rotate(ORBIT_TILT + Math.sin(time * 0.6) * 0.15);
    ctx.globalAlpha = sat.front < 0 ? 0.55 : 1;

    // Strut connecting the panels
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = Math.max(1, u * 0.08);
    ctx.beginPath();
    ctx.moveTo(-u * 0.9, 0);
    ctx.lineTo(u * 0.9, 0);
    ctx.stroke();

    // Solar panels
    for (const side of [-1, 1]) {
      const panelX = side < 0 ? -u * 0.7 - u * 1.6 : u * 0.7;
      const panel = ctx.createLinearGradient(panelX, -u * 0.4, panelX + u * 1.6, u * 0.4);
      panel.addColorStop(0, "#1e3a8a");
      panel.addColorStop(1, "#2563eb");
      ctx.fillStyle = panel;
      ctx.fillRect(panelX, -u * 0.4, u * 1.6, u * 0.8);

      ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
      ctx.lineWidth = Math.max(0.5, u * 0.04);
      ctx.strokeRect(panelX, -u * 0.4, u * 1.6, u * 0.8);
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(panelX + (u * 1.6 * i) / 4, -u * 0.4);
        ctx.lineTo(panelX + (u * 1.6 * i) / 4, u * 0.4);
      }
      ctx.moveTo(panelX, 0);
      ctx.lineTo(panelX + u * 1.6, 0);
      ctx.stroke();
    }

    // CubeSat body
    const body = ctx.createLinearGradient(-u / 2, -u / 2, u / 2, u / 2);
    body.addColorStop(0, "#f1f5f9");
    body.addColorStop(1, "#94a3b8");
    ctx.fillStyle = body;
    ctx.fillRect(-u / 2, -u / 2, u, u);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = Math.max(1, u * 0.08);
    ctx.strokeRect(-u / 2, -u / 2, u, u);

    // Gold thermal foil and infrared camera lens
    ctx.fillStyle = "rgba(251, 191, 36, 0.75)";
    ctx.fillRect(-u * 0.32, -u * 0.32, u * 0.64, u * 0.64);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(0.75, u * 0.06);
    ctx.stroke();

    // Antenna with blinking light
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = Math.max(0.75, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -u / 2);
    ctx.lineTo(u * 0.25, -u * 1.1);
    ctx.stroke();
    if (Math.sin(time * 4) > 0.6) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(u * 0.25, -u * 1.1, Math.max(1.5, u * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Faint blue haze around the planet
    const haze = ctx.createRadialGradient(earth.x, earth.y, earth.r, earth.x, earth.y, earth.r * 2.6);
    haze.addColorStop(0, "rgba(56, 189, 248, 0.08)");
    haze.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    drawStars();
    drawShootingStar();

    // Earth, orbit, and satellite shift slightly with the mouse for depth
    ctx.save();
    ctx.translate(parallax.x * -10, parallax.y * -8);
    const sat = orbitPoint(time * ORBIT_SPEED);
    drawOrbit(Math.PI, Math.PI * 2, 0.15);
    if (sat.front < 0) drawSatellite(sat);
    drawEarth();
    drawOrbit(0, Math.PI, 0.35);
    if (sat.front >= 0) {
      drawScanBeam(sat);
      drawSatellite(sat);
    }
    ctx.restore();
  }

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time += dt;
    parallax.x += (mouse.x - parallax.x) * 0.05;
    parallax.y += (mouse.y - parallax.y) * 0.05;
    updateShootingStar(dt);
    draw();
    requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || reduceMotion || !heroVisible || document.hidden) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
  };

  // Only animate while the hero is on screen and the tab is visible
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    if (heroVisible) start();
    else stop();
  }).observe(heroCanvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("resize", resize);

  resize();
  start();
}
