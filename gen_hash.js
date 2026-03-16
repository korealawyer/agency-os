const bcrypt = require('bcryptjs');
const fs = require('fs');

async function main() {
  const hash = await bcrypt.hash('password', 10);
  fs.writeFileSync('hash_output.txt', hash);
  console.log('Done! Hash saved to hash_output.txt');
}

main();
