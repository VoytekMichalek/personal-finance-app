import { test, expect, session } from "./fixtures";
test("sidebar motion keeps icons steady and reverses smoothly @sidebar-motion", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Sidebar is desktop-only.");
  await session(page);
  await page.goto("/settings/ai");
  await expect(
    page.getByRole("button", { name: "Collapse sidebar" }),
  ).toBeVisible();
  // CSS transitions use the browser compositor, not JS timers. Sample actual frames
  // through completion; no fixed sleeps or fake-clock jumps can prove this geometry.
  const measure = async (reverse: boolean) =>
    page.evaluate(async (reverse) => {
      const sidebar = document.querySelector<HTMLElement>(".finance-sidebar")!;
      const button =
        sidebar.querySelector<HTMLButtonElement>(".sidebar-toggle")!;
      const icons = [...sidebar.querySelectorAll<HTMLElement>(".sidebar-icon")];
      const frames: {
        width: number;
        margin: number;
        points: { x: number; y: number }[];
      }[] = [];
      let reversed = false;
      button.click();
      for (let count = 0; count < 180; count++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const width = sidebar.getBoundingClientRect().width;
        frames.push({
          width,
          margin: parseFloat(
            getComputedStyle(document.querySelector("main")!).marginLeft,
          ),
          points: icons.map((icon) => {
            const rect = icon.getBoundingClientRect();
            return { x: rect.x, y: rect.y };
          }),
        });
        if (reverse && !reversed && width < 170) {
          button.click();
          reversed = true;
        } else if (
          count > 1 &&
          sidebar
            .getAnimations({ subtree: true })
            .every((animation) => animation.playState === "finished")
        )
          break;
      }
      return { frames, reversed };
    }, reverse);
  const closing = await measure(false);
  expect(closing.frames.length).toBeGreaterThan(3);
  expect(closing.frames.at(-1)!.width).toBeCloseTo(76, 0);
  for (const frame of closing.frames) {
    expect(frame.margin).toBeCloseTo(frame.width, 0);
    frame.points.forEach((point, i) => {
      expect(point.x).toBeCloseTo(closing.frames[0]!.points[i]!.x, 1);
      expect(point.y).toBeCloseTo(closing.frames[0]!.points[i]!.y, 1);
    });
  }
  const opening = await measure(false);
  expect(opening.frames.at(-1)!.width).toBeCloseTo(240, 0);
  const reversal = await measure(true);
  expect(reversal.reversed).toBe(true);
  expect(reversal.frames.at(-1)!.width).toBeCloseTo(240, 0);
  const turningPoint = reversal.frames.findIndex((frame) => frame.width < 170);
  // Frame cadence varies on CI; prove interpolation after reversal, not a device FPS.
  expect(
    reversal.frames
      .slice(turningPoint + 1)
      .some(
        (frame) =>
          frame.width > reversal.frames[turningPoint]!.width &&
          frame.width < 239,
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".finance-sidebar")).toHaveCSS("width", "76px");
  const positions = await page
    .locator(".finance-sidebar")
    .evaluate((sidebar) => ({
      scroll: sidebar.scrollLeft,
      centre: sidebar.getBoundingClientRect().x + sidebar.clientWidth / 2,
      centres: [
        ...sidebar.querySelectorAll(
          ".sidebar-icon, .sidebar-toggle, .sidebar-attribution-icon",
        ),
      ].map((item) => {
        const rect = item.getBoundingClientRect();
        return rect.x + rect.width / 2;
      }),
    }));
  expect(positions.scroll).toBe(0);
  positions.centres.forEach((centre) =>
    expect(centre).toBeCloseTo(positions.centre, 1),
  );
  await page.screenshot({ path: "artifacts/sidebar-collapsed-desktop.png" });
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".finance-sidebar")).toHaveCSS("width", "240px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".finance-sidebar")).toHaveCSS("width", "76px");
  await expect(page.locator(".finance-sidebar")).toHaveCSS(
    "transition-property",
    "none",
  );
});
