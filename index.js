// dsh-workspace-file-export — authenticated download limited to registered workspaces.
//
// GET /api/workspace-download?path=<绝对路径>
//   200 流式下载 (Content-Disposition: attachment)
//   400 缺少/非法参数 (path 必须是绝对路径; Client 总是发送 absolutePath)
//   403 解析结果不在任何已注册 workspace 的 canonical 根内 (含符号链接逃逸)
//   404 文件不存在或不是普通文件
//
// 路由注册在 connection 的认证栅栏内: 未通过 dsh 登录的请求到不了这里。
//
// 允许范围 = 任一已注册 workspace 的 canonical 根.
// 注意: workspace 注册表是"项目列表"而非权限边界, 且 HTTP 连接没有会话身份,
// 因此本路由防的是任意路径读取, 不校验"请求属于哪个已注册工作区"的会话绑定;
// 真正的会话级隔离需要请求级身份 (例如携带 session 并由 Host 校验), 不在本插件范围.

import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { sep, basename, isAbsolute } from 'node:path'
import { Readable } from 'node:stream'

export const name = 'workspace-file-export'
export const inject = ['connection', 'workspaceRegistry']

/**
 * RFC 5987 `attr-char`: encodeURIComponent 会残留 `' ( ) *`，它们在
 * filename* 的值里非法，需要额外百分号编码。
 */
function encodeRfc5987(value) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function apply(ctx) {
  ctx.connection.fetch.register({
    path: '/api/workspace-download',
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const params = new URL(request.url).searchParams
      const rel = params.get('path')
      if (!rel) return new Response('missing "path" query parameter', { status: 400 })
      if (!isAbsolute(rel)) return new Response('"path" must be an absolute path', { status: 400 })

      let target
      try {
        target = await realpath(rel)
      } catch {
        return new Response('not found', { status: 404 })
      }

      // Registered workspace paths are canonical by construction (the registry's
      // realpath uniqueness canon); a request is served only inside one of them.
      const insideRegistered = ctx.workspaceRegistry.list().some((workspace) => {
        const root = workspace.path
        return target.startsWith(root.endsWith(sep) ? root : root + sep)
      })
      if (!insideRegistered) return new Response('outside registered workspaces', { status: 403 })

      const info = await stat(target)
      if (!info.isFile()) return new Response('not a regular file', { status: 404 })

      const filename = basename(target)
      // Header 值必须是 ByteString（每个字符 <= 0xFF）。把中文直接写进
      // filename="..." 会让 undici 的 new Response() 抛 TypeError，
      // 整个路由被 dsh 连接层转成 400（中文文件名下载失败的根因）。
      // 因此 filename 只保留可打印 ASCII 兜底，真正的 UTF-8 名字走 RFC 5987
      // 的 filename* 参数（浏览器优先使用它）。
      const asciiName = filename.replace(/[^ -~]/g, '_').replace(/["\\]/g, '_')
      const headers = {
        'content-type': 'application/octet-stream',
        'content-length': String(info.size),
        'content-disposition':
          `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987(filename)}`,
        'cache-control': 'no-store',
      }
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
      return new Response(Readable.toWeb(createReadStream(target)), { status: 200, headers })
    },
  })
}
