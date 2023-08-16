//@ts-check
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { logAllUrl } from "./helper/all-ip.ts";
import AdmZip from "npm:adm-zip";
import { res_error } from "./helper/res_error.ts";
import { WalkFile } from "./helper/WalkFs.ts";

const __dirname = fileURLToPath(import.meta.resolve("./"));

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, {
  recursive: true,
});

const port = 3001;

/**
 * @type {Record<string,(req:http.IncomingMessage,res:http.OutgoingMessage,url:URL)=>void>}
 */
const API = new Map<
  string,
  (req: http.IncomingMessage, res: http.OutgoingMessage, url: URL) => void
>([
  [
    "/download",
    (req, res) => {
      const zip = new AdmZip();
      for (const entry of WalkFile(DATA_DIR)) {
        const relativepath = path.relative(DATA_DIR, entry.entrypath);
        zip.addFile(relativepath, entry.readBinary());
      }
      res.setHeader("Content-Type", "application/zip");
      res.end(zip.toBuffer());
    },
  ]
]);
http
  .createServer(async (req, res) => {
    const origin = `https://${req.headers.host || "localhost"}`;

    const reqUrl = new URL((req.url ?? "").replace("/api/", "/"), origin);
    for (const [url_pattern_input_path, hanlder] of API) {
      const url_pattern = new URLPattern(url_pattern_input_path, origin);
      if (url_pattern.test(reqUrl)) {
        try {
          return await hanlder(req, res, reqUrl);
        } catch (err) {
          res_error(res, err);
        }
      }
    }
    res.statusCode = 502;
    res.end(`GG:${reqUrl}`);
  })
  .listen(port, "0.0.0.0", () => {
    console.log("https://codebeautify.org/jsonviewer");
    for (const url_pattern of API.keys()) {
      logAllUrl(`http://localhost:${port}${url_pattern}`);
    }
  });
