import * as _ws from "npm:ws@8.13.0";
export const ws = _ws as typeof import("npm:@types/ws@8.5.3");

import * as compressing from "npm:compressing@1.10.0";
export { compressing };

import * as _minimist from "npm:minimist@1.2.8";
export const minimist = _minimist.default as typeof import("npm:@types/minimist@1.2.2");

import * as _chalk from "npm:chalk@5.3.0";
export const chalk = _chalk.default;
export const ModuleChalk = _chalk;
