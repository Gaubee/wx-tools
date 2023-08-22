import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import minimist from "npm:minimist";
import WebSocket from "npm:ws";
import compressing from "npm:compressing";
import { fileURLToPath } from "node:url";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import { res_json } from "./helper/res_json.ts";
import { WalkDir, WalkFile } from "./helper/WalkFs.ts";
import { Buffer } from "node:buffer";
import type { UserInfo, PostItem, QueryResult, StatusResult } from "./type.d.ts";

const HTTP_PORT = 3002;

const __dirname = fileURLToPath(new URL("./", import.meta.url));

const DATA_DIR = path.join(__dirname, "data");
const DOWNLOAD_DIR = path.join(__dirname, "download");

export class WeChatChannelsToolsAdmin {
    #http!: http;
    #api = new Map<string, (req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) => void>([
        ["/authors", this.#apiGetAuthors],
        ["/query?*", this.#apiQuery.bind(this)],
    ]);

    constructor() {
        fs.mkdirSync(DATA_DIR, {
            recursive: true,
        });
        this.#http = http
            .createServer(this.#httpRequestListener.bind(this))
            .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener.bind(this));
    }

    async #httpRequestListener(req: http.IncomingMessage, res: http.OutgoingMessage) {
        console.log("___request_listener", req.url);
        const origin = `https://${req.headers.host || "localhost"}`;
        const reqUrl = new URL((req.url ?? "").replace("/api-admin/", "/"), origin);
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

    /**
     * 获取用户名称列表
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiGetAuthors(req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) {
        console.log("___api_get_authors_start");
        const json = [...WalkDir(DATA_DIR)].map((entry) => entry.entryname);
        console.log("___api_get_authors_finish", json.length);
        res_json(res, json);
    }

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
     * @param req
     * @param res
     * @param params
     * @private
     */
    #apiQuery(req: http.IncomingMessage, res: http.OutgoingMessage, params: URLSearchParams) {
        /** 快照过滤器 */
        const snapshotFilter = this.#toNumberRangeFilter(params.get("snapshot"));
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
        console.log("___api_query_start");
        for (const entry of WalkFile(DATA_DIR)) {
            const author = path.parse(entry.entrydir).base;
            if (!authorFilter(author)) {
                continue;
            }

            const snapshot = new Date(decodeURIComponent(entry.entryname.replace(".json", ""))).valueOf();
            if (!snapshotFilter(snapshot)) {
                continue;
            }

            const { user_info, post_list } = entry.readJson() as {
                user_info: UserInfo & { data: UserInfo };
                post_list: PostItem[];
            };

            result[author] ??= {
                user: user_info.data ? user_info.data : user_info,
                list: [],
            };
            for (let postItem of post_list.filter((post) => itemFilter(post))) {
                const index = result[author].list.findIndex((post) => post.objectId === postItem.objectId);
                if (~index) {
                    result[author].list[index] = postItem;
                } else {
                    result[author].list.push(postItem);
                }
            }
        }
        const json = [...Object.values(result)];
        console.log("___api_query_finish", json.length);
        res_json(res, json);
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
    #ws!: WebSocket;
    #downloadLastTime = 0;
    #downloadQueues: string[] = [];
    #options!: DataPullOptions;
    
    constructor(
        options: DataPullOptions = {}
    ) {
        fs.mkdirSync(DOWNLOAD_DIR, {
            recursive: true,
        });
        this.#options = options;
        this.#init();
    }
    
    async #init() {
        this.#downloadLastTime = await this.#getDownloadLastTime();
        this.#ws = new WebSocket(this.#options.wsUrl, {
            perMessageDeflate: false
        });
        this.#ws.on("open", this.#wsOpenListener);
        this.#ws.on("message", this.#wsMessageListener.bind(this));
        this.#ws.on("ping", () => {
            console.log("___data_pull_socket_ping");
        });
    }

    /**
     * 获取最后一次同步数据的时间
     * @private
     */
    async #getDownloadLastTime() {
        const downloadList = [...WalkFile(DOWNLOAD_DIR)].map(entry => new Date(decodeURIComponent(entry.entryname.replace(".zip", ""))).valueOf());
        if(downloadList.length) {
            return downloadList.sort((a, b) => b - a)[0];
        }
        // 本地没有就从服务器取最新时间
        const res = await fetch(new URL("/api/status", this.#options.api));
        const json = await res.json() as StatusResult;
        return json.currentTime;
    }
    
    #wsOpenListener() {
        console.log("___data_pull_socket_open");
    }
    
    #wsMessageListener(data: Buffer) {
        const timestamp = data.toString();
        console.log("___data_pull_socket_message", timestamp);
        if(this.#downloadQueues.length) {
            this.#downloadQueues.push(timestamp);
        } else {
            this.#downloadQueues.push(timestamp);
            this.#dataDownload();
        }
    }

    /**
     * 同步数据
     * @private
     */
    async #dataDownload() {
        const isoTime = this.#downloadQueues.shift();
        const timestamp = new Date(isoTime).valueOf();
        const downloadUrl = new URL("/api/download", this.#options.api);
        const timeRange = `${this.#downloadLastTime}-${timestamp}`;
        downloadUrl.searchParams.append("snapshot", timeRange);
        console.log("___data_pull_socket_download", this.#downloadLastTime, timestamp);
        const res = await fetch(downloadUrl.href);
        const zipPath = path.join(DOWNLOAD_DIR, `${encodeURIComponent(isoTime)}.zip`);
        await fs.promises.writeFile(zipPath, Buffer.from(await res.arrayBuffer()), "binary");
        await compressing.zip.uncompress(zipPath, DATA_DIR);
        this.#downloadLastTime = timestamp;
        if(this.#downloadQueues.length) {
            this.#dataDownload();
        }
    }
}

export default function startup() {
    const args = minimist(Deno.args);
    new WeChatChannelsToolsAdmin();
    const wsUrl = args["data-ws"];
    const api = args["api"];
    if(wsUrl && api) {
        new WeChatChannelsToolsAdminDataPull({
            wsUrl,
            api
        });
    }
}
startup();
