// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { isFirstGM } from "./misc.js";
import * as Playback from "./playback.js";

type ItemTrackFlags = {
    playlist?: string;
    track?: string;
    [key: string]: unknown;
};

type DeletedItemStore = Record<string, ItemTrackFlags>;

function getDeletedItems(): DeletedItemStore {
    const value = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.deletedItems);
    return value && typeof value === "object" ? (value as DeletedItemStore) : {};
}

function getPlayableTrack(track: string | undefined): string {
    return typeof track === "string" ? track : "";
}

export default class ItemTrack {
    playlist: Playlist | null;

    constructor() {
        this.playlist = null;
    }

    static async _onReady(): Promise<void> {
        await game.maestro.itemTrack?._checkForItemTracksPlaylist();
    }

    static async _onDeleteItem(item: Item): Promise<void> {
        await game.maestro.itemTrack?._deleteItemHandler(item);
    }

    static async _onRenderChatMessage(message: ChatMessage, html: JQuery): Promise<void> {
        await game.maestro.itemTrack?._chatMessageHandler(message, html);
    }

    static async _onRenderItemSheet(app: ItemSheet, html: JQuery): Promise<void> {
        await game.maestro.itemTrack?._addItemTrackButton(app, html);
    }

    async _checkForItemTracksPlaylist(): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        const createPlaylist = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.createPlaylist);

        if (!isFirstGM() || !enabled || !createPlaylist) {
            return;
        }

        const existing = game.playlists.getName(DEFAULT_CONFIG.ItemTrack.playlistName);
        this.playlist = existing ?? (await Playlist.create({ name: DEFAULT_CONFIG.ItemTrack.playlistName }));
    }

    private getItemFlags(item: Item | null | undefined): ItemTrackFlags | null {
        const flags = item?.flags?.[MODULE_NAME];
        if (!flags || typeof flags !== "object") {
            return null;
        }

        return flags as ItemTrackFlags;
    }

    async _deleteItemHandler(item: Item): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !isFirstGM() || !item.isOwned) {
            return;
        }

        const flags = this.getItemFlags(item);
        if (!flags) {
            return;
        }

        const deletedItems = getDeletedItems();
        if (deletedItems[item.id]) {
            return;
        }

        deletedItems[item.id] = flags;
        await game.settings.set(MODULE_NAME, SETTINGS_KEYS.ItemTrack.deletedItems, deletedItems);
    }

    async _chatMessageHandler(message: ChatMessage, html: JQuery): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !isFirstGM()) {
            return;
        }

        const itemIdentifier = String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.itemIdAttribute) ?? "data-item-id");
        const itemCard = html.find(`[${itemIdentifier}]`);
        const trackPlayed = message.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.played);
        if (!itemCard.length || trackPlayed) {
            return;
        }

        const itemId = String(itemCard.attr(itemIdentifier) ?? "");
        if (!itemId) {
            return;
        }

        const actor = await this._resolveChatSpeakerActor(message);
        const item = actor?.items?.get(itemId) ?? game.items.get(itemId) ?? null;
        const flags = item ? this.getItemFlags(item) : getDeletedItems()[itemId] ?? null;

        if (!flags) {
            return;
        }

        const track = getPlayableTrack(flags.track);
        const playlist = String(flags.playlist ?? "");
        if (!track || !playlist) {
            return;
        }

        if (track === DEFAULT_CONFIG.ItemTrack.playbackModes.all) {
            await Playback.playPlaylist(playlist);
        } else {
            await Playback.playTrack(track, playlist);
        }

        await this._setChatMessageFlag(message);
    }

    private async _resolveChatSpeakerActor(message: ChatMessage): Promise<Actor | null> {
        const speaker = message.speaker;
        const tokenId = speaker?.token ?? "";
        const sceneId = speaker?.scene ?? "";
        const actorId = speaker?.actor ?? "";

        if (tokenId && sceneId) {
            const token = (await fromUuid(`Scene.${sceneId}.Token.${tokenId}`)) as TokenDocument | null;
            const tokenActor = token?.actor ?? null;
            if (tokenActor) {
                return tokenActor;
            }
        }

        return actorId ? game.actors.get(actorId) ?? null : null;
    }

    async _addItemTrackButton(app: ItemSheet, html: JQuery): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !app.isEditable) {
            return;
        }

        if (html.find(`.${DEFAULT_CONFIG.ItemTrack.name}`).length > 0) {
            return;
        }

        const button = $(
            `<a class="${DEFAULT_CONFIG.ItemTrack.name}" title="${DEFAULT_CONFIG.ItemTrack.aTitle}">` +
            `<i class="${DEFAULT_CONFIG.ItemTrack.buttonIcon}"></i>` +
            `<span>${DEFAULT_CONFIG.ItemTrack.buttonText}</span>` +
            "</a>"
        );

        const header = html.find(".window-header");
        const closeButton = header.find(".close");
        closeButton.before(button);

        button.on("click", () => {
            const item = this._resolveSheetItem(app);
            if (!item) {
                return;
            }

            const flags = this.getItemFlags(item);
            this._openTrackForm(item, flags?.track ?? "", flags?.playlist ?? "", { closeOnSubmit: true });
        });
    }

    private _resolveSheetItem(app: ItemSheet): Item | null {
        if (!app.document) {
            return null;
        }

        if (!app.document.isOwned) {
            return app.document;
        }

        const actor = app.document.actor;
        const itemId = app.document.id;
        if (!actor || !itemId) {
            return null;
        }

        if (actor.isToken && actor.token) {
            const tokenActor = canvas.tokens?.get(actor.token.id)?.actor;
            return tokenActor?.items?.get(itemId) ?? null;
        }

        return game.actors.get(actor.id)?.items?.get(itemId) ?? null;
    }

    private _openTrackForm(item: Item, track: string, playlist: string, options: Partial<FormApplicationOptions>): void {
        new ItemTrackForm(
            item,
            {
                currentTrack: track,
                currentPlaylist: playlist,
                playlists: game.playlists.contents
            },
            options
        ).render(true);
    }

    async setItemFlags(item: Item, playlistId: string, trackId: string): Promise<Item | undefined> {
        return item.update({
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.playlist}`]: playlistId,
            [`flags.${MODULE_NAME}.${DEFAULT_CONFIG.ItemTrack.flagNames.track}`]: trackId
        });
    }

    private async _setChatMessageFlag(message: ChatMessage): Promise<void> {
        await message.setFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.played, true);
    }
}

interface ItemTrackFormPayload {
    currentTrack: string;
    currentPlaylist: string;
    playlists: Playlist[];
}

class ItemTrackForm extends FormApplication<FormApplicationOptions, ItemTrackFormPayload, {}>
{
    item: Item;
    data: ItemTrackFormPayload;

    constructor(item: Item, data: ItemTrackFormPayload, options?: Partial<FormApplicationOptions>) {
        super(data, options ?? {});
        this.item = item;
        this.data = data;
    }

    static override get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: "item-track-form",
            title: DEFAULT_CONFIG.ItemTrack.aTitle,
            template: DEFAULT_CONFIG.ItemTrack.templatePath,
            classes: ["sheet"],
            width: 500
        });
    }

    override getData(): {
        playlist: string;
        playlists: Playlist[];
        playlistTracks: PlaylistSound[];
        track: string;
    } {
        return {
            playlist: this.data.currentPlaylist,
            playlists: this.data.playlists,
            playlistTracks: Playback.getPlaylistSounds(this.data.currentPlaylist),
            track: this.data.currentTrack
        };
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        await game.maestro.itemTrack?.setItemFlags(
            this.item,
            String(formData.playlist ?? ""),
            String(formData.track ?? "")
        );
    }

    override activateListeners(html: JQuery): void {
        super.activateListeners(html);

        const playlistSelect = html.find(".playlist-select");
        if (playlistSelect.length > 0) {
            playlistSelect.on("change", (event) => {
                this.data.currentPlaylist = String((event.currentTarget as HTMLSelectElement).value ?? "");
                this.render();
            });
        }
    }
}


