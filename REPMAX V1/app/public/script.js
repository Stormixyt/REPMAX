/* ============================================
   REPMAX — Interactions & Animations
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initScrollReveal();
  initNavScroll();
  initMobileMenu();
  initWaitlistForm();
  await hydrateLandingStats();
  await hydrateTrustpilotReviews();
  initCounterAnimation();
  initUltraStory();
  initDynamicTitle();
  initNotifications();
  checkReturningUser();
});

/* --- Scroll Reveal --- */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.reveal').forEach(el => {
    observer.observe(el);
  });
}

/* --- Nav Scroll Effect --- */
function initNavScroll() {
  const nav = document.querySelector('.nav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

/* --- Mobile Menu --- */
function initMobileMenu() {
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    const spans = hamburger.querySelectorAll('span');

    if (navLinks.classList.contains('mobile-open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  // Close menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    });
  });
}

/* --- Waitlist Form (submits to Supabase) --- */
const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI';
const LANDING_STATS_ENDPOINT = '/api/landing-stats';

function initWaitlistForm() {
  const forms = document.querySelectorAll('.waitlist-form');

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const email = input.value.trim().toLowerCase();

      if (!email || !isValidEmail(email)) {
        shakeElement(input);
        return;
      }

      const btn = form.querySelector('button');
      const originalText = btn.textContent;

      btn.textContent = 'Checking...';
      btn.style.opacity = '0.7';
      btn.disabled = true;

      try {
        // First check if already on waitlist
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=approved`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const existing = await checkRes.json();

        if (existing && existing.length > 0) {
          if (existing[0].approved) {
            // User is approved — show "Go to App" button
            form.innerHTML = `
              <div style="text-align:center;width:100%">
                <div style="font-size:1.2rem;font-weight:800;color:#D4FF00;margin-bottom:8px">You're Approved!</div>
                <p style="font-size:0.85rem;color:rgba(255,255,255,0.6);margin-bottom:16px">Your access has been granted. Welcome to REPMAX.</p>
                <a href="/auth" style="display:inline-block;padding:14px 40px;background:#D4FF00;color:#070707;font-weight:800;border-radius:12px;text-decoration:none;font-size:0.95rem;transition:transform 0.2s">Open REPMAX</a>
              </div>
            `;
            localStorage.setItem('repmax_waitlist_email', email);
            showToast('Access Granted!', 'You\'ve been approved. Let\'s go!');
            return;
          } else {
            // Already on waitlist but not approved
            btn.textContent = 'Already on the list!';
            btn.style.background = '#3b82f6';
            input.value = '';
            showToast('Hang tight!', 'You\'re on the waitlist. We\'ll notify you when approved.');
          }
        } else {
          // New signup
          const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ email })
          });

          if (res.ok || res.status === 201) {
            localStorage.setItem('repmax_waitlist_email', email);
            btn.textContent = 'You\'re In!';
            btn.style.background = '#22c55e';
            input.value = '';
            input.placeholder = 'Check your email for updates';
            showToast('Welcome to REPMAX!', 'You\'re on the early access list.');
            incrementWaitlistCount();
          } else {
            throw new Error('Failed');
          }
        }
      } catch (err) {
        btn.textContent = 'You\'re In!';
        btn.style.background = '#22c55e';
        input.value = '';
        showToast('Welcome to REPMAX!', 'You\'re on the early access list.');
      }

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.opacity = '1';
        btn.disabled = false;
        input.placeholder = 'Enter your email';
      }, 4000);
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shakeElement(el) {
  el.style.animation = 'shake 0.5s ease';
  el.style.borderColor = '#ef4444';
  setTimeout(() => {
    el.style.animation = '';
    el.style.borderColor = '';
  }, 600);
}

// Add shake keyframes
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

/* --- Live Landing Stats --- */
async function hydrateLandingStats() {
  try {
    const res = await fetch(LANDING_STATS_ENDPOINT, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error(`Stats request failed with ${res.status}`);

    const stats = await res.json();
    setLiveStat('waitlist', stats.waitlist);
    setLiveStat('trainingSplits', stats.trainingSplits);
    setLiveStat('exercises', stats.exercises);
    setLiveStat('aiPersonalized', stats.aiPersonalized);
  } catch (error) {
    console.warn('[REPMAX] Failed to load live landing stats:', error);
  }
}

function setLiveStat(key, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return;

  document.querySelectorAll(`[data-stat-key="${key}"]`).forEach((el) => {
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';

    el.setAttribute('data-count', String(Math.round(value)));
    el.textContent = `${prefix}0${suffix}`;
  });
}

/* --- Counter Animation --- */
function initCounterAnimation() {
  const counters = document.querySelectorAll('[data-count]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-count'));
  const suffix = el.getAttribute('data-suffix') || '';
  const prefix = el.getAttribute('data-prefix') || '';
  const duration = 2000;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4); // ease out quart
    const current = Math.floor(eased * target);

    el.textContent = prefix + current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/* --- Trustpilot Reviews --- */
const TRUSTPILOT_REVIEWS_ENDPOINT = '/api/trustpilot-reviews';

async function hydrateTrustpilotReviews() {
  const grid = document.getElementById('trustpilot-reviews-grid');
  const controls = document.getElementById('trustpilot-carousel-controls');
  const prevBtn = document.getElementById('trustpilot-prev');
  const nextBtn = document.getElementById('trustpilot-next');
  const scoreValue = document.getElementById('trustpilot-score-value');
  const scoreLabel = document.getElementById('trustpilot-score-label');
  const reviewCount = document.getElementById('trustpilot-review-count');
  const stars = document.getElementById('trustpilot-stars');
  const cta = document.getElementById('trustpilot-cta');

  if (!grid || !scoreValue || !scoreLabel || !reviewCount || !stars) return;

  try {
    const response = await fetch(TRUSTPILOT_REVIEWS_ENDPOINT, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Trustpilot request failed with ${response.status}`);
    }

    const payload = await response.json();
    const reviews = Array.isArray(payload.reviews)
      ? payload.reviews.filter((review) => Number(review?.rating || 0) >= 3.5)
      : [];

    const trustScore = Number(payload?.business?.trustScore || payload?.business?.score || 0);
    const totalReviews = Number(payload?.business?.numberOfReviews || 0);
    const sourceUrl = payload?.sourceUrl || 'https://nl.trustpilot.com/review/rep-max.app';

    scoreValue.textContent = trustScore > 0 ? trustScore.toFixed(1) : '--';
    scoreLabel.textContent = trustScore > 0 ? 'TrustScore on Trustpilot' : 'Trustpilot public profile';
    reviewCount.textContent = totalReviews > 0
      ? `${totalReviews.toLocaleString()} public review${totalReviews === 1 ? '' : 's'}`
      : 'Waiting for public reviews';
    stars.innerHTML = buildTrustpilotStars(Math.round(trustScore || 4));

    if (cta) {
      cta.href = sourceUrl;
    }

    if (!reviews.length) {
      if (controls) controls.hidden = true;
      grid.innerHTML = `
        <article class="trustpilot-empty-state">
          <div class="trustpilot-empty-kicker">No qualifying public reviews yet</div>
          <h3>The section is live and ready.</h3>
          <p>
            As soon as more public Trustpilot reviews appear for REPMAX, they will show here automatically.
          </p>
        </article>
      `;
      return;
    }

    grid.innerHTML = reviews.slice(0, 6).map((review) => {
      const title = escapeHtml(review.title || 'Trustpilot review');
      const text = escapeHtml(truncateReviewText(review.text || '', 220));
      const name = escapeHtml(review.consumer?.displayName || 'Trustpilot reviewer');
      const country = escapeHtml(review.consumer?.countryCode || 'Trustpilot');
      const reviewMeta = review.consumer?.numberOfReviews
        ? `${Number(review.consumer.numberOfReviews)} review${Number(review.consumer.numberOfReviews) === 1 ? '' : 's'}`
        : 'New reviewer';
      const published = formatTrustpilotDate(review.publishedDate);
      const verified = review.verification?.isVerified
        ? '<span class="trustpilot-verified-pill">Verified</span>'
        : '';
      const avatar = escapeHtml((review.consumer?.displayName || 'T').trim().charAt(0).toUpperCase() || 'T');

      return `
        <article class="trustpilot-review-card">
          <div class="trustpilot-review-top">
            <div class="trustpilot-reviewer-shell">
              <div class="trustpilot-avatar">${avatar}</div>
              <div class="trustpilot-reviewer-copy">
                <div class="trustpilot-reviewer-name">${name}</div>
                <div class="trustpilot-reviewer-meta">${country} · ${reviewMeta}</div>
              </div>
            </div>
            ${verified}
          </div>

          <div class="trustpilot-stars compact" aria-label="${review.rating} stars">
            ${buildTrustpilotStars(review.rating)}
          </div>

          <h3 class="trustpilot-review-title">${title}</h3>
          <p class="trustpilot-review-text">${text || 'This reviewer left a rating without extra text.'}</p>

          <div class="trustpilot-review-footer">
            <span>${published}</span>
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">View on Trustpilot</a>
          </div>
        </article>
      `;
    }).join('');

    initTrustpilotCarousel(grid, prevBtn, nextBtn, controls);
  } catch (error) {
    console.warn('[REPMAX] Failed to load Trustpilot reviews:', error);
    scoreValue.textContent = '--';
    scoreLabel.textContent = 'Trustpilot temporarily unavailable';
    reviewCount.textContent = 'Could not load public reviews right now';
    stars.innerHTML = buildTrustpilotStars(4);
    if (controls) controls.hidden = true;
    grid.innerHTML = `
      <article class="trustpilot-empty-state">
        <div class="trustpilot-empty-kicker">Could not load Trustpilot right now</div>
        <h3>The live review feed is temporarily unavailable.</h3>
        <p>Open the full Trustpilot page directly to read the latest public reviews.</p>
      </article>
    `;
  }
}

function initTrustpilotCarousel(track, prevBtn, nextBtn, controls) {
  if (!track || !prevBtn || !nextBtn || !controls) return;

  const card = track.querySelector('.trustpilot-review-card');
  if (!card) {
    controls.hidden = true;
    return;
  }

  const updateButtons = () => {
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const hasOverflow = maxScroll > 8;
    controls.hidden = !hasOverflow;

    if (!hasOverflow) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    prevBtn.disabled = track.scrollLeft <= 8;
    nextBtn.disabled = track.scrollLeft >= maxScroll - 8;
  };

  const getStep = () => {
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '16') || 16;
    return card.getBoundingClientRect().width + gap;
  };

  prevBtn.onclick = () => {
    track.scrollBy({ left: -getStep(), behavior: 'smooth' });
  };

  nextBtn.onclick = () => {
    track.scrollBy({ left: getStep(), behavior: 'smooth' });
  };

  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons, { passive: true });
  updateButtons();
}

function buildTrustpilotStars(rating = 0) {
  const normalized = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return Array.from({ length: 5 }, (_, index) => {
    const filled = index < normalized ? 'is-filled' : '';
    return `<span class="star ${filled}">★</span>`;
  }).join('');
}

function formatTrustpilotDate(dateValue) {
  if (!dateValue) return 'Recent review';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Recent review';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function truncateReviewText(text, limit = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trim()}…`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- ULTRA Immersive Scroll Scenes --- */
function initUltraStory() {
  // Entry bar animation
  const entryBars = document.querySelector('[data-ultra-animate-bars]');
  if (entryBars) {
    const entryObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.ultra-entry-fill').forEach(fill => {
            const val = fill.getAttribute('data-fill');
            fill.style.setProperty('--fill', val);
            fill.classList.add('is-animated');
          });
          entryObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    entryObserver.observe(entryBars);
  }

  // Scene reveal
  const scenes = document.querySelectorAll('.ultra-scene');
  if (!scenes.length) return;

  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const section = entry.target;
        section.querySelectorAll('.ultra-scene-copy, .ultra-scene-panel').forEach(el => {
          el.classList.add('is-visible');
        });

        // Animate bars inside scene panels
        section.querySelectorAll('.ultra-entry-fill').forEach(fill => {
          const val = fill.getAttribute('data-fill');
          fill.style.setProperty('--fill', val);
          fill.classList.add('is-animated');
        });

        sceneObserver.unobserve(section);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  scenes.forEach(scene => sceneObserver.observe(scene));

  // Parallax orbs on scroll
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      scenes.forEach(scene => {
        const rect = scene.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.top < vh && rect.bottom > 0) {
          const progress = (vh - rect.top) / (vh + rect.height);
          const orb = scene.querySelector('.ultra-scene-orb');
          if (orb) {
            orb.style.transform = `translate3d(${progress * 30 - 15}px, ${progress * -60 + 30}px, 0)`;
          }
        }
      });
      ticking = false;
    });
  }, { passive: true });
}

/* --- Dynamic Title Text --- */
function initDynamicTitle() {
  const highlightSpan = document.querySelector('.hero-title .highlight');
  if (!highlightSpan) return;

  const words = ['Training Partner', 'Spotter', 'Strength Coach', 'Gym Bro', 'Programmer'];
  let currentIdx = 0;

  // Set initial transition styles
  highlightSpan.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  highlightSpan.style.display = 'inline-block';

  setInterval(() => {
    // Fade out and translate down slightly
    highlightSpan.style.opacity = '0';
    highlightSpan.style.transform = 'translateY(10px)';

    setTimeout(() => {
      // Change text while invisible
      currentIdx = (currentIdx + 1) % words.length;
      highlightSpan.textContent = words[currentIdx];

      // Jump to top quickly without transition
      highlightSpan.style.transition = 'none';
      highlightSpan.style.transform = 'translateY(-10px)';

      // Force reflow
      void highlightSpan.offsetWidth;

      // Fade in and translate to center
      highlightSpan.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      highlightSpan.style.opacity = '1';
      highlightSpan.style.transform = 'translateY(0)';
    }, 400); // Wait for fade out
  }, 3500); // Change every 3.5s
}

/* --- Notifications (Social Proof & Live Signups) --- */
function initNotifications() {
  // 1. Fake Signups (Less frequent, more realistic)
  const names = [
    'Marcus K.', 'Jake T.', 'Aiden S.', 'David L.', 'Omar M.',
    'Ethan R.', 'Lucas F.', 'Kai N.', 'Noah W.', 'Liam B.',
    'Mateo C.', 'Julian H.', 'Alex P.', 'Chris D.'
  ];

  const messages = [
    'just joined the waitlist',
    'secured their early access spot',
    'just got on the waitlist'
  ];

  function showRandomNotification() {
    const name = names[Math.floor(Math.random() * names.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    showToast(name, msg);
  }

  // Show fake ones every 45 to 90 seconds (much less annoying)
  setTimeout(() => {
    showRandomNotification();
    setInterval(() => {
      showRandomNotification();
    }, 45000 + Math.random() * 45000);
  }, 20000);

  // 2. REAL Live Signups via Supabase Websockets
  try {
    const channel = supabase.channel('public:waitlist')
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waitlist' }, payload => {
      // Whenever ANYONE inserts into the waitlist DB, trigger a toast immediately
      showToast('A new lifter', 'just joined the waitlist! 🚀');
      incrementWaitlistCount();
    }).subscribe();
  } catch (err) {
    console.warn('Realtime subscription failed', err);
  }
}

/* --- Toast System --- */
let toastTimeout;

function showToast(title, message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
    <div class="toast-text">
      ${title}
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  // Auto hide
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 600);
  }, 4000);
}

/* --- Increment Waitlist Counter --- */
function incrementWaitlistCount() {
  document.querySelectorAll('[data-stat-key="waitlist"]').forEach((el) => {
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const current = parseInt(el.getAttribute('data-count') || el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
    const nextValue = current + 1;

    el.setAttribute('data-count', String(nextValue));
    el.textContent = `${prefix}${nextValue.toLocaleString()}${suffix}`;
  });
}

/* --- Smooth scroll for anchor links --- */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link) {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

/* --- Parallax on hero gradient --- */
window.addEventListener('mousemove', (e) => {
  const gradients = document.querySelectorAll('.hero-gradient');
  const x = (e.clientX / window.innerWidth - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 30;

  gradients.forEach((g, i) => {
    const factor = i === 0 ? 1 : -0.5;
    g.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
  });
}, { passive: true });

/* --- Check if returning user is approved --- */
async function checkReturningUser() {
  const savedEmail = localStorage.getItem('repmax_waitlist_email');
  if (!savedEmail) return;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(savedEmail)}&select=approved`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const data = await res.json();

    if (data && data.length > 0 && data[0].approved) {
      // User is approved — replace ALL waitlist forms with "You're Approved!"
      document.querySelectorAll('.waitlist-form').forEach(form => {
        form.innerHTML = `
          <div style="text-align:center;width:100%">
            <div style="font-size:1.2rem;font-weight:800;color:#D4FF00;margin-bottom:8px">You're Approved!</div>
            <p style="font-size:0.85rem;color:rgba(255,255,255,0.6);margin-bottom:16px">Your access has been granted. Welcome to REPMAX.</p>
            <a href="/auth" style="display:inline-block;padding:14px 40px;background:#D4FF00;color:#070707;font-weight:800;border-radius:12px;text-decoration:none;font-size:0.95rem">Open REPMAX</a>
          </div>
        `;
      });
    }
  } catch (err) {
    // Silently fail — don't disrupt the page
  }
}
