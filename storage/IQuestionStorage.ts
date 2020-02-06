import { IAnswerStorage } from './IAnswerStorage';

/**
 * Holds the question
 */
export interface IQuestionStorage {
    question: string;
    answers: Record<string, IAnswerStorage>;
}
