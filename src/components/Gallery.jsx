import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';

// SUID Imports
import { 
  Box, Card, CardMedia, CardContent, Typography, 
  Chip, Grid, CircularProgress, Stack 
} from "@suid/material";

// Icons
import CheckCircleIcon from "@suid/icons-material/CheckCircle";
import CancelIcon from "@suid/icons-material/Cancel";
import HelpIcon from "@suid/icons-material/Help";
import StarIcon from "@suid/icons-material/Star";

const Gallery = (props) => {
  const [assets, setAssets] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  // --- LIVE DATA LISTENER ---
  createEffect(() => {
    const q = query(collection(db, "assets"), orderBy("captureDate", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedAssets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssets(loadedAssets);
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    onCleanup(() => unsubscribe());
  });

  return (
    <Box sx={{ 
      padding: 2, 
      height: '100%', 
      overflowY: 'auto',
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      
      {/* HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 'bold' }}>
          Library Stream ({assets().length})
        </Typography>
      </Stack>

      {/* CONTENT */}
      <Show when={!loading()} fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress color="inherit" size={24} />
        </Box>
      }>
        
        {/* GRID */}
        <Grid container spacing={2}>
          <For each={assets()}>{(asset) => (
            <Grid item xs={6} sm={4} md={3} lg={2} xl={2}> 
              <Card 
                onClick={() => props.onSelect(asset)}
                sx={{ 
                  cursor: 'pointer', 
                  position: 'relative',
                  border: 1,
                  borderColor: props.selectedId === asset.id ? 'primary.main' : 'divider',
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', borderColor: 'text.primary', boxShadow: 4 }
                }}
              >
                {/* IMAGE AREA */}
                <Box sx={{ position: 'relative', aspectRatio: '3/2', bgcolor: 'background.paper' }}>
                  <Show when={asset.urls && asset.urls.preview} fallback={<Box sx={{width:'100%', height:'100%', bgcolor:'#222'}} />}>
                    <CardMedia
                      component="img"
                      image={asset.urls.preview}
                      alt={asset.filename}
                      sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
                    />
                  </Show>
                  
                  {/* FLAG OVERLAY */}
                  <Box sx={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 0.5 }}>
                    <Show when={asset.verdict?.flag === 'pick'}>
                      <Chip icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />} label="PICK" color="success" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                    </Show>
                    <Show when={asset.verdict?.flag === 'reject'}>
                      <Chip icon={<CancelIcon sx={{ fontSize: '1rem !important' }} />} label="REJECT" color="error" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                    </Show>
                    <Show when={asset.verdict?.flag === 'review'}>
                      <Chip icon={<HelpIcon sx={{ fontSize: '1rem !important' }} />} label="REVIEW" color="warning" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                    </Show>
                  </Box>

                  {/* SCORE BADGE */}
                  <Show when={asset.verdict?.score}>
                    <Box sx={{ position: 'absolute', bottom: 4, right: 4, bgcolor: 'rgba(0,0,0,0.85)', color: 'white', borderRadius: 1, px: 0.6, py: 0.1, fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {asset.verdict.score}
                    </Box>
                  </Show>
                </Box>

                {/* CARD FOOTER */}
                <CardContent sx={{ padding: '8px 10px !important', bgcolor: 'background.paper' }}>
                  <Typography variant="body2" noWrap color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
                    {asset.filename}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.2}>
                      <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 'bold', fontSize: '0.75rem' }}>{asset.verdict?.rating || 0}</Typography>
                    </Stack>
                    <Show when={asset.aiAnalysis?.color_analysis?.cast_detected}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', boxShadow: '0 0 4px rgba(251, 191, 36, 0.5)' }} title="Color Cast detected" />
                    </Show>
                  </Stack>
                </CardContent>

              </Card>
            </Grid>
          )}</For>
        </Grid>
      </Show>
    </Box>
  );
};

export default Gallery;