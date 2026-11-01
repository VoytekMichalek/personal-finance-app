import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", notify);
  viewport?.addEventListener("scroll", notify);
  return () => {
    viewport?.removeEventListener("resize", notify);
    viewport?.removeEventListener("scroll", notify);
  };
};
const snapshot = () => {
  const v = window.visualViewport;
  return v ? `${v.width},${v.height},${v.offsetTop}` : "";
};
export function useDialogViewport() {
  const size = useSyncExternalStore(subscribe, snapshot, () => "");
  const [width, height, top] = size.split(",").map(Number);
  return width && width < 640 && height
    ? { top: (top ?? 0) + height / 2, maxHeight: Math.max(100, height - 24) }
    : undefined;
}
