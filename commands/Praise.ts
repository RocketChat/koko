import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

import { KokoApp } from '../KokoApp';
import { praiseModal } from '../modals/PraiseModal';

// tslint:disable-next-line:max-line-length
export async function processPraiseCommand(
	app: KokoApp,
	context: SlashCommandContext,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	params?: Array<string>,
): Promise<void> {
	if (params && params.length > 0 && params[0].trim()) {
		const firstParam = params.shift() as string | boolean;

		// If first param is 'score', send scoreboard
		if (firstParam === 'score') {
			return await app.kokoPraise.sendKarmaScoreboard({
				read,
				modify,
				room: context.getRoom(),
				user: context.getSender(),
				praisees: true,
				praisers: true,
			});
		}
	}

	const triggerId = context.getTriggerId();
	if (triggerId) {
		try {
			const modal = await praiseModal({ app, read, modify, data: { user: context.getSender() } });
			await modify.getUiController().openModalView(modal, { triggerId }, context.getSender());
		} catch (error) {
			console.log(error);
		}
	}
}
