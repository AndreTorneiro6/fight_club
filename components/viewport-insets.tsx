"use client";
import { useEffect } from "react";

/** Visual viewport shrinks with the iOS keyboard even when layout/dvh height does not. */
export default function ViewportInsets() {
  useEffect(() => {
    const root = document.documentElement.style,
      viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      root.setProperty(
        "--visual-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.setProperty("--visual-top", `${viewport?.offsetTop ?? 0}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      root.removeProperty("--visual-height");
      root.removeProperty("--visual-top");
    };
  }, []);
  return null;
}
