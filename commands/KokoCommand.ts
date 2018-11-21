import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';

export class KokoCommand implements ISlashCommand {
    public command = 'koko';
    public i18nParamsExample = 'Koko_Command_Params';
    public i18nDescription = 'Koko_Command_Description';
    public providesPreview = false;

    constructor(private readonly app: KokoApp) { }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const args = context.getArguments();
        if (args.length === 0) {
            return await this.app.kokoHelp.run(context, modify);
        }
        switch (args[0]) {
            case 'praise':
                return await this.app.kokoPraise.run(read, modify, http, persis);
            default:
                return await this.app.kokoHelp.run(context, modify);
        }
    }
}
