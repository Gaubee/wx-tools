/**
 *
 * @param {import("node:http").OutgoingMessage} res
 * @param {*} err
 */
export const res_error = (res, err) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    err instanceof Error
      ? html`<h1 class="color:red">${err.message}</h1>
          <pre class="color:red">${err.stack}</pre>`
      : html`<pre class="color:red">${String(err)}</pre>`
  );
};
