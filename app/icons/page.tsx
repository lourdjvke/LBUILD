'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Copy, Image, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

const icons = [
  { name: 'Sun mark', color: '#F5F0E8', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" fill="#F7F0E7" stroke="#191817" stroke-width="3"/><path d="M21 35c3 8 19 8 22 0M24 25h1M39 25h1" stroke="#191817" stroke-width="4" stroke-linecap="round"/><path d="M32 8v8M8 32h8M48 32h8" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/></svg>' },
  { name: 'Blood mark', color: '#B91C1C', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" fill="#B91C1C" stroke="#F7F0E7" stroke-width="3"/><path d="M21 35c3 8 19 8 22 0M24 25h1M39 25h1" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M32 12v8" stroke="#F7F0E7" stroke-width="3" stroke-linecap="round"/></svg>' },
  { name: 'Night mark', color: '#191817', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" fill="#191817" stroke="#F7F0E7" stroke-width="3"/><path d="M21 35c3 8 19 8 22 0M24 25h1M39 25h1" stroke="#F7F0E7" stroke-width="4" stroke-linecap="round"/><path d="M39 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#B91C1C"/></svg>' },
];

export default function IconsPage() {
  const [selected, setSelected] = useState(0); const [copied, setCopied] = useState(false);
  const selectedIcon = icons[selected];
  const snippet = `const iconVariant = ${JSON.stringify({ id: 'touch-mark', name: selectedIcon.name, isDefault: selected === 0, svg: selectedIcon.svg, backgroundColor: selectedIcon.color }, null, 2)};`;
  const copy = async () => { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <main className="tmn-shell"><nav className="tmn-nav"><Link href="/" className="tmn-brand"><span className="brand-mark">L</span><span>Larp v1.1 <small>Exact build reference</small></span></Link><div className="nav-links"><Link href="/">Touch me not</Link><Link className="active" href="/icons">Icon studio</Link></div><Link href="/" className="nav-api"><ArrowLeft size={14}/> Back to app</Link></nav><section className="studio"><div className="studio-copy"><p className="eyebrow">Page two · inline assets</p><h1>Choose the mark.</h1><p className="hero-copy">These icon variants are embedded as SVG source in the request. No <code>/icons/foo.svg</code> paths, no missing assets, and no external image dependency.</p><div className="icon-grid">{icons.map((icon, i) => <button key={icon.name} className={`icon-card ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)}><span className="card-art" dangerouslySetInnerHTML={{ __html: icon.svg }}/><span>{icon.name}</span>{selected === i && <Check size={15}/>}</button>)}</div></div><div className="preview-card"><p className="eyebrow">Live launcher preview</p><div className="large-art" dangerouslySetInnerHTML={{ __html: selectedIcon.svg }}/><h2>{selectedIcon.name}</h2><p className="muted">Inline SVG source ready for <code>iconVariants</code>.</p><button className="copy-button" onClick={copy}><Copy size={16}/>{copied ? 'Copied variant' : 'Copy variant'}</button></div></section><section className="payload-section compact"><div className="section-heading"><div><p className="eyebrow">Selected asset</p><h2>Exact SVG variant</h2></div><span className="path-label">staticBundle / icons</span></div><pre className="code-panel"><code>{snippet}</code></pre></section></main>;
}
