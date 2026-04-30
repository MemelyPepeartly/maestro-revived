// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_LABEL, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { isFirstGM } from "./misc.js";
import * as Playback from "./playback.js";

type CombatFlags = {
    playlist?: string;
    track?: string;
};

type CombatHistory = {
    round?: number;
    turn?: number | null;
};

type HeaderButton = {
    class: string;
    icon: string;
    label: string;
    onclick: (event: Event) => void;
};

type HeaderControl = {
    action: string;
    classes?: string;
    icon?: string;
    label: string;
    onClick?: (event: Event, target?: HTMLElement) => void;
    visible?: boolean;
};

type ApplicationV2Like = {
    constructor?: {
        name?: string;
    };
};

export default class CombatTrack {
    playlist: Playlist | null;
    pausedSounds: PlaylistSound[];

    constructor() {
        this.playlist = null;
        this.pausedSounds = [];
    }

    static async _onReady(): Promise<void> {
        if (!game.maestro.combatTrack?.playlist) {
            await game.maestro.combatTrack?._checkForCombatTracksPlaylist();
        }
    }

    static _onCombatTurnChange(combat: Combat, prior: CombatHistory, current: CombatHistory): void {
        const previousRound = Number(prior.round ?? 0);
        const nextRound = Number(current.round ?? combat.round ?? 0);
        if (previousRound === 0 && nextRound > 0) {
            void game.maestro.combatTrack?._getCombatTrack(combat);
        }
    }

    static _onDeleteCombat(combat: Combat): void {
        void game.maestro.combatTrack?._stopCombatTrack(combat);
    }

    static _onGetCombatTrackerConfigHeaderButtons(_app: Application, buttons: HeaderButton[]): void {
        CombatTrack._addCombatTrackHeaderButton(buttons);
    }

    static _onGetApplicationV2HeaderControls(app: ApplicationV2Like, controls: HeaderControl[]): void {
        if (CombatTrack._isCombatTrackerConfig(app)) {
            CombatTrack._addCombatTrackHeaderControl(controls);
        }
    }

    async _checkForCombatTracksPlaylist(): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.enable);
        const createPlaylist = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.createPlaylist);

        if (!isFirstGM() || !enabled || !createPlaylist) {
            return;
        }

        const existing = game.playlists.getName(DEFAULT_CONFIG.CombatTrack.playlistName);
        this.playlist = existing ?? (await Playlist.create({ name: DEFAULT_CONFIG.CombatTrack.playlistName }));
    }

    private static getCombatFlags(combat: Combat): CombatFlags | null {
        const flags = combat.flags?.[MODULE_NAME];
        if (!flags || typeof flags !== "object") {
            return null;
        }

        return flags as CombatFlags;
    }

    private static resolvePlaylistAndTrack(combat: Combat): { playlist: string; track: string } {
        const flags = CombatTrack.getCombatFlags(combat);
        const defaultPlaylist = String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultPlaylist) ?? "");
        const defaultTrack = String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultTrack) ?? "");

        return {
            playlist: String(flags?.playlist ?? defaultPlaylist),
            track: String(flags?.track ?? defaultTrack)
        };
    }

    async _getCombatTrack(combat: Combat): Promise<void> {
        if (!isFirstGM()) {
            return;
        }

        const { playlist, track } = CombatTrack.resolvePlaylistAndTrack(combat);
        if (!playlist || !track) {
            return;
        }

        const pauseOthers = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.pauseOthers);
        if (pauseOthers) {
            this.pausedSounds = await Playback.pauseAll();
        }

        if (track === DEFAULT_CONFIG.CombatTrack.playbackModes.all) {
            await Playback.playPlaylist(playlist);
            return;
        }

        await Playback.playTrack(track, playlist);
    }

    async _stopCombatTrack(combat: Combat): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.enable);
        if (!isFirstGM() || !enabled) {
            return;
        }

        const { playlist: playlistId } = CombatTrack.resolvePlaylistAndTrack(combat);
        if (!playlistId) {
            return;
        }

        const playlist = game.playlists.get(playlistId);
        if (!playlist) {
            await this._resumeOtherSounds();
            return;
        }

        if (playlist.playing) {
            await playlist.stopAll();
        }

        const soundsToStop = playlist.sounds.contents.filter((sound) => sound.playing || Boolean(sound.pausedTime));
        if (soundsToStop.length) {
            await playlist.updateEmbeddedDocuments(
                "PlaylistSound",
                soundsToStop.map((sound) => ({
                    _id: sound.id,
                    playing: false,
                    pausedTime: null
                }))
            );
        }

        await this._resumeOtherSounds();
        ui.playlists?.render();
    }

    private async _resumeOtherSounds(): Promise<void> {
        const shouldResume = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.pauseOthers);
        if (shouldResume && this.pausedSounds.length) {
            await Playback.resumeSounds(this.pausedSounds);
        }

        this.pausedSounds = [];
    }

    static _addCombatTrackHeaderButton(buttons: HeaderButton[]): void {
        if (!game.user.isGM) {
            return;
        }

        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.enable);
        if (!enabled) {
            return;
        }

        if (buttons.some((button) => button.class === DEFAULT_CONFIG.CombatTrack.name)) {
            return;
        }

        buttons.unshift({
            class: DEFAULT_CONFIG.CombatTrack.name,
            icon: DEFAULT_CONFIG.CombatTrack.buttonIcon,
            label: `${MODULE_LABEL} ${game.i18n.localize(DEFAULT_CONFIG.CombatTrack.aTitle)}`,
            onclick: () => {
                void CombatTrack._onCombatTrackButtonClick();
            }
        });
    }

    static _addCombatTrackHeaderControl(controls: HeaderControl[]): void {
        if (!game.user.isGM) {
            return;
        }

        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.enable);
        if (!enabled) {
            return;
        }

        if (controls.some((control) => control.action === DEFAULT_CONFIG.CombatTrack.name)) {
            return;
        }

        const label = `${MODULE_LABEL} ${game.i18n.localize(DEFAULT_CONFIG.CombatTrack.aTitle)}`;
        controls.unshift({
            action: DEFAULT_CONFIG.CombatTrack.name,
            classes: DEFAULT_CONFIG.CombatTrack.name,
            icon: DEFAULT_CONFIG.CombatTrack.buttonIcon,
            label,
            onClick: () => {
                void CombatTrack._onCombatTrackButtonClick();
            }
        });
    }

    private static _isCombatTrackerConfig(app: ApplicationV2Like): boolean {
        const CombatTrackerConfig = globalThis.foundry?.applications?.apps?.CombatTrackerConfig;
        if (typeof CombatTrackerConfig === "function" && app instanceof CombatTrackerConfig) {
            return true;
        }

        return app?.constructor?.name === "CombatTrackerConfig";
    }

    private static async _onCombatTrackButtonClick(): Promise<void> {
        const combat = game.combat ?? null;
        const flags = combat ? CombatTrack.getCombatFlags(combat) : null;
        CombatTrack._openTrackForm(
            combat,
            String(flags?.track ?? ""),
            String(flags?.playlist ?? ""),
            { closeOnSubmit: true }
        );
    }

    private static _openTrackForm(
        combat: Combat | null,
        track: string,
        playlist: string,
        options: Partial<FormApplicationOptions>
    ): void {
        new CombatTrackForm(
            combat,
            {
                defaultPlaylist: String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultPlaylist) ?? ""),
                defaultTrack: String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultTrack) ?? ""),
                currentTrack: track,
                currentPlaylist: playlist,
                playlists: game.playlists.contents
            },
            options
        ).render(true);
    }

    async setCombatFlags(combat: Combat, playlistId: string, trackId: string): Promise<Combat | undefined> {
        return combat.update({
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.CombatTrack.flagNames.playlist}`]: playlistId,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.CombatTrack.flagNames.track}`]: trackId
        });
    }
}

interface CombatTrackFormData {
    defaultPlaylist: string;
    defaultTrack: string;
    currentTrack: string;
    currentPlaylist: string;
    playlists: Playlist[];
}

class CombatTrackForm extends FormApplication<FormApplicationOptions, CombatTrackFormData, {}>
{
    combat: Combat | null;
    data: CombatTrackFormData;

    constructor(combat: Combat | null, data: CombatTrackFormData, options?: Partial<FormApplicationOptions>) {
        super(data, options ?? {});
        this.combat = combat;
        this.data = data;
    }

    static override get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: "combat-track-form",
            title: game.i18n.localize(DEFAULT_CONFIG.CombatTrack.aTitle),
            template: DEFAULT_CONFIG.CombatTrack.templatePath,
            classes: ["sheet"],
            width: 500,
            tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: game.combat ? "encounter" : "defaults" }]
        });
    }

    override getData(): {
        combat: Combat | null;
        defaultPlaylist: string;
        defaultTrack: string;
        defaultPlaylistTracks: PlaylistSound[];
        playlist: string;
        playlists: Playlist[];
        playlistTracks: PlaylistSound[];
        track: string;
    } {
        return {
            combat: this.combat,
            defaultPlaylist: this.data.defaultPlaylist,
            defaultTrack: this.data.defaultTrack,
            defaultPlaylistTracks: Playback.getPlaylistSounds(this.data.defaultPlaylist),
            playlist: this.data.currentPlaylist || "default",
            playlists: this.data.playlists,
            playlistTracks: Playback.getPlaylistSounds(this.data.currentPlaylist),
            track: this.data.currentTrack || "default"
        };
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        const defaultPlaylist = String(formData["default-playlist"] ?? "");
        const defaultTrack = String(formData["default-track"] ?? "");

        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultPlaylist, defaultPlaylist);
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.CombatTrack.defaultTrack, defaultTrack);

        if (!this.combat) {
            return;
        }

        const selectedPlaylist = String(formData.playlist ?? "default");
        const selectedTrack = String(formData.track ?? "default");
        if (selectedPlaylist === "default" && selectedTrack === "default") {
            return;
        }

        const playlist = selectedPlaylist === "default" ? defaultPlaylist : selectedPlaylist;
        await game.maestro.combatTrack?.setCombatFlags(this.combat, playlist, selectedTrack);
    }

    override activateListeners(html: JQuery): void {
        super.activateListeners(html);

        const defaultPlaylistSelect = html.find(".default-playlist-select");
        const playlistSelect = html.find(".playlist-select");

        if (defaultPlaylistSelect.length > 0) {
            defaultPlaylistSelect.on("change", (event) => {
                this.data.defaultPlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
                this.render();
            });
        }

        if (playlistSelect.length > 0) {
            playlistSelect.on("change", (event) => {
                this.data.currentPlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
                this.render();
            });
        }
    }
}


