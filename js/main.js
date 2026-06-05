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
