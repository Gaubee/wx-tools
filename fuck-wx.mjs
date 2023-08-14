//@ts-check
import { fileURLToPath } from "node:url";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";
import qrcode from "npm:qrcode-terminal";
import { setTimeout } from "node:timers/promises";
import { EventEmitter } from "node:events";
import isMobile from "npm:is-mobile";
const __dirname = fileURLToPath(new URL("./", import.meta.url));
const emitter = new EventEmitter();
const qrcode_generate = (text, options = {}) => {
  return new Promise((resolve) => {
    qrcode.generate(text, options, resolve);
  });
};
const doFuck = async (writelog, writeend) => {
  const auth_login_code_res = await fetch(
    "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_code",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "finger-print-device-id": "50246b48a6201fb2c9e7b811d324776d",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-wechat-uin": "0000000000",
      },
      referrer:
        "https://channels.weixin.qq.com/platform/login-for-iframe?dark_mode=true&host_type=1",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: `{\"timestamp\":\"${Date.now()}\",\"_log_finder_uin\":\"\",\"_log_finder_id\":\"\",\"rawKeyBuff\":null,\"pluginSessionId\":null,\"scene\":7,\"reqScene\":7}`,
      method: "POST",
      mode: "cors",
      credentials: "include",
    }
  );
  const auth_login_code = await auth_login_code_res.json();
  console.log(auth_login_code);
  const token = auth_login_code.data.token;
  const auto_login_url_1 = `https://channels.weixin.qq.com/mobile/confirm_login.html?token=${token}`;
  const auto_login_url_2 = `https://channels.weixin.qq.com/promote/pages/mobile_login?token=${token}`;
  // writelog("机构管理扫这个：");
  // console.log(auto_login_url_1);
  // writelog(await qrcode_generate(auto_login_url_1, { small: true }));
  writelog("请使用手机微信摄像头扫码：");
  console.log(auto_login_url_2);
  writelog(await qrcode_generate(auto_login_url_2, { small: true }));
  writeend(token);

  let set_cookie = null;
  let loopCount = 0;
  let wxAuthLoginStop = false;
  
  const lifecycleOnClose = () => {
    wxAuthLoginStop = true;
  }
  emitter.once(`lifecycle_close_${token}`, lifecycleOnClose);

  while (true) {
    await setTimeout(1000);
    loopCount++;
    if(loopCount > 60 || wxAuthLoginStop) {
      console.log("____wxAuthLoginStop");
      wxAuthLoginStop = false;
      return;
    }
    const auth_login_status_res = await fetch(
      `https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_status?token=${token}&timestamp=${Date.now()}&_log_finder_uin=&_log_finder_id=&scene=7&reqScene=7`,
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          "content-type": "application/json",
          "finger-print-device-id": "50246b48a6201fb2c9e7b811d324776d",
          pragma: "no-cache",
          "sec-ch-ua":
            '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-wechat-uin": "0000000000",
        },
        referrer:
          "https://channels.weixin.qq.com/platform/login-for-iframe?dark_mode=true&host_type=1",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: `{\"token\":\"${token}\",\"timestamp\":\"${Date.now()}\",\"_log_finder_uin\":\"\",\"_log_finder_id\":\"\",\"rawKeyBuff\":null,\"pluginSessionId\":null,\"scene\":7,\"reqScene\":7}`,
        method: "POST",
        mode: "cors",
        credentials: "include",
      }
    );
    //   console.log(...auth_login_status_res.headers.entries());
    set_cookie = auth_login_status_res.headers.get("set-cookie");
    if (set_cookie) {
      break;
    }
  }

  emitter.off(`lifecycle_close_${token}`, lifecycleOnClose);

  // let set_cookie  =`sessionId=; pgv_pvid=9264243900; logout_page=dm_loginpage; dm_login_weixin_rem=; mm_lang=zh_CN; sessionid=BgAA5cb0UJ7%2FmVKNCvXRYq1P40WvIfWnRtMDSbTTLYfLUGa9Uh2PxFQn76dUGtY7qgInOW8VsmBAgPcW37LfMz0fxOUDCSLr4lE%3D; wxuin=466083118; promotewebsessionid=BgAAqyWEOyNYIQEcXvtWZRlzORe4%2BxftRPLxwdUV490sKAoEhz9%2BCDcgM9UIqbbay%2BX9vMlKQPwr0DJAPoyWFWmrKFTbkj0h1xY%3D`

  const user_info_res = await fetch(
    "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_data",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "finger-print-device-id": "50246b48a6201fb2c9e7b811d324776d",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        cookie: set_cookie,
        "x-wechat-uin": "0000000000",
      },
      referrer: "https://channels.weixin.qq.com/platform/login",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: `{"timestamp":"${Date.now()}","_log_finder_uin":"","_log_finder_id":"v2_060000231003b20faec8c7e0881ac5d6cc01eb31b077611492d1386f86eeaa6922b5f8215b22@finder","rawKeyBuff":null,"pluginSessionId":null,"scene":7,"reqScene":7}`,
      method: "POST",
      mode: "cors",
      credentials: "include",
    }
  );
  const user_info = await user_info_res.json();
  console.log(user_info);

  const data_map = new Map();

  const pageSize = 20;
  while (true) {
    let page = 1;
    var post_list_res = await fetch(
      "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/post/post_list",
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          "content-type": "application/json",
          "finger-print-device-id": "50246b48a6201fb2c9e7b811d324776d",
          pragma: "no-cache",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-wechat-uin": "3566759090",
          cookie: set_cookie,
          Referer: "https://channels.weixin.qq.com/platform",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: `{\"pageSize\":${pageSize},\"currentPage\":1,\"timestamp\":\"${Date.now()}\",\"_log_finder_uin\":\"\",\"_log_finder_id\":\"v2_060000231003b20faec8c7e0881ac5d6cc01eb31b077611492d1386f86eeaa6922b5f8215b22@finder\",\"rawKeyBuff\":null,\"pluginSessionId\":null,\"scene\":7,\"reqScene\":7}`,
        method: "POST",
      }
    );

    const post_list = await post_list_res.json();

    console.log(post_list);

    for (const post of post_list.data.list) {
      data_map.set(post.objectId, post);
    }
    if (post_list.data.list.length < pageSize || data_map.size > 100) {
      break;
    }
  }

  const foldername = path.join(
    __dirname,
    "data",
    user_info.data.finderUser.nickname
  );
  const filename = path.join(
    foldername,
    encodeURIComponent(new Date().toISOString()) + ".json"
  );

  const filecontent = {
    user_info,
    set_cookie,
    post_list: [...data_map.values()],
  };

  fs.mkdirSync(foldername, { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(filecontent, null, 2));

  // sessionid=BgAA8SXcLbiTGLrLzsI%2BBBXc7IcX16y9zb%2F%2B1OGR02rz5ucNUisp3PFXZk8%2BQLvKTSKoRLqgboviUJCAKsM%2FqBeG9HXem82Xdu8%3D; Max-Age=253402300000
};

import http from "node:http";
import { WebSocketServer } from "npm:ws";
import { ListAllUrl, logAllUrl } from "./helper/all-ip.mjs";
import { res_error } from "./helper/res_error.mjs";
const html = String.raw;
const port = 3000;
http
  .createServer(async (req, res) => {
    if (req.url?.startsWith("/static/")) {
      try {
        res.end(fs.readFileSync(path.join(__dirname, req.url)));
      } catch (err) {
        console.error(err);
        res.statusCode = 404;
        res.end();
      }
      return;
    }
    const is_mobile = isMobile({ ua: req });
    var htmlContent = html`<!DOCTYPE html>
      <html lang="zh-cn">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>数据提交平台</title>
          <style>
            html,
            body {
              height: 100%;
              margin: 0;
            }
            .content {
              display: flex;
              justify-content: center;
              align-items: center;
              flex-direction: column;
              height: 100%;
            }
            canvas {
              position: absolute;
              top: 0;
              left: 0;
              pointer-events: none;
              visibility: hidden;
            }
          </style>
          <template id="font-installer">
            <style>
              @font-face {
                font-family: "Consolas";
                src: url("./static/Consolas.subset.woff") format("woff");
                font-style: normal;
                font-weight: normal;
              }
            </style>
          </template>
        </head>
        <body>
          <div class="content">
            ${is_mobile
              ? `<h3 style="color:#E91E63;">建议使用桌面电脑打开</h3>`
              : ""}
            CONTENT
            <button class="" onclick="location.reload()">刷新</button>
          </div>
        </body>

        <script>
          var isSupportFontFamily = function (f) {
            const h = "monospace";
            const e = "▄█▀";
            const d = 50;
            const a = 100,
              i = 100;
            const c = document.createElement("canvas");
            document.body.append(c);
            const b = c.getContext("2d");
            c.width = a;
            c.height = i;
            b.textAlign = "center";
            b.fillStyle = "black";
            b.textBaseline = "middle";
            var g = function (j) {
              b.clearRect(0, 0, a, i);
              b.font = d + "px " + j + ", " + h;
              b.fillText(e, a / 2, i / 2);
              return b.getImageData(0, 0, a, i).data;
            };
            return indexedDB.cmp(g(h), g(f)) !== 0;
          };
          if (!isSupportFontFamily("Consolas")) {
            document.head.append(
              document.getElementById("font-installer").content
            );
          }
        </script>
      </html>`;

    let content = `<pre style="word-wrap: break-word; white-space: pre-wrap; font-family: Consolas, monospace;">\n`;
    await doFuck(
      (val) => {
        if (typeof val === "string") {
          content += val + "\n";
        }
      },
      (token) => {
        content += "</pre>";
        htmlContent = htmlContent.replace("CONTENT", content);
        if (token) {
          htmlContent += `
            <script>window.addEventListener("load",()=>{new WebSocket(\`ws://\${location.hostname}/lifecycle?token=${token}\`)});</script>
          `;
        }
        res.setHeader("Content-Type", "text/html");
        res.end(htmlContent);
      }
    ).catch((err) => res_error(res, err));
  })
  .on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url ?? "", "http://localhost");
    console.log("____socket", reqUrl);
    if (reqUrl.pathname === "/lifecycle") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.on("close",()=>{
          emitter.emit(`lifecycle_close_${reqUrl.searchParams.get("token")}`);
        })
      });
    }
  })
  .listen(port, "0.0.0.0", () => {
    logAllUrl(`http://localhost:${port}/index.html`);
  });
const wss = new WebSocketServer({ noServer: true });
