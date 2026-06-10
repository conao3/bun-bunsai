const screens = [
  "overview",
  "log",
  "resources",
  "snapshots",
  "settings",
] as const;
export type Screen = (typeof screens)[number];

const themes = ["dark", "light"] as const;
export type Theme = (typeof themes)[number];

const densities = ["compact", "spacious"] as const;
export type Density = (typeof densities)[number];

const logLayouts = ["drawer", "bottom"] as const;
export type LogLayout = (typeof logLayouts)[number];
