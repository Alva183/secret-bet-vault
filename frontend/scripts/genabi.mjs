import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateABI() {
  try {
    const deploymentsPath = path.join(__dirname, "../../deployments");
    const abiOutputPath = path.join(__dirname, "../abi");

    // Read localhost deployments
    const localhostPath = path.join(deploymentsPath, "localhost");
    const sepoliaPath = path.join(deploymentsPath, "sepolia");
    
    try {
      const files = await fs.readdir(localhostPath);
      
      for (const file of files) {
        if (file.endsWith(".json") && !file.includes("solcInputs")) {
          const contractName = file.replace(".json", "");
          const deploymentFile = await fs.readFile(
            path.join(localhostPath, file),
            "utf8"
          );
          const deployment = JSON.parse(deploymentFile);

          // Try to read Sepolia deployment
          let sepoliaAddress = "0x0000000000000000000000000000000000000000";
          try {
            const sepoliaDeploymentFile = await fs.readFile(
              path.join(sepoliaPath, file),
              "utf8"
            );
            const sepoliaDeployment = JSON.parse(sepoliaDeploymentFile);
            sepoliaAddress = sepoliaDeployment.address;
          } catch (error) {
            // Sepolia deployment not found, use default
          }

          // Generate ABI file
          const abiContent = `export const ${contractName}ABI = ${JSON.stringify(
            deployment.abi,
            null,
            2
          )} as const;\n`;
          
          await fs.writeFile(
            path.join(abiOutputPath, `${contractName}ABI.ts`),
            abiContent
          );

          // Generate addresses file
          const addressesContent = `export const ${contractName}Addresses: Record<number, string> = {
  31337: "${deployment.address}", // Localhost/Hardhat
  11155111: "${sepoliaAddress}", // Sepolia
};\n`;
          
          await fs.writeFile(
            path.join(abiOutputPath, `${contractName}Addresses.ts`),
            addressesContent
          );

          console.log(`✅ Generated ABI and addresses for ${contractName}`);
        }
      }
    } catch (error) {
      console.log("No localhost deployments found, using existing ABI files");
    }

    console.log("✅ ABI generation complete");
  } catch (error) {
    console.error("Error generating ABI:", error);
    process.exit(1);
  }
}

generateABI();
