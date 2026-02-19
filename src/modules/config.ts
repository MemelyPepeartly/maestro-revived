// @ts-nocheck
export const MODULE_NAME = "maestro" as const;

export const MODULE_LABEL = "Maestro" as const;

export const DEFAULT_CONFIG = {
    SceneMusic: {
        name: "scene-music",
        flagNames: {
            playlist: "playlistId"
        },
        templatePath: "./modules/maestro/templates/playlist-select.html"
    },

    HypeTrack: {
        name: "hype-track",
        playlistName: "Hype Tracks",
        buttonIcon: "fas fa-music",
        buttonText: " Hype",
        aTitle: "Change Actor Hype Track",
        defaultFormTemplatePath: "./modules/maestro/templates/hype-track-default-form.html",
        flagNames: {
            playlist: "playlist",
            track: "track"
        },
        templatePath: "./modules/maestro/templates/hype-track-form.html"
    },

    ItemTrack: {
        name: "item-track",
        playlistName: "Item Tracks",
        buttonIcon: "fas fa-music",
        buttonText: " Item Track",
        aTitle: "Change Item Track",
        flagNames: {
            track: "track",
            played: "item-track-played",
            playlist: "playlist"
        },
        playbackModes: {
            single: "single",
            random: "random-track",
            all: "play-all"
        },
        templatePath: "./modules/maestro/templates/item-track-form.html"
    },

    CombatTrack: {
        name: "combat-track",
        playlistName: "Combat Tracks",
        buttonIcon: "fas fa-music",
        buttonText: "",
        aTitle: "MAESTRO.COMBAT-TRACK.FormButtonTitle",
        flagNames: {
            track: "track",
            playlist: "playlist"
        },
        playbackModes: {
            single: "single",
            random: "random-track",
            all: "play-all"
        },
        templatePath: "./modules/maestro/templates/combat-track-form.html"
    },

    PlaylistLoop: {
        flagNames: {
            loop: "playlist-loop",
            previousSound: "previous-sound"
        }
    },

    Migration: {
        targetVersion: "1.1.0"
    },

    Misc: {
        criticalSuccessPlaylistName: "Critical Success Tracks",
        criticalFailurePlaylistName: "Critical Failure Tracks",
        maestroConfigTitle: "Additional Configuration",
        maestroConfigTemplatePath: "./modules/maestro/templates/maestro-config.html"
    }
} as const;

export const FLAGS = {
    CombatTrack: {
        combatStarted: "combatStarted"
    }
} as const;

export const SETTINGS_KEYS = {
    ItemTrack: {
        enable: "enableItemTrack",
        createPlaylist: "createItemTrackPlaylist",
        itemIdAttribute: "itemIdChatCardAttribute",
        deletedItems: "deletedItems"
    },

    HypeTrack: {
        enable: "enableHypeTrack",
        pauseOthers: "hypeTrackPauseOthers",
        defaultPlaylist: "defaultHypeTrackPlaylist",
        defaultTrack: "defaultHypeTrackTrack",
        defaultMenu: "hypeTrackDefaultsMenu"
    },

    CombatTrack: {
        enable: "enableCombatTrack",
        createPlaylist: "createCombatTrackPlaylist",
        defaultPlaylist: "defaultCombatTrackPlaylist",
        defaultTrack: "defaultCombatTrackTrack",
        pauseOthers: "combatTrackPauseOthers"
    },

    Migration: {
        currentVersion: "currentMigrationVersion"
    },

    Misc: {
        disableDiceSound: "disableDiceSound",
        enableCriticalSuccessFailureTracks: "enableCriticalSuccessFailureTracks",
        createCriticalSuccessPlaylist: "createCriticalSuccessPlaylist",
        criticalSuccessFailureTracks: "criticalSuccessFailureTracks",
        createCriticalFailurePlaylist: "createFailurePlaylist",
        criticalDieFaces: "dieFaces",
        criticalSuccessThreshold: "successThreshold",
        criticalFailureThreshold: "failureThreshold",
        maestroConfigMenu: "maestroConfigMenu"
    }
} as const;

export type PlaybackMode = typeof DEFAULT_CONFIG.ItemTrack.playbackModes[keyof typeof DEFAULT_CONFIG.ItemTrack.playbackModes];


