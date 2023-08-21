import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import AdmZip from "npm:adm-zip";
import { WebSocketServer } from "npm:ws";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import { WalkFile } from "./helper/WalkFs.ts";
import { debounce } from "./helper/utils.ts";
import { res_json } from "./helper/res_json.ts";
import type { Duplex } from "node:stream";
import type { Buffer } from "node:buffer";
import type { StatusResult } from "./type.d.ts";

const HTTP_PORT = 3001;
const EMITTER_KEY_WATCH_DATA_CHANGE = Symbol("watch_data_change");

const __dirname = fileURLToPath(import.meta.resolve("./"));
const emitter = new EventEmitter();

const DATA_DIR = path.join(__dirname, "data");

export class WeChatChannelsToolsServer {
    #http!: http;
    #api = new Map<string, (req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) => void>([
        ["/download?*", this.#apiDownload.bind(this)],
        ["/status", this.#apiStatus],
    ]);
    #dataWatcher!: WeChatChannelsToolsDataWatcher;

    constructor() {
        fs.mkdirSync(DATA_DIR, {
            recursive: true,
        });
        this.#dataWatcher = new WeChatChannelsToolsDataWatcher();
        this.#http = http
            .createServer(this.#httpRequestListener.bind(this))
            .on("upgrade", this.#onHttpUpgrade.bind(this))
            .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener.bind(this));
    }

    async #httpRequestListener(req: http.IncomingMessage, res: http.OutgoingMessage) {
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

    #onHttpUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
        const reqUrl = new URL((req.url ?? "").replace("/api/", "/").replace("/api-ws/", "/"), "http://localhost");
        console.log("___watch_socket", req.url);
        if (reqUrl.pathname === "/watch") {
            this.#dataWatcher.handleUpgrade(req, socket, head);
        }
    }

    #httpListeningListener() {
        for (const route of this.#api.keys()) {
            logAllUrl(`http://localhost:${HTTP_PORT}${route}`);
        }
    }

    /**
     * 下载完整数据文件
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiDownload(req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) {
        const snapshotFilter = this.#toNumberRangeFilter(params.get("snapshot"));
        const zip = new AdmZip();
        for (const entry of WalkFile(DATA_DIR)) {
            const snapshot = new Date(decodeURIComponent(entry.entryname.replace(".json", ""))).valueOf();
            if (!snapshotFilter(snapshot)) {
                continue;
            }
            const relativePath = path.relative(DATA_DIR, entry.entrypath);
            zip.addFile(relativePath, entry.readBinary());
        }
        res.setHeader("Content-Type", "application/zip");
        res.end(zip.toBuffer());
    }

    /**
     * 查询基本状态
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiStatus(req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) {
        const time = new Date();
        res_json(res, {
            currentTime: time.getTime(),
            currentTimeISO: time.toISOString(),
        } as StatusResult);
    }
    
    /**
     * 整数/范围参数过滤器
     * @param key 参数Key
     * @private
     */
    #toNumberRangeFilter(key: string | null) {
        const range = key
            ?.split("-")
            .map(Number)
            .filter((v) => !Number.isNaN(v))
            .slice(0, 2) ?? [-Infinity, +Infinity];
        if (range.length === 0) {
            range.push(-Infinity, +Infinity);
        } else if (range.length === 1) {
            range.push(range[0]);
        }
        return (num: number) => range[0] <= num && num <= range[1];
    }
}

/**
 * 数据文件变动服务
 */
export class WeChatChannelsToolsDataWatcher {
    #ws = new WebSocketServer({
        noServer: true,
    });

    constructor() {
        this.#fileWatchListener();
    }

    /**
     * socket连接监听
     * @param req
     * @param socket
     * @param head
     */
    public handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
        this.#ws.handleUpgrade(req, socket, head, this.#wsConnectionListener);
    }
    #wsConnectionListener(socket) {
        const ping = setInterval(() => {
            socket.ping();
        }, 30000);
        const onDataChange = (time: string) => {
            socket.send(time);
        };
        emitter.on(EMITTER_KEY_WATCH_DATA_CHANGE, onDataChange);
        socket.on("close", () => {
            emitter.off(EMITTER_KEY_WATCH_DATA_CHANGE, onDataChange);
            clearInterval(ping);
        });
    }

    /**
     * 数据文件变动监听
     * @private
     */
    async #fileWatchListener() {
        console.log("___data_watcher_on");
        const watcher = Deno.watchFs(DATA_DIR);
        const emit = debounce(() => {
            const time = new Date().toISOString();
            console.log("___data_watcher_change", time);
            emitter.emit(EMITTER_KEY_WATCH_DATA_CHANGE, time);
        }, 200);
        for await (const event of watcher) {
            // 目前只需要监听文件新增就可以了
            if (event.kind === "create") {
                emit();
            }
        }
    }
}

export default function startup() {
    new WeChatChannelsToolsServer();
}
startup();
