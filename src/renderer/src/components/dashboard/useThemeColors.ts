import { useEffect, useState } from 'react';

/**
 * Resolved theme tokens for SVG charts. Recharts writes colors as presentation
 * attributes, which cannot hold `var(--…)`, so read the computed values and
 * re-read whenever the root `data-theme` flips.
 */
export interface ThemeColors {
  ink: string;
  secondary: string;
  muted: string;
  line: string;
  surface: string;
  subtle: string;
  gain: string;
  gainSoft: string;
  loss: string;
  lossSoft: string;
  info: string;
  attention: string;
}

const read = (): ThemeColors => {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(`--ui-${name}`).trim() || fallback;
  return {
    ink: v('ink', '#1d1b16'),
    secondary: v('secondary', '#5b5548'),
    muted: v('muted', '#736c5e'),
    line: v('line', '#e6e0d3'),
    surface: v('surface', '#ffffff'),
    subtle: v('subtle', '#faf8f3'),
    gain: v('gain', '#2f6b4f'),
    gainSoft: v('gain-soft', '#e3efe7'),
    loss: v('loss', '#a23b2a'),
    lossSoft: v('loss-soft', '#f9e1dc'),
    info: v('info', '#385c7b'),
    attention: v('attention', '#846522'),
  };
};

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

/** Shared axis / grid props so every chart has the same recessive chrome. */
export const axisProps = (c: ThemeColors) => ({
  stroke: c.line,
  tick: { fill: c.muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});
