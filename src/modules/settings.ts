// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { HypeTrackDefaultForm } from "./hype-track.js";
import { _checkForCriticalPlaylist, _checkForFailurePlaylist, MaestroConfigForm } from "./misc.js";

function resolvePlaylistIdByName(name: string): string {
    return game.playlists.contents.find((playlist) => playlist.name === name)?.id ?? "";
}

export async function registerModuleSettings(): Promise<void> {
    game.settings.register(MODULE_NAME, SETTINGS_KEYS.HypeTrack.enable, {
        name: "MAESTRO.SETTINGS.HypeTrackEnableN",
        hint: "MAESTRO.SETTINGS.HypeTrackEnableH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            await game.maestro.hypeTrack?._checkForHypeTracksPlaylist();
        }
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.HypeTrack.pauseOthers, {
        name: "MAESTRO.SETTINGS.HypeTrackPauseOthersN",
        hint: "MAESTRO.SETTINGS.HypeTrackPauseOthersH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultPlaylist, {
        name: "Default Hype Playlist",
        hint: "Fallback playlist used when an actor has no explicit Hype playlist.",
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultTrack, {
        name: "Default Hype Track",
        hint: "Fallback track (or mode) used when an actor has no Hype track.",
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.registerMenu(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultMenu, {
        name: "Default Hype Track",
        label: "Configure",
        hint: "Configure fallback Hype playlist and track when an actor has none.",
        icon: "fas fa-music",
        type: HypeTrackDefaultForm,
        restricted: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable, {
        name: "MAESTRO.SETTINGS.ItemTrackEnableN",
        hint: "MAESTRO.SETTINGS.ItemTrackEnableH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.ItemTrack.createPlaylist, {
        name: "MAESTRO.SETTINGS.ItemTrackCreatePlaylistN",
        hint: "MAESTRO.SETTINGS.ItemTrackCreatePlaylistH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            await game.maestro.itemTrack?._checkForItemTracksPlaylist();
        }
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.ItemTrack.itemIdAttribute, {
        name: "MAESTRO.SETTINGS.ItemTrack.ItemIdAttributeN",
        hint: "MAESTRO.SETTINGS.ItemTrack.ItemIdAttributeH",
        scope: "world",
        type: String,
        default: "data-item-id",
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.ItemTrack.deletedItems, {
        name: "MAESTRO.SETTINGS.ItemTrack.DeletedItemsN",
        hint: "MAESTRO.SETTINGS.ItemTrack.DeletedItemsH",
        scope: "world",
        type: Object,
        default: {},
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.CombatTrack.enable, {
        name: "MAESTRO.SETTINGS.CombatTrackEnableN",
        hint: "MAESTRO.SETTINGS.CombatTrackEnableH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.CombatTrack.createPlaylist, {
        name: "MAESTRO.SETTINGS.CombatTrackCreatePlaylistN",
        hint: "MAESTRO.SETTINGS.CombatTrackCreatePlaylistH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            await game.maestro.combatTrack?._checkForCombatTracksPlaylist();
        }
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultPlaylist, {
        name: "MAESTRO.SETTINGS.CombatTrackDefaultPlaylistN",
        hint: "MAESTRO.SETTINGS.CombatTrackDefaultPlaylistH",
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultTrack, {
        name: "MAESTRO.SETTINGS.CombatTrackDefaultTrackN",
        hint: "MAESTRO.SETTINGS.CombatTrackDefaultTrackH",
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.CombatTrack.pauseOthers, {
        name: "MAESTRO.SETTINGS.CombatTrack.PauseOthersN",
        hint: "MAESTRO.SETTINGS.CombatTrack.PauseOthersH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Migration.currentVersion, {
        name: "MAESTRO.SETTINGS.MigrationCurrentVersionN",
        hint: "MAESTRO.SETTINGS.MigrationCurrentVersionH",
        scope: "world",
        type: String,
        default: "",
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.disableDiceSound, {
        name: "MAESTRO.SETTINGS.DisableDiceSoundN",
        hint: "MAESTRO.SETTINGS.DisableDiceSoundH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks, {
        name: "MAESTRO.SETTINGS.EnableCriticalSuccessFailureTracksN",
        hint: "MAESTRO.SETTINGS.EnableCriticalSuccessFailureTracksH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.createCriticalSuccessPlaylist, {
        name: "MAESTRO.SETTINGS.CreateCriticalSuccessPlaylistN",
        hint: "MAESTRO.SETTINGS.CreateCriticalSuccessPlaylistH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            if (!game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks)) {
                return;
            }
            await _checkForCriticalPlaylist();
        }
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.createCriticalFailurePlaylist, {
        name: "MAESTRO.SETTINGS.CreateCriticalFailurePlaylistN",
        hint: "MAESTRO.SETTINGS.CreateCriticalFailurePlaylistH",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
        onChange: async () => {
            if (!game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks)) {
                return;
            }
            await _checkForFailurePlaylist();
        }
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessFailureTracks, {
        name: "MAESTRO.SETTINGS.CriticalSuccessFailureTracksN",
        hint: "MAESTRO.SETTINGS.CriticalSuccessFailureTracksH",
        scope: "world",
        type: Object,
        default: {
            criticalSuccessPlaylist: resolvePlaylistIdByName(DEFAULT_CONFIG.Misc.criticalSuccessPlaylistName),
            criticalSuccessSound: "",
            criticalFailurePlaylist: resolvePlaylistIdByName(DEFAULT_CONFIG.Misc.criticalFailurePlaylistName),
            criticalFailureSound: ""
        },
        config: false
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.criticalDieFaces, {
        name: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.DieFacesN",
        hint: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.DieFacesH",
        scope: "world",
        type: Number,
        default: 20,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessThreshold, {
        name: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.SuccessThresholdN",
        hint: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.SuccessThresholdH",
        scope: "world",
        type: Number,
        default: 20,
        config: true
    });

    game.settings.register(MODULE_NAME, SETTINGS_KEYS.Misc.criticalFailureThreshold, {
        name: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.FailureThresholdN",
        hint: "MAESTRO.SETTINGS.CriticalSuccessFailureTracks.FailureThresholdH",
        scope: "world",
        type: Number,
        default: 1,
        config: true
    });

    game.settings.registerMenu(MODULE_NAME, SETTINGS_KEYS.Misc.maestroConfigMenu, {
        name: "MAESTRO.SETTINGS.Config.ButtonN",
        label: DEFAULT_CONFIG.Misc.maestroConfigTitle,
        hint: "MAESTRO.SETTINGS.Config.ButtonH",
        icon: "fas fa-cog",
        type: MaestroConfigForm,
        restricted: true
    });
}


