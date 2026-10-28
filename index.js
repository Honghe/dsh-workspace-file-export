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
      const headers = {
        'content-type': 'application/octet-stream',
        'content-length': String(info.size),
        'content-disposition':
          `attachment; filename="${filename.replaceAll('"', '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'no-store',
      }
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
      return new Response(Readable.toWeb(createReadStream(target)), { status: 200, headers })
    },
  })
}
