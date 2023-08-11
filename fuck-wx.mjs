//@ts-check
import { fileURLToPath } from "node:url";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";
import qrcode from "npm:qrcode-terminal";
import { setTimeout } from "node:timers/promises";
import isMobile from "npm:is-mobile";
const __dirname = fileURLToPath(new URL("./", import.meta.url));
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
  writeend();

  let set_cookie = null;
  while (true) {
    await setTimeout(1000);
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
    new Date()
      .toLocaleString()
      .replace(/\//g, "_")
      .replace(/:/g, "_")
      .replace(/\s/g, "-") + ".json"
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
const html = String.raw;
const port = 3000;
http
  .createServer(async (req, res) => {
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
          </style>
        </head>
        <body>
          <div class="content">
            ${is_mobile
              ? `<h3 style="color:#E91E63;">建议使用桌面电脑打开</h3>`
              : ""}
            CONTENT
          </div>
        </body>
      </html>`;

    let content = `<pre style='word-wrap: break-word; white-space: pre-wrap; font-family: Consolas, monospace;'>\n`;
    await doFuck(
      (val) => {
        if (typeof val === "string") {
          content += val + "\n";
        }
      },
      () => {
        if (req.url?.endsWith(".html")) {
          res.setHeader("Content-Type", "text/html");
        } else {
          res.setHeader("Content-Type", "text/plant");
        }
        content += "</pre>";
        htmlContent = htmlContent.replace("CONTENT", content);
        res.end(htmlContent);
      }
    );
  })
  .listen(port, () => {
    console.log(`http://localhost:${port}/index.html`);
  });
