import {
    IRead,
    IModify,
    IPersistence,
} from "@rocket.chat/apps-engine/definition/accessors";
import { SlashCommandContext } from "@rocket.chat/apps-engine/definition/slashcommands";
import { KokoApp } from "../KokoApp";
import { sendModal } from "../modals/SendModal";
import { notifyUser } from "../lib/helpers";

/**
 * Processes a send command and opens a modal for message composition
 * Format: /koko send [#roomName | @userName]
 *
 * @param app The Koko app instance
 * @param context The slash command context
 * @param read The read accessor
 * @param modify The modify accessor
 * @param persistence The persistence accessor
 * @param args Command arguments
 */
export const processSendCommand = async (
    app: KokoApp,
    context: SlashCommandContext,
    read: IRead,
    modify: IModify,
    persistence: IPersistence,
    args: string[]
): Promise<void> => {
    const sender = context.getSender();
    const room = context.getRoom();

    // Validate target room/user parameter
    if (args.length < 1) {
        await notifyUser(
            app,
            modify,
            room,
            sender,
            "Please specify a target: `/koko send #channel` or `/koko send @username`"
        );
        return;
    }

    // Extract and validate room name format
    const roomName = args[0].trim();
    if (!roomName.startsWith("#") && !roomName.startsWith("@")) {
        await notifyUser(
            app,
            modify,
            room,
            sender,
            "Invalid format. Please use `/koko send #channel` for rooms or `/koko send @username` for users."
        );
        return;
    }

    // Open the modal dialog for message composition
    const triggerId = context.getTriggerId();
    if (!triggerId) {
        app.getLogger().error("Missing trigger ID for send command");
        await notifyUser(
            app,
            modify,
            room,
            sender,
            "Unable to open message composer. Please try again."
        );
        return;
    }

    try {
        // Create and open the send modal
        const modal = await sendModal({
            app,
            read,
            modify,
            data: { user: sender, roomName },
        });

        await modify
            .getUiController()
            .openModalView(modal, { triggerId }, sender);
    } catch (error) {
        // Properly handle and log errors
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

        app.getLogger().error(
            `Error opening Send modal: ${errorMessage}`,
            error
        );

        await notifyUser(
            app,
            modify,
            room,
            sender,
            "There was a problem opening the message composer. Please try again."
        );
    }
};
