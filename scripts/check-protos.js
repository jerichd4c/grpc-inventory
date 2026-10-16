import { join } from 'node:path';
import * as protoLoader from '@grpc/proto-loader';

const PROTOS_DIR = join(import.meta.dirname, '..', 'protos');
const FILES = ['report.proto', 'audit.proto'];

for (const file of FILES) {
    const definition = protoLoader.loadSync(join(PROTOS_DIR, file));
    
    console.log(`\n${file}`);
    for (const [name, def] of Object.entries(definition)) {
        // Messages and enums carry a "format" field; services do not.
        if (def.format) {
            console.log(`  ${def.format.includes('Enum') ? 'enum   ' : 'message'} ${name}`);
        } else {
            console.log(`  service ${name}`);
            for (const method of Object.keys(def)) {
                console.log(`    rpc ${method}`);
            }
        }
    }
}