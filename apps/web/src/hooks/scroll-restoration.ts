import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function useScrollRestoration() {
  const location = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    history.scrollRestoration = "manual";
    const storageKey = `finance-scroll:${location.key}`;
    let position = window.scrollY;
    let restoring = navigation === "POP";
    const saved = Number(sessionStorage.getItem(storageKey)) || 0;
    const restore = () => {
      if (restoring) window.scrollTo({ top: saved, behavior: "instant" });
    };
    if (!restoring && previousPath.current !== location.pathname)
      window.scrollTo({ top: 0, behavior: "instant" });
    previousPath.current = location.pathname;
    const onScroll = () => {
      if (!restoring) position = window.scrollY;
    };
    const stopRestoring = () => {
      restoring = false;
      position = window.scrollY;
    };
    const observer = new ResizeObserver(restore);
    observer.observe(document.body);
    restore();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", stopRestoring, { passive: true });
    window.addEventListener("touchstart", stopRestoring, { passive: true });
    window.addEventListener("keydown", stopRestoring);
    window.addEventListener("pointerdown", stopRestoring);
    const save = () =>
      sessionStorage.setItem(storageKey, String(restoring ? saved : position));
    window.addEventListener("pagehide", save);
    return () => {
      save();
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchstart", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
      window.removeEventListener("pointerdown", stopRestoring);
      window.removeEventListener("pagehide", save);
    };
  }, [location.key, location.pathname, navigation]);
}
