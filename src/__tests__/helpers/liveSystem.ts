/**
 * 集成测试离线守卫：BW_BASE_URL 未设置（CI / 新人 clone）时，
 * 需要真实系统的套件整组跳过；纯 XML 单测不受影响照常运行。
 * 背景：ci.yml 注释 "until a skip-if-unset guard lands in the suites"。
 */
export const LIVE = Boolean(process.env.BW_BASE_URL)

export function describeLive(name: string, fn: () => void): void {
  ;(LIVE ? describe : describe.skip)(name, fn)
}

export const testLive: typeof test = LIVE ? test : test.skip
