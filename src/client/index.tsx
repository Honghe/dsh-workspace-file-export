/**
 * dsh-workspace-file-export — Client (browser) module.
 *
 * One slot entry: a plain "Download" text link in the document preview
 * header (shown for every opened file, previewable or not). The link only
 * carries the file's absolute path; the Host route accepts it only inside a
 * registered workspace's canonical root.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createElement } from 'react'

export const inject = ['slots']

interface DownloadLinkProps {
  absolutePath: string
}

function DownloadLink(props: DownloadLinkProps) {
  const href = `/api/workspace-download?path=${encodeURIComponent(props.absolutePath)}`
  return createElement('a', {
    href,
    title: 'Download this file',
    style: { fontSize: '12px', color: 'inherit', textDecoration: 'none', cursor: 'pointer' },
  }, 'Download')
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register(
    { name: 'sidebar.right.tab.document.actions', id: 'workspace-file-export' },
    DownloadLink,
  ))
}
