'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, Copy, ExternalLink, Image, Moon, Palette, RotateCcw, Sparkles, Sun } from 'lucide-react';

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" fill="#F7F0E7" stroke="#191817" stroke-width="3"/><path d="M21 35c3 8 19 8 22 0M24 25h1M39 25h1" stroke="#191817" stroke-width="4" stroke-linecap="round"/><path d="M32 8v8M8 32h8M48 32h8" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/></svg>`;

export const TOUCH_ME_NOT_PAYLOAD = {
  appId: 'com.example.touchmenot',
  appName: 'Touch me not',
  version: '1.0.0',
  versionCode: 1,
  themeColor: '#F5F0E8',
  fullscreen: true,
  username: 'YOUR_GITHUB_USERNAME',
  accessToken: 'YOUR_GITHUB_ACCESS_TOKEN',
  repo: 'YOUR_REPOSITORY',
  staticBundle: {
    entrypoint: 'index.html',
    files: [
      { path: 'index.html', content: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body><main id="app"></main><script type="module" src="./main.js"></script></body></html>', isBinary: false },
      { path: 'icons.html', content: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body><main id="app"></main><script type="module" src="./main.js"></script></body></html>', isBinary: false },
      { path: 'style.css', content: `:root{font-family:Inter,system-ui,sans-serif;color:#191817;background:#f5f0e8}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f5f0e8;transition:background .45s ease,color .45s ease}body.is-red{background:#b91c1c;color:#fff}.screen,.icons-screen{min-height:100vh;display:grid;place-items:center;padding:32px}.stack{text-align:center}.pill{border:2px solid currentColor;border-radius:999px;background:transparent;padding:18px 30px;font:700 16px inherit;cursor:pointer}.pill:hover{background:currentColor;color:#f5f0e8}.icon{width:82px;height:82px;margin:0 auto 28px}.floating{position:fixed;right:22px;bottom:22px;border:0;border-radius:50%;width:56px;height:56px;background:#191817;color:#fff;cursor:pointer}.icons-screen{display:block;padding:48px 24px}.icons-screen header{display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:720px;margin:0 auto 40px}.icon-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;max-width:720px;margin:auto}.icon-card{border:2px solid #191817;background:transparent;border-radius:18px;padding:18px;cursor:pointer;color:inherit}.icon-card[aria-pressed=true]{outline:3px solid #b91c1c;outline-offset:3px}.icon-card svg{width:72px;height:72px}.back{color:inherit;text-decoration:none}`, isBinary: false },
      { path: 'main.js', content: `const app=document.querySelector('#app');const icons=[${iconSvg},<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27" fill="#B91C1C" stroke="#F7F0E7" stroke-width="3"/><path d="M21 35c3 8 19 8 22 0M24 25h1M39 25h1" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M32 12v8" stroke="#F7F0E7" stroke-width="3" stroke-linecap="round"/></svg>];const red=()=>document.body.classList.toggle('is-red');if(location.pathname.endsWith('icons.html')){app.innerHTML='<section class="icons-screen"><header><a class="back" href="./index.html">← Touch me not</a><strong>Choose an icon</strong></header><div class="icon-grid">'+icons.map((svg,i)=>'<button class="icon-card" aria-pressed="'+(i===0)+'" data-icon="'+i+'">'+svg+'<br>Mark '+(i+1)+'</button>').join('')+'</div></section>';document.querySelectorAll('[data-icon]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-icon]').forEach(item=>item.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');}));}else{app.innerHTML='<section class="screen"><div class="stack"><div class="icon">'+icons[0]+'</div><p>Touch me not</p><button class="pill" id="touch">Don\'t touch</button></div><a class="floating" href="./icons.html" aria-label="Change icon">✦</a></section>';document.querySelector('#touch').addEventListener('click',()=>{red();document.querySelector('#touch').textContent=document.body.classList.contains('is-red')?'I SAID DON\'T TOUCH!':'Don\'t touch'});}`, isBinary: false },
    ],
  },
};

const exactJavaScript = `const payload = ${JSON.stringify(TOUCH_ME_NOT_PAYLOAD, null, 2)};

const response = await fetch('https://lbuild-eight.vercel.app/api/larp/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const result = await response.json();
if (!response.ok) throw new Error(result.error || result.message || 'LARP build failed');
console.log(result);`;

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [red, setRed] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(exactJavaScript); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return <main className="tmn-shell">
    <nav className="tmn-nav"><Link href="/" className="tmn-brand"><span className="brand-mark">L</span><span>Larp v1.1 <small>Exact build reference</small></span></Link><div className="nav-links"><Link className="active" href="/">Touch me not</Link><Link href="/icons">Icon studio</Link></div><a className="nav-api" href="#payload">API payload <ArrowDown size={14}/></a></nav>
    <section className={`tmn-hero ${red ? 'is-red' : ''}`}>
      <div className="hero-kicker"><Sparkles size={14}/> TWO-PAGE REFERENCE APP</div>
      <div className="hero-icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      <p className="eyebrow">Touch me not</p>
      <h1>{red ? 'I said don’t touch!' : 'Don’t touch'}</h1>
      <p className="hero-copy">A deliberately simple interaction to verify that HTML, CSS, JavaScript, inline SVG, and separate asset paths all survive the LARP build.</p>
      <button className="danger-pill" onClick={() => setRed(!red)}>{red ? 'I SAID DON’T TOUCH!' : 'Don’t touch'}</button>
      <div className="hero-footer"><span><span className="status-dot"/> CSS state is {red ? 'blood red' : 'off-white'}</span><span>Tap the floating control to change icons</span></div>
      <Link href="/icons" className="floating-icon" aria-label="Open icon studio"><Palette size={20}/></Link>
    </section>
    <section id="payload" className="payload-section"><div className="section-heading"><div><p className="eyebrow">Reproducible request</p><h2>Exact JavaScript payload</h2></div><button className="copy-button" onClick={copy}><Copy size={16}/>{copied ? 'Copied' : 'Copy full snippet'}</button></div><p className="muted">Paste this into a JavaScript environment. Replace the three GitHub placeholders with the caller’s own credentials; the payload itself is fully customizable.</p><pre className="code-panel"><code>{exactJavaScript}</code></pre></section>
  </main>;
}
