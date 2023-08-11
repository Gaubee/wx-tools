//@ts-check
import { fileURLToPath } from "node:url";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { setTimeout } from "node:timers/promises";

function* WalkFile(dir, deep = Infinity) {
  if (deep <= 0) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const entrypath = path.join(dir, name);
    if (fs.statSync(entrypath).isFile()) {
      yield {
        entryname: name,
        entrypath: entrypath,
        dirname: dir,
        readJson() {
          return JSON.parse(fs.readFileSync(entrypath, "utf-8"));
        },
      };
    } else {
      yield* WalkFile(entrypath, deep - 1);
    }
  }
}

function* WalkDir(dir, deep = Infinity) {
  if (deep <= 0) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const entrypath = path.join(dir, name);
    if (fs.statSync(entrypath).isDirectory()) {
      yield {
        entryname: name,
        entrypath: entrypath,
        dirname: dir,
      };
    } else {
      yield* WalkDir(entrypath, deep - 1);
    }
  }
}

fs.mkdirSync(path.join(__dirname, "data"), {
  recursive: true
});
const walkSnap = () => WalkFile(path.join(__dirname, "data"));
const walkAuthor = () => WalkDir(path.join(__dirname, "data"));

const __dirname = fileURLToPath(new URL("./", import.meta.url));
const allow_number_keys = new Map([
  ["createTime", (item) => item.createTime * 1000],
  ["likeCount", (item) => item.likeCount],
  ["commentCount", (item) => item.commentCount],
  ["readCount", (item) => item.readCount],
  ["forwardCount", (item) => item.forwardCount],
  ["favCount", (item) => item.favCount],
]);
const allow_string_keys = new Map([
  ["description", (item) => item.desc.description],
]);
const port = 3001;
http
  .createServer((req, res) => {
    const res_json = (data) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    const reqUrl = new URL(req.url.replace('/api', ''), "http://localhost");
    switch (reqUrl.pathname) {
      case "/help":
        {
          res_json({
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
        }
        break;
      case "/authors":
        {
          res_json([...walkAuthor()].map((entry) => entry.entryname));
        }
        break;
      case "/query":
        {
          function toNumRangeFilter(key) {
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
            const range_filter = (num) => {
              return range[0] <= num && num <= range[1];
            };
            return range_filter;
          }
          function toStringKeyFilter(key) {
            const matchs = search
              .get(key)
              ?.split(/\s+/g)
              .map((search) => {
                const reg = new RegExp(search);
                return (name) => {
                  return name === search || reg.test(name);
                };
              }) ?? [() => true];
            const key_filter = (text) => {
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
            return (item) => range_filter(getter(item));
          });
          const string_filters = [...allow_string_keys].map(([key, getter]) => {
            const range_filter = toStringKeyFilter(key);
            return (item) => range_filter(getter(item));
          });
          const item_filter = (item) => {
            return [...number_filters, ...string_filters].every((filter) => filter(item));
          };
          const result = {};
          for (const entry of walkSnap()) {
            const author = path.parse(entry.dirname).name;
            if (!author_finder(author)) {
              continue;
            }
            const snapshoot = new Date(
              entry.entryname
                .replace(".json", "")
                .replace(
                  /(\d+)_(\d+)_(\d+)\-(\d+)_(\d+)_(\d+)/,
                  "$1-$2-$3 $4:$5:$6"
                )
            ).valueOf();
            if (!snapshoot_filter(snapshoot)) {
              continue;
            }

            const { user_info, post_list } = entry.readJson();

            const data = {
              snapshoot,
              list: post_list.filter((post) => item_filter(post)),
            };
            (result[author] ??= {
              user: user_info,
              snapshoots: [],
            }).snapshoots.push(data);
          }
          res_json([...Object.values(result)]);
        }
        break;
    }
  })
  .listen(port, () => {
    console.log("https://codebeautify.org/jsonviewer");
    console.log(`http://localhost:${port}/query`);
    console.log(`http://localhost:${port}/authors`);
  });
