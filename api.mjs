//@ts-check
import { fileURLToPath } from "node:url";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { setTimeout } from "node:timers/promises";

function* WalkFile(dir) {
  for (const name of fs.readdirSync(dir)) {
    const entrypath = path.join(dir, name);
    if (fs.statSync(entrypath).isFile()) {
      yield {
        filename: name,
        filepath: entrypath,
        dirname: dir,
        readJson() {
          return JSON.parse(fs.readFileSync(entrypath, "utf-8"));
        },
      };
    } else {
      yield* WalkFile(entrypath);
    }
  }
}

const __dirname = fileURLToPath(new URL("./", import.meta.url));
const allow_number_keys = [
  "createTime",
  "likeCount",
  "commentCount",
  "readCount",
  "forwardCount",
  "favCount",
];
const port = 3001;
http
  .createServer((req, res) => {
    const res_json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    switch (req.url) {
      case "/help":
        {
          res_json({
            snapshoot: `$START_TIME-$END_TIME | $TIME | default=$CURRENT_TIME`,
          });
        }
        break;
      case "/query":
        {
          function toNumRangeFilter(key) {
            const range = search
              .get(key)
              ?.split("-")
              .map((v) => new Date(v).valueOf())
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
              return matchs.some((match) => match(key));
            };
            return key_filter;
          }
          const search = new URL(req.url, "http://localhost").searchParams;
          /** 快照过滤器 */
          const snapshoot_filter = toNumRangeFilter("snapshoot");

          /** 作者过滤器 */
          const author_finder = toStringKeyFilter("authors");

          const filters = allow_number_keys.map((key) => {
            const range_filter = toNumRangeFilter(key);
            return (item) => range_filter(item[key]);
          });
          const item_filter = (item) => {
            return filters.every((filter) => filter(item));
          };

          const result = {};
          for (const entry of WalkFile(path.join(__dirname, "data"))) {
            const author = path.parse(entry.dirname).name;
            if (!author_finder(author)) {
              continue;
            }
            const snapshoot = new Date(
              entry.filename
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
          res_json(result);
        }
        break;
    }
  })
  .listen(port, () => {
    console.log("https://codebeautify.org/jsonviewer");
    console.log(`http://localhost:${port}/query`);
  });
