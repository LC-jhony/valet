import { EventEmitter } from 'node:events';
import { DEFAULT_API_BASE } from '../shared/engine';
import type { LogEvent } from '../shared/api';

const UNIT = /^lerd-[a-z0-9-]+$/;

/**
 * Streams the engine's SSE log endpoints through the main process. The
 * renderer never opens a cross-origin connection to the engine.
 */
export class LogStreamer extends EventEmitter {
  private controller: AbortController | null = null;
  private unit: string | null = null;

  async start(unit: string, apiBase = DEFAULT_API_BASE): Promise<void> {
    if (!UNIT.test(unit)) throw new Error('logs: invalid unit');
    this.stop();
    this.unit = unit;
    const controller = new AbortController();
    this.controller = controller;
    let response: Response;
    try {
      response = await fetch(`${apiBase}/api/logs/${unit}`, {
        headers: { accept: 'text/event-stream' },
        signal: controller.signal,
      });
    } catch (err) {
      this.emit('error', { message: err instanceof Error ? err.message : String(err) });
      return;
    }
    if (!response.ok || !response.body) {
      this.emit('error', { message: `logs: engine returned ${response.status}` });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const blocks = pending.split('\n\n');
          pending = blocks.pop() ?? '';
          for (const block of blocks) {
            for (const line of block.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const text = line.slice(5).trimStart();
              if (text) this.emit('data', { unit, line: text } satisfies LogEvent);
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          this.emit('error', { message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
  }

  stop(): void {
    this.controller?.abort();
    this.controller = null;
    this.unit = null;
  }

  current(): string | null {
    return this.unit;
  }
}
