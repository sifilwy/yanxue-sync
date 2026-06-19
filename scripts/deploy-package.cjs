const { Client } = require("ssh2");
const fs = require("node:fs");

const { DO_HOST, DO_USER = "root", DO_PASS, DO_KEY, LOCAL_FILE } = process.env;
const remoteArchive = "/root/yanxue-sync-deploy.tar.gz";
const remoteDir = "/opt/yanxue-sync";

if (!DO_HOST || !LOCAL_FILE || (!DO_PASS && !DO_KEY)) {
  console.error("Missing DO_HOST, LOCAL_FILE, and one of DO_PASS/DO_KEY");
  process.exit(1);
}

const connectOptions = {
  host: DO_HOST,
  username: DO_USER,
  readyTimeout: 90000
};

if (DO_KEY) connectOptions.privateKey = fs.readFileSync(DO_KEY);
if (DO_PASS) connectOptions.password = DO_PASS;

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      stream
        .on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Command failed with code ${code}: ${command}`));
        })
        .on("data", (data) => process.stdout.write(data));
      stream.stderr.on("data", (data) => process.stderr.write(data));
    });
  });
}

function upload(conn) {
  return new Promise((resolve, reject) => {
    conn.exec(`cat > ${remoteArchive}`, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      stream.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Upload failed with code ${code}`));
      });
      stream.stderr.on("data", (data) => process.stderr.write(data));
      fs.createReadStream(LOCAL_FILE).pipe(stream);
    });
  });
}

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      console.log("CONNECTED");
      await upload(conn);
      console.log("UPLOADED");
      await exec(conn, `rm -rf ${remoteDir} && mkdir -p ${remoteDir} && tar -xzf ${remoteArchive} -C ${remoteDir}`);
      console.log("EXTRACTED");
      await exec(conn, `cd ${remoteDir} && docker-compose -f docker-compose.ip.yml up -d --build`);
      console.log("DEPLOY_READY");
      conn.end();
    } catch (err) {
      console.error(err.message);
      conn.end();
      process.exit(1);
    }
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect(connectOptions);
