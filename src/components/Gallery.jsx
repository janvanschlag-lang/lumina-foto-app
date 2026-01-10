import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from '../firebase'; // Hier ist ../ korrekt!

const Gallery = (props) => {
  const [assets, setAssets] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

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

  const renderStars = (rating) => "★".repeat(rating || 0) + "☆".repeat(5 - (rating || 0));

  return (
    <div style={{ padding: '20px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Library Stream ({assets().length})
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        
        {/* WICHTIG: loading() muss als Funktion aufgerufen werden! */}
        <Show when={!loading()} fallback={<div style={{ color: '#444', fontSize: '11px' }}>Lade Assets...</div>}>
          <For each={assets()}>{(asset) => (
            <div 
              onClick={() => props.onSelect(asset)}
              style={{ 
                background: '#161616', 
                border: props.selectedId === asset.id ? '1px solid #eee' : '1px solid #333',
                borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.1s', position: 'relative'
              }}
            >
              
              <div style={{ aspectRatio: '3/2', background: '#222', position: 'relative' }}>
                <Show when={asset.urls && asset.urls.preview} fallback={<div style={{height:'100%', width:'100%', background:'#222'}}></div>}>
                  <img src={asset.urls.preview} loading="lazy" alt={asset.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Show>
                
                {/* Flags */}
                <div style={{ position: 'absolute', top: '6px', left: '6px' }}>
                   <Show when={asset.verdict?.flag === 'pick'}>
                     <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#eee', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>✓</div>
                   </Show>
                   <Show when={asset.verdict?.flag === 'reject'}>
                     <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#f44', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>✕</div>
                   </Show>
                </div>

                {/* Score */}
                <Show when={asset.verdict?.score}>
                  <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>
                    {asset.verdict.score}
                  </div>
                </Show>
              </div>

              {/* Info Footer */}
              <div style={{ padding: '8px' }}>
                <div style={{ fontSize: '10px', color: '#ccc', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {asset.filename}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#ffd700' }}>{renderStars(asset.verdict?.rating)}</div>
                  <Show when={asset.aiAnalysis?.color_analysis?.cast_detected}>
                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#fb4' }} title="Color Cast"></div>
                  </Show>
                </div>
              </div>

            </div>
          )}</For>
        </Show>
      </div>
    </div>
  );
};

export default Gallery;