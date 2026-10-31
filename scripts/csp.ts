import type { Plugin } from 'vite'

// The meta policy applies only to the page; service workers and Workbox need a CSP header (#222).
export const policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://api.cotl.info; font-src 'self'; connect-src 'self' https://api.cotl.info; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"

export const csp = (): Plugin => ({
  name: 'save-privacy',
  apply: 'build',
  transformIndexHtml: html => html.replace(/(<meta charset="[^"]+"\s*\/?>)/i,
    `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
})
