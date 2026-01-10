import { createSignal, Show, For } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import Gallery from './components/Gallery';
import theme from './theme';
import './App.css'; 

// SUID Imports
import { ThemeProvider, CssBaseline, Box, Typography, Chip, Stack, Button, Paper, Grid } from "@suid/material";

// Icons
import UploadFileIcon from "@suid/icons-material/UploadFile";
import ArrowBackIcon from "@suid/icons-material/ArrowBack";
import AutoAwesomeIcon from "@suid/icons-material/AutoAwesome";
import StarIcon from "@suid/icons-material/Star";

// Helper: Custom Log Console
const LogConsole = (props) => (
  <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default', p: 1, borderTop: 1, borderColor: 'divider' }}>
    <Typography variant="overline" color="text.secondary" display="block" gutterBottom>Protokoll</Typography>
    <For each={props.logs()}>{(log) => (
      <Box sx={{ 
        mb: 0.5, pl: 1, 
        borderLeft: 2, 
        borderColor: log.type === 'error' ? 'error.main' : log.type === 'success' ? 'success.main' : 'info.main',
        color: 'text.secondary', fontSize: '0.7rem', fontFamily: 'monospace'
      }}>
        <span style={{ color: '#666', marginRight: '4px' }}>{log.time.split(' ')[0]}</span>
        {log.text}
      </Box>
    )}</For>
  </Box>
);

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [activeAsset, setActiveAsset] = createSignal(null); 

  const addLog = (text, type = 'info') => {
    setLogs(prev => [{ text, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleBundleIngest = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsProcessing(true); setLogs([]); setActiveAsset(null);
    
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) { addLog("⚠️ Keine NEF Datei.", 'error'); setIsProcessing(false); return; }
    addLog(`Batch: ${nefs.length} RAWs.`, 'info');

    for (const rawFile of nefs) {
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      const previewFile = jpgs.find(j => j.name.includes(baseName));
      if (!previewFile) { addLog(`SKIP: ${rawFile.name}`, 'error'); continue; }

      const tempPreviewUrl = URL.createObjectURL(previewFile);
      setActiveAsset({ filename: rawFile.name, urls: { preview: tempPreviewUrl }, ai: null });
      addLog(`⚡ Verarbeite: ${rawFile.name}`, 'process');
      
      const result = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));
      if (result.success) {
        addLog(`✅ Archiviert: ${baseName}`, 'success');
        setActiveAsset({ ...result.data, urls: { preview: tempPreviewUrl } });
      } else { addLog(`❌ Fehler: ${baseName}`, 'error'); }
    }
    setIsProcessing(false); addLog("--- Fertig ---", 'info');
  };

  const handleGallerySelect = (asset) => {
    setActiveAsset({
      filename: asset.filename, urls: asset.urls, ai: asset.aiAnalysis,
      exif: { model: asset.meta.camera, lens: asset.meta.lens, iso: asset.meta.iso, aperture: asset.meta.aperture, shutter: asset.meta.shutter }
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div class="app-grid-container">
        
        {/* 1. LEFT SIDEBAR */}
        <div class="left-sidebar">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="bold">Lumina Ingest</Typography>
            <Typography variant="caption" color="text.secondary">CoreBrain v0.8 Material</Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            <input type="file" id="fileInput" multiple onChange={handleBundleIngest} style={{ display: 'none' }} accept=".nef,.dng,.jpg,.jpeg" disabled={isProcessing()}/>
            <label htmlFor="fileInput">
              <Paper variant="outlined" sx={{ 
                height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                cursor: isProcessing() ? 'wait' : 'pointer', borderStyle: 'dashed', borderColor: 'text.secondary',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
              }}>
                <UploadFileIcon sx={{ fontSize: 30, color: 'text.secondary', mb: 1 }} />
                <Typography variant="caption" color="text.secondary">Import Bundle</Typography>
              </Paper>
            </label>
          </Box>
          <LogConsole logs={logs} />
        </div>

        {/* 2. CENTER STAGE */}
        <div class="center-stage" style={{ background: theme.palette.background.default, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          <Show when={!activeAsset()}>
             {/* Wrapper für Gallery: flex:1 und minHeight:0 sind entscheidend */}
             <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Gallery onSelect={handleGallerySelect} selectedId={null} />
             </Box>
          </Show>

          <Show when={activeAsset()}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden' }}>
              
              {/* Toolbar */}
              <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', bgcolor: 'background.paper', flexShrink: 0 }}>
                 <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => setActiveAsset(null)} sx={{ color: 'text.secondary' }}>
                   Library
                 </Button>
                 <Box flex={1} textAlign="center">
                   <Typography variant="caption" fontFamily="monospace">{activeAsset().filename}</Typography>
                 </Box>
                 <Box width={64} />
              </Box>

              {/* Bild */}
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, overflow: 'hidden', minHeight: 0 }}>
                <img src={activeAsset().urls.preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
              </Box>

              {/* Gemini Report */}
              <Show when={activeAsset().ai?.analysis}>
                <Paper square sx={{ height: 250, flexShrink: 0, overflowY: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
                   <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                         <Chip label={activeAsset().ai.flag?.toUpperCase() || 'NONE'} 
                               color={activeAsset().ai.flag === 'pick' ? 'success' : activeAsset().ai.flag === 'reject' ? 'error' : 'default'} 
                               size="small" sx={{ fontWeight: 'bold' }} />
                         <Typography variant="caption" sx={{ borderLeft: 1, pl: 1, borderColor: 'divider' }}>
                           Score: {activeAsset().ai.score}/10
                         </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                         <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                         <Typography variant="body2" fontWeight="bold" color="warning.main">{activeAsset().ai.rating}/5</Typography>
                      </Stack>
                   </Stack>

                   <Grid container spacing={2}>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">SUBJECT</Typography></Grid>
                      <Grid item xs={9}><Typography variant="body2">{activeAsset().ai.analysis.subject}</Typography></Grid>
                      
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">LIGHT</Typography></Grid>
                      <Grid item xs={9}><Typography variant="body2">{activeAsset().ai.analysis.lighting}</Typography></Grid>
                      
                      <Show when={activeAsset().ai.color_analysis?.cast_detected}>
                        <Grid item xs={3}><Typography variant="caption" color="warning.main">COLOR FIX</Typography></Grid>
                        <Grid item xs={9}><Typography variant="body2" color="warning.light">
                           {activeAsset().ai.color_analysis.correction_hint}
                        </Typography></Grid>
                      </Show>
                   </Grid>
                </Paper>
              </Show>
            </Box>
          </Show>
        </div>

        {/* 3. RIGHT SIDEBAR */}
        <div class="right-sidebar">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">Status Monitor</Typography>
          </Box>
          
          <Show when={activeAsset() && activeAsset().exif} fallback={
             <Box p={3} textAlign="center"><Typography variant="caption" color="text.secondary">Select an image</Typography></Box>
          }>
            <Box p={2}>
               <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'transparent' }}>
                 <Typography variant="caption" color="text.secondary" display="block" mb={1}>RAW DATA</Typography>
                 <Grid container spacing={1}>
                    <Grid item xs={12}><Typography variant="body2" fontWeight="bold">{activeAsset().exif.model}</Typography></Grid>
                    <Grid item xs={12} mb={1}><Typography variant="caption">{activeAsset().exif.lens}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">ISO</Typography><Typography variant="body2" fontFamily="monospace">{activeAsset().exif.iso}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">Aperture</Typography><Typography variant="body2" fontFamily="monospace">{activeAsset().exif.aperture}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">Shutter</Typography><Typography variant="body2" fontFamily="monospace">{activeAsset().exif.shutter}</Typography></Grid>
                 </Grid>
               </Paper>

               <Show when={activeAsset().ai?.keywords}>
                  <Box>
                     <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                       <AutoAwesomeIcon fontSize="small" color="secondary" />
                       <Typography variant="caption" color="secondary.main">GEMINI TAGS</Typography>
                     </Stack>
                     <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <For each={activeAsset().ai.keywords.slice(0, 8)}>{kw => (
                          <Chip label={kw} size="small" variant="outlined" sx={{ borderRadius: 1, height: 20, fontSize: '0.65rem' }} />
                        )}</For>
                     </Box>
                  </Box>
               </Show>
            </Box>
          </Show>
        </div>

      </div>
    </ThemeProvider>
  );
}

export default App;