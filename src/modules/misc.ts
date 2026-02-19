// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import * as Playback from "./playback.js";

interface CriticalTrackSettings {
    criticalSuccessPlaylist: string;
    criticalSuccessSound: string;
    criticalFailurePlaylist: string;
    criticalFailureSound: string;
}

function getCriticalTrackSettings(): CriticalTrackSettings {
    const value = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessFailureTracks);

    if (!value || typeof value !== "object") {
        return {
            criticalSuccessPlaylist: "",
            criticalSuccessSound: "",
            criticalFailurePlaylist: "",
            criticalFailureSound: ""
        };
    }

    const settings = value as Record<string, unknown>;

    const normalizePlaylistField = (field: unknown): string => {
        if (typeof field === "string") {
            return field;
        }

        if (field && typeof field === "object" && "id" in (field as Record<string, unknown>)) {
            const id = (field as Record<string, unknown>).id;
            return typeof id === "string" ? id : "";
        }

        return "";
    };

    return {
        criticalSuccessPlaylist: normalizePlaylistField(settings.criticalSuccessPlaylist),
        criticalSuccessSound: typeof settings.criticalSuccessSound === "string" ? settings.criticalSuccessSound : "",
        criticalFailurePlaylist: normalizePlaylistField(settings.criticalFailurePlaylist),
        criticalFailureSound: typeof settings.criticalFailureSound === "string" ? settings.criticalFailureSound : ""
    };
}

export function _onRenderPlaylistDirectory(_app: unknown, html: JQuery): void {
    _addPlaylistLoopToggle(html);
}

export class MaestroConfigForm extends FormApplication<FormApplicationOptions, CriticalTrackSettings, {}>
{
    data: CriticalTrackSettings;

    constructor(data?: Partial<CriticalTrackSettings>, options?: Partial<FormApplicationOptions>) {
        super(data ?? {}, options ?? {});

        const base = getCriticalTrackSettings();
        this.data = {
            criticalSuccessPlaylist: data?.criticalSuccessPlaylist ?? base.criticalSuccessPlaylist,
            criticalSuccessSound: data?.criticalSuccessSound ?? base.criticalSuccessSound,
            criticalFailurePlaylist: data?.criticalFailurePlaylist ?? base.criticalFailurePlaylist,
            criticalFailureSound: data?.criticalFailureSound ?? base.criticalFailureSound
        };
    }

    static override get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: "maestro-config",
            title: DEFAULT_CONFIG.Misc.maestroConfigTitle,
            template: DEFAULT_CONFIG.Misc.maestroConfigTemplatePath,
            classes: ["sheet"],
            width: 500
        });
    }

    override getData(): {
        playlists: Playlist[];
        criticalSuccessPlaylist: string;
        criticalSuccessPlaylistSounds: PlaylistSound[];
        criticalSuccessSound: string;
        criticalFailurePlaylist: string;
        criticalFailurePlaylistSounds: PlaylistSound[];
        criticalFailureSound: string;
    } {
        return {
            playlists: game.playlists.contents,
            criticalSuccessPlaylist: this.data.criticalSuccessPlaylist,
            criticalSuccessPlaylistSounds: Playback.getPlaylistSounds(this.data.criticalSuccessPlaylist),
            criticalSuccessSound: this.data.criticalSuccessSound,
            criticalFailurePlaylist: this.data.criticalFailurePlaylist,
            criticalFailurePlaylistSounds: Playback.getPlaylistSounds(this.data.criticalFailurePlaylist),
            criticalFailureSound: this.data.criticalFailureSound
        };
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessFailureTracks, {
            criticalSuccessPlaylist: String(formData["critical-success-playlist"] ?? ""),
            criticalSuccessSound: String(formData["critical-success-sound"] ?? ""),
            criticalFailurePlaylist: String(formData["critical-failure-playlist"] ?? ""),
            criticalFailureSound: String(formData["critical-failure-sound"] ?? "")
        });
    }

    override activateListeners(html: JQuery): void {
        super.activateListeners(html);

        const criticalPlaylistSelect = html.find("select[name='critical-success-playlist']");
        const failurePlaylistSelect = html.find("select[name='critical-failure-playlist']");

        if (criticalPlaylistSelect.length > 0) {
            criticalPlaylistSelect.on("change", (event) => {
                this.data.criticalSuccessPlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
                this.render();
            });
        }

        if (failurePlaylistSelect.length > 0) {
            failurePlaylistSelect.on("change", (event) => {
                this.data.criticalFailurePlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
                this.render();
            });
        }
    }
}

function _addPlaylistLoopToggle(html: JQuery): void {
    if (!game.user.isGM) {
        return;
    }

    // Prevent duplicates on repeated directory renders.
    html.find("[data-action='playlist-loop']").remove();

    const playlistModeButtons = html.find("[data-action='playlist-mode']");
    if (!playlistModeButtons.length) {
        return;
    }

    const loopToggleHtml =
        `<a class="sound-control" data-action="playlist-loop" title="${game.i18n.localize("MAESTRO.PLAYLIST-LOOP.ButtonTooltipLoop")}">` +
        `<i class="fas fa-sync"></i>` +
        "</a>";

    playlistModeButtons.after(loopToggleHtml);

    const loopToggleButtons = html.find("[data-action='playlist-loop']");
    for (const button of loopToggleButtons.toArray()) {
        const playlistDiv = button.closest(".document");
        const playlistId = playlistDiv?.getAttribute("data-document-id");
        if (!playlistId) {
            continue;
        }

        const playlist = game.playlists.get(playlistId);
        if (!playlist) {
            continue;
        }

        const controlsDiv = button.closest(".playlist-controls");
        controlsDiv?.setAttribute("style", "flex-basis: 110px;");

        const originalClass = button.getAttribute("class") ?? "";
        const loopFlag = playlist.getFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.loop);
        const mode = playlist.mode;

        if ([-1, 2].includes(mode)) {
            button.setAttribute("class", `${originalClass} disabled`.trim());
            button.setAttribute("title", game.i18n.localize("MAESTRO.PLAYLIST-LOOP.ButtonToolTipDisabled"));
        } else if (loopFlag === false) {
            button.setAttribute("class", `${originalClass} inactive`.trim());
            button.setAttribute("title", game.i18n.localize("MAESTRO.PLAYLIST-LOOP.ButtonTooltipNoLoop"));
        }
    }

    loopToggleButtons.on("click", async (event) => {
        const button = event.currentTarget as HTMLElement;
        const buttonClass = button.getAttribute("class") ?? "";
        if (buttonClass.includes("disabled")) {
            return;
        }

        const playlistDiv = button.closest(".document");
        const playlistId = playlistDiv?.getAttribute("data-document-id");
        if (!playlistId) {
            return;
        }

        const playlist = game.playlists.get(playlistId);
        if (!playlist) {
            return;
        }

        if (buttonClass.includes("inactive")) {
            await playlist.unsetFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.loop);
            button.setAttribute("class", buttonClass.replace(" inactive", ""));
            button.setAttribute("title", game.i18n.localize("MAESTRO.PLAYLIST-LOOP.ButtonTooltipLoop"));
        } else {
            await playlist.setFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.loop, false);
            button.setAttribute("class", `${buttonClass} inactive`.trim());
            button.setAttribute("title", game.i18n.localize("MAESTRO.PLAYLIST-LOOP.ButtonTooltipNoLoop"));
        }
    });
}

/**
 * Playlist sound pre-update handler for "loop unless disabled" behavior.
 */
export function _onPreUpdatePlaylistSound(sound: PlaylistSound, update: Record<string, unknown>): void {
    const playlist = sound.parent;
    if (!playlist?.playing || ![0, 1].includes(playlist.mode)) {
        return;
    }

    const incomingPlaying = update.playing;
    const soundId = String(update._id ?? update.id ?? sound.id);

    if (incomingPlaying === false) {
        void playlist.setFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound, soundId);
        return;
    }

    if (incomingPlaying !== true) {
        return;
    }

    const previousSound = playlist.getFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound);
    if (!previousSound) {
        return;
    }

    const order = playlist.mode === 1 ? playlist.playbackOrder : playlist.sounds.contents.map((entry) => entry.id);
    const previousIdx = order.indexOf(String(previousSound));
    const loopFlag = playlist.getFlag(MODULE_NAME, DEFAULT_CONFIG.PlaylistLoop.flagNames.loop);

    if (previousIdx === order.length - 1 && loopFlag === false) {
        update.playing = false;
        playlist.playing = false;
    }
}

/**
 * Pre-create chat message handler.
 */
export function _onPreCreateChatMessage(message: ChatMessage, data: Record<string, unknown>): void {
    const removeDiceSound = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.disableDiceSound);
    if (!removeDiceSound) {
        return;
    }

    const currentSound = typeof data.sound === "string" ? data.sound : message.sound;
    if (currentSound === "sounds/dice.wav") {
        data.sound = "";
    }
}

/**
 * Render chat message handler.
 */
export function _onRenderChatMessage(message: ChatMessage): void {
    const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks);
    if (enabled) {
        void playCriticalSuccessFailure(message);
    }
}

async function playCriticalSuccessFailure(message: ChatMessage): Promise<void> {
    if (!isFirstGM() || !message.isRoll || !message.isContentVisible) {
        return;
    }

    for (const roll of message.rolls) {
        await checkRollSuccessFailure(roll);
    }
}

async function checkRollSuccessFailure(roll: Roll): Promise<void> {
    if (!roll.dice.length) {
        return;
    }

    const die = roll.dice[0];
    const faceSetting = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.criticalDieFaces) as number;
    const facesMatch = die.faces === faceSetting && die.results.length === 1;
    if (!facesMatch) {
        return;
    }

    const firstResult = die.results[0] as Record<string, unknown>;
    const isModifiedRoll = ("success" in firstResult) || Boolean(roll.options?.marginSuccess) || Boolean(roll.options?.marginFailure);
    if (isModifiedRoll) {
        return;
    }

    const tracks = getCriticalTrackSettings();
    const successSetting = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessThreshold) as number;
    const failureSetting = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.criticalFailureThreshold) as number;

    const successThreshold = successSetting ?? Number(roll.options?.critical ?? 20);
    const failureThreshold = failureSetting ?? Number(roll.options?.fumble ?? 1);
    const total = Number((die as unknown as { total?: number }).total ?? roll.total ?? 0);

    if (successThreshold && total >= successThreshold && tracks.criticalSuccessPlaylist && tracks.criticalSuccessSound) {
        await Playback.playTrack(tracks.criticalSuccessSound, tracks.criticalSuccessPlaylist);
        return;
    }

    if (failureThreshold && total <= failureThreshold && tracks.criticalFailurePlaylist && tracks.criticalFailureSound) {
        await Playback.playTrack(tracks.criticalFailureSound, tracks.criticalFailurePlaylist);
    }
}

/**
 * Checks for the Critical Success playlist, creates one if not found.
 */
export async function _checkForCriticalPlaylist(): Promise<void> {
    const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks);
    const createPlaylist = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.createCriticalSuccessPlaylist);

    if (!isFirstGM() || !enabled || !createPlaylist) {
        return;
    }

    let playlist = game.playlists.contents.find((entry) => entry.name === DEFAULT_CONFIG.Misc.criticalSuccessPlaylistName);
    if (!playlist) {
        playlist = await Playlist.create({ name: DEFAULT_CONFIG.Misc.criticalSuccessPlaylistName });
    }

    const tracks = getCriticalTrackSettings();
    if (!tracks.criticalSuccessPlaylist && playlist) {
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessFailureTracks, {
            ...tracks,
            criticalSuccessPlaylist: playlist.id
        });
    }
}

/**
 * Checks for the Critical Failure playlist, creates one if not found.
 */
export async function _checkForFailurePlaylist(): Promise<void> {
    const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks);
    const createPlaylist = game.settings.get(MODULE_NAME, SETTINGS_KEYS.Misc.createCriticalFailurePlaylist);

    if (!isFirstGM() || !enabled || !createPlaylist) {
        return;
    }

    let playlist = game.playlists.contents.find((entry) => entry.name === DEFAULT_CONFIG.Misc.criticalFailurePlaylistName);
    if (!playlist) {
        playlist = await Playlist.create({ name: DEFAULT_CONFIG.Misc.criticalFailurePlaylistName });
    }

    const tracks = getCriticalTrackSettings();
    if (!tracks.criticalFailurePlaylist && playlist) {
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.Misc.criticalSuccessFailureTracks, {
            ...tracks,
            criticalFailurePlaylist: playlist.id
        });
    }
}

/**
 * Gets the first active GM user sorted by user id.
 */
export function getFirstActiveGM(): User | undefined {
    return game.users
        .filter((user) => user.isGM && user.active)
        .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))[0];
}

/**
 * Checks if the current user is the first active GM.
 */
export function isFirstGM(): boolean {
    return game.userId === getFirstActiveGM()?.id;
}


