//@ts-check
import type http from "node:http";

const html = String.raw;
/**
 *
 * @param {import("node:http").OutgoingMessage} res
 * @param {*} err
 */
export const res_error = (res: http.OutgoingMessage, err: any) => {
    console.error(err);
    res.setHeader("Content-Type", "text/html");
    res.end(
        err instanceof Error
            ? html`<h1 class="color:red">${err.message}</h1>
                  <pre class="color:red">${err.stack}</pre>`
            : html`<pre class="color:red">${String(err)}</pre>`,
    );
};
