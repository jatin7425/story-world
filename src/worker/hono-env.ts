import type { Env } from "./types";
import type { Container } from "./container";

export type AppEnv = { Bindings: Env; Variables: { services: Container } };
