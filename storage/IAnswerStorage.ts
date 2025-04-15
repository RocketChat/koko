/**
 * Holds the answer and who answered
 */
export interface IAnswer {
	username: string;
	answer: string;
}

export interface IAnswerStorage extends Array<IAnswer> {}
