import { Identification } from "./identification.interface";

export interface Trigger {
    id: string;
    keyword: string;
    enabled: boolean;
    dateAdded: Date;
    dateUpdated: Date;
    identifications: Partial<Identification>[];
}
