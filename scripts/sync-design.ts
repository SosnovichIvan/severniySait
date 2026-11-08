import { readFile, readdir } from "node:fs/promises";
const config = JSON.parse(await readFile("design/opendesign.json", "utf8")) as {
  projectId: string;
};
const base = process.env.OPENDESIGN_API_URL ?? "http://127.0.0.1:56883";
let layouts = 0;
for (const name of await readdir("design")) {
  if (!/\.(html|png|jpg|webp)$/.test(name)) continue;
  const binary = !name.endsWith(".html");
  if (!binary) layouts++;
  const response = await fetch(
    `${base}/api/projects/${config.projectId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        content: (await readFile(`design/${name}`)).toString(
          binary ? "base64" : "utf8",
        ),
        encoding: binary ? "base64" : "utf8",
        overwrite: true,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`OpenDesign write ${name}: ${response.status}`);
}
console.log(`OpenDesign: ${layouts} layouts updated.`);
