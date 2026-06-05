const screens = ["overview", "log", "resources"] as const;
export type Screen = (typeof screens)[number];

const themes = ["dark", "light"] as const;
export type Theme = (typeof themes)[number];
