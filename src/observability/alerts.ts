import axios from "axios";
import process from "node:process";

export async function sendAlert(message: string): Promise<void> {
  const webhook = process.env.ARB_ALERT_WEBHOOK;
  if (!webhook) return;
  await axios.post(
    webhook,
    { text: message },
    { timeout: 3000 }
  );
}
