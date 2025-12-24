import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

export type QuestionPayload = {
	questionId: string;
	text: string;
	collectionDate: string;
	askedBy: string;
	timestamp: string;
	sendAt?: string;
	msgIds: string[];
	state: 'pending' | 'sent' | 'closed';
};

export type QuestionMessageLink = {
	questionId: string;
	questionAssocId: string;
};

export type ResponsePayload = {
	response: string | undefined;
	questionId: string;
	questionText: string;
	userId: string;
	roomId: string;
	msgId: string;
	attachments?: Array<IMessageAttachment>;
};
