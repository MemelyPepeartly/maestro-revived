// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { isFirstGM } from "./misc.js";
import * as Playback from "./playback.js";

type HypeFlags = {
    playlist?: string;
    track?: string;
};

type HypeSelection = {
    playlistId: string;
    track: string;
};

function hasNumeric(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isPlaybackMode(value: string): boolean {
    return value === DEFAULT_CONFIG.ItemTrack.playbackModes.all || value === DEFAULT_CONFIG.ItemTrack.playbackModes.random;
}

function normalizeSetting(value: unknown): string {
    return typeof value === "string" ? value : "";
}

export default class HypeTrack {
    playlist: Playlist | null;
    pausedSounds: PlaylistSound[];
    activeTrack: string | null;
    activePlaylistId: string | null;

    constructor() {
        this.playlist = null;
        this.pausedSounds = [];
        this.activeTrack = null;
        this.activePlaylistId = null;
    }

    static async _onReady(): Promise<void> {
        if (!game.maestro.hypeTrack) {
            return;
        }

        await game.maestro.hypeTrack._checkForHypeTracksPlaylist();
        game.maestro.playHype = game.maestro.hypeTrack.playHype.bind(game.maestro.hypeTrack);
    }

    static _onUpdateCombat(combat: Combat, update: DeepPartial<Combat.Source>): void {
        void game.maestro.hypeTrack?._processHype(combat, update);
    }

    static _onDeleteCombat(): void {
        void game.maestro.hypeTrack?._stopHypeTrack();
    }

    static _onRenderActorSheet(app: ActorSheet, html: JQuery): void {
        void game.maestro.hypeTrack?._addHypeButton(app, html);
    }

    async _checkForHypeTracksPlaylist(): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.enable);
        if (!enabled || !isFirstGM()) {
            return;
        }

        const existing = game.playlists.getName(DEFAULT_CONFIG.HypeTrack.playlistName);
        this.playlist = existing ?? (await Playlist.create({ name: DEFAULT_CONFIG.HypeTrack.playlistName }));
    }

    private _getActorHypeFlags(actor: Actor | null | undefined): HypeFlags | null {
        const flags = actor?.flags?.[MODULE_NAME];
        if (!flags || typeof flags !== "object") {
            return null;
        }

        return flags as HypeFlags;
    }

    private _resolveHypeSelection(actor: Actor | null | undefined): HypeSelection {
        const flags = this._getActorHypeFlags(actor);
        let playlistId = normalizeSetting(flags?.playlist);
        let track = normalizeSetting(flags?.track);

        const defaultPlaylist = normalizeSetting(game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultPlaylist));
        const defaultTrack = normalizeSetting(game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultTrack));

        if (!track) {
            track = defaultTrack;
        }

        if (!playlistId) {
            playlistId = defaultPlaylist || this.playlist?.id || "";
        }

        return { playlistId, track };
    }

    private _isTrackCurrentlyPlaying(selection: HypeSelection): boolean {
        if (!selection.playlistId || !selection.track) {
            return false;
        }

        const playlist = game.playlists.get(selection.playlistId);
        if (!playlist) {
            return false;
        }

        if (selection.track === DEFAULT_CONFIG.ItemTrack.playbackModes.all) {
            return playlist.playing || playlist.sounds.contents.some((sound) => sound.playing);
        }

        if (selection.track === DEFAULT_CONFIG.ItemTrack.playbackModes.random) {
            return playlist.sounds.contents.some((sound) => sound.playing);
        }

        return Boolean(playlist.sounds.get(selection.track)?.playing);
    }

    private _isSameActiveSelection(selection: HypeSelection): boolean {
        return (
            this.activeTrack === selection.track
            && this.activePlaylistId === selection.playlistId
            && this._isTrackCurrentlyPlaying(selection)
        );
    }

    private _mergePausedSounds(sounds: PlaylistSound[]): void {
        const existing = new Set(this.pausedSounds.map((sound) => `${sound.parent?.id ?? ""}:${sound.id}`));

        for (const sound of sounds) {
            const key = `${sound.parent?.id ?? ""}:${sound.id}`;
            if (existing.has(key)) {
                continue;
            }

            existing.add(key);
            this.pausedSounds.push(sound);
        }
    }

    private async _stopPlaylistPlayback(playlistId: string | null | undefined): Promise<void> {
        if (!playlistId) {
            return;
        }

        const playlist = game.playlists.get(playlistId);
        if (!playlist) {
            return;
        }

        if (playlist.playing) {
            await playlist.stopAll();
        }

        const activeSounds = playlist.sounds.contents.filter((sound) => sound.playing || Boolean(sound.pausedTime));
        if (activeSounds.length) {
            await playlist.updateEmbeddedDocuments(
                "PlaylistSound",
                activeSounds.map((sound) => ({ _id: sound.id, playing: false, pausedTime: null }))
            );
        }
    }

    private async _stopActiveHypePlayback(): Promise<void> {
        if (this.activePlaylistId) {
            await this._stopPlaylistPlayback(this.activePlaylistId);
        }

        this.activePlaylistId = null;
        this.activeTrack = null;
    }

    async _processHype(combat: Combat, update: DeepPartial<Combat.Source>): Promise<void> {
        const turn = (update as Record<string, unknown>).turn;
        if (
            combat?.current?.round === 0
            || !hasNumeric(turn)
            || !combat.combatants.contents.length
            || !this.playlist
            || !isFirstGM()
        ) {
            return;
        }

        const selection = this._resolveHypeSelection(combat.combatant?.actor ?? null);

        // No actor/default hype track for this turn: stop hype and resume previous non-hype audio.
        if (!selection.track || !selection.playlistId) {
            await this._stopActiveHypePlayback();
            await this._resumeOthers();
            return;
        }

        if (this._isSameActiveSelection(selection)) {
            return;
        }

        await this._stopActiveHypePlayback();

        const pauseOthers = game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.pauseOthers);
        if (pauseOthers) {
            const paused = await Playback.pauseAll();
            this._mergePausedSounds(paused);
        } else if (this.pausedSounds.length) {
            await this._resumeOthers();
        }

        if (selection.track === DEFAULT_CONFIG.ItemTrack.playbackModes.all) {
            await Playback.playPlaylist(selection.playlistId);
        } else {
            await Playback.playTrack(selection.track, selection.playlistId);
        }

        this.activeTrack = selection.track;
        this.activePlaylistId = selection.playlistId;

        if (!isPlaybackMode(selection.track) && this.pausedSounds.length) {
            const playlist = game.playlists.get(selection.playlistId);
            const sound = playlist?.sounds.get(selection.track);

            sound?.sound?.once("end", () => {
                const unchanged = this.activeTrack === selection.track && this.activePlaylistId === selection.playlistId;
                if (!unchanged) {
                    return;
                }

                this.activeTrack = null;
                this.activePlaylistId = null;
                void this._resumeOthers();
            });
        }
    }

    private async _resumeOthers(): Promise<void> {
        if (!this.pausedSounds.length) {
            return;
        }

        await Playback.resumeSounds(this.pausedSounds);
        this.pausedSounds = [];
    }

    private _getActorHypeTrack(actor: Actor | null | undefined): string {
        return String(getProperty(actor, `flags.${MODULE_NAME}.${DEFAULT_CONFIG.HypeTrack.flagNames.track}`) ?? "");
    }

    async _setActorHypeFlags(actor: Actor, playlistId: string, trackId: string): Promise<Actor | undefined> {
        return actor.update({
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.HypeTrack.flagNames.playlist}`]: playlistId,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.HypeTrack.flagNames.track}`]: trackId
        });
    }

    async _addHypeButton(app: ActorSheet, html: JQuery): Promise<void> {
        if (!game.user.isGM && !app?.document?.isOwner) {
            return;
        }

        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.enable);
        if (!enabled) {
            return;
        }

        if (html.find(`.${DEFAULT_CONFIG.HypeTrack.name}`).length > 0) {
            return;
        }

        const hypeButton = $(
            `<a class="${DEFAULT_CONFIG.HypeTrack.name}" title="${DEFAULT_CONFIG.HypeTrack.aTitle}">` +
            `<i class="${DEFAULT_CONFIG.HypeTrack.buttonIcon}"></i>` +
            `<span>${DEFAULT_CONFIG.HypeTrack.buttonText}</span>` +
            "</a>"
        );

        const windowHeader = html.find(".window-header");
        const closeButton = windowHeader.find(".close");
        closeButton.before(hypeButton);

        hypeButton.on("click", () => {
            const actor = app.document;
            const flags = this._getActorHypeFlags(actor);
            this._openTrackForm(actor, flags, { closeOnSubmit: true });
        });
    }

    private _openTrackForm(actor: Actor, flags: HypeFlags | null, options: Partial<FormApplicationOptions>): void {
        new HypeTrackActorForm(
            actor,
            {
                track: flags?.track ?? "",
                playlist: flags?.playlist ?? this.playlist?.id ?? ""
            },
            options
        ).render(true);
    }

    async playHype(
        actorInput: string | Actor | { name?: string } | null | undefined,
        {
            warn = true
        }: {
            warn?: boolean;
            pauseOthers?: boolean;
        } = {}
    ): Promise<PlaylistSound | void> {
        let actor: Actor | null = null;

        if (typeof actorInput === "string") {
            actor = game.actors.getName(actorInput) ?? null;
        } else if (actorInput instanceof Actor) {
            actor = actorInput;
        } else if (actorInput?.name) {
            actor = game.actors.getName(actorInput.name) ?? null;
        }

        if (!actor) {
            if (warn) {
                ui.notifications?.warn(game.i18n.localize("MAESTRO.HYPE-TRACK.PlayHype.NoActor"));
            }
            return;
        }

        const selection = this._resolveHypeSelection(actor);
        if (!selection.track) {
            if (warn) {
                ui.notifications?.warn(game.i18n.localize("MAESTRO.HYPE-TRACK.PlayHype.NoTrack"));
            }
            return;
        }

        if (!selection.playlistId) {
            if (warn) {
                ui.notifications?.warn(game.i18n.localize("MAESTRO.HYPE-TRACK.PlayHype.NoPlaylist"));
            }
            return;
        }

        if (selection.track === DEFAULT_CONFIG.ItemTrack.playbackModes.all) {
            await Playback.playPlaylist(selection.playlistId);
            return;
        }

        return Playback.playTrack(selection.track, selection.playlistId);
    }

    async _stopHypeTrack(): Promise<void> {
        if (!isFirstGM()) {
            return;
        }

        await this._stopActiveHypePlayback();
        await this._resumeOthers();
        ui.playlists?.render();
    }
}

interface HypeTrackFormData {
    track: string;
    playlist: string;
}

interface PlaylistOptionView {
    id: string;
    name: string;
    label: string;
    soundCount: number;
}

class HypeTrackActorForm extends FormApplication<FormApplicationOptions, HypeTrackFormData, {}>
{
    actor: Actor;
    data: HypeTrackFormData;

    constructor(actor: Actor, data: HypeTrackFormData, options?: Partial<FormApplicationOptions>) {
        super(data, options ?? {});
        this.actor = actor;
        this.data = data;
    }

    static override get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: "hype-track-form",
            title: DEFAULT_CONFIG.HypeTrack.aTitle,
            template: DEFAULT_CONFIG.HypeTrack.templatePath,
            classes: ["sheet"],
            width: 560
        });
    }

    private _buildPlaylistOptions(): {
        activePlaylists: PlaylistOptionView[];
        emptyPlaylists: PlaylistOptionView[];
        selectedPlaylist: Playlist | null;
        selectedPlaylistMissing: boolean;
    } {
        const selectedPlaylist = game.playlists.get(this.data.playlist) ?? null;
        const defaultHypePlaylist = game.playlists.getName(DEFAULT_CONFIG.HypeTrack.playlistName);

        const options: PlaylistOptionView[] = game.playlists.contents
            .map((playlist) => {
                const soundCount = playlist.sounds.contents.length;
                return {
                    id: playlist.id,
                    name: playlist.name,
                    label: `${playlist.name} (${soundCount})`,
                    soundCount
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        if (defaultHypePlaylist) {
            const idx = options.findIndex((playlist) => playlist.id === defaultHypePlaylist.id);
            if (idx > 0) {
                const [recommended] = options.splice(idx, 1);
                recommended.label = `${recommended.label} - Recommended`;
                options.unshift(recommended);
            }
        }

        const activePlaylists = options.filter((playlist) => playlist.soundCount > 0);
        const emptyPlaylists = options.filter((playlist) => playlist.soundCount === 0);

        return {
            activePlaylists,
            emptyPlaylists,
            selectedPlaylist,
            selectedPlaylistMissing: Boolean(this.data.playlist && !selectedPlaylist)
        };
    }

    private _buildTrackView(selectedPlaylist: Playlist | null): {
        playlistSounds: PlaylistSound[];
        hasTracks: boolean;
        selectedTrackMissing: boolean;
        selectedTrackLabel: string;
    } {
        const playlistSounds = selectedPlaylist?.sounds?.contents ?? [];
        const hasTracks = playlistSounds.length > 0;

        const selectedTrack = this.data.track;
        if (!selectedTrack) {
            return {
                playlistSounds,
                hasTracks,
                selectedTrackMissing: false,
                selectedTrackLabel: ""
            };
        }

        if (isPlaybackMode(selectedTrack)) {
            const modeLabel = selectedTrack === DEFAULT_CONFIG.ItemTrack.playbackModes.random
                ? "Random Track"
                : "Play Entire Playlist";
            return {
                playlistSounds,
                hasTracks,
                selectedTrackMissing: false,
                selectedTrackLabel: modeLabel
            };
        }

        const selectedSound = selectedPlaylist?.sounds?.get(selectedTrack) ?? null;
        return {
            playlistSounds,
            hasTracks,
            selectedTrackMissing: !selectedSound,
            selectedTrackLabel: selectedSound?.name ?? `Missing Track (${selectedTrack})`
        };
    }

    private _currentSelectionSummary(selectedPlaylist: Playlist | null, selectedTrackLabel: string): string {
        const playlistPart = selectedPlaylist?.name ?? (this.data.playlist ? "Missing Playlist" : "No Playlist");
        const trackPart = selectedTrackLabel || (this.data.track ? `Missing Track (${this.data.track})` : "No Track");
        return `${playlistPart} -> ${trackPart}`;
    }

    override getData(): {
        actorName: string;
        activePlaylists: PlaylistOptionView[];
        emptyPlaylists: PlaylistOptionView[];
        selectedPlaylistMissing: boolean;
        selectedTrackMissing: boolean;
        selectedTrackLabel: string;
        currentSelectionSummary: string;
        hasTracks: boolean;
        playlistSounds: PlaylistSound[];
        track: string;
        playlist: string;
        trackSelectDisabled: boolean;
    } {
        const playlistView = this._buildPlaylistOptions();
        const trackView = this._buildTrackView(playlistView.selectedPlaylist);

        return {
            actorName: this.actor.name ?? "Actor",
            activePlaylists: playlistView.activePlaylists,
            emptyPlaylists: playlistView.emptyPlaylists,
            selectedPlaylistMissing: playlistView.selectedPlaylistMissing,
            selectedTrackMissing: trackView.selectedTrackMissing,
            selectedTrackLabel: trackView.selectedTrackLabel,
            currentSelectionSummary: this._currentSelectionSummary(playlistView.selectedPlaylist, trackView.selectedTrackLabel),
            hasTracks: trackView.hasTracks,
            playlistSounds: trackView.playlistSounds,
            track: this.data.track,
            playlist: this.data.playlist,
            trackSelectDisabled: !this.data.playlist
        };
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        await game.maestro.hypeTrack?._setActorHypeFlags(
            this.actor,
            String(formData.playlist ?? ""),
            String(formData.track ?? "")
        );
    }

    override activateListeners(html: JQuery): void {
        super.activateListeners(html);

        const playlistSelect = html.find(".playlist-select");
        playlistSelect.on("change", (event) => {
            const nextPlaylistId = String((event.currentTarget as HTMLSelectElement).value ?? "");
            const previousTrack = this.data.track;

            this.data.playlist = nextPlaylistId;

            if (previousTrack && !isPlaybackMode(previousTrack)) {
                const nextPlaylist = game.playlists.get(nextPlaylistId);
                const stillExists = Boolean(nextPlaylist?.sounds?.get(previousTrack));
                if (!stillExists) {
                    this.data.track = "";
                }
            }

            this.render();
        });
    }
}

interface HypeTrackDefaultsFormData {
    defaultPlaylist: string;
    defaultTrack: string;
}

export class HypeTrackDefaultForm extends FormApplication<FormApplicationOptions, HypeTrackDefaultsFormData, {}>
{
    data: HypeTrackDefaultsFormData;

    constructor(data?: Partial<HypeTrackDefaultsFormData>, options?: Partial<FormApplicationOptions>) {
        super(data ?? {}, options ?? {});
        this.data = {
            defaultPlaylist: data?.defaultPlaylist ?? normalizeSetting(game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultPlaylist)),
            defaultTrack: data?.defaultTrack ?? normalizeSetting(game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultTrack))
        };
    }

    static override get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: "hype-track-default-form",
            title: "Default Hype Track",
            template: DEFAULT_CONFIG.HypeTrack.defaultFormTemplatePath,
            classes: ["sheet"],
            width: 500
        });
    }

    override getData(): {
        defaultPlaylist: string;
        defaultTrack: string;
        playlists: Playlist[];
        defaultPlaylistTracks: PlaylistSound[];
    } {
        return {
            defaultPlaylist: this.data.defaultPlaylist,
            defaultTrack: this.data.defaultTrack,
            playlists: game.playlists.contents,
            defaultPlaylistTracks: Playback.getPlaylistSounds(this.data.defaultPlaylist)
        };
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultPlaylist, String(formData["default-playlist"] ?? ""));
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.HypeTrack.defaultTrack, String(formData["default-track"] ?? ""));
    }

    override activateListeners(html: JQuery): void {
        super.activateListeners(html);

        const playlistSelect = html.find(".default-playlist-select");
        playlistSelect.on("change", (event) => {
            this.data.defaultPlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
            this.render();
        });
    }
}
