export declare class Stage2StartDto {
    categoryOutputId: string;
    workerId?: string;
    supervisorId?: string;
}
export declare class Stage2AllocateDto {
    sessionId: string;
    gradeId: string;
    amountKg: number;
}
export declare class Stage2AddWasteDto {
    sessionId: string;
    wasteCategoryId: string;
    amount: number;
}
export declare class Stage2UpdateWasteDto {
    wasteCategoryId: string;
    amount: number;
}
export declare class Stage2SealDto {
    wasteCategoryId?: string;
}
