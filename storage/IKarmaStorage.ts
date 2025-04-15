/**
 * Holds the scores for receiving praise
 */
export interface IKarmaStorage {
	[username: string]: number;
}
/**
 * Holds the scores for giving praise
 */
export interface IPraiserKarmaStorage {
	[username: string]: number;
}
