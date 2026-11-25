// Dev only (card-gallery.html): every card at the sizes the app shows them,
// in English and Filipino, with any face whose text overflows outlined.
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "@fontsource/anton/400.css";
import "@fontsource/special-elite/400.css";
import "../style.css";
import { CardFace } from "./Card";
import { CARDS, setCardLanguage, type CardLanguage } from "./catalog";

function Gallery() {
  const lang = (new URLSearchParams(location.search).get("lang") ?? "fil") as CardLanguage;
  setCardLanguage(lang);
  const width = Number(new URLSearchParams(location.search).get("w") ?? 210);
  useEffect(() => {
    document.fonts.ready.then(() => {
      const over = [...document.querySelectorAll<HTMLElement>(".pc-card")].filter((card) => {
        const face = card.querySelector<HTMLElement>(".pc-face")!;
        const name = card.querySelector<HTMLElement>(".pc-name")!;
        const art = card.querySelector<HTMLElement>(".pc-art")!;
        const bad = face.scrollHeight > face.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1 || art.clientHeight < width * 0.3;
        if (bad) card.style.outline = "3px solid red";
        return bad;
      });
      (window as unknown as { overflowing: string[] }).overflowing = over.map((c) => c.getAttribute("aria-label") ?? "");
      document.body.dataset.ready = "1";
    });
  }, []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16, background: "#141916" }}>
      {CARDS.map((c) => (
        <CardFace key={c.id} id={c.id} width={width} />
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
