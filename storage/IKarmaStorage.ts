/**
 * Holds the user praise scores
 */
export interface IKarmaStorage {
    // scores: Array<IScoreStorage>;
    [username: string]: number;

}
