import { createTheme } from "@suid/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff" },
    secondary: { main: "#a1a1aa" },
    background: {
      default: "#000000", // Galerie: Reines Schwarz (Bester Kontrast für Fotos)
      paper: "#121212",   // Sidebar & Cards: Solides Dark Grey (Keine Transparenz)
    },
    text: {
      primary: "#e4e4e7",
      secondary: "#a1a1aa",
    },
    warning: { main: "#fbbf24" },
    action: {
      hover: "#27272a",   // Solide Hover Farbe statt RGBA
      selected: "#3f3f46", // Solide Selected Farbe
    }
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h6: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: 0, textTransform: "none" },
    subtitle2: { fontSize: "0.875rem", fontWeight: 600, letterSpacing: 0 },
    body2: { fontSize: "0.875rem", letterSpacing: 0, lineHeight: 1.5 },
    caption: { fontSize: "0.75rem", letterSpacing: 0, color: "#a1a1aa" },
    overline: { fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a" }
  },
  components: {
    MuiChip: { styleOverrides: { root: { fontWeight: 500, fontSize: "0.75rem" } } },
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontSize: "0.875rem" } } },
    MuiPaper: { 
      styleOverrides: { 
        root: { backgroundImage: 'none' } // WICHTIG: Entfernt den Material "Elevation Overlay", damit die Farbe flach bleibt
      } 
    }
  }
});

export default theme;