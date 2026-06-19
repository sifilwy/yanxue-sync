const { Client } = require("ssh2");

const { DO_HOST, DO_USER, DO_PASS, DO_PUBKEY } = process.env;

if (!DO_HOST || !DO_USER || !DO_PASS || !DO_PUBKEY) {
  console.error("Missing DO_HOST, DO_USER, DO_PASS, or DO_PUBKEY");
  process.exit(1);
}

const escapedPubkey = DO_PUBKEY.replace(/"/g, '\\"');
const command = [
  "mkdir -p ~/.ssh",
  "chmod 700 ~/.ssh",
  `touch ~/.ssh/authorized_keys`,
  `grep -qxF "${escapedPubkey}" ~/.ssh/authorized_keys || echo "${escapedPubkey}" >> ~/.ssh/authorized_keys`,
  "chmod 600 ~/.ssh/authorized_keys",
  "echo KEY_READY"
].join(" && ");

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(command, (err, stream) => {
      if (err) throw err;
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code) => {
          if (stdout.trim()) console.log(stdout.trim());
          if (stderr.trim()) console.error(stderr.trim());
          conn.end();
          process.exit(code ?? 0);
        })
        .on("data", (data) => {
          stdout += data;
        });
      stream.stderr.on("data", (data) => {
        stderr += data;
      });
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host: DO_HOST,
    username: DO_USER,
    password: DO_PASS,
    readyTimeout: 20000
  });
