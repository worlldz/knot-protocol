import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "sites/knot-worker.mjs");
const output = resolve(root, "dist/server/index.js");

await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await copyFile(source, output);

console.log(output);
