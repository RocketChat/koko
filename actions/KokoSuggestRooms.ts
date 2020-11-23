import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from '../KokoApp';
import { notifyUser } from '../lib/helpers';
import { ISuggestedRoomsStorage, SuggestedRoomsAssociationID,  } from '../storage/ISuggestedRoomStorage';
import { suggestedRoomsModal } from '../modals/SuggestedRoomsModal';
import { failedToRemoveRoomModal, successRemovingRoomsModal, removeRoomsModal } from '../modals/RemoveRoomsModal';
import { IUIKitInteractionParam } from '@rocket.chat/apps-engine/definition/accessors/IUIController';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';

export class KokoSuggestRooms {
    constructor(private readonly app: KokoApp) { }

    public getAssociation(): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, SuggestedRoomsAssociationID);;
    }

    public async setRooms(persistence: IPersistence, suggested: ISuggestedRoomsStorage): Promise<Boolean> {
        const assoc = this.getAssociation();

        try {
            await persistence.updateByAssociation(assoc, suggested, true);
            return true;
        } catch  (e) {
            this.app.getLogger().log(e);
            return false;
        }
    }

    public hasRooms(rooms: (ISuggestedRoomsStorage[] | void)): Boolean {
        return !!(rooms && rooms.length);
    }

    public async getRooms(read: IRead): Promise<ISuggestedRoomsStorage[] | void> {
        const assoc = this.getAssociation();

        try {
            // Get persistence
            const currentRoomsPersistence = await read.getPersistenceReader().readByAssociation(assoc);
            return currentRoomsPersistence as ISuggestedRoomsStorage[];
        } catch (error) {
            this.app.getLogger().log(error);
        }
    }

    public async suggestRooms(interaction: IUIKitInteractionParam, user: IUser, read: IRead, modify: IModify, room: IRoom) {
        const suggestedRooms = await this.getRooms(read);

        if (!this.hasRooms(suggestedRooms))  {
            const text = 'No suggested rooms yet. Run "/koko help" on how to register room suggestions';
            return notifyUser(this.app, modify, room, user, text);
        }

        const modal = await suggestedRoomsModal({ suggestedRooms: suggestedRooms[0], modify });
        return modify.getUiController().openModalView(modal, interaction, user);
    }

    public async removeRoomPrompt(interaction: IUIKitInteractionParam, user: IUser, read: IRead, modify: IModify, room: IRoom) {
        const suggestedRooms = await this.getRooms(read);

        if (!this.hasRooms(suggestedRooms))  {
            const text = 'No suggested rooms yet. Run "/koko help" on how to register room suggestions';
            return notifyUser(this.app, modify, room, user, text);
        }

        const modal = await removeRoomsModal({ suggestedRooms: suggestedRooms[0], modify });
        return modify.getUiController().openModalView(modal, interaction, user);
    }

    public async removeRooms(roomNames: string[], modify: IModify, read: IRead, persistence: IPersistence): Promise<Boolean> {
        const suggestedRooms = await this.getRooms(read);

        if (!this.hasRooms(suggestedRooms))  {
            return false;
        }

        const newSuggestedRooms = { rooms: suggestedRooms[0].rooms.filter(({ name }) => !roomNames.some((roomName) => name === roomName ))} as ISuggestedRoomsStorage;

        if (!newSuggestedRooms.rooms.length) {
            const assoc = this.getAssociation();
            try {
                await persistence.removeByAssociation(assoc);
                return true;
            } catch (error) {
                this.app.getLogger().log(error);
                return false;
            }
        }

        const result = await this.setRooms(persistence, newSuggestedRooms);

        if (!result) {
            return false;
        }

        return true;
    }

    public async removeRoomSubmit({ context, modify, read, persistence }: { context: UIKitViewSubmitInteractionContext, modify: IModify, read: IRead, persistence: IPersistence }) {
        const data = context.getInteractionData();
        const { values: { rooms } }: {
            values: {
                rooms: Array<string>,
            },
        } = data.view.state as any;

        if (rooms.length < 1) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors: { rooms: 'Select at least one room' },
            });
        }

        const result = await this.removeRooms(rooms, modify, read, persistence);

        if (!result) {
            const modal = await failedToRemoveRoomModal(read, modify);
            return context.getInteractionResponder().updateModalViewResponse(modal);
        }

        const modal = await successRemovingRoomsModal(modify);
        return context.getInteractionResponder().updateModalViewResponse(modal);
    }

}
