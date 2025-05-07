import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { questionModal } from '../modals/QuestionModal';
import { hasValidRole } from '../lib/helpers';
import { getQuestionAskModal } from '../modals/QuestionAskModal';

// tslint:disable-next-line:max-line-length
export async function processQuestionCommand(
	app: KokoApp,
	context: SlashCommandContext,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
): Promise<void> {
	const triggerId = context.getTriggerId();
	const sender = context.getSender();
	const room = context.getRoom();

	if (triggerId) {
		try {
			if (await hasValidRole(read, sender.roles, app.managerRolesMap)) {
				// Handle the manager role show them a Modal to ship the question
				const questionAskModal = getQuestionAskModal(app.getID());
				await modify.getUiController().openSurfaceView(questionAskModal, { triggerId }, context.getSender());
				return;
			}
			const modal = await questionModal({ read, modify, data: { user: context.getSender() } });
			await modify.getUiController().openModalView(modal, { triggerId }, context.getSender());
		} catch (error) {
			console.log(error);
		}
	}
}
