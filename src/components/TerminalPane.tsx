import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TerminalSession } from '../../shared/types';
import { xtermTheme, type ThemeTokens } from '../../shared/theme';
import { valet } from '../state/store';

function suffixPrefixLength(buffer: string, pending: string): number {
  const max = Math.min(buffer.length, pending.length);
  for (let length = max; length > 0; length -= 1) {
    if (buffer.endsWith(pending.slice(0, length))) return length;
  }
  return 0;
}

export function TerminalPane({
  session,
  active,
  tokens,
}: {
  session: TerminalSession;
  active: boolean;
  tokens: ThemeTokens;
}): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 14,
      lineHeight: 1.3,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 8_000,
      theme: xtermTheme(tokens),
      allowProposedApi: false,
      macOptionIsMeta: true,
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    const input = term.onData((data) => {
      try {
        valet().terminal.input(session.id, data);
      } catch {
        // The session may have closed between the keystroke and the write.
      }
    });

    // The native manager keeps the tail of each PTY. Replay it when the view
    // remounts so switching tabs does not discard the visible scrollback.
    let disposed = false;
    let replaying = true;
    let pending = '';
    const flushPending = (): void => {
      if (!pending) return;
      term.write(pending);
      pending = '';
    };
    void valet().terminal.buffer(session.id).then((buffer) => {
      if (disposed) return;
      if (buffer) {
        term.write(buffer);
        pending = pending.slice(suffixPrefixLength(buffer, pending));
      }
      replaying = false;
      flushPending();
    }).catch(() => {
      if (disposed) return;
      replaying = false;
      flushPending();
    });

    const removeData = valet().terminal.onData((event) => {
      if (event.id !== session.id) return;
      if (replaying) pending += event.data;
      else term.write(event.data);
    });
    const removeExit = valet().terminal.onExit((event) => {
      if (event.id !== session.id) return;
      term.write(`\r\n\x1b[2m[valet] session ended${event.code === null ? '' : ` (code ${event.code})`}\x1b[0m\r\n`);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!active) return;
      try {
        fit.fit();
      } catch {
        // The host can have zero size while a tab is hidden.
      }
    });
    resizeObserver.observe(host);

    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
      if (active) term.focus();
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      input.dispose();
      removeData();
      removeExit();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // A terminal instance belongs to one session for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = xtermTheme(tokens);
  }, [tokens]);

  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // ignore
      }
      termRef.current?.focus();
    });
  }, [active]);

  return (
    <div
      className={`terminal-pane${active ? ' is-active' : ''}`}
      onMouseDown={() => termRef.current?.focus()}
      aria-hidden={!active}
    >
      <div className="terminal-pane__host" ref={hostRef} />
    </div>
  );
}
