# Music

一个基于 React + TypeScript + Vite 的网页音乐播放器，主打「无需登录、打开即用」。

## 功能特性

- 推荐页：基于 Audius `trending(week)`，支持真实分页加载（20 条/页）
- 排行榜：基于 Audius `trending(month)`，支持真实分页加载（20 条/页）
- 搜索：按关键词搜索歌曲，支持滚动分页加载
- 播放控制：播放 / 暂停、上一首 / 下一首、进度条拖动、音量控制
- 歌词：支持同步歌词与纯文本歌词回退
- 收藏：本地持久化缓存，刷新页面后仍保留
- 搜索历史：本地持久化，支持快捷回查与清空

## 技术栈

- React 19
- TypeScript
- Vite 7
- ESLint 9

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

默认访问地址（Vite 输出）：

```text
http://localhost:5173
```

### 3. 构建生产版本

```bash
npm run build
```

### 4. 本地预览生产包

```bash
npm run preview
```

### 5. 代码检查

```bash
npm run lint
```

## 项目结构

```text
music/
├─ public/
├─ src/
│  ├─ services/
│  │  ├─ musicApi.ts     # 音乐数据接口与分页逻辑
│  │  └─ lyricsApi.ts    # 歌词请求与解析
│  ├─ App.tsx            # 主页面与交互逻辑
│  ├─ index.css          # 页面样式
│  └─ main.tsx           # 应用入口
├─ package.json
└─ README.md
```

## 数据来源说明

- 音乐数据：Audius 开放接口
- 歌词数据：LRCLIB

说明：第三方接口可能受网络环境、频率限制或策略调整影响。

## License

仅供学习与交流使用。
