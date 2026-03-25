import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

const API = 'http://localhost:8080/api';
const MAX = 15;
const fmtBytes = (b) => b < 1024*1024 ? `${(b/1024).toFixed(0)}KB` : `${(b/1024/1024).toFixed(1)}MB`;

/* ── Thumbnail ── */
function Thumb({ file, idx, total, onRemove, onUp, onDown }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { const u=URL.createObjectURL(file); setSrc(u); return()=>URL.revokeObjectURL(u); }, [file]);
  return (
    <div className="thumb" style={{animationDelay:`${idx*0.03}s`}}>
      <div className="thumb-holes">{[...Array(4)].map((_,i)=><span key={i} className="hole"/>)}</div>
      <div className="thumb-img-wrap">
        {src && <img src={src} alt={file.name} className="thumb-img"/>}
        <div className="thumb-num">{String(idx+1).padStart(2,'0')}</div>
        <button className="thumb-remove" onClick={()=>onRemove(idx)}>✕</button>
      </div>
      <div className="thumb-holes">{[...Array(4)].map((_,i)=><span key={i} className="hole"/>)}</div>
      <div className="thumb-meta">
        <span className="thumb-name">{file.name.length>14?file.name.slice(0,12)+'…':file.name}</span>
        <div className="thumb-btns">
          <button onClick={()=>onUp(idx)} disabled={idx===0}>↑</button>
          <button onClick={()=>onDown(idx)} disabled={idx===total-1}>↓</button>
        </div>
      </div>
    </div>
  );
}

function MiniThumb({ file }) {
  const [src, setSrc] = useState(null);
  useEffect(()=>{const u=URL.createObjectURL(file);setSrc(u);return()=>URL.revokeObjectURL(u);},[file]);
  return <div className="mini-thumb">{src&&<img src={src} alt=""/>}</div>;
}

function Clapper({ animate }) {
  return (
    <svg className={`clapper ${animate?'clap':''}`} viewBox="0 0 80 60" fill="none">
      <rect x="2" y="18" width="76" height="40" rx="4" fill="#221e14" stroke="#d4af50" strokeWidth="1.5"/>
      {[0,1,2,3,4].map(i=><line key={i} x1={8+i*16} y1="18" x2={2+i*16} y2="6" stroke="#d4af50" strokeWidth="2" opacity="0.7"/>)}
      <rect x="2" y="2" width="76" height="16" rx="3" fill="#19160f" stroke="#d4af50" strokeWidth="1.5"
        className={animate?'clap-top':''} style={{transformOrigin:'2px 18px'}}/>
      <text x="10" y="14" fill="#d4af50" fontSize="7" fontFamily="'DM Mono'">FRAMEFORGE</text>
    </svg>
  );
}

function ProgressBar({ pct, label }) {
  return (
    <div className="prog-wrap">
      <div className="prog-track">
        <div className="prog-fill" style={{width:`${pct}%`}}/>
        <div className="prog-ticker" style={{left:`${pct}%`}}/>
      </div>
      <div className="prog-row">
        <span className="prog-label">{label}</span>
        <span className="prog-pct">{pct}%</span>
      </div>
    </div>
  );
}

/* ── Data ── */
const FILTERS = [
  {value:'none',     icon:'✦', label:'None',          desc:'No color effect'},
  {value:'fade',     icon:'◈', label:'Fade In/Out',   desc:'Fade at start & end'},
  {value:'kenburns', icon:'⊹', label:'Ken Burns',     desc:'Slow zoom on each image'},
  {value:'grayscale',icon:'◑', label:'Black & White', desc:'Remove all color'},
  {value:'sepia',    icon:'◭', label:'Sepia Vintage', desc:'Warm old-film tone'},
  {value:'vivid',    icon:'✸', label:'Vivid',         desc:'Boost saturation & contrast'},
  {value:'cool',     icon:'❄', label:'Cool Tone',     desc:'Blue-tinted cinematic'},
  {value:'warm',     icon:'☀', label:'Warm Tone',     desc:'Golden warm light'},
  {value:'vignette', icon:'◉', label:'Vignette',      desc:'Dark edges focus'},
  {value:'sharpen',  icon:'◈', label:'Sharpen',       desc:'Enhance edge clarity'},
];

const TRANSITIONS = [
  {value:'none',        icon:'—',  label:'None',         desc:'Hard cut'},
  {value:'crossfade',   icon:'⇌',  label:'Crossfade',    desc:'Smooth blend'},
  {value:'slideleft',   icon:'←',  label:'Slide Left',   desc:'Slide from right'},
  {value:'slideright',  icon:'→',  label:'Slide Right',  desc:'Slide from left'},
  {value:'slideup',     icon:'↑',  label:'Slide Up',     desc:'Slide from bottom'},
  {value:'slidedown',   icon:'↓',  label:'Slide Down',   desc:'Slide from top'},
  {value:'zoomin',      icon:'⊕',  label:'Zoom In',      desc:'Zoom into next'},
  {value:'flash',       icon:'✦',  label:'Flash White',  desc:'White flash burst'},
  {value:'wipeleft',    icon:'▶',  label:'Wipe Left',    desc:'Curtain wipe'},
  {value:'wiperight',   icon:'◀',  label:'Wipe Right',   desc:'Curtain wipe'},
  {value:'dissolve',    icon:'∿',  label:'Dissolve',     desc:'Pixel dissolve'},
  {value:'pixelize',    icon:'⊞',  label:'Pixelize',     desc:'Pixel blur effect'},
  {value:'circleopen',  icon:'◯',  label:'Circle Open',  desc:'Iris open effect'},
  {value:'circleclose', icon:'●',  label:'Circle Close', desc:'Iris close effect'},
  {value:'radial',      icon:'✺',  label:'Radial Wipe',  desc:'Clockwise wipe'},
];

const DURATIONS = [1,2,3,4,5,6,8,10];

export default function App() {
  const [images, setImages]         = useState([]);
  const [imgDur, setImgDur]         = useState(3);      // seconds per image
  const [res, setRes]               = useState('1280x720');
  const [fmt, setFmt]               = useState('mp4');
  const [filter, setFilter]         = useState('none');
  const [transition, setTransition] = useState('none');
  const [tDur, setTDur]             = useState(0.8);
  const [music, setMusic]           = useState(null);
  const [busy, setBusy]             = useState(false);
  const [pct, setPct]               = useState(0);
  const [pctLabel, setPctLabel]     = useState('');
  const [dlUrl, setDlUrl]           = useState(null);
  const [dlName, setDlName]         = useState('');
  const [err, setErr]               = useState(null);
  const [ffOk, setFfOk]             = useState(null);
  const [clapAnim, setClapAnim]     = useState(false);
  const [activeTab, setActiveTab]   = useState('settings'); // settings | filters | transitions
  const stripRef = useRef(null);
  const musicRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/health`).then(r=>setFfOk(r.data.ffmpeg)).catch(()=>setFfOk(false));
  }, []);

  const onDrop = useCallback((accepted) => {
    setErr(null); setDlUrl(null);
    const slots = MAX - images.length;
    if (slots <= 0) { setErr(`Maximum ${MAX} images.`); return; }
    const add = accepted.filter(f=>f.type.startsWith('image/')).slice(0,slots);
    setImages(p=>[...p,...add]);
    setTimeout(()=>stripRef.current?.scrollTo({left:99999,behavior:'smooth'}),100);
  }, [images]);

  const {getRootProps,getInputProps,isDragActive} = useDropzone({
    onDrop, accept:{'image/*':[]}, disabled:images.length>=MAX
  });

  const remove   = i => setImages(p=>p.filter((_,x)=>x!==i));
  const moveUp   = i => setImages(p=>{const a=[...p];[a[i-1],a[i]]=[a[i],a[i-1]];return a;});
  const moveDown = i => setImages(p=>{const a=[...p];[a[i],a[i+1]]=[a[i+1],a[i]];return a;});
  const clear    = () => {setImages([]);setDlUrl(null);setErr(null);setPct(0);setMusic(null);};

  const onMusicDrop = e => {
    const f = e.target.files[0];
    if (f) setMusic(f);
  };

  const convert = async () => {
    if (!images.length) { setErr('Add at least 1 image first.'); return; }
    setErr(null); setDlUrl(null); setBusy(true); setPct(3); setPctLabel('Preparing frames…');
    setClapAnim(true); setTimeout(()=>setClapAnim(false),600);

    const fd = new FormData();
    images.forEach(f=>fd.append('images',f));
    fd.append('imageDuration', imgDur);
    fd.append('resolution', res);
    fd.append('format', fmt);
    fd.append('filter', filter);
    fd.append('transition', transition);
    fd.append('transitionDuration', tDur);
    if (music) fd.append('music', music);

    try {
      const resp = await axios.post(`${API}/convert`, fd, {
        responseType:'blob',
        onUploadProgress: e => {
          const p = Math.round((e.loaded/(e.total||1))*60);
          setPct(3+p); setPctLabel(`Uploading… ${3+p}%`);
        }
      });
      setPct(88); setPctLabel('FFmpeg rendering…');
      await new Promise(r=>setTimeout(r,500));
      setPct(100); setPctLabel('Complete!');
      const blob = new Blob([resp.data],{type:resp.headers['content-type']});
      setDlUrl(URL.createObjectURL(blob));
      setDlName(`frameforge_output.${fmt}`);
    } catch(e) {
      let msg='Conversion failed.';
      try{const t=await e.response?.data?.text();msg=JSON.parse(t)?.error||msg;}catch{}
      setErr(msg); setPct(0); setPctLabel('');
    } finally { setBusy(false); }
  };

  const download = () => { const a=document.createElement('a');a.href=dlUrl;a.download=dlName;a.click(); };

  const totalDur  = (images.length * imgDur).toFixed(1);
  const maxTDur   = Math.max(0.2, (imgDur * 0.4)).toFixed(1);

  return (
    <div className="shell">

      {/* Header */}
      <header className="hdr">
        <div className="hdr-left">
          <Clapper animate={clapAnim}/>
          <div>
            <h1 className="brand">FrameForge</h1>
            <p className="brand-sub">Image → Video Converter</p>
          </div>
        </div>
        <div className="hdr-right">
          {ffOk!==null && (
            <div className={`badge ${ffOk?'badge-ok':'badge-warn'}`}>
              <span className="dot"/>{ffOk?'FFmpeg Ready':'FFmpeg Missing'}
            </div>
          )}
          <div className="counter-display">
            <span className="counter-num">{images.length}</span>
            <span className="counter-slash">/</span>
            <span className="counter-max">{MAX}</span>
            <span className="counter-label">frames</span>
          </div>
        </div>
      </header>

      {/* Film strip */}
      <section className="strip-section">
        <div className="strip-edge left"/>
        <div className="strip-scroll" ref={stripRef}>
          {images.map((f,i)=>(
            <Thumb key={`${f.name}-${i}`} file={f} idx={i} total={images.length}
              onRemove={remove} onUp={moveUp} onDown={moveDown}/>
          ))}
          {images.length<MAX && (
            <div {...getRootProps()} className={`strip-add ${isDragActive?'dz-active':''}`}>
              <input {...getInputProps()}/>
              <span className="add-icon">＋</span>
              <span className="add-label">Drop or click</span>
            </div>
          )}
          {images.length===0 && <div className="strip-empty"><span>No frames loaded</span></div>}
        </div>
        <div className="strip-edge right"/>
      </section>

      <main className="main">
        {images.length===0 && (
          <div {...getRootProps()} className={`big-drop ${isDragActive?'dz-active':''}`}>
            <input {...getInputProps()}/>
            <div className="big-drop-inner">
              <div className="big-drop-icon">🎞</div>
              <h2 className="big-drop-title">Drop your images here</h2>
              <p className="big-drop-sub">JPG · PNG · BMP · WebP — up to {MAX} images</p>
              <span className="big-drop-btn">Browse Files</span>
            </div>
          </div>
        )}

        {images.length>0 && (
          <div className="workspace">

            {/* Left panel — tabs */}
            <div className="left-panel">
              {/* Tab bar */}
              <div className="tab-bar">
                {['settings','filters','transitions'].map(t=>(
                  <button key={t} className={`tab-btn ${activeTab===t?'active':''}`}
                    onClick={()=>setActiveTab(t)}>
                    {t==='settings'?'⚙ Settings':t==='filters'?'🎨 Filters':'✨ Transitions'}
                  </button>
                ))}
              </div>

              {/* Settings Tab */}
              {activeTab==='settings' && (
                <div className="tab-content">
                  <div className="card">
                    <h3 className="card-title"><span className="title-accent">01</span> Timing</h3>

                    <div className="field">
                      <label>Seconds per Image <span className="field-val">{imgDur}s</span></label>
                      <div className="dur-presets">
                        {DURATIONS.map(d=>(
                          <button key={d} className={`dur-btn ${imgDur===d?'active':''}`}
                            onClick={()=>setImgDur(d)}>{d}s</button>
                        ))}
                      </div>
                      <p className="field-hint">Total video duration: <strong>{totalDur}s</strong> ({images.length} images × {imgDur}s)</p>
                    </div>

                    <h3 className="card-title" style={{marginTop:'20px'}}><span className="title-accent">02</span> Output</h3>

                    <div className="field">
                      <label>Resolution</label>
                      <select value={res} onChange={e=>setRes(e.target.value)}>
                        <option value="640x480">640×480 — SD (small file)</option>
                        <option value="1280x720">1280×720 — HD (recommended)</option>
                        <option value="1920x1080">1920×1080 — Full HD</option>
                        <option value="3840x2160">3840×2160 — 4K (slow)</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Format</label>
                      <select value={fmt} onChange={e=>setFmt(e.target.value)}>
                        <option value="mp4">MP4 — Best for Windows/Web</option>
                        <option value="avi">AVI — Legacy Windows</option>
                        <option value="webm">WebM — Best for Browser</option>
                      </select>
                    </div>

                    {/* Music upload */}
                    <h3 className="card-title" style={{marginTop:'20px'}}><span className="title-accent">03</span> Background Music</h3>
                    <div className="music-drop" onClick={()=>musicRef.current?.click()}>
                      <input ref={musicRef} type="file"
                        accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/*"
                        style={{display:'none'}} onChange={onMusicDrop}/>
                      {music ? (
                        <div className="music-loaded">
                          <span className="music-icon">🎵</span>
                          <div>
                            <p className="music-name">{music.name}</p>
                            <p className="music-size">{fmtBytes(music.size)}</p>
                          </div>
                          <button className="music-clear" onClick={e=>{e.stopPropagation();setMusic(null);}}>✕</button>
                        </div>
                      ) : (
                        <div className="music-empty">
                          <span className="music-icon">♪</span>
                          <p>Click to add music</p>
                          <p className="music-hint">MP3 · WAV · OGG — music auto-trims to video length</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Tab */}
              {activeTab==='filters' && (
                <div className="tab-content">
                  <div className="card">
                    <h3 className="card-title"><span className="title-accent">🎨</span> Color Filters</h3>
                    <p className="tab-hint">Applied to every image in the video</p>
                    <div className="option-grid">
                      {FILTERS.map(f=>(
                        <button key={f.value}
                          className={`option-btn ${filter===f.value?'active':''}`}
                          onClick={()=>setFilter(f.value)}>
                          <span className="opt-icon">{f.icon}</span>
                          <span className="opt-label">{f.label}</span>
                          <span className="opt-desc">{f.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Transitions Tab */}
              {activeTab==='transitions' && (
                <div className="tab-content">
                  <div className="card">
                    <h3 className="card-title"><span className="title-accent">✨</span> Transitions</h3>
                    <p className="tab-hint">Effect between each image</p>
                    <div className="option-grid">
                      {TRANSITIONS.map(t=>(
                        <button key={t.value}
                          className={`option-btn ${transition===t.value?'active':''}`}
                          onClick={()=>setTransition(t.value)}>
                          <span className="opt-icon">{t.icon}</span>
                          <span className="opt-label">{t.label}</span>
                          <span className="opt-desc">{t.desc}</span>
                        </button>
                      ))}
                    </div>

                    {transition!=='none' && (
                      <div className="field" style={{marginTop:'20px'}}>
                        <label>
                          Transition Duration
                          <span className="field-val">{tDur}s</span>
                        </label>
                        <input type="range" min="0.2" max={maxTDur} step="0.1"
                          value={Math.min(tDur, parseFloat(maxTDur))}
                          onChange={e=>setTDur(parseFloat(e.target.value))}/>
                        <p className="field-hint">
                          Max <strong>{maxTDur}s</strong> for {imgDur}s images.
                          Increase "Seconds per Image" for longer transitions.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — summary + export */}
            <div className="right-panel">
              <div className="card convert-card">
                <h3 className="card-title"><span className="title-accent">⬡</span> Summary</h3>

                <div className="summary-grid">
                  <div className="sg-item"><span className="sg-val">{images.length}</span><span className="sg-key">Images</span></div>
                  <div className="sg-item"><span className="sg-val">{totalDur}s</span><span className="sg-key">Duration</span></div>
                  <div className="sg-item"><span className="sg-val">{imgDur}s</span><span className="sg-key">Per Image</span></div>
                  <div className="sg-item"><span className="sg-val">.{fmt}</span><span className="sg-key">Format</span></div>
                </div>

                <div className="tag-row">
                  <span className="tag">{FILTERS.find(f=>f.value===filter)?.icon} {FILTERS.find(f=>f.value===filter)?.label}</span>
                  {transition!=='none' && <span className="tag">{TRANSITIONS.find(t=>t.value===transition)?.icon} {TRANSITIONS.find(t=>t.value===transition)?.label}</span>}
                  {music && <span className="tag">♪ Music</span>}
                </div>

                <div className="mini-strip">
                  {images.slice(0,8).map((f,i)=><MiniThumb key={i} file={f}/>)}
                  {images.length>8 && <div className="mini-more">+{images.length-8}</div>}
                </div>

                <button className="btn-clear" onClick={clear}>✕ Clear all</button>

                {ffOk===false && <div className="alert alert-warn">⚠ FFmpeg not found. <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">Download →</a></div>}
                {err && <div className="alert alert-err">{err}</div>}
                {busy && <ProgressBar pct={pct} label={pctLabel}/>}

                <button className={`btn-convert ${busy?'busy':''}`}
                  onClick={convert} disabled={busy||images.length===0||ffOk===false}>
                  {busy?<><span className="spin"/> Rendering…</>:<><span className="btn-icon">▶</span> Render Video</>}
                </button>

                {dlUrl && (
                  <div className="dl-wrap">
                    <div className="dl-success">
                      <span className="dl-check">✓</span>
                      <div><p className="dl-title">Video ready!</p><p className="dl-sub">{dlName}</p></div>
                    </div>
                    <button className="btn-dl" onClick={download}>⬇ Download Video</button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      <footer className="ftr">
        <div className="ftr-reel">{[...Array(12)].map((_,i)=><span key={i} className="reel-hole"/>)}</div>
        <span>FrameForge v7 · Spring Boot 3 + FFmpeg + React 18</span>
        <div className="ftr-reel">{[...Array(12)].map((_,i)=><span key={i} className="reel-hole"/>)}</div>
      </footer>
    </div>
  );
}
