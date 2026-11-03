import { tmpdir } from 'os';
import { join } from 'path';
import { resolveTestDatabaseUrl } from './test-db';

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.JWT_SECRET ??= 'e2e-test-secret';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR ??= join(tmpdir(), 'thriftos-e2e-uploads');
process.env.THROTTLE_LIMIT_SHORT ??= '100000';
process.env.THROTTLE_LIMIT_MEDIUM ??= '100000';
process.env.THROTTLE_LIMIT_LONG ??= '100000';
process.env.THROTTLE_LOGIN_LIMIT ??= '100000';
