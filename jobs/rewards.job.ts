import fs from "node:fs";
import path from "node:path";
import WebSocket from "npm:ws";
import minimist from "npm:minimist";
import schedule from "npm:node-schedule";
import dayjs, { type Dayjs } from "npm:dayjs";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { debounce } from "../helper/utils.ts";
import { emptyDirSync } from "https://deno.land/std/fs/mod.ts";
import type { Buffer } from "node:buffer";
import type { UserInfo, PostItem, QueryResult } from "../type.d.ts";

const __dirname = fileURLToPath(new URL("./", import.meta.url));

const DATA_DIR = path.join(__dirname, "data", "rewards");
const RECORD_DIR = path.join(DATA_DIR, "record");
const MERGE_DIR = path.join(DATA_DIR, "merge");

const ONE_HOUR_TIMESTAMP = 3_600_000;

interface RewardInfo {
    address: string;
    user: UserInfo;
    posts: PostItem[];
    updateTime: number;
}
interface MergeItem {
    address: string;
    user: UserInfo;
    post: PostItem;
    updateTime: number;
}

export class RewardsJob {
    #dataRecordMap = new Map<string, RewardInfo>();
    #recordLastTime = 0;
    constructor(timeStep: number) {
        fs.mkdirSync(DATA_DIR, {
            recursive: true,
        });
        fs.mkdirSync(RECORD_DIR, {
            recursive: true,
        });
        fs.mkdirSync(MERGE_DIR, {
            recursive: true,
        });
        
        const recordFile = fs.readdirSync(RECORD_DIR).at(0);
        if(recordFile) {
            this.#recordLastTime = new Date(decodeURIComponent(recordFile.replace(".json", ""))).getTime();
            if(dayjs(this.#recordLastTime).format("YYYY-MM-DD") === dayjs(new Date()).format("YYYY-MM-DD")) {
                this.#dataRecordMap = new Map(JSON.parse(fs.readFileSync(path.join(RECORD_DIR, recordFile), "utf-8")));
            }
        }
        
        this.record(timeStep);
    }

    /**
     * 数据记录
     * @param timeStep 时间间隔步长
     */
    record = async (timeStep: number) => {
        const startTime = dayjs().minute(0).second(0);
        const save = debounce((updateTime: number) => {
            emptyDirSync(RECORD_DIR);
            fs.writeFileSync(path.join(RECORD_DIR, `${encodeURIComponent(new Date(updateTime).toISOString())}.json`), JSON.stringify([...this.#dataRecordMap.entries()]));
            if(this.#recordLastTime && dayjs(updateTime).day() !== dayjs(this.#recordLastTime).day()) {
                // 新的一天到来了
                this.#merge(this.#recordLastTime);
            }
            this.#recordLastTime = updateTime;
        }, 1000);
        for(let index=0; index<24; index++) {
            const rp = new RewardsPuller(startTime.hour(index), timeStep, this.#recordLastTime);
            rp.on("change", (data: RewardInfo[]) => {
                console.log("___rewards_job_data_change", index, data.length);
                for(const item of data) {
                    // 这里的数据已经是经过重新过滤的用户最新的点赞数最高的两条数据
                    const record = this.#dataRecordMap.get(item.address);
                    if(!record || record.updateTime < item.updateTime) {
                        this.#dataRecordMap.set(item.address, item);
                        save(item.updateTime);
                    }
                }
            });
        }
    }
    
    #merge = (time: number) => {
        const result: MergeItem[] = [];
        this.#dataRecordMap.forEach(item => {
            for(const post of item.posts) {
                result.push({
                    address: item.address,
                    user: item.user,
                    post,
                    updateTime: item.updateTime
                });
            }
        });
        const date = encodeURIComponent(new Date(time).toLocaleDateString());
        fs.writeFileSync(path.join(MERGE_DIR, `${date}.json`), JSON.stringify(result));
        this.#dataRecordMap.clear();
        console.log("___rewards_job_merge", date, result.length);
    }
}

export class RewardsPuller extends EventEmitter {
    #ws!: WebSocket;
    #wsPingTimer = 0;
    #wsSearch = new URLSearchParams();
    #slotTime = {
        startTime: dayjs(),
        timeStep: 0,
        get start() {
            return this.startTime.valueOf() - this.timeStep;
        },
        get end() {
            return this.start + ONE_HOUR_TIMESTAMP;
        }
    }
    
    constructor(startTime: Dayjs, timeStep: number, snapshotStartTime?: number) {
        super();
        this.#slotTime.startTime = startTime;
        this.#slotTime.timeStep = timeStep;
        this.#searchUpdate();
        console.log(
            "___rewards_puller_slot_time",
            new Date(this.#slotTime.start).toLocaleString(),
            new Date(this.#slotTime.end).toLocaleString()
        );
        
        this.#ws = new WebSocket(`ws://localhost:3002/api-admin/query/observe`, {
            perMessageDeflate: false
        });
        if(snapshotStartTime) {
            this.#wsSearch.append("snapshotStartTime", snapshotStartTime);
        }
        this.#run();
    }
    
    #run = () => {
        this.#wsSearch.append("snapshot_limit", "1");
        this.#wsSearch.append("description", "ETHMeta");
        this.#wsSearch.append("likeCount", "10-Infinity");
        this.#wsSearch.append("createTime", `${this.#slotTime.start}-${this.#slotTime.end}`);
        this.#wsPingTimer = setInterval(() => {
            this.#ws.ping();
        }, 30000);
        this.#ws.on("open", () => {
            this.#ws.send(this.#wsSearch.toString());
        });
        this.#ws.on("close", () => {
            clearInterval(this.#wsPingTimer);
            console.log("___rewards_puller_websocket_close");
        });
        this.#ws.on("message", (data: Buffer) => {
            try {
                const json = JSON.parse(data.toString()) as QueryResult;
                this.emit("change", json.map(posts => ({
                    address: posts.address,
                    posts: posts.list.sort((a,b) => b.likeCount - a.likeCount).slice(0, 2),
                    user: posts.user,
                    updateTime: Date.now()
                })));
            } catch (err: any) {
                console.log(err);
            }
        });
    }
    
    #searchUpdate = () => {
        schedule.scheduleJob("0 0 0 * * *", () => {
            // 每天凌晨0点更新查询条件
            this.#slotTime.startTime.add(1, "day");
            this.#wsSearch.set("createTime", `${this.#slotTime.start}-${this.#slotTime.end}`);
            this.#ws.send(this.#wsSearch.toString());
        });
    }
    
    destroy = () => {
        this.#ws.close();
        clearInterval(this.#wsPingTimer);
    }
}

export default function startup() {
    const args = minimist(Deno.args);
    const timeStep = args["time-step"];
    if(timeStep) {
        new RewardsJob(+timeStep);
    }
}
startup();
