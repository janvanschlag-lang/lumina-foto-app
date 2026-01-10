import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';

// SUID Imports
import { 
  Box, Card, CardMedia, CardContent, Typography, 
  Chip, Grid, CircularProgress, Stack, Paper
} from "@suid/material";

// Icons
import StarIcon from "@suid/icons-material/Star";
import AddPhotoAlternateIcon from "@suid/icons-material/AddPhotoAlternate";

const Gallery = (props) => {
  const [assets, setAssets] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [isHovering, setIsHovering] = createSignal(false);

  createEffect(() => {
    const q = query(collection(db, "assets"), orderBy("captureDate", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedAssets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssets(loadedAssets);
      setLoading(false);
    }, (error) => { console.error("Gallery Error:", error); setLoading(false); });
    onCleanup(() => unsubscribe());
  });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      props.onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <Box sx={{ padding: 3, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. TOP DROPZONE */}
      <Box 
        sx={{ mb: 3 }}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={(e) => { e.preventDefault(); setIsHovering(false); if (e.dataTransfer.files) props.onFilesSelected(Array.from(e.dataTransfer.files)); }}
      >
        <input accept=".nef,.dng,.jpg,.jpeg" style={{ display: 'none' }} id="gallery-top-upload" multiple type="file" onChange={handleFileChange} />
        <label htmlFor="gallery-top-upload">
          <Paper 
            variant="outlined" 
            sx={{ 
              py: 1.5, px: 2, 
              borderStyle: 'dashed', borderWidth: 1, borderColor: isHovering() ? 'primary.main' : 'divider',
              bgcolor: isHovering() ? 'action.hover' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              cursor: 'pointer', transition: 'all 0.2s', color: 'text.secondary',
              '&:hover': { borderColor: 'text.primary', color: 'text.primary', bgcolor: 'action.hover' }
            }}
          >
            <AddPhotoAlternateIcon fontSize="small" color="inherit" />
            <Typography variant="caption" color="inherit" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Click or Drop to Import
            </Typography>
          </Paper>
        </label>
      </Box>

      {/* 2. HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 'bold', fontSize: '0.7rem' }}>
          Library ({assets().length})
        </Typography>
      </Stack>

      {/* 3. CONTENT GRID */}
      <Show when={!loading()} fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress color="inherit" size={20} /></Box>}>
        
        <Show when={assets().length === 0}>
          <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.3 }}>
            <Typography variant="body2" color="text.secondary">Library is empty.</Typography>
          </Box>
        </Show>

        <Grid container spacing={2}>
          <For each={assets()}>{(asset) => (
            // RESPONSIVE LOGIC:
            // xs (0px+): 1 Spalte (voller Breite)
            // sm (600px+): 2 Spalten
            // md (900px+): 2 Spalten (Da 1 Spalte hier oft zu breit wirkt, aber wir können auf 1 gehen wenn gewünscht)
            // lg (1200px+): 3 Spalten (Das ist dein Fullscreen Ziel)
            <Grid item xs={12} sm={6} md={6} lg={4} xl={4}> 
              <Card 
                onClick={() => props.onSelect(asset)}
                elevation={0}
                sx={{ 
                  cursor: 'pointer', 
                  bgcolor: 'background.paper', // Selbe Farbe wie Sidebar
                  border: '1px solid transparent', // Platzhalter für Border
                  borderRadius: 0, 
                  position: 'relative',
                  transition: 'all 0.1s',
                  // Hover Effect: Weißer Rahmen, keine Opacity Änderung
                  '&:hover': { 
                    borderColor: 'rgba(255,255,255,0.4)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                  },
                  // Active State
                  ...(props.selectedId === asset.id && {
                    borderColor: 'primary.main',
                    boxShadow: '0 0 0 1px white'
                  })
                }}
              >
                {/* IMAGE AREA - LIGHTBOX STYLE */}
                <Box sx={{ 
                  position: 'relative', 
                  aspectRatio: '3/2', 
                  bgcolor: '#050505', // Dunkler als die Karte
                  mb: 0
                }}>
                  <Show when={asset.urls?.preview} fallback={<Box sx={{width:'100%', height:'100%'}} />}>
                    <CardMedia 
                      component="img" 
                      image={asset.urls.preview} 
                      alt={asset.filename} 
                      sx={{ 
                        height: '100%', 
                        width: '100%', 
                        objectFit: 'contain' // WICHTIG: Kein Cropping für Hochformate!
                      }} 
                    />
                  </Show>
                </Box>

                {/* CARD FOOTER */}
                <Box sx={{ p: 1.5 }}>
                  
                  {/* Row 1: Filename & Chip */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" noWrap color="text.primary" sx={{ fontSize: '0.75rem', fontWeight: 600, maxWidth: '60%' }}>
                      {asset.filename}
                    </Typography>
                    
                    {/* Chip (Größer) */}
                    <Show when={asset.verdict?.flag} fallback={<Box />}>
                       <Chip 
                         label={asset.verdict.flag.toUpperCase()} 
                         size="small" 
                         variant="outlined" 
                         sx={{ 
                           height: 20, // Etwas höher
                           fontSize: '0.6rem', 
                           fontWeight: 'bold', 
                           color: 'text.secondary', 
                           borderColor: 'divider', 
                           borderRadius: 0.5 
                         }} 
                       />
                    </Show>
                  </Stack>

                  {/* Row 2: Stars & Score */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.2}>
                      <For each={Array(asset.verdict?.rating || 0)}>{() => 
                        <StarIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                      }</For>
                    </Stack>
                    
                    <Stack direction="row" alignItems="center" spacing={1}>
                       <Show when={asset.aiAnalysis?.color_analysis?.cast_detected}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} title="Color Cast" />
                       </Show>
                       <Show when={asset.verdict?.score}>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ fontSize: '0.7rem' }}>
                          {asset.verdict.score}
                        </Typography>
                       </Show>
                    </Stack>
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