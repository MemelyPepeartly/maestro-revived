// @ts-nocheck
import { DEFAULT_CONFIG, MODULE_NAME, SETTINGS_KEYS } from "./config.js";
import { MaestroFormApplication, maestroFormPart } from "./form-application-v2.js";
import { isFirstGM } from "./misc.js";
import * as Playback from "./playback.js";

type ItemTrackFlags = {
    playlist?: string;
    track?: string;
    [key: string]: unknown;
};

type DeletedItemStore = Record<string, ItemTrackFlags>;

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

type DocumentApplication = {
    document?: unknown;
    isEditable?: boolean;
};

function asJQuery(html: JQuery | HTMLElement | string): JQuery {
    return html instanceof HTMLElement ? $(html) : $(html);
}

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

    static async _onRenderChatMessage(message: ChatMessage, html: JQuery | HTMLElement | string): Promise<void> {
        await game.maestro.itemTrack?._chatMessageHandler(message, html);
    }

    static _onGetItemSheetHeaderButtons(app: ItemSheet, buttons: HeaderButton[]): void {
        game.maestro.itemTrack?._addItemTrackHeaderButton(app, buttons);
    }

    static _onGetApplicationV2HeaderControls(app: DocumentApplication, controls: HeaderControl[]): void {
        game.maestro.itemTrack?._addItemTrackHeaderControl(app, controls);
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

    async _chatMessageHandler(message: ChatMessage, html: JQuery | HTMLElement | string): Promise<void> {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !isFirstGM()) {
            return;
        }

        const itemIdentifier = String(game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.itemIdAttribute) ?? "data-item-id");
        const itemCard = asJQuery(html).find(`[${itemIdentifier}]`);
        const trackPlayed = message.getFlag(MODULE_NAME, DEFAULT_CONFIG.ItemTrack.flagNames.played);
        if (!itemCard.length || trackPlayed) {
            return;
        }

        const itemId = String(itemCard.attr(itemIdentifier) ?? "");
        if (!itemId) {
            return;
        }

        const actor = await this._resolveChatSpeakerActor(message);
        const messageItem = (message as unknown as { item?: Item | null }).item ?? null;
        const item = messageItem ?? actor?.items?.get(itemId) ?? game.items.get(itemId) ?? null;
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

    _addItemTrackHeaderButton(app: ItemSheet, buttons: HeaderButton[]): void {
        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !app.isEditable) {
            return;
        }

        if (buttons.some((button) => button.class === DEFAULT_CONFIG.ItemTrack.name)) {
            return;
        }

        buttons.unshift({
            class: DEFAULT_CONFIG.ItemTrack.name,
            icon: DEFAULT_CONFIG.ItemTrack.buttonIcon,
            label: DEFAULT_CONFIG.ItemTrack.buttonText.trim(),
            onclick: () => {
                const item = this._resolveSheetItem(app);
                if (!item) {
                    return;
                }

                const flags = this.getItemFlags(item);
                this._openTrackForm(item, flags?.track ?? "", flags?.playlist ?? "", { closeOnSubmit: true });
            }
        });
    }

    _addItemTrackHeaderControl(app: DocumentApplication, controls: HeaderControl[]): void {
        if (!(app.document instanceof Item)) {
            return;
        }

        const enabled = game.settings.get(MODULE_NAME, SETTINGS_KEYS.ItemTrack.enable);
        const editable = app.isEditable ?? app.document.isOwner;
        if (!enabled || !editable) {
            return;
        }

        if (controls.some((control) => control.action === DEFAULT_CONFIG.ItemTrack.name)) {
            return;
        }

        controls.unshift({
            action: DEFAULT_CONFIG.ItemTrack.name,
            classes: DEFAULT_CONFIG.ItemTrack.name,
            icon: DEFAULT_CONFIG.ItemTrack.buttonIcon,
            label: DEFAULT_CONFIG.ItemTrack.aTitle,
            onClick: () => {
                const item = app.document as Item;
                const flags = this.getItemFlags(item);
                this._openTrackForm(item, flags?.track ?? "", flags?.playlist ?? "", { closeOnSubmit: true });
            }
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

    private _openTrackForm(item: Item, track: string, playlist: string, options: Record<string, unknown>): void {
        new ItemTrackForm(
            item,
            {
                currentTrack: track,
                currentPlaylist: playlist,
                playlists: game.playlists.contents
            },
            options
        ).render({ force: true });
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

class ItemTrackForm extends MaestroFormApplication
{
    item: Item;
    data: ItemTrackFormPayload;

    constructor(item: Item, data: ItemTrackFormPayload, options?: Record<string, unknown>) {
        super(data, options ?? {});
        this.item = item;
        this.data = data;
    }

    static override DEFAULT_OPTIONS = {
        id: "item-track-form",
        window: {
            title: DEFAULT_CONFIG.ItemTrack.aTitle
        },
        position: {
            width: 500
        }
    };

    static override PARTS = {
        body: maestroFormPart(DEFAULT_CONFIG.ItemTrack.templatePath)
    };

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
                void this.render({ force: true });
            });
        }
    }
}


