import { ws, compressing, minimist } from "./deps.ts";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import { res_json } from "./helper/res_json.ts";
import { WalkDir, WalkFile } from "./helper/WalkFs.ts";
import { Buffer } from "node:buffer";
import { dateFileNameToTimestamp } from "./helper/utils.ts";
import { logInfo, logError } from "./helper/log.ts";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { PostItem, QueryResult, StatusResult, JsonData } from "./type.d.ts";
const { WebSocket, WebSocketServer } = ws;

const HTTP_PORT = 3002;
const EMITTER_KEY_DATA_FILE_CHANGE = Symbol("data_file_change");

const emitter = new EventEmitter();

const DATA_DIR = path.join(Deno.cwd(), "data");
const DOWNLOAD_DIR = path.join(Deno.cwd(), "download");

export class WeChatChannelsToolsAdmin {
    #http!: Server;
    #wsQuery = new WebSocketServer({
        noServer: true,
    });
    private buildApi() {
        return new Map<string, (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => void>([
            ["/authors", this.#apiAuthors],
            ["/authors/snapshot/record?*", this.#apiAuthorsSnapshotRecord],
            ["/query?*", this.#apiQuery],
            ["/download/remove?*", this.#apiDownloadRemove.bind(this)],
        ]);
    }
    #_api?: ReturnType<WeChatChannelsToolsAdmin["buildApi"]>;
    get #api() {
        return (this.#_api ??= this.buildApi());
    }

    constructor() {
        fs.mkdirSync(DATA_DIR, {
            recursive: true,
        });
        this.#onDataFileChange();
        this.#http = http
            .createServer(this.#httpRequestListener)
            .on("upgrade", this.#onHttpUpgrade)
            .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener);
    }

    #httpRequestListener = async (req: IncomingMessage, res: ServerResponse) => {
        logInfo("request_listener", req.url);
        const origin = `https://${req.headers.host || "localhost"}`;
        const reqUrl = new URL((req.url ?? "").replace("/api-admin/", "/"), origin);
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
    };

    #onHttpUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const reqUrl = new URL((req.url ?? "").replace("/api-admin/", "/"), "http://localhost");
        logInfo("on_socket", req.url);
        if (reqUrl.pathname === "/query/observe") {
            this.#wsQuery.handleUpgrade(req, socket, head, this.#wsQueryConnectionListener);
        }
    };

    #httpListeningListener = () => {
        for (const route of this.#api.keys()) {
            logAllUrl(`http://localhost:${HTTP_PORT}${route}`);
        }
    };

    #onDataFileChange() {
        emitter.on(EMITTER_KEY_DATA_FILE_CHANGE, (start: number, end: number) => {
            for (const [socket, querystring] of this.#wsQuerySender) {
                const search = new URLSearchParams(querystring);
                const snapshotStartTime = search.get("snapshotStartTime");
                if (snapshotStartTime) {
                    search.delete("snapshotStartTime");
                    this.#wsQuerySender.set(socket, search.toString());
                    search.set("snapshot", `${snapshotStartTime}-${end}`);
                } else {
                    search.set("snapshot", `${start}-${end}`);
                }
                const json = this.#query(search).filter((item) => item.list.length);
                if (!json.length) {
                    // 没有符合要求的数据就不用发送过去了
                    continue;
                }
                logInfo("socket_query_send", search.toString(), json.length);
                socket.send(Buffer.from(JSON.stringify(json)));
            }
        });
    }

    /**
     * 获取用户名称列表
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiAuthors = (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => {
        logInfo("api/authors", "start");
        const json = [...WalkDir(DATA_DIR)].map((entry) => entry.entryname);
        logInfo("api/authors", "finish", json.length);
        res_json(res, json);
    };

    /**
     * 获取用户全部快照记录
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiAuthorsSnapshotRecord = (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => {
        logInfo("api/authors/snapshot/record", "start");
        const author = params.get("author");
        if (!author) {
            return res_json(res, []);
        }
        const json = [...WalkFile(path.join(DATA_DIR, author))].map((entry) =>
            dateFileNameToTimestamp(entry.entryname),
        );
        logInfo("api/authors/snapshot/record", "finish", json.length);
        res_json(res, json);
    };

    /**
     * 数据查询API
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiQuery = (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => {
        logInfo("api/query", "start");
        const json = this.#query(params);
        logInfo("api/query", "finish", json.length);
        res_json(res, json);
    };

    #wsQuerySender = new Map<InstanceType<typeof WebSocket>, string>();
    /**
     * 数据查询WebSocket
     * @param socket
     * @private
     */
    #wsQueryConnectionListener = (socket: InstanceType<typeof WebSocket>) => {
        socket.on("message", (data: Buffer) => {
            const querystring = data.toString();
            logInfo("socket_query_params_change", querystring);
            this.#wsQuerySender.set(socket, querystring);
        });
        socket.on("close", () => {
            logInfo("socket_query_close");
            this.#wsQuerySender.delete(socket);
        });
    };

    #queryParamsNumber = new Map<string, (item: PostItem) => number>([
        ["createTime", (item) => item.createTime * 1000],
        ["likeCount", (item) => item.likeCount],
        ["commentCount", (item) => item.commentCount],
        ["readCount", (item) => item.readCount],
        ["forwardCount", (item) => item.forwardCount],
        ["favCount", (item) => item.favCount],
    ]);
    #queryParamsString = new Map<string, (item: PostItem) => string>([
        ["description", (item) => item.desc.description],
    ]);
    /**
     * 查询数据
     * @param params
     * @private
     */
    #query(params: URLSearchParams) {
        /** 快照过滤器 */
        const snapshotFilter = this.#toNumberRangeFilter(params.get("snapshot"));
        /** 快照数量 */
        const snapshotLimit = Number(params.get("snapshot_limit") ?? "Infinity");
        /** 作者过滤器 */
        const authorFilter = this.#toStringKeyFilter(params.get("authors"));
        /** 整数参数过滤器 */
        const numberFilters = [...this.#queryParamsNumber].map(([key, getter]) => {
            const rangeFilter = this.#toNumberRangeFilter(params.get(key));
            return (item: PostItem) => rangeFilter(getter(item));
        });
        /** 字符串参数过滤器 */
        const stringFilters = [...this.#queryParamsString].map(([key, getter]) => {
            const rangeFilter = this.#toStringKeyFilter(params.get(key));
            return (item: PostItem) => rangeFilter(getter(item));
        });
        /** 数据内容过滤器 */
        const itemFilter = (item: PostItem) => {
            return [...numberFilters, ...stringFilters].every((filter) => filter(item));
        };

        const result: Record<string, QueryResult[number]> = {};
        for (const dir of WalkDir(DATA_DIR)) {
            const author = dir.entryname;
            if (!authorFilter(author)) {
                continue;
            }
            const entryList = [...WalkFile(path.join(DATA_DIR, author))].sort((a, b) => {
                return dateFileNameToTimestamp(a.entryname) - dateFileNameToTimestamp(b.entryname);
            });
            for (const entry of entryList.slice(entryList.length - snapshotLimit)) {
                const snapshot = dateFileNameToTimestamp(entry.entryname);
                if (!snapshotFilter(snapshot)) {
                    continue;
                }

                const { user_info, post_list, address } = entry.readJson() as JsonData;

                result[author] ??= {
                    address,
                    user: user_info.data ?? user_info,
                    snapshotLast: snapshot,
                    list: [],
                };
                result[author].user = user_info.data ?? user_info;
                result[author].address = address;
                result[author].snapshotLast = snapshot;

                for (let postItem of post_list.filter((post) => itemFilter(post))) {
                    const index = result[author].list.findIndex((post) => post.objectId === postItem.objectId);
                    if (~index) {
                        result[author].list[index] = postItem;
                    } else {
                        result[author].list.push(postItem);
                    }
                }
            }
        }
        return [...Object.values(result)];
    }

    /**
     * 移除download文件api
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiDownloadRemove = (req: IncomingMessage, res: ServerResponse, params: URLSearchParams) => {
        const timerange = params.get("timerange");
        if (!timerange) {
            return res_json(res, 0);
        }
        const rangeFilter = this.#toNumberRangeFilter(timerange);
        let num = 0;
        for (const entry of WalkFile(DOWNLOAD_DIR)) {
            const snapshot = dateFileNameToTimestamp(entry.entryname, "zip");
            if (!rangeFilter(snapshot)) {
                continue;
            }
            Deno.removeSync(entry.entrypath);
            num++;
        }
        logInfo("api/download/remove", "done", timerange, num);
        res_json(res, num);
    };

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

    /**
     * 字符串参数过滤器
     * @param key 参数Key
     * @private
     */
    #toStringKeyFilter(key: string | null) {
        const matches = key?.split(/\s+/g).map((search) => {
            const reg = new RegExp(search);
            return (name: string) => name === search || reg.test(name);
        }) ?? [() => true];
        return (text: string) => matches.some((match) => match(text));
    }
}

export interface DataPullOptions {
    wsUrl: string;
    api: string;
}

export class WeChatChannelsToolsAdminDataPull {
    #ws!: InstanceType<typeof WebSocket>;
    #downloadLastTime = 0;
    #downloadQueues: string[] = [];
    #options: DataPullOptions;

    constructor(options: DataPullOptions) {
        fs.mkdirSync(DOWNLOAD_DIR, {
            recursive: true,
        });
        this.#options = options;
        this.#init();
    }

    async #init() {
        this.#downloadLastTime = await this.#getDownloadLastTime();
        this.#ws = new WebSocket(this.#options.wsUrl, {
            perMessageDeflate: false,
        });
        this.#ws.on("open", this.#wsOpenListener);
        this.#ws.on("message", this.#wsMessageListener.bind(this));
        this.#ws.on("ping", () => {
            logInfo("data_pull_socket_ping", new Date().toLocaleString());
        });
    }

    /**
     * 获取最后一次同步数据的时间
     * @private
     */
    async #getDownloadLastTime() {
        const downloadList = [...WalkFile(DOWNLOAD_DIR)].map((entry) =>
            dateFileNameToTimestamp(entry.entryname, "zip"),
        );
        if (downloadList.length) {
            return downloadList.sort((a, b) => b - a)[0];
        }
        // 本地没有就从服务器取最新时间
        const res = await fetch(new URL("/api/status", this.#options.api));
        const json = (await res.json()) as StatusResult;
        return json.currentTime;
    }

    #wsOpenListener() {
        logInfo("data_pull_socket_open");
    }

    #wsMessageListener(data: Buffer) {
        const timestamp = data.toString();
        logInfo("data_pull_socket_message", timestamp);

        this.#downloadQueues.push(timestamp);
        this.#dataDownload();
    }

    private _dataDownload_task?: Promise<unknown>;
    async #_dataDownload(endTime: string) {
        try {
            const timestamp = new Date(endTime).valueOf();
            const downloadUrl = new URL("/api/download", this.#options.api);
            const timeRange = `${this.#downloadLastTime}-${timestamp}`;
            downloadUrl.searchParams.append("snapshot", timeRange);

            const startTime = Date.now();
            logInfo("data_pull_socket_download_start", this.#downloadLastTime, timestamp);
            const res = await fetch(downloadUrl.href);
            const zipPath = path.join(DOWNLOAD_DIR, `${encodeURIComponent(endTime)}.zip`);
            const buffer = Buffer.from(await res.arrayBuffer());
            await fs.promises.writeFile(zipPath, buffer, "binary");
            await compressing.zip.uncompress(zipPath, DATA_DIR);

            const downloadRemoveAPI = new URL(`http://127.0.0.1:${HTTP_PORT}/download/remove`);
            downloadRemoveAPI.searchParams.append("timerange", `0-${this.#downloadLastTime}`);
            console.log("downloadRemoveAPI", downloadRemoveAPI.href);
            await fetch(downloadRemoveAPI.href);

            emitter.emit(EMITTER_KEY_DATA_FILE_CHANGE, this.#downloadLastTime, timestamp);

            logInfo(
                "data_pull_socket_download_completed",
                this.#downloadLastTime,
                timestamp,
                `${Math.ceil(buffer.byteLength / 1024)}KB`,
                `${Date.now() - startTime}ms`,
                this.#downloadQueues.length,
            );
            this.#downloadLastTime = timestamp;
        } catch (err: any) {
            logError("data_pull_socket_download", err);
        }
    }
    /**
     * 同步数据
     * @private
     */
    async #dataDownload() {
        while (this.#downloadQueues.length) {
            if (!this._dataDownload_task) {
                const endTime = this.#downloadQueues.at(-1)!;
                this.#downloadQueues = [];
                await (this._dataDownload_task = this.#_dataDownload(endTime));
                this._dataDownload_task = undefined;
            }
        }
    }
}

export default function startup() {
    const args = minimist(Deno.args);
    new WeChatChannelsToolsAdmin();
    const wsUrl = args["data-ws"];
    const api = args["api"];
    if (wsUrl && api) {
        new WeChatChannelsToolsAdminDataPull({
            wsUrl,
            api,
        });
    }
}
startup();
