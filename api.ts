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
import { debounce, dateFileNameToTimestamp } from "./helper/utils.ts";
import { res_json } from "./helper/res_json.ts";
import { logInfo } from "./helper/log.ts";
import type WebSocket from "npm:ws";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Buffer } from "node:buffer";
import type { StatusResult } from "./type.d.ts";

const HTTP_PORT = 3001;
const EMITTER_KEY_WATCH_DATA_CHANGE = Symbol("watch_data_change");

const __dirname = fileURLToPath(import.meta.resolve("./"));
const emitter = new EventEmitter();

const DATA_DIR = path.join(__dirname, "data");

export class WeChatChannelsToolsServer {
    #http!: Server;
    #api = new Map<string, (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => void>([
        ["/download?*", this.#apiDownload.bind(this)],
        ["/status", this.#apiStatus],
        ["/rm?*", this.#apiRemove.bind(this)],
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

    async #httpRequestListener(req: IncomingMessage, res: ServerResponse) {
        logInfo("request_listener", req.url);
        const origin = `https://${req.headers.host || "localhost"}`;
        const reqUrl = new URL((req.url ?? "").replace("/api/", "/"), origin);
        for (const [route, handler] of this.#api) {
            const urlPattern = new URLPattern(route, origin);
            if (urlPattern.test(reqUrl)) {
                try {
                    logInfo("request_api", reqUrl.pathname, reqUrl.search);
                    return await handler(req, res, reqUrl.searchParams);
                } catch (err: any) {
                    res_error(res, err);
                }
            }
        }
        res.statusCode = 502;
        res.end();
    }

    #onHttpUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
        const reqUrl = new URL((req.url ?? "").replace("/api/", "/").replace("/api-ws/", "/"), "http://localhost");
        logInfo("watch_socket", req.url);
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
    #apiDownload(req: IncomingMessage, res: ServerResponse, params: URLSearchParams) {
        const snapshotFilter = this.#toNumberRangeFilter(params.get("snapshot"));
        const zip = new AdmZip();
        for (const entry of WalkFile(DATA_DIR)) {
            const snapshot = dateFileNameToTimestamp(entry.entryname);
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
    #apiStatus(req: IncomingMessage, res: ServerResponse, params: URLSearchParams) {
        const time = new Date();
        res_json(res, {
            currentTime: time.getTime(),
            currentTimeISO: time.toISOString(),
        } as StatusResult);
    }

    /**
     * 移除指定时间范围内的数据
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiRemove(req: IncomingMessage, res: ServerResponse, params: URLSearchParams) {
        const timerange = params.get("timerange");
        if(!timerange) {
            return res_json(res, 0);
        }
        const rangeFilter = this.#toNumberRangeFilter(timerange);
        let num = 0;
        for (const entry of WalkFile(DATA_DIR)) {
            const snapshot = dateFileNameToTimestamp(entry.entryname);
            if (!rangeFilter(snapshot)) {
                continue;
            }
            Deno.removeSync(entry.entrypath);
            num++;
        }
        logInfo("api_remove_done", timerange, num);
        res_json(res, num);
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
    public handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
        this.#ws.handleUpgrade(req, socket, head, this.#wsConnectionListener);
    }
    #wsConnectionListener(socket: WebSocket) {
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
        logInfo("data_watcher_on");
        const watcher = Deno.watchFs(DATA_DIR);
        const emit = debounce(() => {
            const time = new Date().toISOString();
            logInfo("data_watcher_change", time);
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
