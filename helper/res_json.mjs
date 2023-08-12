//@ts-check

/**
 *
 * @param {import("node:http").OutgoingMessage} res
 * @param {*} data
 */
export const res_json = (res, data) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};
