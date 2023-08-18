import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import qrcode from "npm:qrcode";
import isMobile from "npm:is-mobile";
import { WebSocketServer } from "npm:ws";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import type { Duplex } from "node:stream";
import type { Buffer } from "node:buffer";
import type { UserInfo, PostItem, WeChatChannelsApiResponse } from "./type.d.ts";

const HTTP_PORT = 3000;

const __dirname = fileURLToPath(new URL("./", import.meta.url));
const emitter = new EventEmitter();

/**
 * 微信视频号助手-用户端
 */
export class WeChatChannelsToolsUser {
    #http!: http;
    static #scanHtmlTemplate = fs.readFileSync(path.join(__dirname, "user/scan.html"), "utf-8");
    static #wss = new WebSocketServer({
        noServer: true,
    });

    constructor() {
        this.#http = http
            .createServer(this.#httpRequestListener)
            .on("upgrade", this.#onHttpUpgrade)
            .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener);
    }

    async #httpRequestListener(req: http.IncomingMessage, res: http.OutgoingMessage) {
        console.log("___request_listener", req.url);
        if (req.url?.startsWith("/static/")) {
            try {
                res.end(await fs.promises.readFile(path.join(__dirname, "user", req.url)));
            } catch (err) {
                console.error("/static/ file not found", err);
                res.statusCode = 404;
                res.end();
            }
            return;
        }
        if (req.url !== "/" && req.url !== "/index.html") {
            // 防止浏览器请求favicon图标会进入流程
            return;
        }
        const is_mobile = isMobile({
            ua: req,
        });
        let content = `${is_mobile ? `<h3 style="color:red;">建议使用桌面电脑打开</h3>` : ""}<pre><br>`;
        const wcRobber = new WeChatChannelsRobber();
        console.log("___wechat_channels_robber_attack");
        await wcRobber
            .attack(
                (val) => {
                    if (typeof val === "string") {
                        content += `${val}\n`;
                    }
                },
                (token) => {
                    console.log("___wechat_channels_robber_attack_end");
                    content += `</pre>`;
                    let resHtml = WeChatChannelsToolsUser.#scanHtmlTemplate.replace("{{CONTENT}}", content);
                    if (token) {
                        resHtml += `<script>window.addEventListener("load",()=>{new WebSocket(\`ws://\${location.host}/lifecycle?token=${token}\`)});</script>`;
                    }
                    res.setHeader("Content-Type", "text/html");
                    res.end(resHtml);
                },
            )
            .catch((err) => res_error(res, err));
    }

    #httpListeningListener() {
        logAllUrl(`http://localhost:${HTTP_PORT}/index.html`);
    }

    #onHttpUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
        const reqUrl = new URL(req.url ?? "", "http://localhost");
        console.log("___lifecycle_socket", req.url);
        if (reqUrl.pathname === "/lifecycle") {
            WeChatChannelsToolsUser.#wss.handleUpgrade(req, socket, head, (ws) => {
                ws.on("close", () => {
                    console.log("___lifecycle_socket_close");
                    emitter.emit(`user_login_close_${reqUrl.searchParams.get("token")}`);
                });
            });
        }
    }
}

/**
 * 微信视频号数据爬虫
 */
export class WeChatChannelsRobber {
    #token = "";
    #cookies = "";
    #userInfo = {} as UserInfo;
    #userPostList = new Map<string, PostItem>();

    /** 用户token */
    get token() {
        return this.#token;
    }
    /** 用户权限cookie */
    get cookies() {
        return this.#cookies;
    }
    /** 用户信息 */
    get userInfo() {
        return this.#userInfo;
    }
    /** 用户视频列表（最多最近100条） */
    get userPostList() {
        return this.#userPostList;
    }

    /**
     * 开始流程
     * @param append 添加数据
     * @param end 返回数据
     */
    async attack(append: (str: string) => void, end: (str: string) => void) {
        // 获取登录授权token
        this.#token = await this.#getAuthLoginToken();
        console.log("___wechat_channels_robber_attack_token", this.#token);

        // 生成并展示登录授权二维码
        const authLoginURL = `https://channels.weixin.qq.com/promote/pages/mobile_login?token=${this.#token}`;
        append(`<p>请使用手机微信摄像头扫码：</p>`);
        append(
            await qrcode.toString(authLoginURL, {
                margin: 0,
            }),
        );
        end(this.#token);

        // 获取用户cookies
        const emitterKey = `user_login_close_${this.#token}`;
        emitter.once(emitterKey, this.#userLoginStatusLoopOnStop.bind(this));
        this.#cookies = await this.#userLoginStatusLoop();
        emitter.off(emitterKey, this.#userLoginStatusLoopOnStop.bind(this));
        console.log("___wechat_channels_robber_attack_cookies", this.#token, this.#cookies);

        // 获取用户信息
        this.#userInfo = await this.#getUserInfo();
        console.log("___wechat_channels_robber_attack_user_info", this.#token);

        // 获取用户视频列表
        this.#userPostList = await this.#getUserPostList();
        console.log("___wechat_channels_robber_attack_user_post_list", this.#token);

        // 存储用户数据
        console.log("___wechat_channels_robber_attack_write_file", "start", this.#token);
        const userFolderPath = path.join(__dirname, "data", this.#userInfo.finderUser.nickname);
        const filePath = path.join(userFolderPath, `${encodeURIComponent(new Date().toISOString())}.json`);
        await fs.promises.mkdir(userFolderPath, {
            recursive: true,
        });
        await fs.promises.writeFile(
            filePath,
            JSON.stringify({
                user_info: this.#userInfo,
                set_cookie: this.#cookies,
                post_list: [...this.#userPostList.values()],
            }),
        );
        console.log("___wechat_channels_robber_attack_write_file", "done", this.#token);
    }

    /**
     * 获取微信视频号授权登录token
     * @private
     */
    async #getAuthLoginToken() {
        const res = await fetch("https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_code", {
            method: "post",
        });
        const code: WeChatChannelsApiResponse<{ token: string }> = await res.json();
        return code.data.token;
    }

    /** 用户扫码登录状态轮询次数 */
    #userLoginStatusLoopCount = 0;
    /** 用户扫码登录状态轮询强制中断 */
    #userLoginStatusLoopStop = false;
    /** 监听用户扫码登录状态轮询强制中断 */
    #userLoginStatusLoopOnStop() {
        this.#userLoginStatusLoopStop = true;
    }
    /**
     * 用户扫码登录状态轮询（获取用户cookies）
     * @private
     */
    async #userLoginStatusLoop(): Promise<string> {
        await setTimeout(1000); // 一秒轮询一次
        this.#userLoginStatusLoopCount++;
        if (this.#userLoginStatusLoopCount > 60 || this.#userLoginStatusLoopStop) {
            console.log("___wechat_channels_robber_attack_user_login_status_loop_stop", this.#token);
            this.#userLoginStatusLoopCount = 0;
            this.#userLoginStatusLoopStop = false;
            throw "wechat channel user login timeout or close";
        }
        const res = await fetch(
            `https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_status?token=${this.#token}`,
            {
                method: "post",
            },
        );
        console.log(
            "___wechat_channels_robber_attack_user_login_status_loop",
            this.#userLoginStatusLoopCount,
            this.#token,
        );
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
            return setCookie;
        }
        return await this.#userLoginStatusLoop();
    }

    /**
     * 获取用户信息
     * @private
     */
    async #getUserInfo() {
        const res = await fetch("https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_data", {
            method: "post",
            headers: {
                cookie: this.#cookies,
            },
        });
        const json: WeChatChannelsApiResponse<UserInfo> = await res.json();
        return json.data;
    }

    /**
     * 获取用户视频列表
     * @param max 最多获取视频条数
     * @private
     */
    async #getUserPostList(max = 100) {
        const postList = new Map<string, PostItem>();
        const PAGE_SIZE = 20;
        let page = 1;
        while (true) {
            const res = await fetch("https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/post/post_list", {
                method: "post",
                headers: {
                    "content-type": "application/json",
                    cookie: this.#cookies,
                },
                body: `{"pageSize":${PAGE_SIZE},"currentPage":${page}}`,
            });
            console.log("___wechat_channels_robber_attack_user_post_list_pull", page, this.#token);
            page++;
            const json: WeChatChannelsApiResponse<{ list: PostItem[] }> = await res.json();
            for (const post of json.data.list) {
                postList.set(post.objectId, post);
            }
            if (json.data.list.length < PAGE_SIZE || postList.size > 100) {
                break;
            }
        }
        return postList;
    }
}

export default function startup() {
    new WeChatChannelsToolsUser();
}
startup();
