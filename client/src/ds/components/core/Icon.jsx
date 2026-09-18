import React from "react";

/* Lucide outline icons, 24x24, 1.5px stroke, currentColor — the icon system
   named in the NUMU brand material. Paths are Lucide's own (ISC). Add new
   glyphs by copying the Lucide path, never by drawing one. */
export const NUMU_ICONS = {
  store: "M3 9l1-5h16l1 5M4 9v11h16V9M4 9h16",
  package: "M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7l8.7 5 8.7-5M12 22V12",
  cart: "M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7",
  barChart: "M3 3v18h18M7 16V9M12 16V5M17 16v-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  chevronRight: "M9 18l6-6-6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M18 15l-6-6-6 6",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  arrowLeft: "M19 12H5M12 19l-7-7 7-7",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  arrowUpRight: "M7 17L17 7M7 7h10v10",
  search: "M21 21l-4.35-4.35",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.5 0",
  tag: "M20.6 13.4L13.4 20.6a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",
  eyeOff: "M17.9 17.9A10.7 10.7 0 0112 20c-7 0-11-8-11-8a19 19 0 015.1-6M9.9 4.2A10.9 10.9 0 0112 4c7 0 11 8 11 8a19 19 0 01-2.2 3.2M1 1l22 22",
  layout: "M3 3h18v18H3zM3 9h18M9 21V9",
  building: "M4 21V4a1 1 0 011-1h9a1 1 0 011 1v17M15 8h4a1 1 0 011 1v12M4 21h17M8 7h3M8 11h3M8 15h3",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
  userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 8v6M22 11h-6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  shieldAlert: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01",
  alertTriangle: "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01",
  alertCircle: "M12 8v4M12 16h.01",
  info: "M12 16v-4M12 8h.01",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  creditCard: "M2 10h20",
  banknote: "M2 6h20v12H2z",
  messageCircle: "M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z",
  plug: "M12 22v-5M9 7V2M15 7V2M6 12a6 6 0 0012 0V7H6z",
  toggleLeft: "M8 12h.01",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  fileText: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6",
  clipboard: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9z",
  clock: "M12 6v6l4 2",
  calendar: "M8 2v4M16 2v4M3 10h18",
  refresh: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
  settings: "M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8L4.2 7a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  moreVertical: "M12 5h.01M12 12h.01M12 19h.01",
  moreHorizontal: "M5 12h.01M12 12h.01M19 12h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  externalLink: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  logOut: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  trash: "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  lock: "M7 11V7a5 5 0 0110 0v4",
  zap: "M13 2L3 14h9l-1 8 10-12h-9z",
  server: "M6 6h.01M6 12h.01M6 18h.01",
  database: "M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3",
  gitBranch: "M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",
  wifiOff: "M1 1l22 22M16.7 13.3a5 5 0 00-7.1 0M5 12.6a10 10 0 015.2-2.6M2 8.8A15 15 0 018 5.3M12 20h.01",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z",
  megaphone: "M3 11l18-5v12L3 13v-2zM3 11a2 2 0 000 4h1v5a1 1 0 001 1h2a1 1 0 001-1v-5",
  command: "M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 000-6H6a3 3 0 100 6 3 3 0 003-3V6a3 3 0 10-3 3h12a3 3 0 000-6z",
  globe: "M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20",
  mapPin: "M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z",
  phone: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z",
  mail: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  warehouse: "M3 21V9l9-5 9 5v12M3 21h18M8 21v-7h8v7",
  trendingUp: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  trendingDown: "M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6",
  history: "M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8M12 7v5l4 2",
  playCircle: "M10 8l6 4-6 4V8z",
  pauseCircle: "M10 15V9M14 15V9",
  copy: "M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  link: "M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-2 2M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l2-2",
  star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z",
  circle: "",
  slash: "M4.9 4.9l14.2 14.2"
};

/* Glyphs that also need a circle/rect frame Lucide draws as a shape. */
const FRAMES = {
  cart: [["circle", { cx: 9, cy: 21, r: 1 }], ["circle", { cx: 20, cy: 21, r: 1 }]],
  truck: [["circle", { cx: 5.5, cy: 18.5, r: 2.5 }], ["circle", { cx: 18.5, cy: 18.5, r: 2.5 }]],
  creditCard: [["rect", { x: 2, y: 5, width: 20, height: 14, rx: 2 }]],
  banknote: [["circle", { cx: 12, cy: 12, r: 2.5 }]],
  search: [["circle", { cx: 11, cy: 11, r: 8 }]],
  eye: [["circle", { cx: 12, cy: 12, r: 3 }]],
  users: [["circle", { cx: 9, cy: 7, r: 4 }]],
  user: [["circle", { cx: 12, cy: 7, r: 4 }]],
  settings: [["circle", { cx: 12, cy: 12, r: 3 }]],
  tag: [["circle", { cx: 7, cy: 7, r: 1 }]],
  alertCircle: [["circle", { cx: 12, cy: 12, r: 10 }]],
  info: [["circle", { cx: 12, cy: 12, r: 10 }]],
  clock: [["circle", { cx: 12, cy: 12, r: 10 }]],
  playCircle: [["circle", { cx: 12, cy: 12, r: 10 }]],
  pauseCircle: [["circle", { cx: 12, cy: 12, r: 10 }]],
  circle: [["circle", { cx: 12, cy: 12, r: 10 }]],
  slash: [["circle", { cx: 12, cy: 12, r: 10 }]],
  globe: [["circle", { cx: 12, cy: 12, r: 10 }]],
  mapPin: [["circle", { cx: 12, cy: 10, r: 3 }]],
  lock: [["rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }]],
  calendar: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }]],
  toggleLeft: [["rect", { x: 1, y: 5, width: 22, height: 14, rx: 7 }], ["circle", { cx: 8, cy: 12, r: 3 }]],
  server: [["rect", { x: 2, y: 2, width: 20, height: 8, rx: 2 }], ["rect", { x: 2, y: 14, width: 20, height: 8, rx: 2 }]],
  database: [["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }]],
  layout: [],
  store: []
};

const DIRECTIONAL = new Set([
  "chevronRight", "chevronLeft", "arrowRight", "arrowLeft", "arrowUpRight",
  "externalLink", "logOut", "link"
]);

export function Icon({ name, size = 18, strokeWidth = 1.5, className = "", label, style, ...rest }) {
  const d = NUMU_ICONS[name];
  if (d === undefined) return null;
  const frames = FRAMES[name] || [];
  const flip = DIRECTIONAL.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={[flip ? "numu-icon-flip" : "", className].filter(Boolean).join(" ")}
      style={{ flex: "none", ...style }}
      {...rest}
    >
      {label ? <title>{label}</title> : null}
      {frames.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
      {d ? <path d={d} /> : null}
    </svg>
  );
}
