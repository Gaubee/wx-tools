import http from "node:http";

http
  .createServer((req, res) => {
    console.log(req.url);
    console.log(JSON.stringify(req.headers, null, 2));
    // console.log(req);
    res.end("okk");
  })
  .listen(8666);

import qrcode from "npm:qrcode-terminal";
qrcode.generate(`http://172.30.91.248:8666/qaq.html`, (qrcode) => {
  console.log(qrcode);
});
