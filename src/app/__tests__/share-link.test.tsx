import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Home from "../page";
import {
  decodeGameState,
  encodeGameState,
  getShareMetadataFromSnapshot,
} from "../../lib/game/urlState";
import type { PlanetConfig } from "../../lib/game/gameState";

const homeworldConfig: PlanetConfig = {
  name: "Homeworld",
  startTurn: 1,
  abundance: {
    metal: 1,
    mineral: 1,
    food: 1,
    energy: 1,
    research_points: 1,
  },
  space: {
    groundCap: 60,
    orbitalCap: 40,
  },
};

function installClipboardMock() {
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

function getQueueItem(label: RegExp): HTMLElement {
  const item = screen
    .getAllByText(label)
    .map((element) => element.closest(".group"))
    .find(
      (candidate): candidate is HTMLElement => candidate instanceof HTMLElement,
    );

  if (!item) throw new Error(`Queue item not found: ${label}`);
  return item;
}

describe("share link flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installLocalStorageMock();
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
    installClipboardMock();
  });

  test("copies a fresh encoded link immediately when clicked", async () => {
    const writeText = installClipboardMock();
    render(<Home />);

    fireEvent.change(screen.getByLabelText(/shared list name/i), {
      target: { value: "Ada Opening" },
    });
    fireEvent.change(screen.getByLabelText(/author/i), {
      target: { value: "Ada" },
    });
    fireEvent.click(getQueueItem(/^Farm$/i));
    fireEvent.click(screen.getByRole("button", { name: /share link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copiedURL = writeText.mock.calls[0]?.[0] ?? "";
    const encoded = new URL(copiedURL).hash.substring(7);
    const snapshot = decodeGameState(encoded);

    expect(copiedURL).toContain("#state=");
    expect(snapshot?.cmds).toHaveLength(1);
    expect(
      snapshot ? getShareMetadataFromSnapshot(snapshot) : null,
    ).toMatchObject({
      name: "Ada Opening",
      author: "Ada",
    });
  });

  test("falls back to execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    render(<Home />);

    fireEvent.change(screen.getByLabelText(/shared list name/i), {
      target: { value: "Fallback Opening" },
    });
    fireEvent.change(screen.getByLabelText(/author/i), {
      target: { value: "Ada" },
    });
    fireEvent.click(getQueueItem(/^Farm$/i));
    fireEvent.click(screen.getByRole("button", { name: /share link/i }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(await screen.findByText(/Link copied/i)).toBeInTheDocument();
  });

  test("copies a debug state link with the current command history", async () => {
    const writeText = installClipboardMock();
    render(<Home />);

    fireEvent.click(getQueueItem(/^Farm$/i));
    fireEvent.click(screen.getByRole("button", { name: /copy debug state/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copiedURL = writeText.mock.calls[0]?.[0] ?? "";
    const encoded = new URL(copiedURL).hash.substring(7);
    const snapshot = decodeGameState(encoded);

    expect(copiedURL).toContain("#state=");
    expect(snapshot?.cmds).toHaveLength(1);
  });

  test("loads a shared build when the hash changes after mount", async () => {
    const commands: Parameters<typeof encodeGameState>[1] = [["q", 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: "Neighbor Tech Rush",
      author: "Lin",
      sharedAt: "2026-05-04T12:00:00.000Z",
    });
    render(<Home />);

    expect(screen.queryByText(/1 queued/i)).not.toBeInTheDocument();

    window.history.pushState(null, "", `/#state=${encoded}`);
    fireEvent(window, new Event("hashchange"));

    await screen.findByText(/1 queued/i);
    expect(screen.getByText("Shared list")).toBeInTheDocument();
    expect(screen.getByText("Neighbor Tech Rush")).toBeInTheDocument();
    expect(screen.getByText("by Lin")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit bl/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Add to Queue$/i)).not.toBeInTheDocument();
  });

  test("shared build preview shows all lanes before editing", async () => {
    const commands: Parameters<typeof encodeGameState>[1] = [
      ["q", 0, 11, 1],
      ["q", 0, 12, 5],
      ["qr", 50],
    ];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: "All Lanes Opener",
      author: "Lin",
      sharedAt: "2026-05-04T12:00:00.000Z",
    });
    window.history.replaceState(null, "", `/#state=${encoded}`);

    render(<Home />);

    await screen.findByRole("button", { name: /edit bl/i });
    expect(screen.getByRole("button", { name: /^exit$/i })).toBeInTheDocument();
    expect(screen.getByText("All Lanes Opener")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /structures/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ships/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /colonists/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /research/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("shared-lane-board")).toHaveClass(
      "xl:grid-cols-4",
    );
    const sharedLaneBoard = screen.getByTestId("shared-lane-board");
    expect(within(sharedLaneBoard).getByText("4T")).toBeInTheDocument();
    expect(within(sharedLaneBoard).queryByText("0T")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Add to Queue$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit bl/i }));

    expect(await screen.findByText(/^Add to Queue$/i)).toBeInTheDocument();
    expect(screen.getByText(/Planet Queue/i)).toBeInTheDocument();
  });

  test("exit discards a shared build preview and returns to a clean planner", async () => {
    const commands: Parameters<typeof encodeGameState>[1] = [["q", 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: "Disposable Preview",
      author: "Lin",
      sharedAt: "2026-05-04T12:00:00.000Z",
    });
    window.history.replaceState(null, "", `/#state=${encoded}`);

    render(<Home />);

    await screen.findByRole("button", { name: /^exit$/i });
    expect(screen.queryByText(/^Add to Queue$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^exit$/i }));

    expect(await screen.findByText(/^Add to Queue$/i)).toBeInTheDocument();
    expect(screen.queryByText("Disposable Preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/^1 queued$/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Shared list")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.localStorage.getItem("florent_save")).toBeNull();
  });

  test("local autosave with share metadata restores as editable local build", async () => {
    const commands: Parameters<typeof encodeGameState>[1] = [["q", 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: "Homeworld build list",
      author: "Henrik",
      sharedAt: "2026-05-04T12:00:00.000Z",
    });
    window.localStorage.setItem("florent_save", encoded);
    window.history.replaceState(null, "", "/");

    render(<Home />);

    await screen.findByText(/1 queued/i);
    expect(screen.getByText(/^Add to Queue$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit bl/i }),
    ).not.toBeInTheDocument();
  });

  test("clears the live build when the state hash is removed", async () => {
    const commands: Parameters<typeof encodeGameState>[1] = [["q", 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands);
    window.history.replaceState(null, "", `/#state=${encoded}`);
    window.localStorage.setItem("florent_save", encoded);

    render(<Home />);

    await screen.findByText(/1 queued/i);

    window.history.pushState(null, "", "/");
    fireEvent(window, new Event("hashchange"));

    await waitFor(() =>
      expect(screen.queryByText(/1 queued/i)).not.toBeInTheDocument(),
    );
    expect(window.location.hash).toBe("");
    expect(window.localStorage.getItem("florent_save")).toBeNull();
  });
});
