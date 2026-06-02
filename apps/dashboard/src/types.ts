export const screens = ["overview", "log", "resources"] as const;
export type Screen = (typeof screens)[number];

export const themes = ["dark", "light"] as const;
export type Theme = (typeof themes)[number];

export const densities = ["compact", "spacious"] as const;
export type Density = (typeof densities)[number];
