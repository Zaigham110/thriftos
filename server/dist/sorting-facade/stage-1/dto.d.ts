export declare class Stage1StartDto {
    ragId?: string;
    incomingBaleId?: string;
    workerId?: string;
    supervisorId?: string;
}
export declare class Stage1AllocateDto {
    sessionId: string;
    categoryId: string;
    amountKg: number;
}
export declare class Stage1AddWasteDto {
    sessionId: string;
    wasteCategoryId: string;
    amount: number;
}
export declare class Stage1UpdateWasteDto {
    wasteCategoryId: string;
    amount: number;
}
export declare class Stage1SealDto {
    wasteCategoryId?: string;
}
