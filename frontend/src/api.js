const API = import.meta.env.VITE_API_URL || ''
export async function api(path, options = {}) {
  const token = localStorage.getItem('quizy_token')
  const response = await fetch(`${API}/api${path}`, { ...options, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Не удалось связаться с сервером')
  return data
}
