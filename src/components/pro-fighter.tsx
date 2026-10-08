import { useEffect, useState } from "react";
import gokuStill from "@/assets/goku-pro.png";
import gokuRage from "@/assets/goku-rage.mp4.asset.json";

export function ProFighter() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(document.documentElement.classList.contains("pro") && !motion.matches);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    motion.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); motion.removeEventListener("change", update); };
  }, []);
  return animate ? (
    <video className="pro-mascot pro-rage" src={gokuRage.url} autoPlay loop muted playsInline preload="metadata" aria-label="Goku moving in rage power-up mode" poster={gokuStill} />
  ) : (
    <img className="pro-mascot" src={gokuStill} alt="Goku in a fighting stance" width={672} height={992} />
  );
}