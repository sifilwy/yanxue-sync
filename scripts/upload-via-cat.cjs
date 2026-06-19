const { Client } = require("ssh2");
const fs = require("node:fs");

const { DO_HOST, DO_USER = "root", DO_PASS, DO_KEY, LOCAL_FILE, REMOTE_FILE } = process.env;

if (!DO_HOST || !LOCAL_FILE || !REMOTE_FILE || (!DO_PASS && !DO_KEY)) {
  console.error("Missing DO_HOST, LOCAL_FILE, REMOTE_FILE, and one of DO_PASS/DO_KEY");
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
    conn.exec(`cat > ${REMOTE_FILE}`, (err, stream) => {
      if (err) throw err;
      stream.on("close", (code) => {
        conn.end();
        if (code === 0) console.log("UPLOAD_READY");
        process.exit(code ?? 0);
      });
      stream.stderr.on("data", (data) => process.stderr.write(data));
      fs.createReadStream(LOCAL_FILE).pipe(stream);
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect(connectOptions);
