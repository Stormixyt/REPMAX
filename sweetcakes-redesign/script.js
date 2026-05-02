const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const requestForm = document.querySelector("#whatsapp-request-form");
const currentYear = document.querySelector("#current-year");

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

if (requestForm) {
  requestForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(requestForm);
    const naam = formData.get("naam");
    const datum = formData.get("datum");
    const gelegenheid = formData.get("gelegenheid");
    const gasten = formData.get("gasten");
    const inspo = formData.get("inspo");
    const wensen = formData.get("wensen");

    const message = [
      "Hallo Sweet Cakes by Ameli, ik wil graag een taartaanvraag doen.",
      "",
      `Naam: ${naam}`,
      `Datum: ${datum}`,
      `Gelegenheid: ${gelegenheid}`,
      `Aantal gasten: ${gasten}`,
      `Inspo: ${inspo || "Geen link toegevoegd"}`,
      `Wensen: ${wensen || "Nog geen extra wensen toegevoegd"}`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/31611851414?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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

document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
