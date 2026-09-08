import { execSync } from "child_process";

try {
  console.log("\n🔍 Checking latest 10 records from PostgreSQL database...\n");
  const output = execSync(
    `docker exec generator_db psql -U gmsuser -d generatordb -c "SELECT id, generator_id, status, rating, hours, valve_lash_hrs, remarks, updated_at FROM generators ORDER BY updated_at DESC LIMIT 10;"`,
    { encoding: "utf8" }
  );
  console.log(output);
} catch (err) {
  console.error("Error querying database:", err.message);
}
