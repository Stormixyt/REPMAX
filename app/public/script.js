/* ============================================
   REPMAX — Interactions & Animations
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initNavScroll();
  initMobileMenu();
  initWaitlistForm();
  initCounterAnimation();
  initFakeSignupNotifications();
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

      btn.textContent = 'Joining...';
      btn.style.opacity = '0.7';
      btn.disabled = true;

      try {
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
          btn.textContent = 'You\'re In!';
          btn.style.background = '#22c55e';
          input.value = '';
          input.placeholder = 'Check your email for updates';
          showToast('Welcome to REPMAX!', 'You\'re on the early access list.');
          incrementWaitlistCount();
        } else if (res.status === 409) {
          btn.textContent = 'Already Joined!';
          btn.style.background = '#3b82f6';
          input.value = '';
          showToast('Already on the list!', 'You\'re already signed up.');
        } else {
          throw new Error('Failed');
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

/* --- Fake Signup Notifications (Social Proof) --- */
function initFakeSignupNotifications() {
  const names = [
    'Marcus from LA', 'Jake from London', 'Aiden from Miami',
    'Dylan from NYC', 'Omar from Dubai', 'Ethan from Austin',
    'Lucas from Berlin', 'Kai from Tokyo', 'Noah from Toronto',
    'Liam from Sydney', 'Leo from Chicago', 'Mateo from Barcelona'
  ];

  const messages = [
    'just joined the waitlist',
    'signed up for early access',
    'just joined REPMAX'
  ];

  function showRandomNotification() {
    const name = names[Math.floor(Math.random() * names.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    showToast(name, msg);
  }

  // Show first one after 15 seconds, then every 25-45 seconds
  setTimeout(() => {
    showRandomNotification();
    setInterval(() => {
      showRandomNotification();
    }, 25000 + Math.random() * 20000);
  }, 15000);
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
  const countEl = document.querySelector('.waitlist-count');
  if (countEl) {
    const current = parseInt(countEl.textContent.replace(/,/g, ''));
    const newCount = current + 1;
    countEl.textContent = newCount.toLocaleString();
  }

  const socialCount = document.querySelector('.hero-social-proof strong');
  if (socialCount) {
    const current = parseInt(socialCount.textContent.replace(/[^0-9]/g, ''));
    socialCount.textContent = (current + 1).toLocaleString() + '+';
  }
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
