const WebSocket = require('ws');
const axios = require('axios');

// ============ 配置区，只改这里 ============
const APPID = "1905962333";
const APPSECRET = "qAVrDayNmCd4WzSwRwSzW4cBlLwYAnR5";
const MUSIC_API = "https://https://c.wwwweb.top/script/lxmusic?key=IKM-P94200001-dq1G4iMELnZmo2NS-SF/search";
// =========================================

let ws = null;
let accessToken = "";
let tokenExpire = 0;
let heartbeatTimer = null;

async function getToken() {
  const now = Date.now() / 1000;
  if (accessToken && tokenExpire > now + 60) return accessToken;
  const res = await axios.post("https://bots.qq.com/app/getAppAccessToken", {
    appId: APPID,
    clientSecret: APPSECRET
  });
  accessToken = res.data.access_token;
  tokenExpire = now + res.data.expires_in;
  console.log("✅ 获取Token成功", accessToken);
  return accessToken;
}

async function connectWs() {
  const token = await getToken();
  const gatewayUrl = `wss://api.sgroup.qq.com/websocket?access_token=${token}`;
  console.log("🔌 正在连接网关：", gatewayUrl);
  ws = new WebSocket(gatewayUrl);

  ws.on("open", () => {
    console.log("✅ WebSocket连接成功！");
  })

  ws.on("message", (data) => {
    const pkg = JSON.parse(data);
    if (pkg.op === 11) {
      console.log("💓 收到心跳");
      return;
    }
    if (pkg.op === 0) {
      handleEvent(pkg);
    }
    if (pkg.op === 7) {
      console.log("⚠️ 需要重连，3秒后重试");
      setTimeout(connectWs, 3000);
    }
    if (pkg.op === 9) {
      console.log("❌ Session失效，重新获取token重连");
      setTimeout(connectWs, 3000);
    }
  })

  ws.on("close", () => {
    console.log("❌ 连接断开，5秒后自动重连");
    clearInterval(heartbeatTimer);
    setTimeout(connectWs, 5000);
  })

  ws.on("error", (err) => {
    console.error("WebSocket错误：", err);
  })

  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ op: 1 }));
    }
  }, 30000)
}

async function handleEvent(pkg) {
  const eventType = pkg.t;
  const body = pkg.d;

  if (eventType === "GROUP_AT_MESSAGE_CREATE") {
    const content = body.content.trim();
    const groupId = body.group_id;
    console.log(`📩 收到群消息：${content}`);

    if (content.startsWith("/搜索")) {
      let raw = content.replace("/搜索", "").trim();
      if (!raw) {
        await sendGroupMsg(groupId, "🎵用法：/搜索 歌名 [平台]\n可选平台：网易云、QQ音乐、酷我、酷狗");
        return;
      }
      const platformMap = {
        "网易云": "netease",
        "QQ音乐": "qq",
        "酷我": "kuwo",
        "酷狗": "kugou"
      };
      const parts = raw.split(" ");
      let source = "qq";
      let songName = raw;
      if (parts.length >= 2 && platformMap[parts[parts.length - 1]]) {
        source = platformMap[parts.pop()];
        songName = parts.join(" ");
      }
      try {
        const apiRes = await axios.get(`${MUSIC_API}?name=${encodeURIComponent(songName)}&source=${source}`);
        const musicData = apiRes.data;
        if (musicData.code !== 200 || !musicData.data?.length) {
          await sendGroupMsg(groupId, "🥺没有搜到这首歌");
          return;
        }
        const info = musicData.data[0];
        const reply = `🎵搜索结果
歌名：${info.name}
歌手：${info.artist}
平台：${Object.keys(platformMap).find(k => platformMap[k] === source) || "QQ音乐"}
播放链接：${info.url}`;
        await sendGroupMsg(groupId, reply);
      } catch (e) {
        await sendGroupMsg(groupId, "❌搜索失败，音源接口异常");
      }
    }
  }
}

async function sendGroupMsg(groupId, content) {
  const token = await getToken();
  await axios.post(`https://api.sgroup.qq.com/channels/${groupId}/messages`,
    { content },
    { headers: { Authorization: `Bot ${token}` } }
  )
}

// 给Render保活用的简易http服务
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is running");
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log(`🌐保活服务监听端口 ${PORT}`);
});

// 启动机器人
connectWs();
