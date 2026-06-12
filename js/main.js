const PAGE_URL = window.location.href;
const PAGE_TITLE = document.title;

async function shareProfile() {
  const shareData = {
    title: PAGE_TITLE,
    text: "@gabrieleforghieri",
    url: PAGE_URL,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(PAGE_URL);
    alert("Link copiato negli appunti!");
  } catch {
    prompt("Copia questo link:", PAGE_URL);
  }
}

document.getElementById("share-btn")?.addEventListener("click", shareProfile);

/* =========================================
   BURGER MENU LOGIC
   ========================================= */
const burgerBtn = document.getElementById("burger-btn");
const menuPanel = document.getElementById("menu-panel");
const menuOverlay = document.getElementById("menu-overlay");
const menuCloseBtn = document.getElementById("menu-close-btn");

function openMenu() {
  menuPanel?.classList.add("active");
  menuOverlay?.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeMenu() {
  menuPanel?.classList.remove("active");
  menuOverlay?.classList.remove("active");
  document.body.style.overflow = "";
}

burgerBtn?.addEventListener("click", openMenu);
menuCloseBtn?.addEventListener("click", closeMenu);
menuOverlay?.addEventListener("click", closeMenu);

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
