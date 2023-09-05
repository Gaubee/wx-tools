//@ts-check
import fs from "node:fs";
import path from "node:path";

export class Entry {
    constructor(
        readonly entryname: string,
        readonly entrypath: string,
        readonly entrydir: string,
        readonly workdir: string,
    ) {
        this.state = fs.statSync(entrypath);
    }
    readonly state: fs.Stats;
    get workpath() {
        return path.relative(this.workdir, this.entrypath);
    }
    get isFile() {
        return this.state.isFile();
    }
    get isDir() {
        return this.state.isDirectory();
    }
    readJson() {
        try {
            return JSON.parse(fs.readFileSync(this.entrypath, "utf-8"));
        } catch (err) {
            console.log(`文件损坏: ${this.entrypath}`);
            throw err;
        }
    }
    readBinary() {
        return fs.readFileSync(this.entrypath);
    }
}
export function* WalkAny(entrydir: string, workdir = entrydir, deep = Infinity): Generator<Entry> {
    if (deep <= 0) {
        return;
    }
    for (const entryname of fs.readdirSync(entrydir)) {
        const entrypath = path.join(entrydir, entryname);
        const entry = new Entry(entryname, entrypath, entrydir, workdir);
        yield entry;
        if (entry.isDir) {
            yield* WalkAny(entrypath, workdir, deep - 1);
        }
    }
}

export function* WalkFile(entrydir: string, workdir = entrydir, deep = Infinity) {
    for (const entry of WalkAny(entrydir, workdir, deep)) {
        if (entry.isFile) {
            yield entry;
        }
    }
}
export function* WalkDir(entrydir: string, workdir = entrydir, deep = Infinity) {
    for (const entry of WalkAny(entrydir, workdir, deep)) {
        if (entry.isDir) {
            yield entry;
        }
    }
}
