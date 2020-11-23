/**
 * Holds the suggested rooms
 */
export type SuggestedRoom = {
    name: string;
    inviteLink: string;
}

export interface ISuggestedRoomsStorage {
    rooms: SuggestedRoom[];
}

export const SuggestedRoomsAssociationID = 'suggested-rooms';
