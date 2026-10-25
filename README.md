# dsh-velshot

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）侧边栏添加一个「**生图模式**」入口，点击即在系统浏览器打开 [Velshot](https://velshot.com) —— Velshot AI 生图工作台。

## 安装

本插件从 GitHub 安装：

```bash
dsh plugin --profile desktop add github:LiangChem/dsh-velshot
```

装完重启 DSH Desktop。侧边栏主列表（「插件」「自动化任务」所在那一列）的最后会出现「生图模式」。

## 使用

1. 点击侧边栏的「生图模式」
2. 主面板切换过来后自动用**系统默认浏览器**打开 [velshot.com](https://velshot.com)
3. 如果浏览器没有自动打开，面板里有「手动打开 Velshot」链接

## 自定义

在**你自己的 profile** 的 `cordis.patch.yml`（`~/.dsh/desktop/cordis.patch.yml`）里按 id 覆盖配置：

```yaml
- insert:
    - id: dsh-velshot
      name: dsh-velshot
      config:
        targetUrl: https://velshot.com/
        buttonLabel: 生图模式
        openIn: browser   # browser = 系统浏览器；same-tab = 当前页跳转
```

> 桌面版 GUI 不经过 webServer 路由面，此时 client 半边使用内置的同一份默认值，行为一致。

## 工作原理

- 客户端半边向 `sidebar.panellist` slot 注册一行（排在既有 plugins / schedules 之后），
  并向 `main` keyed 槽注册同 id 的面板；点击行切换面板，面板挂载即执行跳转
- 桌面版 Electron 宿主对 `window.open` 一律 deny 并转 `shell.openExternal(url)`，
  这正好等价于"用系统浏览器打开"；插件拿到 `null` 时绝不再导航，避免打开两次
- 模块级共享的去重闸门（20 秒）挡住 React 严格模式 / slot 重挂载导致的重复跳转

## 卸载

```bash
dsh plugin --profile desktop remove dsh-velshot
```

## License

MIT
