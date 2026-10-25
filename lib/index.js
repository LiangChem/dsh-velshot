/**
 * dsh-velshot —— Velshot 生图模式入口插件（宿主半边）。
 *
 * 流程：用户在侧边栏点「生图模式」→ 客户端半边用系统浏览器打开 Velshot。
 *
 * 宿主半边只做一件事：把部署期配置以 JSON 路由暴露给 client 半边
 * （client 半边读不到宿主的 Config；桌面版 GUI 不经过 webServer 路由面，
 * 此时 client 半边使用自己内置的默认值，行为一致）。
 *
 * 设计取舍：**不 inject `webServer`**。用 `ctx.get('webServer')` 读取并降级，
 * 让插件在没有 webServer 的 profile 里也能正常加载（只是不提供路由），
 * 而不是因为依赖缺失一直等在那里。
 */
import z from '@deepseek-ai/schemastery'

/** 诊断信息里的插件名。 */
export const name = 'velshot'

/** 没有必需服务：`webServer` 是可选能力，用 `ctx.get` 读取。 */
export const inject = []

/** 路由前缀，与 client 半边里的地址保持一致。 */
export const ROUTE_PREFIX = '/velshot'

/** 运行时配置的路由。 */
export const CONFIG_ROUTE = `${ROUTE_PREFIX}/config.json`

/** 部署期配置的运行时校验 schema。 */
export const Config = z.object({
  targetUrl: z.string().default('https://velshot.com/'),
  buttonLabel: z.string().default('生图模式'),
  openIn: z.union([z.const('browser'), z.const('same-tab')]).default('browser'),
})

/**
 * 组装给 client 半边的配置载荷。
 * @param config - 宿主侧已校验的配置。
 */
export function buildClientConfig(config) {
  return {
    targetUrl: config.targetUrl,
    buttonLabel: config.buttonLabel,
    openIn: config.openIn,
  }
}

/**
 * 插件主体。
 * @param ctx - 插件上下文（Cordis Context）。
 * @param config - 已按 Config schema 校验过的配置。
 */
export function apply(ctx, config) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    ctx.logger.info(`[${name}] 当前 profile 没有 webServer，使用 client 半边内置默认配置`)
    return
  }
  // 配置路由：client 半边读不到宿主的 Config，所以用一条路由把它递过去。
  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: CONFIG_ROUTE,
      handler: (_req, res) => {
        const body = JSON.stringify(buildClientConfig(config))
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'Cache-Control': 'no-store',
        })
        res.end(body)
      },
    }),
  )
  const modeLabel = config.openIn === 'same-tab' ? '当前页跳转' : '系统浏览器打开'
  ctx.logger.info(`[${name}] 已就绪：按钮「${config.buttonLabel}」→ ${modeLabel} ${config.targetUrl}`)
}
