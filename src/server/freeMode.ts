export type WireApi = 'responses' | 'chat'

export const FREE_MODE_STATE_FILE = 'webui-free-mode.json'
export const CUSTOM_PROVIDER_ID = 'custom-endpoint'

export interface FreeModeState {
  enabled: boolean
  apiKey: string | null
  model: string
  customKey?: boolean
  provider?: 'custom'
  customBaseUrl?: string
  wireApi?: WireApi
  providerKeys?: Record<string, string>
}

export function getFreeModeEnvVars(state: FreeModeState): Record<string, string> {
  if (!state.enabled || state.provider !== 'custom' || !state.customBaseUrl || !state.apiKey) {
    return {}
  }

  return { CUSTOM_ENDPOINT_API_KEY: state.apiKey }
}

export function getFreeModeConfigArgs(state: FreeModeState, serverPort?: number): string[] {
  if (!state.enabled || state.provider !== 'custom' || !state.customBaseUrl) return []

  const baseUrl = serverPort
    ? `http://127.0.0.1:${serverPort}/codex-api/custom-proxy/v1`
    : state.customBaseUrl
  const wireApi = serverPort ? 'responses' : (state.wireApi || 'responses')
  const authArgs: string[] = serverPort
    ? ['-c', `model_providers.${CUSTOM_PROVIDER_ID}.experimental_bearer_token="custom-proxy-token"`]
    : ['-c', `model_providers.${CUSTOM_PROVIDER_ID}.env_key="CUSTOM_ENDPOINT_API_KEY"`]
  const modelArgs: string[] = state.model?.trim()
    ? ['-c', `model="${state.model.trim()}"`]
    : []

  return [
    ...modelArgs,
    '-c', `model_provider="${CUSTOM_PROVIDER_ID}"`,
    '-c', `model_providers.${CUSTOM_PROVIDER_ID}.name="Custom Endpoint"`,
    '-c', `model_providers.${CUSTOM_PROVIDER_ID}.base_url="${baseUrl}"`,
    '-c', `model_providers.${CUSTOM_PROVIDER_ID}.wire_api="${wireApi}"`,
    ...authArgs,
  ]
}
