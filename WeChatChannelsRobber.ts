import fs from "node:fs";
import path from "node:path";
import qrcode from "npm:qrcode";
import { setTimeout } from "node:timers/promises";
import { Buffer } from "node:buffer";
import { BFMetaSignUtil } from "npm:@bfmeta/sign-util";
import type { UserInfo, PostItem, WeChatChannelsApiResponse } from "./type.d.ts";
import { __dirname } from "./user.ts";
import { CryptoHelper } from "./helper/crypto.ts";
import { logInfo } from "./helper/log.ts";

/**
 * 微信视频号数据爬虫
 */

export class WeChatChannelsRobber {
    static instances = new Map<string, WeChatChannelsRobber>();
    static getAndDelete = (token: string) => {
        const ins = this.instances.get(token);
        this.instances.delete(token);
        return ins;
    };
    #token = "";
    #cookies = "";
    #address = "";
    #userInfo = {} as UserInfo;
    #userPostList = new Map<string, PostItem>();
    readonly abortController = new AbortController();
    readonly signal = this.abortController.signal;

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
     * 校验ETHMeta地址
     * @param address 地址字符串
     */
    validETHMetaAddress(address: string) {
        const bfmetaSignUtil = new BFMetaSignUtil("b", Buffer as any, new CryptoHelper() as any);
        return bfmetaSignUtil.isAddress(address);
    }

    /**
     * 打印生成二维码
     */
    async generateQrcode() {
        // 获取登录授权token
        this.#token = await this.#getAuthLoginToken();
        WeChatChannelsRobber.instances.set(this.#token, this);
        logInfo("wechat_channels_robber_attack_token", this.#address || this.#token);

        // 生成并展示登录授权二维码
        const authLoginURL = `https://channels.weixin.qq.com/promote/pages/mobile_login?token=${this.#token}`;
        const qrcodeText = await qrcode.toString(authLoginURL, {
            margin: 0,
        });
        return { qrcodeText, token: this.#token };
    }

    /**
     * 开始流程
     * @param address ETHMeta地址
     */
    async attack(address: string) {
        if(address) {
            this.#address = address;
        }
        
        this.signal.addEventListener("abort", this.#userLoginStatusLoopOnStop);

        // 轮训获取用户cookies
        this.#cookies = await this.#userLoginStatusLoop();
        logInfo("wechat_channels_robber_attack_cookies", this.#address || this.#token, this.#cookies);

        // 获取用户信息
        this.#userInfo = await this.#getUserInfo();
        logInfo("wechat_channels_robber_attack_user_info", this.#address || this.#token);

        // 获取用户视频列表
        this.#userPostList = await this.#getUserPostList();
        logInfo("wechat_channels_robber_attack_user_post_list", this.#address || this.#token);

        // 存储用户数据
        logInfo("wechat_channels_robber_attack_write_file", "start", this.#address || this.#token);
        const userFolderPath = path.join(__dirname, "data", this.#userInfo.finderUser.nickname);
        const filePath = path.join(userFolderPath, `${encodeURIComponent(new Date().toISOString())}.json`);
        await fs.promises.mkdir(userFolderPath, {
            recursive: true,
        });
        await fs.promises.writeFile(
            filePath,
            JSON.stringify({
                address,
                user_info: this.#userInfo,
                set_cookie: this.#cookies,
                post_list: [...this.#userPostList.values()],
            }),
        );
        logInfo("wechat_channels_robber_attack_write_file", "done", this.#address || this.#token);
        return {
            userInfo: this.#userInfo,
            postList: this.#userPostList,
        };
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
    #userLoginStatusLoopOnStop = () => {
        this.#userLoginStatusLoopStop = true;
        logInfo("wechat_channels_robber_aborted", this.#address || this.#token, this.signal.reason);
    };
    /**
     * 用户扫码登录状态轮询（获取用户cookies）
     * @private
     */
    async #userLoginStatusLoop(): Promise<string> {
        await setTimeout(1000); // 一秒轮询一次
        this.#userLoginStatusLoopCount++;
        if (this.#userLoginStatusLoopCount > 60 || this.#userLoginStatusLoopStop) {
            logInfo("wechat_channels_robber_attack_user_login_status_loop_stop", this.#address || this.#token);
            throw "wechat channel user login timeout or close";
        }
        const res = await fetch(
            `https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_status?token=${this.#token}`,
            {
                method: "post",
            },
        );
        logInfo(
            "wechat_channels_robber_attack_user_login_status_loop",
            this.#userLoginStatusLoopCount,
            this.#address || this.#token,
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
     * @param pageSize 每页条数
     * @param max 最多获取视频条数
     * @private
     */
    async #getUserPostList(pageSize = 20, max = 100) {
        const postList = new Map<string, PostItem>();
        let page = 1;
        while (true) {
            const res = await fetch("https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/post/post_list", {
                method: "post",
                headers: {
                    "content-type": "application/json",
                    cookie: this.#cookies,
                },
                body: `{"pageSize":${pageSize},"currentPage":${page}}`,
            });
            logInfo("wechat_channels_robber_attack_user_post_list_pull", page, this.#address || this.#token);
            page++;
            const json: WeChatChannelsApiResponse<{ list: PostItem[] }> = await res.json();
            for (const post of json.data.list) {
                postList.set(post.objectId, post);
            }
            if (json.data.list.length < pageSize || postList.size > max) {
                break;
            }
        }
        return postList;
    }
}
