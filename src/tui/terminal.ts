import { Writable } from "node:stream";

export const ALT_SCREEN_ENTER = "\x1b[?1049h\x1b[H";
export const ALT_SCREEN_EXIT = "\x1b[?1049l";
export const INK_CLEAR_TERMINAL = "\x1b[2J\x1b[3J\x1b[H";

const ERASE_LINE = "\x1b[2K";
const CURSOR_UP_ONE = "\x1b[1A";
const CURSOR_COLUMN_ONE = "\x1b[G";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

export interface TerminalDimensions {
  columns: number;
  rows: number;
}

export interface TerminalOutput {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  on?(event: "resize", listener: () => void): unknown;
  off?(event: "resize", listener: () => void): unknown;
  write(chunk: string): unknown;
}

export function getTerminalDimensions(stdout: Pick<TerminalOutput, "columns" | "rows"> = process.stdout): TerminalDimensions {
  return {
    columns: Math.max(20, stdout.columns ?? 80),
    rows: Math.max(10, stdout.rows ?? 24)
  };
}

export function enterAlternateScreen(stdout: TerminalOutput = process.stdout): () => void {
  if (!stdout.isTTY) {
    return () => undefined;
  }

  let active = true;
  stdout.write(ALT_SCREEN_ENTER);

  return () => {
    if (!active) {
      return;
    }

    active = false;
    stdout.write(ALT_SCREEN_EXIT);
  };
}

function cursorTo(row: number): string {
  return `\x1b[${row};1H`;
}

function replaceAll(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

class DiffingTerminalOutput extends Writable {
  private previousLines: string[] = [];

  constructor(private readonly target: TerminalOutput) {
    super();
  }

  get columns(): number | undefined {
    return this.target.columns;
  }

  get rows(): number | undefined {
    return this.target.rows;
  }

  get isTTY(): boolean | undefined {
    return this.target.isTTY;
  }

  on(event: "resize", listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === "resize" && this.target.on) {
      this.target.on(event, listener as () => void);
      return this;
    }

    return super.on(event, listener);
  }

  off(event: "resize", listener: () => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === "resize" && this.target.off) {
      this.target.off(event, listener as () => void);
      return this;
    }

    return super.off(event, listener);
  }

  _write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      this.writeDiff(String(chunk));
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private writeDiff(chunk: string): void {
    let frame = chunk;
    if (frame.includes(CURSOR_HIDE)) {
      this.target.write(CURSOR_HIDE);
      frame = replaceAll(frame, CURSOR_HIDE, "");
    }

    if (frame.includes(CURSOR_SHOW)) {
      this.target.write(CURSOR_SHOW);
      frame = replaceAll(frame, CURSOR_SHOW, "");
    }

    const cameFromLogUpdate =
      frame.includes(ERASE_LINE) || frame.includes(CURSOR_UP_ONE) || frame.includes(CURSOR_COLUMN_ONE);

    frame = replaceAll(frame, INK_CLEAR_TERMINAL, "");
    frame = replaceAll(frame, ERASE_LINE, "");
    frame = replaceAll(frame, CURSOR_UP_ONE, "");
    frame = replaceAll(frame, CURSOR_COLUMN_ONE, "");

    if (cameFromLogUpdate && frame.endsWith("\n")) {
      frame = frame.slice(0, -1);
    }

    if (!frame) {
      return;
    }

    const nextLines = frame.split("\n");
    const rowCount = Math.min(Math.max(this.previousLines.length, nextLines.length), this.rows ?? nextLines.length);

    for (let row = 0; row < rowCount; row += 1) {
      const nextLine = nextLines[row] ?? "";
      if (this.previousLines[row] === nextLine) {
        continue;
      }

      this.target.write(`${cursorTo(row + 1)}${ERASE_LINE}${nextLine}`);
    }

    this.previousLines = nextLines;
  }
}

export function createDiffingTerminalOutput(stdout: TerminalOutput = process.stdout): NodeJS.WriteStream {
  if (!stdout.isTTY) {
    return stdout as NodeJS.WriteStream;
  }

  return new DiffingTerminalOutput(stdout) as unknown as NodeJS.WriteStream;
}
