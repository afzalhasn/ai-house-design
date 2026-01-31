export interface ImageHistoryItem {
    id: string;
    url: string;
    prompt: string;
    name?: string; // For Drive files
    timestamp: number;
    aspectRatio?: string;
}

export enum LoadingState {
    IDLE = 'IDLE',
    GENERATING = 'GENERATING',
    EDITING = 'EDITING',
    SAVING = 'SAVING',
    PUBLISHING = 'PUBLISHING',
    ERROR = 'ERROR'
}
