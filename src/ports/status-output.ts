// Port — Status output

export interface StatusOutput {
  write(summary: string): Promise<void>;
}