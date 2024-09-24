import { readdirSync, renameSync } from 'fs';
import { extname, join, basename } from 'path';

const dir = './dist';

readdirSync(dir).forEach(file => {
  if (extname(file) === '.js') {
    const oldPath = join(dir, file);
    const newPath = join(dir, basename(file, '.js') + '.mjs');    
    renameSync(oldPath, newPath);
  }
});