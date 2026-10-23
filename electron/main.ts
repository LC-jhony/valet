import { app, BrowserWindow, Menu, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../shared/config';
import { themeDefinition } from '../shared/themes';
import { registerIpc } from './ipc';
import { LogStreamer } from './logs';
import { TerminalManager } from './terminal';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const smoke = process.env.VALET_SMOKE === '1';
if (smoke) process.env.SHELL = '/bin/bash'; // Keep the test shell deterministic.
const smokeOut = process.env.VALET_SMOKE_OUT ?? path.join('/tmp/opencode', 'valet-smoke');
const config = loadConfig();

if (!app.isPackaged && !process.env.VALET_SANDBOX) {
  // Chromium's setuid sandbox helper is not installed in a development
  // checkout. Packaged builds keep the sandbox enabled.
  app.commandLine.appendSwitch('no-sandbox');
}

app.setName('VALET');
if (process.platform === 'win32') app.setAppUserModelId('sh.valet.desktop');

let mainWindow: BrowserWindow | null = null;
const terminal = new TerminalManager();
const logs = new LogStreamer();

function appUrl(): string {
  return process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../../renderer/index.html')}`;
}

function createWindow(): void {
  const dark = themeDefinition(config.theme)?.type !== 'light';
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'VALET',
    backgroundColor: dark ? '#1f1f1f' : '#ffffff',
    // Use the operating system's own frame and window controls. macOS keeps
    // its native traffic lights over the app toolbar; Windows and Linux get
    // their standard title bar.
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 12 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev || !app.isPackaged,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('window:maximized', false));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') void shell.openExternal(parsed.toString());
    } catch {
      // ignore malformed links
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // The workbench is a single page. Only the exact app URL may navigate.
    if (url !== appUrl()) event.preventDefault();
  });

  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev && !app.isPackaged) return;
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  terminal.removeAllListeners('data');
  terminal.removeAllListeners('exit');
  logs.removeAllListeners('data');
  logs.removeAllListeners('error');
  terminal.on('data', (payload) => mainWindow?.webContents.send('terminal:data', payload));
  terminal.on('exit', (payload) => mainWindow?.webContents.send('terminal:exit', payload));
  logs.on('data', (payload) => mainWindow?.webContents.send('logs:data', payload));
  logs.on('error', (payload) => mainWindow?.webContents.send('logs:error', payload));

  registerIpc({ window: mainWindow, terminal, logs });

  if (isDev) {
    void mainWindow.loadURL(appUrl());
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  if (smoke) void runSmoke(mainWindow);
}

async function runSmoke(window: BrowserWindow): Promise<void> {
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const evaluate = <T>(code: string): Promise<T> => window.webContents.executeJavaScript(code) as Promise<T>;
  const clickLabel = (label: string): Promise<boolean> => evaluate<boolean>(
    `(() => { const button = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!button) return false; button.click(); return true; })()`,
  );
  const clickText = (text: string): Promise<boolean> => evaluate<boolean>(
    `(() => { const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === ${JSON.stringify(text)}); if (!button) return false; button.click(); return true; })()`,
  );
  const terminalText = (): Promise<string> => evaluate<string>(
    "document.querySelector('.terminal-pane.is-active .xterm-rows')?.textContent ?? ''",
  );
  const waitFor = async <T>(label: string, read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 8_000): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!done(value) && Date.now() < deadline) {
      await wait(150);
      value = await read();
    }
    if (!done(value)) throw new Error(label);
    return value;
  };
  try {
    window.setAlwaysOnTop(true, 'screen-saver');
    window.moveTop();
    window.focus();
    fs.mkdirSync(smokeOut, { recursive: true });
    await wait(1800);
    const dark = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-min-dark.png'), dark.toPNG());
    await evaluate("window.dispatchEvent(new CustomEvent('valet:set-theme', { detail: 'min-light' }))");
    await wait(900);
    const light = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-min-light.png'), light.toPNG());

    await evaluate("window.dispatchEvent(new CustomEvent('valet:set-theme', { detail: 'carbon-dark' }))");
    await wait(500);
    const carbonDark = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-carbon-dark.png'), carbonDark.toPNG());

    await evaluate("window.dispatchEvent(new CustomEvent('valet:set-theme', { detail: 'carbon-light' }))");
    await wait(500);
    const carbonLight = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-carbon-light.png'), carbonLight.toPNG());

    await evaluate("window.dispatchEvent(new CustomEvent('valet:set-theme', { detail: 'min-dark' }))");
    await wait(400);
    if (!(await clickLabel('Settings'))) throw new Error('Settings navigation not found');
    const themeCards = await waitFor(
      'all bundled theme cards did not render',
      () => evaluate<string[]>("Array.from(document.querySelectorAll('.theme-card__meta > span:first-child')).map((node) => node.textContent ?? '')"),
      (names) => names.length === 4 && ['Min Dark', 'Min Light', 'Carbon Dark', 'Carbon Light'].every((name) => names.includes(name)),
    );
    if (themeCards.length !== 4) throw new Error('theme card count mismatch');
    await wait(600);
    const settings = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-settings-themes.png'), settings.toPNG());

    if (!(await clickLabel('Projects'))) throw new Error('Projects navigation not found after settings');
    await wait(500);
    const selected = await evaluate<boolean>(
      "(() => { const row = document.querySelector('table.data-table tbody tr'); if (!row) return false; row.click(); return true; })()",
    );
    if (!selected) throw new Error('project row not found');
    await wait(700);
    const detail = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-project-detail.png'), detail.toPNG());

    if (!(await clickLabel('Logs & diagnostics'))) throw new Error('Logs & diagnostics navigation not found');
    await wait(700);
    const layout = await evaluate<{ panel: boolean; xterm: number }>(
      "(() => ({ panel: Boolean(document.querySelector('.bottom-panel')), xterm: document.querySelectorAll('.xterm').length }))()",
    );
    if (layout.panel || layout.xterm !== 0) throw new Error('bottom panel or off-view xterm is still mounted');
    const logs = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-logs-diagnostics.png'), logs.toPNG());

    await waitFor(
      'Run doctor button did not become enabled',
      () => evaluate<{ found: boolean; disabled: boolean }>(
        "(() => { const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === 'Run doctor'); return { found: Boolean(button), disabled: Boolean(button?.disabled) }; })()",
      ),
      (state) => state.found && !state.disabled,
    );
    if (!(await clickText('Run doctor'))) throw new Error('Run doctor button not clickable');
    await waitFor(
      'engine output did not render',
      () => evaluate<{ tab: string; text: string }>(
        "(() => ({ tab: document.querySelector('.logs-tab.is-active')?.textContent ?? '', text: document.querySelector('.output-log')?.textContent ?? '' }))()",
      ),
      (state) => state.tab.includes('Engine output') && state.text.includes('Lerd Doctor'),
    );
    await wait(700);
    const outputShot = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-engine-output.png'), outputShot.toPNG());

    await evaluate("window.dispatchEvent(new CustomEvent('valet:set-theme', { detail: 'min-dark' }))");
    await wait(400);
    if (!(await clickLabel('Terminal'))) throw new Error('Terminal navigation not found');
    await wait(500);
    if (!(await clickText('New terminal'))) throw new Error('New terminal button not found');
    await waitFor(
      'terminal pane did not mount',
      () => evaluate<boolean>("Boolean(document.querySelector('.terminal-pane.is-active .xterm-helper-textarea'))"),
      Boolean,
    );
    await waitFor(
      'terminal prompt did not appear',
      terminalText,
      (text) => /[$#]\s*$/.test(text.trimEnd()),
      6_000,
    );
    await wait(200);
    await evaluate("document.querySelector('.terminal-pane.is-active .xterm-helper-textarea')?.focus()");
    const command = 'echo VALET_SMOKE_$((6*7))';
    window.webContents.insertText(command);
    await wait(150);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    await wait(800);
    let text = await terminalText();
    if (!text.includes('VALET_SMOKE_42')) {
      if (!text.includes('VALET_SMOKE_$((6*7))')) {
        await evaluate("document.querySelector('.terminal-pane.is-active .xterm-helper-textarea')?.focus()");
        window.webContents.insertText(command);
        await wait(150);
      }
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      await wait(1_000);
      text = await terminalText();
    }
    if (!text.includes('VALET_SMOKE_42')) throw new Error('terminal command did not produce expected output');

    if (!(await clickLabel('Projects'))) throw new Error('Projects navigation not found');
    await wait(500);
    if (!(await clickLabel('Terminal'))) throw new Error('Terminal navigation not found on return');
    const replayed = await waitFor(
      'terminal scrollback was not replayed',
      terminalText,
      (text) => text.includes('VALET_SMOKE_42'),
    );
    if (!replayed.includes('VALET_SMOKE_42')) throw new Error('terminal scrollback was not replayed');
    const terminalShot = await window.webContents.capturePage();
    fs.writeFileSync(path.join(smokeOut, 'valet-terminal.png'), terminalShot.toPNG());

    console.log(`[valet] smoke screenshots written to ${smokeOut}`);
  } catch (err) {
    console.error('[valet] smoke failed', err);
    process.exitCode = 1;
  } finally {
    window.setAlwaysOnTop(false);
    if (process.exitCode) app.exit(typeof process.exitCode === 'number' ? process.exitCode : 1);
    else app.quit();
  }
}

function installMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'VALET',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'clipboard-sanitized-write');
    });
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'clipboard-sanitized-write');
    installMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    terminal.killAll();
    logs.stop();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    terminal.killAll();
    logs.stop();
  });
}
