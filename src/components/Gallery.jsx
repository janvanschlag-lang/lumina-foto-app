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

  // --- LIVE DATA LISTENER ---
  createEffect(() => {
    const q = query(collection(db, "assets"), orderBy("uploadedAt", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedAssets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssets(loadedAssets);
      setLoading(false);

      // AUTO-SELECT: Wenn noch nichts gewählt ist, nimm das allererste (neueste) Bild
      if (loadedAssets.length > 0 && !props.selectedId) {
         props.onSelect(loadedAssets[0]);
      }

    }, (error) => { console.error("Gallery Error:", error); setLoading(false); });
    onCleanup(() => unsubscribe());
  });

  const handleFileChange = (e) => {
    if (e.target.files) props.onFilesSelected(Array.from(e.target.files));
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
              py: 1.5, px: 2, borderStyle: 'dashed', borderWidth: 1, 
              borderColor: isHovering() ? 'primary.main' : 'divider',
              bgcolor: isHovering() ? 'action.hover' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              cursor: 'pointer', transition: 'all 0.2s', color: 'text.secondary',
              '&:hover': { borderColor: 'text.primary', color: 'text.primary', bgcolor: 'action.hover' }
            }}
          >
            <AddPhotoAlternateIcon fontSize="small" color="inherit" />
            <Typography variant="body2" color="inherit" fontWeight="600">Click or Drop to Import</Typography>
          </Paper>
        </label>
      </Box>

      {/* 2. HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline" color="text.secondary">Library Stream ({assets().length})</Typography>
      </Stack>

      {/* 3. GRID */}
      <Show when={!loading()} fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress color="inherit" size={20} /></Box>}>
        <Grid container spacing={2}>
          <For each={assets()}>{(asset) => (
            <Grid item xs={12} sm={6} md={6} lg={4} xl={4}> 
              <Card 
                onClick={() => props.onSelect(asset)}
                onMouseEnter={() => props.onHoverStart(asset)}
                onMouseLeave={() => props.onHoverEnd()}
                elevation={0}
                sx={{ 
                  cursor: 'pointer', 
                  bgcolor: 'background.paper', // #121212 (Solid) - Match Sidebar
                  border: '1px solid transparent', 
                  borderRadius: 0,
                  position: 'relative',
                  opacity: props.selectedId === asset.id ? 1 : 0.85,
                  transition: 'none', // Performance: Keine Transition für Opacity/Hover
                  '&:hover': { 
                     borderColor: 'rgba(255,255,255,0.4)', 
                     zIndex: 2 
                  },
                  ...(props.selectedId === asset.id && { 
                     borderColor: 'primary.main', 
                     boxShadow: '0 0 0 1px white',
                     opacity: 1,
                     zIndex: 1
                  })
                }}
              >
                {/* Image Container */}
                <Box sx={{ position: 'relative', aspectRatio: '3/2', bgcolor: '#000', mb: 0 }}>
                  <Show when={asset.urls?.preview} fallback={<Box sx={{width:'100%', height:'100%'}} />}>
                    <CardMedia 
                       component="img" 
                       image={asset.urls.preview} 
                       alt={asset.filename} 
                       sx={{ height: '100%', width: '100%', objectFit: 'contain' }} 
                    />
                  </Show>
                </Box>

                {/* Footer */}
                <Box sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" noWrap color="text.primary" sx={{ fontWeight: 600, maxWidth: '65%' }}>
                      {asset.filename}
                    </Typography>
                    <Show when={asset.verdict?.flag}>
                       <Chip label={asset.verdict.flag} size="small" variant="outlined" sx={{ height: 20, fontWeight: 600, color: 'text.secondary', borderColor: 'divider', borderRadius: 0.5 }} />
                    </Show>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.2}>
                      <For each={Array(asset.verdict?.rating || 0)}>{() => <StarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}</For>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                       <Show when={asset.aiAnalysis?.color_analysis?.cast_detected}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} /></Show>
                       <Show when={asset.verdict?.score}>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{asset.verdict.score}</Typography>
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