// Port — Logger

export interface Logger {
  debug(input: Record<string, unknown>): void;
  info(message: string): void;
  error(message: string, err?: unknown): void;
}