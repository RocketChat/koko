import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';

export class KokoHelp {
    constructor(private readonly app: KokoApp) { }

    public async run(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getNotifier().getMessageBuilder()
            .setText(`*Koko is here to help you*:
            \`/koko praise\` starts a new praise request`)
            .setUsernameAlias(this.app.kokoName)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setRoom(context.getRoom())
            .setSender(context.getSender())
            .getMessage();
        await modify.getNotifier().notifyUser(context.getSender(), msg);
    }
}
