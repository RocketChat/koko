import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { UIKitViewSubmitInteractionContext } from "@rocket.chat/apps-engine/definition/uikit";

import { KokoApp } from "../KokoApp";
import { getDirect, sendMessage } from "../lib/helpers";
import { messageSubmittedModal } from "../modals/SendModal";

export class KokoSend {
    constructor(private readonly app: KokoApp) {}

    /**
     * Handles the submit action for the Send Message modal
     * Validates input and sends message to the specified room or user
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
        const { send } = data.view.state as any;

        // Extract and validate message content
        const messageToSend = send?.["message"];
        if (!messageToSend?.trim()) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors: {
                    message: "Please enter a message to send",
                },
            });
        }

        // Determine target room (channel or user)
        const target = send?.["target"];
        const roomName = target?.trim();

        // Validate room name
        if (!roomName) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors: {
                    target: "Please enter a valid room or user name",
                },
            });
        }

        // Find target room
        try {
            const targetRoom = await this.resolveTargetRoom(
                read,
                modify,
                roomName
            );

            if (!targetRoom) {
                const entityType = roomName.startsWith("@") ? "User" : "Room";

                return context.getInteractionResponder().viewErrorResponse({
                    viewId: data.view.id,
                    errors: {
                        "target": `${entityType} "${roomName}" not found. Please check the name and try again.`,
                    },
                });
            }

            // Send the message
            await sendMessage(this.app, modify, targetRoom, messageToSend);

            // Show confirmation modal
            const modal = await messageSubmittedModal({ read, modify, data });
            return context
                .getInteractionResponder()
                .updateModalViewResponse(modal);
        } catch (error) {
            // Handle errors during room resolution or message sending
            this.app
                .getLogger()
                .error(`Error in send command: ${error.message}`);

            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors: {
                    message:
                        "An error occurred while sending your message. Please try again.",
                },
            });
        }
    }

    /**
     * Resolves a room name or username to an actual room object
     *
     * @param {IRead} read - The read accessor
     * @param {IModify} modify - The modify accessor
     * @param {string} target - The target room name or username (with # or @ prefix)
     * @returns {Promise<IRoom|undefined>} The resolved room or undefined if not found
     */
    private async resolveTargetRoom(
        read: IRead,
        modify: IModify,
        target: string
    ): Promise<IRoom | undefined> {
        // Handle channel
        if (target.startsWith("#")) {
            const roomName = target.substring(1); // Remove # prefix
            return read.getRoomReader().getByName(roomName);
        }

        // Handle user
        if (target.startsWith("@")) {
            const username = target.substring(1); // Remove @ prefix
            const user = await read.getUserReader().getByUsername(username);

            if (user) {
                return getDirect(this.app, read, modify, username);
            }
        }

        return undefined;
    }
}
