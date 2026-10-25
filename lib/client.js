/**
 * dsh-velshot —— client 半边（普通脚本，零 npm 依赖）。
 *
 * 桌面外壳用 `<script>` 直接加载本文件：执行即向 `window.__ModuleLoader__`
 * 注册工厂，工厂在装配时才从注入的 `require` 里取 `react`。
 *
 * 流程：侧边栏「生图模式」行 → 点击切换到 main 面板 → 挂载即用系统浏览器打开 Velshot。
 *
 * 两个踩坑后的关键设计（来自参考实现的本机实测）：
 *  1. **开窗绝不用返回值判断"被拦截"**：DSH 桌面版的 Electron 主进程里，
 *     `setWindowOpenHandler` 永远返回 `{action:'deny'}` 并且顺手 `shell.openExternal(url)`——
 *     于是任何 `window.open` 都返回 `null`，但网站**已经被宿主用系统浏览器打开了一次**。
 *     拿到 `null` 时**绝不**再对当前页导航，否则会打开两次。
 *  2. **去重窗口要跨挂载**：React 严格模式 / slot 重注册都可能导致面板重新挂载，
 *     重新挂载时 `useEffect` 会再跑一次。去重状态放在**模块级共享**的编排器里。
 */
window.__ModuleLoader__.load({
  id: 'dsh-velshot',
  factory: (require) => {
    const React = require('react')

    /** 与宿主 Config 默认值保持一致：路由读不到时用它们兜底（桌面版 GUI 必走兜底）。 */
    const DEFAULTS = {
      targetUrl: 'https://velshot.com/',
      buttonLabel: '生图模式',
      /** `browser` = 系统浏览器（默认）；`same-tab` = 当前页导航。 */
      openIn: 'browser',
    }

    /**
     * 去重窗口：这段时间内的重复触发一律忽略。
     * 必须足够大，挡住"面板重新挂载"导致的二次跳转。
     */
    const LAUNCH_DEDUPE_MS = 20000

    /** 具名窗口：普通浏览器里同名标签页会被复用（DSH 桌面版因宿主 deny 而不适用）。 */
    const WINDOW_NAME = 'velshot-launch'

    /** 侧栏主列表那一行的 id，同时也是 `main` 面板的 key。 */
    const PANEL_ID = 'velshot'

    /** 侧栏主列表（「插件」「自动化任务」所在的那一列）。 */
    const SLOT_PANEL_LIST = 'sidebar.panellist'

    /** 主面板 keyed 槽，点击侧栏行后切换到这里。 */
    const SLOT_MAIN = 'main'

    /** 排在最后一行：既有的 plugins = 0、schedules = 10。 */
    const PANEL_ORDER = 100

    //#region 配置
    let cachedConfig
    /** 读宿主配置；任何失败都用默认值兜底。 */
    async function loadConfig() {
      if (cachedConfig !== undefined) return cachedConfig
      try {
        const response = await fetch('/velshot/config.json', { cache: 'no-store' })
        if (!response.ok) throw new Error(`config route returned ${response.status}`)
        const payload = await response.json()
        cachedConfig = { ...DEFAULTS, ...payload }
      } catch {
        cachedConfig = DEFAULTS
      }
      return cachedConfig
    }
    //#endregion

    //#region 开窗
    /**
     * 打开目标地址。
     * - `browser`：**只调用一次 `window.open`**。桌面版宿主对任何 `window.open` 都 deny
     *   并顺手 `shell.openExternal(url)`，所以必然拿到 `null`，而网站已经被打开过一次；
     *   此时若再 `location.assign()` 就会出现"打开两次"，因此 `null` 只记为 `blocked`。
     * - `same-tab`：显式要求时才导航当前页。
     */
    function openTarget(config, win) {
      const url = config.targetUrl
      if (config.openIn === 'same-tab') {
        win.location.assign(url)
        return { kind: 'same-tab', url }
      }
      const opened = win.open(url, WINDOW_NAME)
      if (opened === null || opened === undefined) {
        // 不导航！宿主很可能已经用系统浏览器打开过了。
        return { kind: 'blocked', url }
      }
      try {
        opened.opener = null
      } catch {
        /* 跨源时可能不可写，忽略 */
      }
      try {
        opened.focus()
      } catch {
        /* 忽略 */
      }
      return { kind: 'opened', url }
    }
    //#endregion

    //#region 编排（去重 + 进行中闸门，模块级共享一份）
    let sharedLauncher
    function createLauncher() {
      let lastRanAt = Number.NEGATIVE_INFINITY
      let inFlight = false
      return {
        async launch() {
          const at = Date.now()
          if (inFlight) return { ran: false, reason: 'in-flight' }
          if (at - lastRanAt < LAUNCH_DEDUPE_MS) return { ran: false, reason: 'deduped' }
          inFlight = true
          lastRanAt = at
          try {
            const config = await loadConfig()
            const open = openTarget(config, window)
            return { ran: true, open }
          } finally {
            inFlight = false
          }
        },
      }
    }
    //#endregion

    /**
     * 侧栏那一行只接收**图标**的 owner props（`size` 与 `active`）：
     * 行容器与文案由侧栏自己渲染，文案取自注册时的 `label` 元数据。
     */
    function createIcon(React) {
      return function Icon(props) {
        const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16
        return React.createElement(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
            style: {
              display: 'block',
              color:
                props.active === true
                  ? 'var(--dsw-alias-label-primary)'
                  : 'var(--dsw-alias-label-secondary)',
            },
          },
          React.createElement('rect', { key: 'frame', x: 3, y: 4.5, width: 18, height: 15, rx: 3 }),
          React.createElement('circle', { key: 'sun', cx: 8.5, cy: 9.5, r: 1.4 }),
          React.createElement('path', { key: 'hill', d: 'M4.5 17.5l4.5-4.5 3.5 3.5 2.5-2.5 4 4' }),
        )
      }
    }

    /**
     * 主面板：挂载即启动跳转（共享闸门保证一次点击只跑一次）。
     * 浏览器打开后，面板停留在提示页：标题 + 手动链接。
     */
    function createPanel(React, launcher) {
      return function Panel() {
        const [suffix, setSuffix] = React.useState('')
        const [target, setTarget] = React.useState(DEFAULTS.targetUrl)
        const started = React.useRef(false)

        React.useEffect(() => {
          if (started.current) return
          started.current = true
          void launcher.launch().then((outcome) => {
            if (outcome.ran && outcome.open !== undefined) setTarget(outcome.open.url)
            if (outcome.ran && outcome.open.kind === 'blocked') {
              // 宿主已经打开过一次；万一真没开成，用户还能点手动链接。
              setSuffix('（如果浏览器没有自动打开，请点下面的链接）')
            }
          })
        }, [])

        return React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              height: '100%',
              minHeight: '240px',
              color: 'var(--dsw-alias-label-secondary)',
              fontSize: '13px',
            },
          },
          React.createElement(
            'div',
            { key: 'title', style: { fontSize: '15px', color: 'var(--dsw-alias-label-primary)' } },
            `生图模式已开启${suffix}`,
          ),
          React.createElement(
            'a',
            {
              key: 'manual',
              href: target,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { color: 'var(--dsw-alias-brand-primary)', textDecoration: 'underline' },
            },
            '手动打开 Velshot',
          ),
        )
      }
    }

    /**
     * 组装 client 插件。
     * @returns client 插件对象（name / inject / apply 与宿主半边同形）。
     */
    function createPanelPlugin(React) {
      const launcher = (sharedLauncher ??= createLauncher())
      const Icon = createIcon(React)
      const Panel = createPanel(React, launcher)

      const apply = (ctx) => {
        // ① 侧栏主列表最后一行（label 用函数形式，投影时求值）
        ctx.slots.inject(SLOT_PANEL_LIST, () =>
          ctx.slots.register(
            {
              name: SLOT_PANEL_LIST,
              id: PANEL_ID,
              order: PANEL_ORDER,
              label: () => DEFAULTS.buttonLabel,
            },
            Icon,
          ),
        )
        // ② 同 id 的主面板：点击侧栏那一行会切到这里，由它完成跳转
        ctx.slots.inject(SLOT_MAIN, () => ctx.slots.register({ name: SLOT_MAIN, key: PANEL_ID }, Panel))
      }

      return { name: 'velshot', inject: ['slots'], apply }
    }

    const plugin = createPanelPlugin(React)
    return { name: plugin.name, inject: plugin.inject, apply: plugin.apply }
  },
})
