/**
 * withWriteSession —— 建模域写序列的唯一实现（VERIFIED_APIS §2 已核实会话模型）：
 *   lock(stateful) → transport 解析(stateless) → PUT(stateless)
 *   → activate(stateless, 可选) → unlock(stateful, finally 兜底)
 * 域只提供步骤闭包（适配各自的 lockHandle/corrNr/timestamp 参数形状）；
 * 顺序、finally 解锁、transport 解析、autoActivate 分支只在此维护。
 * 仅 kind=modeling 的域接入本引擎（见 domain-taxonomy 提案笔记）；
 * 新增建模域的写编排不得再手写本序列（见 AGENTS.md Invariants）。
 */
import type { AdtHTTP } from "../AdtHTTP"

export interface WriteSessionLock {
  lockHandle: string
  corrNr?: string
}

export interface WriteSessionStepIO {
  lockHandle: string
  corrNr?: string
  timestamp?: string
}

export interface WriteSessionSteps<L extends WriteSessionLock = WriteSessionLock, U = unknown, A = unknown> {
  lock(client: AdtHTTP): Promise<L>
  update(client: AdtHTTP, xml: string, io: WriteSessionStepIO): Promise<U>
  activate?(client: AdtHTTP, lockHandle: string, corrNr?: string): Promise<A>
  unlock(client: AdtHTTP): Promise<void>
}

export interface WriteSessionOptions {
  /** transportCheck 目标 URI（active 版本，通常以 /m 结尾） */
  uri: string
  xml: string
  autoActivate?: boolean
  timestamp?: string
  transport?: string
  createTransport?: boolean
  transportDescription?: string
}

export interface WriteSessionResult<U = unknown, A = unknown> {
  lockHandle: string
  transport?: string
  updateResult: U
  activated: boolean
  activateResult?: A
}

export type TransportResolver = (
  client: AdtHTTP,
  uri: string,
  opts: {
    transport?: string
    lockCorrNr?: string
    createTransport?: boolean
    transportDescription?: string
  },
) => Promise<string | undefined>

export async function withWriteSession<L extends WriteSessionLock, U, A>(
  client: AdtHTTP,
  steps: WriteSessionSteps<L, U, A>,
  options: WriteSessionOptions,
  transportResolver?: TransportResolver,
): Promise<WriteSessionResult<U, A>> {
  const { resolveTransportForWrite }: { resolveTransportForWrite: TransportResolver } =
    await import("./transport")
  const resolve = transportResolver ?? resolveTransportForWrite

  const lockResult = await steps.lock(client)
  try {
    const transport = await resolve(client, options.uri, {
      transport: options.transport,
      lockCorrNr: lockResult.corrNr,
      createTransport: options.createTransport,
      transportDescription: options.transportDescription || "API update",
    })

    const updateResult = await steps.update(client, options.xml, {
      lockHandle: lockResult.lockHandle,
      corrNr: transport,
      timestamp: options.timestamp,
    })

    let activateResult: A | undefined
    const shouldActivate = (options.autoActivate ?? true) && Boolean(steps.activate)
    if (shouldActivate && steps.activate) {
      activateResult = await steps.activate(client, lockResult.lockHandle, transport)
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport,
      updateResult,
      activated: shouldActivate,
      activateResult,
    }
  } finally {
    await steps.unlock(client)
  }
}
