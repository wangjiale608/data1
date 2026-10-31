const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 解析接口
app.post('/api/parse', async (req, res) => {
  try {
    const { shareUrl } = req.body;
    if (!shareUrl || !shareUrl.includes('mypikpak.com/s/')) {
      return res.json({ code: -1, msg: '不是有效的PikPak分享链接' });
    }

    // 提取分享id
    const shareId = shareUrl.split('/s/')[1].split('?')[0];
    const metaRes = await axios.get(`https://api.mypikpak.com/v1/share/${shareId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android; Mobile) AppleWebKit/537.36',
        'Referer': 'https://mypikpak.com/'
      },
      timeout: 10000
    });

    const data = metaRes.data;
    if (!data || !data.file) {
      return res.json({ code: -1, msg: '解析失败，链接失效/私有分享' });
    }

    const fileInfo = data.file;
    // 判断是不是视频
    if (!fileInfo.media_stream) {
      return res.json({ code: -1, msg: '这个分享不是视频文件，无法播放' });
    }

    const videoUrl = fileInfo.media_stream.url;
    res.json({
      code: 0,
      msg: '解析成功',
      name: fileInfo.name,
      videoUrl: videoUrl
    });

  } catch (err) {
    console.error(err);
    res.json({ code: -1, msg: '接口请求失败，PikPak风控或者接口更新了' });
  }
});

app.listen(PORT, () => {
  console.log(`服务启动，端口：${PORT}`);
});