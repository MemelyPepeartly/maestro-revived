// @ts-nocheck
import type CombatTrack from "../modules/combat-track.js";
import type HypeTrack from "../modules/hype-track.js";
import type ItemTrack from "../modules/item-track.js";
import type {
    findPlaylistSound,
    pauseAll,
    pauseSounds,
    playSoundByName,
    resumeSounds
} from "../modules/playback.js";

declare global {
    interface Game {
        maestro: {
            hypeTrack?: HypeTrack;
            itemTrack?: ItemTrack;
            combatTrack?: CombatTrack;
            pause?: typeof pauseSounds;
            playByName?: typeof playSoundByName;
            findSound?: typeof findPlaylistSound;
            pauseAll?: typeof pauseAll;
            resume?: typeof resumeSounds;
            playHype?: HypeTrack["playHype"];
            migration?: {
                errors: number;
            };
            [key: string]: unknown;
        };
    }
}

export {};


