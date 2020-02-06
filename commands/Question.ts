import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { questionModal } from '../modals/QuestionModal';

// tslint:disable-next-line:max-line-length
export async function processQuestionCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence): Promise<void> {
    const triggerId = context.getTriggerId();
    if (triggerId) {
        try {
            const modal = await questionModal({ read, modify, data: { user: context.getSender() } });
            await modify.getUiController().openModalView(modal, { triggerId }, context.getSender());
        } catch (error) {
            console.log(error);
        }
    }
}
