import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import {
	BlockElementType,
	IMultiStaticSelectElement,
	TextObjectType,
} from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { KokoApp } from '../KokoApp';
import { getMembers } from '../lib/helpers';

const UI_ID = 'send';

export async function sendModal({
	app,
	data,
	read,
	modify,
}: {
	app: KokoApp;
	data;
	read: IRead;
	modify: IModify;
}): Promise<IUIKitModalViewParam> {
	const viewId = UI_ID;
	const block = modify.getCreator().getBlockBuilder();
	const { roomName }: { roomName: string } = data;

	block.addInputBlock({
		blockId: UI_ID,
		element: block.newPlainTextInputElement({
			actionId: 'target',
			initialValue: roomName,
			multiline: false,
			placeholder: {
				type: TextObjectType.PLAINTEXT,
				text: 'Enter a channel name (e.g., #general) or a user name (e.g., @username)',
			},
		}),
		label: {
			type: TextObjectType.PLAINTEXT,
			text: 'Send to Channel or User',
			emoji: true,
		},
	});

	block.addInputBlock({
		blockId: UI_ID,
		element: block.newPlainTextInputElement({
			actionId: 'message',
			multiline: true,
		}),
		label: {
			type: TextObjectType.PLAINTEXT,
			text: `What would you like to send?`,
			emoji: true,
		},
	});

	return {
		id: viewId,
		title: {
			type: TextObjectType.PLAINTEXT,
			text: 'Send Message',
		},
		submit: block.newButtonElement({
			text: {
				type: TextObjectType.PLAINTEXT,
				text: 'Send',
			},
		}),
		close: block.newButtonElement({
			text: {
				type: TextObjectType.PLAINTEXT,
				text: 'Cancel',
			},
		}),
		blocks: block.getBlocks(),
	};
}

export async function messageSubmittedModal({
	read,
	modify,
	data,
}: {
	read: IRead;
	modify: IModify;
	data;
}): Promise<IUIKitModalViewParam> {
	const viewId = UI_ID;
	const block = modify.getCreator().getBlockBuilder();

	block.addSectionBlock({
		text: {
			type: TextObjectType.PLAINTEXT,
			text: 'Your message has been sent successfully.',
		},
	});

	return {
		id: viewId,
		title: {
			type: TextObjectType.PLAINTEXT,
			text: 'Message Sent',
		},
		submit: undefined,
		close: block.newButtonElement({
			text: {
				type: TextObjectType.PLAINTEXT,
				text: 'Close',
			},
		}),
		blocks: block.getBlocks(),
	};
}
