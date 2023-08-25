/**
 * 节流函数
 * @param handler 回调
 * @param time 频率间隔时间(毫秒)
 */
export function debounce(handler: (...args: any[]) => void, time: number) {
    let timer = 0;
    return function () {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(handler, time);
    };
}

/**
 * 防抖函数
 * @param handler 回调
 * @param time 频率间隔时间(毫秒)
 */
export function throttle(handler: Function, time: number) {
    let valid = true;
    return function () {
        if (!valid) {
            return false;
        }
        valid = false;
        setTimeout(() => {
            handler();
            valid = true;
        }, time);
    };
}

/**
 * 日期文件名转时间戳
 * @param fileName 文件名
 * @param suffix 后缀名
 */
export function dateFileNameToTimestamp(fileName: string, suffix = "json") {
    return new Date(decodeURIComponent(fileName.replace(`.${suffix}`, ""))).valueOf();
}