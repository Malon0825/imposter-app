import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "@fontsource/anton/400.css";
import "@fontsource/special-elite/400.css";
import App from "./App";
import { MotionConfig } from "motion/react";
import "./style.css";
import "./motion.css";
import { setSound } from "./sound";
// Dev only (playtest.html): the table turns sound on for the phone you play
// as and off for the rest, so shared sounds never play seven times.
if (import.meta.env.DEV)
  window.addEventListener("message", (e) => {
    if (typeof e.data?.playtestSound === "boolean") setSound(e.data.playtestSound);
  });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);
