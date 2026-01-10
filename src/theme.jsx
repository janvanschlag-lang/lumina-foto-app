import { createTheme } from "@suid/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { 
      main: "#ffffff" 
    },
    secondary: { 
      main: "#a1a1aa" 
    },
    background: {
      default: "#0a0a0a", // Galerie: Tiefstes Schwarz
      paper: "#131313",   // Sidebar: Minimal heller (Subtile Trennung)
    },
    text: {
      primary: "#e4e4e7", // Helles Grau-Weiß (nicht hartes Weiß)
      secondary: "#a1a1aa", // Mittelgrau für Labels
    },
    warning: { main: "#fbbf24" },
    action: {
      hover: "rgba(255, 255, 255, 0.04)", 
      selected: "rgba(255, 255, 255, 0.08)",
    }
  },
  typography: {
    // "Inter" ist oft der Standard, sonst System Fonts. Wirkt sehr clean.
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h6: { 
      fontSize: "0.9rem", 
      fontWeight: 600, 
      letterSpacing: "0.02em", 
      textTransform: "none" // WICHTIG: Keine Großbuchstaben mehr
    },
    subtitle2: {
      fontSize: "0.85rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
    body2: { 
      fontSize: "0.8rem",
      lineHeight: 1.5
    },
    caption: { 
      fontSize: "0.75rem",
      color: "#a1a1aa"
    },
    overline: {
      textTransform: "none", // Auch hier normale Schreibweise
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.05em",
      color: "#71717a"
    }
  },
  components: {
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 }, // Etwas leichter
      }
    }
  }
});

export default theme;