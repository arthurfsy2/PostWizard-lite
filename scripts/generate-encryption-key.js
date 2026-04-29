const { randomBytes } = require('crypto');

const key = randomBytes(32).toString('hex');
console.log('已生成 ENCRYPTION_KEY，请添加到 .env.local 文件中：\n');
console.log(`ENCRYPTION_KEY=${key}`);
