// @ts-nocheck
import CombatTrack from "./modules/combat-track.js";
import HypeTrack from "./modules/hype-track.js";
import ItemTrack from "./modules/item-track.js";
import { migrationHandler } from "./modules/migration.js";
import * as Misc from "./modules/misc.js";
import * as Playback from "./modules/playback.js";
import { registerModuleSettings } from "./modules/settings.js";

export default class Conductor {
    private static hooksRegistered = false;

    static begin(): void {
        Conductor.registerInitHook();
        Conductor.registerReadyHook();
    }

    private static registerInitHook(): void {
        Hooks.once("init", async () => {
            game.maestro = {};
            await registerModuleSettings();
            Conductor.registerInitOnlyHooks();
        });
    }

    private static registerReadyHook(): void {
        Hooks.once("ready", async () => {
            game.maestro.hypeTrack = new HypeTrack();
            game.maestro.itemTrack = new ItemTrack();
            game.maestro.combatTrack = new CombatTrack();

            await HypeTrack._onReady();
            await ItemTrack._onReady();
            await CombatTrack._onReady();

            await Misc._checkForCriticalPlaylist();
            await Misc._checkForFailurePlaylist();

            game.maestro.pause = Playback.pauseSounds;
            game.maestro.playByName = Playback.playSoundByName;
            game.maestro.findSound = Playback.findPlaylistSound;
            game.maestro.pauseAll = Playback.pauseAll;
            game.maestro.resume = Playback.resumeSounds;

            Conductor.registerReadyHooks();

            if (Misc.isFirstGM()) {
                game.maestro.migration = { errors: 0 };
                await migrationHandler();
            }
        });
    }

    private static registerInitOnlyHooks(): void {
        Hooks.on("renderPlaylistDirectory", (app, html) => {
            Misc._onRenderPlaylistDirectory(app, html);
        });
    }

    private static registerReadyHooks(): void {
        if (Conductor.hooksRegistered) {
            return;
        }
        Conductor.hooksRegistered = true;

        Hooks.on("renderActorSheet", (app, html) => {
            HypeTrack._onRenderActorSheet(app, html);
        });

        Hooks.on("renderItemSheet", (app, html) => {
            void ItemTrack._onRenderItemSheet(app, html);
        });

        Hooks.on("renderChatMessage", (message, html) => {
            void ItemTrack._onRenderChatMessage(message, html);
            Misc._onRenderChatMessage(message);
        });

        Hooks.on("renderCombatTrackerConfig", (app, html) => {
            CombatTrack._onRenderCombatTrackerConfig(app, html);
        });

        Hooks.on("preCreateChatMessage", (message, data) => {
            Misc._onPreCreateChatMessage(message, data);
        });

        Hooks.on("preUpdatePlaylistSound", (sound, update) => {
            Misc._onPreUpdatePlaylistSound(sound, update);
        });

        // Preserve legacy hook registration shape; intentionally unused.
        Hooks.on("preUpdatePlaylist", () => {
            return;
        });

        Hooks.on("preUpdateCombat", (combat, update, options) => {
            CombatTrack._onPreUpdateCombat(combat, update, options as Record<string, unknown>);
        });

        Hooks.on("updateCombat", (combat, update, options) => {
            HypeTrack._onUpdateCombat(combat, update);
            CombatTrack._onUpdateCombat(combat, update, options as Record<string, unknown>);
        });

        Hooks.on("deleteCombat", (combat) => {
            HypeTrack._onDeleteCombat();
            CombatTrack._onDeleteCombat(combat);
        });

        Hooks.on("deleteItem", (item) => {
            void ItemTrack._onDeleteItem(item);
        });
    }
}

Conductor.begin();


