const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const revealNodes = document.querySelectorAll(".reveal");
const addButtons = document.querySelectorAll(".add-to-cart");
const cartList = document.querySelector("#cart-list");
const subtotalNode = document.querySelector("#subtotal");
const feeNode = document.querySelector("#fee");
const totalNode = document.querySelector("#total");
const clearCartButton = document.querySelector("#clear-cart");
const filterButtons = document.querySelectorAll(".chip");
const menuCards = document.querySelectorAll(".menu-card");
const faqItems = document.querySelectorAll(".faq-item");
const mobileCartBar = document.querySelector("#mobile-cart-bar");
const mobileCartLabel = document.querySelector(".mobile-cart-bar__label");
const mobileCartTotal = document.querySelector(".mobile-cart-bar__total");
const currentYear = document.querySelector("#current-year");

const cart = new Map();
const serviceFee = 0.25;

function formatPrice(value) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function updateCart() {
  const subtotal = [...cart.values()].reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + serviceFee;
  const itemCount = [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);

  if (subtotalNode) {
    subtotalNode.textContent = formatPrice(subtotal);
  }

  if (feeNode) {
    feeNode.textContent = formatPrice(serviceFee);
  }

  if (totalNode) {
    totalNode.textContent = formatPrice(total);
  }

  if (mobileCartLabel) {
    mobileCartLabel.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} in je bestelling`;
  }

  if (mobileCartTotal) {
    mobileCartTotal.textContent = formatPrice(total);
  }

  if (!cartList) {
    return;
  }

  if (cart.size === 0) {
    cartList.innerHTML = '<li class="cart-list__empty">Nog niets toegevoegd. Start met een bestseller of filter direct op categorie.</li>';
    return;
  }

  cartList.innerHTML = "";

  [...cart.values()].forEach((item) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <div class="cart-line">
        <span>${item.name}</span>
        <strong>${formatPrice(item.price * item.quantity)}</strong>
      </div>
      <div class="cart-line__meta">
        <span>${item.quantity}x toegevoegd</span>
        <span>${formatPrice(item.price)} per stuk</span>
      </div>
    `;
    cartList.appendChild(listItem);
  });
}

function addToCart(name, price) {
  if (cart.has(name)) {
    const existing = cart.get(name);
    existing.quantity += 1;
    cart.set(name, existing);
  } else {
    cart.set(name, { name, price, quantity: 1 });
  }

  updateCart();
}

function setActiveFilter(filter) {
  filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });

  menuCards.forEach((card) => {
    const categories = (card.dataset.category || "").split(" ");
    const shouldShow = filter === "all" || categories.includes(filter);
    card.classList.toggle("is-hidden", !shouldShow);
  });
}

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

addButtons.forEach((button) => {
  button.addEventListener("click", () => {
    addToCart(button.dataset.name, Number(button.dataset.price));
  });
});

if (clearCartButton) {
  clearCartButton.addEventListener("click", () => {
    cart.clear();
    updateCart();
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.filter);
  });
});

faqItems.forEach((item) => {
  const trigger = item.querySelector(".faq-trigger");
  const answer = item.querySelector(".faq-answer");

  if (!trigger || !answer) {
    return;
  }

  trigger.addEventListener("click", () => {
    const isOpen = item.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    answer.style.maxHeight = isOpen ? `${answer.scrollHeight}px` : "0px";
  });
});

if (mobileCartBar) {
  mobileCartBar.addEventListener("click", () => {
    const cartSection = document.querySelector(".cart-panel");
    if (cartSection) {
      cartSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.14,
  }
);

revealNodes.forEach((node) => observer.observe(node));

setActiveFilter("all");
updateCart();
