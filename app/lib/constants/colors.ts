export const colors = {
  primary: "#2C1810",
  primaryLight: "#4A2F23",
  primaryDark: "#1A0F0A",
  primaryPale: "#F5EBE6",
  primaryBg: "#FDF9F6",
  pageBg: "whitesmoke",
  landingBg: "#ffffff",
  accent: "#C8A27A",
  accentHover: "#B68C66",
  text: {
    dark: "#2C1810",
    medium: "#4A2F23",
    light: "#8B6B4F",
  },
  gray: {
    light: "#F8F9FA",
    medium: "#E9ECEF",
    dark: "#6C757D",
  },
  border: "#E8DDD4",
  shadow: "rgba(0, 0, 0, 0.1)",
} as const;

export type AppColors = typeof colors;
