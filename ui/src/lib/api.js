export async function api(path, opts = {}) {
  const r = await fetch(path, {
    credentials: 'include',
    ...opts,
  })
  const text = await r.text()
  let data = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { ok: r.ok, status: r.status, data }
}
