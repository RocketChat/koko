export type QuestionPayload = {
	text: string;
	collectionDate: string;
	askedBy: string;
	timestamp: string;
	msgIds: string[];
	state: 'pending' | 'sent' | 'closed';
};
