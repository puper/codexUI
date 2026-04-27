import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const CODEX_COMMAND_CONFIG_FILE = 'webui-runtime.json'

type RuntimeConfig = {
  codexCommand?: unknown
}

function getCodexHomeDir(): string {
  const codexHome = process.env.CODEX_HOME?.trim()
  return codexHome && codexHome.length > 0 ? codexHome : join(homedir(), '.codex')
}

function getRuntimeConfigPath(): string {
  return join(getCodexHomeDir(), CODEX_COMMAND_CONFIG_FILE)
}

function normalizeCommand(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getConfiguredCodexCommand(): string {
  const envCommand = normalizeCommand(process.env.CODEXUI_CODEX_COMMAND)
  if (envCommand) return envCommand

  const configPath = getRuntimeConfigPath()
  if (!existsSync(configPath)) return ''

  try {
    const payload = JSON.parse(readFileSync(configPath, 'utf8')) as RuntimeConfig
    return normalizeCommand(payload.codexCommand)
  } catch {
    return ''
  }
}

export function persistConfiguredCodexCommand(command: string): void {
  const normalized = normalizeCommand(command)
  if (!normalized) {
    throw new Error('Codex command path is required')
  }

  const configPath = getRuntimeConfigPath()
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify({ codexCommand: normalized }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}
