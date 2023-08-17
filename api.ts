import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import AdmZip from "npm:adm-zip";
import { fileURLToPath } from "node:url";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import { WalkFile } from "./helper/WalkFs.ts";

const HTTP_PORT = 3001;

const __dirname = fileURLToPath(import.meta.resolve("./"));

export class WeChatChannelsToolsServer {
    readonly static #DATA_DIR = path.join(__dirname, "data");
    #http!: http;
    #api = new Map<
        string,
        (req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) => void
    >([
        ["/download", this.#apiDownload]
    ]);

    constructor() {
        fs.mkdirSync(WeChatChannelsToolsServer.#DATA_DIR, {
            recursive: true,
        });
        this.#http = http.createServer(this.#httpRequestListener.bind(this))
                         .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener.bind(this));
    }

    async #httpRequestListener(
        req: http.IncomingMessage,
        res: http.OutgoingMessage
    ) {
        console.log("___request_listener", req.url);
        const origin = `https://${req.headers.host || "localhost"}`;
        const reqUrl = new URL((req.url ?? "").replace("/api/", "/"), origin);
        for (const [route, handler] of this.#api) {
            const urlPattern = new URLPattern(route, origin);
            if (urlPattern.test(reqUrl)) {
                try {
                    console.log("___request_api", reqUrl.pathname, reqUrl.search);
                    return await handler(req, res, reqUrl.searchParams);
                } catch (err: any) {
                    res_error(res, err);
                }
            }
        }
        res.statusCode = 502;
        res.end();
    }

    #httpListeningListener() {
        for (const route of this.#api.keys()) {
            logAllUrl(`http://localhost:${HTTP_PORT}${route}`);
        }
    }
    
    #apiDownload(
        req: http.IncomingMessage,
        res: http.OutgoingMessage,
        params: URLSearchParams
    ) {
        const zip = new AdmZip();
        for (const entry of WalkFile(WeChatChannelsToolsServer.#DATA_DIR)) {
            const relativePath = path.relative(WeChatChannelsToolsServer.#DATA_DIR, entry.entrypath);
            zip.addFile(relativePath, entry.readBinary());
        }
        res.setHeader("Content-Type", "application/zip");
        res.end(zip.toBuffer());
    }
}

export default function startup() {
    new WeChatChannelsToolsServer();
}
startup();