import chalk from "npm:chalk";

/**
 * 信息提示
 * @param caption
 * @param args
 */
export function logInfo(caption: string, ...args: string[]) {
    console.log(chalk.grey(new Date().toLocaleString()), chalk.cyan(`[info] ${caption}`), ...args);
}

/**
 * 错误提示
 * @param caption
 * @param args
 */
export function logError(caption: string, ...args: string[]) {
    console.log(chalk.grey(new Date().toLocaleString()), chalk.red(`[error] ${caption}`), ...args);
}

/**
 * 成功提示
 * @param caption
 * @param args
 */
export function logSuccess(caption: string, ...args: string[]) {
    console.log(chalk.grey(new Date().toLocaleString()), chalk.green(`[success] ${caption}`), ...args);
}

/**
 * 警告提示
 * @param caption
 * @param args
 */
export function logWarning(caption: string, ...args: string[]) {
    console.log(chalk.grey(new Date().toLocaleString()), chalk.yellow(`[warning] ${caption}`), ...args);
}
