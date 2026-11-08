import { LoginDialog } from "../src/features/editor-login";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { App } from "../src/app/shell";
import channels from "../contracts/channels.json";
import archive from "../content/archive.json";
const files = await readdir(".preview/assets");
const css = await readFile(
  `.preview/assets/${files.find((f) => f.endsWith(".css"))}`,
  "utf8",
);
const logo = await readFile("public/logo.png");
await mkdir("design", { recursive: true });
await writeFile("design/logo.png", logo);
await writeFile(
  "design/mikhail-mavashi.jpg",
  await readFile("public/mikhail-mavashi.jpg"),
);
for (const entry of archive) {
  for (const file of [entry.file, ...(entry.gallery ?? [])]) {
    await writeFile(`design/${file}`, await readFile(`content/media/${file}`));
  }
}
const editorialMedia = archive.map((entry) => ({
  eventDate: entry.eventDate,
  id: entry.key,
  title: entry.title,
  description: entry.description,
  url: entry.file,
  kind: "image",
  published: true,
  images: (entry.gallery ?? []).map((file) => ({ id: file, url: file })),
}));
const pages = [
  ["home", "/"],
  ["login", "/"],
  ["media", "/media"],
  ...archive.map((entry) => [`story-${entry.key}`, `/media/${entry.key}`]),
  ["divisions", "/divisions"],
  ["calendar", "/calendar"],
  ["links", "/links"],
  ["admin", "/admin"],
  ["admin-updates", "/admin?section=updates"],
];
const galleryScript = `document.querySelectorAll('.photo-gallery').forEach(g=>{let n=0;const stage=g.querySelector('.gallery-stage');const thumbs=[...g.querySelectorAll('.gallery-thumbnails button')];const images=thumbs.length?thumbs.map(t=>t.querySelector('img').src):[stage.querySelector('img').src];const modal=g.querySelector('dialog');function show(i){n=(i+images.length)%images.length;stage.querySelector('img').src=images[n];modal.querySelector('img').src=images[n];g.querySelectorAll('.gallery-controls>span').forEach(c=>c.textContent=String(n+1).padStart(2,'0')+' / '+String(images.length).padStart(2,'0'));thumbs.forEach((t,j)=>t.setAttribute('aria-current',String(j===n)));}g.querySelectorAll('[aria-label="Следующее изображение"]').forEach(b=>b.onclick=()=>show(n+1));g.querySelectorAll('[aria-label="Предыдущее изображение"]').forEach(b=>b.onclick=()=>show(n-1));thumbs.forEach((t,i)=>t.onclick=()=>show(i));stage.onclick=()=>modal.showModal();g.querySelector('.gallery-close').onclick=()=>modal.close();g.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();show(n+1);}if(e.key==='ArrowLeft'){e.preventDefault();show(n-1);}};});`;
const selectScript = `document.querySelectorAll('.select-field').forEach(root=>{const button=root.querySelector('[role=combobox]');const list=root.querySelector('[role=listbox]');const options=[...list.querySelectorAll('[role=option]')];let active=0;function close(){list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');}function highlight(n){active=(n+options.length)%options.length;options.forEach((o,i)=>o.dataset.highlighted=String(i===active));button.setAttribute('aria-activedescendant',options[active].id);}function open(){document.querySelectorAll('.select-field [role=combobox][aria-expanded=true]').forEach(b=>{if(b!==button)b.click();});list.hidden=false;button.setAttribute('aria-expanded','true');highlight(Math.max(0,options.findIndex(o=>o.getAttribute('aria-selected')==='true')));}function choose(i){button.querySelector('.select-value').textContent=options[i].querySelector('span').textContent;options.forEach((o,j)=>o.setAttribute('aria-selected',String(i===j)));close();button.focus();}button.onclick=()=>list.hidden?open():close();options.forEach((o,i)=>{o.onclick=()=>choose(i);o.onpointermove=()=>highlight(i);o.onmousedown=e=>e.preventDefault();});button.onkeydown=e=>{if(e.key==='Escape'||e.key==='Tab'){close();return;}if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)){e.preventDefault();if(list.hidden){open();return;}if(e.key==='Enter'||e.key===' ')choose(active);else highlight(e.key==='Home'?0:e.key==='End'?options.length-1:active+(e.key==='ArrowDown'?1:-1));}};document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close();});root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))close();});});`;
const loginScript = `(()=>{const dialog=document.querySelector('.login-dialog');const trigger=document.querySelector('.editor-login');trigger.onclick=()=>{dialog.showModal();trigger.setAttribute('aria-expanded','true');dialog.querySelector('input').focus();};dialog.querySelector('.login-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});dialog.onclick=e=>{if(e.target===dialog)dialog.close();};dialog.querySelector('form').onsubmit=e=>e.preventDefault();})();`;
for (const theme of ["dark", "light"])
  for (const [name, path] of pages) {
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: () => theme },
      configurable: true,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    client.setQueryData(["content"], {
      media: editorialMedia,
      events: [],
      channels,
    });
    client.setQueryData(["session"], {
      admin: path.startsWith("/admin"),
      csrf: "design-only",
    });
    client.setQueryData(["admin-content"], { events: [], media: [] });
    client.setQueryData(["deployments"], {
      enabled: false,
      currentVersion: "local",
      jobs: [],
    });
    const loginClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    loginClient.setQueryData(["session"], {
      admin: false,
      csrf: "design-only",
    });
    const loginMarkup = renderToStaticMarkup(
      <QueryClientProvider client={loginClient}>
        <LoginDialog onClose={() => {}} />
      </QueryClientProvider>,
    );
    let markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    markup = markup
      .replaceAll('src="/logo.png"', 'src="logo.png"')
      .replaceAll('href="/logo.png"', 'href="logo.png"')
      .replaceAll('src="/mikhail-mavashi.jpg"', 'src="mikhail-mavashi.jpg"');
    for (const [target, url] of pages)
      markup = markup.replaceAll(
        `href="${url}"`,
        `href="${target}-${theme}.html"`,
      );
    const script = `document.querySelector('.theme-toggle').onclick=function(){var root=document.documentElement;var next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;var icon=this.querySelector('svg');if(icon)icon.innerHTML=next==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>':'<path d="M20.9 13A9 9 0 1 1 11 3.1 7 7 0 0 0 20.9 13Z"/>';this.setAttribute('aria-label',next==='dark'?'Включить светлую тему':'Включить тёмную тему');document.querySelectorAll('a[href]').forEach(a=>{a.setAttribute('href',a.getAttribute('href').replace(/-(dark|light)\\.html$/, '-'+next+'.html'));});};if(document.querySelector('.menu-toggle')) document.querySelector('.menu-toggle').onclick=function(){var opened=document.querySelector('.navigation').classList.toggle('open');this.setAttribute('aria-expanded',String(opened));this.setAttribute('aria-label',opened?'Закрыть меню':'Открыть меню');};`;

    await writeFile(
      `design/${name}-${theme}.html`,
      `<!doctype html><html lang="ru" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Северный человек · ${name} · ${theme}</title><style>${css}</style></head><body>${markup}${path.startsWith("/admin") ? "" : loginMarkup}<script>${script}${galleryScript}${selectScript}${path.startsWith("/admin") ? "" : loginScript}${name === "login" ? "document.querySelector('.editor-login').click();" : ""}</script></body></html>`,
    );
  }
const entry = await readFile("index.html", "utf8");
const bootStyles = entry.match(/<style>([\s\S]*?)<\/style>/)![1];
const splash = entry
  .match(/<div\s+id="boot-splash"[\s\S]*?<\/div>/)![0]
  .replace('src="/logo.png"', 'src="logo.png"');
await writeFile(
  "design/loading.html",
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Северный человек · загрузка</title><style>${bootStyles}</style></head><body>${splash}</body></html>`,
);
const config = JSON.parse(await readFile("design/opendesign.json", "utf8"));
config.files = (await readdir("design"))
  .filter((file) => file.endsWith(".html"))
  .sort();
await writeFile(
  "design/opendesign.json",
  JSON.stringify(config, null, 2) + "\n",
);
console.log(`${pages.length * 2 + 1} responsive OpenDesign layouts generated.`);
