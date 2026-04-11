/* ============================================
   REPMAX — Interactions & Animations
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initScrollReveal();
  initNavScroll();
  initMobileMenu();
  initWaitlistForm();
  await Promise.allSettled([
    hydrateLandingStats(),
    hydrateTrustpilotReviews()
  ]);
  initCounterAnimation();
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
const TRUSTPILOT_REVIEWS_ENDPOINT = '/api/trustpilot-reviews';

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

/* --- Trustpilot Reviews --- */
async function hydrateTrustpilotReviews() {
  const summaryEl = document.querySelector('#trustpilot-summary');
  const gridEl = document.querySelector('#trustpilot-review-grid');

  if (!summaryEl || !gridEl) return;

  try {
    const response = await fetch(TRUSTPILOT_REVIEWS_ENDPOINT, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Trustpilot request failed with ${response.status}`);
    }

    const payload = await response.json();
    renderTrustpilotSummary(summaryEl, payload);
    renderTrustpilotReviews(gridEl, payload);
  } catch (error) {
    console.warn('[REPMAX] Failed to load Trustpilot reviews:', error);
    const fallbackPayload = {
      business: { name: 'REPMAX', trustScore: 0, numberOfReviews: 0 },
      reviews: [],
      minimumRating: 4,
      sourceUrl: 'https://nl.trustpilot.com/review/rep-max.app',
      error: 'unavailable'
    };
    renderTrustpilotSummary(summaryEl, fallbackPayload);
    renderTrustpilotReviews(gridEl, fallbackPayload);
  }
}

function renderTrustpilotSummary(container, payload) {
  const business = payload?.business || {};
  const reviewCount = Number(business.numberOfReviews || 0);
  const trustScore = Number(business.trustScore || 0);
  const minimumRating = Number(payload?.minimumRating || 4);
  const sourceUrl = payload?.sourceUrl || 'https://nl.trustpilot.com/review/rep-max.app';
  const hasQualifyingReviews = Array.isArray(payload?.reviews) && payload.reviews.length > 0;

  if (reviewCount === 0) {
    container.innerHTML = `
      <div class="trust-summary-head">
        <span class="trust-summary-kicker">Trustpilot profile live</span>
        <span class="trust-summary-pill">Waiting for first review</span>
      </div>
      <div class="trust-summary-main trust-summary-main-empty">
        <div>
          <strong>No public Trustpilot reviews yet.</strong>
          <p>The profile is live. Once public reviews land, this section will switch from placeholder mode to real review cards automatically.</p>
        </div>
      </div>
      <a href="${sourceUrl}" class="trust-summary-link" target="_blank" rel="noopener noreferrer">Open the Trustpilot profile</a>
    `;
    return;
  }

  const qualityLabel = hasQualifyingReviews
    ? `Showing ${minimumRating}-star and 5-star public reviews only`
    : `No ${minimumRating}-star and 5-star reviews available yet`;

  container.innerHTML = `
    <div class="trust-summary-head">
      <span class="trust-summary-kicker">Trustpilot signal</span>
      <span class="trust-summary-pill">${escapeHtml(qualityLabel)}</span>
    </div>
    <div class="trust-summary-main">
      <div class="trust-summary-score">${trustScore > 0 ? trustScore.toFixed(1) : '0.0'}</div>
      <div class="trust-summary-meta">
        <strong>${escapeHtml(business.name || 'REPMAX')}</strong>
        <p>${reviewCount.toLocaleString()} public review${reviewCount === 1 ? '' : 's'} on Trustpilot</p>
      </div>
    </div>
    <div class="trust-summary-bar">
      ${renderTrustpilotStars(Math.round(trustScore))}
    </div>
    <a href="${sourceUrl}" class="trust-summary-link" target="_blank" rel="noopener noreferrer">Verify on Trustpilot</a>
  `;
}

function renderTrustpilotReviews(container, payload) {
  const reviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
  const minimumRating = Number(payload?.minimumRating || 4);
  const sourceUrl = payload?.sourceUrl || 'https://nl.trustpilot.com/review/rep-max.app';

  if (!reviews.length) {
    const emptyTitle = payload?.error === 'unavailable'
      ? 'Trustpilot is not responding right now.'
      : `No public ${minimumRating}-star and 5-star reviews yet.`;
    const emptyBody = payload?.error === 'unavailable'
      ? 'The live review feed is temporarily unavailable, but the profile button below still takes people to Trustpilot directly.'
      : 'As soon as qualifying public reviews show up for REPMAX, they will appear here automatically instead of fake testimonial cards.';

    container.innerHTML = `
      <article class="trust-review-card trust-review-empty">
        <span class="trust-review-tag">Live section ready</span>
        <h3>${escapeHtml(emptyTitle)}</h3>
        <p>${escapeHtml(emptyBody)}</p>
        <a href="${sourceUrl}" class="trust-inline-link" target="_blank" rel="noopener noreferrer">Open Trustpilot</a>
      </article>
    `;
    return;
  }

  container.innerHTML = reviews.map((review) => {
    const publishedDate = formatReviewDate(review.publishedDate);
    const reviewCountLabel = Number(review.consumer?.numberOfReviews || 0);
    const countryCode = review.consumer?.countryCode ? ` ${escapeHtml(review.consumer.countryCode)}` : '';
    const avatar = getReviewerInitial(review.consumer?.displayName);

    return `
      <article class="trust-review-card">
        <div class="trust-review-top">
          <div class="trust-review-stars" aria-label="Rated ${Number(review.rating || 0)} out of 5">
            ${renderTrustpilotStars(Number(review.rating || 0))}
          </div>
          <span class="trust-review-date">${escapeHtml(publishedDate)}</span>
        </div>
        <h3>${escapeHtml(review.title || 'Trustpilot review')}</h3>
        <p>${escapeHtml(review.text || '')}</p>
        <div class="trust-review-footer">
          <div class="trust-review-avatar">${escapeHtml(avatar)}</div>
          <div class="trust-review-author">
            <strong>${escapeHtml(review.consumer?.displayName || 'Trustpilot reviewer')}</strong>
            <span>${reviewCountLabel} review${reviewCountLabel === 1 ? '' : 's'}${countryCode}</span>
          </div>
          ${review.verification?.isVerified ? '<span class="trust-review-verified">Verified</span>' : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderTrustpilotStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating || 0)));
  return Array.from({ length: 5 }, (_, index) => {
    const active = index < safeRating ? ' active' : '';
    return `<span class="trust-star${active}"></span>`;
  }).join('');
}

function formatReviewDate(value) {
  if (!value) return 'Recent review';

  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'Recent review';
  }
}

function getReviewerInitial(name) {
  const first = String(name || 'R').trim().charAt(0).toUpperCase();
  return first || 'R';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  // REAL live signups via Supabase Realtime
  try {
    const channel = supabase.channel('public:waitlist')
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waitlist' }, payload => {
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
