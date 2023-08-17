/**
 * 节流函数
 * @param handler 回调
 * @param time 频率间隔时间(毫秒)
 */
export function debounce(handler: Function, time: number) {
    let timer = 0;
    return function () {
        if(timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(handler, time);
    }
}

/**
 * 防抖函数
 * @param handler 回调
 * @param time 频率间隔时间(毫秒)
 */
export function throttle(handler: Function, time: number) {
    let valid = true;
    return function () {
        if(!valid) {
            return false;
        }
        valid = false;
        setTimeout(() => {
            handler();
            valid = true;
        }, time);
    }
}
