import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { getMembers, notifyUser } from '../lib/helpers';
import { processCancelCommand } from './Cancel';
import { processHelpCommand } from './Help';
import { processOneOnOneCommand } from './OneOnOne';
import { processPraiseCommand } from './Praise';
import { processQuestionCommand } from './Question';
import { processSendCommand } from './Send';

export class KokoCommand implements ISlashCommand {
    public command = 'koko';
    public i18nParamsExample = 'Koko_Params';
    public i18nDescription = 'Koko_Description';
    public providesPreview = false;

    private CommandEnum = {
        Cancel: 'cancel',
        Help: 'help',
        Praise: 'praise',
        Question: 'question',
        OneOnOne: 'one-on-one',
        OneOnOneNumeral: '1:1',
        Send: 'send',
    };

    constructor(private readonly app: KokoApp) { }
    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<void> {

        // Gets room members (removes rocket.cat and koko bot)
        const members = await getMembers(this.app, read);
        const sender = context.getSender();
        const room = context.getRoom();
        console.log(members);
        if (!(members.some((member) => member.username === sender.username))) {
            return await notifyUser(this.app, modify, room, sender, `You are not allowed to run this command.`);
        }

        const [command, ...params] = context.getArguments();
        if (!command) {
            return await processHelpCommand(this.app, context, read, modify);
        }

        switch (command) {
            case this.CommandEnum.Praise:
                await processPraiseCommand(this.app, context, read, modify, persistence, params);
                break;
            case this.CommandEnum.Question:
                await processQuestionCommand(this.app, context, read, modify, persistence);
                break;
            case this.CommandEnum.OneOnOne:
            case this.CommandEnum.OneOnOneNumeral:
                await processOneOnOneCommand(this.app, context, read, modify, persistence, params);
                break;
            case this.CommandEnum.Cancel:
                await processCancelCommand(this.app, context, read, modify, persistence);
                break;
            case this.CommandEnum.Send:
                await processSendCommand(this.app, context, read, modify, persistence, params);
                break;
            default:
                await processHelpCommand(this.app, context, read, modify);
        }
    }
}
