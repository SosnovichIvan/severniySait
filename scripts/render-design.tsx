import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { App } from "../src/app/shell";
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
  await writeFile(
    `design/${entry.file}`,
    await readFile(`content/media/${entry.file}`),
  );
}
const editorialMedia = archive.map((entry) => ({
  eventDate: entry.eventDate,
  id: entry.key,
  title: entry.title,
  description: entry.description,
  url: entry.file,
  kind: "image",
  published: true,
}));
const pages = [
  ["home", "/"],
  ["media", "/media"],
  ["divisions", "/divisions"],
  ["calendar", "/calendar"],
  ["links", "/links"],
  ["admin", "/admin"],
];
for (const theme of ["dark", "light"])
  for (const [name, path] of pages) {
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: () => theme },
      configurable: true,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    client.setQueryData(["content"], { media: editorialMedia, events: [] });
    client.setQueryData(["session"], {
      admin: path === "/admin",
      csrf: "design-only",
    });
    client.setQueryData(["admin-content"], { events: [], media: [] });
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
    const script = `document.querySelector('.theme-toggle').onclick=function(){var root=document.documentElement;var next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;var icon=this.querySelector('svg');if(icon)icon.innerHTML=next==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>':'<path d="M20.9 13A9 9 0 1 1 11 3.1 7 7 0 0 0 20.9 13Z"/>';this.setAttribute('aria-label',next==='dark'?'Включить светлую тему':'Включить тёмную тему');document.querySelectorAll('a[href]').forEach(a=>{a.setAttribute('href',a.getAttribute('href').replace(/-(dark|light)\\.html$/, '-'+next+'.html'));});};document.querySelector('.menu-toggle').onclick=function(){var opened=document.querySelector('.navigation').classList.toggle('open');this.setAttribute('aria-expanded',String(opened));this.setAttribute('aria-label',opened?'Закрыть меню':'Открыть меню');};`;

    await writeFile(
      `design/${name}-${theme}.html`,
      `<!doctype html><html lang="ru" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Северный человек · ${name} · ${theme}</title><style>${css}</style></head><body>${markup}<script>${script}</script></body></html>`,
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
console.log("13 responsive OpenDesign layouts generated.");
