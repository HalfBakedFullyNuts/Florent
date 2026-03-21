"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { GameController } from './commands';
import { createInitialGameState, addPlanet, switchPlanet, type GameState } from './gameState';
import { loadStateFromURL, saveStateToURL, extractPlanetConfigs, CommandHistory, estimateEncodedSize } from './urlState';
import { type PlanetConfig } from '../../components/AddPlanetModal';
import { setupLogging } from './logging-utils';
import { type QueueValidationResult } from './validation';

interface GameStateContextValue {
    gameState: GameState;
    currentPlanetId: string;
    currentPlanet: any; // ExtendedPlanetState
    controller: GameController | null;
    viewTurn: number;
    setViewTurn: (turn: number | ((prev: number) => number)) => void;
    commandHistory: CommandHistory;
    error: string | null;
    setError: (error: string | null) => void;
    queueValidation: Map<string, QueueValidationResult>;
    setQueueValidation: React.Dispatch<React.SetStateAction<Map<string, QueueValidationResult>>>;

    // Actions
    handlePlanetSwitch: (planetId: string) => void;
    handleCreatePlanet: (config: PlanetConfig) => void;

    // Core state setters required for manual mutations in page.tsx
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function useGameState() {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameStateProvider');
    }
    return context;
}

interface GameStateProviderProps {
    children: ReactNode;
}

export function GameStateProvider({ children }: GameStateProviderProps) {
    useEffect(() => {
        setupLogging();
    }, []);

    const [commandHistory] = useState(() => new CommandHistory());

    const [gameState, setGameState] = useState<GameState>(() => {
        const urlSnapshot = loadStateFromURL();
        if (urlSnapshot) {
            console.log('[URL State] Loading from URL:', {
                planets: urlSnapshot.planets.length,
                commands: urlSnapshot.cmds.length,
            });
            return createInitialGameState(); // Future: reconstruct full state here
        }
        return createInitialGameState();
    });

    const [viewTurn, setViewTurn] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [queueValidation, setQueueValidation] = useState<Map<string, QueueValidationResult>>(new Map());

    const currentPlanetId = gameState.currentPlanetId;

    const currentPlanet = useMemo(() => {
        return gameState.planets.get(currentPlanetId) || null;
    }, [gameState.planets, currentPlanetId]);

    const controller = useMemo(() => {
        if (!currentPlanet || !currentPlanet.timeline) return null;
        return new GameController(currentPlanet, currentPlanet.timeline);
    }, [currentPlanetId, currentPlanet]);

    // URL Auto-save
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                const planetConfigs = extractPlanetConfigs(gameState);
                const commands = commandHistory.getCommands();
                if (commands.length > 0) {
                    saveStateToURL(planetConfigs, commands);
                    const sizeInfo = estimateEncodedSize(planetConfigs, commands);
                    console.log('[URL State] Saved:', {
                        planets: planetConfigs.length,
                        commands: commands.length,
                        jsonSize: sizeInfo.json,
                        compressedSize: sizeInfo.encoded,
                    });
                }
            } catch (error) {
                console.error('[URL State] Failed to save:', error);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [gameState, commandHistory]);

    const handlePlanetSwitch = useCallback((planetId: string) => {
        const planet = gameState.planets.get(planetId);
        if (planet) setViewTurn(planet.currentTurn);
        setGameState(prev => switchPlanet(prev, planetId));
    }, [gameState.planets]);

    const handleCreatePlanet = useCallback((config: PlanetConfig) => {
        try {
            const newGameState = addPlanet(gameState, config);
            const newPlanetId = `planet-${newGameState.nextPlanetId - 1}`;
            setViewTurn(config.startTurn);
            setGameState(switchPlanet(newGameState, newPlanetId));
        } catch (e) {
            setError((e as Error).message || 'Failed to create planet');
        }
    }, [gameState]);

    const value = {
        gameState,
        currentPlanetId,
        currentPlanet,
        controller,
        viewTurn,
        setViewTurn,
        commandHistory,
        error,
        setError,
        queueValidation,
        setQueueValidation,
        handlePlanetSwitch,
        handleCreatePlanet,
        setGameState
    };

    return (
        <GameStateContext.Provider value={value}>
            {children}
        </GameStateContext.Provider>
    );
}
