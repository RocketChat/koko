/**
 * Holds the current state for listening
 *
 * Listen: username, praise or answer
 * Username: username being praised
 */
export interface IListenStorage {
    listen: string;
    username?: string;
}
