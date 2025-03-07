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
 * Process a send command with format: send [roomName] [message]
 * @param {string[]} args - Array of command arguments
 * @returns {boolean} - True if command was processed successfully
 */
export const processSendCommand = async (
    app: KokoApp,
    context: SlashCommandContext,
    read: IRead,
    modify: IModify,
    persistence: IPersistence,
    args: string[]
) => {
    // Check if room name is provided
    if (args.length < 1) {
        await notifyUser(
            app,
            modify,
            context.getRoom(),
            context.getSender(),
            "Please provide a room name."
        );
        return false;
    }

    const roomName = args[0];

    const triggerId = context.getTriggerId();
    if (triggerId) {
        try {
            const modal = await sendModal({
                app,
                read,
                modify,
                data: { user: context.getSender(), roomName },
            });
            await modify
                .getUiController()
                .openModalView(modal, { triggerId }, context.getSender());
        } catch (error) {
            console.log(error);
            app.getLogger().error(
                `Error opening Send modal: ${
                    error?.message
                }, stringify: ${JSON.stringify(error, null, 2)}`
            );
        }
    }

    return true;
};
