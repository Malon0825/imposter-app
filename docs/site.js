// The static page, downloads, and full-size image links work without JavaScript.
const viewer = document.querySelector(".image-viewer");
if (viewer && typeof viewer.showModal === "function") {
  const image = viewer.querySelector("img");
  const caption = viewer.querySelector("p");
  for (const link of document.querySelectorAll(".screen-link")) {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      image.src = link.href;
      image.alt = link.querySelector("img").alt;
      caption.textContent = image.alt;
      viewer.showModal();
    });
  }
  viewer.querySelector("button").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => {
    const bounds = viewer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
  });
}
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.remove("is-waiting");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  const revealAll = () => {
    if (reducedMotion.matches) {
      for (const node of document.querySelectorAll(".is-waiting")) {
        node.classList.remove("is-waiting");
        observer.unobserve(node);
      }
    }
  };
  if (!reducedMotion.matches) {
    for (const node of document.querySelectorAll(".reveal")) {
      if (node.getBoundingClientRect().top > innerHeight) {
        node.classList.add("is-waiting");
        observer.observe(node);
      }
    }
  }
  reducedMotion.addEventListener("change", revealAll);
}

// Point every download link at the newest release's APK. The static hrefs stay as the no-JS / API-failure fallback.
fetch("https://api.github.com/repos/Malon0825/imposter-app/releases/latest")
  .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
  .then((release) => {
    const apk = release.assets.find((asset) => /-android\.apk$/.test(asset.name));
    if (!apk) return;
    const sha = release.assets.find((asset) => asset.name === apk.name + ".sha256");
    for (const link of document.querySelectorAll("[data-latest-apk]")) link.href = apk.browser_download_url;
    for (const link of document.querySelectorAll("[data-latest-sha]")) {
      if (sha) link.href = sha.browser_download_url;
      else link.hidden = true;
    }
    for (const link of document.querySelectorAll("[data-latest-notes]")) link.href = release.html_url;
    for (const label of document.querySelectorAll("[data-latest-version]")) label.textContent = release.tag_name;
  })
  .catch(() => {});
