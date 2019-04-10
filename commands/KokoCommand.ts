import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { getDirect } from '../lib/helpers';
import { IListenStorage } from '../storage/IListenStorage';

export class KokoCommand implements ISlashCommand {
    public command = 'koko';
    public i18nParamsExample = 'Koko_Params';
    public i18nDescription = 'Koko_Description';
    public providesPreview = false;

    private CommandEnum = {
        Cancel: 'cancel',
        Help: 'help',
        Praise: 'praise',
    };

    constructor(private readonly app: KokoApp) { }
    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<void> {
        const [command, ...params] = context.getArguments();
        if (!command) {
            return this.processHelpCommand(context, read, modify);
        }

        switch (command) {
            case this.CommandEnum.Praise:
                await this.processPraiseCommand({ context, read, params, modify, persistence });
                break;
            case this.CommandEnum.Cancel:
                await this.processCancelCommand({ context, persistence, read, modify });
                break;
            default:
                this.processHelpCommand(context, read, modify);
        }
    }

    private async processHelpCommand(context: SlashCommandContext, read: IRead, modify: IModify): Promise<void> {
        const user = context.getSender();
        const room = await getDirect({ app: this.app, read, modify, username: user.username }) as IRoom;
        const builder = modify.getCreator().startMessage()
            .setSender(this.app.botUser)
            .setRoom(room)
            .setText(
                `These are the commands I can understand:
                \`/koko praise\` [@username] [text] Starts a new praise message (username and text are optional)
                \`---
                \`/koko cancel\` Cancels previous operation
                \`/koko help\` Shows this message`,
            )
            .setUsernameAlias(this.app.kokoName)
            .setEmojiAvatar(this.app.kokoEmojiAvatar);
        try {
            await modify.getCreator().finish(builder);
        } catch (error) {
            console.log(error);
        }
    }

    // tslint:disable-next-line:max-line-length
    private async processCancelCommand({ context, persistence, read, modify }: { context: SlashCommandContext, persistence: IPersistence, read: IRead, modify: IModify }) {
        const sender = context.getSender();
        const room = await getDirect({ app: this.app, modify, read, username: sender.username }) as IRoom;
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
        await persistence.removeByAssociation(association);
        const message = modify.getCreator().startMessage()
            .setText('You\'ve cancelled the last operation.')
            .setRoom(room)
            .setSender(this.app.botUser)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setUsernameAlias(this.app.kokoName);
        await modify.getCreator().finish(message);
    }

    // tslint:disable-next-line:max-line-length
    private async processPraiseCommand({ context, read, params, modify, persistence }: { context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence, params?: Array<string> }): Promise<void> {
        const sender = context.getSender();
        const room = await getDirect({ app: this.app, modify, read, username: sender.username }) as IRoom;
        if (params && params.length > 0 && params[0].trim()) {
            const username = params[0];
            params.shift();
            const text = params.join(' ');
            const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
            if (await this.app.kokoPraise.getUsernameFromText({ text: username, read })) {
                const data: IListenStorage = { listen: 'praise', username };
                await persistence.updateByAssociation(association, data, true);
                await this.app.kokoPraise.answer({ data, text: text.trim() ? text : username, room, sender, read, persistence, modify });
            } else {
                const data: IListenStorage = { listen: 'username' };
                await persistence.updateByAssociation(association, data, true);
                await this.app.kokoPraise.answer({data, text: username, room, sender, read, persistence, modify });
            }
        } else {
            this.app.kokoPraise.run({ read, user: sender, modify, persistence });
        }
    }
}
