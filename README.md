# dsh-velshot

DSH 插件：侧边栏的 **Velshot** 启动器——点击「生图模式」，即在系统浏览器打开 [velshot.com](https://velshot.com)。

## 安装

```bash
dsh plugin --profile desktop add dsh-velshot
```

装完重启 DSH Desktop，侧边栏会出现「生图模式」。

## 使用

1. 点击侧边栏的「生图模式」
2. 系统默认浏览器会自动打开 [velshot.com](https://velshot.com)
3. 没自动打开的话，面板里有「手动打开 Velshot」链接

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

## 卸载

```bash
dsh plugin --profile desktop remove dsh-velshot
```

## License

MIT
