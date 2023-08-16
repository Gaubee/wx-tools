// @ts-check
import os from "node:os";

export const all_ip = [
  ...JSON.stringify(os.networkInterfaces()).matchAll(/"address":"([\d\.]+)"/g),
].map((arr) => arr[1]);
/**
 *
 * @param {URL|string} url
 */
export function* ListAllUrl(url: string) {
  if (typeof url === "string") {
    url = new URL(url);
  }
  yield url;
  for (const ip of all_ip) {
    const _url = new URL(url);
    _url.hostname = ip;
    yield _url;
  }
}
/**
 *
 * @param {URL|string} input_url
 */
export const logAllUrl = (input_url: string) => {
  let first = true;
  for (const url of ListAllUrl(input_url)) {
    if (first) {
      console.log(url.href);
      first = false;
    } else {
      console.log("  " + url.href);
    }
  }
}
