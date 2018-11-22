/**
 * Holds the current state for praising
 *
 * Listen: username or praise
 * Username: username being praised
 */
export interface IPraiseStorage {
    listen: string;
    username?: string;
}
