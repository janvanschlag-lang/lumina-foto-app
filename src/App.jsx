import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { processAssetBundle } from './services/CoreBrain';
import Gallery from './components/Gallery';
import theme from './theme';
import './App.css'; 

import { ThemeProvider, CssBaseline, Box, Typography, Chip, Stack, Button, Paper, Grid } from "@suid/material";
import UploadFileIcon from "@suid/icons-material/UploadFile";
import AutoAwesomeIcon from "@suid/icons-material/AutoAwesome";
import CloudUploadIcon from "@suid/icons-material/CloudUpload";

const LogConsole = (props) => (
  <Box sx={{ flex: 1, overflowY: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
    <Typography variant="overline" display="block" gutterBottom>Protokoll</Typography>
    <For each={props.logs()}>{(log) => (
      <Box sx={{ mb: 0.5, pl: 1, borderLeft: 2, borderColor: log.type === 'error' ? 'error.main' : log.type === 'success' ? 'success.main' : 'info.main', color: 'text.secondary', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <span style={{ color: '#666', marginRight: '6px' }}>{log.time.split(' ')[0]}</span>{log.text}
      </Box>
    )}</For>
  </Box>
);

function App() {
  const [logs, setLogs] = createSignal([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [activeAsset, setActiveAsset] = createSignal(null); // Selected (Click)
  const [hoverAsset, setHoverAsset] = createSignal(null);   // Preview (Hover)
  const [isDragging, setIsDragging] = createSignal(false);

  onMount(() => {
    const preventDefault = (e) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener("dragover", preventDefault); 
    window.addEventListener("drop", preventDefault);
    onCleanup(() => { window.removeEventListener("dragover", preventDefault); window.removeEventListener("drop", preventDefault); });
  });

  const addLog = (text, type = 'info') => setLogs(prev => [{ text, type, time: new Date().toLocaleTimeString() }, ...prev]);

  const processFiles = async (files) => {
    if (files.length === 0) return;
    setIsProcessing(true); setLogs([]);
    const nefs = files.filter(f => f.name.toLowerCase().endsWith('.nef'));
    const jpgs = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));

    if (nefs.length === 0) { addLog("⚠️ Keine NEF Datei.", 'error'); setIsProcessing(false); return; }
    addLog(`Batch: ${nefs.length} RAWs.`, 'info');

    for (const rawFile of nefs) {
      const baseName = rawFile.name.substring(0, rawFile.name.lastIndexOf('.'));
      const previewFile = jpgs.find(j => j.name.includes(baseName));
      if (!previewFile) { addLog(`SKIP: ${rawFile.name}`, 'error'); continue; }

      const tempPreviewUrl = URL.createObjectURL(previewFile);
      const tempAsset = { filename: rawFile.name, urls: { preview: tempPreviewUrl }, ai: null };
      setActiveAsset(tempAsset); // Show progress immediately
      addLog(`⚡ Verarbeite: ${rawFile.name}`, 'process');
      
      const result = await processAssetBundle(rawFile, previewFile, (msg) => addLog(msg, 'process'));
      if (result.success) {
        addLog(`✅ Archiviert: ${baseName}`, 'success');
        setActiveAsset({ ...result.data, urls: { preview: tempPreviewUrl } });
      } else { addLog(`❌ Fehler: ${baseName}`, 'error'); }
    }
    setIsProcessing(false); addLog("--- Fertig ---", 'info');
  };

  const handleFileInput = (e) => processFiles(Array.from(e.target.files));
  const handleDragOver = (e) => { setIsDragging(true); }; 
  const handleDragLeave = (e) => { setIsDragging(false); };
  const handleDrop = (e) => { setIsDragging(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); };

  const mapAsset = (asset) => ({
      filename: asset.filename, urls: asset.urls, ai: asset.aiAnalysis,
      exif: { model: asset.meta?.camera, lens: asset.meta?.lens, iso: asset.meta?.iso, aperture: asset.meta?.aperture, shutter: asset.meta?.shutter }
  });

  const handleGallerySelect = (asset) => { setActiveAsset(mapAsset(asset)); };
  const handleHoverStart = (asset) => { setHoverAsset(mapAsset(asset)); };
  const handleHoverEnd = () => { setHoverAsset(null); }; // Revert to active

  const displayAsset = () => hoverAsset() || activeAsset();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div class="app-grid-container">
        
        {/* LEFT SIDEBAR (#121212) */}
        <div class="left-sidebar" style={{ backgroundColor: theme.palette.background.paper }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.primary">Lumina Ingest</Typography>
            <Typography variant="caption" color="text.secondary">CoreBrain v0.98 Solid</Typography>
          </Box>
          <LogConsole logs={logs} />
        </div>

        {/* CENTER STAGE (#000000) */}
        <div class="center-stage" 
          style={{ background: theme.palette.background.default, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          
          <Show when={isDragging()}>
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 999, bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #444', margin: 2 }}>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'text.primary', mb: 2 }} />
              <Typography variant="h6" color="text.primary">Drop to Import</Typography>
            </Box>
          </Show>

          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Gallery 
              onSelect={handleGallerySelect} 
              selectedId={activeAsset()?.filename} 
              onFilesSelected={processFiles}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          </Box>
        </div>

        {/* RIGHT SIDEBAR (#121212) */}
        <div class="right-sidebar" style={{ backgroundColor: theme.palette.background.paper }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">Status Monitor</Typography>
          </Box>
          
          <Show when={displayAsset()} fallback={
             <Box p={3} textAlign="center"><Typography variant="caption" color="text.secondary">Select an image</Typography></Box>
          }>
            <Box p={2}>
               <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'transparent', borderRadius: 1 }}>
                 <Typography variant="caption" color="text.secondary" display="block" mb={1}>Raw Data</Typography>
                 <Grid container spacing={1}>
                    <Grid item xs={12}><Typography variant="body2" fontWeight="600">{displayAsset().exif?.model || '-'}</Typography></Grid>
                    <Grid item xs={12} mb={1}><Typography variant="caption">{displayAsset().exif?.lens || '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">ISO</Typography><Typography variant="body2" fontFamily="monospace">{displayAsset().exif?.iso || '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">Aperture</Typography><Typography variant="body2" fontFamily="monospace">{displayAsset().exif?.aperture || '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" display="block" color="text.secondary">Shutter</Typography><Typography variant="body2" fontFamily="monospace">{displayAsset().exif?.shutter || '-'}</Typography></Grid>
                 </Grid>
               </Paper>

               <Show when={displayAsset().ai?.keywords}>
                  <Box mb={2}>
                     <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                       <AutoAwesomeIcon fontSize="small" color="text.secondary" />
                       <Typography variant="caption" color="text.secondary">Gemini Tags</Typography>
                     </Stack>
                     <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <For each={displayAsset().ai.keywords.slice(0, 8)}>{kw => (
                          <Chip label={kw} size="small" variant="outlined" sx={{ borderRadius: 1, height: 22, fontSize: '0.7rem' }} />
                        )}</For>
                     </Box>
                  </Box>
               </Show>

               <Show when={displayAsset().ai?.analysis?.subject}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'transparent', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Subject Analysis</Typography>
                    <Typography variant="caption" color="text.primary" sx={{ lineHeight: 1.4 }}>
                      {displayAsset().ai.analysis.subject}
                    </Typography>
                  </Paper>
               </Show>
            </Box>
          </Show>
        </div>

      </div>
    </ThemeProvider>
  );
}

export default App;