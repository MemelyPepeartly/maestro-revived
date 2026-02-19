// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";

function isNumericTrackFlag(value: unknown): boolean {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0;
    }

    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) && num > 0;
    }

    return false;
}

function toNumericTrackFlag(value: unknown): number {
    return Number(value);
}

function setMigrationError(): void {
    if (!game.maestro.migration) {
        game.maestro.migration = { errors: 0 };
    }
    game.maestro.migration.errors += 1;
}

function resolvePlaylistByFlagOrName(playlistFlag: unknown, fallbackName: string): Playlist | null {
    if (typeof playlistFlag === "string" && playlistFlag) {
        const byId = game.playlists.get(playlistFlag);
        if (byId) {
            return byId;
        }
    }

    return game.playlists.contents.find((entry) => entry.name === fallbackName) ?? null;
}

function mapLegacyTrackToSoundId(trackFlag: unknown, playlist: Playlist | null): string | null {
    if (!playlist || !isNumericTrackFlag(trackFlag)) {
        return null;
    }

    const legacyIndex = toNumericTrackFlag(trackFlag) - 1;
    const sound = playlist.sounds.contents[legacyIndex];
    return sound?.id ?? null;
}

function compareVersions(current: string, target: string): boolean {
    if (!current) {
        return true;
    }

    const a = current.split(".").map((part) => Number(part));
    const b = target.split(".").map((part) => Number(part));
    const max = Math.max(a.length, b.length);

    for (let idx = 0; idx < max; idx += 1) {
        const left = a[idx] ?? 0;
        const right = b[idx] ?? 0;
        if (left < right) {
            return true;
        }
        if (left > right) {
            return false;
        }
    }

    return false;
}

// Migrate data from legacy Maestro versions.
export async function migrationHandler(): Promise<void> {
    const targetVersion = DEFAULT_CONFIG.Migration.targetVersion;
    const currentVersion = String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.Migration.currentVersion) ?? "");

    if (!compareVersions(currentVersion, targetVersion)) {
        return;
    }

    game.maestro.migration = { errors: 0 };

    ui.notifications?.info(game.i18n.localize("MAESTRO.NOTIFICATIONS.MigrationStarting"));

    try {
        await _migrateScenePlaylists();
        await _migratePlaylistMode();
        await _migrateActorFlags();
        await _migrateItemFlags();
        await _migrateActorOwnedItemFlags();
        await _migrateTokenOwnedItemFlags();
    } catch (error) {
        console.warn(`${MODULE_NAME} | Migration failed with exception`, error);
        setMigrationError();
    }

    if ((game.maestro.migration?.errors ?? 0) > 0) {
        ui.notifications?.warn(game.i18n.localize("MAESTRO.NOTIFICATIONS.MigrationFailed"));
    } else {
        ui.notifications?.info(game.i18n.localize("MAESTRO.NOTIFICATIONS.MigrationSucceeded"));
    }

    const moduleVersion = String(game.modules.get(MODULE_NAME)?.version ?? targetVersion);
    await game.settings.set(MODULE_NAME, SETTINGS_KEYS.Migration.currentVersion, moduleVersion);
}

async function _migrateScenePlaylists(): Promise<void> {
    const scenes = game.scenes.contents.filter((scene) => {
        const oldFlag = scene.getFlag(MODULE_NAME, DEFAULT_CONFIG.SceneMusic.flagNames.playlist);
        return Boolean(oldFlag);
    });

    if (!scenes.length) {
        return;
    }

    console.log(game.i18n.localize("MAESTRO.LOGS.MigrationFoundSceneFlags"));

    for (const scene of scenes) {
        const playlist = scene.getFlag(MODULE_NAME, DEFAULT_CONFIG.SceneMusic.flagNames.playlist);
        try {
            const updated = await scene.update({
                playlist: playlist as string,
                [`flags.-=${MODULE_NAME}`]: null
            });

            if (!updated) {
                console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationSceneFlagsFailed"), scene.id, playlist);
                setMigrationError();
            } else {
                console.log(game.i18n.localize("MAESTRO.LOGS.MigrationSceneFlagsSuccessful"), scene.id, playlist);
            }
        } catch (error) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationSceneFlagsFailed"), scene.id, playlist, error);
            setMigrationError();
        }
    }
}

async function _migratePlaylistMode(): Promise<void> {
    const updates = game.playlists.contents
        .filter((playlist) => playlist.mode === 3)
        .map((playlist) => ({
            _id: playlist.id,
            mode: 1,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.PlaylistLoop.flagNames.loop}`]: false
        }));

    if (!updates.length) {
        return;
    }

    await Playlist.updateDocuments(updates);
}

async function _migrateActorFlags(): Promise<void> {
    const hypePlaylist = game.playlists.contents.find((playlist) => playlist.name === DEFAULT_CONFIG.HypeTrack.playlistName) ?? null;
    if (!hypePlaylist || !hypePlaylist.sounds.contents.length) {
        if (!hypePlaylist) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationHypeNoPlaylist"));
        } else {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationHypeNoSounds"));
        }
        return;
    }

    const actorCandidates = game.actors.contents.filter((actor) => {
        const track = actor.getFlag(MODULE_NAME, DEFAULT_CONFIG.HypeTrack.flagNames.track);
        return isNumericTrackFlag(track);
    });

    if (!actorCandidates.length) {
        return;
    }

    console.log(game.i18n.localize("MAESTRO.LOGS.MigrationHypeFoundActors"), actorCandidates.map((actor) => actor.id));
    console.log(game.i18n.localize("MAESTRO.LOGS.MigrationHypeAttemptingMatch"));

    for (const actor of actorCandidates) {
        const trackFlag = actor.getFlag(MODULE_NAME, DEFAULT_CONFIG.HypeTrack.flagNames.track);
        const soundId = mapLegacyTrackToSoundId(trackFlag, hypePlaylist);

        if (!soundId) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationHypeNoMatch"), actor);
            setMigrationError();
            continue;
        }

        await actor.update({
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.HypeTrack.flagNames.playlist}`]: hypePlaylist.id,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.HypeTrack.flagNames.track}`]: soundId
        });

        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationHypeSuccessful"), actor.id, soundId);
    }
}

async function _migrateItemFlags(): Promise<void> {
    const itemCandidates = game.items.contents.filter((item) => {
        const track = item.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.track);
        return isNumericTrackFlag(track);
    });

    if (!itemCandidates.length) {
        return;
    }

    console.log(game.i18n.localize("MAESTRO.LOGS.MigrationItemFound"), itemCandidates.map((item) => item.id));
    console.log(game.i18n.localize("MAESTRO.LOGS.MigrationItemAttemptingMatch"));

    for (const item of itemCandidates) {
        const playlistFlag = item.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.playlist);
        const playlist = resolvePlaylistByFlagOrName(playlistFlag, DEFAULT_CONFIG.ItemTrack.playlistName);

        if (!playlist) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationItemNoPlaylist"), playlistFlag);
            setMigrationError();
            continue;
        }

        const trackFlag = item.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.track);
        const soundId = mapLegacyTrackToSoundId(trackFlag, playlist);

        if (!soundId) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationItemNoSound"), item);
            setMigrationError();
            continue;
        }

        await item.update({
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.playlist}`]: playlist.id,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.track}`]: soundId
        });

        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationItemSuccess"), item.id, playlist.id, soundId);
    }
}

async function _migrateActorOwnedItemFlags(): Promise<void> {
    const actorsWithItems = game.actors.contents.filter((actor) => actor.items.size > 0);
    for (const actor of actorsWithItems) {
        const updates = actor.items.contents.flatMap((item) => {
            const trackFlag = item.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.track);
            if (!isNumericTrackFlag(trackFlag)) {
                return [];
            }

            const playlistFlag = item.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.playlist);
            const playlist = resolvePlaylistByFlagOrName(playlistFlag, DEFAULT_CONFIG.ItemTrack.playlistName);
            const soundId = mapLegacyTrackToSoundId(trackFlag, playlist);

            if (!playlist || !soundId) {
                setMigrationError();
                return [];
            }

            return [
                {
                    _id: item.id,
                    [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.track}`]: soundId,
                    [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.playlist}`]: playlist.id
                }
            ];
        });

        if (!updates.length) {
            continue;
        }

        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationOwnedItemFound"), actor.id, updates);
        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationOwnedItemAttemptingMatch"));

        const result = await actor.updateEmbeddedDocuments("Item", updates);
        if (!result?.length) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationOwnedItemFailed"), actor.id, updates);
            setMigrationError();
            continue;
        }

        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationOwnedItemSuccess"), actor.id, updates);
    }
}

async function _migrateTokenOwnedItemFlags(): Promise<void> {
    for (const scene of game.scenes.contents) {
        const tokenUpdates: Array<{ _id: string; actorData: { items: ItemSource[] } }> = [];

        for (const token of scene.tokens.contents) {
            if (token.actorLink) {
                continue;
            }

            const actorData = token.actorData;
            const items = duplicate(actorData?.items ?? []) as ItemSource[];
            if (!items.length) {
                continue;
            }

            let changed = false;
            for (const item of items) {
                const flags = item.flags?.[MODULE_NAME] as Record<string, unknown> | undefined;
                if (!flags) {
                    continue;
                }

                const legacyTrack = flags[DEFAULT_CONFIG.ItemTrack.flagNames.track];
                if (!isNumericTrackFlag(legacyTrack)) {
                    continue;
                }

                const playlist = resolvePlaylistByFlagOrName(
                    flags[DEFAULT_CONFIG.ItemTrack.flagNames.playlist],
                    DEFAULT_CONFIG.ItemTrack.playlistName
                );
                const soundId = mapLegacyTrackToSoundId(legacyTrack, playlist);
                if (!playlist || !soundId) {
                    setMigrationError();
                    continue;
                }

                flags[DEFAULT_CONFIG.ItemTrack.flagNames.playlist] = playlist.id;
                flags[DEFAULT_CONFIG.ItemTrack.flagNames.track] = soundId;
                changed = true;
            }

            if (!changed) {
                continue;
            }

            tokenUpdates.push({
                _id: token.id,
                actorData: { items }
            });
        }

        if (!tokenUpdates.length) {
            continue;
        }

        const result = await scene.updateEmbeddedDocuments("Token", tokenUpdates);
        if (!result?.length) {
            console.warn(game.i18n.localize("MAESTRO.LOGS.MigrationTokenOwnedItemFailed"), tokenUpdates);
            setMigrationError();
            continue;
        }

        console.log(game.i18n.localize("MAESTRO.LOGS.MigrationTokenOwnedItemSuccess"), tokenUpdates);
    }
}


