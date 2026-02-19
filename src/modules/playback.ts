// @ts-nocheck
import { DEFAULT_CONFIG } from "./config.js";

function getPlaylistById(playlistId: string | null | undefined): Playlist | null {
    if (!playlistId) {
        return null;
    }

    return game.playlists.get(playlistId) ?? null;
}

/**
 * Get all sounds for a playlist id.
 */
export function getPlaylistSounds(playlistId: string | null | undefined): PlaylistSound[] {
    const playlist = getPlaylistById(playlistId);
    return playlist?.sounds?.contents ?? [];
}

/**
 * For a given trackId get the corresponding playlist sound from a playlist.
 */
export function getPlaylistSound(playlistId: string | null | undefined, trackId: string | null | undefined): PlaylistSound | null {
    const playlist = getPlaylistById(playlistId);
    if (!playlist || !trackId) {
        return null;
    }

    return playlist.sounds.get(trackId) ?? null;
}

/**
 * Play a playlist sound based on a track id or playback mode.
 */
export async function playTrack(trackId: string, playlistId: string): Promise<PlaylistSound | void> {
    const playlist = getPlaylistById(playlistId);

    if (!playlist || !trackId) {
        return;
    }

    let resolvedTrackId = trackId;
    if (trackId === DEFAULT_CONFIG.ItemTrack.playbackModes.random) {
        const soundIds = playlist.sounds.contents.map((sound) => sound.id);
        if (!soundIds.length) {
            return;
        }

        resolvedTrackId = soundIds[Math.floor(Math.random() * soundIds.length)];
    }

    const sound = playlist.sounds.get(resolvedTrackId);
    if (!sound) {
        return;
    }

    return playlist.playSound(sound);
}

/**
 * Play a playlist using its default playback method.
 */
export async function playPlaylist(playlistId: string): Promise<void> {
    const playlist = getPlaylistById(playlistId);
    if (!playlist) {
        return;
    }

    await playlist.playAll();
}

/**
 * Finds a playlist sound by a specific field.
 */
export function findPlaylistSound(searchString: string, findBy: "name" | "path" | "id" = "name"): { playlist: Playlist; sound: PlaylistSound } | null {
    for (const playlist of game.playlists.contents) {
        const sound = playlist.sounds.contents.find((candidate) => (candidate as Record<string, unknown>)[findBy] === searchString);
        if (sound) {
            return { playlist, sound };
        }
    }

    return null;
}

/**
 * Play a sound by name/path/id, optionally scoped to a playlist or playlist id.
 */
export async function playSoundByName(
    searchString: string,
    {
        playlist = null,
        findBy = "name"
    }: {
        playlist?: Playlist | string | null;
        findBy?: "name" | "path" | "id";
    } = {}
): Promise<PlaylistSound | void> {
    let resolvedPlaylist: Playlist | null = null;
    let resolvedSound: PlaylistSound | null = null;

    if (typeof playlist === "string") {
        resolvedPlaylist = game.playlists.get(playlist) ?? null;
    } else {
        resolvedPlaylist = playlist;
    }

    if (resolvedPlaylist) {
        resolvedSound = resolvedPlaylist.sounds.contents.find((candidate) => (candidate as Record<string, unknown>)[findBy] === searchString) ?? null;
    } else {
        const found = findPlaylistSound(searchString, findBy);
        resolvedPlaylist = found?.playlist ?? null;
        resolvedSound = found?.sound ?? null;
    }

    if (!resolvedPlaylist || !resolvedSound) {
        ui.notifications?.warn(game.i18n.localize("MAESTRO.PLAYBACK.PlaySoundByName.NoPlaylist"));
        return;
    }

    return resolvedPlaylist.playSound(resolvedSound);
}

function normalizePlaylistSounds(sounds: PlaylistSound | PlaylistSound[] | string | string[] | null | undefined): PlaylistSound[] {
    if (!sounds) {
        return [];
    }

    const values = Array.isArray(sounds) ? sounds : [sounds];
    const normalized: PlaylistSound[] = [];

    for (const value of values) {
        if (typeof value === "string") {
            const found = findPlaylistSound(value, "id") ?? findPlaylistSound(value, "name") ?? findPlaylistSound(value, "path");
            if (found?.sound) {
                normalized.push(found.sound);
            }
            continue;
        }

        normalized.push(value);
    }

    return normalized;
}

/**
 * Pause one or more playlist sounds.
 */
export async function pauseSounds(sounds: PlaylistSound | PlaylistSound[] | string | string[] | null | undefined): Promise<PlaylistSound[]> {
    const soundsToPause = normalizePlaylistSounds(sounds).filter((sound) => sound.playing);
    const pausedSounds: PlaylistSound[] = [];

    for (const sound of soundsToPause) {
        const currentTime = sound.sound?.currentTime ?? 0;
        await sound.update({ playing: false, pausedTime: currentTime });
        pausedSounds.push(sound);
    }

    return pausedSounds;
}

/**
 * Resume one or more paused playlist sounds.
 */
export async function resumeSounds(sounds: PlaylistSound | PlaylistSound[] | null | undefined): Promise<PlaylistSound[]> {
    const soundsToResume = normalizePlaylistSounds(sounds as PlaylistSound | PlaylistSound[] | null | undefined).filter(
        (sound) => Boolean(sound.pausedTime)
    );
    const resumedSounds: PlaylistSound[] = [];

    for (const sound of soundsToResume) {
        await sound.update({ playing: true });
        resumedSounds.push(sound);
    }

    return resumedSounds;
}

/**
 * Pause all actively playing playlist sounds.
 */
export async function pauseAll(): Promise<PlaylistSound[]> {
    const activeSounds = game.playlists.contents.flatMap((playlist) => playlist.sounds.contents.filter((sound) => sound.playing));
    return pauseSounds(activeSounds);
}


