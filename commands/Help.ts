import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

import { KokoApp } from '../KokoApp';
import { getDirect, sendMessage } from '../lib/helpers';

export async function processHelpCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify): Promise<void> {
    const sender = context.getSender();
    const room = await getDirect(app, read, modify, sender.username) as IRoom;
    const message = `These are the commands I can understand:
        \`/koko praise\` Starts a new praise message
        \`/koko question\` Repeats last question allowing you to change your answer
        \`/koko 1:1 (or one-on-one)\` Adds user to the random one-on-one waiting list
        \---
        \`/koko cancel\` Cancels all operations with current user
        \`/koko help\` Shows this message
        \---
        \`/koko suggest-rooms\` Displays a list of suggested rooms you might be intersted in.
        \`/koko register-room <name> <inviteLink>\` Registers a new suggested room.
        \`/koko remove-room\` Prompts rooms to be removed.`;

    await sendMessage(app, modify, room, message);
}
