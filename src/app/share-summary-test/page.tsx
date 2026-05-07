"use client";

import React from "react";
import { GameController } from "../../lib/game/commands";
import { createInitialGameState } from "../../lib/game/gameState";
import { getGlobalResearchLaneView } from "../../lib/game/globalResearch";
import { getLaneView, type LaneView } from "../../lib/game/selectors";
import {
  decodeGameState,
  getShareMetadataFromSnapshot,
  replayCommands,
} from "../../lib/game/urlState";
import type { LaneId } from "../../lib/sim/engine/types";
import type { MultiPlanetExportData } from "../../lib/export/formatters";
import {
  buildSharedBuildListSummary,
  SharedBuildListView,
} from "../../components/SharedBuildListView";

interface DecodedPreview {
  name: string;
  author: string;
  gameState: ReturnType<typeof createInitialGameState>;
  lanes: Record<LaneId, LaneView | null>;
  multiPlanetData: MultiPlanetExportData;
  defs: Record<string, any>;
}

export default function ShareSummaryTestPage() {
  const [input, setInput] = React.useState("");
  const [preview, setPreview] = React.useState<DecodedPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [metaDescription, setMetaDescription] = React.useState("");

  React.useEffect(() => {
    const encoded = extractEncodedShare(window.location.href);
    if (!encoded) return;
    setInput(window.location.href);
    loadPreview(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!preview) return;
    const id = window.setTimeout(() => {
      setMetaDescription(
        document.querySelector('meta[name="description"]')?.getAttribute("content") ??
          "",
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [preview]);

  const loadPreview = React.useCallback((encodedInput?: string) => {
    const encoded = encodedInput ?? extractEncodedShare(input);
    if (!encoded) {
      setError("Paste a share URL, #q= fragment, ?q= query, q4 payload, or b3 payload.");
      setPreview(null);
      return;
    }

    const snapshot = decodeGameState(encoded);
    if (!snapshot) {
      setError("The share payload could not be decoded.");
      setPreview(null);
      return;
    }

    const gameState = replayCommands(createInitialGameState(), snapshot.cmds);
    const currentPlanet =
      gameState.planets.get(gameState.currentPlanetId) ??
      Array.from(gameState.planets.values())[0] ??
      null;
    if (!currentPlanet) {
      setError("Decoded share has no planets.");
      setPreview(null);
      return;
    }

    const controller = new GameController(currentPlanet, currentPlanet.timeline);
    const endTurn = currentPlanet.startTurn + controller.getTotalTurns() - 1;
    const exportState = controller.getStateAtTurn(endTurn) ?? currentPlanet;
    const lanes: Record<LaneId, LaneView | null> = {
      building: getLaneView(exportState, "building"),
      ship: getLaneView(exportState, "ship"),
      colonist: getLaneView(exportState, "colonist"),
      research: getGlobalResearchLaneView(gameState, endTurn),
    };
    const multiPlanetData: MultiPlanetExportData = {
      planets: Array.from(gameState.planets.values()).map((planet) => {
        const planetController = new GameController(planet, planet.timeline);
        const planetEndTurn = planet.startTurn + planetController.getTotalTurns() - 1;
        const planetState = planetController.getStateAtTurn(planetEndTurn) ?? planet;
        return {
          id: planet.id,
          name: planet.name,
          startTurn: planet.startTurn,
          currentTurn: planet.currentTurn,
          lanes: [
            getLaneView(planetState, "building"),
            getLaneView(planetState, "ship"),
            getLaneView(planetState, "colonist"),
          ],
        };
      }),
      researchLane: getGlobalResearchLaneView(gameState, endTurn),
    };

    const metadata = getShareMetadataFromSnapshot(snapshot);
    setPreview({
      name: metadata?.name ?? "Shared build list",
      author: metadata?.author ?? "Unknown commander",
      gameState,
      lanes,
      multiPlanetData,
      defs: exportState.defs,
    });
    setError(null);
  }, [input]);

  const summary = preview
    ? buildSharedBuildListSummary({
        name: preview.name,
        planets: preview.gameState.planets,
        lanes: preview.lanes,
        multiPlanetData: preview.multiPlanetData,
      })
    : null;

  return (
    <main className="min-h-screen bg-pink-nebula-bg p-4 text-pink-nebula-text md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-cyan-200/20 bg-slate-950/70 p-4 shadow-xl">
          <h1 className="text-2xl font-black">Share summary localhost test</h1>
          <p className="mt-2 text-sm text-pink-nebula-muted">
            Paste a copied share link here, or open this page with ?q= followed by
            the compact payload. The decoded preview below updates the same page
            title and metadata used by shared build links.
          </p>
          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <input
              aria-label="Share URL or payload"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-200/60"
              placeholder="Paste http://localhost:3000/#q=..., #q=..., ?q=..., q4...., or b3...."
            />
            <button
              type="button"
              onClick={() => loadPreview()}
              className="rounded-xl border border-cyan-200/40 bg-cyan-300/15 px-4 py-2 text-sm font-black text-cyan-50 hover:bg-cyan-300/25"
            >
              Load Summary
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-orange-300">{error}</p>}
        </section>

        {summary && (
          <section className="rounded-2xl border border-cyan-200/20 bg-slate-950/70 p-4 shadow-xl">
            <h2 className="text-lg font-black">Generated page metadata</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-bold text-cyan-100">Document title</dt>
                <dd className="break-words font-mono text-pink-nebula-muted">
                  {typeof document === "undefined" ? "" : document.title}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-cyan-100">Meta description</dt>
                <dd className="break-words font-mono text-pink-nebula-muted">
                  {metaDescription || summary.description}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {preview && (
          <SharedBuildListView
            name={preview.name}
            author={preview.author}
            planets={preview.gameState.planets}
            currentPlanetId={preview.gameState.currentPlanetId}
            currentTurn={200}
            lanes={preview.lanes}
            multiPlanetData={preview.multiPlanetData}
            defs={preview.defs}
            onPlanetSelect={() => undefined}
            onExit={() => setPreview(null)}
            onEdit={() => undefined}
          />
        )}
      </div>
    </main>
  );
}

function extractEncodedShare(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  try {
    const url = new URL(input, window.location.origin);
    const queryQ = url.searchParams.get("q");
    if (queryQ) return queryQ.startsWith("q4.") ? queryQ : `q4.${queryQ}`;
    const queryState = url.searchParams.get("state");
    if (queryState) return queryState;
    return extractEncodedShare(url.hash);
  } catch {
    // Continue with raw payload parsing.
  }

  if (input.startsWith("#q=")) return `q4.${input.slice(3)}`;
  if (input.startsWith("q=")) return `q4.${input.slice(2)}`;
  if (input.startsWith("#state=")) return input.slice(7);
  if (input.startsWith("state=")) return input.slice(6);
  if (input.startsWith("q4.") || input.startsWith("b3.")) return input;
  return null;
}
