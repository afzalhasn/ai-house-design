export interface ImageHistoryItem {
    id: string;
    url: string;
    prompt: string;
    timestamp: number;
    aspectRatio?: string;
}

export enum LoadingState {
    IDLE = 'IDLE',
    GENERATING = 'GENERATING',
    EDITING = 'EDITING',
    SAVING = 'SAVING',
    ERROR = 'ERROR'
}
