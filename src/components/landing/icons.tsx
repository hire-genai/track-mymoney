import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, strokeWidth = 1.75, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconSparkles = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconFile = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="10" r="2.5" /><path d="M15 20c0-2.2 1.7-4 4-4" /></svg>
);
export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
);
export const IconTrendingUp = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconZap = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12l5 5L20 7" /></svg>
);
export const IconQuote = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 7h4v4H7c0 2 1 3 3 3v2c-3.5 0-6-2-6-5V7zm10 0h4v4h-4c0 2 1 3 3 3v2c-3.5 0-6-2-6-5V7z" />
  </svg>
);
export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20h16" /><rect x="6" y="10" width="3" height="8" rx="1" /><rect x="11" y="6" width="3" height="12" rx="1" /><rect x="16" y="13" width="3" height="5" rx="1" /></svg>
);
export const IconWallet = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></svg>
);
export const IconStar = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 3l2.6 5.6 6.1.8-4.5 4.3 1.2 6.1L12 17l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8z" />
  </svg>
);
