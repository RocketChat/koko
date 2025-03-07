import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { UIKitViewSubmitInteractionContext } from "@rocket.chat/apps-engine/definition/uikit";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

import { KokoApp } from "../KokoApp";
import { getDirect, notifyUser, sendMessage } from "../lib/helpers";
import { messageSubmittedModal } from "../modals/SendModal";

export class KokoSend {
    constructor(private readonly app: KokoApp) {}

    /**
     * Handles the submit action for the Send Message modal
     * Sends a message to the specified room
     */
    public async submit({
        context,
        modify,
        read,
        persistence,
        http,
    }: {
        context: UIKitViewSubmitInteractionContext;
        modify: IModify;
        read: IRead;
        persistence: IPersistence;
        http: IHttp;
    }) {
        const data = context.getInteractionData();
        let roomToSend: IRoom | undefined;

        // Extract data from the modal submission
        const { send } = data.view.state as any;
        const messageToSend = send?.["message"];
        const roomNameInput = send?.["room"];
        const roomNameUser = send?.["user"];

        // Validate inputs
        const errors = {} as any;

        if (!messageToSend || messageToSend.trim().length === 0) {
            errors["message"] = "Please enter a message to send";
        }

        const roomName =
            roomNameInput?.trim() || roomNameUser?.trim() || undefined;
        if (!roomName) {
            errors["room"] = "Please enter a room name";
        } else if (roomName.startsWith("#")) {
            // Check if the room exists
            const room = await read
                .getRoomReader()
                .getByName(roomName.replace("#", ""));
            if (!room) {
                errors["room"] = `Room "${roomName}" not found`;
            } else {
                roomToSend = room;
            }
        } else if (roomName.startsWith("@")) {
            // Check if the user exists
            const user = await read
                .getUserReader()
                .getByUsername(roomName.replace("@", ""));

            if (!user) {
                errors["user"] = `User "${roomName}" not found`;
            } else {
                roomToSend = await getDirect(
                    this.app,
                    read,
                    modify,
                    roomName.replace("@", "")
                );
            }
        }

        // Return errors if validation fails
        if (Object.keys(errors).length > 0) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors,
            });
        }

        // Send the message
        await sendMessage(this.app, modify, roomToSend as IRoom, messageToSend);

        // Show confirmation modal
        const modal = await messageSubmittedModal({ read, modify, data });
        return context.getInteractionResponder().updateModalViewResponse(modal);
    }

    /**
     * Gets the direct message room between the user and the bot
     *
     * @param {IRead} read - The IRead instance
     * @param {IUser} user - The user to get the direct message room for
     * @param {IRoom} room - The room to get the direct message room for
     * @return {Promise<IRoom>} - The direct message room
     * @throws {Error} - If the direct message room is not found
     */
    private async getDirectRoom(
        read: IRead,
        user: IUser,
        room: IRoom
    ): Promise<IRoom> {
        // const directRoom = await getDirect(this.app, read, user, room);

        // // Check if the direct room exists
        // if (!directRoom) {
        //     throw new Error(`Direct message room not found`);
        // }

        // return directRoom;
        return room;
    }
}
