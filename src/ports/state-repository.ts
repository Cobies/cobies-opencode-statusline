// Port — State repository

import type { StatuslineState } from "../domain/entities/statusline-state.js";

export interface StateRepository {
  load(): Promise<StatuslineState>;
  save(state: StatuslineState): Promise<void>;
}