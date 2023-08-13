//@ts-check
import { fileURLToPath } from "node:url";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers/promises";
import { ListAllUrl, logAllUrl } from "./helper/all-ip.mjs";
import AdmZip from "npm:adm-zip";
import { res_error } from "./helper/res_error.mjs";
import { res_json } from "./helper/res_json.mjs";
import { PostItem, QueryResult } from "./type.d.ts";
import { WalkFile, WalkDir } from "./helper/WalkFs.ts";

const __dirname = fileURLToPath(import.meta.resolve("./"));

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, {
  recursive: true,
});

const allow_number_keys = new Map<
  string,
  (item: import("./type.d.ts").PostItem) => any
>([
  ["createTime", (item) => item.createTime * 1000],
  ["likeCount", (item) => item.likeCount],
  ["commentCount", (item) => item.commentCount],
  ["readCount", (item) => item.readCount],
  ["forwardCount", (item) => item.forwardCount],
  ["favCount", (item) => item.favCount],
]);
const allow_string_keys = new Map<
  string,
  (item: import("./type.d.ts").PostItem) => any
>([["description", (item) => item.desc.description]]);
const port = 3001;

/**
 * @type {Record<string,(req:http.IncomingMessage,res:http.OutgoingMessage,url:URL)=>void>}
 */
const API = new Map<
  string,
  (req: http.IncomingMessage, res: http.OutgoingMessage, url: URL) => void
>([
  [
    "/help",
    (req, res) => {
      res_json(res, {
        author: "match-keys",
        snapshoot: `number-range`,
        createTime: `number-range`,
        likeCount: `number-range`,
        commentCount: `number-range`,
        readCount: `number-range`,
        forwardCount: `number-range`,
        favCount: `number-range`,
        description: "match-keys",
      });
    },
  ],
  [
    "/download",
    (req, res) => {
      const zip = new AdmZip();
      for (const entry of WalkFile(DATA_DIR)) {
        const relativepath = path.relative(DATA_DIR, entry.entrypath);
        zip.addFile(relativepath, entry.readBinary());
      }
      res.setHeader("Content-Type", "application/zip");
      res.end(zip.toBuffer());
    },
  ],
  [
    "/authors",
    (req, res) => {
      res_json(
        res,
        [...WalkDir(DATA_DIR)].map((entry) => entry.entryname)
      );
    },
  ],
  [
    "/query",
    (req, res, reqUrl) => {
      function toNumRangeFilter(key: string) {
        const range = search
          .get(key)
          ?.split("-")
          .map(Number)
          .filter((v) => !Number.isNaN(v))
          .slice(0, 2) ?? [-Infinity, +Infinity];
        if (range.length === 0) {
          range.push(-Infinity, +Infinity);
        } else if (range.length === 1) {
          range.push(range[0]);
        }
        const range_filter = (num: number) => {
          return range[0] <= num && num <= range[1];
        };
        return range_filter;
      }

      function toStringKeyFilter(key: string) {
        const matchs = search
          .get(key)
          ?.split(/\s+/g)
          .map((search) => {
            const reg = new RegExp(search);
            const filter = (name: string) => {
              return name === search || reg.test(name);
            };
            return filter;
          }) ?? [() => true];

        const key_filter = (text: string) => {
          return matchs.some((match) => match(text));
        };
        return key_filter;
      }
      const search = reqUrl.searchParams;
      /** 快照过滤器 */
      const snapshoot_filter = toNumRangeFilter("snapshoot");

      /** 作者过滤器 */
      const author_finder = toStringKeyFilter("authors");

      const number_filters = [...allow_number_keys].map(([key, getter]) => {
        const range_filter = toNumRangeFilter(key);
        return (item: PostItem) => range_filter(getter(item));
      });
      const string_filters = [...allow_string_keys].map(([key, getter]) => {
        const range_filter = toStringKeyFilter(key);
        return (item: PostItem) => range_filter(getter(item));
      });
      const item_filter = (item: PostItem) => {
        return [...number_filters, ...string_filters].every((filter) =>
          filter(item)
        );
      };
      const result: Record<string, QueryResult[number]> = {};
      for (const entry of WalkFile(DATA_DIR)) {
        const author = path.parse(entry.entrydir).name;
        if (!author_finder(author)) {
          continue;
        }
        const snapshoot = new Date(
          decodeURIComponent(entry.entryname.replace(".json", ""))
        ).valueOf();
        if (!snapshoot_filter(snapshoot)) {
          continue;
        }

        const { user_info, post_list } = entry.readJson();

        const data = {
          snapshoot,
          list: post_list.filter((post: PostItem) => item_filter(post)),
        };
        (result[author] ??= {
          user: user_info,
          snapshoots: [],
        }).snapshoots.push(data);
      }
      res_json(res, [...Object.values(result)]);
    },
  ],
]);
http
  .createServer(async (req, res) => {
    const origin = `https://${req.headers.host || "localhost"}`;

    const reqUrl = new URL((req.url ?? "").replace("/api", ""), origin);
    for (const [url_pattern_input_path, hanlder] of API) {
      const url_pattern = new URLPattern(url_pattern_input_path, origin);
      if (url_pattern.test(reqUrl)) {
        try {
          return await hanlder(req, res, reqUrl);
        } catch (err) {
          res_error(res, err);
        }
      }
    }
    res.statusCode = 502;
    res.end(`GG:${reqUrl}`);
  })
  .listen(port, "0.0.0.0", () => {
    console.log("https://codebeautify.org/jsonviewer");
    for (const url_pattern of API.keys()) {
      logAllUrl(`http://localhost:${port}${url_pattern}`);
    }
  });
