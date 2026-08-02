import { store } from "../../store/store";
import { createAena } from "./aena";
import { createAeroDataBox } from "./aerodatabox";
import { createAviationStack } from "./aviationstack";
import { createDemoProvider } from "./demo";
import { normalizeFlightNumber } from "./types";
import type { FlightProvider } from "./types";

const aena = createAena(() => store.getSnapshot().settings.aenaProxyUrl);
const aeroDataBox = createAeroDataBox(
  () => store.getSnapshot().settings.aeroDataBoxKey,
);
const aviationStack = createAviationStack(
  () => store.getSnapshot().settings.aviationStackKey,
);
const demo = createDemoProvider((flightNumber, date) => {
  const client = store
    .getSnapshot()
    .clients.find(
      (c) =>
        c.date === date &&
        normalizeFlightNumber(c.flightNumber ?? "") === flightNumber,
    );
  return client?.time ?? null;
});

const providers: Record<string, FlightProvider> = {
  aena,
  aerodatabox: aeroDataBox,
  aviationstack: aviationStack,
  demo,
};

/** The provider selected in Settings, or null when tracking is off. */
export function activeProvider(): FlightProvider | null {
  const id = store.getSnapshot().settings.flightProvider;
  const provider = providers[id];
  return provider && provider.isConfigured() ? provider : null;
}

export { normalizeFlightNumber };
export type { FlightProvider };
