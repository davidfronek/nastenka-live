require("dotenv").config();
const storage = require("../postgres-storage");

async function main() {
  await storage.initializeStorage();
  console.log("PostgreSQL schema je připravené.");
}

main()
  .catch((error) => {
    console.error(`Inicializace PostgreSQL selhala: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => storage.close());
