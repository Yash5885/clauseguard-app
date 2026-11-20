'use client';
import {useRef,useState,useEffect} from 'react';
import {CloudUpload,FileText,X,LockKeyhole,LoaderCircle} from 'lucide-react';
export function validateUpload(file:File){if(!/\.(pdf|docx)$/i.test(file.name))return 'Choose a PDF or DOCX file.';if(file.size>10*1024*1024)return 'Files must be 10 MB or smaller.';if(!file.size)return 'This file is empty. Choose a contract with text.';return '';}
interface Props {onUpload:(file:File,onProgress:(n:number)=>void,signal:AbortSignal)=>Promise<void>;waking?:boolean}
export function Upload({onUpload,waking=false}:Props){
 const input=useRef<HTMLInputElement>(null);const controller=useRef<AbortController|null>(null);const [file,setFile]=useState<File|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [progress,setProgress]=useState(0);const [dragging,setDragging]=useState(false);
 useEffect(()=>()=>controller.current?.abort(),[]);
 function choose(selected?:File){if(!selected)return;const error=validateUpload(selected);setError(error);setFile(error?null:selected);}
 async function submit(){if(!file||busy)return;setBusy(true);setError('');setProgress(0);const abort=new AbortController();controller.current=abort;try{await onUpload(file,setProgress,abort.signal);}catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Upload failed. Please try again.');}finally{if(!abort.signal.aborted)setBusy(false);}}
 return <section className="upload-panel" aria-labelledby="upload-title"><div className="panel-title"><div><h2 id="upload-title">Start a new analysis</h2><p>A little clarity before your next signature.</p></div><span className="label-pill">PDF & DOCX</span></div>
 <input ref={input} id="contract-file" type="file" accept=".pdf,.docx" disabled={busy} className="sr-only" onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}} aria-label="Choose a contract"/>
 <div className={`dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!busy){if(e.dataTransfer.files.length!==1)setError('Upload one contract at a time.');else choose(e.dataTransfer.files[0]);}}}>
 <span className="upload-icon"><CloudUpload size={29} strokeWidth={1.5}/></span><h3>Drop your contract here</h3><p>or choose a file from your computer</p><button type="button" className="button secondary" disabled={busy} onClick={()=>input.current?.click()}>Browse files</button><span className="muted micro">PDF or DOCX · Up to 10 MB · Searchable text</span>
 </div>
 {file&&<div className="selected-file"><FileText size={22}/><div><strong>{file.name}</strong><span className="muted micro">{(file.size/1024).toFixed(1)} KB · Ready to review</span></div><button disabled={busy} className="icon-button" aria-label="Remove selected file" onClick={()=>setFile(null)}><X size={18}/></button></div>}
 {busy&&<div className="upload-progress" role="status"><div><span>{progress<100?'Uploading contract':'Preparing your analysis'}</span><span>{progress}%</span></div><progress max="100" value={progress} aria-label="Upload progress"/></div>}
 {error&&<p role="alert" className="error-message">{error}</p>}
 {waking&&<WakeMessage/>}
 <div className="upload-bottom"><p><LockKeyhole size={14}/>Only you can access your analyses.</p><button className="button" disabled={!file||busy} onClick={()=>void submit()}>{busy?<><LoaderCircle size={16} className="spin"/>Uploading…</>:'Analyze contract'}</button></div></section>;
}
export function WakeMessage(){return <p role="status" className="notice"><LoaderCircle size={16} className="spin"/>Waking up the server, this can take up to a minute. We’ll retry automatically.</p>;}
