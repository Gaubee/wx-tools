import http from "node:http";
import type { RequestListener, IncomingMessage, Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { isMobile } from "npm:is-mobile";
import { WebSocketServer } from "https://esm.sh/ws@8.13.0";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { logAllUrl } from "./helper/all-ip.ts";
import { res_error } from "./helper/res_error.ts";
import { logInfo, logError } from "./helper/log.ts";
import type { Duplex } from "node:stream";
import type { Buffer } from "node:buffer";
import { WeChatChannelsRobber } from "./WeChatChannelsRobber.ts";

const HTTP_PORT = 3000;
const LIFECYCLE_SOCKET_SELF_DESTRUCT = 1000;

export const __dirname = fileURLToPath(new URL("./", import.meta.url));
// const emitter = new EventEmitter();
const html = String.raw;

/**
 * 微信视频号助手-用户端
 */
export class WeChatChannelsToolsUser {
    #http!: Server;
    private static _scanHtmlTemplateCache?: string;
    static get #scanHtmlTemplate() {
        if (this._scanHtmlTemplateCache) {
            return this._scanHtmlTemplateCache;
        }
        const htmlTemplate = fs.readFileSync(path.join(__dirname, "user/scan.html"), "utf-8");
        if (!process.argv.includes("--dev")) {
            this._scanHtmlTemplateCache = htmlTemplate;
        }
        return htmlTemplate;
    }
    static #wss = new WebSocketServer({
        noServer: true,
    });

    constructor() {
        this.#http = http
            .createServer(this.#httpRequestListener)
            .on("upgrade", this.#onHttpUpgrade)
            .listen(HTTP_PORT, "0.0.0.0", this.#httpListeningListener);
    }

    #httpRequestListener: RequestListener = async (req, res) => {
        logInfo("request_listener", req.url);
        if (req.url?.startsWith("/static/")) {
            try {
                res.end(await fs.promises.readFile(path.join(__dirname, "user", req.url)));
            } catch (err) {
                logError("/static/ file not found", err);
                res.statusCode = 404;
                res.end();
            }
            return;
        }
        if (req.url !== "/" && req.url !== "/index.html") {
            // 防止浏览器请求favicon图标会进入流程
            res_error(res, `invalid url: ${req.url}`);
            return;
        }
        try {
            const wcRobber = new WeChatChannelsRobber();

            let contentHeader = "";
            {
                const is_wechat = !!req.headers["user-agent"]?.match(/Wechat/i);
                contentHeader += is_wechat
                    ? html`<h3 style="color:#e91e63;">『请使用手机微信摄像头扫码！！』</h3>`
                    : html`<h4 style="color:#673AB7;">请使用手机微信摄像头扫码</h4>`;

                contentHeader += html`<p style="color: #673AB7; font-size: 10px;">
                        该二维码为一次性二维码，使用完就会失效
                    </p>
                    <div style="color: #673AB7; font-size: 10px; display: flex; align-items: flex-end;">
                        <span> 过期时间： </span>
                        <span id="exp-time" data-datetime="${Date.now()}">
                            ${Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(
                                Date.now(),
                            )}
                        </span>
                    </div>`;
            }
            const { qrcodeText, token } = await wcRobber.generateQrcode();

            let contentFooter = "";
            {
                const is_mobile = isMobile({
                    ua: req,
                });
                contentFooter += `${is_mobile ? html`<b style="color:#e91e63;">建议使用桌面电脑打开</b>` : ""}`;
            }

            const resHtml = WeChatChannelsToolsUser.#scanHtmlTemplate
                .replace("{{CONTENT_HEADER}}", contentHeader)
                .replace("{{QRCODE_TEXT}}", qrcodeText.trim())
                .replace("{{CONTENT_FOOTER}}", contentFooter)
                .replace("{{TOKEN}}", token);
            res.setHeader("Content-Type", "text/html");
            res.end(resHtml);
        } catch (err) {
            res_error(res, err);
        }
    };

    #httpListeningListener() {
        logAllUrl(`http://localhost:${HTTP_PORT}/index.html`);
    }

    #onHttpUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
        const reqUrl = new URL(req.url ?? "", "http://localhost");
        logInfo("lifecycle_socket", req.url);
        if (reqUrl.pathname === "/lifecycle") {
            const token = reqUrl.searchParams.get("token");
            if (token) {
                const robber = WeChatChannelsRobber.getAndDelete(token);
                if (robber) {
                    return WeChatChannelsToolsUser.#wss.handleUpgrade(req, socket, head, async (ws) => {
                        /// 如果ws关闭，就销毁对应的爬虫
                        ws.on("close", (code) => {
                            if(code === LIFECYCLE_SOCKET_SELF_DESTRUCT) {
                                return;
                            }
                            logInfo("lifecycle_socket_close");
                            robber.abortController.abort("close");
                        });
                        ws.on("message", async data => {
                            const message = data.toString();
                            logInfo("lifecycle_socket_message", message);
                            if(message.startsWith("valid:")) {
                                const address = message.replace("valid:", "");
                                const result = await robber.validETHMetaAddress(address);
                                ws.send(`valid:${result.toString()}`);
                                if(result) {
                                    ws.send("start");
                                    /// websocket 连接成，开始追踪
                                    try {
                                        const { userInfo } = await robber.attack(address);
                                        ws.send(`success:${userInfo.finderUser.nickname}`);
                                    } catch {}
                                    ws.close(LIFECYCLE_SOCKET_SELF_DESTRUCT);
                                }
                            }
                        });
                    });
                }
            }
            /// 否则进行销毁
            socket.destroy();
        }
    }
}

export default function startup() {
    new WeChatChannelsToolsUser();
}
startup();
