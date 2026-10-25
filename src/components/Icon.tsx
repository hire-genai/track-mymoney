import type { SVGProps } from "react";

type IconName =
  | "arrow-down"
  | "trending"
  | "house"
  | "piggy"
  | "smile"
  | "wallet"
  | "calendar"
  | "bar-chart"
  | "line-chart"
  | "heart"
  | "target"
  | "upload"
  | "file"
  | "bot"
  | "folder"
  | "flag"
  | "check"
  | "x"
  | "triangle-alert"
  | "chevron-right"
  | "chevron-down"
  | "lightbulb"
  | "plus"
  | "logout"
  | "info"
  | "arrow-right"
  | "zap"
  | "play"
  | "pause"
  | "stop"
  | "more"
  | "plane"
  | "shield"
  | "car"
  | "ring"
  | "laptop"
  | "gift"
  | "graduation"
  | "dumbbell"
  | "coins"
  | "minus";

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export default function Icon({ name, size = 16, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths(name)}
    </svg>
  );
}

function paths(name: IconName) {
  switch (name) {
    case "arrow-down":
      return (
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      );
    case "trending":
      return (
        <>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </>
      );
    case "house":
      return (
        <>
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
        </>
      );
    case "piggy":
      return (
        <>
          <path d="M19 7V5a1 1 0 0 0-1-1h-2l-2 2H9a6 6 0 0 0-6 6v3h2v1a2 2 0 0 0 2 2h1v2h3v-2h4v2h3v-2h1a2 2 0 0 0 2-2v-5a4 4 0 0 0-2-3.5z" />
          <path d="M17 9h.01" />
        </>
      );
    case "smile":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <circle cx="9" cy="9" r="0.5" fill="currentColor" />
          <circle cx="15" cy="9" r="0.5" fill="currentColor" />
        </>
      );
    case "wallet":
      return (
        <>
          <path d="M20 7H5a2 2 0 0 1 0-4h13v4z" />
          <path d="M3 9v10a2 2 0 0 0 2 2h15v-5" />
          <path d="M22 14h-5a2 2 0 0 1 0-4h5v4z" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      );
    case "bar-chart":
      return (
        <>
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </>
      );
    case "line-chart":
      return (
        <>
          <path d="M3 3v18h18" />
          <path d="m7 15 4-4 3 3 5-6" />
        </>
      );
    case "heart":
      return (
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </>
      );
    case "file":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </>
      );
    case "bot":
      return (
        <>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <circle cx="9" cy="13" r="1" fill="currentColor" />
          <circle cx="15" cy="13" r="1" fill="currentColor" />
          <path d="M12 3v4" />
          <path d="M8 19v2M16 19v2" />
        </>
      );
    case "folder":
      return (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      );
    case "flag":
      return (
        <>
          <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </>
      );
    case "check":
      return <polyline points="20 6 9 17 4 12" />;
    case "x":
      return (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      );
    case "triangle-alert":
      return (
        <>
          <path d="M10.3 3.6 2.3 17a1 1 0 0 0 .9 1.5h17.6a1 1 0 0 0 .9-1.5l-8-13.4a1 1 0 0 0-1.4 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </>
      );
    case "chevron-right":
      return <polyline points="9 18 15 12 9 6" />;
    case "chevron-down":
      return <polyline points="6 9 12 15 18 9" />;
    case "lightbulb":
      return (
        <>
          <path d="M9 18h6M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </>
      );
    case "plus":
      return (
        <>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <circle cx="12" cy="8" r="0.5" fill="currentColor" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      );
    case "zap":
      return <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;
    case "play":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </>
      );
    case "pause":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="9" x2="10" y2="15" />
          <line x1="14" y1="9" x2="14" y2="15" />
        </>
      );
    case "stop":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </>
      );
    case "more":
      return (
        <>
          <circle cx="12" cy="5" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </>
      );
    case "plane":
      return (
        <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 1 0-3-3L13 8l-8.2-1.8a1 1 0 0 0-.9 1.6l5.6 4-2.6 2.6-1.8-.6a1 1 0 0 0-1 1.5l2.4 2.4 2.4 2.4a1 1 0 0 0 1.5-1l-.6-1.8 2.6-2.6 4 5.6a1 1 0 0 0 1.6-.9z" />
      );
    case "shield":
      return (
        <>
          <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
          <path d="M9 12l2 2 4-4" />
        </>
      );
    case "car":
      return (
        <>
          <path d="M3 13v4a1 1 0 0 0 1 1h2v-2h12v2h2a1 1 0 0 0 1-1v-4l-2-5a2 2 0 0 0-2-1H7a2 2 0 0 0-2 1l-2 5z" />
          <circle cx="7" cy="16" r="1.5" fill="currentColor" />
          <circle cx="17" cy="16" r="1.5" fill="currentColor" />
        </>
      );
    case "ring":
      return (
        <>
          <circle cx="12" cy="15" r="6" />
          <polyline points="9 7 10 3 14 3 15 7" />
        </>
      );
    case "laptop":
      return (
        <>
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </>
      );
    case "gift":
      return (
        <>
          <rect x="3" y="8" width="18" height="4" />
          <line x1="12" y1="8" x2="12" y2="22" />
          <path d="M19 12v10H5V12" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5c2 0 4.5 3 4.5 5" />
          <path d="M16.5 8a2.5 2.5 0 0 0 0-5c-2 0-4.5 3-4.5 5" />
        </>
      );
    case "graduation":
      return (
        <>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
        </>
      );
    case "dumbbell":
      return (
        <>
          <path d="M6 6v12M18 6v12M3 9v6M21 9v6" />
          <line x1="6" y1="12" x2="18" y2="12" />
        </>
      );
    case "coins":
      return (
        <>
          <ellipse cx="9" cy="7" rx="6" ry="2.5" />
          <path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" />
          <path d="M15 10c3.3 0 6 1.1 6 2.5v4c0 1.4-2.7 2.5-6 2.5-1.6 0-3.1-.3-4.2-.7" />
          <path d="M3 11v4c0 1.4 2.7 2.5 6 2.5" />
        </>
      );
    case "minus":
      return <line x1="5" y1="12" x2="19" y2="12" />;
  }
}

export type { IconName };
