export declare class PasswordService {
    private readonly saltRounds;
    hash(password: string): Promise<string>;
    compare(password: string, hash: string): Promise<boolean>;
    generateTemporaryPassword(): string;
}
