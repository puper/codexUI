import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { homedir, networkInterfaces } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Command } from 'commander'
import {
  canRunCommand,
  resolveCodexCommand,
} from '../commandResolution.js'
import { persistConfiguredCodexCommand } from '../codexCommandConfig.js'
import {
  parseApprovalPolicy,
  parseSandboxMode,
  resolveAppServerRuntimeConfig,
} from '../server/appServerRuntimeConfig.js'
import { createServer as createApp } from '../server/httpServer.js'
import { spawnSyncCommand } from '../utils/commandInvocation.js'

const program = new Command().name('codexui').description('Web interface for Codex app-server')
const __dirname = dirname(fileURLToPath(import.meta.url))

function getCodexHomePath(): string {
  return process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
}

async function readCliVersion(): Promise<string> {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const raw = await readFile(packageJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function isTermuxRuntime(): boolean {
  return Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('/com.termux/'))
}

function runOrFail(command: string, args: string[], label: string): void {
  const result = spawnSyncCommand(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status ?? -1)}`)
  }
}

function hasCodexAuth(): boolean {
  const codexHome = getCodexHomePath()
  return existsSync(join(codexHome, 'auth.json'))
}

function generateAuthToken(): string {
  return randomBytes(24).toString('hex')
}

function resolveAuthToken(input?: string): string {
  const cliToken = input?.trim() ?? ''
  if (cliToken) return cliToken
  const envToken = process.env.CODEXUI_AUTH_TOKEN?.trim() ?? ''
  if (envToken) return envToken
  return generateAuthToken()
}

function printTermuxKeepAlive(lines: string[]): void {
  if (!isTermuxRuntime()) {
    return
  }
  lines.push('')
  lines.push('  Android/Termux keep-alive:')
  lines.push('  1) Keep this Termux session open (do not swipe it away).')
  lines.push('  2) Disable battery optimization for Termux in Android settings.')
  lines.push('  3) Optional: run `termux-wake-lock` in another shell.')
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin'
    ? { cmd: 'open', args: [url] }
    : process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', url] }
      : { cmd: 'xdg-open', args: [url] }

  const child = spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

function parseListenHosts(input: string): string[] {
  const raw = input.trim() || '0.0.0.0'
  const hosts = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const unique: string[] = []
  for (const host of hosts.length > 0 ? hosts : ['0.0.0.0']) {
    if (!unique.includes(host)) unique.push(host)
  }
  return unique
}

function formatHostForUrl(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function getAccessibleUrlsForHost(port: number, host: string): string[] {
  const normalizedHost = host.trim() || '0.0.0.0'
  const urls = new Set<string>()
  if (normalizedHost === '0.0.0.0' || normalizedHost === '::') {
    urls.add(`http://localhost:${String(port)}`)
  } else if (isLocalHost(normalizedHost)) {
    urls.add(`http://localhost:${String(port)}`)
    return Array.from(urls)
  } else {
    urls.add(`http://${formatHostForUrl(normalizedHost)}:${String(port)}`)
    return Array.from(urls)
  }
  try {
    const interfaces = networkInterfaces()
    for (const entries of Object.values(interfaces)) {
      if (!entries) {
        continue
      }
      for (const entry of entries) {
        if (entry.internal) {
          continue
        }
        if (entry.family === 'IPv4') {
          urls.add(`http://${entry.address}:${String(port)}`)
        }
      }
    }
  } catch {}
  return Array.from(urls)
}

function getAccessibleUrls(port: number, hosts: string[]): string[] {
  const urls = new Set<string>()
  for (const host of hosts) {
    for (const url of getAccessibleUrlsForHost(port, host)) {
      urls.add(url)
    }
  }
  return Array.from(urls)
}

function closeServers(servers: Array<ReturnType<typeof createServer>>): Promise<void> {
  return Promise.all(servers.map((server) => new Promise<void>((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(() => resolve())
  }))).then(() => undefined)
}

function listenOnce(server: ReturnType<typeof createServer>, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

async function listenWithFallback(options: {
  app: ReturnType<typeof createApp>['app']
  attachWebSocket: ReturnType<typeof createApp>['attachWebSocket']
  hosts: string[]
  startPort: number
}): Promise<{ port: number, servers: Array<ReturnType<typeof createServer>> }> {
  let port = options.startPort
  for (;;) {
    const servers: Array<ReturnType<typeof createServer>> = []
    try {
      for (const host of options.hosts) {
        const server = createServer(options.app)
        options.attachWebSocket(server)
        servers.push(server)
        await listenOnce(server, port, host)
      }
      return { port, servers }
    } catch (error) {
      await closeServers(servers)
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EADDRINUSE' || code === 'EACCES') {
        port += 1
        continue
      }
      throw error
    }
  }
}

function splitAccessUrls(urls: string[]): { local: string[], network: string[] } {
  const local: string[] = []
  const network: string[] = []
  for (const url of urls) {
    let hostname = ''
    try {
      hostname = new URL(url).hostname
    } catch {
      hostname = ''
    }
    if (isLocalHost(hostname)) {
      local.push(url)
    } else {
      network.push(url)
    }
  }
  return { local, network }
}

function describeBindHosts(hosts: string[], port: number): string[] {
  return hosts.map((host) => `http://${formatHostForUrl(host)}:${String(port)}`)
}

function closeServersAndExit(servers: Array<ReturnType<typeof createServer>>, dispose: () => void, exitCode: number): void {
  void closeServers(servers).finally(() => {
    dispose()
    process.exit(exitCode)
  })
}

function getCodexGlobalStatePath(): string {
  const codexHome = getCodexHomePath()
  return join(codexHome, '.codex-global-state.json')
}

function normalizeUniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const next: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || next.includes(trimmed)) continue
    next.push(trimmed)
  }
  return next
}

async function persistLaunchProject(projectPath: string): Promise<void> {
  const trimmed = projectPath.trim()
  if (!trimmed) return
  const normalizedPath = isAbsolute(trimmed) ? trimmed : resolve(trimmed)
  const directoryInfo = await stat(normalizedPath)
  if (!directoryInfo.isDirectory()) {
    throw new Error(`Not a directory: ${normalizedPath}`)
  }

  const statePath = getCodexGlobalStatePath()
  let payload: Record<string, unknown> = {}
  try {
    const raw = await readFile(statePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>
    }
  } catch {
    payload = {}
  }

  const roots = normalizeUniqueStrings(payload['electron-saved-workspace-roots'])
  const activeRoots = normalizeUniqueStrings(payload['active-workspace-roots'])
  payload['electron-saved-workspace-roots'] = [
    normalizedPath,
    ...roots.filter((value) => value !== normalizedPath),
  ]
  payload['active-workspace-roots'] = [
    normalizedPath,
    ...activeRoots.filter((value) => value !== normalizedPath),
  ]
  await writeFile(statePath, JSON.stringify(payload), 'utf8')
}

async function addProjectOnly(projectPath: string): Promise<void> {
  const trimmed = projectPath.trim()
  if (!trimmed) {
    throw new Error('Missing project path')
  }
  await persistLaunchProject(trimmed)
}

async function startServer(options: {
  host: string
  port: string
  authToken?: string
  open: boolean
  login: boolean
  codexCommand?: string
  sandboxMode?: string
  approvalPolicy?: string
  projectPath?: string
}) {
  const version = await readCliVersion()
  const projectPath = options.projectPath?.trim() ?? ''
  if (projectPath.length > 0) {
    try {
      await persistLaunchProject(projectPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`\n[project] Could not open launch project: ${message}\n`)
    }
  }
  const configuredCodexCommand = options.codexCommand?.trim() ?? ''
  if (configuredCodexCommand) {
    if (!canRunCommand(configuredCodexCommand, ['--version'])) {
      throw new Error(`Configured Codex command is not runnable: ${configuredCodexCommand}`)
    }
    persistConfiguredCodexCommand(configuredCodexCommand)
    process.env.CODEXUI_CODEX_COMMAND = configuredCodexCommand
  }
  const codexCommand = configuredCodexCommand || resolveCodexCommand()
  if (codexCommand) {
    process.env.CODEXUI_CODEX_COMMAND = codexCommand
  }
  if (options.sandboxMode) {
    process.env.CODEXUI_SANDBOX_MODE = options.sandboxMode
  }
  if (options.approvalPolicy) {
    process.env.CODEXUI_APPROVAL_POLICY = options.approvalPolicy
  }
  const runtimeConfig = resolveAppServerRuntimeConfig()
  if (options.login && !hasCodexAuth()) {
    console.log('\nCodex is not logged in. You can log in later via settings or run `codexui login`.\n')
  }
  const requestedPort = parseInt(options.port, 10)
  const hosts = parseListenHosts(options.host)
  const authToken = resolveAuthToken(options.authToken)
  const { app, dispose, attachWebSocket } = createApp({ authToken })
  const { port, servers } = await listenWithFallback({
    app,
    attachWebSocket,
    hosts,
    startPort: requestedPort,
  })

  const lines = [
    '',
    'Codex Web Local is running!',
    `  Version:  ${version}`,
    '  GitHub:   https://github.com/puper/codexUI',
    '',
    `  Bind:     ${describeBindHosts(hosts, port).join(', ')}`,
    `  Codex sandbox: ${runtimeConfig.sandboxMode}`,
    `  Approval policy: ${runtimeConfig.approvalPolicy}`,
  ]
  const accessUrls = getAccessibleUrls(port, hosts)
  const splitUrls = splitAccessUrls(accessUrls)
  for (const localUrl of splitUrls.local) {
    lines.push(`  Local:    ${localUrl}`)
  }
  for (const networkUrl of splitUrls.network) {
    lines.push(`  Network:  ${networkUrl}`)
  }

  if (port !== requestedPort) {
    lines.push(`  Requested port ${String(requestedPort)} was unavailable; using ${String(port)}.`)
  }

  lines.push(`  Auth token: ${authToken}`)

  printTermuxKeepAlive(lines)
  lines.push('')
  console.log(lines.join('\n'))
  if (options.open) openBrowser(accessUrls[0] ?? `http://${formatHostForUrl(hosts[0] ?? '127.0.0.1')}:${String(port)}`)

  function shutdown() {
    console.log('\nShutting down...')
    closeServersAndExit(servers, dispose, 0)
    // Force exit after timeout
    setTimeout(() => {
      dispose()
      process.exit(1)
    }, 5000).unref()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function runLogin() {
  const codexCommand = resolveCodexCommand()
  if (!codexCommand) {
    throw new Error('Codex CLI is not available. Install @openai/codex or set CODEXUI_CODEX_COMMAND.')
  }
  process.env.CODEXUI_CODEX_COMMAND = codexCommand
  console.log('\nStarting `codex login`...\n')
  runOrFail(codexCommand, ['login'], 'Codex login')
}

program
  .argument('[projectPath]', 'project directory to open on launch')
  .option('--open-project <path>', 'open project directory on launch (Codex desktop parity)')
  .option('--host <host>', 'host or comma-separated hosts to listen on', '0.0.0.0')
  .option('-p, --port <port>', 'port to listen on', '5900')
  .option('--auth-token <token>', 'set the bearer token required by the web UI and API')
  .option('--open', 'open browser on startup', true)
  .option('--no-open', 'do not open browser on startup')
  .option('--login', 'run automatic Codex login bootstrap', true)
  .option('--no-login', 'skip automatic Codex login bootstrap')
  .option('--sandbox-mode <mode>', 'Codex sandbox mode: read-only, workspace-write, danger-full-access')
  .option('--approval-policy <policy>', 'Codex approval policy: untrusted, on-failure, on-request, never')
  .option('--codex-command <path>', 'path to the Codex CLI executable used to run app-server')
  .action(async (
    projectPath: string | undefined,
    opts: {
      port: string
      host: string
      authToken?: string
      open: boolean
      login: boolean
      codexCommand?: string
      sandboxMode?: string
      approvalPolicy?: string
      openProject?: string
    },
  ) => {
    const rawArgv = process.argv.slice(2)
    const openProjectFlagIndex = rawArgv.findIndex((arg) => arg === '--open-project' || arg.startsWith('--open-project='))

    let openProjectOnly = (opts.openProject ?? '').trim()
    if (!openProjectOnly && openProjectFlagIndex >= 0 && projectPath?.trim()) {
      // Commander may map "--open-project ." to the positional arg in this command layout.
      openProjectOnly = projectPath.trim()
    }
    if (openProjectOnly.length > 0) {
      await addProjectOnly(openProjectOnly)
      console.log(`Added project: ${openProjectOnly}`)
      return
    }

    const launchProject = (projectPath ?? '').trim()
    if (opts.sandboxMode) {
      const parsedSandboxMode = parseSandboxMode(opts.sandboxMode)
      if (!parsedSandboxMode) {
        throw new Error(`Invalid sandbox mode: ${opts.sandboxMode}`)
      }
      opts.sandboxMode = parsedSandboxMode
    }
    if (opts.approvalPolicy) {
      const parsedApprovalPolicy = parseApprovalPolicy(opts.approvalPolicy)
      if (!parsedApprovalPolicy) {
        throw new Error(`Invalid approval policy: ${opts.approvalPolicy}`)
      }
      opts.approvalPolicy = parsedApprovalPolicy
    }
    await startServer({ ...opts, projectPath: launchProject })
  })

program.command('login').description('Install/check Codex CLI and run `codex login`').action(runLogin)

program.command('help').description('Show codexui command help').action(() => {
  program.outputHelp()
})

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nFailed to run codexui: ${message}`)
  process.exit(1)
})
