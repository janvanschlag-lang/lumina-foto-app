import { createTheme } from "@suid/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ffffff", // Weißer Kontrast
    },
    secondary: {
      main: "#22c55e", // Grün
    },
    background: {
      default: "#09090b", // Tiefschwarz
      paper: "#18181b",   // Surface Grau
    },
    text: {
      primary: "#f4f4f5",
      secondary: "#a1a1aa",
    },
    error: {
      main: "#ef4444",
    },
    warning: {
      main: "#fbbf24",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontSize: "0.9rem",
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    },
    body2: {
      fontSize: "0.75rem",
    },
  },
  // HINWEIS: Component Overrides entfernt, um SUID Absturz zu verhindern.
});

export default theme;