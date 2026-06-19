const { Client } = require("ssh2");
const fs = require("node:fs");

const { DO_HOST, DO_USER = "root", DO_PASS, DO_KEY, DO_CMD } = process.env;

if (!DO_HOST || !DO_CMD || (!DO_PASS && !DO_KEY)) {
  console.error("Missing DO_HOST, DO_CMD, and one of DO_PASS/DO_KEY");
  process.exit(1);
}

const connectOptions = {
  host: DO_HOST,
  username: DO_USER,
  readyTimeout: 90000
};

if (DO_KEY) connectOptions.privateKey = fs.readFileSync(DO_KEY);
if (DO_PASS) connectOptions.password = DO_PASS;

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(DO_CMD, (err, stream) => {
      if (err) throw err;
      stream
        .on("close", (code) => {
          conn.end();
          process.exit(code ?? 0);
        })
        .on("data", (data) => process.stdout.write(data));
      stream.stderr.on("data", (data) => process.stderr.write(data));
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect(connectOptions);
