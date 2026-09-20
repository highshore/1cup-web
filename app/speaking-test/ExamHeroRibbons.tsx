"use client";

import { useEffect, useRef } from "react";

// Keep the shading from the original Figma ribbons.
const PALETTES = [["#FFEED6", "#FFE8C9", "#FFE2BC", "#FFDCB0", "#FFD5A3", "#FFCD95", "#FFC587", "#FFBC7A", "#FFB46C", "#FFAC5E", "#FFA350", "#FF9B43", "#FF9335", "#FF8B28", "#FE8827", "#FD8525", "#FC8224", "#FA7F22", "#F97C21", "#F87920", "#F7761E", "#F6731D", "#F5701B", "#F46D1A", "#F36D1C", "#F47626", "#F57F31", "#F6873B", "#F79045", "#F89950", "#FAA15A", "#FBAA65", "#FCB36F", "#FDBB7A", "#FEC484", "#FECB8C"], ["#FFEED6", "#FFE8C9", "#FFE2BC", "#FFDCB0", "#FFD5A3", "#FFCD95", "#FFC587", "#FFBC7A", "#FFB46C", "#FFAC5E", "#FFA350", "#FF9B43", "#FF9335", "#FF8B28", "#FE8827", "#FD8525", "#FC8224", "#FA7F22", "#F97C21", "#F87920", "#F7761E", "#F6731D", "#F5701B", "#F46D1A", "#F36D1C", "#F47626", "#F57F31", "#F6873B", "#F79045", "#F89950", "#FAA15A", "#FBAA65", "#FCB36F", "#FDBB7A", "#FEC484", "#FECB8C"], ["#FFF5E4", "#FFEFD8", "#FFE9CB", "#FFE3BF", "#FAD8AF", "#EFC499", "#E3B084", "#D89D6F", "#CC8959", "#C17644", "#B96734", "#B96430", "#B8602C", "#B85D28", "#B85A24", "#B75620", "#B7531C", "#B64F18", "#B64C14", "#BA4F15", "#C15418", "#C8591A", "#CE5F1D", "#D56420", "#DB6923", "#E26F26", "#E87428", "#EF792B", "#F28236", "#F48D44", "#F69853", "#F7A362", "#F9AE70", "#FBB97F", "#FDC38E", "#FECC99"]] as const;
const TAU = Math.PI * 2;
const HEIGHT = 592;
const SAMPLES = 64;
const BANDS = 18;
const AMPLITUDES = [67, 52, 38];
const DEPTHS = [104, 82, 42];

export default function ExamHeroRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let frame = 0;
    let elapsed = 0;
    let previousTime = 0;
    let visible = true;
    const centers = new Float64Array(SAMPLES + 1);
    const thicknesses = new Float64Array(SAMPLES + 1);

    const draw = () => {
      context.clearRect(0, 0, width, HEIGHT);
      const span = Math.max(1440, width);
      const offset = (span - width) / 2;
      const time = elapsed / 1000;
      for (let layer = 0; layer < PALETTES.length; layer++) {
        const phase = time * TAU / (18 + layer * 3) + layer * 2.1;
        const amplitude = AMPLITUDES[layer];
        const depth = DEPTHS[layer];
        for (let sample = 0; sample <= SAMPLES; sample++) {
          // Extend every band past both edges, regardless of viewport or phase.
          const x = -40 + (width + 80) * sample / SAMPLES;
          const u = (x + offset) / span * TAU;
          centers[sample] = 350 + layer * 16
            + amplitude * Math.sin(u * 1.05 - phase)
            + 22 * Math.sin(u * 1.9 + phase * 0.7);
          thicknesses[sample] = depth * (0.7 + 0.3 * Math.sin(u * 1.3 + phase + 0.8));
        }
        const palette = PALETTES[layer];
        for (let band = 0; band < BANDS; band++) {
          const top = band / BANDS - 0.5;
          const bottom = (band + 1) / BANDS - 0.5;
          context.beginPath();
          for (let sample = 0; sample <= SAMPLES; sample++) {
            const x = -40 + (width + 80) * sample / SAMPLES;
            const y = centers[sample] + thicknesses[sample] * top;
            if (sample === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          for (let sample = SAMPLES; sample >= 0; sample--) {
            context.lineTo(-40 + (width + 80) * sample / SAMPLES,
              centers[sample] + thicknesses[sample] * bottom + 0.65);
          }
          context.closePath();
          context.fillStyle = palette[Math.round(band * (palette.length - 1) / (BANDS - 1))];
          context.fill();
        }
      }
      canvas.dataset.ready = "true";
    };

    const tick = (now: number) => {
      elapsed += previousTime ? Math.min(now - previousTime, 64) : 0;
      previousTime = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const updatePlayback = () => {
      cancelAnimationFrame(frame);
      previousTime = 0;
      if (!reducedMotion.matches && visible && !document.hidden) {
        frame = requestAnimationFrame(tick);
      } else if (reducedMotion.matches) {
        draw();
      }
    };
    const resize = () => {
      width = canvas.getBoundingClientRect().width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, 1440 / width);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(HEIGHT * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    };
    const sizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    });
    sizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    reducedMotion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);
    resize();
    updatePlayback();
    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      reducedMotion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
    };
  }, []);

  return (
    <div className="exam-ribbon-background" aria-hidden="true">
      <canvas ref={canvasRef} className="exam-ribbon-canvas" />
      <div className="exam-ribbon-stage">
        {(["back", "middle", "front"] as const).map((layer) => (
          // Static fallback for the first paint or unavailable canvas contexts.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={layer} className="exam-ribbon" src={`/images/exam-center/ribbon-${layer}.svg`} width={1728} height={972} alt="" />
        ))}
      </div>
    </div>
  );
}
