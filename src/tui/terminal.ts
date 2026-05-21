export const ALT_SCREEN_ENTER = "\x1b[?1049h\x1b[H";
export const ALT_SCREEN_EXIT = "\x1b[?1049l";

export interface TerminalDimensions {
  columns: number;
  rows: number;
}

export interface TerminalOutput {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
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
