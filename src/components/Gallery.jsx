import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';

// SUID Imports
import { 
  Box, Card, CardMedia, CardContent, Typography, 
  Chip, Grid, CircularProgress, Stack 
} from "@suid/material";

// Icons
import StarIcon from "@suid/icons-material/Star";
import LensBlurIcon from "@suid/icons-material/LensBlur"; // Für Review/Neutral

const Gallery = (props) => {
  const [assets, setAssets] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  // --- LIVE DATA LISTENER ---
  createEffect(() => {
    const q = query(
      collection(db, "assets"),
      orderBy("captureDate", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedAssets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssets(loadedAssets);
      setLoading(false);
    }, (error) => {
      console.error("Gallery Error:", error);
      setLoading(false);
    });

    onCleanup(() => unsubscribe());
  });

  return (
    <Box sx={{ 
      padding: 3, // Etwas mehr Luft
      height: '100%', 
      overflowY: 'auto',
      display: 'flex', 
      flexDirection: 'column'
    }}>
      
      {/* HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 'bold' }}>
          Library ({assets().length})
        </Typography>
      </Stack>

      {/* CONTENT */}
      <Show when={!loading()} fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress color="inherit" size={20} />
        </Box>
      }>
        
        {/* GRID (4 Spalten auf Desktop) */}
        <Grid container spacing={3}>
          <For each={assets()}>{(asset) => (
            <Grid item xs={12} sm={6} md={4} lg={3}> {/* lg={3} bedeutet 12/3 = 4 Spalten */}
              <Card 
                onClick={() => props.onSelect(asset)}
                elevation={0} // Kein Schatten
                sx={{ 
                  cursor: 'pointer', 
                  bgcolor: 'transparent', // Transparent, damit es mit dem Hintergrund verschmilzt
                  border: 'none',         // Kein Rahmen
                  borderRadius: 0,        // Eckig oder minimal rund
                  position: 'relative',
                  opacity: props.selectedId === asset.id ? 1 : 0.8,
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 1 }
                }}
              >
                {/* IMAGE AREA (Clean) */}
                <Box sx={{ 
                  position: 'relative', 
                  aspectRatio: '3/2', 
                  bgcolor: '#222', 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  mb: 1
                }}>
                  <Show when={asset.urls && asset.urls.preview} fallback={<Box sx={{width:'100%', height:'100%', bgcolor:'#222'}} />}>
                    <CardMedia
                      component="img"
                      image={asset.urls.preview}
                      alt={asset.filename}
                      sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
                    />
                  </Show>
                  
                  {/* Selection Border (Optional Active State) */}
                  <Show when={props.selectedId === asset.id}>
                    <Box sx={{ position: 'absolute', inset: 0, border: '2px solid white', borderRadius: 2, pointerEvents: 'none' }} />
                  </Show>
                </Box>

                {/* CARD FOOTER (Monochrome Data) */}
                <Box sx={{ px: 0.5 }}>
                  
                  {/* Row 1: Filename & Stars */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="body2" noWrap color="text.primary" sx={{ fontSize: '0.8rem', fontWeight: 500, maxWidth: '60%' }}>
                      {asset.filename}
                    </Typography>
                    
                    {/* Monochrome Stars */}
                    <Stack direction="row" alignItems="center" spacing={0.2}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', mr: 0.5 }}>
                        {asset.verdict?.rating}
                      </Typography>
                      <For each={Array(asset.verdict?.rating || 0)}>{() => 
                        <StarIcon sx={{ fontSize: 10, color: 'text.secondary' }} />
                      }</For>
                    </Stack>
                  </Stack>

                  {/* Row 2: Chip & Score (Bottom) */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    
                    {/* Monochrome Chip */}
                    <Show when={asset.verdict?.flag} fallback={<Box />}>
                       <Chip 
                         label={asset.verdict.flag.toUpperCase()} 
                         size="small" 
                         variant="outlined"
                         sx={{ 
                           height: 18, 
                           fontSize: '0.6rem', 
                           fontWeight: 'bold',
                           color: 'text.secondary',
                           borderColor: 'divider',
                           borderRadius: 1
                         }} 
                       />
                    </Show>

                    {/* Score Text */}
                    <Show when={asset.verdict?.score}>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {asset.verdict.score} / 10
                      </Typography>
                    </Show>

                  </Stack>
                </Box>

              </Card>
            </Grid>
          )}</For>
        </Grid>
      </Show>
    </Box>
  );
};

export default Gallery;