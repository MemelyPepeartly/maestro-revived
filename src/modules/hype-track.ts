// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { isFirstGM } from "./misc.js";
import * as Playback from "./playback.js";

type HypeFlags = {
    playlist?: string;
    track?: string;
};

function hasNumeric(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isPlaybackMode(value: string): boolean {
    return value === DEFAULT_CONFIG.ItemTrack.playbackModes.all || value === DEFAULT_CONFIG.ItemTrack.playbackModes.random;
}

export default class HypeTrack {
    playlist: Playlist | null;
    pausedSounds: PlaylistSound[];

    constructor() {
        this.playlist = null;
        this.pausedSounds = [];
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

        if (this.playlist.playing) {
            await this.playlist.stopAll();
        }

        const combatantActor = combat.combatant?.actor ?? null;
        const flags = this._getActorHypeFlags(combatantActor);
        const track = flags?.track ?? "";
        const playlistId = flags?.playlist ?? this.playlist.id;

        if (!track) {
            await this._resumeOthers();
            return;
        }

        const pauseOthers = game.settings.get(MODULE_NAME, SETTINGS_KEYS.HypeTrack.pauseOthers);
        if (pauseOthers) {
            const paused = await Playback.pauseAll();
            this.pausedSounds = this.pausedSounds.concat(paused);
        }

        if (track === DEFAULT_CONFIG.ItemTrack.playbackModes.all) {
            await Playback.playPlaylist(playlistId);
        } else {
            await Playback.playTrack(track, playlistId);
        }

        if (!isPlaybackMode(track) && this.pausedSounds.length) {
            const playlist = game.playlists.get(playlistId);
            const sound = playlist?.sounds.get(track);

            sound?.sound?.once("end", () => {
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

        const hypeTrack = this._getActorHypeTrack(actor);
        if (!hypeTrack) {
            if (warn) {
                ui.notifications?.warn(game.i18n.localize("MAESTRO.HYPE-TRACK.PlayHype.NoTrack"));
            }
            return;
        }

        const playlist = this.playlist
            ?? game.playlists.contents.find(
                (entry) => entry.name === DEFAULT_CONFIG.HypeTrack.playlistName || entry.sounds.contents.some((sound) => sound.id === hypeTrack)
            )
            ?? null;

        if (!playlist) {
            if (warn) {
                ui.notifications?.warn(game.i18n.localize("MAESTRO.HYPE-TRACK.PlayHype.NoPlaylist"));
            }
            return;
        }

        return Playback.playTrack(hypeTrack, playlist.id);
    }

    async _stopHypeTrack(): Promise<void> {
        if (!this.playlist || !isFirstGM()) {
            return;
        }

        if (this.playlist.playing) {
            await this.playlist.stopAll();
        }

        const activeSounds = this.playlist.sounds.contents.filter((sound) => sound.playing || Boolean(sound.pausedTime));
        if (activeSounds.length) {
            await this.playlist.updateEmbeddedDocuments(
                "PlaylistSound",
                activeSounds.map((sound) => ({ _id: sound.id, playing: false, pausedTime: null }))
            );
        }

        ui.playlists?.render();
    }
}

interface HypeTrackFormData {
    track: string;
    playlist: string;
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
            width: 500
        });
    }

    override getData(): {
        playlistSounds: PlaylistSound[];
        track: string;
        playlist: string;
        playlists: Playlist[];
    } {
        return {
            playlistSounds: Playback.getPlaylistSounds(this.data.playlist),
            track: this.data.track,
            playlist: this.data.playlist,
            playlists: game.playlists.contents
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
            this.data.playlist = String((event.currentTarget as HTMLSelectElement).value ?? "");
            this.render();
        });
    }
}


