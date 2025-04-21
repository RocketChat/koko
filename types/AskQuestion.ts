export type QuestionPayload = {
	text: string;
	collectionDate: string;
	askedBy: string;
	timestamp: string;
	msgIds: string[];
	state: 'pending' | 'sent' | 'closed';
};

export type ResponsePayload = {
	response: string;
	questionId: string;
	questionText: string;
	userId: string;
	roomId: string;
	msgId: string;
};
