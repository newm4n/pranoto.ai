import { JSONCodec } from "nats";
import { newConnection } from "./connect";

const connectionOptions = { servers: "localhost" };
const jc = JSONCodec();

export async function publish(event: string, message: Record<string, any>) {
  try {
    const nc = await newConnection();
    console.log(`connected to ${nc.getServer()}`);

    console.log(`publishing event: ${event}`);
    nc.publish(event, jc.encode(message));
  } catch (error) {
    console.error(`error connecting to ${JSON.stringify(connectionOptions)}`);
  }
}
