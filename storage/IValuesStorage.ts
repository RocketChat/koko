/**
 * Holds the value answers
 */
export interface IValueAnswer {
    username: string;
    selectedUsers?: Array<string>;
    answer: string;
}

export interface IValueAnswerStorage extends Array<IValueAnswer> { }

/**
 * Holds the scores for answering value questions
 */
export interface IValuesPointStorage {
    [username: string]: number;
}
