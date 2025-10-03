import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function getApiKey({ container }: ExecArgs) {
  const apiKeyModuleService = container.resolve(Modules.API_KEY);
  
  try {
    const [apiKeys] = await apiKeyModuleService.listAndCountApiKeys({
      type: "publishable"
    });
    
    if (apiKeys.length === 0) {
      console.log("No publishable API keys found. Please run the seed script first.");
      return;
    }
    
    const apiKey = apiKeys[0];
    console.log("Publishable API Key found:");
    console.log("ID:", apiKey.id);
    console.log("Token:", apiKey.token);
    console.log("Title:", apiKey.title);
    console.log("Type:", apiKey.type);
    console.log("\nAdd this to your .env.local file:");
    console.log(`MEDUSA_PUBLISHABLE_API_KEY=${apiKey.token}`);
    
  } catch (error) {
    console.error("Error fetching API key:", error);
  }
}
